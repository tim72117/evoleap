package api

import (
	"net/http"
	"strings"
	"testing"
)

func TestMeUpdateName(t *testing.T) {
	h := newTestServer(t)

	if rec := call(h, http.MethodPatch, "/api/me", `{"name":"Bob"}`, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("update without login: %d %s", rec.Code, rec.Body)
	}

	rec := call(h, http.MethodPost, "/api/auth/register", `{"email":"amy@example.com","password":"secret123","name":"Amy"}`, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("register: %d %s", rec.Code, rec.Body)
	}
	cookie := sessionFrom(t, rec)
	if !strings.Contains(rec.Body.String(), `"google":false`) {
		t.Fatalf("register body lacks google flag: %s", rec.Body)
	}

	rec = call(h, http.MethodPatch, "/api/me", `{"name":"  小美  "}`, cookie)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":"小美"`) {
		t.Fatalf("update name: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/me", "", cookie); !strings.Contains(rec.Body.String(), `"name":"小美"`) {
		t.Fatalf("me after update: %s", rec.Body)
	}

	for _, body := range []string{
		`{"name":"   "}`,
		`{"name":"` + strings.Repeat("字", 51) + `"}`,
		`{"name":"a\u0000b"}`,
		`{"name":"a\nb"}`,
		`{"name":"a\tb"}`,
		`{"name":"​"}`,           // 只有零寬空白:看起來是空的
		`{"name":"　"}`,           // 全形空白
		`{"name":"Amy‮gnp.exe"}`, // 方向控制字元:在後台倒著顯示
	} {
		if rec := call(h, http.MethodPatch, "/api/me", body, cookie); rec.Code != http.StatusBadRequest {
			t.Errorf("invalid name %q: %d %s", body, rec.Code, rec.Body)
		}
	}

	// 沒帶欄位:什麼都不改,回目前的資料
	if rec := call(h, http.MethodPatch, "/api/me", `{}`, cookie); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":"小美"`) {
		t.Fatalf("empty update: %d %s", rec.Code, rec.Body)
	}
	// Email 不能從這裡改
	if rec := call(h, http.MethodPatch, "/api/me", `{"email":"other@example.com"}`, cookie); !strings.Contains(rec.Body.String(), `"email":"amy@example.com"`) {
		t.Fatalf("email changed: %s", rec.Body)
	}
}
