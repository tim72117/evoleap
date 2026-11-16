package main

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"io/fs"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// sitemap.xml 由資料庫決定哪些課頁要收錄:前端 build 只輸出「可收錄的頁面清單」(dist/sitemap-pages.json,
// 見 web/scripts/seo.mjs),課頁標著它是哪一課;這裡依資料庫裡那一課的狀態,只列已開放(open)的課,草稿、規劃中的不列。
// 沒有種子備援:沒接資料庫時只列非課頁。

// sitemapPagesFile 是前端 build 輸出的頁面清單(只給 server 讀,不對外提供)
const sitemapPagesFile = "sitemap-pages.json"

// sitemapPage 是 sitemap-pages.json 的一筆
type sitemapPage struct {
	Loc      string   `json:"loc"`
	Priority *float64 `json:"priority,omitempty"`
	Lesson   *struct {
		Course string `json:"course"`
		ID     string `json:"id"`
	} `json:"lesson,omitempty"`
}

// openLessons 回傳已開放的課(「課程 id/課號」為 key);沒接資料庫時為 nil
type openLessons func(context.Context) (map[string]bool, error)

// sitemapHandler 回傳 /sitemap.xml 的處理;dist 裡沒有 sitemap-pages.json(例如只有佔位的 embed)時回 nil。
func sitemapHandler(dist fs.FS, open openLessons) http.Handler {
	body, err := fs.ReadFile(dist, sitemapPagesFile)
	if err != nil {
		return nil
	}
	var pages []sitemapPage
	if err := json.Unmarshal(body, &pages); err != nil {
		panic("sitemap-pages.json: " + err.Error())
	}
	// 公開端點:結果在程序內記 1 分鐘,爬蟲連續請求不會每次都查資料庫。查詢時不握著鎖(不然資料庫慢時全部排隊),
	// 查詢失敗就用上一次成功的結果;還沒有成功過才回 503。
	var mu sync.Mutex
	var cached string
	var cachedAt time.Time
	render := func(ctx context.Context) (string, error) {
		mu.Lock()
		body, at := cached, cachedAt
		mu.Unlock()
		if body != "" && time.Since(at) < time.Minute {
			return body, nil
		}
		var opened map[string]bool
		if open != nil {
			var err error
			if opened, err = open(ctx); err != nil {
				if body != "" {
					return body, nil
				}
				return "", err
			}
		}
		body = sitemapXML(pages, opened)
		mu.Lock()
		cached, cachedAt = body, time.Now()
		mu.Unlock()
		return body, nil
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		xmlBody, err := render(r.Context())
		if err != nil {
			http.Error(w, "sitemap unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/xml; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=300")
		if r.Method == http.MethodHead {
			return
		}
		_, _ = w.Write([]byte(xmlBody))
	})
}

func sitemapXML(pages []sitemapPage, opened map[string]bool) string {
	var b strings.Builder
	b.WriteString("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n")
	for _, p := range pages {
		if p.Lesson != nil && !opened[p.Lesson.Course+"/"+p.Lesson.ID] {
			continue
		}
		var loc strings.Builder
		_ = xml.EscapeText(&loc, []byte(p.Loc))
		b.WriteString("  <url><loc>" + loc.String() + "</loc>")
		if p.Priority != nil {
			b.WriteString("<priority>" + strconv.FormatFloat(*p.Priority, 'f', 1, 64) + "</priority>")
		}
		b.WriteString("</url>\n")
	}
	b.WriteString("</urlset>\n")
	return b.String()
}
