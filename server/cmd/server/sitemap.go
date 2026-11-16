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
	// 公開端點:已開放的課的查詢由呼叫端包快取(cachedOpenLessons);組好的 XML 依已開放的課(mapID)記著,沒變就不重組
	var mu sync.Mutex
	var cachedXML string
	var cachedID uintptr
	var haveXML bool
	render := func(ctx context.Context) (string, error) {
		var opened map[string]bool
		if open != nil {
			var err error
			if opened, err = open(ctx); err != nil {
				return "", err
			}
		}
		id := mapID(opened)
		mu.Lock()
		defer mu.Unlock()
		if !haveXML || cachedID != id {
			cachedXML, cachedID, haveXML = sitemapXML(pages, opened), id, true
		}
		return cachedXML, nil
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
