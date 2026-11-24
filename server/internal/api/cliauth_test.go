package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
	if code, body := withBearer(http.MethodPatch, "/api/admin/courses/kids", `{"access":"subscription"}`); code != http.StatusOK || !strings.Contains(body, `"access":"subscription"`) {
		t.Errorf("改一門課: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodPatch, "/api/admin/courses/kids", `{"access":"inherit"}`); code != http.StatusBadRequest {
		t.Errorf("課程不認得的 access: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodPatch, "/api/admin/courses/nope", `{"access":"free"}`); code != http.StatusNotFound || !strings.Contains(body, "找不到這門課") {
		t.Errorf("沒有這門課: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodPatch, "/api/admin/courses/kids", `{"access":"login-free"}`); code != http.StatusOK || !strings.Contains(body, `"access":"login-free"`) {
		t.Errorf("改回來: %d %s", code, body)
	}
	// 課程資訊:簡介、說明段落、搜尋標題與描述、插圖;不合規則 400;清掉用空字串、空陣列
	info := `{"summary":"簡介","about":["第一段","第二段"],"seoTitle":"搜尋標題","description":"搜尋描述","art":"build"}`
	if code, body := withBearer(http.MethodPatch, "/api/admin/courses/kids", info); code != http.StatusOK ||
		!strings.Contains(body, `"summary":"簡介"`) || !strings.Contains(body, `"about":["第一段","第二段"]`) || !strings.Contains(body, `"seoTitle":"搜尋標題"`) ||
		!strings.Contains(body, `"description":"搜尋描述"`) || !strings.Contains(body, `"art":"build"`) {
		t.Errorf("改課程資訊: %d %s", code, body)
	}
	if rec := call(env.h, http.MethodGet, "/api/courses/kids/map", "", nil); !strings.Contains(rec.Body.String(), `"about":["第一段","第二段"]`) || !strings.Contains(rec.Body.String(), `"art":"build"`) {
		t.Errorf("公開的課程地圖要有課程資訊: %s", rec.Body)
	}
	if code, body := withBearer(http.MethodPatch, "/api/admin/courses/kids", `{"art":"pink"}`); code != http.StatusBadRequest {
		t.Errorf("不認得的 art: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodPatch, "/api/admin/courses/kids", `{"introScript":"lab/x.json"}`); code != http.StatusBadRequest {
		t.Errorf("不合規則的 introScript: %d %s", code, body)
	}
	code, body := withBearer(http.MethodPatch, "/api/admin/courses/kids", `{"summary":"","about":[],"seoTitle":"","description":"","art":"","introScript":""}`)
	var top map[string]any
	if json.Unmarshal([]byte(body), &top) != nil || code != http.StatusOK {
		t.Fatalf("清掉課程資訊: %d %s", code, body)
	}
	for _, k := range []string{"summary", "about", "seoTitle", "description", "art", "introScript"} {
		if _, ok := top[k]; ok {
			t.Errorf("清掉之後不該有 %s: %s", k, body)
		}
	}
	// 主題:管理員清單與更新(content 要是 JSON 物件,整包換掉);一般會員不能看管理清單
	if code, body := withBearer(http.MethodGet, "/api/admin/topics", ""); code != http.StatusOK || !strings.Contains(body, `"id":"kids"`) {
		t.Errorf("主題清單: %d %s", code, body)
	}
	if rec := call(env.h, http.MethodGet, "/api/admin/topics", "", amy); rec.Code != http.StatusForbidden {
		t.Errorf("一般會員不能看主題管理清單: %d", rec.Code)
	}
	if code, body := withBearer(http.MethodPatch, "/api/admin/topics/kids", `{"slogan":"新標語","content":{"learn":["a","b"]}}`); code != http.StatusOK || !strings.Contains(body, `"slogan":"新標語"`) || !strings.Contains(body, `"content":{"learn":["a","b"]}`) {
		t.Errorf("改主題: %d %s", code, body)
	}
	if rec := call(env.h, http.MethodGet, "/api/topics", "", nil); !strings.Contains(rec.Body.String(), `"slogan":"新標語"`) {
		t.Errorf("公開的主題清單要看到更新: %s", rec.Body)
	}
	for _, bad := range []string{`{"content":[1]}`, `{"content":"x"}`, `{"name":""}`, `{"path":"nope"}`, `{"path":"/a\\b"}`, `{"path":""}`} {
		if code, body := withBearer(http.MethodPatch, "/api/admin/topics/kids", bad); code != http.StatusBadRequest {
			t.Errorf("主題 %s 該被拒絕: %d %s", bad, code, body)
		}
	}
	// 請求超過 128KB:明確的「內容太大」,和 content 超過 64KB 的訊息不同
	huge := `{"content":{"x":"` + strings.Repeat("a", 129<<10) + `"}}`
	if code, body := withBearer(http.MethodPatch, "/api/admin/topics/kids", huge); code != http.StatusBadRequest || !strings.Contains(body, "內容太大") {
		t.Errorf("請求太大: %d %s", code, body)
	}
	mid := `{"content":{"x":"` + strings.Repeat("a", 70<<10) + `"}}`
	if code, body := withBearer(http.MethodPatch, "/api/admin/topics/kids", mid); code != http.StatusBadRequest || !strings.Contains(body, "content 超過 64KB") {
		t.Errorf("content 太大: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodPatch, "/api/admin/topics/nope", `{"name":"x"}`); code != http.StatusNotFound || !strings.Contains(body, "找不到這個主題") {
		t.Errorf("不存在的主題: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodPatch, "/api/admin/courses/kids", `{"topicId":"nope"}`); code != http.StatusBadRequest {
		t.Errorf("不存在的 topicId: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodPatch, "/api/admin/courses/kids", `{"overview":false}`); code != http.StatusOK || !strings.Contains(body, `"overview":false`) {
		t.Errorf("overview=false: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodPut, "/api/admin/scripts/kids/new.json?course=kids&lesson=0.1", `{"a":1}`); code != http.StatusOK {
		t.Errorf("上傳腳本: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodGet, "/api/admin/course-changes?limit=5", ""); code != http.StatusOK || !strings.Contains(body, "script.put") || !strings.Contains(body, "course.update") || !strings.Contains(body, "boss@example.com") {
		t.Errorf("修改紀錄: %d %s", code, body)
	}
	if code, body := withBearer(http.MethodGet, "/api/admin/schema-check", ""); code != http.StatusOK || !strings.Contains(body, `"ok":true`) {
		t.Errorf("資料庫結構檢查: %d %s", code, body)
	}
	if rec := call(env.h, http.MethodGet, "/api/admin/schema-check", "", amy); rec.Code != http.StatusForbidden {
		t.Errorf("一般會員不能看資料庫結構: %d", rec.Code)
	}
	// CLI 登入清單、撤銷:撤銷後同一個 token 立刻失效
	code, body = withBearer(http.MethodGet, "/api/admin/cli-tokens", "")
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
	if rec := call(env.h, http.MethodPatch, "/api/admin/courses/kids", `{"access":"free"}`, amy); rec.Code != http.StatusForbidden {
		t.Errorf("一般會員不能改課程: %d", rec.Code)
	}
}

// 部署設定的回呼白名單:清單內的 https 網址通過、其餘 400;核准後導回該網址(帶 id 與 code),logout 撤銷 token
func TestCliAuthStartAllowlist(t *testing.T) {
	const cb = "https://omixor.io/oauth/evoleap/callback"
	env := newAdminEnv(t, "boss@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	start := func(h http.Handler, uri string) *httptest.ResponseRecorder {
		return call(h, http.MethodPost, "/api/cli-auth/start", `{"redirect_uri":"`+uri+`","name":"omixor OAuth: app (read-only)"}`, nil)
	}
	if rec := start(env.h, cb); rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "只能是本機網址") {
		t.Errorf("清單為空要拒絕: %d %s", rec.Code, rec.Body)
	}
	h := New(Config{Store: env.st, Signer: env.signer, AdminEmails: "boss@example.com", CliAuthRedirectAllowlist: []string{cb}}).Routes()
	rec := start(h, cb)
	var s struct{ ID string }
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &s) != nil || s.ID == "" {
		t.Fatalf("清單內: %d %s", rec.Code, rec.Body)
	}
	if rec := start(h, "http://127.0.0.1:45871/callback"); rec.Code != http.StatusOK {
		t.Errorf("本機仍要通過: %d", rec.Code)
	}
	for _, bad := range []string{cb + "/", cb + "x", "https://evil.example/oauth/evoleap/callback", "http://omixor.io/oauth/evoleap/callback", "https://omixor.io@evil.example/oauth/evoleap/callback", cb + "#x"} {
		if rec := start(h, bad); rec.Code != http.StatusBadRequest {
			t.Errorf("%s 該被拒絕: %d", bad, rec.Code)
		}
	}
	if rec := call(h, http.MethodGet, "/api/cli-auth/"+s.ID, "", nil); !strings.Contains(rec.Body.String(), `"host":"omixor.io"`) || !strings.Contains(rec.Body.String(), "omixor OAuth: app (read-only)") {
		t.Errorf("核准頁要有名稱與主機: %s", rec.Body)
	}
	rec = call(h, http.MethodPost, "/api/cli-auth/"+s.ID+"/approve", "", boss)
	var ap struct{ Redirect string }
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &ap) != nil || !strings.HasPrefix(ap.Redirect, cb+"?") {
		t.Fatalf("核准: %d %s", rec.Code, rec.Body)
	}
	u, _ := url.Parse(ap.Redirect)
	// 另一筆(本機回呼)登記的 id 配上這個驗證碼換不到
	rec = start(h, "http://127.0.0.1:45871/callback")
	var other struct{ ID string }
	_ = json.Unmarshal(rec.Body.Bytes(), &other)
	call(h, http.MethodPost, "/api/cli-auth/"+other.ID+"/approve", "", boss)
	if rec := call(h, http.MethodPost, "/api/cli-auth/exchange", `{"id":"`+other.ID+`","code":"`+u.Query().Get("code")+`"}`, nil); rec.Code != http.StatusNotFound {
		t.Errorf("A 的驗證碼不能換 B: %d", rec.Code)
	}
	ex := `{"id":"` + s.ID + `","code":"` + u.Query().Get("code") + `"}`
	rec = call(h, http.MethodPost, "/api/cli-auth/exchange", ex, nil)
	var tok struct{ Token string }
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &tok) != nil || tok.Token == "" {
		t.Fatalf("exchange: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodPost, "/api/cli-auth/exchange", ex, nil); rec.Code != http.StatusNotFound {
		t.Errorf("重放要失敗: %d", rec.Code)
	}
	if rec := callHeader(h, http.MethodPost, "/api/cli-auth/logout", "", map[string]string{"Authorization": "Bearer " + tok.Token}); rec.Code != http.StatusOK {
		t.Errorf("logout: %d", rec.Code)
	}
	if rec := callHeader(h, http.MethodGet, "/api/admin/courses", "", map[string]string{"Authorization": "Bearer " + tok.Token}); rec.Code != http.StatusUnauthorized {
		t.Errorf("logout 後 token 要失效: %d", rec.Code)
	}
}
