package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// evoleap login [--web] [-console URL]:瀏覽器核准登入(流程見 server/internal/store/cliauth.go)。
//  1. 在本機 127.0.0.1 開一個臨時伺服器,向 /api/cli-auth/start 登記它的網址,拿回一次性的 id。
//  2. 打開瀏覽器到核准頁(<console>/login/cli?id=…),管理員按核准後,瀏覽器被導回這個臨時伺服器(?id=…&code=一次性驗證碼)。
//  3. 用 id 加驗證碼向 /api/cli-auth/exchange 換 token,存到本機(token.go)。只有 id 換不到,所以別人發起的登入要求就算被核准,也拿不到 token。
//
// -console 只影響核准頁的網址(本機開發時前端在 5190、API 在 8190);API 呼叫一律打 -api。

const loginTimeout = 10 * time.Minute

func runLogin(api string, args []string) {
	console := api
	for i := 0; i < len(args); i++ {
		switch a := args[i]; {
		case a == "--web" || a == "-web":
		case strings.HasPrefix(a, "-console="):
			console = strings.TrimPrefix(a, "-console=")
		case a == "-console" && i+1 < len(args):
			console = args[i+1]
			i++
		default:
			fatal("login:不認得的參數 %q(用法:evoleap login [--web] [-console URL])", a)
		}
	}
	console = strings.TrimRight(console, "/")

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fatal("login:無法在本機開啟臨時伺服器:%v", err)
	}
	defer ln.Close()
	redirect := fmt.Sprintf("http://127.0.0.1:%d/callback", ln.Addr().(*net.TCPAddr).Port)

	c := newClient(api)
	c.token = ""
	host, _ := os.Hostname()
	var start struct{ ID string }
	mustDo(c.do("POST", "/api/cli-auth/start", map[string]string{"redirect_uri": redirect, "name": "evoleap CLI(" + host + ")"}, &start))

	codes := make(chan string, 1)
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/callback" {
			http.NotFound(w, r)
			return
		}
		q := r.URL.Query()
		code := q.Get("code")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if q.Get("id") != start.ID || code == "" {
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprint(w, page("登入失敗", "代碼不符,請回到終端機重新執行 evoleap login。"))
			return
		}
		fmt.Fprint(w, page("登入完成", "可以關掉這個分頁,回到終端機。"))
		select {
		case codes <- code:
		default:
		}
	})}
	go srv.Serve(ln)
	defer srv.Shutdown(context.Background())

	approve := console + "/login/cli?id=" + start.ID
	fmt.Fprintf(os.Stderr, "在瀏覽器打開下面的網址,以管理員身分按「核准」(%d 分鐘內有效):\n\n  %s\n\n", int(loginTimeout.Minutes()), approve)
	openBrowser(approve)

	select {
	case code := <-codes:
		var ex struct{ Token string }
		mustDo(c.do("POST", "/api/cli-auth/exchange", map[string]string{"id": start.ID, "code": code}, &ex))
		mustDo(saveToken(api, ex.Token))
		c.token = ex.Token
		var me struct {
			User any `json:"user"`
		}
		mustDo(c.do("GET", "/api/me", nil, &me))
		printJSON(map[string]any{"ok": true, "api": api, "user": me.User})
	case <-time.After(loginTimeout):
		fatal("login:等太久了(%d 分鐘),請重新執行 evoleap login", int(loginTimeout.Minutes()))
	}
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start() // 打不開(例如沒有桌面環境)就只靠上面印出的網址
}

func page(title, msg string) string {
	return `<!doctype html><meta charset="utf-8"><title>` + title + `</title>` +
		`<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0">` +
		`<main style="text-align:center"><h1>` + title + `</h1><p>` + msg + `</p></main></body>`
}
