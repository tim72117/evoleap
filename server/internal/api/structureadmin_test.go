package api

import (
	"encoding/json"
	"net/http"
	"testing"
)

// 課程結構 API:只給管理員;新增、改單元、排大綱、刪除走得通,不認得的欄位擋下
func TestCourseStructureAPI(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	amy := registerCookie(t, env.h, "amy@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	course := `{"id":"demo","title":"示範","access":"free"}`
	if rec := call(env.h, http.MethodPost, "/api/admin/courses", course, amy); rec.Code != http.StatusForbidden {
		t.Errorf("會員: %d", rec.Code)
	}
	for _, c := range []struct{ method, path, body string }{
		{"POST", "/api/admin/courses", course},
		{"POST", "/api/admin/courses/demo/units", `{"id":"a","title":"甲"}`},
		{"PATCH", "/api/admin/courses/demo/units/a", `{"title":"甲改"}`},
		{"POST", "/api/admin/courses/demo/lessons", `{"id":"1.1","unitId":"a","title":"一"}`},
		{"PUT", "/api/admin/courses/demo/outline", `{"units":[{"id":"a","lessons":["1.1"]}]}`},
		{"DELETE", "/api/admin/courses/demo/lessons/1.1", ""},
		{"DELETE", "/api/admin/courses/demo/units/a", ""},
		{"DELETE", "/api/admin/courses/demo", ""},
	} {
		if rec := call(env.h, c.method, c.path, c.body, boss); rec.Code != http.StatusOK {
			t.Errorf("%s %s: %d %s", c.method, c.path, rec.Code, rec.Body)
		}
	}
	if rec := call(env.h, http.MethodPost, "/api/admin/courses", `{"id":"x","title":"x","access":"free","oops":1}`, boss); rec.Code != http.StatusBadRequest {
		t.Errorf("不認得的欄位: %d", rec.Code)
	}
}

// 主題 API:只給管理員;新增主題、項目的增改排序刪除、排主題、刪主題走得通
func TestTopicAdminAPI(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	amy := registerCookie(t, env.h, "amy@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	if rec := call(env.h, http.MethodPost, "/api/admin/topics", `{"id":"demo","name":"示範"}`, amy); rec.Code != http.StatusForbidden {
		t.Errorf("會員: %d", rec.Code)
	}
	ok := func(method, path, body string) string {
		t.Helper()
		rec := call(env.h, method, path, body, boss)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s %s: %d %s", method, path, rec.Code, rec.Body)
		}
		return rec.Body.String()
	}
	ok("POST", "/api/admin/topics", `{"id":"demo","name":"示範"}`)
	var topic struct{ Items []struct{ ID string } }
	if err := json.Unmarshal([]byte(ok("POST", "/api/admin/topics/demo/items", `{"kind":"flow","text":"一"}`)), &topic); err != nil || len(topic.Items) != 1 {
		t.Fatalf("items: %+v %v", topic, err)
	}
	item := topic.Items[0].ID
	ok("PATCH", "/api/admin/topics/demo/items/"+item, `{"text":"一改"}`)
	ok("PUT", "/api/admin/topics/demo/item-order", `{"kind":"flow","ids":["`+item+`"]}`)
	ok("DELETE", "/api/admin/topics/demo/items/"+item, "")
	var list struct{ Topics []struct{ ID string } }
	if err := json.Unmarshal([]byte(ok("GET", "/api/admin/topics", "")), &list); err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, tp := range list.Topics {
		ids = append([]string{tp.ID}, ids...)
	}
	body, _ := json.Marshal(map[string]any{"ids": ids})
	ok("PUT", "/api/admin/topic-order", string(body))
	ok("DELETE", "/api/admin/topics/demo", "")
	if rec := call(env.h, http.MethodPost, "/api/admin/topics", `{"id":"x","name":"x","oops":1}`, boss); rec.Code != http.StatusBadRequest {
		t.Errorf("不認得的欄位: %d", rec.Code)
	}
}
