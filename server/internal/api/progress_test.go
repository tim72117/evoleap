package api

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
)

func registerCookie(t *testing.T, h http.Handler, email string) *http.Cookie {
	t.Helper()
	rec := call(h, http.MethodPost, "/api/auth/register", `{"email":"`+email+`","password":"secret123","name":"Amy"}`, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("register: %d %s", rec.Code, rec.Body)
	}
	return sessionFrom(t, rec)
}

func TestProgressRequiresLogin(t *testing.T) {
	h := newTestServer(t)
	if rec := call(h, http.MethodGet, "/api/progress?lesson=l0/0.0-tools.json", "", nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("guest GET: %d %s", rec.Code, rec.Body)
	}
	body := `{"lesson":"l0/0.0-tools.json","positionMs":60000,"durationMs":300000}`
	if rec := call(h, http.MethodPut, "/api/progress", body, nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("guest PUT: %d %s", rec.Code, rec.Body)
	}
}

func TestProgressSaveAndRead(t *testing.T) {
	h := newTestServer(t)
	amy := registerCookie(t, h, "amy@example.com")
	bob := registerCookie(t, h, "bob@example.com")

	if rec := call(h, http.MethodGet, "/api/progress?lesson=l0/0.0-tools.json", "", amy); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"progress":null`) {
		t.Fatalf("no record yet: %d %s", rec.Code, rec.Body)
	}

	put := func(c *http.Cookie, lesson string, pos int) {
		t.Helper()
		body := `{"lesson":"` + lesson + `","positionMs":` + strconv.Itoa(pos) + `,"durationMs":300000}`
		if rec := call(h, http.MethodPut, "/api/progress", body, c); rec.Code != http.StatusNoContent {
			t.Fatalf("PUT: %d %s", rec.Code, rec.Body)
		}
	}
	put(amy, "l0/0.0-tools.json", 60000)
	put(amy, "l0/0.0-tools.json", 90000) // 同一課再存是覆蓋
	put(amy, "l0/0.1-project.json", 5000)
	put(bob, "l0/0.0-tools.json", 1000)

	rec := call(h, http.MethodGet, "/api/progress?lesson=l0/0.0-tools.json", "", amy)
	if !strings.Contains(rec.Body.String(), `"positionMs":90000`) {
		t.Errorf("single: %s", rec.Body)
	}
	rec = call(h, http.MethodGet, "/api/progress", "", amy)
	if strings.Count(rec.Body.String(), `"lesson"`) != 2 || strings.Contains(rec.Body.String(), `"positionMs":1000`) {
		t.Errorf("list should have only amy's two lessons: %s", rec.Body)
	}
}

func TestProgressValidation(t *testing.T) {
	h := newTestServer(t)
	c := registerCookie(t, h, "amy@example.com")
	for _, body := range []string{
		`{"lesson":"","positionMs":1,"durationMs":2}`,
		`{"lesson":"x","positionMs":-1,"durationMs":2}`,
		`{"lesson":"x","positionMs":1,"durationMs":999999999999}`,
		`{"lesson":"x","positionMs":5000,"durationMs":1000}`, // 位置大於總長
		`{"lesson":"x","positionMs":86400000,"durationMs":0}`,
		`{"lesson":"` + strings.Repeat("a", 201) + `","positionMs":1,"durationMs":2}`,
	} {
		if rec := call(h, http.MethodPut, "/api/progress", body, c); rec.Code != http.StatusBadRequest {
			t.Errorf("%.40s: want 400, got %d", body, rec.Code)
		}
	}
}
