package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tim72117/evoleap/internal/store"
)

// 兒童模式:家長設定孩子與時段、開啟兒童模式;兒童模式下只給兒童課,而且只在上課時段給(家長是管理員也一樣)
func TestKidsModeFlow(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	dir := t.TempDir()
	for _, p := range []string{"kid.json", "kid2.json", "tool.json"} {
		if err := os.WriteFile(filepath.Join(dir, p), []byte(`{"from":"`+p+`"}`), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	kidsUnits := `[{"id":"0","title":"序章","lessons":[{"id":"0.2","title":"二","status":"open","script":"kid.json"},{"id":"0.3","title":"三","status":"open","script":"kid2.json"}]}]`
	toolUnits := `[{"id":"0","title":"序章","lessons":[{"id":"0.1","title":"一","status":"open","script":"tool.json"}]}]`
	for id, units := range map[string]string{"kids": kidsUnits, "tools": toolUnits} {
		if err := env.st.ReplaceUnitsJSON(id, units); err != nil {
			t.Fatal(err)
		}
	}
	seed := `[{"id":"kids","title":"k","access":"login-free","units":` + kidsUnits + `},{"id":"tools","title":"t","access":"login-free","units":` + toolUnits + `}]`
	if err := env.st.SyncLessonFilesJSON(context.Background(), []byte(seed), dir); err != nil {
		t.Fatal(err)
	}
	// 2026-11-10 是週二,台灣時間 15:30
	at := time.Date(2026, 11, 10, 15, 30, 0, 0, store.KidsZone)
	kidsNow = func() time.Time { return at }
	t.Cleanup(func() { kidsNow = time.Now })

	for _, parent := range []struct {
		name   string
		cookie *http.Cookie
	}{
		{"一般會員", registerCookie(t, env.h, "amy@example.com")},
		{"管理員", env.googleCookie(t, "boss@example.com")},
	} {
		t.Run(parent.name, func(t *testing.T) {
			do := func(method, path, body string, extra ...*http.Cookie) *httptestRec {
				req := newReq(method, path, body)
				req.AddCookie(parent.cookie)
				for _, c := range extra {
					req.AddCookie(c)
				}
				return serve(env.h, req)
			}
			rec := do(http.MethodPost, "/api/kids/children", `{"name":"小花"}`)
			var created struct{ Child store.Child }
			if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &created) != nil {
				t.Fatalf("新增孩子: %d %s", rec.Code, rec.Body)
			}
			id := created.Child.ID
			if rec := do(http.MethodPatch, "/api/kids/children/"+id, `{"minutes":90}`); rec.Code != http.StatusBadRequest {
				t.Errorf("超過 60 分鐘: %d", rec.Code)
			}
			if rec := do(http.MethodPatch, "/api/kids/children/"+id, `{"slots":[{"day":1,"time":"16:00"}],"minutes":30}`); rec.Code != http.StatusOK {
				t.Fatalf("排時段: %d %s", rec.Code, rec.Body)
			}
			if rec := do(http.MethodPatch, "/api/kids/children/"+id, `{"slots":[{"day":1,"time":"1"},{"day":2,"time":"2"},{"day":3,"time":"3"},{"day":4,"time":"4"}]}`); rec.Code != http.StatusBadRequest {
				t.Errorf("超過 3 堂: %d", rec.Code)
			}

			// 還沒開兒童模式:兩門課都照原本的規則拿得到
			for _, p := range []string{"kid.json", "tool.json"} {
				if rec := do(http.MethodGet, "/api/scripts/"+p, ""); rec.Code != http.StatusOK {
					t.Errorf("一般模式 %s: %d", p, rec.Code)
				}
			}
			if rec := do(http.MethodGet, "/api/kids/mode", ""); !strings.Contains(rec.Body.String(), `"active":false`) {
				t.Errorf("還沒開: %s", rec.Body)
			}

			// 開兒童模式:伺服器發 cookie
			rec = do(http.MethodPost, "/api/kids/mode", `{"childId":"`+id+`"}`)
			var kc *http.Cookie
			for _, c := range rec.Result().Cookies() {
				if c.Name == kidsCookie {
					kc = c
				}
			}
			if rec.Code != http.StatusOK || kc == nil || !kc.HttpOnly {
				t.Fatalf("開兒童模式: %d %s", rec.Code, rec.Body)
			}
			if rec := do(http.MethodPost, "/api/kids/mode", `{"childId":"nope"}`); rec.Code != http.StatusNotFound {
				t.Errorf("別人的或不存在的孩子: %d", rec.Code)
			}
			mode := do(http.MethodGet, "/api/kids/mode", "", kc).Body.String()
			if !strings.Contains(mode, `"active":true`) || !strings.Contains(mode, `"open":false`) {
				t.Errorf("兒童模式狀態: %s", mode)
			}

			// 時段外:兒童課也打不開,訊息附下一堂;不是兒童課一律不給
			if rec := do(http.MethodGet, "/api/scripts/kid.json", "", kc); rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "週二 16:00") {
				t.Errorf("時段外的兒童課: %d %s", rec.Code, rec.Body)
			}
			if rec := do(http.MethodGet, "/api/scripts/tool.json", "", kc); rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "kids_only") {
				t.Errorf("兒童模式看其他課: %d %s", rec.Code, rec.Body)
			}
			// 時段內:兒童課打得開
			at = time.Date(2026, 11, 10, 16, 10, 0, 0, store.KidsZone)
			if rec := do(http.MethodGet, "/api/scripts/kid.json", "", kc); rec.Code != http.StatusOK {
				t.Errorf("時段內的兒童課: %d %s", rec.Code, rec.Body)
			}
			if rec := do(http.MethodGet, "/api/scripts/tool.json", "", kc); rec.Code != http.StatusForbidden {
				t.Errorf("時段內也不能看其他課: %d", rec.Code)
			}
			// 還沒輪到的課鎖住(伺服器也擋,不只畫面);看完前一課就打開,看完的課可以重看
			if rec := do(http.MethodGet, "/api/scripts/kid2.json", "", kc); rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "kids_locked") {
				t.Errorf("還沒輪到的課: %d %s", rec.Code, rec.Body)
			}
			if rec := do(http.MethodPut, "/api/progress", `{"lesson":"kids:kid.json","positionMs":59000,"durationMs":60000}`, kc); rec.Code != http.StatusNoContent {
				t.Fatalf("看完第一課: %d %s", rec.Code, rec.Body)
			}
			for _, p := range []string{"kid.json", "kid2.json"} {
				if rec := do(http.MethodGet, "/api/scripts/"+p, "", kc); rec.Code != http.StatusOK {
					t.Errorf("看完前一課後 %s: %d %s", p, rec.Code, rec.Body)
				}
			}
			// 兒童模式中不能改家長的設定(要先離開兒童模式)
			for _, c := range []struct{ method, path, body string }{
				{http.MethodPatch, "/api/kids/children/" + id, `{"slots":[]}`},
				{http.MethodPost, "/api/kids/children", `{"name":"x"}`},
				{http.MethodDelete, "/api/kids/children/" + id, ""},
				{http.MethodPost, "/api/kids/mode", `{"childId":"` + id + `"}`},
			} {
				if rec := do(c.method, c.path, c.body, kc); rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "kids_parent_only") {
					t.Errorf("兒童模式 %s %s: %d %s", c.method, c.path, rec.Code, rec.Body)
				}
			}
			// 家長設定每次 30 分鐘:16:30 之後就關了
			at = time.Date(2026, 11, 10, 16, 35, 0, 0, store.KidsZone)
			if rec := do(http.MethodGet, "/api/scripts/kid.json", "", kc); rec.Code != http.StatusForbidden {
				t.Errorf("超過每次上課的時間: %d", rec.Code)
			}
			at = time.Date(2026, 11, 10, 15, 30, 0, 0, store.KidsZone)

			// 兒童模式的播放進度記在孩子身上,看完記一筆上課紀錄;家長本人的進度不動
			if rec := do(http.MethodPut, "/api/progress", `{"lesson":"kids:kids/0.2.json","positionMs":119000,"durationMs":120000}`, kc); rec.Code != http.StatusNoContent {
				t.Fatalf("兒童模式存進度: %d %s", rec.Code, rec.Body)
			}
			if body := do(http.MethodGet, "/api/progress", "", kc).Body.String(); !strings.Contains(body, "kids/0.2.json") {
				t.Errorf("兒童模式讀到孩子的進度: %s", body)
			}
			if body := do(http.MethodGet, "/api/progress", "").Body.String(); strings.Contains(body, "kids/0.2.json") {
				t.Errorf("家長本人的進度不該有孩子的: %s", body)
			}
			if body := do(http.MethodGet, "/api/kids/children/"+id+"/lessons", "").Body.String(); !strings.Contains(body, `"lesson":"kids:kids/0.2.json"`) {
				t.Errorf("上課紀錄: %s", body)
			}
			// 另一個孩子的進度與紀錄是分開的
			rec = do(http.MethodPost, "/api/kids/children", `{"name":"小明"}`)
			var other struct{ Child store.Child }
			_ = json.Unmarshal(rec.Body.Bytes(), &other)
			if body := do(http.MethodGet, "/api/kids/children/"+other.Child.ID+"/lessons", "").Body.String(); body != `{"lessons":[]}`+"\n" {
				t.Errorf("小明的上課紀錄要是空的: %s", body)
			}
			// 離開兒童模式:cookie 清掉,又照原本的規則
			rec = do(http.MethodDelete, "/api/kids/mode", "", kc)
			cleared := false
			for _, c := range rec.Result().Cookies() {
				cleared = cleared || (c.Name == kidsCookie && c.MaxAge < 0)
			}
			if rec.Code != http.StatusNoContent || !cleared {
				t.Errorf("離開: %d", rec.Code)
			}

			// 別人的兒童 cookie 不算數(只有自己的孩子才進兒童模式)
			otherParent := registerCookie(t, env.h, "x-"+parent.name+"@example.com")
			req := newReq(http.MethodGet, "/api/scripts/tool.json", "")
			req.AddCookie(otherParent)
			req.AddCookie(kc)
			if rec := serve(env.h, req); rec.Code != http.StatusOK {
				t.Errorf("別人的兒童 cookie: %d", rec.Code)
			}
			// 別的家長讀不到這個孩子的上課紀錄
			req = newReq(http.MethodGet, "/api/kids/children/"+id+"/lessons", "")
			req.AddCookie(otherParent)
			if rec := serve(env.h, req); rec.Code != http.StatusNotFound {
				t.Errorf("別人的孩子的上課紀錄: %d", rec.Code)
			}
			if rec := do(http.MethodDelete, "/api/kids/children/"+id, ""); rec.Code != http.StatusNoContent {
				t.Errorf("刪孩子: %d", rec.Code)
			}
		})
	}
	if rec := call(env.h, http.MethodGet, "/api/kids/children", "", nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("訪客: %d", rec.Code)
	}
}

type httptestRec = httptest.ResponseRecorder

func newReq(method, path, body string) *http.Request {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	return req
}

func serve(h http.Handler, req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}
