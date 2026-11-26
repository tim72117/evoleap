package store

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// openEmpty 開一個沒寫課程資料的資料庫:種子由測試自己給,不依賴 課程資料 目前的內容
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

// 課程結構以資料庫為準:已經有課程時,種子改了也不寫入、不刪除
func TestSyncCoursesDatabaseWins(t *testing.T) {
	st := openEmpty(t)
	ctx := context.Background()
	dir := t.TempDir()
	writeFiles(t, dir, map[string]string{"c/a.json": `{"disk":1}`, "lab/l.json": `{"lab":1}`})
	first := `[{"id":"c1","title":"課程一","access":"free","units":[{"id":"0","title":"u","lessons":[{"id":"0.1","title":"A","status":"open","script":"c/a.json"}]}]}]`
	if err := st.syncCoursesJSON(ctx, []byte(first), dir); err != nil {
		t.Fatal(err)
	}
	if err := st.PutScript(ctx, "boss@example.com", "c/a.json", "", "", []byte(`{"pushed":1}`)); err != nil {
		t.Fatal(err)
	}
	// 檔案刪了、種子寫到不存在的檔、拿掉原本的課:都不影響資料庫,目錄裡多出來的檔也不再補進去
	if err := os.Remove(filepath.Join(dir, "c/a.json")); err != nil {
		t.Fatal(err)
	}
	writeFiles(t, dir, map[string]string{"c/fresh.json": `{"fresh":1}`})
	second := `[{"id":"c1","title":"改了","access":"subscription","units":[{"id":"0","title":"u","lessons":[{"id":"0.2","title":"N","status":"open","script":"nope.json"}]}]},
	 {"id":"c2","title":"新課","access":"free","units":[]}]`
	if err := st.syncCoursesJSON(ctx, []byte(second), dir); err != nil {
		t.Fatal(err)
	}
	if got := lessonSummary(t, st, "c1"); got != "0:u[0.1=A(open,c/a.json)]" {
		t.Errorf("結構不變: %s", got)
	}
	if _, _, err := st.CourseAccess(ctx, "c2"); !errors.Is(err, ErrCourseNotFound) {
		t.Errorf("種子新增的課不寫入: %v", err)
	}
	if f, err := st.LessonFileOf(ctx, "c/a.json"); err != nil || f.LessonID != "0.1" || f.Content != `{"pushed":1}` {
		t.Errorf("課的腳本不變: %+v %v", f, err)
	}
	if _, err := st.StudioFileOf(ctx, "c/fresh.json"); !errors.Is(err, ErrLessonFileNotFound) {
		t.Errorf("目錄的新檔不該寫進資料庫: %v", err)
	}
}

// 初始化中途出錯(種子寫到的檔不存在)整批不寫
func TestSyncCoursesAtomic(t *testing.T) {
	st := openEmpty(t)
	ctx := context.Background()
	bad := `[{"id":"c1","title":"t","access":"free","units":[{"id":"0","title":"u","lessons":[{"id":"0.1","title":"A","status":"open","script":"nope.json"}]}]}]`
	if err := st.syncCoursesJSON(ctx, []byte(bad), t.TempDir()); err == nil {
		t.Fatal("缺檔應該報錯")
	}
	if _, _, err := st.CourseAccess(ctx, "c1"); !errors.Is(err, ErrCourseNotFound) {
		t.Errorf("失敗時不能寫一半: %v", err)
	}
}
