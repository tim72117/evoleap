package api

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tim72117/evoleap/internal/auth"
	"github.com/tim72117/evoleap/internal/store"
)

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return New(Config{Store: st, Signer: auth.NewSigner("test-secret", time.Hour)}).Routes()
}

// call 送出請求;body 非空時以 JSON 送出,並帶上 cookie。
func call(h http.Handler, method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func sessionFrom(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == sessionCookie {
			if !c.HttpOnly {
				t.Error("session cookie is not HttpOnly")
			}
			return c
		}
	}
	t.Fatalf("no %s cookie in response (status %d, body %s)", sessionCookie, rec.Code, rec.Body)
	return nil
}

func TestHealth(t *testing.T) {
	rec := call(newTestServer(t), http.MethodGet, "/api/health", "", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"ok"`) {
		t.Fatalf("health: %d %s", rec.Code, rec.Body)
	}
}

func TestPasswordAuthFlow(t *testing.T) {
	h := newTestServer(t)

	if rec := call(h, http.MethodGet, "/api/me", "", nil); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"user":null`) {
		t.Fatalf("me before login: %d %s", rec.Code, rec.Body)
	}

	rec := call(h, http.MethodPost, "/api/auth/register", `{"email":" Amy@Example.com ","password":"secret123","name":"Amy"}`, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("register: %d %s", rec.Code, rec.Body)
	}
	cookie := sessionFrom(t, rec)

	rec = call(h, http.MethodGet, "/api/me", "", cookie)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"email":"amy@example.com"`) {
		t.Fatalf("me after register: %d %s", rec.Code, rec.Body)
	}
	if strings.Contains(rec.Body.String(), "password") {
		t.Fatal("me response leaks password fields")
	}

	if rec := call(h, http.MethodPost, "/api/auth/register", `{"email":"amy@example.com","password":"another123"}`, nil); rec.Code != http.StatusConflict {
		t.Fatalf("duplicate register: %d", rec.Code)
	}
	if rec := call(h, http.MethodPost, "/api/auth/login", `{"email":"amy@example.com","password":"wrong-pass"}`, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong password: %d", rec.Code)
	}
	if rec := call(h, http.MethodPost, "/api/auth/login", `{"email":"nobody@example.com","password":"secret123"}`, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("unknown email: %d", rec.Code)
	}

	rec = call(h, http.MethodPost, "/api/auth/login", `{"email":"AMY@example.com","password":"secret123"}`, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("login: %d %s", rec.Code, rec.Body)
	}
	sessionFrom(t, rec)

	rec = call(h, http.MethodPost, "/api/auth/logout", "", cookie)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("logout: %d", rec.Code)
	}
	if c := sessionFrom(t, rec); c.MaxAge >= 0 {
		t.Fatalf("logout cookie MaxAge = %d, want < 0", c.MaxAge)
	}
}

func TestRegisterValidation(t *testing.T) {
	h := newTestServer(t)
	cases := map[string]string{
		"bad email":      `{"email":"not-an-email","password":"secret123"}`,
		"short password": `{"email":"a@example.com","password":"short"}`,
	}
	for name, body := range cases {
		if rec := call(h, http.MethodPost, "/api/auth/register", body, nil); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", name, rec.Code)
		}
	}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req) // 沒有 Content-Type: application/json
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Errorf("non-JSON: status %d, want 415", rec.Code)
	}
}

func TestTamperedCookie(t *testing.T) {
	h := newTestServer(t)
	rec := call(h, http.MethodPost, "/api/auth/register", `{"email":"b@example.com","password":"secret123"}`, nil)
	c := sessionFrom(t, rec)
	c.Value += "x"
	if rec := call(h, http.MethodGet, "/api/me", "", c); !strings.Contains(rec.Body.String(), `"user":null`) {
		t.Fatalf("tampered cookie: %d", rec.Code)
	}
}

func TestGoogleDisabled(t *testing.T) {
	h := newTestServer(t)
	if rec := call(h, http.MethodGet, "/api/auth/config", "", nil); !strings.Contains(rec.Body.String(), `"googleClientId":""`) {
		t.Fatalf("config: %s", rec.Body)
	}
	if rec := call(h, http.MethodPost, "/api/auth/google", `{"credential":"x"}`, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("google disabled: %d", rec.Code)
	}
}

func TestAuthDisabledWithoutStore(t *testing.T) {
	h := New(Config{}).Routes()
	if rec := call(h, http.MethodGet, "/api/health", "", nil); rec.Code != http.StatusOK {
		t.Fatalf("health: %d", rec.Code)
	}
	if rec := call(h, http.MethodGet, "/api/auth/config", "", nil); !strings.Contains(rec.Body.String(), `"enabled":false`) {
		t.Fatalf("config: %s", rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/me", "", nil); !strings.Contains(rec.Body.String(), `"user":null`) {
		t.Fatalf("me: %s", rec.Body)
	}
	for _, path := range []string{"/api/auth/register", "/api/auth/login", "/api/auth/google"} {
		if rec := call(h, http.MethodPost, path, `{}`, nil); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("%s: status %d, want 503", path, rec.Code)
		}
	}
}
