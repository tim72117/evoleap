package store

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
)

// 簡介影片的旁白、音軌清單跟著主腳本掛到課程;換掉或拿掉後移回研發基地。超長欄位回說明而不是寫入。
func TestIntroScriptFilesFollow(t *testing.T) {
	ctx := context.Background()
	st, err := Open(filepath.Join(t.TempDir(), "a.db"))
	if err != nil {
		t.Fatal(err)
	}
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	put := func(path string) { must(st.PutScript(ctx, "t", path, "", "", []byte("{}"))) }
	owned := func() int64 {
		var n int64
		must(st.db.Model(&lessonFileRow{}).Where("path LIKE ?", "zz/%").Count(&n).Error)
		return n
	}
	set := func(v string) { must(st.UpdateCourse(ctx, "t", "web", CoursePatch{IntroScript: &v})) }
	put("zz/a.json")
	put("zz/a.voice.json")
	set("zz/a.json")
	put("zz/a.mix.json") // 設好之後才傳
	if n := owned(); n != 3 {
		t.Fatalf("掛在課程的檔 %d 個,要 3 個", n)
	}
	set("")
	if n := owned(); n != 0 {
		t.Fatalf("拿掉簡介後還掛著 %d 個", n)
	}
	if err := st.CreateUnit(ctx, "t", "web", NewUnit{ID: "zz", Title: "x", Label: strings.Repeat("字", 33)}); err == nil {
		t.Fatal("超長的 label 要拒絕")
	}
}
