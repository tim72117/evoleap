package main

import (
	"bytes"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"
	"time"
)

// web/dist 由 Dockerfile 把 web/ 的 Vite build 產物複製進來;版控裡只有
// placeholder index.html,本機 go run 時看到 "build not found" 屬正常。
//
//go:embed web/dist
var webDist embed.FS

// noindexMarker 是 web/scripts/seo.mjs 為內部頁(/proposal、/docs、/materials…)
// 產生的 robots meta;有這個標籤的頁面同時加上 X-Robots-Tag 標頭,兩者以 HTML 為唯一來源。
const noindexMarker = `<meta name="robots" content="noindex`

// page 是 build 時預先產生的一個路由的 HTML(dist/<路由>/index.html)。
type page struct {
	body    []byte
	etag    string
	noindex bool
}

func newPage(body []byte) *page {
	sum := sha256.Sum256(body)
	return &page{
		body:    body,
		etag:    `"` + hex.EncodeToString(sum[:8]) + `"`,
		noindex: bytes.Contains(body, []byte(noindexMarker)),
	}
}

// staticHandler 提供內嵌的前端 build;distDir 非空時改從磁碟目錄讀取
// (本機與 E2E 測試直接用 web/dist,不必複製進 embed 目錄)。
func staticHandler(distDir string) http.Handler {
	if distDir != "" {
		return newStaticHandler(os.DirFS(distDir))
	}
	sub, err := fs.Sub(webDist, "web/dist")
	if err != nil {
		panic(err)
	}
	return newStaticHandler(sub)
}

// newStaticHandler 提供前端 build 產物:
//   - 無副檔名的路徑是頁面:回傳該路由預先產生的 HTML(含各頁 SEO 標籤),
//     沒有對應的頁面就以 404 狀態回傳 404.html(前端 router 會顯示「找不到頁面」)。
//     結尾多了斜線(/docs/)以 301 導向不帶斜線的網址,與 canonical 一致。
//   - 有副檔名的路徑是靜態檔:/assets/*(檔名含 hash)長期快取,其他短期快取;
//     找不到回 404,不回 HTML——否則瀏覽器會把 HTML 當成 JS/CSS 解析,錯誤更難查。
func newStaticHandler(dist fs.FS) http.Handler {
	pages := map[string]*page{}
	err := fs.WalkDir(dist, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || path.Base(p) != "index.html" {
			return err
		}
		body, err := fs.ReadFile(dist, p)
		if err != nil {
			return err
		}
		pages[path.Clean("/"+path.Dir(p))] = newPage(body)
		return nil
	})
	if err != nil {
		panic(err)
	}
	if pages["/"] == nil {
		panic("web/dist/index.html not found")
	}
	var notFound *page
	if body, err := fs.ReadFile(dist, "404.html"); err == nil {
		notFound = newPage(body)
	}
	fileServer := http.FileServer(http.FS(dist))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := path.Clean("/" + r.URL.Path)

		if path.Ext(name) == "" {
			pg := pages[name]
			if pg != nil && name != r.URL.Path {
				redirect(w, r, name)
				return
			}
			if pg == nil {
				serveNotFound(w, r, notFound)
				return
			}
			servePage(w, r, pg)
			return
		}

		// /courses/tools/index.html 之類的實際檔名 → 導向頁面網址,避免重複內容。
		if path.Base(name) == "index.html" {
			if dir := path.Dir(name); pages[dir] != nil {
				redirect(w, r, dir)
				return
			}
		}
		info, err := fs.Stat(dist, name[1:])
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		if strings.HasPrefix(name, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=3600")
		}
		fileServer.ServeHTTP(w, r)
	})
}

func redirect(w http.ResponseWriter, r *http.Request, to string) {
	if r.URL.RawQuery != "" {
		to += "?" + r.URL.RawQuery
	}
	http.Redirect(w, r, to, http.StatusMovedPermanently)
}

func setPageHeaders(w http.ResponseWriter, pg *page) {
	h := w.Header()
	h.Set("Content-Type", "text/html; charset=utf-8")
	// HTML 參照的 /assets/* 檔名每次 build 都會變,HTML 本身每次都要向 server 確認(ETag)。
	h.Set("Cache-Control", "no-cache")
	if pg.noindex {
		h.Set("X-Robots-Tag", "noindex, nofollow")
	}
}

func servePage(w http.ResponseWriter, r *http.Request, pg *page) {
	setPageHeaders(w, pg)
	w.Header().Set("ETag", pg.etag)
	http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(pg.body))
}

func serveNotFound(w http.ResponseWriter, r *http.Request, pg *page) {
	if pg == nil { // placeholder build 沒有 404.html
		http.NotFound(w, r)
		return
	}
	setPageHeaders(w, pg)
	w.WriteHeader(http.StatusNotFound)
	if r.Method != http.MethodHead {
		w.Write(pg.body)
	}
}
