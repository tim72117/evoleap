package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/tim72117/evoleap/internal/auth"
	"github.com/tim72117/evoleap/internal/plans"
	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/subscription"
	"github.com/tim72117/subscription/gormstore"
)

// newPlanTestServer 建一台有方案服務的伺服器,並把一堂 basic(software 4.1)與一堂 advanced 的訂閱課開放、放上腳本檔。
func newPlanTestServer(t *testing.T) (http.Handler, *store.Store, *subscription.Service) {
	t.Helper()
	st := openTestStore(t)
	svc, err := gormstore.NewService(st.DB(), plans.Catalog, subscription.Options{})
	if err != nil {
		t.Fatal(err)
	}
	db := st.DB()
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{"UPDATE lessons SET status = 'open' WHERE course_id = 'software' AND id = '4.1'", nil},
		{"INSERT INTO lesson_files (path, course_id, lesson_id, content) VALUES (?, ?, ?, ?)", []any{"vibe/4.1.json", "software", "4.1", `{"steps":[]}`}},
		// ai-agent 沒有單元與課,臨時加一堂 advanced 的課
		{"INSERT INTO lessons (course_id, id, unit_id, title, position, status) VALUES ('ai-agent', 'x.1', 'x', '進階', 1, 'open')", nil},
		{"INSERT INTO lesson_files (path, course_id, lesson_id, content) VALUES ('agent/x.1.json', 'ai-agent', 'x.1', '{}')", nil},
	} {
		if err := db.Exec(q.sql, q.args...).Error; err != nil {
			t.Fatalf("%s: %v", q.sql, err)
		}
	}
	h := New(Config{Store: st, Signer: auth.NewSigner("test-secret", time.Hour), Plans: svc}).Routes()
	return h, st, svc
}

// newRequestWith 建一個帶多個 cookie 的請求(call 只能帶一個)。
func newRequestWith(method, path string, cookies ...*http.Cookie) *http.Request {
	req := httptest.NewRequest(method, path, nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	return req
}

// serve 在 kids_test.go。

func decodeJSON[T any](t *testing.T, body string) T {
	t.Helper()
	var v T
	if err := json.Unmarshal([]byte(body), &v); err != nil {
		t.Fatalf("decode %q: %v", body, err)
	}
	return v
}

func TestCourseAccessAndAdsPlan(t *testing.T) {
	h, _, _ := newPlanTestServer(t)
	access := func(c *http.Cookie, path string) courseAccessResponse {
		t.Helper()
		rec := call(h, http.MethodGet, path, "", c)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: %d %s", path, rec.Code, rec.Body)
		}
		return decodeJSON[courseAccessResponse](t, rec.Body.String())
	}

	if a := access(nil, "/api/courses/software/access?lesson=4.1"); a.Allowed || a.Reason != "login_required" || a.Access != store.AccessSubscription {
		t.Errorf("guest: %+v", a)
	}
	if rec := call(h, http.MethodGet, "/api/courses/nope/access", "", nil); rec.Code != http.StatusNotFound {
		t.Errorf("unknown course: %d", rec.Code)
	}
	if rec := call(h, http.MethodGet, "/api/courses/software/access?lesson=99.9", "", nil); rec.Code != http.StatusNotFound {
		t.Errorf("unknown lesson: %d", rec.Code)
	}

	amy := registerCookie(t, h, "amy@example.com")
	if a := access(amy, "/api/courses/software/access?lesson=4.1"); a.Allowed || a.Reason != "plan_required" {
		t.Errorf("no plan: %+v", a)
	}
	if a := access(amy, "/api/courses/web/access?lesson=0.2"); !a.Allowed || a.Ad {
		t.Errorf("login-free course: %+v", a)
	}
	if rec := call(h, http.MethodGet, "/api/plan/me", "", amy); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"plan":"free"`) {
		t.Errorf("plan me before: %d %s", rec.Code, rec.Body)
	}

	// 選廣告方案(重複選也只有一筆)
	for range 2 {
		rec := call(h, http.MethodPost, "/api/plan/ads", "", amy)
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"plan":"ads"`) || !strings.Contains(rec.Body.String(), `"tier":"basic"`) {
			t.Fatalf("choose ads: %d %s", rec.Code, rec.Body)
		}
	}
	if a := access(amy, "/api/courses/software/access?lesson=4.1"); !a.Allowed || !a.Ad {
		t.Errorf("ads plan, no pass yet: %+v", a)
	}
	// 廣告方案不涵蓋 advanced
	if a := access(amy, "/api/courses/ai-agent/access?lesson=x.1"); a.Allowed || a.Reason != "plan_required" {
		t.Errorf("ads plan on advanced: %+v", a)
	}
}

func TestPrerollAdPass(t *testing.T) {
	h, _, _ := newPlanTestServer(t)
	clock := time.Date(2026, 11, 10, 9, 0, 0, 0, time.UTC)
	adNow = func() time.Time { return clock }
	t.Cleanup(func() { adNow = time.Now })

	amy := registerCookie(t, h, "amy@example.com")
	bob := registerCookie(t, h, "bob@example.com")
	start := `{"course":"software","lesson":"4.1"}`

	// 還沒選方案:不能開始;腳本也拿不到
	if rec := call(h, http.MethodPost, "/api/plan/ads/start", start, amy); rec.Code != http.StatusForbidden {
		t.Errorf("start without plan: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/scripts/vibe/4.1.json", "", amy); rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "plan_required") {
		t.Errorf("script without plan: %d %s", rec.Code, rec.Body)
	}

	call(h, http.MethodPost, "/api/plan/ads", "", amy)
	if rec := call(h, http.MethodGet, "/api/scripts/vibe/4.1.json", "", amy); rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "ad_required") {
		t.Errorf("script before ad: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodPost, "/api/plan/ads/start", `{"course":"ai-agent","lesson":"x.1"}`, amy); rec.Code != http.StatusForbidden {
		t.Errorf("start on advanced: %d %s", rec.Code, rec.Body)
	}

	rec := call(h, http.MethodPost, "/api/plan/ads/start", start, amy)
	if rec.Code != http.StatusOK {
		t.Fatalf("start: %d %s", rec.Code, rec.Body)
	}
	started := decodeJSON[struct {
		Token   string `json:"token"`
		Seconds int    `json:"seconds"`
	}](t, rec.Body.String())
	if started.Seconds != plans.AdSeconds || started.Token == "" {
		t.Fatalf("start body: %+v", started)
	}
	finish := `{"token":"` + started.Token + `"}`

	clock = clock.Add(5 * time.Second)
	if rec := call(h, http.MethodPost, "/api/plan/ads/finish", finish, amy); rec.Code != http.StatusConflict {
		t.Errorf("finish too early: %d %s", rec.Code, rec.Body)
	}
	clock = clock.Add(time.Duration(plans.AdSeconds) * time.Second)
	// 別人拿這張 token 不行;竄改也不行
	if rec := call(h, http.MethodPost, "/api/plan/ads/finish", finish, bob); rec.Code != http.StatusBadRequest {
		t.Errorf("finish by other user: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodPost, "/api/plan/ads/finish", `{"token":"x`+started.Token+`"}`, amy); rec.Code != http.StatusBadRequest {
		t.Errorf("tampered token: %d %s", rec.Code, rec.Body)
	}
	rec = call(h, http.MethodPost, "/api/plan/ads/finish", finish, amy)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("finish: %d %s", rec.Code, rec.Body)
	}
	var pass *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == adPassCookie {
			pass = c
		}
	}
	if pass == nil || !pass.HttpOnly {
		t.Fatalf("pass cookie: %+v", pass)
	}

	// 帶著登入與通行證
	both := func(path string) int { return serve(h, newRequestWith(http.MethodGet, path, amy, pass)).Code }
	if code := both("/api/scripts/vibe/4.1.json"); code != http.StatusOK {
		t.Errorf("script with pass: %d", code)
	}
	r := newRequestWith(http.MethodGet, "/api/courses/software/access?lesson=4.1", amy, pass)
	if a := decodeJSON[courseAccessResponse](t, serve(h, r).Body.String()); !a.Allowed || a.Ad {
		t.Errorf("access with pass: %+v", a)
	}
	// 通行證只對這一課、這個人有效
	if code := serve(h, newRequestWith(http.MethodGet, "/api/scripts/vibe/4.1.json", bob, pass)).Code; code != http.StatusForbidden {
		t.Errorf("pass used by other user: %d", code)
	}
	// 過期後要重看
	clock = clock.Add(plans.AdPassTTL + time.Second)
	if code := both("/api/scripts/vibe/4.1.json"); code != http.StatusForbidden {
		t.Errorf("expired pass: %d", code)
	}
}

// 管理員模擬身分(X-Simulate-Role):課程權限與方案狀態照模擬的身分回答;一般使用者送這個標頭一律忽略
func TestSimulatedRole(t *testing.T) {
	st := openTestStore(t)
	svc, err := gormstore.NewService(st.DB(), plans.Catalog, subscription.Options{})
	if err != nil {
		t.Fatal(err)
	}
	signer := auth.NewSigner("test-secret", time.Hour)
	h := New(Config{Store: st, Signer: signer, AdminEmails: "boss@example.com", Plans: svc}).Routes()
	u, err := st.UpsertGoogleUser(context.Background(), "sub-boss", "boss@example.com", true, "Boss")
	if err != nil {
		t.Fatal(err)
	}
	token, err := signer.Sign(u.ID)
	if err != nil {
		t.Fatal(err)
	}
	boss := &http.Cookie{Name: sessionCookie, Value: token}
	amy := registerCookie(t, h, "amy@example.com")

	// software 的 tools 單元是訂閱(basic),0.0 不是序章
	const path = "/api/courses/software/access?lesson=0.0"
	access := func(c *http.Cookie, role string) courseAccessResponse {
		t.Helper()
		req := newRequestWith(http.MethodGet, path, c)
		if role != "" {
			req.Header.Set(simulateHeader, role)
		}
		rec := serve(h, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: %d %s", role, rec.Code, rec.Body)
		}
		return decodeJSON[courseAccessResponse](t, rec.Body.String())
	}

	if a := access(boss, ""); !a.Allowed || a.Ad {
		t.Errorf("管理員本人: %+v", a)
	}
	if a := access(boss, "member"); a.Allowed || a.Reason != "plan_required" {
		t.Errorf("模擬註冊未訂閱: %+v", a)
	}
	if a := access(boss, "guest"); a.Allowed || a.Reason != "login_required" {
		t.Errorf("模擬訪客: %+v", a)
	}
	if a := access(boss, "subscriber"); !a.Allowed || a.Ad {
		t.Errorf("模擬已訂閱: %+v", a)
	}
	if a := access(boss, "nonsense"); !a.Allowed {
		t.Errorf("不認得的模擬值要當成沒模擬: %+v", a)
	}
	// 一般使用者送了也不能冒用
	for _, role := range []string{"subscriber", "member", "guest"} {
		if a := access(amy, role); a.Allowed || a.Reason != "plan_required" {
			t.Errorf("一般使用者送 %s 不該有效果: %+v", role, a)
		}
	}

	me := func(c *http.Cookie, role string) string {
		req := newRequestWith(http.MethodGet, "/api/plan/me", c)
		if role != "" {
			req.Header.Set(simulateHeader, role)
		}
		return serve(h, req).Body.String()
	}
	if body := me(boss, "subscriber"); !strings.Contains(body, `"plan":"subscription"`) {
		t.Errorf("模擬已訂閱的方案狀態: %s", body)
	}
	if body := me(amy, "subscriber"); !strings.Contains(body, `"plan":"free"`) {
		t.Errorf("一般使用者的方案狀態不受標頭影響: %s", body)
	}
}
