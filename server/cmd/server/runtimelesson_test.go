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
	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/evoleap/internal/store/storetest"
)

// 執行中用管理 API 新增的課(evoleap lesson add 走的端點):同一份 build 就有單課頁,開放後進 sitemap,刪掉回 404。
func TestLessonAddedAtRuntime(t *testing.T) {
	st, err := storetest.Open(filepath.Join(t.TempDir(), "runtime.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	admin := api.New(api.Config{Store: st, Signer: auth.NewSigner("test-secret", time.Hour), OpenAdmin: true}).Routes()
	call := func(method, path, body string) {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		admin.ServeHTTP(rec, req)
		if rec.Code != 200 {
			t.Fatalf("%s %s: %d %s", method, path, rec.Code, rec.Body)
		}
	}

	dist := courseDist()
	dist["sitemap-pages.json"] = &fstest.MapFile{Data: []byte(`[{"loc":"https://evoleap.io/courses/web","lessonsOf":{"course":"web"}},{"loc":"https://evoleap.io/courses/software","lessonsOf":{"course":"software","staged":true}}]`)}
	c := newCourseSEO(dist, func(ctx context.Context, id string) (store.CourseMap, error) { return st.CourseMapOf(ctx, id, false) })
	now := time.Now()
	c.now = func() time.Time { return now }
	pages := newStaticHandlerWithCourses(dist, openAccess, c)
	sitemap := sitemapHandler(dist, st.OpenLessonKeys)

	check := func(status int, inSitemap bool) {
		t.Helper()
		now = now.Add(courseSEOTTL) // 課程快取過期
		rec := get(pages, http.MethodGet, "/courses/web/9-9", nil)
		if rec.Code != status {
			t.Errorf("頁面: %d,要 %d: %s", rec.Code, status, rec.Body)
		}
		if status == 200 && !strings.Contains(rec.Body.String(), "新的一課") {
			t.Errorf("標題要用資料庫的課名: %s", rec.Body)
		}
		xml := get(sitemap, http.MethodGet, "/sitemap.xml", nil).Body.String()
		if strings.Contains(xml, "<loc>https://evoleap.io/courses/web/9-9</loc>") != inSitemap {
			t.Errorf("sitemap 應該收錄=%v:\n%s", inSitemap, xml)
		}
	}

	m, err := st.CourseMapOf(context.Background(), "web", false)
	if err != nil {
		t.Fatal(err)
	}
	unit := ""
	for _, u := range m.Units {
		if !u.Hidden {
			unit = u.ID
			break
		}
	}
	check(404, false)
	call(http.MethodPost, "/api/admin/courses/web/lessons", `{"id":"9.9","unitId":"`+unit+`","title":"新的一課"}`)
	check(200, false) // 規劃中:有頁面,不收錄進 sitemap
	call(http.MethodPatch, "/api/admin/courses/web/lessons/9.9", `{"status":"open"}`)
	check(200, false) // 開放但還沒有腳本:頁面只顯示「還沒開放」,不收錄
	call(http.MethodPut, "/api/admin/scripts/web/9.9.json?course=web&lesson=9.9", `{}`)
	call(http.MethodPatch, "/api/admin/courses/web/lessons/9.9", `{"script":"web/9.9.json"}`)
	check(200, true)
	call(http.MethodPatch, "/api/admin/courses/web/lessons/9.9", `{"status":"draft"}`) // 開放中的課不能直接刪
	check(200, false)
	call(http.MethodDelete, "/api/admin/courses/web/lessons/9.9", "")
	check(404, false)
}

// 軟體課的網址規則:起步階段 0.N 去掉前綴,和前端的 lessonUrl 一致
func TestLessonSlug(t *testing.T) {
	for _, c := range []struct {
		staged   bool
		id, want string
	}{{true, "0.intro", "intro"}, {true, "0.1", "1"}, {true, "1.0", "1-0"}, {false, "0.1", "0-1"}, {false, "3", "3"}, {false, "a.b-c", "a-b-c"}} {
		if got := store.LessonSlug(c.staged, c.id); got != c.want {
			t.Errorf("store.LessonSlug(%v, %q) = %q,要 %q", c.staged, c.id, got, c.want)
		}
	}
}
