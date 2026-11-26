package main

import (
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
)

// cmdInit 把 -dir 目錄(格式同 backup export 的輸出)的課程資訊與腳本寫進空資料庫。
func cmdInit(c *client, args []string) {
	fs := flag.NewFlagSet("catalog init", flag.ExitOnError)
	dir := fs.String("dir", "", "含 catalog.json、index.json、lesson/、studio/ 的目錄")
	parse(fs, args, "dir")
	body := map[string]any{}
	readJSON := func(name string, v any) {
		b, err := os.ReadFile(filepath.Join(*dir, name))
		mustDo(err)
		mustDo(json.Unmarshal(b, v))
	}
	readJSON("catalog.json", &body)
	var index struct {
		Files []backupFile `json:"files"`
	}
	readJSON("index.json", &index)
	files := []map[string]string{}
	for _, f := range index.Files {
		rel := filepath.Join(f.Source, filepath.FromSlash(f.Path))
		if !filepath.IsLocal(rel) {
			fatal("不合法的路徑:%q", rel)
		}
		b, err := os.ReadFile(filepath.Join(*dir, rel))
		mustDo(err)
		files = append(files, map[string]string{"source": f.Source, "path": f.Path, "courseId": f.CourseID, "lessonId": f.LessonID, "content": string(b)})
	}
	body["files"] = files
	var res map[string]any
	mustDo(c.do("POST", "/api/admin/init", body, &res))
	printJSON(res)
}
