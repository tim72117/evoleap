package store

import (
	"context"
	"errors"
	"github.com/tim72117/evoleap/internal/store/fixture"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"gorm.io/gorm"
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
		{"software", AccessLoginFree, ""},
		{"ai-agent", AccessLoginFree, "advanced"},
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
	m, err := st.CourseMapOf(context.Background(), "kids", false)
	if err != nil {
		t.Fatal(err)
	}
	if m.Access != AccessLoginFree || len(m.Units) == 0 || m.Units[0].ID != "0" {
		t.Fatalf("map: %+v", m)
	}
	first := m.Units[0].Lessons
	if len(first) < 1 || first[0].ID != "0.1" {
		t.Fatalf("first unit: %+v", first)
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
	// 序章兩課與單元 1 的 1.1、1.2 已開放(存取方式由 api 的 TestLessonFileGateFollowsData 依資料判斷)
	want := []string{"0.1", "0.2", "1.1", "1.2"}
	if len(open) != len(want) {
		t.Errorf("open lessons: %+v", open)
	}
	for _, id := range want {
		if _, ok := open[id]; !ok {
			t.Errorf("%s 應該是開放的課: %+v", id, open)
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
	if m, _ := st.CourseMapOf(context.Background(), "claude-code", true); m.HasDrafts() {
		t.Error("claude-code 沒有草稿")
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
	if err := st.ReplaceUnitsJSON("software", `[{"id":"0","title":"序章","lessons":[{"id":"0.1","title":"一","status":"planned","minutes":25},{"id":"0.2","title":"二","status":"planned"}]}]`); err != nil {
		t.Fatal(err)
	}
	m, err := st.CourseMapOf(context.Background(), "software", false)
	if err != nil {
		t.Fatal(err)
	}
	if got := m.Units[0].Lessons; got[0].Minutes != 25 || got[1].Minutes != 0 {
		t.Errorf("minutes: %+v", got)
	}
}

// 測試資料初始化(Seed):課程資訊與單元的 label、hidden 寫進資料庫,不合規則的資料整批報錯
func TestSeedCourseInfoRoundTrip(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	sync := func(seed string) error {
		seeds, err := parseCourseSeed([]byte(seed))
		if err != nil {
			t.Fatal(err)
		}
		return st.db.Transaction(func(tx *gorm.DB) error { return seedCourses(tx, seeds) })
	}
	const v1 = `[{"id":"demo","title":"示範","access":"free","summary":"簡介","about":["甲","乙"],"seoTitle":"搜尋","description":"描述","art":"agent","introScript":"guide/x.json",
		"units":[{"id":"u","title":"U","subtitle":"","label":"起步","hidden":true,"lessons":[]}]}]`
	if err := sync(v1); err != nil {
		t.Fatal(err)
	}
	m, err := st.CourseMapOf(ctx, "demo", true)
	if err != nil {
		t.Fatal(err)
	}
	if m.Summary != "簡介" || !reflect.DeepEqual(m.About, []string{"甲", "乙"}) || m.SEOTitle != "搜尋" || m.Description != "描述" || m.Art != "agent" || m.IntroScript != "guide/x.json" {
		t.Errorf("課程資訊: %+v", m)
	}
	if u := m.Units[0]; u.Label != "起步" || !u.Hidden {
		t.Errorf("單元: %+v", u)
	}
	const v2 = `[{"id":"demo","title":"示範","access":"free","summary":"新簡介","about":["丙"],"art":"chat",
		"units":[{"id":"u","title":"U","subtitle":"","lessons":[]}]}]`
	if err := sync(v2); err != nil {
		t.Fatal(err)
	}
	m, _ = st.CourseMapOf(ctx, "demo", true)
	if m.Summary != "新簡介" || !reflect.DeepEqual(m.About, []string{"丙"}) || m.SEOTitle != "" || m.Description != "" || m.Art != "chat" || m.IntroScript != "" {
		t.Errorf("再同步要跟著種子: %+v", m)
	}
	if u := m.Units[0]; u.Label != "" || u.Hidden {
		t.Errorf("單元的 label、hidden 要跟著種子清掉: %+v", u)
	}
	if err := sync(`[{"id":"demo","title":"示範","access":"free","units":[]}]`); err != nil {
		t.Fatal(err)
	}
	if m, _ = st.CourseMapOf(ctx, "demo", true); m.Summary != "" || m.About != nil || m.Art != "" {
		t.Errorf("拿掉就清掉: %+v", m)
	}
	long := strings.Repeat("字", 501)
	for name, seed := range map[string]string{
		"art":        `[{"id":"demo","title":"示範","access":"free","art":"pink","units":[]}]`,
		"intro-lab":  `[{"id":"demo","title":"示範","access":"free","introScript":"lab/x.json","units":[]}]`,
		"intro-dots": `[{"id":"demo","title":"示範","access":"free","introScript":"../x.json","units":[]}]`,
		"intro-ext":  `[{"id":"demo","title":"示範","access":"free","introScript":"guide/x.txt","units":[]}]`,
		"summary":    `[{"id":"demo","title":"示範","access":"free","summary":"` + long + `","units":[]}]`,
		"空段落":        `[{"id":"demo","title":"示範","access":"free","about":["甲",""],"units":[]}]`,
		"含空行":        `[{"id":"demo","title":"示範","access":"free","about":["甲\n\n乙"],"units":[]}]`,
	} {
		if err := sync(seed); !errors.Is(err, ErrInvalidCourseData) {
			t.Errorf("%s: 應該報錯 %v", name, err)
		}
	}
}

// 管理員改課程資訊:每個欄位都能改、能清掉;不合規則的整筆不改、不留紀錄
func TestUpdateCourseInfo(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	str := func(s string) *string { return &s }
	about := []string{"第一段", "第二段"}
	patch := CoursePatch{Summary: str(" 簡介 "), About: &about, SEOTitle: str("搜尋標題"), Description: str("搜尋描述"), Art: str("advanced"), IntroScript: str("guide/a.json")}
	if err := st.UpdateCourse(ctx, "boss@example.com", "kids", patch); err != nil {
		t.Fatal(err)
	}
	m, _ := st.CourseMapOf(ctx, "kids", true)
	if m.Summary != "簡介" || !reflect.DeepEqual(m.About, about) || m.SEOTitle != "搜尋標題" || m.Description != "搜尋描述" || m.Art != "advanced" || m.IntroScript != "guide/a.json" {
		t.Errorf("改了之後: %+v", m)
	}
	// 只改一個欄位,其他不動
	if err := st.UpdateCourse(ctx, "boss@example.com", "kids", CoursePatch{Art: str("tools")}); err != nil {
		t.Fatal(err)
	}
	if m, _ = st.CourseMapOf(ctx, "kids", true); m.Art != "tools" || m.Summary != "簡介" || len(m.About) != 2 {
		t.Errorf("只改 art: %+v", m)
	}
	changes, err := st.CourseChanges(ctx, 5)
	if err != nil || len(changes) == 0 || changes[0].Action != "course.update" || !strings.Contains(string(changes[0].Detail), `"art":"tools"`) {
		t.Errorf("修改紀錄: %+v %v", changes, err)
	}
	if changes[1].Action != "course.update" || !strings.Contains(string(changes[1].Detail), `"summary"`) || !strings.Contains(string(changes[1].Detail), `"about"`) {
		t.Errorf("紀錄要有這次的修改內容: %s", changes[1].Detail)
	}
	before := len(changes)
	// 不合規則:整筆不改(同一筆裡合法的欄位也不能寫進去)
	tooLong := strings.Repeat("字", 501)
	for name, bad := range map[string]CoursePatch{
		"art":       {Summary: str("不該寫入"), Art: str("pink")},
		"summary":   {Summary: &tooLong},
		"desc":      {Description: &tooLong},
		"introLab":  {IntroScript: str("lab/a.json")},
		"introDots": {IntroScript: str("guide/../a.json")},
		"introExt":  {IntroScript: str("guide/a")},
		"introLong": {IntroScript: str(strings.Repeat("a", 200) + ".json")},
		"seo":       {SEOTitle: str(strings.Repeat("字", 201))},
		"空段落":       {About: &[]string{"甲", " "}},
		"含空行":       {About: &[]string{"甲\n\n乙"}},
	} {
		if err := st.UpdateCourse(ctx, "boss@example.com", "kids", bad); !errors.Is(err, ErrInvalidCourseData) {
			t.Errorf("%s: %v", name, err)
		}
	}
	if m, _ = st.CourseMapOf(ctx, "kids", true); m.Summary != "簡介" || m.Art != "tools" {
		t.Errorf("不合規則的修改不該寫入: %+v", m)
	}
	if changes, _ = st.CourseChanges(ctx, 50); len(changes) != before {
		t.Errorf("不合規則的修改不該留紀錄: %d → %d", before, len(changes))
	}
	// 清掉
	empty := []string{}
	clear := CoursePatch{Summary: str(""), About: &empty, SEOTitle: str(""), Description: str(""), Art: str(""), IntroScript: str("")}
	if err := st.UpdateCourse(ctx, "boss@example.com", "kids", clear); err != nil {
		t.Fatal(err)
	}
	if m, _ = st.CourseMapOf(ctx, "kids", true); m.Summary != "" || m.About != nil || m.SEOTitle != "" || m.Description != "" || m.Art != "" || m.IntroScript != "" {
		t.Errorf("清掉之後: %+v", m)
	}
}

// 課程簡介影片(introScript):種子指到的檔屬於這門課(課號是空的),公開、狀態 open;不再是簡介影片的檔當作不存在
func TestIntroScriptFile(t *testing.T) {
	dir := filepath.Join("fixture", "live")
	st := openEmpty(t)
	ctx := context.Background()
	if _, err := st.InitFromSeed(ctx, fixture.Topics, fixture.Courses, fixture.I18nEN, dir); err != nil {
		t.Fatal(err)
	}
	f, err := st.LessonFileOf(ctx, "guide/kids.json")
	if err != nil || f.CourseID != "kids" || f.LessonID != "" || f.Status != LessonOpen || f.Access != AccessFree || f.Content == "" {
		t.Fatalf("kids 的簡介影片: %+v %v", f, err)
	}
	empty := ""
	if err := st.UpdateCourse(ctx, "boss@example.com", "kids", CoursePatch{IntroScript: &empty}); err != nil {
		t.Fatal(err)
	}
	if _, err := st.LessonFileOf(ctx, "guide/kids.json"); !errors.Is(err, ErrLessonFileNotFound) {
		t.Errorf("拿掉簡介影片後檔案不該再公開: %v", err)
	}
}

// 簡介影片的檔不能同時是某一課的檔
func TestIntroScriptOwnedOnce(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.json"), []byte(`{}`), 0o644); err != nil {
		t.Fatal(err)
	}
	st := openSeeded(t)
	seed := `[{"id":"demo","title":"D","access":"free","introScript":"a.json","units":[{"id":"u","title":"U","lessons":[{"id":"1","title":"一","status":"open","script":"a.json"}]}]}]`
	if err := st.SyncLessonFilesJSON(context.Background(), []byte(seed), dir); err == nil {
		t.Error("同一個檔又是簡介影片又是某一課的腳本,應該報錯")
	}
}

// ListCourses:依 position 排序、所有單元都 hidden 的課不列、主題欄位來自種子
func TestListCourses(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	ids := func() string {
		cs, err := st.ListCourses(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		var out []string
		for _, c := range cs {
			out = append(out, c.ID)
		}
		return strings.Join(out, ",")
	}
	if got := ids(); got != "software,ai-agent,advanced,web,launch,claude-code,kids" {
		t.Fatalf("順序: %s", got)
	}
	if err := st.db.Model(&unitRow{}).Where("course_id = ?", "claude-code").Update("hidden", true).Error; err != nil {
		t.Fatal(err)
	}
	if got := ids(); strings.Contains(got, "claude-code") {
		t.Errorf("全部單元 hidden 的課不該列: %s", got)
	}
	// software 只有一個單元 hidden 時還是列
	if got := ids(); !strings.Contains(got, "software") {
		t.Errorf("software 該列: %s", got)
	}
	// 管理員改課程的主題與課程總覽頁
	topicID := "web"
	if err := st.UpdateCourse(context.Background(), "a@b.c", "kids", CoursePatch{TopicID: &topicID}); err != nil {
		t.Fatal(err)
	}
	cs, _ := st.ListCourses(context.Background())
	for _, c := range cs {
		if c.ID == "kids" && (c.TopicID != "web" || c.Topic != "網頁怎麼運作" || c.TopicPath != "/courses/web" || c.TopicSlogan == "") {
			t.Errorf("kids: %+v", c)
		}
	}
	no := "no-such-topic"
	if err := st.UpdateCourse(context.Background(), "a@b.c", "kids", CoursePatch{TopicID: &no}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("不存在的主題該被拒絕: %v", err)
	}
	f, tr := false, true
	if err := st.UpdateCourse(context.Background(), "a@b.c", "kids", CoursePatch{Overview: &f}); err != nil {
		t.Fatal(err)
	}
	cs, _ = st.ListCourses(context.Background())
	for _, c := range cs {
		if c.ID == "kids" && (c.Overview == nil || *c.Overview) {
			t.Errorf("kids overview 該是 false: %+v", c)
		}
	}
	if err := st.UpdateCourse(context.Background(), "a@b.c", "kids", CoursePatch{Overview: &tr}); err != nil {
		t.Fatal(err)
	}
	// 清掉 topicId:不再列在全部課程
	empty := ""
	if err := st.UpdateCourse(context.Background(), "a@b.c", "kids", CoursePatch{TopicID: &empty}); err != nil {
		t.Fatal(err)
	}
	if got := ids(); strings.Contains(got, "kids") {
		t.Errorf("沒有主題的課不該列: %s", got)
	}
}
