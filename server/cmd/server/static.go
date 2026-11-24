package main

import (
	"bytes"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/tim72117/evoleap/internal/api"
)

// web/dist 由 Dockerfile 把 web/ 的 Vite build 產物複製進來;版控裡只有
// placeholder index.html,本機 go run 時看到 "build not found" 屬正常。
//
//go:embed web/dist
var webDist embed.FS

// noindexMarker 是 web/scripts/seo.mjs 為內部頁(/studio、/docs、/materials…)
// 產生的 robots meta;有這個標籤的頁面同時加上 X-Robots-Tag 標頭,兩者以 HTML 為唯一來源。
const noindexMarker = `<meta name="robots" content="noindex`

// internalPrefixes 是只有管理員能看的路徑:研發基地的頁面,以及它們的打包內容
// (vite.config.ts 把內部內容輸出到 assets/internal/)。比對的是 path.Clean 之後的路徑。
var internalPrefixes = []string{"/studio", "/docs", "/materials", "/assets/internal"}

func isInternalPath(name string) bool {
	for _, p := range internalPrefixes {
		if name == p || strings.HasPrefix(name, p+"/") {
			return true
		}
	}
	return false
}

// accessFunc 判斷請求對內部頁的權限;正式環境是 api.Server.InternalAccess。
type accessFunc func(*http.Request) api.Access

// openAccess 不檢查權限,只給 -open-studio(本機與 E2E)使用。
func openAccess(*http.Request) api.Access { return api.AccessAllowed }

// page 是 build 時預先產生的一個路由的 HTML(dist/<路由>/index.html)。
type page struct {
	body     []byte
	etag     string
	gz       []byte // body 的 gzip 壓縮版(太小時是 nil)
	noindex  bool
	internal bool
	// dynamic:頁面的結構化資料裡有依資料庫決定的課程連結(seo_ld.go),回傳時才處理;
	// 處理後的頁面依已開放的課(mapID)記著,沒變就不重做
	dynamic bool
	mu      sync.Mutex
	patched *page
	patchID uintptr
}

func newPage(body []byte, internal bool) *page { return newPageWith(body, internal, gzipBytes) }

// newPageWith 同 newPage,compress 決定壓縮版怎麼產生(請求當下才產生的頁面用較快的等級)。
func newPageWith(body []byte, internal bool, compress func([]byte) []byte) *page {
	sum := sha256.Sum256(body)
	return &page{
		body:     body,
		etag:     `"` + hex.EncodeToString(sum[:8]) + `"`,
		gz:       compress(body),
		noindex:  bytes.Contains(body, []byte(noindexMarker)),
		internal: internal,
		dynamic:  hasLessonLinks(body),
	}
}

// distFS 是前端 build 的檔案系統:內嵌的 build;distDir 非空時改從磁碟目錄讀取
// (本機與 E2E 測試直接用 web/dist,不必複製進 embed 目錄)。
func distFS(distDir string) fs.FS {
	if distDir != "" {
		return os.DirFS(distDir)
	}
	sub, err := fs.Sub(webDist, "web/dist")
	if err != nil {
		panic(err)
	}
	return sub
}

// newStaticHandler 提供前端 build 產物:
//   - 內部路徑(internalPrefixes)先檢查權限:未登入的頁面請求導向登入頁,
//     其他沒有權限的情況一律回 404,不透露內部頁存在與否。
//   - 無副檔名的路徑是頁面:回傳該路由預先產生的 HTML(含各頁 SEO 標籤),
//     沒有對應的頁面就以 404 狀態回傳 404.html(前端 router 會顯示「找不到頁面」)。
//     結尾多了斜線(/docs/)以 301 導向不帶斜線的網址,與 canonical 一致。
//   - 有副檔名的路徑是靜態檔:/assets/*(檔名含 hash)長期快取,其他短期快取;
//     找不到回 404,不回 HTML——否則瀏覽器會把 HTML 當成 JS/CSS 解析,錯誤更難查。
func newStaticHandler(dist fs.FS, access accessFunc) http.Handler {
	return newStaticHandlerWithOpen(dist, access, nil)
}

// newStaticHandlerWithOpen 同 newStaticHandler;open 回傳已開放的課,頁面結構化資料裡的課程連結(seo_ld.go)依它處理,
// 沒接資料庫(nil)時所有課都不附連結。
func newStaticHandlerWithOpen(dist fs.FS, access accessFunc, open openLessons) http.Handler {
	pages := map[string]*page{}
	err := fs.WalkDir(dist, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || path.Base(p) != "index.html" {
			return err
		}
		body, err := fs.ReadFile(dist, p)
		if err != nil {
			return err
		}
		route := path.Clean("/" + path.Dir(p))
		pages[route] = newPage(body, isInternalPath(route))
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
		notFound = newPage(body, false)
	}
	fileServer := http.FileServer(http.FS(dist))
	gzFiles := gzipAssets(dist)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := path.Clean("/" + r.URL.Path)
		internal := isInternalPath(name)

		if internal {
			if a := access(r); a != api.AccessAllowed {
				denyInternal(w, r, name, a, notFound)
				return
			}
		}

		if path.Ext(name) == "" {
			if to, ok := legacyCourseTarget(name); ok {
				redirect(w, r, to)
				return
			}
			pg := pages[name]
			if pg != nil && name != r.URL.Path {
				redirect(w, r, name)
				return
			}
			// 英文網址 /en/...:有預先產生的英文頁(例如 /en/courses)就用它;沒有的(登入、單課、還沒翻譯的頁)
			// 回對應的中文頁,畫面在瀏覽器端換成英文介面,但標 noindex,不讓搜尋引擎收錄內容還是中文的重複頁面
			if pg == nil && (name == "/en" || strings.HasPrefix(name, "/en/")) {
				if base := pages[path.Clean("/"+strings.TrimPrefix(name, "/en"))]; base != nil && !base.internal {
					if name != r.URL.Path {
						redirect(w, r, name) // 結尾斜線、大小寫:導到標準網址,不留重複網址
						return
					}
					pg = base
					w.Header().Set("X-Robots-Tag", "noindex, nofollow")
				}
			}
			if pg == nil {
				serveNotFound(w, r, notFound)
				return
			}
			if pg.dynamic {
				pg = dynamicPage(r, pg, open)
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
		// 建置產物裡給 /sitemap.xml 用的頁面清單(含還沒開放的課):不公開
		if name == "/"+sitemapPagesFile {
			http.NotFound(w, r)
			return
		}
		info, err := fs.Stat(dist, name[1:])
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		if internal {
			// 只留在管理員自己的瀏覽器,不讓中間的快取存下來給別人。
			w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
		} else if strings.HasPrefix(name, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=3600")
		}
		if useGzip(w, r, gzFiles[name]) {
			w.Header().Set("Content-Type", contentTypes[path.Ext(name)])
			http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(gzFiles[name]))
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

// denyInternal 回應沒有權限的內部路徑請求。
func denyInternal(w http.ResponseWriter, r *http.Request, name string, a api.Access, notFound *page) {
	isPage := path.Ext(name) == ""
	if a == api.AccessGuest && isPage {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Robots-Tag", "noindex, nofollow")
		http.Redirect(w, r, "/login?next="+url.QueryEscape(r.URL.RequestURI()), http.StatusFound)
		return
	}
	if isPage {
		serveNotFound(w, r, notFound)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	http.NotFound(w, r)
}

// legacyCourseRedirects:tools(起步)、ai-tools(零基礎)、vibe-coding(基礎)三門課
// 合併成 /courses/software 一門課,原本的課成為其中的階段(課程頁的 #stage-<階段 id>)。
// 課程根網址導向對應的階段;單課網址的 slug 在合併後的課程內不重複,/courses/<舊>/<rest> 直接對應 /courses/software/<rest>。
var legacyCourseRedirects = map[string]string{
	"/courses/tools":       "/courses/software#stage-tools",
	"/courses/ai-tools":    "/courses/software#stage-ai-tools",
	"/courses/vibe-coding": "/courses/software#stage-vibe-coding-basics",
}

const softwareCourse = "/courses/software"

// AI Agent 本身的頁面換成主題頁(打造 AI 互動軟體)。
const (
	aiAgentCourse = "/courses/ai-agent"
	aiAppsTopic   = "/topics/ai-apps"
)

// legacyCourseTarget 回傳舊課程網址(name 已 path.Clean,含結尾斜線的變體也會命中)對應的新網址;不是舊網址時回傳 false。
func legacyCourseTarget(name string) (string, bool) {
	// AI Agent 沒有自己的課程頁了:課程頁與底下的章節頁都改用主題頁
	if name == aiAgentCourse || strings.HasPrefix(name, aiAgentCourse+"/") {
		return aiAppsTopic, true
	}
	for old, root := range legacyCourseRedirects {
		if name == old {
			return root, true
		}
		if rest, ok := strings.CutPrefix(name, old+"/"); ok {
			return softwareCourse + "/" + rest, true
		}
	}
	for old, root := range legacyTopicRedirects {
		if name == old {
			return root, true
		}
		if rest, ok := strings.CutPrefix(name, old+"/"); ok && legacyTopicLessons[old] {
			return root + "/" + rest, true
		}
	}
	return "", false
}

// legacyTopicRedirects:網頁怎麼運作、從做好到上線、Claude Code 工作術、給孩子的網頁程式原本是 /topics/<主題> 的主題頁,
// 現在和其他課共用課程總覽頁(/courses/<課程>),一課一頁在 /courses/<課程>/<課號>。
// 單課網址(/topics/web/1-2、/topics/launch/0-1、/topics/kids/0-1)的課號段沒變;Claude Code 的舊錨點(#remote、#fork)由前端轉到各情境的課頁(瀏覽器轉址會保留 #錨點)。
var legacyTopicRedirects = map[string]string{
	"/topics/web":         "/courses/web",
	"/topics/launch":      "/courses/launch",
	"/topics/claude-code": "/courses/claude-code",
	"/topics/kids":        "/courses/kids",
}

// legacyTopicLessons:舊主題底下有單課頁的(Claude Code 的舊網址只有主題頁本身)。
var legacyTopicLessons = map[string]bool{
	"/topics/web":    true,
	"/topics/launch": true,
	"/topics/kids":   true,
}

// redirect 以 301 導向 to,保留查詢字串;to 可帶 #fragment(查詢字串會插在 fragment 之前)。
func redirect(w http.ResponseWriter, r *http.Request, to string) {
	frag := ""
	if i := strings.IndexByte(to, '#'); i >= 0 {
		to, frag = to[:i], to[i:]
	}
	if r.URL.RawQuery != "" {
		to += "?" + r.URL.RawQuery
	}
	to += frag
	http.Redirect(w, r, to, http.StatusMovedPermanently)
}

func setPageHeaders(w http.ResponseWriter, pg *page) {
	h := w.Header()
	h.Set("Content-Type", "text/html; charset=utf-8")
	// HTML 參照的 /assets/* 檔名每次 build 都會變,HTML 本身每次都要向 server 確認(ETag)。
	h.Set("Cache-Control", "no-cache")
	if pg.internal {
		h.Set("Cache-Control", "private, no-cache")
	}
	if pg.noindex {
		h.Set("X-Robots-Tag", "noindex, nofollow")
	}
}

func servePage(w http.ResponseWriter, r *http.Request, pg *page) {
	setPageHeaders(w, pg)
	if useGzip(w, r, pg.gz) {
		w.Header().Set("ETag", gzipETag(pg.etag))
		http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(pg.gz))
		return
	}
	w.Header().Set("ETag", pg.etag)
	http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(pg.body))
}

func serveNotFound(w http.ResponseWriter, r *http.Request, pg *page) {
	if pg == nil { // placeholder build 沒有 404.html
		http.NotFound(w, r)
		return
	}
	setPageHeaders(w, pg)
	body := pg.body
	if useGzip(w, r, pg.gz) {
		body = pg.gz
	}
	w.WriteHeader(http.StatusNotFound)
	if r.Method != http.MethodHead {
		w.Write(body)
	}
}

// dynamicPage 依資料庫處理頁面的課程連結(seo_ld.go),回傳這次要用的頁面(etag 依處理後的內容)。
// 查不到資料庫(或沒接資料庫)時所有課都不附連結。已開放的課沒變就沿用上一次處理好的頁面。
func dynamicPage(r *http.Request, pg *page, open openLessons) *page {
	var opened map[string]bool
	if open != nil {
		if got, err := open(r.Context()); err == nil {
			opened = got
		}
	}
	id := mapID(opened)
	pg.mu.Lock()
	defer pg.mu.Unlock()
	if pg.patched != nil && pg.patchID == id {
		return pg.patched
	}
	out := newPageWith(patchLessonLinks(pg.body, opened), pg.internal, gzipFast)
	out.dynamic = false
	pg.patched, pg.patchID = out, id
	return out
}
