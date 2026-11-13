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

func TestMeUpdateLocale(t *testing.T) {
	h := newTestServer(t)
	rec := call(h, http.MethodPost, "/api/auth/register", `{"email":"amy@example.com","password":"secret123","name":"Amy"}`, nil)
	cookie := sessionFrom(t, rec)
	if !strings.Contains(rec.Body.String(), `"locale":""`) {
		t.Fatalf("new user should have no locale: %s", rec.Body)
	}
	if rec := call(h, http.MethodPatch, "/api/me", `{"locale":"en"}`, cookie); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"locale":"en"`) {
		t.Fatalf("set locale: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/me", "", cookie); !strings.Contains(rec.Body.String(), `"locale":"en"`) {
		t.Fatalf("me after locale: %s", rec.Body)
	}
	if rec := call(h, http.MethodPatch, "/api/me", `{"locale":"fr"}`, cookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("unsupported locale: %d %s", rec.Code, rec.Body)
	}
	// 名稱不合格時語言也不改
	if rec := call(h, http.MethodPatch, "/api/me", `{"locale":"zh-Hant","name":"   "}`, cookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad name: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/me", "", cookie); !strings.Contains(rec.Body.String(), `"locale":"en"`) {
		t.Fatalf("locale changed despite bad name: %s", rec.Body)
	}
}

// 名稱與語言一起改:同一個請求兩個都生效(同一個 UPDATE,不會只改到一個)
func TestMeUpdateNameAndLocale(t *testing.T) {
	h := newTestServer(t)
	rec := call(h, http.MethodPost, "/api/auth/register", `{"email":"bea@example.com","password":"secret123","name":"Bea"}`, nil)
	cookie := sessionFrom(t, rec)
	rec = call(h, http.MethodPatch, "/api/me", `{"name":"小蜜","locale":"en"}`, cookie)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":"小蜜"`) || !strings.Contains(rec.Body.String(), `"locale":"en"`) {
		t.Fatalf("name and locale: %d %s", rec.Code, rec.Body)
	}
	// 只改名稱:語言留著;只改語言:名稱留著
	if rec := call(h, http.MethodPatch, "/api/me", `{"name":"小花"}`, cookie); !strings.Contains(rec.Body.String(), `"locale":"en"`) || !strings.Contains(rec.Body.String(), `"name":"小花"`) {
		t.Fatalf("name only: %s", rec.Body)
	}
	if rec := call(h, http.MethodPatch, "/api/me", `{"locale":"zh-Hant"}`, cookie); !strings.Contains(rec.Body.String(), `"name":"小花"`) || !strings.Contains(rec.Body.String(), `"locale":"zh-Hant"`) {
		t.Fatalf("locale only: %s", rec.Body)
	}
}
