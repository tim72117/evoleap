package api

import (
	"encoding/json"
	"net/http"
	"testing"
)

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
	check("免費未登入", "tools", nil, true, "")
	check("登入後免費未登入", "ai-tools", nil, false, "login_required")
	check("登入後免費已登入", "ai-tools", amy, true, "")
	check("訂閱課程未登入", "vibe-coding-basics", nil, false, "login_required")
	check("訂閱課程未訂閱", "vibe-coding-basics", amy, false, "subscription_required")

	deliver(t, h, subscriptionEvent("active", amyID, "pri_sub"))
	check("訂閱課程已訂閱", "vibe-coding-basics", amy, true, "")

	deliver(t, h, `{"event_id":"evt_c","event_type":"subscription.updated","occurred_at":"2026-11-05T09:00:00Z","data":{"id":"sub_1","status":"canceled","custom_data":null,"items":[{"price":{"id":"pri_sub"}}]}}`)
	check("取消後", "vibe-coding-basics", amy, false, "subscription_required")

	if rec := call(h, http.MethodGet, "/api/courses/none/access", "", nil); rec.Code != http.StatusNotFound {
		t.Errorf("沒有這門課: %d", rec.Code)
	}
}
