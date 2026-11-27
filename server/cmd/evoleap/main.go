// Command evoleap 是管理員改課程資料的 CLI(仿照 tripace 的 tripace-cli),給人或 Claude Code 直接操作。
//
// 一律走伺服器的 HTTP API(/api/admin/*、/api/scripts),不直連資料庫:權限、規則檢查與修改紀錄都在伺服器。
// 主題、課程、單元、課與腳本都以資料庫為準,部署不會蓋掉;空資料庫用 node server/backup/gcs.mjs init 手動初始化。
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
//	course set -course ID [-access free|login-free|subscription] [-title 文字] [-summary 文字] [-about 段落||段落] [-seo-title 文字] [-description 文字] [-art 樣式] [-intro-script 路徑] [-topic-id 主題ID] [-overview=true|false]
//	                                改一門課自己的存取方式、課名與課程資訊(簡介、說明段落用 || 分隔、搜尋結果標題與描述、插圖 tools|chat|build|agent|advanced);給空字串清掉(沒寫 access 的課跟著這門課)
//	topic list                      主題清單(首頁卡片、主題頁、全部課程頁的分組;含 content)
//	topic show -topic ID            一個主題
//	topic section-add|section-set|section-delete|section-order、block-add|block-set|block-delete|block-order(主題頁的區塊)
//	topic create|delete|order、topic item-add|item-set|item-delete|item-order(清單項目,id 見 topic show)
//	topic set -topic ID [-name 文字] [-slogan 文字] [-path 網址] [-seo-title 文字] [-description 文字] [-content-file 路徑]
//	                                改一個主題;-content-file 是整包換掉的 JSON 物件檔(其餘內容:lede、learn、flow、outcomes、preview…)
//	lesson set -course ID -lesson ID [-status open|draft|planned] [-access free|login-free|subscription|inherit] [-minutes N] [-title 文字] [-summary 文字] [-script 路徑]
//	i18n list [-lang en] [-kind course|unit|lesson|topic|topic_item|topic_section|page_section|page_block] [-ref ID] [-status draft|reviewed|published] [-stale] [-n 500]
//	                                列出課程資訊的譯文(附原文;stale 是原文在翻譯之後改過)
//	i18n get -kind K -ref ID -path P [-lang en]
//	                                一筆譯文與它的異動紀錄
//	i18n set -kind K -ref ID -path P [-lang en] (-value 文字 | -value-file 檔案) [-status draft|reviewed|published] [-origin human|ai|import] [-model M] [-reason 原因]
//	                                寫入一筆譯文(預設 draft、human;只有 published 會顯示在網站上),每次寫入記一筆異動紀錄
//	i18n missing [-lang en] [-kind K]
//	                                列出登記表有、譯文沒有(missing)或過時(stale)的欄位
//	script list [-owners]           所有腳本檔的路徑(只給管理員);-owners 附上來源(lesson|studio)、所屬課程與課
//	script get -path 路徑 [-out 檔案]
//	script push -file 檔案 [-path 路徑] [-course ID -lesson ID]
//	script drafts|draft-push|draft-get|draft-drop|publish(草稿與發布,見 scriptdrafts.go)
//	backup export -out 目錄         唯讀匯出 lesson_files 與 studio_files 的內容到本機目錄(給 GCS 備份用,見 server/backup/README.md)
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
		{verb: "set", usage: "evoleap course set -course ID [-access free|login-free|subscription] [-title 文字] [-summary 文字] [-about 段落||段落] [-seo-title 文字] [-description 文字] [-art tools|chat|build|agent|advanced] [-intro-script 路徑] [-topic-id 主題ID] [-overview=true|false]", run: cmdCourseSet},
		{verb: "create", usage: "evoleap course create -course ID -title 文字 -access free|login-free|subscription [-topic-id 主題ID]", run: cmdCourseCreate},
		{verb: "delete", usage: "evoleap course delete -course ID", run: cmdCourseDelete},
		{verb: "order", usage: "evoleap course order -ids ID,ID,…", run: cmdCourseOrder},
		{verb: "outline", usage: "evoleap course outline -course ID -file 大綱.json", run: cmdCourseOutline},
	}},
	{name: "unit", commands: []command{
		{verb: "add", usage: "evoleap unit add -course ID -unit ID -title 文字 [-subtitle 文字] [-label 文字] [-hidden]", run: cmdUnitAdd},
		{verb: "set", usage: "evoleap unit set -course ID -unit ID [-title 文字] [-subtitle 文字] [-label 文字] [-hidden=true|false]", run: cmdUnitSet},
		{verb: "delete", usage: "evoleap unit delete -course ID -unit ID", run: cmdUnitDelete},
	}},
	{name: "topic", commands: []command{
		{verb: "list", usage: "evoleap topic list", run: cmdTopicList},
		{verb: "show", usage: "evoleap topic show -topic ID", run: cmdTopicShow},
		{verb: "set", usage: "evoleap topic set -topic ID [-name 文字] [-slogan 文字] [-path 網址] [-seo-title 文字] [-description 文字] [-content-file 路徑]", run: cmdTopicSet},
		{verb: "create", usage: "evoleap topic create -topic ID -name 文字 [-slogan 文字] [-path 網址]", run: cmdTopicCreate},
		{verb: "delete", usage: "evoleap topic delete -topic ID", run: cmdTopicDelete},
		{verb: "order", usage: "evoleap topic order -ids a,b,c", run: cmdTopicOrder},
		{verb: "item-add", usage: "evoleap topic item-add -topic ID -kind 種類 -text 文字 [-level 文字] [-at N]", run: cmdTopicItemAdd},
		{verb: "item-set", usage: "evoleap topic item-set -topic ID -item ID [-text 文字] [-level 文字]", run: cmdTopicItemSet},
		{verb: "item-delete", usage: "evoleap topic item-delete -topic ID -item ID", run: cmdTopicItemDelete},
		{verb: "item-order", usage: "evoleap topic item-order -topic ID -kind 種類 -ids a,b,c", run: cmdTopicItemOrder},
		{verb: "section-add", usage: "evoleap topic section-add -topic ID -id 區塊 -kind hero|levels|cards|lists|units|features [-eyebrow 文字] [-title 文字] [-lead 文字] [-source 課程] [-variant 值] [-at N]", run: cmdTopicSectionAdd},
		{verb: "section-set", usage: "evoleap topic section-set -topic ID -section 區塊 [-eyebrow 文字] [-title 文字] [-lead 文字] [-source 課程] [-variant 值]", run: cmdTopicSectionSet},
		{verb: "section-delete", usage: "evoleap topic section-delete -topic ID -section 區塊", run: cmdTopicSectionDelete},
		{verb: "section-order", usage: "evoleap topic section-order -topic ID -ids a,b,c", run: cmdTopicSectionOrder},
		{verb: "block-add", usage: "evoleap topic block-add -topic ID -section 區塊 [-parent 項目] [-title 文字] [-text 文字] [-note 文字] [-ref ID] [-variant 值] [-label 文字] [-at N]", run: cmdTopicBlockAdd},
		{verb: "block-set", usage: "evoleap topic block-set -topic ID -block 項目 [-title 文字] [-text 文字] [-note 文字] [-ref ID] [-variant 值] [-label 文字]", run: cmdTopicBlockSet},
		{verb: "block-delete", usage: "evoleap topic block-delete -topic ID -block 項目", run: cmdTopicBlockDelete},
		{verb: "block-order", usage: "evoleap topic block-order -topic ID -section 區塊 [-parent 項目] -ids a,b,c", run: cmdTopicBlockOrder},
	}},
	{name: "lesson", commands: []command{
		{verb: "set", usage: "evoleap lesson set -course ID -lesson ID [-status open|draft|planned] [-access free|login-free|subscription|inherit] [-minutes N] [-title 文字] [-summary 文字] [-script 路徑]", run: cmdLessonSet},
		{verb: "add", usage: "evoleap lesson add -course ID -lesson ID -unit ID -title 文字 [-summary 文字] [-status planned|draft|open] [-access …] [-minutes N]", run: cmdLessonAdd},
		{verb: "delete", usage: "evoleap lesson delete -course ID -lesson ID", run: cmdLessonDelete},
	}},
	{name: "i18n", commands: []command{
		{verb: "list", usage: "evoleap i18n list [-lang en] [-kind course|unit|lesson|topic|topic_item|topic_section|page_section|page_block] [-ref ID] [-status draft|reviewed|published] [-stale] [-n 500]", run: cmdI18nList},
		{verb: "get", usage: "evoleap i18n get -kind K -ref ID -path P [-lang en]", run: cmdI18nGet},
		{verb: "set", usage: "evoleap i18n set -kind K -ref ID -path P [-lang en] (-value 文字 | -value-file 檔案) [-status draft|reviewed|published] [-origin human|ai|import] [-model M] [-reason 原因]", run: cmdI18nSet},
		{verb: "missing", usage: "evoleap i18n missing [-lang en] [-kind K]", run: cmdI18nMissing},
	}},
	{name: "script", commands: []command{
		{verb: "list", usage: "evoleap script list [-owners]", run: cmdScriptList},
		{verb: "get", usage: "evoleap script get -path 路徑 [-out 檔案]", run: cmdScriptGet},
		{verb: "push", usage: "evoleap script push -file 檔案 [-path 路徑] [-course ID -lesson ID](直接改正式版本)", run: cmdScriptPush},
		{verb: "drafts", usage: "evoleap script drafts", run: cmdScriptDrafts},
		{verb: "draft-push", usage: "evoleap script draft-push -file 檔案 [-path 路徑] [-course ID -lesson ID]", run: cmdScriptDraftPush},
		{verb: "draft-get", usage: "evoleap script draft-get -path 路徑 [-out 檔案]", run: cmdScriptDraftGet},
		{verb: "draft-drop", usage: "evoleap script draft-drop -path 路徑", run: cmdScriptDraftDrop},
		{verb: "publish", usage: "evoleap script publish [-force] 路徑…(連同旁白、音軌清單的草稿一起發布)", run: cmdScriptPublish},
	}},
	{name: "backup", commands: []command{
		{verb: "export", usage: "evoleap backup export -out 目錄", run: cmdBackupExport},
	}},
	{name: "catalog", commands: []command{
		{verb: "init", usage: "evoleap catalog init -dir 目錄(只能用在空資料庫;平常跑 node server/backup/gcs.mjs init)", run: cmdInit},
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

func cmdCourseSet(c *client, args []string) {
	fs := flag.NewFlagSet("course set", flag.ExitOnError)
	course := fs.String("course", "", "課程 id")
	access := fs.String("access", "", "free、login-free 或 subscription(沒寫 access 的課跟著這門課)")
	title := fs.String("title", "", "課程名稱")
	summary := fs.String("summary", "", "課程簡介(最多 500 字);給空字串清掉")
	about := fs.String("about", "", "課程說明,段落之間用 || 分隔;給空字串清掉")
	seoTitle := fs.String("seo-title", "", "搜尋結果的標題(最多 200 字)")
	description := fs.String("description", "", "搜尋結果的描述(最多 500 字)")
	art := fs.String("art", "", "插圖樣式:tools、chat、build、agent、advanced,或空字串用預設")
	introScript := fs.String("intro-script", "", "課程簡介影片的腳本路徑(例如 guide/kids.json;檔案要先用 script push 傳上去);空字串拿掉")
	topicID := fs.String("topic-id", "", "課程所屬主題的 id(見 evoleap topic list,例如 software、kids);給空字串清掉(該課就不列在全部課程)")
	overview := fs.Bool("overview", true, "這門課有沒有自己的課程總覽頁 /courses/<id>(-overview=false 代表沒有)")
	set := parse(fs, args, "course")
	patch := map[string]any{}
	for name, v := range map[string]any{"access": *access, "title": *title, "summary": *summary, "description": *description, "art": *art} {
		if set[name] {
			patch[name] = v
		}
	}
	if set["seo-title"] {
		patch["seoTitle"] = *seoTitle
	}
	if set["intro-script"] {
		patch["introScript"] = *introScript
	}
	if set["topic-id"] {
		patch["topicId"] = *topicID
	}
	if set["overview"] {
		patch["overview"] = *overview
	}
	if set["about"] {
		paras := []string{}
		if strings.TrimSpace(*about) != "" {
			for _, p := range strings.Split(*about, "||") {
				paras = append(paras, strings.TrimSpace(p))
			}
		}
		patch["about"] = paras
	}
	if len(patch) == 0 {
		fatal("沒有要改的欄位(-access、-title、-summary、-about、-seo-title、-description、-art、-intro-script、-topic-id、-overview)")
	}
	var out any
	mustDo(c.do("PATCH", "/api/admin/courses/"+url.PathEscape(*course), patch, &out))
	printJSON(out)
}

func cmdTopicList(c *client, args []string) {
	parse(flag.NewFlagSet("topic list", flag.ExitOnError), args)
	var out any
	mustDo(c.do("GET", "/api/admin/topics", nil, &out))
	printJSON(out)
}

func cmdTopicShow(c *client, args []string) {
	fs := flag.NewFlagSet("topic show", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id,例如 software")
	parse(fs, args, "topic")
	var out struct {
		Topics []json.RawMessage `json:"topics"`
	}
	mustDo(c.do("GET", "/api/admin/topics", nil, &out))
	for _, raw := range out.Topics {
		var head struct {
			ID string `json:"id"`
		}
		if json.Unmarshal(raw, &head) == nil && head.ID == *topic {
			printJSON(raw)
			return
		}
	}
	fatal("找不到主題 %q(用 evoleap topic list 看有哪些)", *topic)
}

func cmdTopicSet(c *client, args []string) {
	fs := flag.NewFlagSet("topic set", flag.ExitOnError)
	topic := fs.String("topic", "", "主題 id")
	name := fs.String("name", "", "主題名稱")
	slogan := fs.String("slogan", "", "主題的一句話(最多 200 字);給空字串清掉")
	path := fs.String("path", "", "主題頁的網址(/ 開頭,例如 /topics/software;單一課程的主題是課程總覽,例如 /courses/web)")
	seoTitle := fs.String("seo-title", "", "搜尋結果的標題(最多 200 字)")
	description := fs.String("description", "", "搜尋結果的描述(最多 500 字)")
	contentFile := fs.String("content-file", "", "主題其餘內容的 JSON 物件檔(整包換掉,先用 topic show 取得現在的內容再改)")
	set := parse(fs, args, "topic")
	patch := map[string]any{}
	for flagName, f := range map[string]struct{ key, val string }{"name": {"name", *name}, "slogan": {"slogan", *slogan}, "path": {"path", *path}, "seo-title": {"seoTitle", *seoTitle}, "description": {"description", *description}} {
		if set[flagName] {
			patch[f.key] = f.val
		}
	}
	if set["content-file"] {
		body, err := os.ReadFile(*contentFile)
		if err != nil {
			fatal("讀不到 %s:%v", *contentFile, err)
		}
		if !json.Valid(body) {
			fatal("%s 不是有效的 JSON", *contentFile)
		}
		patch["content"] = json.RawMessage(body)
	}
	if len(patch) == 0 {
		fatal("沒有要改的欄位(-name、-slogan、-path、-seo-title、-description、-content-file)")
	}
	var out any
	mustDo(c.do("PATCH", "/api/admin/topics/"+url.PathEscape(*topic), patch, &out))
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
	script := fs.String("script", "", "課程頁要播的腳本路徑(例如 l0/0.0-tools.json);給空字串拿掉")
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
}

// cmdScriptList 列出腳本檔(本機工具 web/scripts/lib/liveScripts.mjs 也用它);-owners 讀完整匯出但只輸出歸屬,不輸出內容。
func cmdScriptList(c *client, args []string) {
	fs := flag.NewFlagSet("script list", flag.ExitOnError)
	owners := fs.Bool("owners", false, "附上來源(lesson|studio)、所屬課程與課")
	parse(fs, args)
	if !*owners {
		var out struct {
			Paths []string `json:"paths"`
		}
		mustDo(c.do("GET", "/api/scripts", nil, &out))
		printJSON(out)
		return
	}
	type file struct {
		Path     string `json:"path"`
		Source   string `json:"source"`
		CourseID string `json:"courseId"`
		LessonID string `json:"lessonId"`
	}
	var out struct {
		Files []file `json:"files"`
	}
	mustDo(c.do("GET", "/api/admin/script-export", nil, &out))
	printJSON(out)
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

func cmdScriptPush(c *client, args []string) {
	fs := flag.NewFlagSet("script push", flag.ExitOnError)
	file := fs.String("file", "", "本機的腳本檔")
	path := fs.String("path", "", "腳本路徑,例如 l0/0.0-tools.json")
	course := fs.String("course", "", "掛在哪門課底下(和 -lesson 一起給)")
	lesson := fs.String("lesson", "", "掛在哪一課底下")
	parse(fs, args, "file")
	if *path == "" {
		*path = livePath(*file)
	}
	if *path == "" {
		fatal("請用 -path 指定腳本路徑,例如 l0/0.0-tools.json")
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
