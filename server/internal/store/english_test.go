package store

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

// 英文版沒翻搜尋標題、描述時退回英文的課名、簡介;譯文表壞掉時仍拿得到中文地圖。
func TestCourseEnglishFallbackAndUnavailable(t *testing.T) {
	m := CourseMap{ID: "web", Title: "中文課名", Summary: "中文簡介", SEOTitle: "中文搜尋標題", Description: "中文描述"}
	pack := &LangPack{Courses: map[string]i18nCourse{"web": {Title: "Web", Summary: "About the web."}}}
	m.Localize(pack)
	if m.SEOTitle != "" || m.Description != "" || m.Title != "Web" || m.Summary != "About the web." {
		t.Fatalf("%+v", m)
	}

	st, err := Open(filepath.Join(t.TempDir(), "a.db"))
	if err != nil {
		t.Fatal(err)
	}
	if err := st.db.Exec("DROP TABLE i18n_translations").Error; err != nil {
		t.Fatal(err)
	}
	zh, en, err := st.CourseMapWithEnglish(context.Background(), "web")
	if !errors.Is(err, ErrEnglishUnavailable) || zh.ID != "web" || en != nil {
		t.Fatalf("zh=%q en=%v err=%v", zh.ID, en, err)
	}
}
