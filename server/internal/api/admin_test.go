package api

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/tim72117/evoleap/internal/auth"
	"github.com/tim72117/evoleap/internal/store"
)

type adminEnv struct {
	h      http.Handler
	st     *store.Store
	signer *auth.Signer
}

func newAdminEnv(t *testing.T, admins string) adminEnv {
	t.Helper()
	st := openTestStore(t)
	signer := auth.NewSigner("test-secret", time.Hour)
	return adminEnv{h: New(Config{Store: st, Signer: signer, AdminEmails: admins}).Routes(), st: st, signer: signer}
}

func newAdminTestServer(t *testing.T, admins string) http.Handler { return newAdminEnv(t, admins).h }

// googleCookie 模擬「Google 已驗證 Email」的登入(管理員只承認這種帳號)。
func (e adminEnv) googleCookie(t *testing.T, email string) *http.Cookie {
	t.Helper()
	u, err := e.st.UpsertGoogleUser(context.Background(), "sub-"+email, email, true, "Boss")
	if err != nil {
		t.Fatal(err)
	}
	token, err := e.signer.Sign(u.ID)
	if err != nil {
		t.Fatal(err)
	}
	return &http.Cookie{Name: sessionCookie, Value: token}
}

func TestIsAdminEmail(t *testing.T) {
	cases := []struct {
		email, list string
		want        bool
	}{
		{"admin@example.com", "admin@example.com", true},
		{"Admin@Example.com", " admin@example.com ", true},
		{"b@example.com", "a@example.com, B@example.com", true},
		{"c@example.com", "a@example.com,b@example.com", false},
		{"admin@example.com", "", false},
		{"", "", false},
		{"", ",", false},
	}
	for _, c := range cases {
		if got := IsAdminEmail(c.email, c.list); got != c.want {
			t.Errorf("IsAdminEmail(%q,%q)=%v want %v", c.email, c.list, got, c.want)
		}
	}
}

func TestAdminRequiresAdmin(t *testing.T) {
	h := newAdminTestServer(t, "boss@example.com")
	paths := []string{"/api/admin/me", "/api/admin/overview", "/api/admin/users", "/api/admin/users/x/progress"}
	user := registerCookie(t, h, "amy@example.com")
	for _, p := range paths {
		if rec := call(h, http.MethodGet, p, "", nil); rec.Code != http.StatusUnauthorized {
			t.Errorf("guest %s: want 401, got %d", p, rec.Code)
		}
		if rec := call(h, http.MethodGet, p, "", user); rec.Code != http.StatusForbidden {
			t.Errorf("non-admin %s: want 403, got %d", p, rec.Code)
		}
	}
}

// 密碼註冊不驗證 Email 所有權:有人搶在管理員之前用白名單的 Email 註冊,不能因此成為管理員;
// 管理員之後用 Google 登入綁定同一個帳號,搶註冊的人設的密碼也要失效。
func TestAdminRejectsPasswordSquatter(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	squatter := registerCookie(t, env.h, "boss@example.com")
	if rec := call(env.h, http.MethodGet, "/api/admin/users", "", squatter); rec.Code != http.StatusForbidden {
		t.Fatalf("密碼註冊的白名單 Email 不應是管理員: want 403, got %d", rec.Code)
	}
	boss := env.googleCookie(t, "boss@example.com")
	if rec := call(env.h, http.MethodGet, "/api/admin/users", "", boss); rec.Code != http.StatusOK {
		t.Errorf("Google 驗證後應是管理員: want 200, got %d %s", rec.Code, rec.Body)
	}
	if rec := call(env.h, http.MethodPost, "/api/auth/login", `{"email":"boss@example.com","password":"secret123"}`, nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("綁定 Google 後搶註冊者的密碼應失效: want 401, got %d", rec.Code)
	}
}

func TestAdminFailClosedWhenNoAllowlist(t *testing.T) {
	h := newAdminTestServer(t, "")
	c := registerCookie(t, h, "amy@example.com")
	if rec := call(h, http.MethodGet, "/api/admin/users", "", c); rec.Code != http.StatusForbidden {
		t.Errorf("want 403, got %d", rec.Code)
	}
}

func TestAdminUsersAndProgress(t *testing.T) {
	env := newAdminEnv(t, "Boss@Example.com")
	h := env.h
	boss := env.googleCookie(t, "boss@example.com")
	amy := registerCookie(t, h, "amy@example.com")
	put := func(c *http.Cookie, body string) {
		t.Helper()
		if rec := call(h, http.MethodPut, "/api/progress", body, c); rec.Code != http.StatusNoContent {
			t.Fatalf("PUT: %d %s", rec.Code, rec.Body)
		}
	}
	put(amy, `{"lesson":"l0/0.0.json","positionMs":290000,"durationMs":300000}`)
	put(amy, `{"lesson":"l0/0.1.json","positionMs":30000,"durationMs":300000}`)
	put(boss, `{"lesson":"l0/0.0.json","positionMs":150000,"durationMs":300000}`)

	if rec := call(h, http.MethodGet, "/api/admin/me", "", boss); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "boss@example.com") {
		t.Fatalf("me: %d %s", rec.Code, rec.Body)
	}

	rec := call(h, http.MethodGet, "/api/admin/users", "", boss)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"total":2`) ||
		!strings.Contains(rec.Body.String(), `"lessonCount":2`) || !strings.Contains(rec.Body.String(), `"completed":1`) {
		t.Fatalf("users: %d %s", rec.Code, rec.Body)
	}
	if strings.Contains(rec.Body.String(), "passwordHash") || strings.Contains(strings.ToLower(rec.Body.String()), "password") {
		t.Errorf("users 不應含密碼欄位: %s", rec.Body)
	}

	rec = call(h, http.MethodGet, "/api/admin/overview", "", boss)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"users":2`) || !strings.Contains(rec.Body.String(), `"activeUsers":2`) ||
		!strings.Contains(rec.Body.String(), `"lesson":"l0/0.0.json","learners":2,"completed":1,"avgPercent":73.3`) {
		t.Fatalf("overview: %d %s", rec.Code, rec.Body)
	}

	// 從 users 列表取得 amy 的 id,查她的進度。
	rec = call(h, http.MethodGet, "/api/admin/users", "", boss)
	id := between(rec.Body.String(), `"id":"`, `","email":"amy@example.com"`)
	if id == "" {
		t.Fatalf("找不到 amy 的 id: %s", rec.Body)
	}
	rec = call(h, http.MethodGet, "/api/admin/users/"+id+"/progress", "", boss)
	if rec.Code != http.StatusOK || strings.Count(rec.Body.String(), `"lesson"`) != 2 {
		t.Errorf("user progress: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/admin/users/nope/progress", "", boss); rec.Code != http.StatusNotFound {
		t.Errorf("unknown user: want 404, got %d", rec.Code)
	}
}

// between 取 s 中 start 之前最近的一段(取 end 前面、最後一個 start 之後的文字)。
func between(s, start, end string) string {
	i := strings.Index(s, end)
	if i < 0 {
		return ""
	}
	j := strings.LastIndex(s[:i], start)
	if j < 0 {
		return ""
	}
	return s[j+len(start) : i]
}

// 這個 Email 的帳號已經綁了某個 Google 帳號:另一個 Google 帳號(sub 不同、Email 相同)不能把它覆蓋掉。
func TestGoogleLinkDoesNotOverwriteExistingBinding(t *testing.T) {
	env := newAdminEnv(t, "")
	ctx := context.Background()
	first, err := env.st.UpsertGoogleUser(ctx, "sub-A", "amy@example.com", true, "Amy")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := env.st.UpsertGoogleUser(ctx, "sub-B", "amy@example.com", true, "Amy"); !errors.Is(err, store.ErrGoogleConflict) {
		t.Fatalf("sub 不同的 Google 登入應該回 ErrGoogleConflict, got %v", err)
	}
	// 原本的綁定還在:用原本的 sub 登入拿到同一個帳號
	again, err := env.st.UpsertGoogleUser(ctx, "sub-A", "amy@example.com", true, "Amy")
	if err != nil || again.ID != first.ID {
		t.Errorf("原本的 sub 應該還是同一個帳號: %v %v", again.ID, err)
	}
}

// 後台的平均進度:不知道總長(durationMs 為 0)的紀錄不算進分母。
func TestAdminAvgPercentIgnoresUnknownDuration(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	for _, email := range []string{"a@example.com", "b@example.com", "c@example.com"} {
		c := registerCookie(t, env.h, email)
		body := `{"lesson":"l0/x.json","positionMs":300000,"durationMs":300000}`
		if email == "c@example.com" {
			body = `{"lesson":"l0/x.json","positionMs":0,"durationMs":0}`
		}
		if rec := call(env.h, http.MethodPut, "/api/progress", body, c); rec.Code != http.StatusNoContent {
			t.Fatalf("PUT %s: %d %s", email, rec.Code, rec.Body)
		}
	}
	rec := call(env.h, http.MethodGet, "/api/admin/overview", "", boss)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"learners":3`) || !strings.Contains(rec.Body.String(), `"avgPercent":100`) {
		t.Errorf("兩筆 100%% 加一筆不知總長:平均應該是 100,學習人數 3: %d %s", rec.Code, rec.Body)
	}
}
