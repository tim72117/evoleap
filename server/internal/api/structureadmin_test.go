package api

import (
	"net/http"
	"testing"
)

// 課程結構 API:只給管理員;新增、改單元、排大綱、刪除走得通,不認得的欄位擋下
func TestCourseStructureAPI(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	amy := registerCookie(t, env.h, "amy@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	course := `{"id":"demo","title":"示範","access":"free"}`
	if rec := call(env.h, http.MethodPost, "/api/admin/courses", course, amy); rec.Code != http.StatusForbidden {
		t.Errorf("會員: %d", rec.Code)
	}
	for _, c := range []struct{ method, path, body string }{
		{"POST", "/api/admin/courses", course},
		{"POST", "/api/admin/courses/demo/units", `{"id":"a","title":"甲"}`},
		{"PATCH", "/api/admin/courses/demo/units/a", `{"title":"甲改"}`},
		{"POST", "/api/admin/courses/demo/lessons", `{"id":"1.1","unitId":"a","title":"一"}`},
		{"PUT", "/api/admin/courses/demo/outline", `{"units":[{"id":"a","lessons":["1.1"]}]}`},
		{"DELETE", "/api/admin/courses/demo/lessons/1.1", ""},
		{"DELETE", "/api/admin/courses/demo/units/a", ""},
		{"DELETE", "/api/admin/courses/demo", ""},
	} {
		if rec := call(env.h, c.method, c.path, c.body, boss); rec.Code != http.StatusOK {
			t.Errorf("%s %s: %d %s", c.method, c.path, rec.Code, rec.Body)
		}
	}
	if rec := call(env.h, http.MethodPost, "/api/admin/courses", `{"id":"x","title":"x","access":"free","oops":1}`, boss); rec.Code != http.StatusBadRequest {
		t.Errorf("不認得的欄位: %d", rec.Code)
	}
}
