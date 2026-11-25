package main

import (
	"flag"
	"net/url"
	"os"
	"strconv"
	"strings"
)

// i18n 指令:課程資訊的譯文(課程、單元、課、主題),走 /api/admin/i18n*(見 internal/api/i18n.go),權限與修改紀錄都在伺服器。
// 欄位的鍵是 kind(course|unit|lesson|topic)、ref(課程 id;單元「課程id/單元id」;課「課程id/課id」;主題 id)、path(title、summary、about.0、content…)。

func cmdI18nList(c *client, args []string) {
	fs := flag.NewFlagSet("i18n list", flag.ExitOnError)
	lang := fs.String("lang", "en", "語言代碼")
	kind := fs.String("kind", "", "只列這種欄位(course、unit、lesson、topic)")
	ref := fs.String("ref", "", "只列這個 ref")
	status := fs.String("status", "", "只列這個狀態(draft、reviewed、published)")
	stale := fs.Bool("stale", false, "只列過時的(原文在翻譯之後改過)")
	n := fs.Int("n", 500, "最多幾筆")
	parse(fs, args)
	q := url.Values{"lang": {*lang}, "limit": {strconv.Itoa(*n)}}
	for k, v := range map[string]string{"kind": *kind, "ref": *ref, "status": *status} {
		if v != "" {
			q.Set(k, v)
		}
	}
	if *stale {
		q.Set("stale", "1")
	}
	var out any
	mustDo(c.do("GET", "/api/admin/i18n?"+q.Encode(), nil, &out))
	printJSON(out)
}

func cmdI18nGet(c *client, args []string) {
	fs := flag.NewFlagSet("i18n get", flag.ExitOnError)
	kind := fs.String("kind", "", "course、unit、lesson 或 topic")
	ref := fs.String("ref", "", "課程 id;單元「課程id/單元id」;課「課程id/課id」;主題 id")
	path := fs.String("path", "", "欄位路徑,例如 title、summary、about.0、content")
	lang := fs.String("lang", "en", "語言代碼")
	parse(fs, args, "kind", "ref", "path")
	q := url.Values{"kind": {*kind}, "ref": {*ref}, "path": {*path}, "lang": {*lang}}
	var out any
	mustDo(c.do("GET", "/api/admin/i18n/item?"+q.Encode(), nil, &out))
	printJSON(out)
}

func cmdI18nSet(c *client, args []string) {
	fs := flag.NewFlagSet("i18n set", flag.ExitOnError)
	kind := fs.String("kind", "", "course、unit、lesson 或 topic")
	ref := fs.String("ref", "", "課程 id;單元「課程id/單元id」;課「課程id/課id」;主題 id")
	path := fs.String("path", "", "欄位路徑,例如 title、summary、about.0、content(主題 content 的譯文要是 JSON 物件)")
	lang := fs.String("lang", "en", "語言代碼")
	value := fs.String("value", "", "譯文")
	valueFile := fs.String("value-file", "", "從檔案讀譯文(長文字或 JSON 用)")
	status := fs.String("status", "draft", "draft、reviewed 或 published(只有 published 會顯示在網站上)")
	origin := fs.String("origin", "human", "human、ai 或 import")
	model := fs.String("model", "", "機器翻譯用的模型")
	reason := fs.String("reason", "", "改的原因(記在異動紀錄)")
	set := parse(fs, args, "kind", "ref", "path")
	if set["value"] == set["value-file"] {
		fatal("-value 和 -value-file 要給一個")
	}
	v := *value
	if set["value-file"] {
		b, err := os.ReadFile(*valueFile)
		if err != nil {
			fatal("讀不到 %s:%v", *valueFile, err)
		}
		v = strings.TrimRight(string(b), "\r\n")
	}
	body := map[string]any{"kind": *kind, "ref": *ref, "path": *path, "lang": *lang, "value": v, "status": *status, "origin": *origin}
	if *model != "" {
		body["model"] = *model
	}
	if *reason != "" {
		body["reason"] = *reason
	}
	var out any
	mustDo(c.do("PUT", "/api/admin/i18n", body, &out))
	printJSON(out)
}

func cmdI18nMissing(c *client, args []string) {
	fs := flag.NewFlagSet("i18n missing", flag.ExitOnError)
	lang := fs.String("lang", "en", "語言代碼")
	kind := fs.String("kind", "", "只列這種欄位")
	parse(fs, args)
	q := url.Values{"lang": {*lang}}
	if *kind != "" {
		q.Set("kind", *kind)
	}
	var out any
	mustDo(c.do("GET", "/api/admin/i18n/missing?"+q.Encode(), nil, &out))
	printJSON(out)
}
