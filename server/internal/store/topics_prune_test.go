package store

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 種子拿掉的主題,若還有種子以外的課程引用:同步成功、主題保留、警告列出主題與課程 id,其他內容(課程、腳本檔、舊課清理)照常寫入;沒人引用的主題照舊刪除
func TestSyncKeepsReferencedTopicWithWarning(t *testing.T) {
	ctx := context.Background()
	st := openEmpty(t)
	dir := t.TempDir()
	topics1 := `[{"id":"a","name":"甲","path":"/topics/a"},{"id":"b","name":"乙","path":"/topics/b"},{"id":"gone","name":"舊","path":"/topics/gone"}]`
	courses1 := `[{"id":"c1","title":"課","access":"free","topicId":"a","units":[]}]`
	if _, err := st.syncSeeds(ctx, []byte(topics1), []byte(courses1), dir); err != nil {
		t.Fatal(err)
	}
	// 種子以外的課程(模擬管理員用 CLI 掛到主題 b),加上一門舊課程 tools
	for _, c := range []courseRow{
		{ID: "extra2", Title: "外", Access: "free", TopicID: "b", Overview: true},
		{ID: "extra1", Title: "外", Access: "free", TopicID: "b", Overview: true},
		{ID: "tools", Title: "舊", Access: "free", Overview: true},
	} {
		if err := st.db.Create(&c).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(dir, "s.json"), []byte(`{"x":1}`), 0o644); err != nil {
		t.Fatal(err)
	}
	courses2 := `[{"id":"c1","title":"課","access":"free","topicId":"a","units":[]},{"id":"c2","title":"新課","access":"free","units":[{"id":"0","title":"u","lessons":[{"id":"0.1","title":"A","status":"open","script":"s.json"}]}]}]`
	topics2 := `[{"id":"a","name":"甲","path":"/topics/a"}]`
	warnings, err := st.syncSeeds(ctx, []byte(topics2), []byte(courses2), dir)
	if err != nil {
		t.Fatalf("同步不該失敗: %v", err)
	}
	if len(warnings) != 1 || !strings.Contains(warnings[0], "主題 b") || !strings.Contains(warnings[0], "extra1、extra2") || strings.Contains(warnings[0], "gone") {
		t.Fatalf("警告: %q", warnings)
	}
	t.Log(warnings[0])
	ts, _ := st.ListTopics(ctx)
	ids := []string{}
	for _, tp := range ts {
		ids = append(ids, tp.ID)
	}
	if got := strings.Join(ids, ","); got != "a,b" {
		t.Errorf("b 要保留、gone 要刪: %s", got)
	}
	var n int64
	st.db.Model(&courseRow{}).Where("id IN ?", []string{"c2", "extra1", "extra2"}).Count(&n)
	if n != 3 {
		t.Errorf("課程要照常寫入: %d", n)
	}
	st.db.Model(&courseRow{}).Where("id = ?", "tools").Count(&n)
	if n != 0 {
		t.Error("舊課程要清掉")
	}
	f, err := st.LessonFileOf(ctx, "s.json")
	if err != nil || f.CourseID != "c2" {
		t.Errorf("腳本檔要寫入: %+v %v", f, err)
	}
	// 再同步一次:同樣的警告,仍成功
	if w, err := st.syncSeeds(ctx, []byte(topics2), []byte(courses2), dir); err != nil || len(w) != 1 {
		t.Errorf("再同步: %v %v", w, err)
	}
}

// seedCourses 一次讀主題:不存在的 topic_id、沒有 path 的主題仍然擋
func TestSeedCoursesTopicValidation(t *testing.T) {
	ctx := context.Background()
	st := openEmpty(t)
	dir := t.TempDir()
	topics := `[{"id":"a","name":"甲","path":"/topics/a"},{"id":"p","name":"規劃中"}]`
	for name, c := range map[string]string{
		"nope": `[{"id":"c1","title":"課","access":"free","topicId":"nope","units":[]}]`,
		"p":    `[{"id":"c1","title":"課","access":"free","topicId":"p","units":[]}]`,
	} {
		_, err := st.syncSeeds(ctx, []byte(topics), []byte(c), dir)
		if !errors.Is(err, ErrInvalidCourseData) || !strings.Contains(err.Error(), "課程 c1") {
			t.Errorf("%s 該被擋: %v", name, err)
		}
	}
	ok := `[{"id":"c1","title":"課","access":"free","topicId":"a","units":[]},{"id":"c2","title":"課","access":"free","units":[]}]`
	if _, err := st.syncSeeds(ctx, []byte(topics), []byte(ok), dir); err != nil {
		t.Fatal(err)
	}
}

// about 每段 trim 後驗證與存檔:PATCH 帶 "a\n" 存取後是 "a"
func TestUpdateCourseAboutTrimmed(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	about := []string{"a\n", " b "}
	if err := st.UpdateCourse(ctx, "boss@example.com", "kids", CoursePatch{About: &about}); err != nil {
		t.Fatal(err)
	}
	m, _ := st.CourseMapOf(ctx, "kids", true)
	if len(m.About) != 2 || m.About[0] != "a" || m.About[1] != "b" {
		t.Errorf("about: %q", m.About)
	}
	blank := []string{"a", " \n"}
	if err := st.UpdateCourse(ctx, "boss@example.com", "kids", CoursePatch{About: &blank}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("空白段落該被拒絕: %v", err)
	}
}

// 主題 path 不能含反斜線或控制字元
func TestValidateTopicPath(t *testing.T) {
	for _, p := range []string{`/a\b`, `/\evil.com`, "/a\nb", "/a\x00b", "/a\tb", "//x", "x"} {
		if _, err := validateTopic("n", "", p, "", "", nil); !errors.Is(err, ErrInvalidCourseData) {
			t.Errorf("path %q 該被拒絕: %v", p, err)
		}
	}
	if _, err := validateTopic("n", "", "/topics/a-b", "", "", nil); err != nil {
		t.Error(err)
	}
}
