package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/tim72117/evoleap/internal/store"
)

// sitemap 依資料庫:課頁收不收,看資料庫裡那一課的狀態是不是 open;不寫死任何課號。
func TestSitemapFollowsDatabase(t *testing.T) {
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	ctx := context.Background()
	opened, err := st.OpenLessonKeys(ctx)
	if err != nil {
		t.Fatal(err)
	}
	// 從資料庫找一課開放的、一課沒開放的(種子建出來的資料)
	var open, closed string
	for _, id := range []string{"kids/0.1", "kids/3.1", "launch/0.1", "launch/1.3", "web/1.3"} {
		if opened[id] && open == "" {
			open = id
		}
		if !opened[id] && closed == "" {
			closed = id
		}
	}
	if open == "" || closed == "" {
		t.Fatalf("資料裡要有開放與沒開放的課: %v", opened)
	}
	page := func(key string) string {
		c, l, _ := strings.Cut(key, "/")
		return `{"loc":"https://evoleap.io/p/` + key + `","lesson":{"course":"` + c + `","id":"` + l + `"}}`
	}
	dist := fstest.MapFS{"sitemap-pages.json": {Data: []byte(`[{"loc":"https://evoleap.io/","priority":1},{"loc":"https://evoleap.io/a&b"},` + page(open) + `,` + page(closed) + `]`)}}

	h := sitemapHandler(dist, st.OpenLessonKeys)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/sitemap.xml", nil))
	body := rec.Body.String()
	if rec.Code != 200 || !strings.Contains(rec.Header().Get("Content-Type"), "application/xml") {
		t.Fatalf("%d %q", rec.Code, rec.Header().Get("Content-Type"))
	}
	for want, ok := range map[string]bool{
		"<loc>https://evoleap.io/</loc><priority>1.0</priority>": true,
		"<loc>https://evoleap.io/a&amp;b</loc>":                  true, // 跳脫
		"/p/" + open + "<":                                       true,
		"/p/" + closed + "<":                                     false,
	} {
		if strings.Contains(body, want) != ok {
			t.Errorf("%q 應該%v在 sitemap:\n%s", want, map[bool]string{true: "", false: "不"}[ok], body)
		}
	}

	// 沒接資料庫:沒有種子備援,只列非課頁
	rec = httptest.NewRecorder()
	sitemapHandler(dist, nil).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/sitemap.xml", nil))
	if strings.Contains(rec.Body.String(), "/p/") || !strings.Contains(rec.Body.String(), "https://evoleap.io/</loc>") {
		t.Errorf("沒接資料庫:\n%s", rec.Body)
	}
	// 沒有頁面清單時不註冊
	if sitemapHandler(fstest.MapFS{}, nil) != nil {
		t.Error("沒有 sitemap-pages.json 應該回 nil")
	}
}

// 頁面清單檔本身不對外提供;資料庫查不到又沒有快取時 sitemap 回 503
func TestSitemapUnavailableAndHiddenPagesFile(t *testing.T) {
	dist := fstest.MapFS{
		"index.html":         {Data: []byte("<title>home</title>")},
		"sitemap-pages.json": {Data: []byte(`[{"loc":"https://evoleap.io/"}]`)},
	}
	bad := sitemapHandler(dist, func(context.Context) (map[string]bool, error) { return nil, context.DeadlineExceeded })
	rec := httptest.NewRecorder()
	bad.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/sitemap.xml", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("查不到資料庫: %d", rec.Code)
	}

	static := newStaticHandler(dist, openAccess)
	rec = httptest.NewRecorder()
	static.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/sitemap-pages.json", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("頁面清單檔不該公開: %d", rec.Code)
	}
}
