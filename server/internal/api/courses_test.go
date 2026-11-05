package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// 課程地圖:公開、不用登入
func TestCourseMapAPI(t *testing.T) {
	h := newTestServer(t)
	rec := call(h, http.MethodGet, "/api/courses/kids/map", "", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"id":"0.1"`) {
		t.Fatalf("kids map: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/courses/nope/map", "", nil); rec.Code != http.StatusNotFound {
		t.Errorf("unknown: %d", rec.Code)
	}
}

// 登入功能沒開(沒有 Signer)時課程地圖照常回傳;沒接資料庫才回 503
func TestCourseMapWithoutAuth(t *testing.T) {
	st := openTestStore(t)
	rec := call(New(Config{Store: st}).Routes(), http.MethodGet, "/api/courses/kids/map", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("no signer: %d %s", rec.Code, rec.Body)
	}
	if rec := call(New(Config{}).Routes(), http.MethodGet, "/api/courses/kids/map", "", nil); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("no store: %d", rec.Code)
	}
}

// 草稿的課:訪客看到規劃中、沒有腳本;管理員(本機 -open-studio)看得到草稿與腳本;有草稿的課不快取
func TestCourseMapDrafts(t *testing.T) {
	st := openTestStore(t)
	if err := st.ReplaceUnitsJSON("tools", `[{"id":"0","title":"序章","lessons":[{"id":"0.1","title":"一","status":"draft","script":"x/0.1.json"}]}]`); err != nil {
		t.Fatal(err)
	}
	guest := call(New(Config{Store: st}).Routes(), http.MethodGet, "/api/courses/tools/map", "", nil)
	if guest.Code != http.StatusOK || strings.Contains(guest.Body.String(), `"draft"`) || strings.Contains(guest.Body.String(), "launch/1.1.json") {
		t.Fatalf("guest: %d %s", guest.Code, guest.Body)
	}
	if cc := guest.Header().Get("Cache-Control"); cc != "private, no-store" {
		t.Errorf("guest cache: %q", cc)
	}
	admin := call(New(Config{Store: st, OpenAdmin: true}).Routes(), http.MethodGet, "/api/courses/tools/map", "", nil)
	if !strings.Contains(admin.Body.String(), `"status":"draft","script":"x/0.1.json"`) {
		t.Fatalf("admin: %s", admin.Body)
	}
	if cc := admin.Header().Get("Cache-Control"); cc != "private, no-store" {
		t.Errorf("admin cache: %q", cc)
	}
	// 沒有草稿的課照舊可以共用快取
	if cc := call(New(Config{Store: st}).Routes(), http.MethodGet, "/api/courses/web/map", "", nil).Header().Get("Cache-Control"); cc != "public, max-age=60" {
		t.Errorf("web cache: %q", cc)
	}
}

func courseAccessBody(t *testing.T, h http.Handler, course string, cookie *http.Cookie) courseAccessResponse {
	t.Helper()
	var body courseAccessResponse
	rec := call(h, http.MethodGet, "/api/courses/"+course+"/access", "", cookie)
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	return body
}

func TestCourseAccess(t *testing.T) {
	h, _ := newPaddleServer(t)
	amy, amyID := registerUser(t, h, "amy@example.com")
	check := func(name, course string, cookie *http.Cookie, allowed bool, reason string) {
		t.Helper()
		rec := call(h, http.MethodGet, "/api/courses/"+course+"/access", "", cookie)
		var body courseAccessResponse
		if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &body) != nil {
			t.Fatalf("%s: %d %s", name, rec.Code, rec.Body)
		}
		if body.Allowed != allowed || body.Reason != reason {
			t.Errorf("%s: %+v", name, body)
		}
	}
	check("序章免登入、其餘登入後免費的課程未登入", "tools", nil, false, "login_required")
	check("登入後免費未登入", "ai-tools", nil, false, "login_required")
	check("登入後免費已登入", "ai-tools", amy, true, "")
	check("訂閱課程未登入", "vibe-coding-basics", nil, false, "login_required")
	check("訂閱課程未訂閱", "vibe-coding-basics", amy, false, "subscription_required")

	deliver(t, h, subscriptionEvent("active", amyID, "pri_sub"))
	check("基礎方案看基礎課", "vibe-coding-basics", amy, true, "")
	check("基礎方案不能看進階課", "ai-agent", amy, false, "subscription_required")
	if body := courseAccessBody(t, h, "ai-agent", amy); body.Plan != "進階方案" {
		t.Errorf("要說明需要的方案: %+v", body)
	}

	deliver(t, h, withEventID(strings.Replace(subscriptionEvent("active", amyID, "pri_adv"), "T08:00", "T08:30", 1), "evt_upgrade"))
	check("升級後看進階課", "ai-agent", amy, true, "")
	check("進階方案包含基礎課", "vibe-coding-basics", amy, true, "")
	var me struct {
		CurrentTier  string `json:"currentTier"`
		Subscription struct {
			PriceID string `json:"priceId"`
		} `json:"subscription"`
	}
	if err := json.Unmarshal(call(h, http.MethodGet, "/api/plan/me", "", amy).Body.Bytes(), &me); err != nil || me.CurrentTier != "advanced" || me.Subscription.PriceID != "pri_adv" {
		t.Errorf("換方案後要記下新的價格: %+v %v", me, err)
	}

	deliver(t, h, `{"event_id":"evt_c","event_type":"subscription.updated","occurred_at":"2026-11-05T09:00:00Z","data":{"id":"sub_1","status":"canceled","custom_data":null,"items":[{"price":{"id":"pri_sub"}}]}}`)
	check("取消後", "vibe-coding-basics", amy, false, "subscription_required")

	if rec := call(h, http.MethodGet, "/api/courses/none/access", "", nil); rec.Code != http.StatusNotFound {
		t.Errorf("沒有這門課: %d", rec.Code)
	}
}
