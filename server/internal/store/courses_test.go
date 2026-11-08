package store

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

func TestCoursesSeededOnOpen(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "test.db")
	st, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		id     string
		access Access
		tier   string
	}{
		{"tools", AccessFree, ""},
		{"ai-tools", AccessLoginFree, ""},
		{"vibe-coding-basics", AccessSubscription, "basic"},
		{"ai-agent", AccessSubscription, "advanced"},
	}
	for _, c := range cases {
		access, tier, err := st.CourseAccess(ctx, c.id)
		if err != nil || access != c.access || tier != c.tier {
			t.Errorf("%s: %q %q %v", c.id, access, tier, err)
		}
	}
	if _, _, err := st.CourseAccess(ctx, "nope"); !errors.Is(err, ErrCourseNotFound) {
		t.Errorf("unknown course: %v", err)
	}
	// 再開一次(重啟)同步不會重複或出錯
	st.Close()
	st, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	var n int64
	st.db.Model(&courseRow{}).Count(&n)
	if n != 7 {
		t.Errorf("courses: want 7, got %d", n)
	}
}

func TestKidsCourseMap(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	m, err := st.CourseMapOf(context.Background(), "kids")
	if err != nil {
		t.Fatal(err)
	}
	if m.Access != AccessLoginFree || len(m.Units) == 0 || m.Units[0].ID != "0" {
		t.Fatalf("map: %+v", m)
	}
	first := m.Units[0].Lessons
	if len(first) < 2 || first[0].ID != "0.1" || first[0].Access != AccessFree || first[1].Access != AccessLoginFree {
		t.Errorf("第一課免費預覽、其他照課程(登入後免費): %+v", first)
	}
	if first[0].Status != LessonOpen {
		t.Errorf("0.1 open: %+v", first[0])
	}
	// 沒有單元的課回空清單
	if m, err := st.CourseMapOf(context.Background(), "tools"); err != nil || len(m.Units) != 0 {
		t.Errorf("tools: %+v %v", m, err)
	}
	if _, err := st.CourseMapOf(context.Background(), "nope"); !errors.Is(err, ErrCourseNotFound) {
		t.Errorf("nope: %v", err)
	}
}

func TestWebCourseMap(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	m, err := st.CourseMapOf(context.Background(), "web")
	if err != nil {
		t.Fatal(err)
	}
	if m.Access != AccessLoginFree || len(m.Units) < 2 || m.Units[0].Subtitle == "" {
		t.Fatalf("map: %+v", m)
	}
	open := map[string]Access{}
	for _, u := range m.Units {
		for _, l := range u.Lessons {
			if l.Status == LessonOpen {
				open[l.ID] = l.Access
			}
		}
	}
	// 序章兩課與單元 1 的 1.1、1.2 已開放;只有 0.1 免費預覽
	want := map[string]Access{"0.1": AccessFree, "0.2": AccessLoginFree, "1.1": AccessLoginFree, "1.2": AccessLoginFree}
	if len(open) != len(want) {
		t.Errorf("open lessons: %+v", open)
	}
	for id, a := range want {
		if open[id] != a {
			t.Errorf("%s: want %q, got %q", id, a, open[id])
		}
	}
}
