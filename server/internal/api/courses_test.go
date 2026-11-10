package api

import (
	"net/http"
	"strings"
	"testing"
)

// 課程地圖:公開、不用登入
func TestCourseMapAPI(t *testing.T) {
	h := newTestServer(t)
	rec := call(h, http.MethodGet, "/api/courses/kids/map", "", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"id":"0.1"`) {
		t.Fatalf("kids map: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/courses/nope/map", "", nil); rec.Code != http.StatusNotFound {
		t.Errorf("unknown: %d", rec.Code)
	}
}

// 登入功能沒開(沒有 Signer)時課程地圖照常回傳;沒接資料庫才回 503
func TestCourseMapWithoutAuth(t *testing.T) {
	st := openTestStore(t)
	rec := call(New(Config{Store: st}).Routes(), http.MethodGet, "/api/courses/kids/map", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("no signer: %d %s", rec.Code, rec.Body)
	}
	if rec := call(New(Config{}).Routes(), http.MethodGet, "/api/courses/kids/map", "", nil); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("no store: %d", rec.Code)
	}
}

// 草稿的課:訪客看到規劃中、沒有腳本;管理員(本機 -open-studio)看得到草稿與腳本;有草稿的課不快取
func TestCourseMapDrafts(t *testing.T) {
	st := openTestStore(t)
	if err := st.ReplaceUnitsJSON("software", `[{"id":"0","title":"序章","lessons":[{"id":"0.1","title":"一","status":"draft","script":"x/0.1.json"}]}]`); err != nil {
		t.Fatal(err)
	}
	guest := call(New(Config{Store: st}).Routes(), http.MethodGet, "/api/courses/software/map", "", nil)
	if guest.Code != http.StatusOK || strings.Contains(guest.Body.String(), `"draft"`) || strings.Contains(guest.Body.String(), "launch/1.1.json") {
		t.Fatalf("guest: %d %s", guest.Code, guest.Body)
	}
	if cc := guest.Header().Get("Cache-Control"); cc != "private, no-store" {
		t.Errorf("guest cache: %q", cc)
	}
	admin := call(New(Config{Store: st, OpenAdmin: true}).Routes(), http.MethodGet, "/api/courses/software/map", "", nil)
	if !strings.Contains(admin.Body.String(), `"status":"draft","script":"x/0.1.json"`) {
		t.Fatalf("admin: %s", admin.Body)
	}
	if cc := admin.Header().Get("Cache-Control"); cc != "private, no-store" {
		t.Errorf("admin cache: %q", cc)
	}
	// 沒有草稿的課照舊可以共用快取
	if cc := call(New(Config{Store: st}).Routes(), http.MethodGet, "/api/courses/web/map", "", nil).Header().Get("Cache-Control"); cc != "public, max-age=60" {
		t.Errorf("web cache: %q", cc)
	}
}
