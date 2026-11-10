package main

import (
	"bufio"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// 假的 API:記下收到的請求,回固定的腳本;report 在第二次讀取時才出現(模擬頁面晚一點回報)
func fakeLiveAPI(t *testing.T) (*httptest.Server, *[]string) {
	t.Helper()
	var got []string
	reads := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer evc_test" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		b, _ := io.ReadAll(r.Body)
		got = append(got, r.Method+" "+r.URL.Path+" "+string(b))
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPatch && strings.HasSuffix(r.URL.Path, "/9"):
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error":"invalid_script","message":"沒有第 9 步(目前共 1 步,從 1 算起)"}`))
		case r.Method == http.MethodGet:
			reads++
			report := `null`
			if reads >= 2 {
				report = `{"version":3,"error":"第 1 步:演員表裡沒有「x」","at":"2026-01-01T00:00:00Z"}`
			}
			w.Write([]byte(`{"version":3,"script":{"cast":{},"steps":[]},"report":` + report + `}`))
		default:
			w.Write([]byte(`{"version":3,"script":{"cast":{},"steps":[{}]},"report":null}`))
		}
	}))
	t.Cleanup(srv.Close)
	return srv, &got
}

// 送一串 JSON-RPC 進 MCP,回傳每則回應(依 id)
func runLines(t *testing.T, c *client, lines ...string) map[string]map[string]any {
	t.Helper()
	var out strings.Builder
	if err := runMCP(c, strings.NewReader(strings.Join(lines, "\n")+"\n"), &out); err != nil {
		t.Fatal(err)
	}
	res := map[string]map[string]any{}
	sc := bufio.NewScanner(strings.NewReader(out.String()))
	for sc.Scan() {
		var m map[string]any
		if err := json.Unmarshal(sc.Bytes(), &m); err != nil {
			t.Fatalf("stdout 只能有 JSON-RPC: %q", sc.Text())
		}
		id, _ := json.Marshal(m["id"])
		res[string(id)] = m
	}
	return res
}

func textOf(t *testing.T, r map[string]any) (string, bool) {
	t.Helper()
	result, _ := r["result"].(map[string]any)
	content, _ := result["content"].([]any)
	if len(content) != 1 {
		t.Fatalf("工具回應沒有內容: %v", r)
	}
	isErr, _ := result["isError"].(bool)
	return content[0].(map[string]any)["text"].(string), isErr
}

func TestMCPProtocol(t *testing.T) {
	srv, got := fakeLiveAPI(t)
	c := &client{api: srv.URL, token: "evc_test", http: &http.Client{Timeout: 5 * time.Second}}
	res := runLines(t, c,
		`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test"}}}`,
		`{"jsonrpc":"2.0","method":"notifications/initialized"}`,
		`{"jsonrpc":"2.0","id":2,"method":"tools/list"}`,
		`{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"set_live_script","arguments":{"script":{"cast":{"b":{"actor":"browser"}},"steps":[]}}}}`,
		`{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"add_live_step","arguments":{"step":{"show":"b"},"at":0}}}`,
		`{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"update_live_step","arguments":{"n":9,"set":{"ms":100}}}}`,
		`{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"remove_live_step","arguments":{}}}`,
		`{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"nope"}}`,
		`{"jsonrpc":"2.0","id":8,"method":"nope"}`,
		`not json`,
	)
	init := res["1"]["result"].(map[string]any)
	if init["protocolVersion"] != "2025-03-26" || init["serverInfo"].(map[string]any)["name"] != "evoleap" {
		t.Errorf("initialize: %v", init)
	}
	if _, ok := res["null"]; !ok {
		t.Error("JSON 解析失敗要回 parse error")
	}
	tools := res["2"]["result"].(map[string]any)["tools"].([]any)
	var names []string
	for _, x := range tools {
		names = append(names, x.(map[string]any)["name"].(string))
	}
	if strings.Join(names, ",") != "get_live_script,set_live_script,add_live_step,update_live_step,remove_live_step,wait_live_report" {
		t.Errorf("tools: %v", names)
	}
	if text, isErr := textOf(t, res["3"]); isErr || !strings.Contains(text, `"version":3`) {
		t.Errorf("set_live_script: %s", text)
	}
	if text, isErr := textOf(t, res["5"]); !isErr || !strings.Contains(text, "沒有第 9 步") {
		t.Errorf("後端的錯誤訊息要原樣交給 AI(isError): %s", text)
	}
	if text, isErr := textOf(t, res["6"]); !isErr || !strings.Contains(text, "要寫 n") {
		t.Errorf("缺參數: %s", text)
	}
	if res["7"]["error"] == nil || res["8"]["error"].(map[string]any)["code"] != float64(-32601) {
		t.Errorf("不認得的工具與方法要回錯誤: %v %v", res["7"], res["8"])
	}
	want := []string{
		`PUT /api/live-script {"script":{"cast":{"b":{"actor":"browser"}},"steps":[]}}`,
		`POST /api/live-script/steps {"at":0,"step":{"show":"b"}}`,
		`PATCH /api/live-script/steps/9 {"set":{"ms":100}}`,
	}
	if strings.Join(*got, "\n") != strings.Join(want, "\n") {
		t.Errorf("送到後端的請求:\n%s\nwant\n%s", strings.Join(*got, "\n"), strings.Join(want, "\n"))
	}
}

func TestMCPWaitReport(t *testing.T) {
	srv, _ := fakeLiveAPI(t)
	c := &client{api: srv.URL, token: "evc_test", http: &http.Client{Timeout: 5 * time.Second}}
	res := runLines(t, c, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"wait_live_report","arguments":{"timeout_ms":3000}}}`)
	text, isErr := textOf(t, res["1"])
	if isErr || !strings.Contains(text, `"ok":false`) || !strings.Contains(text, "演員表裡沒有") {
		t.Errorf("等到頁面回報: %s", text)
	}
	// 沒有登入:訊息叫人先 evoleap login
	res = runLines(t, &client{api: srv.URL, http: http.DefaultClient}, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_live_script"}}`)
	if text, isErr := textOf(t, res["1"]); !isErr || !strings.Contains(text, "evoleap login") {
		t.Errorf("沒登入: %s", text)
	}
}
