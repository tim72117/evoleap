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
		{"tools", AccessLoginFree, ""},
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
	if n != 9 {
		t.Errorf("courses: want 9, got %d", n)
	}
}

func TestKidsCourseMap(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	m, err := st.CourseMapOf(context.Background(), "kids", false)
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
	if err := st.ReplaceUnitsJSON("advanced", `[]`); err != nil {
		t.Fatal(err)
	}
	if m, err := st.CourseMapOf(context.Background(), "advanced", false); err != nil || len(m.Units) != 0 {
		t.Errorf("advanced: %+v %v", m, err)
	}
	if _, err := st.CourseMapOf(context.Background(), "nope", false); !errors.Is(err, ErrCourseNotFound) {
		t.Errorf("nope: %v", err)
	}
}

func TestWebCourseMap(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	m, err := st.CourseMapOf(context.Background(), "web", false)
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

// 草稿的課只有管理員看得到狀態與腳本路徑;其他人看到的是規劃中、沒有腳本
func TestDraftLessonsGate(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	units := []unitSeed{{ID: "0", Lessons: []lessonSeed{{ID: "0.1", Status: LessonDraft, Script: "x/0.1.json"}, {ID: "0.2", Status: LessonOpen, Script: "x/0.2.json"}}}}
	if err := syncUnits(st.db, "launch", units); err != nil {
		t.Fatal(err)
	}
	lessons := func(drafts bool) []MapLesson {
		m, err := st.CourseMapOf(context.Background(), "launch", drafts)
		if err != nil {
			t.Fatal(err)
		}
		if !m.HasDrafts() {
			t.Fatalf("drafts=%v:應該有草稿", drafts)
		}
		return m.Units[0].Lessons
	}
	if l := lessons(true)[0]; l.Status != LessonDraft || l.Script != "x/0.1.json" {
		t.Errorf("管理員看得到草稿與腳本: %+v", l)
	}
	l := lessons(false)
	if l[0].Status != LessonPlanned || l[0].Script != "" {
		t.Errorf("其他人看到規劃中、沒有腳本: %+v", l[0])
	}
	if l[1].Status != LessonOpen || l[1].Script != "x/0.2.json" {
		t.Errorf("開放的課每個人都拿得到腳本: %+v", l[1])
	}
	if m, _ := st.CourseMapOf(context.Background(), "web", true); m.HasDrafts() {
		t.Error("web 沒有草稿")
	}
}

func TestSeedRejectsPlannedScript(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	bad := []unitSeed{{ID: "0", Lessons: []lessonSeed{{ID: "0.1", Status: LessonPlanned, Script: "x.json"}}}}
	if err := syncUnits(st.db, "launch", bad); err == nil {
		t.Error("規劃中的課有 script 應該報錯")
	}
	bad[0].Lessons[0] = lessonSeed{ID: "0.1", Status: "hidden"}
	if err := syncUnits(st.db, "launch", bad); err == nil {
		t.Error("不認得的 status 應該報錯")
	}
}

// 每一課的學習時間(分鐘)存進資料庫、課程地圖回傳;沒估的課是 0(JSON 裡沒有這個欄位)
func TestLessonMinutes(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.ReplaceUnitsJSON("tools", `[{"id":"0","title":"序章","lessons":[{"id":"0.1","title":"一","status":"planned","minutes":25},{"id":"0.2","title":"二","status":"planned"}]}]`); err != nil {
		t.Fatal(err)
	}
	m, err := st.CourseMapOf(context.Background(), "tools", false)
	if err != nil {
		t.Fatal(err)
	}
	if got := m.Units[0].Lessons; got[0].Minutes != 25 || got[1].Minutes != 0 {
		t.Errorf("minutes: %+v", got)
	}
}
