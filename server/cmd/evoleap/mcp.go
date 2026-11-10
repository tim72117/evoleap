package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"time"
)

// evoleap mcp:把 CLI 變成 MCP server(stdio,一行一則 JSON-RPC 2.0),讓 Claude Code 等 AI 工具操作「即時腳本」:
// 改後端的臨時腳本(/api/live-script,見 server/internal/api/livescript.go),研發基地的 /studio/live-script 同時照著演。
// 登入沿用 evoleap login 存的 token(依 -api 的主機分開),所以要先以管理員登入。
//
// 加進 Claude Code(本機開發):
//
//	claude mcp add evoleap -- evoleap -api http://localhost:8190 mcp
//
// stdout 只能放 JSON-RPC 的訊息,其他訊息一律寫 stderr。

const mcpProtocolVersion = "2025-06-18"

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

// mcpTool 是一個工具:name、說明、參數的 JSON Schema,以及執行的函式(回傳給 AI 的文字)
type mcpTool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
	run         func(c *client, args map[string]any) (string, error)
}

const liveScriptFormat = `腳本格式(JSON,和 web/src/live/ 的即時教學畫面相同,規格見 web/src/live/README.md):
{"title": "標題", "cast": {"<演員代號>": {"actor": "<演員名稱>", "props": {...}, "place": {"x":0,"y":0,"w":1920,"h":1080}, "hidden": true}}, "steps": [ 一步一個動作 ]}
- 舞台是 1920×1080;cast 至少一位演員。常用演員:browser(瀏覽器)、claude-desktop、chat(手機聊天)、person(人物)、notes(便條)、editor(程式編輯器)、finder,兒童課有 kid-web、kid-tree、lt8-kid-page 等。
- 舞台的動作:{"show": "<代號>"} 出場、{"hide": "<代號>"} 退場、{"card": "章節卡文字"}、{"callout": "<代號>:<目標>", "text": "說明"}、{"wait": 毫秒}、{"move": ...}。
- 演員的動作:用演員會的動作名稱當 key,例如 browser 的 {"site": "...", "on": "<代號>"};只有一位演員會這個動作時可以省略 on。
- 任何一步都可以加 "narration"(旁白字幕)、"chapter"(章節名稱)、"ms"(這一步的長度)。
寫錯的動作(演員不認得、狀態對不上)不會被後端擋下,頁面載入時才知道:改完用 wait_live_report 看結果,錯了照訊息修。`

func liveTools() []mcpTool {
	obj := func(props map[string]any, required ...string) map[string]any {
		s := map[string]any{"type": "object", "properties": props}
		if len(required) > 0 {
			s["required"] = required
		}
		return s
	}
	stepNum := map[string]any{"type": "integer", "minimum": 1, "description": "第幾步(從 1 算起)"}
	return []mcpTool{
		{
			Name:        "get_live_script",
			Description: "讀目前的即時腳本:版本(version)、整份腳本(script),以及研發基地頁面回報的載入結果(report:這一版有沒有演出來、錯在哪)。修改前先讀。\n\n" + liveScriptFormat,
			InputSchema: obj(map[string]any{}),
			run: func(c *client, _ map[string]any) (string, error) {
				return liveCall(c, "GET", "/api/live-script", nil)
			},
		},
		{
			Name:        "set_live_script",
			Description: "整份取代即時腳本(從零開始或大改時用)。研發基地的 /studio/live-script 會立刻照新腳本演出。\n\n" + liveScriptFormat,
			InputSchema: obj(map[string]any{"script": map[string]any{"type": "object", "description": "整份腳本:{title, cast, steps}"}}, "script"),
			run: func(c *client, args map[string]any) (string, error) {
				return liveCall(c, "PUT", "/api/live-script", map[string]any{"script": args["script"]})
			},
		},
		{
			Name:        "add_live_step",
			Description: "在即時腳本插入一步(省略 at 就加在最後)。頁面會立刻多演這一步。",
			InputSchema: obj(map[string]any{
				"step": map[string]any{"type": "object", "description": "一步的內容,例如 {\"show\": \"b\", \"narration\": \"打開瀏覽器\"}"},
				"at":   map[string]any{"type": "integer", "minimum": 0, "description": "插在第幾個位置(0 是最前面;省略就加在最後)"},
			}, "step"),
			run: func(c *client, args map[string]any) (string, error) {
				body := map[string]any{"step": args["step"]}
				if at, ok := args["at"]; ok {
					body["at"] = at
				}
				return liveCall(c, "POST", "/api/live-script/steps", body)
			},
		},
		{
			Name:        "update_live_step",
			Description: "改即時腳本的某一步:set 裡的欄位會寫進那一步,值寫 null 代表刪掉那個欄位(例如調 ms、改 narration)。",
			InputSchema: obj(map[string]any{
				"n":   stepNum,
				"set": map[string]any{"type": "object", "description": "要改的欄位,例如 {\"ms\": 1500, \"narration\": null}"},
			}, "n", "set"),
			run: func(c *client, args map[string]any) (string, error) {
				n, err := intArg(args, "n")
				if err != nil {
					return "", err
				}
				return liveCall(c, "PATCH", "/api/live-script/steps/"+strconv.Itoa(n), map[string]any{"set": args["set"]})
			},
		},
		{
			Name:        "remove_live_step",
			Description: "刪掉即時腳本的某一步。",
			InputSchema: obj(map[string]any{"n": stepNum}, "n"),
			run: func(c *client, args map[string]any) (string, error) {
				n, err := intArg(args, "n")
				if err != nil {
					return "", err
				}
				return liveCall(c, "DELETE", "/api/live-script/steps/"+strconv.Itoa(n), nil)
			},
		},
		{
			Name:        "wait_live_report",
			Description: "等研發基地的 /studio/live-script 回報某一版的載入結果(成功時有長度 duration,失敗時有 error 指出第幾步錯在哪)。改完腳本後用它確認有沒有演出來;沒有人開著那一頁時會等到逾時。",
			InputSchema: obj(map[string]any{
				"version":    map[string]any{"type": "integer", "description": "要等的版本(省略就等目前的版本)"},
				"timeout_ms": map[string]any{"type": "integer", "description": "最多等幾毫秒(預設 8000,上限 60000)"},
			}),
			run: waitLiveReport,
		},
	}
}

type liveSnap struct {
	Version int            `json:"version"`
	Script  map[string]any `json:"script"`
	Report  *struct {
		Version  int     `json:"version"`
		Error    string  `json:"error"`
		Duration float64 `json:"duration"`
	} `json:"report"`
}

func liveCall(c *client, method, path string, body any) (string, error) {
	var snap json.RawMessage
	if err := c.do(method, path, body, &snap); err != nil {
		return "", err
	}
	return string(snap), nil
}

func waitLiveReport(c *client, args map[string]any) (string, error) {
	timeout := 8000
	if v, err := intArg(args, "timeout_ms"); err == nil {
		timeout = min(max(v, 0), 60000)
	}
	want := -1
	if v, err := intArg(args, "version"); err == nil {
		want = v
	}
	deadline := time.Now().Add(time.Duration(timeout) * time.Millisecond)
	for {
		var s liveSnap
		if err := c.do("GET", "/api/live-script", nil, &s); err != nil {
			return "", err
		}
		v := want
		if v < 0 {
			v = s.Version
		}
		if s.Report != nil && s.Report.Version >= v {
			out, _ := json.Marshal(map[string]any{"version": s.Report.Version, "ok": s.Report.Error == "", "error": s.Report.Error, "duration": s.Report.Duration})
			return string(out), nil
		}
		if time.Now().After(deadline) {
			return "", fmt.Errorf("等了 %d 毫秒還沒有第 %d 版的回報:研發基地的 /studio/live-script 要開著(管理員登入)才會回報", timeout, v)
		}
		time.Sleep(300 * time.Millisecond)
	}
}

func intArg(args map[string]any, name string) (int, error) {
	switch v := args[name].(type) {
	case float64:
		return int(v), nil
	case nil:
		return 0, fmt.Errorf("要寫 %s", name)
	}
	return 0, fmt.Errorf("%s 要是整數", name)
}

// runMCP 讀 stdin 的 JSON-RPC,一則一則回應到 stdout,直到 stdin 結束。
func runMCP(c *client, in io.Reader, out io.Writer) error {
	tools := liveTools()
	byName := map[string]mcpTool{}
	for _, t := range tools {
		byName[t.Name] = t
	}
	enc := json.NewEncoder(out)
	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 1<<20), 8<<20)
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		var req rpcRequest
		if err := json.Unmarshal(line, &req); err != nil {
			_ = enc.Encode(rpcResponse{JSONRPC: "2.0", ID: json.RawMessage("null"), Error: &rpcError{Code: -32700, Message: "parse error"}})
			continue
		}
		if len(req.ID) == 0 { // 通知(例如 notifications/initialized)不用回應
			continue
		}
		res := rpcResponse{JSONRPC: "2.0", ID: req.ID}
		switch req.Method {
		case "initialize":
			var p struct {
				ProtocolVersion string `json:"protocolVersion"`
			}
			_ = json.Unmarshal(req.Params, &p)
			pv := p.ProtocolVersion
			if pv == "" {
				pv = mcpProtocolVersion
			}
			res.Result = map[string]any{
				"protocolVersion": pv,
				"capabilities":    map[string]any{"tools": map[string]any{}},
				"serverInfo":      map[string]any{"name": "evoleap", "version": version},
				"instructions":    "操作 evoleap 的即時腳本:改後端的臨時腳本,研發基地的 /studio/live-script 會即時演出。先 get_live_script 看現況,改完用 wait_live_report 確認有沒有演出來。\n\n" + liveScriptFormat,
			}
		case "ping":
			res.Result = map[string]any{}
		case "tools/list":
			res.Result = map[string]any{"tools": tools}
		case "tools/call":
			var p struct {
				Name      string         `json:"name"`
				Arguments map[string]any `json:"arguments"`
			}
			if err := json.Unmarshal(req.Params, &p); err != nil {
				res.Error = &rpcError{Code: -32602, Message: "invalid params"}
				break
			}
			t, ok := byName[p.Name]
			if !ok {
				res.Error = &rpcError{Code: -32602, Message: "沒有這個工具:" + p.Name}
				break
			}
			if p.Arguments == nil {
				p.Arguments = map[string]any{}
			}
			text, err := t.run(c, p.Arguments)
			if err != nil {
				// 工具執行失敗回 isError,讓 AI 看到訊息自己修正(不是協定錯誤)
				res.Result = map[string]any{"content": []map[string]any{{"type": "text", "text": err.Error()}}, "isError": true}
				break
			}
			res.Result = map[string]any{"content": []map[string]any{{"type": "text", "text": text}}}
		default:
			res.Error = &rpcError{Code: -32601, Message: "method not found: " + req.Method}
		}
		if err := enc.Encode(res); err != nil {
			return err
		}
	}
	return sc.Err()
}

func cmdMCP(api string) {
	if err := runMCP(newClient(api), os.Stdin, os.Stdout); err != nil {
		fatal("mcp:%v", err)
	}
}
