package store

import (
	"context"
	"path/filepath"
	"testing"
)

// 刪掉的課,譯文一起刪(同課號重建不沿用);網址撞名的課號不能新增。
func TestDeletedLessonDropsTranslationsAndSlugClash(t *testing.T) {
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
	var u unitRow
	must(st.db.First(&u, "course_id = ?", "web").Error)
	add := func(id string) error {
		return st.CreateLesson(ctx, "t", "web", NewLesson{ID: id, UnitID: u.ID, Title: "新課 " + id})
	}
	must(add("9.1"))
	if err := add("9-1"); err == nil {
		t.Fatal("網址撞名要拒絕")
	}
	must(st.db.Create(&i18nTranslationRow{Kind: I18nLesson, Ref: "web/9.1", Path: "title", Lang: LangEN, Value: "Old", Status: I18nPublished, SourceHash: "x", Origin: I18nOriginHuman, UpdatedAt: now()}).Error)
	must(st.DeleteLesson(ctx, "t", "web", "9.1"))
	var n int64
	must(st.db.Model(&i18nTranslationRow{}).Where("ref = ?", "web/9.1").Count(&n).Error)
	if n != 0 {
		t.Fatalf("刪課後還有 %d 筆譯文", n)
	}
}
