package store

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// openEmpty 開一個沒寫課程資料的資料庫:種子由測試自己給,不依賴 courses_seed.json 目前的內容
func openEmpty(t *testing.T) *Store {
	t.Helper()
	st, err := Connect(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

func writeFiles(t *testing.T, dir string, files map[string]string) {
	t.Helper()
	for p, body := range files {
		full := filepath.Join(dir, p)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func lessonSummary(t *testing.T, st *Store, course string) string {
	t.Helper()
	m, err := st.CourseMapOf(context.Background(), course, true)
	if err != nil {
		t.Fatal(err)
	}
	var parts []string
	for _, u := range m.Units {
		var ls []string
		for _, l := range u.Lessons {
			ls = append(ls, l.ID+"="+l.Title+"("+l.Status+","+l.Script+")")
		}
		parts = append(parts, u.ID+":"+u.Title+"["+strings.Join(ls, " ")+"]")
	}
	return strings.Join(parts, " ")
}

// 課程結構以種子為準:課號重新編號時內容跟著種子換、欄位更新、種子拿掉的課與單元刪除,種子沒有的課程不動
func TestSyncCoursesSeedWins(t *testing.T) {
	st := openEmpty(t)
	ctx := context.Background()
	dir := t.TempDir()
	writeFiles(t, dir, map[string]string{
		"c/a.json": `{"a":1}`, "c/b.json": `{"b":1}`, "c/new.json": `{"new":1}`,
		"c/old.json": `{"old":1}`, "o/x.json": `{"x":1}`,
	})
	first := `[
	 {"id":"c1","title":"課程一","access":"login-free","units":[
	  {"id":"0","title":"序章","lessons":[
	   {"id":"0.1","title":"A","status":"open","script":"c/a.json","minutes":10},
	   {"id":"0.2","title":"B","status":"draft","script":"c/b.json"}]},
	  {"id":"9","title":"要拿掉的單元","lessons":[{"id":"9.1","title":"舊","status":"open","script":"c/old.json"}]}]},
	 {"id":"other","title":"別的課程","access":"free","units":[
	  {"id":"0","title":"u","lessons":[{"id":"0.1","title":"X","status":"open","script":"o/x.json"}]}]}
	]`
	if err := st.syncCoursesJSON(ctx, []byte(first), dir); err != nil {
		t.Fatal(err)
	}
	if got := lessonSummary(t, st, "c1"); got != "0:序章[0.1=A(open,c/a.json) 0.2=B(draft,c/b.json)] 9:要拿掉的單元[9.1=舊(open,c/old.json)]" {
		t.Fatalf("第一次同步: %s", got)
	}
	// 新的種子:中間插入新的 0.1,原本的 0.1、0.2 變成 0.2、0.3;單元 9 拿掉;課程欄位改了;other 不在種子裡
	second := `[
	 {"id":"c1","title":"課程一(新名)","access":"subscription","tier":"basic","units":[
	  {"id":"0","title":"序章(新)","lessons":[
	   {"id":"0.1","title":"N","status":"draft","script":"c/new.json","minutes":30},
	   {"id":"0.2","title":"A","status":"open","script":"c/a.json","access":"free","minutes":10},
	   {"id":"0.3","title":"B","status":"open","script":"c/b.json"}]}]}
	]`
	if err := st.syncCoursesJSON(ctx, []byte(second), dir); err != nil {
		t.Fatal(err)
	}
	if got := lessonSummary(t, st, "c1"); got != "0:序章(新)[0.1=N(draft,c/new.json) 0.2=A(open,c/a.json) 0.3=B(open,c/b.json)]" {
		t.Errorf("照種子重新編號、刪掉單元 9: %s", got)
	}
	m, _ := st.CourseMapOf(ctx, "c1", true)
	if m.Title != "課程一(新名)" || m.Access != AccessSubscription || m.Tier != "basic" {
		t.Errorf("課程欄位照種子: %+v", m)
	}
	if l := m.Units[0].Lessons; l[0].Minutes != 30 || l[1].Access != AccessFree || l[2].Access != AccessSubscription {
		t.Errorf("課的欄位照種子: %+v", l)
	}
	var n int64
	st.db.Model(&lessonRow{}).Where("course_id = ? AND id = ?", "c1", "9.1").Count(&n)
	if n != 0 {
		t.Error("種子拿掉的課要刪掉")
	}
	st.db.Model(&unitRow{}).Where("course_id = ? AND id = ?", "c1", "9").Count(&n)
	if n != 0 {
		t.Error("種子拿掉的單元要刪掉")
	}
	// 腳本檔跟著課號走
	for path, lesson := range map[string]string{"c/new.json": "0.1", "c/a.json": "0.2", "c/b.json": "0.3"} {
		if f, err := st.LessonFileOf(ctx, path); err != nil || f.CourseID != "c1" || f.LessonID != lesson {
			t.Errorf("%s 要掛在 %s: %+v %v", path, lesson, f, err)
		}
	}
	// 種子沒有的課程整門不動
	if got := lessonSummary(t, st, "other"); got != "0:u[0.1=X(open,o/x.json)]" {
		t.Errorf("種子沒有的課程不動: %s", got)
	}
	if f, err := st.LessonFileOf(ctx, "o/x.json"); err != nil || f.CourseID != "other" {
		t.Errorf("種子沒有的課程的腳本檔不動: %+v %v", f, err)
	}
	if _, err := st.StudioFileOf(ctx, "o/x.json"); !errors.Is(err, ErrLessonFileNotFound) {
		t.Errorf("種子沒有的課程的腳本檔不該進研發基地: %v", err)
	}
	// 種子給空的 units:這門課的單元與課全部刪掉
	if err := st.syncCoursesJSON(ctx, []byte(`[{"id":"c1","title":"課程一","access":"free","units":[]}]`), dir); err != nil {
		t.Fatal(err)
	}
	if got := lessonSummary(t, st, "c1"); got != "" {
		t.Errorf("units 是空陣列要全部刪掉: %s", got)
	}
}

// 腳本檔屬於哪一課照種子,內容以資料庫為準;種子不再指定的檔帶著資料庫的內容移到研發基地,不重複
func TestSyncCoursesLessonFiles(t *testing.T) {
	st := openEmpty(t)
	ctx := context.Background()
	dir := t.TempDir()
	writeFiles(t, dir, map[string]string{
		"c/a.json": `{"disk":1}`, "c/gone.json": `{"gone":"disk"}`, "c/gone.voice.json": `{"clips":{}}`,
		"lab/l.json": `{"lab":1}`,
	})
	first := `[{"id":"c1","title":"t","access":"free","units":[{"id":"0","title":"u","lessons":[
	  {"id":"0.1","title":"A","status":"open","script":"c/a.json"},
	  {"id":"0.2","title":"G","status":"open","script":"c/gone.json"}]}]}]`
	if err := st.syncCoursesJSON(ctx, []byte(first), dir); err != nil {
		t.Fatal(err)
	}
	// 上線後用 script push 換了內容(資料庫),檔案也改了:同步不能用檔案蓋掉資料庫的內容
	if err := st.PutScript(ctx, "boss@example.com", "c/a.json", "", "", []byte(`{"pushed":1}`)); err != nil {
		t.Fatal(err)
	}
	if err := st.PutScript(ctx, "boss@example.com", "c/gone.json", "", "", []byte(`{"gone":"pushed"}`)); err != nil {
		t.Fatal(err)
	}
	writeFiles(t, dir, map[string]string{"c/a.json": `{"disk":2}`, "c/fresh.json": `{"fresh":1}`})
	// 新的種子:a.json 改掛到 0.3,0.2 拿掉(gone.json 不再指定),新的 fresh.json
	second := `[{"id":"c1","title":"t","access":"free","units":[{"id":"0","title":"u","lessons":[
	  {"id":"0.1","title":"F","status":"open","script":"c/fresh.json"},
	  {"id":"0.3","title":"A","status":"open","script":"c/a.json"}]}]}]`
	for i := 0; i < 2; i++ { // 跑兩次:結果一樣、不重複
		if err := st.syncCoursesJSON(ctx, []byte(second), dir); err != nil {
			t.Fatal(err)
		}
		if f, err := st.LessonFileOf(ctx, "c/a.json"); err != nil || f.LessonID != "0.3" || f.Content != `{"pushed":1}` {
			t.Errorf("a.json 改掛到 0.3、內容是資料庫的: %+v %v", f, err)
		}
		if f, err := st.LessonFileOf(ctx, "c/fresh.json"); err != nil || f.LessonID != "0.1" || f.Content != `{"fresh":1}` {
			t.Errorf("新的檔讀檔案內容: %+v %v", f, err)
		}
		for _, p := range []string{"c/gone.json", "c/gone.voice.json"} {
			var n int64
			st.db.Model(&lessonFileRow{}).Where("path = ?", p).Count(&n)
			if n != 0 {
				t.Errorf("%s 不再屬於任何一課,要移出 lesson_files", p)
			}
		}
		if c, err := st.StudioFileOf(ctx, "c/gone.json"); err != nil || c != `{"gone":"pushed"}` {
			t.Errorf("移到研發基地,帶著資料庫的內容: %q %v", c, err)
		}
		if c, err := st.StudioFileOf(ctx, "c/gone.voice.json"); err != nil || c != `{"clips":{}}` {
			t.Errorf("旁白清單也移到研發基地: %q %v", c, err)
		}
		if c, err := st.StudioFileOf(ctx, "lab/l.json"); err != nil || c != `{"lab":1}` {
			t.Errorf("研發基地的檔: %q %v", c, err)
		}
		paths, err := st.ScriptPaths(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if got := strings.Join(paths, ","); got != "c/a.json,c/fresh.json,c/gone.json,c/gone.voice.json,lab/l.json" {
			t.Errorf("腳本清單: %s", got)
		}
		var studio int64
		st.db.Model(&studioFileRow{}).Count(&studio)
		if studio != 3 {
			t.Errorf("研發基地的檔要 3 個(gone、gone.voice、lab),不重複: %d", studio)
		}
	}
}

// 中途出錯(種子寫到的檔不存在)整批不寫:課程結構也不能先改了
func TestSyncCoursesAtomic(t *testing.T) {
	st := openEmpty(t)
	ctx := context.Background()
	dir := t.TempDir()
	writeFiles(t, dir, map[string]string{"a.json": `{}`})
	if err := st.syncCoursesJSON(ctx, []byte(`[{"id":"c1","title":"t","access":"free","units":[{"id":"0","title":"u","lessons":[{"id":"0.1","title":"A","status":"open","script":"a.json"}]}]}]`), dir); err != nil {
		t.Fatal(err)
	}
	bad := `[{"id":"c1","title":"改了","access":"free","units":[{"id":"0","title":"u","lessons":[{"id":"0.1","title":"A","status":"open","script":"nope.json"}]}]}]`
	if err := st.syncCoursesJSON(ctx, []byte(bad), dir); err == nil {
		t.Fatal("缺檔應該報錯")
	}
	if m, _ := st.CourseMapOf(ctx, "c1", true); m.Title != "t" {
		t.Errorf("失敗時不能寫一半: %+v", m)
	}
}
