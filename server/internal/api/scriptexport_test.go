package api

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

// 備份匯出:只給管理員;兩張表(lesson_files、studio_files)的內容原樣讀出,來源與課別正確,source 可以篩選
func TestScriptExport(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	dir := t.TempDir()
	files := map[string]string{
		"a.json":       "{\"a\": 1}\r\n",
		"a.voice.json": `[{"text":"旁白"}]`,
		"lab/x.json":   `{"x":2}`,
	}
	for p, c := range files {
		if err := os.MkdirAll(filepath.Dir(filepath.Join(dir, p)), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, p), []byte(c), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	units := `[{"id":"0","title":"序章","lessons":[{"id":"0.1","title":"一","status":"open","script":"a.json"}]}]`
	if err := env.st.ReplaceUnitsJSON("software", units); err != nil {
		t.Fatal(err)
	}
	if err := env.st.SyncLessonFilesJSON(context.Background(), []byte(`[{"id":"software","title":"t","access":"free","units":`+units+`}]`), dir); err != nil {
		t.Fatal(err)
	}
	amy := registerCookie(t, env.h, "amy@example.com")
	boss := env.googleCookie(t, "boss@example.com")

	if rec := call(env.h, http.MethodGet, "/api/admin/script-export", "", nil); rec.Code != http.StatusUnauthorized && rec.Code != http.StatusForbidden {
		t.Errorf("訪客: %d", rec.Code)
	}
	if rec := call(env.h, http.MethodGet, "/api/admin/script-export", "", amy); rec.Code != http.StatusForbidden {
		t.Errorf("會員: %d", rec.Code)
	}
	type resp struct {
		Files []struct {
			Source, Path, CourseID, LessonID, Content string
		}
	}
	get := func(q string) resp {
		t.Helper()
		rec := call(env.h, http.MethodGet, "/api/admin/script-export"+q, "", boss)
		if rec.Code != http.StatusOK {
			t.Fatalf("管理員 %s: %d %s", q, rec.Code, rec.Body)
		}
		var r resp
		if err := json.Unmarshal(rec.Body.Bytes(), &r); err != nil {
			t.Fatal(err)
		}
		return r
	}
	all := get("")
	if len(all.Files) != 3 {
		t.Fatalf("全部應有 3 個檔: %+v", all.Files)
	}
	for _, f := range all.Files {
		if f.Content != files[f.Path] {
			t.Errorf("%s 內容要原樣(含 CRLF): %q", f.Path, f.Content)
		}
		switch f.Path {
		case "a.json", "a.voice.json":
			if f.Source != "lesson" || f.CourseID != "software" || f.LessonID != "0.1" {
				t.Errorf("%s 來源/課別不對: %+v", f.Path, f)
			}
		case "lab/x.json":
			if f.Source != "studio" || f.CourseID != "" || f.LessonID != "" {
				t.Errorf("%s 應是研發基地的檔: %+v", f.Path, f)
			}
		default:
			t.Errorf("多出的檔 %s", f.Path)
		}
	}
	if n := len(get("?source=lesson").Files); n != 2 {
		t.Errorf("lesson 篩選: %d", n)
	}
	if n := len(get("?source=studio").Files); n != 1 {
		t.Errorf("studio 篩選: %d", n)
	}
	if rec := call(env.h, http.MethodGet, "/api/admin/script-export?source=zzz", "", boss); rec.Code != http.StatusBadRequest {
		t.Errorf("壞 source: %d", rec.Code)
	}
}
