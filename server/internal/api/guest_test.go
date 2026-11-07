package api

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/tim72117/evoleap/internal/auth"
	"github.com/tim72117/evoleap/internal/store"
)

func guestCookieFrom(t *testing.T, res *http.Response) *http.Cookie {
	t.Helper()
	for _, c := range res.Cookies() {
		if c.Name == guestCookie {
			return c
		}
	}
	return nil
}

func openView(t *testing.T, h http.Handler, lesson string, c *http.Cookie) (string, *http.Cookie) {
	t.Helper()
	rec := call(h, http.MethodPost, "/api/guest/views", `{"lesson":"`+lesson+`"}`, c)
	if rec.Code != http.StatusOK {
		t.Fatalf("open: %d %s", rec.Code, rec.Body)
	}
	return between(rec.Body.String(), `"id":"`, `"}`), guestCookieFrom(t, rec.Result())
}

func TestGuestViewFlow(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	h := env.h

	// 第一次記錄時發訪客 cookie:HttpOnly、180 天
	id1, c := openView(t, h, "live:l0/0.0-tools.json", nil)
	if c == nil || !c.HttpOnly || c.MaxAge != int(store.GuestRetention.Seconds()) || len(c.Value) != 32 {
		t.Fatalf("guest cookie: %+v", c)
	}
	// 帶著 cookie 再打開一課:沿用同一個代號,不再發新的 cookie
	id2, again := openView(t, h, "live:l0/0.1-project.json", c)
	if again != nil {
		t.Errorf("已經有 cookie 時不應再發: %+v", again)
	}

	watch := func(id string, ms int, c *http.Cookie) int {
		t.Helper()
		return call(h, http.MethodPut, "/api/guest/views/"+id, `{"watchedMs":`+strconv.Itoa(ms)+`}`, c).Code
	}
	if code := watch(id1, 30000, c); code != http.StatusNoContent {
		t.Fatalf("watch: %d", code)
	}
	if code := watch(id1, 10000, c); code != http.StatusNoContent { // 舊的值晚到,不會蓋掉
		t.Fatalf("watch older: %d", code)
	}
	// 別的訪客(或沒有 cookie)不能改這筆
	if code := watch(id1, 99000, &http.Cookie{Name: guestCookie, Value: strings.Repeat("a", 32)}); code != http.StatusNotFound {
		t.Errorf("other guest: want 404, got %d", code)
	}
	if code := watch(id1, 99000, nil); code != http.StatusNotFound {
		t.Errorf("no cookie: want 404, got %d", code)
	}
	if code := watch(id2, -1, c); code != http.StatusBadRequest {
		t.Errorf("negative: want 400, got %d", code)
	}

	views, err := env.st.GuestViews(context.Background(), c.Value)
	if err != nil || len(views) != 2 {
		t.Fatalf("views: %v %+v", err, views)
	}
	for _, v := range views {
		if v.ID == id1 && v.WatchedMs != 30000 {
			t.Errorf("watched: want 30000, got %d", v.WatchedMs)
		}
	}

	// 後台總覽看得到訪客統計
	boss := env.googleCookie(t, "boss@example.com")
	rec := call(h, http.MethodGet, "/api/admin/overview", "", boss)
	if !strings.Contains(rec.Body.String(), `"guests":1`) ||
		!strings.Contains(rec.Body.String(), `"lesson":"live:l0/0.0-tools.json","learners":0,"completed":0,"avgPercent":0,"guestViews":1,"guestVisitors":1,"guestWatchedMs":30000`) {
		t.Errorf("overview: %s", rec.Body)
	}
}

func TestGuestViewSkipsMembers(t *testing.T) {
	env := newAdminEnv(t, "")
	amy := registerCookie(t, env.h, "amy@example.com")
	rec := call(env.h, http.MethodPost, "/api/guest/views", `{"lesson":"live:l0/0.0-tools.json"}`, amy)
	if rec.Code != http.StatusNoContent || guestCookieFrom(t, rec.Result()) != nil {
		t.Fatalf("member: %d %s", rec.Code, rec.Body)
	}
}

func TestGuestViewValidation(t *testing.T) {
	h := newTestServer(t)
	for _, body := range []string{`{"lesson":""}`, `{"lesson":"` + strings.Repeat("x", maxLessonLen+1) + `"}`, `not json`} {
		if rec := call(h, http.MethodPost, "/api/guest/views", body, nil); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: want 400, got %d", body, rec.Code)
		}
	}
	// 格式不對的 cookie 當作沒有,換發新的
	_, c := openView(t, h, "live:a.json", &http.Cookie{Name: guestCookie, Value: "../bad"})
	if c == nil || c.Value == "../bad" {
		t.Errorf("bad cookie should be replaced: %+v", c)
	}
}

func TestGuestViewDisabledWithoutStore(t *testing.T) {
	h := New(Config{}).Routes()
	if rec := call(h, http.MethodPost, "/api/guest/views", `{"lesson":"live:a.json"}`, nil); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("want 503, got %d", rec.Code)
	}
}

func TestGuestViewRateLimit(t *testing.T) {
	st := openTestStore(t)
	h := New(Config{Store: st, Signer: auth.NewSigner("s", time.Hour), AuthRateLimit: 5}).Routes()
	for i := 0; i < guestOpenLimit; i++ {
		openView(t, h, "live:a.json", nil)
	}
	if rec := call(h, http.MethodPost, "/api/guest/views", `{"lesson":"live:a.json"}`, nil); rec.Code != http.StatusTooManyRequests {
		t.Errorf("want 429, got %d", rec.Code)
	}
}

func TestPruneGuestViews(t *testing.T) {
	st := openTestStore(t)
	ctx := context.Background()
	if _, err := st.OpenGuestView(ctx, strings.Repeat("b", 32), "live:a.json"); err != nil {
		t.Fatal(err)
	}
	if n, err := st.PruneGuestViews(ctx, time.Now().Add(-time.Hour)); err != nil || n != 0 {
		t.Errorf("recent kept: %d %v", n, err)
	}
	if n, err := st.PruneGuestViews(ctx, time.Now().Add(time.Hour)); err != nil || n != 1 {
		t.Errorf("old pruned: %d %v", n, err)
	}
}
