package api

import (
	"net/http"
	"strings"
	"testing"
)

// 草稿:存了不影響正式版本;只有管理員用 ?draft=1 看得到;主腳本連旁白清單一起發布;正式版本被改過就擋下
func TestScriptDrafts(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	amy := registerCookie(t, env.h, "amy@example.com")

	expect := func(method, url, body string, cookie *http.Cookie, code int, contains string) {
		t.Helper()
		rec := call(env.h, method, url, body, cookie)
		if rec.Code != code || !strings.Contains(rec.Body.String(), contains) {
			t.Fatalf("%s %s: %d %s(要 %d、含 %q)", method, url, rec.Code, rec.Body, code, contains)
		}
	}

	expect("PUT", "/api/admin/scripts/lab/a.json", `{"v":"live"}`, boss, 200, "")
	expect("PUT", "/api/admin/script-drafts/lab/a.json", `{"v":"draft"}`, amy, 403, "")
	expect("PUT", "/api/admin/script-drafts/lab/a.json", `{"v":"draft"}`, boss, 200, `"stale":false`)
	expect("PUT", "/api/admin/script-drafts/lab/a.voice.json", `{"v":"voice"}`, boss, 200, `"new":true`)

	expect("GET", "/api/scripts/lab/a.json", "", boss, 200, "live")
	expect("GET", "/api/scripts/lab/a.json?draft=1", "", boss, 200, "draft")
	expect("GET", "/api/scripts/lab/a.json?draft=1", "", amy, 404, "")

	// 正式版本在草稿之後改過:整組都不發布
	expect("PUT", "/api/admin/scripts/lab/a.json", `{"v":"other"}`, boss, 200, "")
	expect("GET", "/api/admin/script-drafts", "", boss, 200, `"stale":true`)
	expect("POST", "/api/admin/script-publish", `{"paths":["lab/a.json"]}`, boss, 409, "lab/a.json")
	expect("GET", "/api/scripts/lab/a.voice.json", "", boss, 200, "null")

	expect("POST", "/api/admin/script-publish", `{"paths":["lab/a.json"],"force":true}`, boss, 200, "lab/a.voice.json")
	expect("GET", "/api/scripts/lab/a.json", "", boss, 200, "draft")
	expect("GET", "/api/scripts/lab/a.voice.json", "", boss, 200, "voice")
	expect("GET", "/api/admin/script-drafts", "", boss, 200, `"drafts":[]`)

	// 丟掉草稿不影響正式版本
	expect("PUT", "/api/admin/script-drafts/lab/a.json", `{"v":"x"}`, boss, 200, "")
	expect("DELETE", "/api/admin/script-drafts/lab/a.json", "", boss, 200, "")
	expect("DELETE", "/api/admin/script-drafts/lab/a.json", "", boss, 404, "")
	expect("GET", "/api/scripts/lab/a.json?draft=1", "", boss, 200, "draft")

	// 草稿指定的課不存在
	expect("PUT", "/api/admin/script-drafts/lab/b.json?course=software&lesson=nope", `{}`, boss, 400, "")
}
