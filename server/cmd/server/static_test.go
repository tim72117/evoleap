package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/tim72117/evoleap/internal/api"
	"github.com/tim72117/evoleap/internal/auth"
	"github.com/tim72117/evoleap/internal/store/storetest"
)

// 模擬 web/scripts/seo.mjs 產生的 dist 結構。
func testDist() fstest.MapFS {
	file := func(s string) *fstest.MapFile { return &fstest.MapFile{Data: []byte(s)} }
	return fstest.MapFS{
		"index.html":                          file(`<title>home</title>`),
		"courses/software/index.html":         file(`<title>software</title>`),
		"studio/index.html":                   file(`<title>studio</title><meta name="robots" content="noindex, nofollow" data-seo>`),
		"404.html":                            file(`<title>not found</title><meta name="robots" content="noindex, nofollow" data-seo>`),
		"assets/index-abc123.js":              file(`console.log(1)`),
		"assets/internal/StudioApp-abc123.js": file(`console.log("secret")`),
		"docs/live/index.html":                file(`<title>doc</title><meta name="robots" content="noindex, nofollow" data-seo>`),
		"robots.txt":                          file("User-agent: *\n"),
		"materials/cover.png":                 file("png"),
	}
}

func get(h http.Handler, method, target string, hdr map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, nil)
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestStaticHandler(t *testing.T) {
	h := newStaticHandler(testDist(), openAccess)
	cases := []struct {
		path     string
		status   int
		body     string // 回應內容需包含的字串
		location string
		cache    string
		noindex  bool
	}{
		{path: "/", status: 200, body: "<title>home</title>", cache: "no-cache"},
		{path: "/courses/software", status: 200, body: "<title>software</title>", cache: "no-cache"},
		{path: "/studio", status: 200, body: "<title>studio</title>", noindex: true},
		// 結尾斜線、實際檔名 → 導向頁面網址(不會出現 FileServer 的目錄斜線導向)
		{path: "/courses/software/", status: 301, location: "/courses/software"},
		{path: "/courses/software/?x=1", status: 301, location: "/courses/software?x=1"},
		{path: "/courses/software/index.html", status: 301, location: "/courses/software"},
		{path: "/index.html", status: 301, location: "/"},
		// 沒有對應頁面的路由:404 + 404.html
		{path: "/nope", status: 404, body: "<title>not found</title>", noindex: true},
		{path: "/courses", status: 404, body: "<title>not found</title>", noindex: true}, // 目錄存在但不是頁面
		// 三門課合併成 software 之前的舊網址:301 到新網址(單課網址 slug 不變,課程頁帶階段錨點)
		{path: "/courses/tools", status: 301, location: "/courses/software#stage-tools"},
		{path: "/courses/tools/", status: 301, location: "/courses/software#stage-tools"},
		{path: "/courses/tools?x=1", status: 301, location: "/courses/software?x=1#stage-tools"},
		{path: "/courses/ai-agent", status: 301, location: "/topics/ai-apps"},
		{path: "/courses/ai-agent/unit-0?x=1", status: 301, location: "/topics/ai-apps?x=1"},
		{path: "/courses/tools/intro", status: 301, location: "/courses/software/intro"},
		{path: "/courses/tools/3?x=1", status: 301, location: "/courses/software/3?x=1"},
		{path: "/courses/ai-tools", status: 301, location: "/courses/software#stage-ai-tools"},
		{path: "/courses/ai-tools/3-3", status: 301, location: "/courses/software/3-3"},
		{path: "/courses/vibe-coding", status: 301, location: "/courses/software#stage-vibe-coding-basics"},
		{path: "/courses/vibe-coding/5-2/", status: 301, location: "/courses/software/5-2"},
		// 網頁怎麼運作、從做好到上線、Claude Code 工作術搬到 /courses/<課程>:主題頁與單課頁 301(查詢字串保留、單課的課號段不變)
		{path: "/topics/web", status: 301, location: "/courses/web"},
		{path: "/topics/web/", status: 301, location: "/courses/web"},
		{path: "/topics/web?x=1", status: 301, location: "/courses/web?x=1"},
		{path: "/topics/web/1-2", status: 301, location: "/courses/web/1-2"},
		{path: "/topics/web/0-1?aspect=landscape", status: 301, location: "/courses/web/0-1?aspect=landscape"},
		{path: "/topics/launch", status: 301, location: "/courses/launch"},
		{path: "/topics/launch/2-3/", status: 301, location: "/courses/launch/2-3"},
		{path: "/topics/claude-code", status: 301, location: "/courses/claude-code"},
		{path: "/topics/claude-code?x=1", status: 301, location: "/courses/claude-code?x=1"},
		// 前綴相近的、Claude Code 底下沒有的舊單課網址不轉
		{path: "/topics/web-x", status: 404, body: "<title>not found</title>", noindex: true},
		{path: "/topics/claude-code/1", status: 404, body: "<title>not found</title>", noindex: true},
		// 不是舊課程的網址不轉(前綴相近的也不轉)
		{path: "/courses/tools-x", status: 404, body: "<title>not found</title>", noindex: true},
		{path: "/courses/software/99", status: 404, body: "<title>not found</title>", noindex: true},
		{path: "/assets", status: 404, body: "<title>not found</title>", noindex: true},
		// 靜態檔
		{path: "/assets/index-abc123.js", status: 200, cache: "public, max-age=31536000, immutable"},
		{path: "/robots.txt", status: 200, body: "User-agent", cache: "public, max-age=3600"},
		{path: "/materials/cover.png", status: 200},
		{path: "/assets/missing.js", status: 404, body: "404 page not found"},
		{path: "/materials/", status: 404, body: "<title>not found</title>", noindex: true},
	}
	for _, c := range cases {
		rec := get(h, http.MethodGet, c.path, nil)
		if rec.Code != c.status {
			t.Errorf("%s: status = %d, want %d", c.path, rec.Code, c.status)
		}
		if c.body != "" && !strings.Contains(rec.Body.String(), c.body) {
			t.Errorf("%s: body = %q, want it to contain %q", c.path, rec.Body.String(), c.body)
		}
		if got := rec.Header().Get("Location"); got != c.location {
			t.Errorf("%s: Location = %q, want %q", c.path, got, c.location)
		}
		if c.cache != "" && rec.Header().Get("Cache-Control") != c.cache {
			t.Errorf("%s: Cache-Control = %q, want %q", c.path, rec.Header().Get("Cache-Control"), c.cache)
		}
		if got := rec.Header().Get("X-Robots-Tag") != ""; got != c.noindex {
			t.Errorf("%s: X-Robots-Tag present = %v, want %v", c.path, got, c.noindex)
		}
	}
}

// 內部路徑:未登入導向登入頁,沒有權限回 404,管理員才拿得到內容。
func TestStaticHandlerInternalAccess(t *testing.T) {
	as := func(a api.Access) http.Handler {
		return newStaticHandler(testDist(), func(*http.Request) api.Access { return a })
	}
	const secret = `console.log("secret")`
	const chunk = "/assets/internal/StudioApp-abc123.js"

	guest := as(api.AccessGuest)
	for path, want := range map[string]string{
		"/studio":                  "/login?next=%2Fstudio",
		"/studio/":                 "/login?next=%2Fstudio%2F",
		"/docs/live":               "/login?next=%2Fdocs%2Flive",
		"/materials/promo?x=1&y=2": "/login?next=%2Fmaterials%2Fpromo%3Fx%3D1%26y%3D2",
		"/studio/no-such-page":     "/login?next=%2Fstudio%2Fno-such-page",
	} {
		rec := get(guest, http.MethodGet, path, nil)
		if rec.Code != http.StatusFound || rec.Header().Get("Location") != want {
			t.Errorf("guest %s: %d → %q, want 302 → %q", path, rec.Code, rec.Header().Get("Location"), want)
		}
		if strings.Contains(rec.Body.String(), "<title>studio") {
			t.Errorf("guest %s: 回應含有內部頁內容", path)
		}
	}

	for name, h := range map[string]http.Handler{"guest": guest, "denied": as(api.AccessDenied)} {
		for _, path := range []string{chunk, "/assets/./internal/StudioApp-abc123.js", "/assets/x/../internal/StudioApp-abc123.js", "/studio/index.html", "/materials/cover.png"} {
			rec := get(h, http.MethodGet, path, nil)
			if rec.Code != http.StatusNotFound || strings.Contains(rec.Body.String(), "secret") {
				t.Errorf("%s %s: status = %d, body = %q, want 404", name, path, rec.Code, rec.Body.String())
			}
		}
	}

	denied := as(api.AccessDenied)
	for _, path := range []string{"/studio", "/docs/live", "/studio/no-such-page"} {
		rec := get(denied, http.MethodGet, path, nil)
		if rec.Code != http.StatusNotFound || !strings.Contains(rec.Body.String(), "<title>not found</title>") {
			t.Errorf("denied %s: status = %d, body = %q, want 404 page", path, rec.Code, rec.Body.String())
		}
		if strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
			t.Errorf("denied %s: 拒絕的回應不能長期快取", path)
		}
	}

	// 公開頁與公開檔不受影響
	for _, h := range []http.Handler{guest, denied} {
		for _, path := range []string{"/", "/courses/software", "/assets/index-abc123.js", "/robots.txt"} {
			if rec := get(h, http.MethodGet, path, nil); rec.Code != http.StatusOK {
				t.Errorf("公開路徑 %s: status = %d, want 200", path, rec.Code)
			}
		}
	}

	allowed := as(api.AccessAllowed)
	page := get(allowed, http.MethodGet, "/studio", nil)
	if page.Code != http.StatusOK || page.Header().Get("Cache-Control") != "private, no-cache" {
		t.Errorf("admin /studio: status = %d, Cache-Control = %q", page.Code, page.Header().Get("Cache-Control"))
	}
	// 研發基地沒有預先產生 HTML 的網址(例如試做頁):管理員拿到研發基地首頁的 HTML,由前端路由處理
	for _, path := range []string{"/studio/full-course/17-2/ai", "/studio/no-such-page"} {
		if rec := get(allowed, http.MethodGet, path, nil); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "<title>studio</title>") {
			t.Errorf("admin %s: status = %d, body = %q, want 200 studio", path, rec.Code, rec.Body.String())
		}
	}
	// 其他內部路徑沒有頁面仍是 404
	if rec := get(allowed, http.MethodGet, "/docs/nope", nil); rec.Code != http.StatusNotFound {
		t.Errorf("admin /docs/nope: status = %d, want 404", rec.Code)
	}
	js := get(allowed, http.MethodGet, chunk, nil)
	if js.Code != http.StatusOK || js.Body.String() != secret || !strings.HasPrefix(js.Header().Get("Cache-Control"), "private,") {
		t.Errorf("admin chunk: status = %d, Cache-Control = %q", js.Code, js.Header().Get("Cache-Control"))
	}
}

func TestStaticHandlerETag(t *testing.T) {
	h := newStaticHandler(testDist(), openAccess)
	first := get(h, http.MethodGet, "/courses/software", nil)
	etag := first.Header().Get("ETag")
	if etag == "" {
		t.Fatal("page response has no ETag")
	}
	again := get(h, http.MethodGet, "/courses/software", map[string]string{"If-None-Match": etag})
	if again.Code != http.StatusNotModified {
		t.Errorf("conditional GET: status = %d, want 304", again.Code)
	}
	if other := get(h, http.MethodGet, "/", nil).Header().Get("ETag"); other == etag {
		t.Error("different pages share the same ETag")
	}
}

func TestStaticHandlerHead(t *testing.T) {
	rec := get(newStaticHandler(testDist(), openAccess), http.MethodHead, "/nope", nil)
	if rec.Code != http.StatusNotFound || rec.Body.Len() != 0 {
		t.Errorf("HEAD /nope: status = %d, body length = %d, want 404 and empty", rec.Code, rec.Body.Len())
	}
}

// 版控裡的 placeholder(只有 index.html、沒有 404.html)也要能啟動。
func TestEmbeddedPlaceholder(t *testing.T) {
	h := newStaticHandler(distFS(""), openAccess)
	if rec := get(h, http.MethodGet, "/", nil); rec.Code != http.StatusOK {
		t.Errorf("/: status = %d, want 200", rec.Code)
	}
	if rec := get(h, http.MethodGet, "/nope", nil); rec.Code != http.StatusNotFound {
		t.Errorf("/nope: status = %d, want 404", rec.Code)
	}
}

// 串起真實的登入 cookie、白名單判定與靜態檔處理器(和 main.go 的接法相同)。
func TestInternalPagesWithRealSessions(t *testing.T) {
	st, err := storetest.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	signer := auth.NewSigner("test-secret", time.Hour)
	srv := api.New(api.Config{Store: st, Signer: signer, AdminEmails: "boss@example.com"})
	h := newStaticHandler(testDist(), srv.InternalAccess)

	cookieFor := func(email string) map[string]string {
		u, err := st.UpsertGoogleUser(context.Background(), "sub-"+email, email, true, "Name")
		if err != nil {
			t.Fatal(err)
		}
		token, err := signer.Sign(u.ID)
		if err != nil {
			t.Fatal(err)
		}
		return map[string]string{"Cookie": "evoleap_session=" + token}
	}

	const chunk = "/assets/internal/StudioApp-abc123.js"
	cases := []struct {
		name         string
		hdr          map[string]string
		page, script int
	}{
		{"guest", nil, http.StatusFound, http.StatusNotFound},
		{"member", cookieFor("member@example.com"), http.StatusNotFound, http.StatusNotFound},
		{"admin", cookieFor("boss@example.com"), http.StatusOK, http.StatusOK},
	}
	for _, c := range cases {
		if got := get(h, http.MethodGet, "/studio", c.hdr).Code; got != c.page {
			t.Errorf("%s /studio: status = %d, want %d", c.name, got, c.page)
		}
		if got := get(h, http.MethodGet, chunk, c.hdr).Code; got != c.script {
			t.Errorf("%s chunk: status = %d, want %d", c.name, got, c.script)
		}
	}
}
