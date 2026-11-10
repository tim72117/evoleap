package api

import (
	"bufio"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

// cliToken 走一次 CLI 登入(start → 管理員核准 → exchange),回傳 evc_ token。
func cliToken(t *testing.T, env adminEnv, admin *http.Cookie) string {
	t.Helper()
	rec := call(env.h, http.MethodPost, "/api/cli-auth/start", `{"redirect_uri":"http://127.0.0.1:5555/callback"}`, nil)
	var start struct{ ID string }
	if json.Unmarshal(rec.Body.Bytes(), &start) != nil || start.ID == "" {
		t.Fatalf("start: %d %s", rec.Code, rec.Body)
	}
	rec = call(env.h, http.MethodPost, "/api/cli-auth/"+start.ID+"/approve", "", admin)
	var approved struct{ Redirect string }
	if json.Unmarshal(rec.Body.Bytes(), &approved) != nil {
		t.Fatalf("approve: %d %s", rec.Code, rec.Body)
	}
	u, _ := url.Parse(approved.Redirect)
	rec = call(env.h, http.MethodPost, "/api/cli-auth/exchange", `{"id":"`+start.ID+`","code":"`+u.Query().Get("code")+`"}`, nil)
	var ex struct{ Token string }
	if json.Unmarshal(rec.Body.Bytes(), &ex) != nil || ex.Token == "" {
		t.Fatalf("exchange: %d %s", rec.Code, rec.Body)
	}
	return ex.Token
}

func liveSnap(t *testing.T, rec *httptest.ResponseRecorder) liveSnapshot {
	t.Helper()
	var s liveSnapshot
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &s) != nil {
		t.Fatalf("回應不是腳本: %d %s", rec.Code, rec.Body)
	}
	return s
}

func stepsOf(s liveSnapshot) []any { steps, _ := s.Script["steps"].([]any); return steps }

func TestLiveScriptAccess(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	amy := registerCookie(t, env.h, "amy@example.com")

	for _, p := range []struct{ method, path, body string }{
		{http.MethodGet, "/api/live-script", ""},
		{http.MethodPut, "/api/live-script", `{"script":{}}`},
		{http.MethodPost, "/api/live-script/steps", `{"step":{}}`},
		{http.MethodGet, "/api/live-script/events", ""},
	} {
		if rec := call(env.h, p.method, p.path, p.body, nil); rec.Code != http.StatusUnauthorized {
			t.Errorf("訪客 %s %s: %d, want 401", p.method, p.path, rec.Code)
		}
		if rec := call(env.h, p.method, p.path, p.body, amy); rec.Code != http.StatusForbidden {
			t.Errorf("一般會員 %s %s: %d, want 403", p.method, p.path, rec.Code)
		}
	}
	if s := liveSnap(t, call(env.h, http.MethodGet, "/api/live-script", "", boss)); s.Version != 0 || len(stepsOf(s)) != 0 {
		t.Errorf("一開始是空的第 0 版: %+v", s)
	}

	// CLI token(evoleap mcp 用的)和網站登入的管理員是同一個人,看到同一份
	token := cliToken(t, env, boss)
	bearer := map[string]string{"Authorization": "Bearer " + token}
	rec := callHeader(env.h, http.MethodPost, "/api/live-script/steps", `{"step":{"show":"browser"}}`, bearer)
	if s := liveSnap(t, rec); s.Version != 1 {
		t.Errorf("CLI 加一步: %+v", s)
	}
	if s := liveSnap(t, call(env.h, http.MethodGet, "/api/live-script", "", boss)); s.Version != 1 || len(stepsOf(s)) != 1 {
		t.Errorf("網站看到 CLI 改的版本: %+v", s)
	}
}

func TestLiveScriptEdits(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	do := func(method, path, body string) *httptest.ResponseRecorder {
		return call(env.h, method, path, body, boss)
	}

	script := `{"script":{"title":"t","cast":{"b":{"actor":"browser"}},"steps":[{"show":"b"},{"wait":500}]}}`
	if s := liveSnap(t, do(http.MethodPut, "/api/live-script", script)); s.Version != 1 || len(stepsOf(s)) != 2 {
		t.Fatalf("整份取代: %+v", s)
	}
	// 插在第 0 個位置
	s := liveSnap(t, do(http.MethodPost, "/api/live-script/steps", `{"step":{"card":"開場"},"at":0}`))
	if steps := stepsOf(s); len(steps) != 3 || steps[0].(map[string]any)["card"] != "開場" {
		t.Errorf("插入: %v", steps)
	}
	// 改第 3 步:加欄位、null 刪欄位
	s = liveSnap(t, do(http.MethodPatch, "/api/live-script/steps/3", `{"set":{"wait":800,"narration":"等一下"}}`))
	if st := stepsOf(s)[2].(map[string]any); st["wait"] != float64(800) || st["narration"] != "等一下" {
		t.Errorf("改欄位: %v", st)
	}
	s = liveSnap(t, do(http.MethodPatch, "/api/live-script/steps/3", `{"set":{"narration":null}}`))
	if _, ok := stepsOf(s)[2].(map[string]any)["narration"]; ok {
		t.Error("null 要刪掉欄位")
	}
	s = liveSnap(t, do(http.MethodDelete, "/api/live-script/steps/1", ""))
	if len(stepsOf(s)) != 2 || s.Version != 5 {
		t.Errorf("刪第 1 步: %+v", s)
	}

	// 不合規則的修改回 400,訊息說清楚,版本不變
	for _, c := range []struct{ method, path, body, want string }{
		{http.MethodPut, "/api/live-script", `{"script":{"cast":{},"steps":[]}}`, "cast"},
		{http.MethodPut, "/api/live-script", `{"script":{"cast":{"b":{}},"steps":[]}}`, "actor"},
		{http.MethodPut, "/api/live-script", `{"script":{"cast":{"b":{"actor":"browser"}},"steps":[1]}}`, "第 1 步"},
		{http.MethodPut, "/api/live-script", `not json`, "JSON"},
		{http.MethodPost, "/api/live-script/steps", `{"step":{"x":1},"at":9}`, "at"},
		{http.MethodPatch, "/api/live-script/steps/9", `{"set":{"x":1}}`, "第 9 步"},
		{http.MethodPatch, "/api/live-script/steps/1", `{"set":{"show":null}}`, "刪光"},
		{http.MethodDelete, "/api/live-script/steps/0", "", "第 0 步"},
	} {
		rec := do(c.method, c.path, c.body)
		if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), c.want) {
			t.Errorf("%s %s %s: %d %s, want 400 含 %q", c.method, c.path, c.body, rec.Code, rec.Body, c.want)
		}
	}
	if s := liveSnap(t, do(http.MethodGet, "/api/live-script", "")); s.Version != 5 {
		t.Errorf("錯誤的修改不能改到版本: %d", s.Version)
	}

	// 頁面回報載入結果:只收目前的版本,讀腳本時一起回傳
	if rec := do(http.MethodPost, "/api/live-script/report", `{"version":4,"error":"舊的"}`); rec.Code != http.StatusConflict {
		t.Errorf("舊版的回報: %d", rec.Code)
	}
	// 長度可能有小數(舞台算出來的毫秒)
	if rec := do(http.MethodPost, "/api/live-script/report", `{"version":5,"duration":7912.5}`); rec.Code != http.StatusNoContent {
		t.Fatalf("回報長度: %d %s", rec.Code, rec.Body)
	}
	if rec := do(http.MethodPost, "/api/live-script/report", `{"version":5,"error":"第 2 步:演員表裡沒有「x」"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("回報: %d %s", rec.Code, rec.Body)
	}
	if s := liveSnap(t, do(http.MethodGet, "/api/live-script", "")); s.Report == nil || s.Report.Version != 5 || !strings.Contains(s.Report.Error, "演員表") {
		t.Errorf("讀腳本要帶回報: %+v", s.Report)
	}
}

// SSE:連上先收到目前版本,之後每次修改都收到新版本
func TestLiveScriptEvents(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	srv := httptest.NewServer(env.h)
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/live-script/events", nil)
	req.AddCookie(boss)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK || !strings.HasPrefix(res.Header.Get("Content-Type"), "text/event-stream") {
		t.Fatalf("events: %d %s", res.StatusCode, res.Header.Get("Content-Type"))
	}
	lines := make(chan string, 16)
	go func() {
		sc := bufio.NewScanner(res.Body)
		sc.Buffer(make([]byte, 1<<20), 1<<20)
		for sc.Scan() {
			if d, ok := strings.CutPrefix(sc.Text(), "data: "); ok {
				lines <- d
			}
		}
		close(lines)
	}()
	next := func() liveSnapshot {
		t.Helper()
		select {
		case d := <-lines:
			var s liveSnapshot
			if err := json.Unmarshal([]byte(d), &s); err != nil {
				t.Fatalf("推播內容: %s", d)
			}
			return s
		case <-time.After(3 * time.Second):
			t.Fatal("等不到推播")
		}
		return liveSnapshot{}
	}
	if s := next(); s.Version != 0 {
		t.Errorf("連上先收到目前版本: %+v", s)
	}
	if rec := call(env.h, http.MethodPost, "/api/live-script/steps", `{"step":{"show":"browser"}}`, boss); rec.Code != http.StatusOK {
		t.Fatalf("加一步: %d", rec.Code)
	}
	if s := next(); s.Version != 1 || len(stepsOf(s)) != 1 {
		t.Errorf("修改後推新版本: %+v", s)
	}
}
