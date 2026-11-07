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
