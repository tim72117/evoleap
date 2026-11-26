package store

import (
	"context"
	"errors"
	"path/filepath"
	"reflect"
	"testing"
)

// 匯出的課程資訊與腳本寫進空資料庫後,再匯出要一樣;已經有課程時拒絕。
func TestCatalogRoundTrip(t *testing.T) {
	ctx := context.Background()
	src, err := Open(filepath.Join(t.TempDir(), "a.db"))
	if err != nil {
		t.Fatal(err)
	}
	cat, err := src.ExportCatalog(ctx)
	if err != nil {
		t.Fatal(err)
	}
	dst, err := Connect(filepath.Join(t.TempDir(), "b.db"))
	if err != nil {
		t.Fatal(err)
	}
	files := []ScriptExportFile{
		{Source: ScriptSourceLesson, Path: "a.json", CourseID: cat.Courses[0].ID, LessonID: "1", Content: "{}"},
		{Source: ScriptSourceStudio, Path: "b.json", Content: "{}"},
	}
	if len(cat.Translations) == 0 {
		t.Fatal("匯出沒有譯文")
	}
	if err := dst.InitCatalog(ctx, cat, files); err != nil {
		t.Fatal(err)
	}
	got, err := dst.ExportCatalog(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, cat) {
		t.Fatal("寫回後匯出的課程資訊不同")
	}
	if out, err := dst.ExportScripts(ctx, ""); err != nil || len(out) != 2 {
		t.Fatalf("腳本 %d 個,err %v", len(out), err)
	}
	if err := dst.InitCatalog(ctx, cat, nil); !errors.Is(err, ErrCoursesExist) {
		t.Fatalf("已有課程要拒絕,得到 %v", err)
	}
}

// 研發基地已經有腳本(初始化前就上傳過)的空資料庫也要能初始化,內容以備份為準。
func TestInitCatalogOverExistingScripts(t *testing.T) {
	ctx := context.Background()
	src, err := Open(filepath.Join(t.TempDir(), "a.db"))
	if err != nil {
		t.Fatal(err)
	}
	cat, err := src.ExportCatalog(ctx)
	if err != nil {
		t.Fatal(err)
	}
	dst, err := Connect(filepath.Join(t.TempDir(), "b.db"))
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"a.json", "b.json"} {
		if err := dst.PutScript(ctx, "boss@example.com", name, "", "", []byte(`{"from":"before"}`)); err != nil {
			t.Fatal(err)
		}
	}
	files := []ScriptExportFile{
		{Source: ScriptSourceLesson, Path: "a.json", CourseID: cat.Courses[0].ID, LessonID: "1", Content: `{"from":"backup"}`},
		{Source: ScriptSourceStudio, Path: "b.json", Content: `{"from":"backup"}`},
	}
	if err := dst.InitCatalog(ctx, cat, files); err != nil {
		t.Fatal(err)
	}
	out, err := dst.ExportScripts(ctx, "")
	if err != nil || len(out) != 2 {
		t.Fatalf("腳本 %d 個,err %v", len(out), err)
	}
	for _, f := range out {
		if f.Content != `{"from":"backup"}` {
			t.Fatalf("%s %s 沒有用備份的內容:%s", f.Source, f.Path, f.Content)
		}
	}
}
