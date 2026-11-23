package store

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"gorm.io/gorm"
)

func openSeeded(t *testing.T) *Store {
	t.Helper()
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

// 管理員改一課:檢查規則、記一筆修改紀錄;種子再同步一次會蓋回種子的內容(課程結構以種子為準)
func TestUpdateLessonOverwrittenBySeed(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	minutes := 12
	bad := "hidden"
	if err := st.UpdateLesson(ctx, "boss@example.com", "kids", "0.1", LessonPatch{Status: &bad}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("不認得的 status: %v", err)
	}
	if err := st.UpdateLesson(ctx, "boss@example.com", "kids", "9.9", LessonPatch{Minutes: &minutes}); !errors.Is(err, ErrNotFound) {
		t.Errorf("沒有這一課: %v", err)
	}
	draft := "draft"
	if err := st.UpdateLesson(ctx, "boss@example.com", "kids", "0.1", LessonPatch{Status: &draft, Minutes: &minutes}); err != nil {
		t.Fatal(err)
	}
	if m, err := st.CourseMapOf(ctx, "kids", true); err != nil || m.Units[0].Lessons[0].Status != LessonDraft || m.Units[0].Lessons[0].Minutes != 12 {
		t.Fatalf("改了之後: %+v %v", m.Units[0].Lessons[0], err)
	}
	if err := st.SeedCourses(ctx); err != nil {
		t.Fatal(err)
	}
	m, err := st.CourseMapOf(ctx, "kids", true)
	if err != nil {
		t.Fatal(err)
	}
	if l := m.Units[0].Lessons[0]; l.Status != LessonOpen || l.Minutes == 12 {
		t.Errorf("同步後要是種子的內容: %+v", l)
	}
	changes, err := st.CourseChanges(ctx, 10)
	if err != nil || len(changes) == 0 || changes[0].Action != "lesson.update" || changes[0].Target != "kids 0.1" || changes[0].User != "boss@example.com" {
		t.Errorf("修改紀錄: %+v %v", changes, err)
	}
}

// 管理員改一門課自己的存取方式與課名:檢查規則、沒寫 access 的課跟著變、記一筆修改紀錄;種子再同步一次會蓋回種子的內容
func TestUpdateCourseOverwrittenBySeed(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	if err := st.ReplaceUnitsJSON("kids", `[{"id":"u","title":"U","lessons":[
		{"id":"1","title":"一","status":"open","access":"free"},
		{"id":"2","title":"二","status":"open"}]}]`); err != nil {
		t.Fatal(err)
	}
	if err := st.PutScript(ctx, "boss@example.com", "kids/course-set.json", "kids", "2", []byte(`{}`)); err != nil {
		t.Fatal(err)
	}
	bad, inherit, empty := "hidden", "", "  "
	if err := st.UpdateCourse(ctx, "boss@example.com", "kids", CoursePatch{Access: &bad}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("不認得的 access: %v", err)
	}
	if err := st.UpdateCourse(ctx, "boss@example.com", "kids", CoursePatch{Access: &inherit}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("課程不能沒有 access: %v", err)
	}
	if err := st.UpdateCourse(ctx, "boss@example.com", "kids", CoursePatch{Title: &empty}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("空的課名: %v", err)
	}
	sub := "subscription"
	if err := st.UpdateCourse(ctx, "boss@example.com", "nope", CoursePatch{Access: &sub}); !errors.Is(err, ErrCourseNotFound) {
		t.Errorf("沒有這門課: %v", err)
	}
	title := "兒童課(改)"
	if err := st.UpdateCourse(ctx, "boss@example.com", "kids", CoursePatch{Access: &sub, Title: &title}); err != nil {
		t.Fatal(err)
	}
	m, err := st.CourseMapOf(ctx, "kids", true)
	if err != nil {
		t.Fatal(err)
	}
	if m.Access != AccessSubscription || m.Title != title {
		t.Errorf("改了之後的課程: %s %s", m.Access, m.Title)
	}
	if ls := m.Units[0].Lessons; ls[0].Access != AccessFree || ls[1].Access != AccessSubscription {
		t.Errorf("自己寫了 access 的課不變,沒寫的跟著課程: %+v", ls)
	}
	if a, _, err := st.CourseAccess(ctx, "kids"); err != nil || a != AccessSubscription {
		t.Errorf("CourseAccess: %s %v", a, err)
	}
	// 腳本的把關(GET /api/scripts)每次都讀資料庫,改了立刻生效
	if f, err := st.LessonFileOf(ctx, "kids/course-set.json"); err != nil || f.Access != AccessSubscription {
		t.Errorf("腳本照課程的存取方式: %+v %v", f.Access, err)
	}
	changes, err := st.CourseChanges(ctx, 10)
	if err != nil || len(changes) == 0 || changes[0].Action != "course.update" || changes[0].Target != "kids" || changes[0].User != "boss@example.com" ||
		!strings.Contains(string(changes[0].Detail), `"access":"subscription"`) {
		t.Errorf("修改紀錄: %+v %v", changes, err)
	}
	if len(changes) != 2 {
		t.Errorf("不合規則的修改不該留紀錄(腳本一筆、課程一筆): %d 筆", len(changes))
	}
	if err := st.SeedCourses(ctx); err != nil {
		t.Fatal(err)
	}
	if m, err := st.CourseMapOf(ctx, "kids", true); err != nil || m.Access == AccessSubscription || m.Title == title {
		t.Errorf("同步後要是種子的內容: %s %s %v", m.Access, m.Title, err)
	}
}

// 上傳腳本:掛在某一課底下、只換內容、研發基地的檔;一個檔只能屬於一課;內容要是 JSON
func TestPutScript(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	if err := st.PutScript(ctx, "boss@example.com", "kids/new.json", "kids", "0.1", []byte(`{"a":1}`)); err != nil {
		t.Fatal(err)
	}
	if f, err := st.LessonFileOf(ctx, "kids/new.json"); err != nil || f.LessonID != "0.1" || f.Content != `{"a":1}` {
		t.Errorf("掛在 kids 0.1: %+v %v", f, err)
	}
	if err := st.PutScript(ctx, "boss@example.com", "kids/new.json", "", "", []byte(`{"a":2}`)); err != nil {
		t.Fatal(err)
	}
	if f, _ := st.LessonFileOf(ctx, "kids/new.json"); f.Content != `{"a":2}` || f.LessonID != "0.1" {
		t.Errorf("只換內容,還是 kids 0.1 的: %+v", f)
	}
	if err := st.PutScript(ctx, "boss@example.com", "kids/new.json", "kids", "0.2", []byte(`{}`)); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("一個檔只能屬於一課: %v", err)
	}
	if err := st.PutScript(ctx, "boss@example.com", "lab/x.json", "", "", []byte(`{}`)); err != nil {
		t.Fatal(err)
	}
	if c, err := st.StudioFileOf(ctx, "lab/x.json"); err != nil || c != `{}` {
		t.Errorf("研發基地的檔: %q %v", c, err)
	}
	for _, c := range []struct{ path, body string }{{"x.txt", `{}`}, {"../x.json", `{}`}, {"x.json", `not json`}} {
		if err := st.PutScript(ctx, "boss@example.com", c.path, "", "", []byte(c.body)); !errors.Is(err, ErrInvalidCourseData) {
			t.Errorf("%s: %v", c.path, err)
		}
	}
}

// 用 CLI 指定腳本:要已經上傳,而且屬於這一課
func TestUpdateLessonScriptMustExist(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	missing, other := "kids/nope.json", "kids/0.2.json"
	if err := st.UpdateLesson(ctx, "boss@example.com", "kids", "0.1", LessonPatch{Script: &missing}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("沒上傳的腳本: %v", err)
	}
	if err := st.PutScript(ctx, "boss@example.com", other, "kids", "0.2", []byte(`{}`)); err != nil {
		t.Fatal(err)
	}
	if err := st.UpdateLesson(ctx, "boss@example.com", "kids", "0.1", LessonPatch{Script: &other}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("別一課的腳本: %v", err)
	}
	mine := "kids/mine.json"
	if err := st.PutScript(ctx, "boss@example.com", mine, "kids", "0.1", []byte(`{}`)); err != nil {
		t.Fatal(err)
	}
	if err := st.UpdateLesson(ctx, "boss@example.com", "kids", "0.1", LessonPatch{Script: &mine}); err != nil {
		t.Errorf("自己的腳本: %v", err)
	}
}

// 種子中間插入新課:順序照種子重排,不會撞號;既有的課內容也照種子
func TestUpsertUnitsReorders(t *testing.T) {
	st := openSeeded(t)
	lesson := func(id string) lessonSeed { return lessonSeed{ID: id, Title: id, Status: LessonPlanned} }
	if err := st.db.Transaction(func(tx *gorm.DB) error {
		return syncUnits(tx, "software", []unitSeed{{ID: "0", Title: "u", Lessons: []lessonSeed{lesson("a"), lesson("c")}}})
	}); err != nil {
		t.Fatal(err)
	}
	if err := st.db.Model(&lessonRow{}).Where("course_id = ? AND id = ?", "software", "c").Update("title", "改過的").Error; err != nil {
		t.Fatal(err)
	}
	if err := st.db.Transaction(func(tx *gorm.DB) error {
		return upsertUnits(tx, "software", []unitSeed{{ID: "0", Title: "u", Lessons: []lessonSeed{lesson("a"), lesson("b"), lesson("c")}}})
	}); err != nil {
		t.Fatal(err)
	}
	m, err := st.CourseMapOf(context.Background(), "software", true)
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, l := range m.Units[0].Lessons {
		got = append(got, l.ID+":"+l.Title)
	}
	if strings.Join(got, ",") != "a:a,b:b,c:c" {
		t.Errorf("順序與內容照種子: %v", got)
	}
}

// 規劃中的課不能上傳腳本(要先改成草稿)
func TestPutScriptRefusesPlannedLesson(t *testing.T) {
	st := openSeeded(t)
	if err := st.PutScript(context.Background(), "boss@example.com", "web/x.json", "web", "2.1", []byte(`{}`)); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("規劃中的課: %v", err)
	}
}

// 種子把課搬到別的單元:課跟著搬(結構照種子)
func TestUpsertUnitsMovesLesson(t *testing.T) {
	st := openSeeded(t)
	lesson := func(id string) lessonSeed { return lessonSeed{ID: id, Title: id, Status: LessonPlanned} }
	if err := st.db.Transaction(func(tx *gorm.DB) error {
		return syncUnits(tx, "software", []unitSeed{{ID: "1", Title: "u1", Lessons: []lessonSeed{lesson("a"), lesson("b")}}, {ID: "2", Title: "u2"}})
	}); err != nil {
		t.Fatal(err)
	}
	if err := st.db.Transaction(func(tx *gorm.DB) error {
		return upsertUnits(tx, "software", []unitSeed{{ID: "1", Title: "u1", Lessons: []lessonSeed{lesson("a")}}, {ID: "2", Title: "u2", Lessons: []lessonSeed{lesson("b")}}})
	}); err != nil {
		t.Fatal(err)
	}
	m, err := st.CourseMapOf(context.Background(), "software", true)
	if err != nil {
		t.Fatal(err)
	}
	if len(m.Units) != 2 || len(m.Units[1].Lessons) != 1 || m.Units[1].Lessons[0].ID != "b" {
		t.Errorf("b 要搬到單元 2: %+v", m.Units)
	}
}
