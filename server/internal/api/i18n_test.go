package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// 譯文管理 API 只有管理員:沒登入 401、一般會員 403;管理員寫入、列出、讀、missing 都通;寫入後公開的 ?lang=en 立刻換成新譯文(發布時),草稿不會。
func TestAdminI18nAPI(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	amy := registerCookie(t, env.h, "amy@example.com")
	set := `{"kind":"course","ref":"software","path":"title","lang":"en","value":"Edited by API","status":"published","reason":"測試"}`

	for _, c := range []struct{ method, path, body string }{
		{http.MethodGet, "/api/admin/i18n?lang=en", ""},
		{http.MethodGet, "/api/admin/i18n/item?kind=course&ref=software&path=title&lang=en", ""},
		{http.MethodGet, "/api/admin/i18n/missing?lang=en", ""},
		{http.MethodPut, "/api/admin/i18n", set},
	} {
		if rec := call(env.h, c.method, c.path, c.body, nil); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s 沒登入 = %d", c.method, c.path, rec.Code)
		}
		if rec := call(env.h, c.method, c.path, c.body, amy); rec.Code != http.StatusForbidden {
			t.Errorf("%s %s 一般會員 = %d", c.method, c.path, rec.Code)
		}
	}

	titleOf := func() string {
		rec := call(env.h, http.MethodGet, "/api/courses/software/map?lang=en", "", nil)
		var m struct{ Title string }
		if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &m) != nil {
			t.Fatalf("map: %d %s", rec.Code, rec.Body)
		}
		return m.Title
	}
	if got := titleOf(); got != "Test Course One" {
		t.Fatalf("title = %q", got)
	}
	if rec := call(env.h, http.MethodPut, "/api/admin/i18n", strings.Replace(set, `"published"`, `"draft"`, 1), boss); rec.Code != http.StatusOK {
		t.Fatalf("set draft: %d %s", rec.Code, rec.Body)
	}
	if got := titleOf(); got == "Edited by API" {
		t.Error("草稿不該顯示")
	}
	if rec := call(env.h, http.MethodPut, "/api/admin/i18n", set, boss); rec.Code != http.StatusOK {
		t.Fatalf("set: %d %s", rec.Code, rec.Body)
	}
	if got := titleOf(); got != "Edited by API" {
		t.Errorf("發布後 title = %q", got)
	}
	rec := call(env.h, http.MethodGet, "/api/admin/i18n/item?kind=course&ref=software&path=title&lang=en", "", boss)
	var item struct {
		Item    struct{ Value, Status, Origin, UpdatedBy string }
		History []struct{ NewValue, Reason string }
	}
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &item) != nil || item.Item.Value != "Edited by API" || item.Item.Origin != "human" || item.Item.UpdatedBy != "boss@example.com" || len(item.History) != 3 || item.History[0].Reason != "測試" {
		t.Errorf("item: %d %s", rec.Code, rec.Body)
	}
	if rec := call(env.h, http.MethodGet, "/api/admin/i18n?lang=en&kind=course&status=published", "", boss); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Edited by API") {
		t.Errorf("list: %d", rec.Code)
	}
	if rec := call(env.h, http.MethodGet, "/api/admin/i18n?status=bogus", "", boss); rec.Code != http.StatusBadRequest {
		t.Errorf("壞 status = %d", rec.Code)
	}
	if rec := call(env.h, http.MethodGet, "/api/admin/i18n/item?kind=course&ref=nope&path=title&lang=en", "", boss); rec.Code != http.StatusNotFound {
		t.Errorf("找不到 = %d", rec.Code)
	}
	if rec := call(env.h, http.MethodGet, "/api/admin/i18n/missing?lang=en&kind=course", "", boss); rec.Code != http.StatusOK || strings.Contains(rec.Body.String(), `"stale"`) {
		t.Errorf("missing: %d %s", rec.Code, rec.Body)
	}
	if rec := call(env.h, http.MethodPut, "/api/admin/i18n", `{"kind":"course","ref":"nope","path":"title","lang":"en","value":"x"}`, boss); rec.Code != http.StatusBadRequest {
		t.Errorf("沒登記的欄位 = %d", rec.Code)
	}
}
