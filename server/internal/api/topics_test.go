package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestTopicsAPI(t *testing.T) {
	h := newTestServer(t)
	rec := call(h, http.MethodGet, "/api/topics", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("list: %d %s", rec.Code, rec.Body)
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "public, max-age=60" {
		t.Errorf("cache: %q", cc)
	}
	var list struct {
		Topics []struct {
			ID      string          `json:"id"`
			Content json.RawMessage `json:"content"`
			Courses []struct {
				ID string `json:"id"`
			} `json:"courses"`
		} `json:"topics"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list.Topics) != 7 {
		t.Fatalf("topics: %d", len(list.Topics))
	}
	for _, tp := range list.Topics {
		if len(tp.Courses) == 0 || len(tp.Content) == 0 || tp.Content[0] != '{' {
			t.Errorf("%s: courses %d content %s", tp.ID, len(tp.Courses), tp.Content)
		}
	}

	one := call(h, http.MethodGet, "/api/topics/ai-apps", "", nil)
	if one.Code != http.StatusOK || !strings.Contains(one.Body.String(), `"id":"ai-agent"`) || !strings.Contains(one.Body.String(), `"topicPath":"/topics/ai-apps"`) {
		t.Fatalf("one: %d %s", one.Code, one.Body)
	}
	nf := call(h, http.MethodGet, "/api/topics/nope", "", nil)
	if nf.Code != http.StatusNotFound || !strings.Contains(nf.Body.String(), "找不到這個主題") {
		t.Errorf("unknown: %d %s", nf.Code, nf.Body)
	}
	if rec := call(New(Config{}).Routes(), http.MethodGet, "/api/topics", "", nil); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("no store: %d", rec.Code)
	}
}
