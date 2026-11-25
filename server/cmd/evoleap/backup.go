package main

import (
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// backupFile 是 backup export 寫進 index.json 的一筆:一個腳本檔的來源、路徑、所屬課與內容的雜湊
type backupFile struct {
	Source   string `json:"source"` // lesson 或 studio
	Path     string `json:"path"`
	CourseID string `json:"courseId,omitempty"`
	LessonID string `json:"lessonId,omitempty"`
	Bytes    int    `json:"bytes"`
	SHA256   string `json:"sha256"`
}

// cmdBackupExport 唯讀地把正式資料庫裡 lesson_files 與 studio_files 的內容匯到本機目錄:
// <out>/lesson/<路徑>、<out>/studio/<路徑>(內容與資料庫逐位元組相同),另外 <out>/index.json 列出每個檔的來源、課別、位元組數與 sha256。
// 只打 GET /api/admin/script-export,不寫伺服器。上傳到 GCS 由 server/backup/export.ps1 做。
func cmdBackupExport(c *client, args []string) {
	fs := flag.NewFlagSet("backup export", flag.ExitOnError)
	out := fs.String("out", "", "匯出到這個目錄(會建立 lesson/、studio/ 與 index.json)")
	parse(fs, args, "out")
	var index []backupFile
	for _, source := range []string{"lesson", "studio"} {
		var res struct {
			Files []struct {
				Source, Path, CourseID, LessonID, Content string
			}
		}
		mustDo(c.do("GET", "/api/admin/script-export?source="+url.QueryEscape(source), nil, &res))
		for _, f := range res.Files {
			if f.Source != source || f.Path == "" || strings.Contains(f.Path, "..") || strings.HasPrefix(f.Path, "/") {
				fatal("伺服器回了不合法的檔案:%q %q", f.Source, f.Path)
			}
			dst := filepath.Join(*out, source, filepath.FromSlash(f.Path))
			mustDo(os.MkdirAll(filepath.Dir(dst), 0o755))
			mustDo(os.WriteFile(dst, []byte(f.Content), 0o644))
			sum := sha256.Sum256([]byte(f.Content))
			index = append(index, backupFile{Source: source, Path: f.Path, CourseID: f.CourseID, LessonID: f.LessonID, Bytes: len(f.Content), SHA256: hex.EncodeToString(sum[:])})
		}
	}
	sort.Slice(index, func(i, j int) bool {
		if index[i].Source != index[j].Source {
			return index[i].Source < index[j].Source
		}
		return index[i].Path < index[j].Path
	})
	// index.json 用 printJSON 同樣的格式(縮排 2 格、不跳脫 HTML)寫檔
	f, err := os.Create(filepath.Join(*out, "index.json"))
	mustDo(err)
	defer f.Close()
	stdout := os.Stdout
	os.Stdout = f
	printJSON(map[string]any{"files": index})
	os.Stdout = stdout
	total := 0
	for _, b := range index {
		total += b.Bytes
	}
	printJSON(map[string]any{"out": *out, "files": len(index), "bytes": total})
}
