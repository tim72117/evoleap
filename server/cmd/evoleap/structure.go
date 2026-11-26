package main

// 課程結構的新增、刪除、排序。

import (
	"encoding/json"
	"flag"
	"net/url"
	"os"
	"strings"
)

func send(c *client, method, path string, body any) {
	var out any
	mustDo(c.do(method, path, body, &out))
	printJSON(out)
}

func coursePath(course string, rest ...string) string {
	p := "/api/admin/courses/" + url.PathEscape(course)
	for i, s := range rest {
		if i%2 == 1 {
			s = url.PathEscape(s)
		}
		p += "/" + s
	}
	return p
}

func cmdCourseCreate(c *client, args []string) {
	fs := flag.NewFlagSet("course create", flag.ExitOnError)
	course := fs.String("course", "", "課程 id")
	title := fs.String("title", "", "課名")
	access := fs.String("access", "", "free、login-free 或 subscription")
	topic := fs.String("topic-id", "", "主題 ID")
	parse(fs, args, "course", "title", "access")
	send(c, "POST", "/api/admin/courses", map[string]any{"id": *course, "title": *title, "access": *access, "topicId": *topic})
}

func cmdCourseDelete(c *client, args []string) {
	fs := flag.NewFlagSet("course delete", flag.ExitOnError)
	course := fs.String("course", "", "課程 id(要先沒有單元)")
	parse(fs, args, "course")
	send(c, "DELETE", coursePath(*course), nil)
}

func cmdCourseOrder(c *client, args []string) {
	fs := flag.NewFlagSet("course order", flag.ExitOnError)
	ids := fs.String("ids", "", "全部課程 id,依想要的順序用逗號分隔")
	parse(fs, args, "ids")
	send(c, "PUT", "/api/admin/course-order", map[string]any{"ids": strings.Split(*ids, ",")})
}

func cmdCourseOutline(c *client, args []string) {
	fs := flag.NewFlagSet("course outline", flag.ExitOnError)
	course := fs.String("course", "", "課程 id")
	file := fs.String("file", "", `大綱 JSON:{"units":[{"id":"0","lessons":["0.1","0.2"]}]}`)
	parse(fs, args, "course", "file")
	body, err := os.ReadFile(*file)
	mustDo(err)
	if !json.Valid(body) {
		fatal("%s 不是有效的 JSON", *file)
	}
	send(c, "PUT", coursePath(*course)+"/outline", json.RawMessage(body))
}

func unitFlags(fs *flag.FlagSet) (title, subtitle, label *string, hidden *bool) {
	return fs.String("title", "", "單元名稱"), fs.String("subtitle", "", "單元標題下的小字"), fs.String("label", "", "簡短名稱"), fs.Bool("hidden", false, "先不公開")
}

func cmdUnitAdd(c *client, args []string) {
	fs := flag.NewFlagSet("unit add", flag.ExitOnError)
	course := fs.String("course", "", "課程 id")
	unit := fs.String("unit", "", "單元 id")
	title, subtitle, label, hidden := unitFlags(fs)
	parse(fs, args, "course", "unit", "title")
	send(c, "POST", coursePath(*course)+"/units", map[string]any{"id": *unit, "title": *title, "subtitle": *subtitle, "label": *label, "hidden": *hidden})
}

func cmdUnitSet(c *client, args []string) {
	fs := flag.NewFlagSet("unit set", flag.ExitOnError)
	course := fs.String("course", "", "課程 id")
	unit := fs.String("unit", "", "單元 id")
	title, subtitle, label, hidden := unitFlags(fs)
	set := parse(fs, args, "course", "unit")
	patch := map[string]any{}
	for name, v := range map[string]any{"title": *title, "subtitle": *subtitle, "label": *label, "hidden": *hidden} {
		if set[name] {
			patch[name] = v
		}
	}
	if len(patch) == 0 {
		fatal("沒有要改的欄位(-title、-subtitle、-label、-hidden)")
	}
	send(c, "PATCH", coursePath(*course, "units", *unit), patch)
}

func cmdUnitDelete(c *client, args []string) {
	fs := flag.NewFlagSet("unit delete", flag.ExitOnError)
	course := fs.String("course", "", "課程 id")
	unit := fs.String("unit", "", "單元 id(要先沒有課)")
	parse(fs, args, "course", "unit")
	send(c, "DELETE", coursePath(*course, "units", *unit), nil)
}

func cmdLessonAdd(c *client, args []string) {
	fs := flag.NewFlagSet("lesson add", flag.ExitOnError)
	course := fs.String("course", "", "課程 id")
	lesson := fs.String("lesson", "", "課號")
	unit := fs.String("unit", "", "放在哪個單元")
	title := fs.String("title", "", "課名")
	summary := fs.String("summary", "", "課程地圖上的一句話")
	status := fs.String("status", "planned", "planned、draft 或 open")
	access := fs.String("access", "", "free、login-free、subscription;空的照這門課")
	minutes := fs.Int("minutes", 0, "預估學習時間(分鐘)")
	parse(fs, args, "course", "lesson", "unit", "title")
	send(c, "POST", coursePath(*course)+"/lessons", map[string]any{"id": *lesson, "unitId": *unit, "title": *title, "summary": *summary, "status": *status, "access": *access, "minutes": *minutes})
}

func cmdLessonDelete(c *client, args []string) {
	fs := flag.NewFlagSet("lesson delete", flag.ExitOnError)
	course := fs.String("course", "", "課程 id")
	lesson := fs.String("lesson", "", "課號(開放中的要先改成 draft 或 planned)")
	parse(fs, args, "course", "lesson")
	send(c, "DELETE", coursePath(*course, "lessons", *lesson), nil)
}
