package api

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

// evoleap CLI 的整個流程:登記 → 管理員核准(一般會員不行)→ 換 token → 用 Bearer 呼叫管理員的課程 API
func TestCliLoginAndCourseAdmin(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	amy := registerCookie(t, env.h, "amy@example.com")

	rec := call(env.h, http.MethodPost, "/api/cli-auth/start", `{"redirect_uri":"http://127.0.0.1:5555/callback"}`, nil)
	var start struct{ ID string }
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &start) != nil || start.ID == "" {
		t.Fatalf("start: %d %s", rec.Code, rec.Body)
	}
	if rec := call(env.h, http.MethodPost, "/api/cli-auth/start", `{"redirect_uri":"https://evil.example.com/"}`, nil); rec.Code != http.StatusBadRequest {
		t.Errorf("非本機網址: %d", rec.Code)
	}
	if rec := call(env.h, http.MethodGet, "/api/cli-auth/"+start.ID, "", nil); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "evoleap CLI") {
		t.Errorf("核准頁讀名稱: %d %s", rec.Code, rec.Body)
	}
	if rec := call(env.h, http.MethodPost, "/api/cli-auth/"+start.ID+"/approve", "", amy); rec.Code != http.StatusForbidden {
		t.Errorf("一般會員不能核准: %d", rec.Code)
	}
	rec = call(env.h, http.MethodPost, "/api/cli-auth/"+start.ID+"/approve", "", boss)
	var approved struct{ Redirect string }
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &approved) != nil || !strings.HasPrefix(approved.Redirect, "http://127.0.0.1:5555/callback?") {
		t.Fatalf("核准: %d %s", rec.Code, rec.Body)
	}
	u, _ := url.Parse(approved.Redirect)
	if u.Query().Get("id") != start.ID || u.Query().Get("code") == "" {
		t.Fatalf("導回 CLI 的網址要帶 id 與驗證碼: %s", approved.Redirect)
	}
	// 只有 id(發起登入的人知道的)換不到
	if rec := call(env.h, http.MethodPost, "/api/cli-auth/exchange", `{"id":"`+start.ID+`","code":"`+start.ID+`"}`, nil); rec.Code != http.StatusNotFound {
		t.Errorf("沒有驗證碼不能換: %d", rec.Code)
	}
	exchange := `{"id":"` + start.ID + `","code":"` + u.Query().Get("code") + `"}`
	rec = call(env.h, http.MethodPost, "/api/cli-auth/exchange", exchange, nil)
	var ex struct{ Token string }
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &ex) != nil || ex.Token == "" {
		t.Fatalf("exchange: %d %s", rec.Code, rec.Body)
	}
	if rec := call(env.h, http.MethodPost, "/api/cli-auth/exchange", exchange, nil); rec.Code != http.StatusNotFound {
		t.Errorf("只能換一次: %d", rec.Code)
	}

	withBearer := func(method, path, body string) (int, string) {
		rec := callHeader(env.h, method, path, body, map[string]string{"Authorization": "Bearer " + ex.Token})
		return rec.Code, rec.Body.String()
	}
	// 會員空間改帳號資料只認網站登入的 cookie,CLI token 不行
	if code, body := withBearer(http.MethodPatch, "/api/me", `{"name":"CLI 改的"}`); code != http.StatusUnauthorized {
		t.Errorf("CLI token 改帳號資料應該被拒: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodGet, "/api/me", ""); !strings.Contains(body, `"email":"boss@example.com"`) || strings.Contains(body, "CLI 改的") {
		t.Errorf("CLI token 改到了名稱: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodGet, "/api/admin/courses", ""); code != http.StatusOK || !strings.Contains(body, `"id":"kids"`) {
		t.Errorf("課程清單: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodPatch, "/api/admin/courses/kids/lessons/0.1", `{"minutes":7}`); code != http.StatusOK || !strings.Contains(body, `"minutes":7`) {
		t.Errorf("改一課: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodPatch, "/api/admin/courses/kids/lessons/0.1", `{"status":"hidden"}`); code != http.StatusBadRequest {
		t.Errorf("不合規則: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodPut, "/api/admin/scripts/kids/new.json?course=kids&lesson=0.1", `{"a":1}`); code != http.StatusOK {
		t.Errorf("上傳腳本: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodGet, "/api/admin/course-changes?limit=5", ""); code != http.StatusOK || !strings.Contains(body, "script.put") || !strings.Contains(body, "boss@example.com") {
		t.Errorf("修改紀錄: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodGet, "/api/admin/schema-check", ""); code != http.StatusOK || !strings.Contains(body, `"ok":true`) {
		t.Errorf("資料庫結構檢查: %d %s", code, body)
	}
	if rec := call(env.h, http.MethodGet, "/api/admin/schema-check", "", amy); rec.Code != http.StatusForbidden {
		t.Errorf("一般會員不能看資料庫結構: %d", rec.Code)
	}
	// CLI 登入清單、撤銷:撤銷後同一個 token 立刻失效
	code, body := withBearer(http.MethodGet, "/api/admin/cli-tokens", "")
	var list struct{ Tokens []struct{ ID, User string } }
	if code != http.StatusOK || json.Unmarshal([]byte(body), &list) != nil || len(list.Tokens) != 1 || list.Tokens[0].User != "boss@example.com" {
		t.Fatalf("CLI 登入清單: %d %s", code, body)
	}
	if code, _ := withBearer(http.MethodPost, "/api/cli-auth/logout", ""); code != http.StatusOK {
		t.Errorf("logout: %d", code)
	}
	if code, _ := withBearer(http.MethodGet, "/api/admin/courses", ""); code != http.StatusUnauthorized {
		t.Errorf("logout 後 token 要失效: %d", code)
	}
	// 網站登入的 JWT 不能拿來當 Bearer(Bearer 只接受可撤銷的 CLI token)
	if rec := callHeader(env.h, http.MethodGet, "/api/admin/courses", "", map[string]string{"Authorization": "Bearer " + boss.Value}); rec.Code != http.StatusUnauthorized {
		t.Errorf("JWT 當 Bearer: %d", rec.Code)
	}
	if rec := call(env.h, http.MethodDelete, "/api/admin/cli-tokens/nope", "", boss); rec.Code != http.StatusNotFound {
		t.Errorf("撤銷不存在的: %d", rec.Code)
	}
	// Bearer 換成一般會員的 cookie:不能改
	if rec := call(env.h, http.MethodPatch, "/api/admin/courses/kids/lessons/0.1", `{"minutes":1}`, amy); rec.Code != http.StatusForbidden {
		t.Errorf("一般會員不能改: %d", rec.Code)
	}
}
