package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

// 模擬 web/scripts/seo.mjs 產生的 dist 結構。
func testDist() fstest.MapFS {
	file := func(s string) *fstest.MapFile { return &fstest.MapFile{Data: []byte(s)} }
	return fstest.MapFS{
		"index.html":               file(`<title>home</title>`),
		"courses/tools/index.html": file(`<title>tools</title>`),
		"proposal/index.html":      file(`<title>proposal</title><meta name="robots" content="noindex, nofollow" data-seo>`),
		"404.html":                 file(`<title>not found</title><meta name="robots" content="noindex, nofollow" data-seo>`),
		"assets/index-abc123.js":   file(`console.log(1)`),
		"robots.txt":               file("User-agent: *\n"),
		"materials/cover.png":      file("png"),
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
	h := newStaticHandler(testDist())
	cases := []struct {
		path     string
		status   int
		body     string // 回應內容需包含的字串
		location string
		cache    string
		noindex  bool
	}{
		{path: "/", status: 200, body: "<title>home</title>", cache: "no-cache"},
		{path: "/courses/tools", status: 200, body: "<title>tools</title>", cache: "no-cache"},
		{path: "/proposal", status: 200, body: "<title>proposal</title>", noindex: true},
		// 結尾斜線、實際檔名 → 導向頁面網址(不會出現 FileServer 的目錄斜線導向)
		{path: "/courses/tools/", status: 301, location: "/courses/tools"},
		{path: "/courses/tools/?x=1", status: 301, location: "/courses/tools?x=1"},
		{path: "/courses/tools/index.html", status: 301, location: "/courses/tools"},
		{path: "/index.html", status: 301, location: "/"},
		// 沒有對應頁面的路由:404 + 404.html
		{path: "/nope", status: 404, body: "<title>not found</title>", noindex: true},
		{path: "/courses", status: 404, body: "<title>not found</title>", noindex: true}, // 目錄存在但不是頁面
		{path: "/courses/tools/99", status: 404, body: "<title>not found</title>", noindex: true},
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

func TestStaticHandlerETag(t *testing.T) {
	h := newStaticHandler(testDist())
	first := get(h, http.MethodGet, "/courses/tools", nil)
	etag := first.Header().Get("ETag")
	if etag == "" {
		t.Fatal("page response has no ETag")
	}
	again := get(h, http.MethodGet, "/courses/tools", map[string]string{"If-None-Match": etag})
	if again.Code != http.StatusNotModified {
		t.Errorf("conditional GET: status = %d, want 304", again.Code)
	}
	if other := get(h, http.MethodGet, "/", nil).Header().Get("ETag"); other == etag {
		t.Error("different pages share the same ETag")
	}
}

func TestStaticHandlerHead(t *testing.T) {
	rec := get(newStaticHandler(testDist()), http.MethodHead, "/nope", nil)
	if rec.Code != http.StatusNotFound || rec.Body.Len() != 0 {
		t.Errorf("HEAD /nope: status = %d, body length = %d, want 404 and empty", rec.Code, rec.Body.Len())
	}
}

// 版控裡的 placeholder(只有 index.html、沒有 404.html)也要能啟動。
func TestEmbeddedPlaceholder(t *testing.T) {
	h := staticHandler("")
	if rec := get(h, http.MethodGet, "/", nil); rec.Code != http.StatusOK {
		t.Errorf("/: status = %d, want 200", rec.Code)
	}
	if rec := get(h, http.MethodGet, "/nope", nil); rec.Code != http.StatusNotFound {
		t.Errorf("/nope: status = %d, want 404", rec.Code)
	}
}
