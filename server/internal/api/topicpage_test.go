package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/tim72117/evoleap/internal/store"
)

// 主題頁區塊 API:公開讀取;只有管理員能改;區塊與項目的增改排序刪除走得通,刪項目連子項目
func TestTopicPageAPI(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	amy := registerCookie(t, env.h, "amy@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	if rec := call(env.h, http.MethodPost, "/api/admin/topics/software/sections", `{"id":"x","kind":"cards"}`, amy); rec.Code != http.StatusForbidden {
		t.Errorf("會員: %d", rec.Code)
	}
	if rec := call(env.h, http.MethodGet, "/api/topics/nope/page", "", nil); rec.Code != http.StatusNotFound {
		t.Errorf("不存在的主題: %d", rec.Code)
	}
	ok := func(method, path, body string) {
		t.Helper()
		if rec := call(env.h, method, path, body, boss); rec.Code != http.StatusOK {
			t.Fatalf("%s %s: %d %s", method, path, rec.Code, rec.Body)
		}
	}
	page := func() []store.PageSection {
		t.Helper()
		rec := call(env.h, http.MethodGet, "/api/topics/demo/page", "", nil)
		var out struct{ Sections []store.PageSection }
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil || rec.Code != http.StatusOK {
			t.Fatalf("page: %d %v", rec.Code, err)
		}
		return out.Sections
	}
	ok("POST", "/api/admin/topics", `{"id":"demo","name":"示範"}`)
	ok("POST", "/api/admin/topics/demo/sections", `{"id":"a","kind":"lists"}`)
	ok("POST", "/api/admin/topics/demo/sections", `{"id":"b","kind":"cards","at":1}`)
	ok("PATCH", "/api/admin/topics/demo/sections/b", `{"title":"標題"}`)
	ok("PUT", "/api/admin/topics/demo/section-order", `{"ids":["a","b"]}`)
	ok("POST", "/api/admin/topics/demo/blocks", `{"section":"a","variant":"fit"}`)
	parent := page()[0].Blocks[0].ID
	ok("POST", "/api/admin/topics/demo/blocks", `{"section":"a","parent":"`+parent+`","text":"一"}`)
	ok("POST", "/api/admin/topics/demo/blocks", `{"section":"a","parent":"`+parent+`","text":"二","at":1}`)
	kids := page()[0].Blocks[0].Children
	if len(kids) != 2 || kids[0].Text != "二" {
		t.Fatalf("children: %+v", kids)
	}
	ok("PUT", "/api/admin/topics/demo/block-order", `{"section":"a","parent":"`+parent+`","ids":["`+kids[1].ID+`","`+kids[0].ID+`"]}`)
	ok("PATCH", "/api/admin/topics/demo/blocks/"+kids[0].ID, `{"text":"二改"}`)
	if got := page()[0].Blocks[0].Children; got[0].Text != "一" || got[1].Text != "二改" {
		t.Fatalf("排序/修改: %+v", got)
	}
	for _, bad := range []struct{ path, body string }{
		{"/api/admin/topics/demo/sections", `{"id":"a","kind":"lists"}`},
		{"/api/admin/topics/demo/sections", `{"id":"c","kind":"oops"}`},
		{"/api/admin/topics/demo/blocks", `{"section":"a"}`},
		{"/api/admin/topics/demo/blocks", `{"section":"a","parent":"` + kids[0].ID + `","text":"孫"}`},
	} {
		if rec := call(env.h, http.MethodPost, bad.path, bad.body, boss); rec.Code != http.StatusBadRequest {
			t.Errorf("%s %s 要擋下: %d", bad.path, bad.body, rec.Code)
		}
	}
	ok("POST", "/api/admin/topics/demo/sections", `{"id":"map","kind":"levels"}`)
	for _, bad := range []struct{ path, body string }{
		{"/api/admin/topics/demo/sections", `{"id":"other","kind":"levels"}`},
		{"/api/admin/topics/demo/sections", `{"id":"units","kind":"units"}`},
		{"/api/admin/topics/demo/sections", `{"id":"units","kind":"units","source":"no-such"}`},
		{"/api/admin/topics/demo/blocks", `{"section":"map","text":"沒有 ref"}`},
		{"/api/admin/topics/demo/blocks", `{"section":"map","ref":"no-such"}`},
		{"/api/admin/topics/demo/blocks", `{"section":"map","ref":"software","variant":"agnet"}`},
	} {
		if rec := call(env.h, http.MethodPost, bad.path, bad.body, boss); rec.Code != http.StatusBadRequest {
			t.Errorf("%s %s 要擋下: %d %s", bad.path, bad.body, rec.Code, rec.Body)
		}
	}
	ok("DELETE", "/api/admin/topics/demo/sections/map", "")
	ok("DELETE", "/api/admin/topics/demo/blocks/"+parent, "")
	if got := page()[0].Blocks; len(got) != 0 {
		t.Fatalf("刪項目: %+v", got)
	}
	ok("DELETE", "/api/admin/topics/demo/sections/a", "")
	if got := page(); len(got) != 1 || got[0].Title != "標題" {
		t.Fatalf("刪區塊: %+v", got)
	}
	ok("DELETE", "/api/admin/topics/demo", "")
}
