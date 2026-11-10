// Command evoleap 是管理員改課程資料的 CLI(仿照 tripace 的 tripace-cli),給人或 Claude Code 直接操作。
//
// 一律走伺服器的 HTTP API(/api/admin/*、/api/scripts),不直連資料庫:權限、規則檢查與修改紀錄都在伺服器。
// 注意:現階段課程資料以 courses_seed.json 為準,每次同步(部署、本機啟動)都會把種子的內容寫回資料庫,
// 用這個 CLI 改的內容會被蓋掉。等課程架構穩定、改成以資料庫為準後才用它改課程資料。
//
// 先登入一次:evoleap login(打開瀏覽器,在 evoleap.io 的核准頁按核准,只有管理員能核准),
// token 依 -api 的主機分開存在使用者設定目錄(見 token.go),之後的指令自動帶上。token 有效期 7 天,可以撤銷。
//
// 指令是「資源 動作」(對齊 tripace-cli、gh、kubectl):
//
//	login [--web] [-console URL]    瀏覽器核准登入(本機開發:-api http://localhost:8190 -console http://localhost:5190)
//	logout                          在伺服器撤銷這個 token,再刪掉本機存的
//	token list                      還有效的 CLI 登入(誰、哪台電腦、最後使用時間)
//	token revoke -id ID             撤銷一個 CLI 登入(例如遺失的電腦)
//	whoami                          目前登入的帳號
//	course list                     課程清單與各狀態的課數
//	course show -course ID          一門課的單元與每一課(含草稿、腳本、時間)
//	lesson set -course ID -lesson ID [-status open|draft|planned] [-access free|login-free|subscription|inherit] [-minutes N] [-title 文字] [-summary 文字] [-script 路徑]
//	script get -path 路徑 [-out 檔案]
//	script push -file 檔案 [-path 路徑] [-course ID -lesson ID]
//	change list [-n 20]             最近的修改紀錄(誰、什麼時候、改了什麼)
//	schema check                    資料庫結構檢查:資料表定義與實際欄位、主鍵是否一致,有沒有遺留表(有問題時結束碼 1)
//
// 全域旗標 -api(預設 https://evoleap.io)。輸出一律是 JSON(script get 輸出腳本本身);失敗時訊息寫到 stderr、結束碼 1。
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const defaultAPI = "https://evoleap.io"

// version 由 build 時的 -ldflags "-X main.version=…" 設定
var version = "dev"

type command struct {
	verb  string
	usage string
	run   func(c *client, args []string)
}

type resource struct {
	name     string
	commands []command
}

var resources = []resource{
	{name: "course", commands: []command{
		{verb: "list", usage: "evoleap course list", run: cmdCourseList},
		{verb: "show", usage: "evoleap course show -course ID", run: cmdCourseShow},
	}},
	{name: "lesson", commands: []command{
		{verb: "set", usage: "evoleap lesson set -course ID -lesson ID [-status open|draft|planned] [-access free|login-free|subscription|inherit] [-minutes N] [-title 文字] [-summary 文字] [-script 路徑]", run: cmdLessonSet},
	}},
	{name: "script", commands: []command{
		{verb: "get", usage: "evoleap script get -path 路徑 [-out 檔案]", run: cmdScriptGet},
		{verb: "push", usage: "evoleap script push -file 檔案 [-path 路徑] [-course ID -lesson ID]", run: cmdScriptPush},
	}},
	{name: "change", commands: []command{
		{verb: "list", usage: "evoleap change list [-n 20]", run: cmdChangeList},
	}},
	{name: "token", commands: []command{
		{verb: "list", usage: "evoleap token list", run: cmdTokenList},
		{verb: "revoke", usage: "evoleap token revoke -id ID", run: cmdTokenRevoke},
	}},
	{name: "schema", commands: []command{
		{verb: "check", usage: "evoleap schema check", run: cmdSchemaCheck},
	}},
}

func main() {
	api, args := splitAPIFlag(os.Args[1:])
	if len(args) == 0 {
		usage()
		os.Exit(2)
	}
	switch args[0] {
	case "login":
		runLogin(api, args[1:])
		return
	case "logout":
		// 先在伺服器撤銷這個 token(之後就算檔案被複製走也不能用),再刪本機的檔;伺服器連不上時仍刪本機的檔,並提醒
		c := newClient(api)
		revoked := c.token == ""
		if !revoked {
			revoked = c.do("POST", "/api/cli-auth/logout", nil, nil) == nil
		}
		if err := deleteToken(api); err != nil && !os.IsNotExist(err) {
			fatal("logout: %v", err)
		}
		printJSON(map[string]any{"ok": true, "api": api, "revokedOnServer": revoked})
		if !revoked {
			fatal("logout:伺服器上的 token 沒撤銷成功(本機的已刪除),請用 evoleap token list / token revoke 撤銷")
		}
		return
	case "whoami":
		var out any
		mustDo(newClient(api).do("GET", "/api/me", nil, &out))
		printJSON(out)
		return
	case "version":
		printJSON(map[string]string{"version": version})
		return
	case "help", "-h", "--help":
		usage()
		return
	}
	for _, r := range resources {
		if r.name != args[0] {
			continue
		}
		if len(args) < 2 {
			resourceUsage(r)
			os.Exit(2)
		}
		for _, cmd := range r.commands {
			if cmd.verb == args[1] {
				cmd.run(newClient(api), args[2:])
				return
			}
		}
		resourceUsage(r)
		fatal("未知指令 %q(資源 %q 底下)", args[1], r.name)
	}
	fatal("未知指令 %q(用 evoleap help 看用法)", args[0])
}

// splitAPIFlag 取出全域旗標 -api(可以放在任何位置),回傳主機與其餘參數
func splitAPIFlag(args []string) (string, []string) {
	api := defaultAPI
	rest := make([]string, 0, len(args))
	for i := 0; i < len(args); i++ {
		switch a := args[i]; {
		case strings.HasPrefix(a, "-api="):
			api = strings.TrimPrefix(a, "-api=")
		case a == "-api" && i+1 < len(args):
			api = args[i+1]
			i++
		default:
			rest = append(rest, a)
		}
	}
	return strings.TrimRight(api, "/"), rest
}

func usage() {
	fmt.Fprint(os.Stderr, `evoleap:管理員改課程資料的 CLI(全域旗標 -api,預設 `+defaultAPI+`)

  evoleap login [--web] [-console URL]
  evoleap logout
  evoleap whoami
  evoleap version
`)
	for _, r := range resources {
		for _, c := range r.commands {
			fmt.Fprintf(os.Stderr, "  %s\n", c.usage)
		}
	}
}

func resourceUsage(r resource) {
	for _, c := range r.commands {
		fmt.Fprintf(os.Stderr, "  %s\n", c.usage)
	}
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "evoleap: "+format+"\n", args...)
	os.Exit(1)
}

func mustDo(err error) {
	if err != nil {
		fatal("%v", err)
	}
}

func printJSON(v any) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

// parse 解析一個指令的旗標;required 是必填的旗標名稱
func parse(fs *flag.FlagSet, args []string, required ...string) map[string]bool {
	fs.SetOutput(os.Stderr)
	if err := fs.Parse(args); err != nil {
		os.Exit(2)
	}
	set := map[string]bool{}
	fs.Visit(func(f *flag.Flag) { set[f.Name] = true })
	for _, name := range required {
		if !set[name] {
			fatal("缺少 -%s", name)
		}
	}
	return set
}

func cmdCourseList(c *client, args []string) {
	parse(flag.NewFlagSet("course list", flag.ExitOnError), args)
	var out any
	mustDo(c.do("GET", "/api/admin/courses", nil, &out))
	printJSON(out)
}

func cmdCourseShow(c *client, args []string) {
	fs := flag.NewFlagSet("course show", flag.ExitOnError)
	course := fs.String("course", "", "課程 id,例如 kids")
	parse(fs, args, "course")
	var out any
	mustDo(c.do("GET", "/api/admin/courses/"+url.PathEscape(*course), nil, &out))
	printJSON(out)
}

func cmdLessonSet(c *client, args []string) {
	fs := flag.NewFlagSet("lesson set", flag.ExitOnError)
	course := fs.String("course", "", "課程 id")
	lesson := fs.String("lesson", "", "課號,例如 0.1")
	status := fs.String("status", "", "open、draft 或 planned")
	access := fs.String("access", "", "free、login-free、subscription,或 inherit(照這門課)")
	minutes := fs.Int("minutes", 0, "預估學習時間(分鐘)")
	title := fs.String("title", "", "課名")
	summary := fs.String("summary", "", "課程地圖上的一句話")
	script := fs.String("script", "", "課程頁要播的腳本(web/src/content/live/ 底下的路徑);給空字串拿掉")
	set := parse(fs, args, "course", "lesson")
	patch := map[string]any{}
	for name, v := range map[string]any{"status": *status, "minutes": *minutes, "title": *title, "summary": *summary, "script": *script} {
		if set[name] {
			patch[name] = v
		}
	}
	if set["access"] {
		patch["access"] = *access
		if *access == "inherit" {
			patch["access"] = ""
		}
	}
	if len(patch) == 0 {
		fatal("沒有要改的欄位(-status、-access、-minutes、-title、-summary、-script)")
	}
	var out any
	mustDo(c.do("PATCH", "/api/admin/courses/"+url.PathEscape(*course)+"/lessons/"+url.PathEscape(*lesson), patch, &out))
	printJSON(out)
	warnSeedOverwrites()
}

func cmdScriptGet(c *client, args []string) {
	fs := flag.NewFlagSet("script get", flag.ExitOnError)
	path := fs.String("path", "", "腳本路徑,例如 l0/0.0-tools.json")
	out := fs.String("out", "", "寫到這個檔案(沒給就輸出到 stdout)")
	parse(fs, args, "path")
	body, err := c.raw("GET", "/api/scripts/"+escapePath(*path), nil)
	mustDo(err)
	if *out == "" {
		os.Stdout.Write(body)
		return
	}
	mustDo(os.WriteFile(*out, body, 0o644))
	printJSON(map[string]any{"path": *path, "out": *out, "bytes": len(body)})
}

// warnSeedOverwrites 提醒:現階段課程資料以種子為準,每次部署與本機啟動的同步都會把種子的內容寫回資料庫,這次的修改會被蓋掉。
func warnSeedOverwrites() {
	fmt.Fprintln(os.Stderr, "注意:現階段以 courses_seed.json 與 web/src/content/live 為準,下次同步(部署、本機啟動)會蓋掉這次的修改;要長期保留請改種子。")
}

func cmdScriptPush(c *client, args []string) {
	fs := flag.NewFlagSet("script push", flag.ExitOnError)
	file := fs.String("file", "", "本機的腳本檔")
	path := fs.String("path", "", "web/src/content/live/ 底下的路徑;檔案在那個目錄裡時可以省略")
	course := fs.String("course", "", "掛在哪門課底下(和 -lesson 一起給)")
	lesson := fs.String("lesson", "", "掛在哪一課底下")
	parse(fs, args, "file")
	if *path == "" {
		*path = livePath(*file)
	}
	if *path == "" {
		fatal("檔案不在 web/src/content/live/ 底下,請用 -path 指定路徑")
	}
	if (*course == "") != (*lesson == "") {
		fatal("-course 和 -lesson 要一起給")
	}
	body, err := os.ReadFile(*file)
	mustDo(err)
	q := url.Values{}
	if *course != "" {
		q.Set("course", *course)
		q.Set("lesson", *lesson)
	}
	target := "/api/admin/scripts/" + escapePath(*path)
	if len(q) > 0 {
		target += "?" + q.Encode()
	}
	var out any
	mustDo(c.doBody("PUT", target, body, &out))
	printJSON(out)
	warnSeedOverwrites()
}

// livePath 把 web/src/content/live/ 底下的檔案轉成腳本路徑(例如 …/live/l0/0.0-tools.json → l0/0.0-tools.json)
func livePath(file string) string {
	abs, err := filepath.Abs(file)
	if err != nil {
		return ""
	}
	const marker = "/web/src/content/live/"
	i := strings.LastIndex(filepath.ToSlash(abs), marker)
	if i < 0 {
		return ""
	}
	return filepath.ToSlash(abs)[i+len(marker):]
}

func cmdChangeList(c *client, args []string) {
	fs := flag.NewFlagSet("change list", flag.ExitOnError)
	n := fs.Int("n", 20, "幾筆(最多 200)")
	parse(fs, args)
	var out any
	mustDo(c.do("GET", "/api/admin/course-changes?limit="+strconv.Itoa(*n), nil, &out))
	printJSON(out)
}

func cmdSchemaCheck(c *client, args []string) {
	parse(flag.NewFlagSet("schema check", flag.ExitOnError), args)
	var out struct {
		OK bool `json:"ok"`
	}
	body, err := c.raw("GET", "/api/admin/schema-check", nil)
	mustDo(err)
	mustDo(json.Unmarshal(body, &out))
	var pretty any
	mustDo(json.Unmarshal(body, &pretty))
	printJSON(pretty)
	if !out.OK {
		os.Exit(1)
	}
}

// escapePath 把腳本路徑的每一段做網址編碼(保留 / 分隔),空白、#、? 之類的字元才不會讓網址斷掉
func escapePath(p string) string {
	parts := strings.Split(p, "/")
	for i, s := range parts {
		parts[i] = url.PathEscape(s)
	}
	return strings.Join(parts, "/")
}

func cmdTokenList(c *client, args []string) {
	parse(flag.NewFlagSet("token list", flag.ExitOnError), args)
	var out any
	mustDo(c.do("GET", "/api/admin/cli-tokens", nil, &out))
	printJSON(out)
}

func cmdTokenRevoke(c *client, args []string) {
	fs := flag.NewFlagSet("token revoke", flag.ExitOnError)
	id := fs.String("id", "", "token list 列出的 id")
	parse(fs, args, "id")
	var out any
	mustDo(c.do("DELETE", "/api/admin/cli-tokens/"+url.PathEscape(*id), nil, &out))
	printJSON(out)
}
