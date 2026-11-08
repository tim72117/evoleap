package api

import (
	"context"
	"net/http"
	"net/http/httptest"
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
	if _, err := st.OpenGuestView(ctx, strings.Repeat("b", 32), "live:a.json", store.GuestMeta{}); err != nil {
		t.Fatal(err)
	}
	if n, err := st.PruneGuestViews(ctx, time.Now().Add(-time.Hour)); err != nil || n != 0 {
		t.Errorf("recent kept: %d %v", n, err)
	}
	if n, err := st.PruneGuestViews(ctx, time.Now().Add(time.Hour)); err != nil || n != 1 {
		t.Errorf("old pruned: %d %v", n, err)
	}
}

func TestDeviceAndSource(t *testing.T) {
	for ua, want := range map[string]string{
		"": store.DeviceBot,
		"Mozilla/5.0 (compatible; Googlebot/2.1)":                                    store.DeviceBot,
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0":    store.DeviceBot,
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148":       store.DeviceMobile,
		"Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36":              store.DeviceMobile,
		"Mozilla/5.0 (Linux; Android 14; SM-X710) Safari/537.36":                     store.DeviceTablet,
		"Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)":                              store.DeviceTablet,
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0 Safari/537.36": store.DeviceDesktop,
	} {
		if got := deviceOf(ua); got != want {
			t.Errorf("deviceOf(%q) = %q, want %q", ua, got, want)
		}
	}
	for ref, want := range map[string]string{
		"":                                   store.SourceDirect,
		"not a url":                          store.SourceDirect,
		"https://www.google.com/search?q=x":  "google.com",
		"https://evoleap.example/topics/web": store.SourceSelf,
		"https://line.me/R/":                 "line.me",
	} {
		if got := sourceOf(ref, "evoleap.example:443"); got != want {
			t.Errorf("sourceOf(%q) = %q, want %q", ref, got, want)
		}
	}
}

func TestGuestFunnel(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	h := env.h
	open := func(ua string, c *http.Cookie) (string, *http.Cookie) {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/guest/views", strings.NewReader(`{"lesson":"kids:kids/0.1.json","from":"https://www.google.com/"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", ua)
		if c != nil {
			req.AddCookie(c)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("open: %d %s", rec.Code, rec.Body)
		}
		if nc := guestCookieFrom(t, rec.Result()); nc != nil {
			c = nc
		}
		return between(rec.Body.String(), `"id":"`, `"}`), c
	}
	report := func(id, body string, c *http.Cookie) {
		t.Helper()
		if rec := call(h, http.MethodPut, "/api/guest/views/"+id, body, c); rec.Code != http.StatusNoContent {
			t.Fatalf("report: %d %s", rec.Code, rec.Body)
		}
	}
	const phone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148"
	played, c := open(phone, nil)
	report(played, `{"watchedMs":40000,"visibleMs":50000,"readyMs":1200}`, c)
	idle, c := open(phone, c)
	report(idle, `{"watchedMs":0,"visibleMs":4000,"readyMs":800}`, c)
	report(idle, `{"watchedMs":0,"visibleMs":3000,"readyMs":9999}`, c) // 舊值晚到:前景時間不變小、載入時間只記第一次
	report(idle, `{"watchedMs":0,"visibleMs":4000,"events":[{"t":900,"e":"ready"},{"t":2500,"e":"click:段落"},{"t":4000,"e":"leave:/topics/kids"}]}`, c)
	report(idle, `{"watchedMs":0,"visibleMs":4000,"events":[{"t":900,"e":"ready"}]}`, c) // 較短的舊足跡晚到,不蓋掉
	failed, c := open(phone, c)
	report(failed, `{"watchedMs":0,"visibleMs":20000,"error":"找不到腳本"}`, c)
	open("Googlebot/2.1", nil)

	views, err := env.st.GuestViews(context.Background(), c.Value)
	if err != nil || len(views) != 3 {
		t.Fatalf("views: %v %+v", err, views)
	}
	for _, v := range views {
		if v.Device != store.DeviceMobile || v.Source != "google.com" {
			t.Errorf("meta: %+v", v)
		}
		if v.ID == idle && (v.VisibleMs != 4000 || v.ReadyMs != 800) {
			t.Errorf("idle: %+v", v)
		}
	}

	boss := env.googleCookie(t, "boss@example.com")
	body := call(h, http.MethodGet, "/api/admin/overview", "", boss).Body.String()
	for _, want := range []string{
		`"guestBots":1,"guestTracked":3,"guestReady":2,"guestFailed":1,"guestPlayed":1,"guestIdleVisibleMs":12000,"guestReadyAvgMs":1000`,
		`"errors":[{"name":"找不到腳本","count":1}]`,
		`"events":[{"t":900,"e":"ready"},{"t":2500,"e":"click:段落"},{"t":4000,"e":"leave:/topics/kids"}]`,
		`"sources":[{"name":"google.com","count":3}]`,
		`"idleVisible":[{"name":"under10s","count":1},{"name":"10to60s","count":1},{"name":"over60s","count":0}]`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("overview missing %s\n%s", want, body)
		}
	}
}

func TestHomePaths(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	h := env.h
	const desk = "Mozilla/5.0 (Macintosh) Chrome/130 Safari/537.36"
	open := func(lesson string, c *http.Cookie) (string, *http.Cookie) {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/guest/views", strings.NewReader(`{"lesson":"`+lesson+`"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", desk)
		if c != nil {
			req.AddCookie(c)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if nc := guestCookieFrom(t, rec.Result()); nc != nil {
			c = nc
		}
		return between(rec.Body.String(), `"id":"`, `"}`), c
	}
	report := func(id, body string, c *http.Cookie) {
		t.Helper()
		if rec := call(h, http.MethodPut, "/api/guest/views/"+id, body, c); rec.Code != http.StatusNoContent {
			t.Fatalf("report: %d %s", rec.Code, rec.Body)
		}
	}
	// 訪客甲:首頁 → 網頁課地圖 → 0.1(有播放)→ 關掉
	_, a := open("page:/", nil)
	_, a = open("page:/topics/web", a)
	lesson, a := open("live:web/0.1.json", a)
	report(lesson, `{"watchedMs":5000,"events":[{"t":100,"e":"ready"},{"t":9000,"e":"close"}]}`, a)
	// 訪客乙:首頁 → 登入頁(沒有記錄的頁面)
	home, b := open("page:/", nil)
	report(home, `{"watchedMs":0,"events":[{"t":3000,"e":"link:/login"},{"t":3000,"e":"leave:/login"}]}`, b)
	// 訪客丙:直接打開一課(不是從首頁進來,不算)
	open("live:web/0.1.json", nil)

	boss := env.googleCookie(t, "boss@example.com")
	body := call(h, http.MethodGet, "/api/admin/overview", "", boss).Body.String()
	for _, want := range []string{
		`{"steps":[{"lesson":"page:/","played":false},{"lesson":"page:/topics/web","played":false},{"lesson":"live:web/0.1.json","played":true},{"lesson":"exit","played":false}],"count":1,"played":1}`,
		`{"steps":[{"lesson":"page:/","played":false},{"lesson":"leave:/login","played":false}],"count":1,"played":0}`,
		`"homeVisits":2`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("overview missing %s\n%s", want, body)
		}
	} // 首頁、課程地圖不是課:不進各課概況,裝置分布只算三筆課的紀錄(甲、丙各打開一課;乙沒有打開課)
	if strings.Contains(body, `"lesson":"page:/","learners"`) {
		t.Errorf("page rows should not be lesson stats\n%s", body)
	}
	if !strings.Contains(body, `"devices":[{"name":"desktop","count":2}]`) {
		t.Errorf("devices should count lesson rows only\n%s", body)
	}
}

func TestGuestLoginOutcome(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	h := env.h
	const desk = "Mozilla/5.0 (Macintosh) Chrome/130 Safari/537.36"
	open := func(lesson string, c *http.Cookie) (string, *http.Cookie) {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/guest/views", strings.NewReader(`{"lesson":"`+lesson+`"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", desk)
		if c != nil {
			req.AddCookie(c)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if nc := guestCookieFrom(t, rec.Result()); nc != nil {
			c = nc
		}
		return between(rec.Body.String(), `"id":"`, `"}`), c
	}
	report := func(id, body string, c *http.Cookie) {
		t.Helper()
		if rec := call(h, http.MethodPut, "/api/guest/views/"+id, body, c); rec.Code != http.StatusNoContent {
			t.Fatalf("report: %d %s", rec.Code, rec.Body)
		}
	}
	// 訪客甲:從第 1 課被擋下來 → 登入頁,密碼打錯一次,再註冊成功(伺服器記下 register)
	view, a := open("page:/login", nil)
	report(view, `{"watchedMs":0,"readyMs":1200,"events":[{"t":10,"e":"next:/courses/tools/1"},{"t":900,"e":"fail:Email 或密碼不正確"}]}`, a)
	if rec := call(h, http.MethodPost, "/api/auth/register", `{"email":"guest-a@example.com","password":"secret123"}`, a); rec.Code != http.StatusOK {
		t.Fatalf("register: %d %s", rec.Code, rec.Body)
	}
	// 訪客乙:打開登入頁,登入失敗後離開
	view, b := open("page:/login", nil)
	report(view, `{"watchedMs":0,"error":"Google 登入程式載入失敗","events":[{"t":500,"e":"fail:Email 或密碼不正確"},{"t":900,"e":"close"}]}`, b)
	// 訪客丙:打開登入頁什麼都沒做就離開
	open("page:/login", nil)

	boss := env.googleCookie(t, "boss@example.com")
	body := call(h, http.MethodGet, "/api/admin/overview", "", boss).Body.String()
	for _, want := range []string{
		`"login":{"visits":3,`,
		`{"name":"register","count":1}`,
		`{"name":"failed","count":1}`,
		`{"name":"left","count":1}`,
		`{"name":"/courses/tools/1","count":1}`,
		`"fails":[{"name":"Email 或密碼不正確","count":2}]`,
		`"googleReady":1,"googleReadyAvgMs":1200,"googleFailed":1,"googleErrors":[{"name":"Google 登入程式載入失敗","count":1}]`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("overview missing %s\n%s", want, body)
		}
	}
}
