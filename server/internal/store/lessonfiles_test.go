package store

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 每一課的腳本檔(script、files 與存在的 .voice.json)讀進 lesson_files,查得到檔案所屬的課、狀態與實際的存取方式
func TestSyncLessonFiles(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	dir := t.TempDir()
	write := func(p, body string) {
		if err := os.MkdirAll(filepath.Dir(filepath.Join(dir, p)), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, p), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("x/0.1.json", `{"a":1}`)
	write("x/0.1.voice.json", `{"clips":{}}`)
	write("x/0.1-sub.json", `{"b":2}`)
	write("lab/demo.json", `{"c":3}`)
	units := `[{"id":"0","title":"序章","lessons":[{"id":"0.1","title":"一","access":"free","status":"open","script":"x/0.1.json","files":["x/0.1-sub.json"]}]}]`
	if err := st.ReplaceUnitsJSON("tools", units); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if err := st.SyncLessonFilesJSON(ctx, []byte(`[{"id":"tools","title":"t","access":"login-free","units":`+units+`}]`), dir); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{"x/0.1.json", "x/0.1.voice.json", "x/0.1-sub.json"} {
		f, err := st.LessonFileOf(ctx, p)
		if err != nil || f.CourseID != "tools" || f.LessonID != "0.1" || f.Status != LessonOpen || f.Access != AccessFree {
			t.Errorf("%s: %+v %v", p, f, err)
		}
	}
	if _, err := st.LessonFileOf(ctx, "x/0.1.mix.json"); !errors.Is(err, ErrLessonFileNotFound) {
		t.Errorf("沒有的檔: %v", err)
	}
	// 不屬於任何一課的 .json 放進研發基地的表
	if c, err := st.StudioFileOf(ctx, "lab/demo.json"); err != nil || c != `{"c":3}` {
		t.Errorf("studio: %q %v", c, err)
	}
	if _, err := st.StudioFileOf(ctx, "x/0.1.json"); !errors.Is(err, ErrLessonFileNotFound) {
		t.Errorf("課程的腳本不該在研發基地的表: %v", err)
	}
	// 種子寫到的檔案不存在:啟動要失敗
	if err := st.SyncLessonFilesJSON(ctx, []byte(`[{"id":"tools","title":"t","access":"free","units":[{"id":"0","title":"序章","lessons":[{"id":"0.1","title":"一","status":"open","script":"x/nope.json"}]}]}]`), dir); err == nil {
		t.Error("缺檔應該報錯")
	}
}

// 同一課寫了兩次同一個檔就略過;兩課寫到同一個檔要報出是哪兩課。檔案所屬的課不在了就當作沒有這個檔
func TestLessonFilesOwnership(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	dir := t.TempDir()
	for _, p := range []string{"a.json", "a.voice.json"} {
		if err := os.WriteFile(filepath.Join(dir, p), []byte(`{}`), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	ctx := context.Background()
	twice := `[{"id":"tools","title":"t","access":"free","units":[{"id":"0","title":"序章","lessons":[{"id":"9.9","title":"一","status":"open","script":"a.json","files":["a.voice.json"]}]}]}]`
	if err := st.SyncLessonFilesJSON(ctx, []byte(twice), dir); err != nil {
		t.Errorf("同一課寫兩次應該略過: %v", err)
	}
	shared := `[{"id":"tools","title":"t","access":"free","units":[{"id":"0","title":"序章","lessons":[{"id":"0.1","title":"一","status":"open","script":"a.json"},{"id":"0.2","title":"二","status":"open","files":["a.json"]}]}]}]`
	if err := st.SyncLessonFilesJSON(ctx, []byte(shared), dir); err == nil || !strings.Contains(err.Error(), "tools 0.1") || !strings.Contains(err.Error(), "tools 0.2") {
		t.Errorf("兩課共用一個檔要報出兩課: %v", err)
	}
	// 資料庫的 tools 沒有 9.9 這一課:檔案在,課不在
	if err := st.SyncLessonFilesJSON(ctx, []byte(twice), dir); err != nil {
		t.Fatal(err)
	}
	if _, err := st.LessonFileOf(ctx, "a.json"); !errors.Is(err, ErrLessonFileNotFound) {
		t.Errorf("課不在要當作沒有這個檔: %v", err)
	}
}
