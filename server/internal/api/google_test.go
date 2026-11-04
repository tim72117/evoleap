package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/tim72117/evoleap/internal/auth"
	"github.com/tim72117/evoleap/internal/store"
)

// openTestStore 開一個乾淨的資料庫:有設定 TEST_DATABASE_URL 時用 Postgres(和正式環境相同,CI 會跑),否則用暫存的 SQLite。
func openTestStore(t *testing.T) *store.Store {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = filepath.Join(t.TempDir(), "test.db")
	} else {
		db, err := sql.Open("pgx", dsn)
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()
		if _, err := db.Exec(`DROP SCHEMA public CASCADE; CREATE SCHEMA public`); err != nil {
			t.Fatal(err)
		}
	}
	st, err := store.Open(dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

// googleServer 回傳可以用假憑證登入的伺服器:憑證內容就是 identities 的 key。
func googleServer(t *testing.T, identities map[string]auth.GoogleIdentity) http.Handler {
	t.Helper()
	return New(Config{
		Store:          openTestStore(t),
		Signer:         auth.NewSigner("test-secret", time.Hour),
		GoogleClientID: "test-client",
		VerifyGoogle: func(_ context.Context, credential, clientID string) (auth.GoogleIdentity, error) {
			if clientID != "test-client" {
				t.Errorf("clientID = %q", clientID)
			}
			id, ok := identities[credential]
			if !ok {
				return auth.GoogleIdentity{}, errors.New("bad token")
			}
			return id, nil
		},
	}).Routes()
}

func googleLogin(h http.Handler, credential string) *httptest.ResponseRecorder {
	return call(h, http.MethodPost, "/api/auth/google", `{"credential":"`+credential+`"}`, nil)
}

func meOf(t *testing.T, h http.Handler, c *http.Cookie) store.User {
	t.Helper()
	rec := call(h, http.MethodGet, "/api/me", "", c)
	var body struct {
		User *store.User `json:"user"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("me: %v %s", err, rec.Body)
	}
	if body.User == nil {
		t.Fatalf("me: not signed in: %s", rec.Body)
	}
	return *body.User
}

// tripace 曾經發生:回應裡有 email,資料庫卻沒存。這裡用 /api/me 從資料庫讀回來確認。
func TestGoogleNewUserStoresEmail(t *testing.T) {
	h := googleServer(t, map[string]auth.GoogleIdentity{
		"amy": {Sub: "sub-amy", Email: " Amy@Example.com ", EmailVerified: true, Name: "Amy"},
	})
	rec := googleLogin(h, "amy")
	if rec.Code != http.StatusOK {
		t.Fatalf("login: %d %s", rec.Code, rec.Body)
	}
	first := meOf(t, h, sessionFrom(t, rec))
	if first.Email != "amy@example.com" || first.Name != "Amy" {
		t.Errorf("stored user = %+v", first)
	}

	again := googleLogin(h, "amy")
	if got := meOf(t, h, sessionFrom(t, again)); got.ID != first.ID || got.Email != "amy@example.com" {
		t.Errorf("second login = %+v, want id %s", got, first.ID)
	}
}

func TestGoogleLinkClearsPasswordAndOldSessions(t *testing.T) {
	h := googleServer(t, map[string]auth.GoogleIdentity{
		"amy": {Sub: "sub-amy", Email: "amy@example.com", EmailVerified: true, Name: "Google Amy"},
	})
	squatter := registerCookie(t, h, "amy@example.com")
	before := meOf(t, h, squatter)
	// cookie 的簽發時間以秒為單位,等到下一秒才分得出綁定前後。
	time.Sleep(1100 * time.Millisecond)

	rec := googleLogin(h, "amy")
	if rec.Code != http.StatusOK {
		t.Fatalf("link: %d %s", rec.Code, rec.Body)
	}
	if got := meOf(t, h, sessionFrom(t, rec)); got.ID != before.ID || got.Email != "amy@example.com" {
		t.Errorf("linked user = %+v, want id %s", got, before.ID)
	}
	if rec := call(h, http.MethodPost, "/api/auth/login", `{"email":"amy@example.com","password":"secret123"}`, nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("綁定後舊密碼應失效: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/me", "", squatter); !strings.Contains(rec.Body.String(), `"user":null`) {
		t.Errorf("綁定前的 cookie 應失效: %s", rec.Body)
	}
}

func TestGoogleRejections(t *testing.T) {
	h := googleServer(t, map[string]auth.GoogleIdentity{
		"unverified": {Sub: "sub-u", Email: "victim@example.com", EmailVerified: false},
		"no-email":   {Sub: "sub-n", EmailVerified: true},
		"first":      {Sub: "sub-1", Email: "amy@example.com", EmailVerified: true},
		"second":     {Sub: "sub-2", Email: "amy@example.com", EmailVerified: true},
	})
	for credential, want := range map[string]int{
		"unverified": http.StatusForbidden,
		"no-email":   http.StatusForbidden,
		"forged":     http.StatusUnauthorized,
	} {
		if rec := googleLogin(h, credential); rec.Code != want {
			t.Errorf("%s: status %d, want %d: %s", credential, rec.Code, want, rec.Body)
		}
	}
	// 未驗證的 Email 不能佔用:本人之後還是註冊得到。
	if rec := call(h, http.MethodPost, "/api/auth/register", `{"email":"victim@example.com","password":"secret123"}`, nil); rec.Code != http.StatusOK {
		t.Errorf("未驗證的 Google 登入不應建立帳號: %d %s", rec.Code, rec.Body)
	}
	if rec := googleLogin(h, "first"); rec.Code != http.StatusOK {
		t.Fatalf("first: %d %s", rec.Code, rec.Body)
	}
	if rec := googleLogin(h, "second"); rec.Code != http.StatusConflict {
		t.Errorf("second: status %d, want 409: %s", rec.Code, rec.Body)
	}
}

func TestGoogleLongNameIsTruncated(t *testing.T) {
	h := googleServer(t, map[string]auth.GoogleIdentity{
		"long": {Sub: "sub-l", Email: "long@example.com", EmailVerified: true, Name: strings.Repeat("名", 200)},
	})
	rec := googleLogin(h, "long")
	if rec.Code != http.StatusOK {
		t.Fatalf("login: %d %s", rec.Code, rec.Body)
	}
	if got := meOf(t, h, sessionFrom(t, rec)); len([]rune(got.Name)) != store.MaxNameLen {
		t.Errorf("name length = %d", len([]rune(got.Name)))
	}
}

// 連按兩次 Google 登入:每次都要成功,而且只有一個帳號。SQLite 同時只能有一個寫入者,只在 Postgres 測。
func TestGoogleConcurrentLogin(t *testing.T) {
	if os.Getenv("TEST_DATABASE_URL") == "" {
		t.Skip("需要 TEST_DATABASE_URL")
	}
	h := googleServer(t, map[string]auth.GoogleIdentity{
		"amy": {Sub: "sub-amy", Email: "amy@example.com", EmailVerified: true, Name: "Amy"},
	})
	const n = 8
	recs := make([]*httptest.ResponseRecorder, n)
	var wg sync.WaitGroup
	for i := range recs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			recs[i] = googleLogin(h, "amy")
		}()
	}
	wg.Wait()
	ids := map[string]bool{}
	for _, rec := range recs {
		if rec.Code != http.StatusOK {
			t.Fatalf("status %d: %s", rec.Code, rec.Body)
		}
		ids[meOf(t, h, sessionFrom(t, rec)).ID] = true
	}
	if len(ids) != 1 {
		t.Errorf("建立了 %d 個帳號", len(ids))
	}
}

func TestRegisterAndLoginRejectBadInput(t *testing.T) {
	h := newTestServer(t)
	long := strings.Repeat("a", store.MaxEmailLen) + "@example.com"
	for _, body := range []string{
		`{"email":"` + long + `","password":"secret123"}`,
		`{"email":"amy@example.com","password":"secret123","name":"a\u0000b"}`,
	} {
		if rec := call(h, http.MethodPost, "/api/auth/register", body, nil); rec.Code != http.StatusBadRequest {
			t.Errorf("register: status %d, want 400: %s", rec.Code, rec.Body)
		}
	}
	if rec := call(h, http.MethodPost, "/api/auth/login", `{"email":"a\u0000b@example.com","password":"secret123"}`, nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("login with NUL: status %d, want 401: %s", rec.Code, rec.Body)
	}
}

func rateLimitServer(t *testing.T, limit int) http.Handler {
	t.Helper()
	return New(Config{Store: openTestStore(t), Signer: auth.NewSigner("test-secret", time.Hour), AuthRateLimit: limit}).Routes()
}

func loginFrom(h http.Handler, forwardedFor, email string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"email":"`+email+`","password":"wrong-pass"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-For", forwardedFor)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestAuthRateLimitByIP(t *testing.T) {
	h := rateLimitServer(t, 2)
	for i := range 2 {
		if rec := loginFrom(h, "203.0.113.1", "a"+strconv.Itoa(i)+"@example.com"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: %d", i, rec.Code)
		}
	}
	// 用戶端自己加在前面的 X-Forwarded-For 不能繞過限流。
	rec := loginFrom(h, "198.51.100.9, 203.0.113.1", "b@example.com")
	if rec.Code != http.StatusTooManyRequests || rec.Header().Get("Retry-After") == "" {
		t.Errorf("over limit: %d %v", rec.Code, rec.Header())
	}
	if rec := loginFrom(h, "203.0.113.2", "c@example.com"); rec.Code != http.StatusUnauthorized {
		t.Errorf("另一個 IP 不受影響: %d", rec.Code)
	}
}

func TestLoginRateLimitByEmail(t *testing.T) {
	h := rateLimitServer(t, 1000)
	for i := range loginEmailLimit {
		if rec := loginFrom(h, "203.0.113."+strconv.Itoa(i), "Amy@example.com"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: %d", i, rec.Code)
		}
	}
	if rec := loginFrom(h, "203.0.113.200", "amy@example.com"); rec.Code != http.StatusTooManyRequests {
		t.Errorf("從不同 IP 猜同一個 Email 也要限流: %d", rec.Code)
	}
}

func TestNoRateLimitByDefault(t *testing.T) {
	h := newTestServer(t)
	for i := range loginEmailLimit + 5 {
		if rec := loginFrom(h, "203.0.113.1", "amy@example.com"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: %d", i, rec.Code)
		}
	}
}
