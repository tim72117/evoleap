package main

import (
	"flag"
	"net/url"
	"os"
)

// 腳本草稿與發布:改完先 draft-push,網頁加 ?draft=1 預覽,確認後 publish。

func cmdScriptDrafts(c *client, args []string) {
	fs := flag.NewFlagSet("script drafts", flag.ExitOnError)
	parse(fs, args)
	var out any
	mustDo(c.do("GET", "/api/admin/script-drafts", nil, &out))
	printJSON(out)
}

func cmdScriptDraftPush(c *client, args []string) {
	fs := flag.NewFlagSet("script draft-push", flag.ExitOnError)
	file := fs.String("file", "", "本機的腳本檔")
	path := fs.String("path", "", "腳本路徑,例如 l0/0.0-tools.json")
	course := fs.String("course", "", "發布時掛在哪門課底下(和 -lesson 一起給)")
	lesson := fs.String("lesson", "", "發布時掛在哪一課底下")
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
	target := "/api/admin/script-drafts/" + escapePath(*path)
	if *course != "" {
		target += "?" + url.Values{"course": {*course}, "lesson": {*lesson}}.Encode()
	}
	var out any
	mustDo(c.doBody("PUT", target, body, &out))
	printJSON(out)
}

func cmdScriptDraftGet(c *client, args []string) {
	fs := flag.NewFlagSet("script draft-get", flag.ExitOnError)
	path := fs.String("path", "", "腳本路徑")
	out := fs.String("out", "", "寫到這個檔案(沒給就輸出到 stdout)")
	parse(fs, args, "path")
	body, err := c.raw("GET", "/api/admin/script-drafts/"+escapePath(*path), nil)
	mustDo(err)
	if *out == "" {
		os.Stdout.Write(body)
		return
	}
	mustDo(os.WriteFile(*out, body, 0o644))
	printJSON(map[string]any{"path": *path, "out": *out, "bytes": len(body)})
}

func cmdScriptDraftDrop(c *client, args []string) {
	fs := flag.NewFlagSet("script draft-drop", flag.ExitOnError)
	path := fs.String("path", "", "腳本路徑")
	parse(fs, args, "path")
	var out any
	mustDo(c.do("DELETE", "/api/admin/script-drafts/"+escapePath(*path), nil, &out))
	printJSON(out)
}

func cmdScriptPublish(c *client, args []string) {
	fs := flag.NewFlagSet("script publish", flag.ExitOnError)
	force := fs.Bool("force", false, "已發布版本在草稿之後改過了也照樣覆蓋")
	parse(fs, args)
	if fs.NArg() == 0 {
		fatal("要給至少一個腳本路徑,例如 evoleap script publish l0/0.0-tools.json")
	}
	var out any
	mustDo(c.do("POST", "/api/admin/script-publish", map[string]any{"paths": fs.Args(), "force": *force}, &out))
	printJSON(out)
}
