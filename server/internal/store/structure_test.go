package store

import (
	"context"
	"errors"
	"github.com/tim72117/evoleap/internal/store/fixture"
	"testing"
)

// 新增、排序、搬移、刪除課程結構;刪除時腳本移到研發基地;同步不會蓋掉
func TestStructure(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	const u = "boss@example.com"
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	rejected := func(name string, err error) {
		t.Helper()
		if !errors.Is(err, ErrInvalidCourseData) {
			t.Errorf("%s 該被擋: %v", name, err)
		}
	}
	must(st.CreateCourse(ctx, u, NewCourse{ID: "demo", Title: "示範", Access: "free"}))
	rejected("重複的課程", st.CreateCourse(ctx, u, NewCourse{ID: "demo", Title: "x", Access: "free"}))
	must(st.CreateUnit(ctx, u, "demo", NewUnit{ID: "a", Title: "甲"}))
	must(st.CreateUnit(ctx, u, "demo", NewUnit{ID: "b", Title: "乙"}))
	must(st.CreateLesson(ctx, u, "demo", NewLesson{ID: "2.1", UnitID: "b", Title: "後"}))
	// 後加的課放在前面的單元,要排在它所屬單元裡
	must(st.CreateLesson(ctx, u, "demo", NewLesson{ID: "1.1", UnitID: "a", Title: "前", Status: "draft"}))
	rejected("找不到單元", st.CreateLesson(ctx, u, "demo", NewLesson{ID: "9", UnitID: "z", Title: "x"}))
	want := func(s string) {
		t.Helper()
		if got := lessonSummary(t, st, "demo"); got != s {
			t.Errorf("大綱: %s", got)
		}
	}
	want("a:甲[1.1=前(draft,)] b:乙[2.1=後(planned,)]")

	rejected("大綱少列一課", st.SetOutline(ctx, u, "demo", []OutlineUnit{{ID: "a", Lessons: []string{"1.1"}}, {ID: "b"}}))
	must(st.SetOutline(ctx, u, "demo", []OutlineUnit{{ID: "b", Lessons: []string{"1.1", "2.1"}}, {ID: "a"}}))
	want("b:乙[1.1=前(draft,) 2.1=後(planned,)] a:甲[]")

	title := "乙(改)"
	must(st.UpdateUnit(ctx, u, "demo", "b", UnitPatch{Title: &title}))
	rejected("單元還有課", st.DeleteUnit(ctx, u, "demo", "b"))
	rejected("課程還有單元", st.DeleteCourse(ctx, u, "demo"))
	must(st.PutScript(ctx, u, "demo/1.json", "demo", "1.1", []byte(`{"a":1}`)))
	open := "open"
	must(st.UpdateLesson(ctx, u, "demo", "1.1", LessonPatch{Status: &open}))
	rejected("開放中的課", st.DeleteLesson(ctx, u, "demo", "1.1"))
	draft := "draft"
	must(st.UpdateLesson(ctx, u, "demo", "1.1", LessonPatch{Status: &draft}))
	must(st.DeleteLesson(ctx, u, "demo", "1.1"))
	if c, err := st.StudioFileOf(ctx, "demo/1.json"); err != nil || c != `{"a":1}` {
		t.Errorf("腳本移到研發基地: %q %v", c, err)
	}

	// 簡介影片:研發基地的檔改掛成課程的
	intro := "demo/1.json"
	must(st.UpdateCourse(ctx, u, "demo", CoursePatch{IntroScript: &intro}))
	if f, err := st.LessonFileOf(ctx, intro); err != nil || f.CourseID != "demo" || f.LessonID != "" {
		t.Errorf("簡介影片: %+v %v", f, err)
	}

	cs, err := st.AdminCourses(ctx)
	must(err)
	ids := []string{"demo"}
	for _, c := range cs {
		if c.ID != "demo" {
			ids = append(ids, c.ID)
		}
	}
	rejected("順序少列", st.OrderCourses(ctx, u, ids[1:]))
	must(st.OrderCourses(ctx, u, ids))

	must(st.Seed(ctx, fixture.Topics, fixture.Courses))
	want("b:乙(改)[2.1=後(planned,)] a:甲[]")

	must(st.DeleteLesson(ctx, u, "demo", "2.1"))
	must(st.DeleteUnit(ctx, u, "demo", "a"))
	must(st.DeleteUnit(ctx, u, "demo", "b"))
	must(st.DeleteCourse(ctx, u, "demo"))
	if _, _, err := st.CourseAccess(ctx, "demo"); !errors.Is(err, ErrCourseNotFound) {
		t.Errorf("課程已刪: %v", err)
	}
}
