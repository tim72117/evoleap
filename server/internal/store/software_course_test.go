package store

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// 單元的 access / tier 是這個單元底下課的預設:課自己有寫就用自己的,否則用單元的,再否則用課程的。
func TestUnitAccessTierInheritance(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	m, err := st.CourseMapOf(ctx, "software", true)
	if err != nil {
		t.Fatal(err)
	}
	wantUnit := map[string]struct {
		access Access
		tier   string
	}{
		"tools":              {AccessSubscription, "basic"},
		"ai-tools":           {AccessLoginFree, ""},
		"vibe-coding-basics": {AccessSubscription, "basic"},
	}
	for _, u := range m.Units {
		if w, ok := wantUnit[u.ID]; ok {
			if u.Access != w.access || u.Tier != w.tier {
				t.Errorf("單元 %s: %q %q,要 %q %q", u.ID, u.Access, u.Tier, w.access, w.tier)
			}
			delete(wantUnit, u.ID)
		}
	}
	if len(wantUnit) != 0 {
		t.Errorf("課程地圖少了單元: %v", wantUnit)
	}

	cases := []struct {
		lesson string
		access Access
		tier   string
	}{
		{"4.1", AccessSubscription, "basic"}, // 照單元
		{"1.1", AccessLoginFree, ""},         // 照單元(課程也是免登入)
		{"0.0", AccessSubscription, "basic"}, // 照單元
		{"0.intro", AccessFree, "basic"},     // 課自己的 access 蓋過單元;tier 仍是單元的
	}
	for _, c := range cases {
		a, err := st.LessonAccessOf(ctx, "software", c.lesson)
		if err != nil || a.Access != c.access || a.Tier != c.tier {
			t.Errorf("LessonAccessOf %s: %q %q %v,要 %q %q", c.lesson, a.Access, a.Tier, err, c.access, c.tier)
		}
		var found bool
		for _, u := range m.Units {
			for _, l := range u.Lessons {
				if l.ID == c.lesson {
					found = true
					if l.Access != c.access {
						t.Errorf("CourseMapOf 的 %s: %q,要 %q", c.lesson, l.Access, c.access)
					}
				}
			}
		}
		if !found {
			t.Errorf("課程地圖找不到 %s", c.lesson)
		}
		path := "inherit/" + c.lesson + ".json"
		if err := st.db.Exec("INSERT INTO lesson_files (path, course_id, lesson_id, content) VALUES (?, 'software', ?, '{}')", path, c.lesson).Error; err != nil {
			t.Fatal(err)
		}
		f, err := st.LessonFileOf(ctx, path)
		if err != nil || f.CourseID != "software" || f.Access != c.access {
			t.Errorf("LessonFileOf %s: %+v %v", c.lesson, f, err)
		}
	}

	// 課自己有寫就蓋過單元(把訂閱單元裡的 4.1 改成免登入)
	if err := st.db.Exec("UPDATE lessons SET access = 'login-free' WHERE course_id = 'software' AND id = '4.1'").Error; err != nil {
		t.Fatal(err)
	}
	if a, err := st.LessonAccessOf(ctx, "software", "4.1"); err != nil || a.Access != AccessLoginFree {
		t.Errorf("課自己的 access 要優先: %+v %v", a, err)
	}
	// 課程本身:免登入、沒有方案
	if a, err := st.LessonAccessOf(ctx, "software", ""); err != nil || a.Access != AccessLoginFree || a.Tier != "" {
		t.Errorf("software 課程: %+v %v", a, err)
	}
}

// 合併進 software 的舊課程(tools、ai-tools、vibe-coding-basics)在資料庫裡留下的列,種子同步後要清掉;再跑一次什麼都不做。
func TestRetiredCoursesRemoved(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	for _, q := range []string{
		"INSERT INTO courses (id, title, access, created_at, updated_at) VALUES ('tools', '起步', 'subscription', datetime('now'), datetime('now'))",
		"INSERT INTO course_units (course_id, id, title, position) VALUES ('tools', '0', '序章', 1)",
		"INSERT INTO lessons (course_id, id, unit_id, title, position, status) VALUES ('tools', '0.0', '0', '舊課', 1, 'open')",
		"INSERT INTO lesson_files (path, course_id, lesson_id, content) VALUES ('old/0.0.json', 'tools', '0.0', '{}')",
	} {
		if err := st.db.Exec(q).Error; err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	count := func(table, where string, args ...any) int64 {
		var n int64
		if err := st.db.Table(table).Where(where, args...).Count(&n).Error; err != nil {
			t.Fatal(err)
		}
		return n
	}
	oldRows := func() int64 {
		return count("courses", "id = ?", "tools") + count("course_units", "course_id = ?", "tools") +
			count("lessons", "course_id = ?", "tools") + count("lesson_files", "course_id = ?", "tools")
	}
	if oldRows() != 4 {
		t.Fatalf("前置:舊課程的列要在,現在 %d", oldRows())
	}

	// 真正的種子同步需要每個腳本檔都在;這裡用內嵌種子與一個臨時目錄,先建好種子寫到的檔
	dir := t.TempDir()
	var seeds []courseSeedRow
	if err := jsonUnmarshalSeed(&seeds); err != nil {
		t.Fatal(err)
	}
	for _, c := range seeds {
		for _, u := range c.Units {
			for _, l := range u.Lessons {
				for _, p := range lessonFilePaths("", l) {
					full := filepath.Join(dir, p)
					if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
						t.Fatal(err)
					}
					if err := os.WriteFile(full, []byte(`{"p":"`+p+`"}`), 0o644); err != nil {
						t.Fatal(err)
					}
				}
			}
		}
	}

	check := func(round string) {
		t.Helper()
		if n := oldRows(); n != 0 {
			t.Errorf("%s:舊課程 tools 的列還有 %d 筆", round, n)
		}
		if count("courses", "id = ?", "software") != 1 {
			t.Errorf("%s:software 課程不見了", round)
		}
		if count("lessons", "course_id = ? AND id = ?", "software", "4.1") != 1 || count("lessons", "course_id = ? AND id = ?", "software", "0.0") != 1 {
			t.Errorf("%s:software 的課不見了", round)
		}
		if count("course_units", "course_id = ?", "software") != 3 {
			t.Errorf("%s:software 的單元要 3 個", round)
		}
		if count("lesson_files", "course_id = ?", "software") == 0 {
			t.Errorf("%s:software 的腳本檔不見了", round)
		}
		if count("lesson_files", "path = ?", "old/0.0.json") != 0 {
			t.Errorf("%s:舊課程的腳本檔還在", round)
		}
	}
	if err := st.SeedCourses(ctx); err != nil {
		t.Fatal(err)
	}
	if err := st.SyncLessonFiles(ctx, dir); err != nil {
		t.Fatal(err)
	}
	check("第一次")
	var files int64 = count("lesson_files", "1 = 1")
	if err := st.SeedCourses(ctx); err != nil {
		t.Fatal(err)
	}
	if err := st.SyncLessonFiles(ctx, dir); err != nil {
		t.Fatal(err)
	}
	check("第二次")
	if n := count("lesson_files", "1 = 1"); n != files {
		t.Errorf("再跑一次腳本檔數量變了: %d → %d", files, n)
	}
}

func jsonUnmarshalSeed(v *[]courseSeedRow) error { return json.Unmarshal(courseSeed, v) }
