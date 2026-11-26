package main

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"io/fs"
	"log"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/tim72117/evoleap/internal/store"
)

// sitemap.xml 由資料庫決定哪些課頁要收錄:前端 build 只輸出「可收錄的頁面清單」(dist/sitemap-pages.json,
// 見 web/scripts/seo.mjs)。單課頁不逐課列,只列「哪些課要展開」(lessonsOf);這裡依資料庫展開成已開放(open)的課,
// 草稿、規劃中與先不公開單元的不列。規劃中章節頁標著它是哪一課(lesson),同樣開放才收錄。
// 英文版課程總覽同樣看資料庫:沒有英文版的課不列英文網址,中文網址也不放 hreflang。
// 沒有種子備援:沒接資料庫時只列非課頁(也沒有英文課程頁)。

// sitemapPagesFile 是前端 build 輸出的頁面清單(只給 server 讀,不對外提供)
const sitemapPagesFile = "sitemap-pages.json"

// sitemapPage 是 sitemap-pages.json 的一筆
type sitemapPage struct {
	Loc      string   `json:"loc"`
	Priority *float64 `json:"priority,omitempty"`
	// Alternates 是這一頁的各語言版本(含自己),輸出成 xhtml:link hreflang,讓搜尋引擎知道哪些網址是同一頁的不同語言
	Alternates []struct {
		Lang string `json:"lang"`
		Loc  string `json:"loc"`
	} `json:"alternates,omitempty"`
	Lesson *struct {
		Course string `json:"course"`
		ID     string `json:"id"`
	} `json:"lesson,omitempty"`
	// English:這一頁的英文版取決於這門課有沒有英文譯文;EnglishOnly 表示這一筆本身就是英文頁(沒有譯文就整筆不列),
	// 否則只拿掉 Alternates
	English     string `json:"english,omitempty"`
	EnglishOnly bool   `json:"englishOnly,omitempty"`
	// LessonsOf:這一筆不是一頁,Loc 是課程網址,展開成這門課每個已開放的課;Staged 是軟體課的網址規則(lessonSlug)
	LessonsOf *struct {
		Course string `json:"course"`
		Staged bool   `json:"staged,omitempty"`
	} `json:"lessonsOf,omitempty"`
}

// locsOf 回傳清單的一筆實際要輸出的網址
func locsOf(p sitemapPage, opened map[string]bool) []string {
	if p.Lesson != nil && !opened[p.Lesson.Course+"/"+p.Lesson.ID] {
		return nil
	}
	if p.LessonsOf == nil {
		return []string{p.Loc}
	}
	var out []string
	for key := range opened {
		if id, ok := strings.CutPrefix(key, p.LessonsOf.Course+"/"); ok {
			out = append(out, p.Loc+"/"+store.LessonSlug(p.LessonsOf.Staged, id))
		}
	}
	slices.Sort(out)
	return slices.Compact(out)
}

// openLessons 回傳已開放的課(「課程 id/課號」為 key);沒接資料庫時為 nil
type openLessons func(context.Context) (map[string]bool, error)

// sitemapHandler 回傳 /sitemap.xml 的處理;dist 裡沒有 sitemap-pages.json(例如只有佔位的 embed)時回 nil。
func sitemapHandler(dist fs.FS, open, english openLessons) http.Handler {
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
	var cachedID, cachedEnglishID uintptr
	var haveXML bool
	render := func(ctx context.Context) (string, error) {
		var opened, translated map[string]bool
		var err error
		if open != nil {
			if opened, err = open(ctx); err != nil {
				return "", err
			}
		}
		if english != nil {
			// 譯文清單讀不到只是這次不列英文網址,不讓整份 sitemap 失敗
			if translated, err = english(ctx); err != nil {
				log.Printf("sitemap 讀不到英文課程清單:%v", err)
				translated = nil
			}
		}
		id, englishID := mapID(opened), mapID(translated)
		mu.Lock()
		defer mu.Unlock()
		if !haveXML || cachedID != id || cachedEnglishID != englishID {
			cachedXML, cachedID, cachedEnglishID, haveXML = sitemapXML(pages, opened, translated), id, englishID, true
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

func sitemapXML(pages []sitemapPage, opened, translated map[string]bool) string {
	var b strings.Builder
	b.WriteString("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">\n")
	for _, p := range pages {
		if p.English != "" && !translated[p.English] {
			if p.EnglishOnly {
				continue
			}
			p.Alternates = nil
		}
		for _, u := range locsOf(p, opened) {
			var loc strings.Builder
			_ = xml.EscapeText(&loc, []byte(u))
			b.WriteString("  <url><loc>" + loc.String() + "</loc>")
			for _, a := range p.Alternates {
				var href, lang strings.Builder
				_ = xml.EscapeText(&href, []byte(a.Loc))
				_ = xml.EscapeText(&lang, []byte(a.Lang))
				b.WriteString("<xhtml:link rel=\"alternate\" hreflang=\"" + lang.String() + "\" href=\"" + href.String() + "\"/>")
			}
			if p.Priority != nil {
				b.WriteString("<priority>" + strconv.FormatFloat(*p.Priority, 'f', 1, 64) + "</priority>")
			}
			b.WriteString("</url>\n")
		}
	}
	b.WriteString("</urlset>\n")
	return b.String()
}
