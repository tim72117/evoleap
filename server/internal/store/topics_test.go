package store

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

func TestTopicSeedValid(t *testing.T) {
	seeds, err := parseTopicSeed(topicSeed)
	if err != nil {
		t.Fatal(err)
	}
	if len(seeds) != 7 {
		t.Fatalf("topics: want 7, got %d", len(seeds))
	}
	for i, s := range seeds {
		if s.Position != i {
			t.Errorf("%s: position %d, want %d", s.ID, s.Position, i)
		}
	}
	var courses []courseSeedRow
	if err := json.Unmarshal(courseSeed, &courses); err != nil {
		t.Fatal(err)
	}
	used := map[string]int{}
	known := map[string]bool{}
	for _, s := range seeds {
		known[s.ID] = true
	}
	for _, c := range courses {
		if !known[c.Topic] {
			t.Errorf("course %s: unknown topic %q", c.ID, c.Topic)
		}
		used[c.Topic]++
	}
	for _, s := range seeds {
		if used[s.ID] == 0 {
			t.Errorf("topic %s has no course", s.ID)
		}
	}
}

func TestTopicSeedRejectsBad(t *testing.T) {
	good := `{"id":"a","name":"A","coursePath":"/courses/a","topicPath":"/topics/a","position":0,"content":{}}`
	cases := map[string]string{
		"empty id":     strings.Replace(good, `"id":"a"`, `"id":""`, 1),
		"dup":          "[" + good + "," + good + "]",
		"bad path":     strings.Replace(good, "/topics/a", "/topics/b", 1),
		"no name":      strings.Replace(good, `"name":"A"`, `"name":""`, 1),
		"content list": strings.Replace(good, `"content":{}`, `"content":[]`, 1),
		"no content":   strings.Replace(good, `,"content":{}`, "", 1),
	}
	for name, body := range cases {
		if !strings.HasPrefix(body, "[") {
			body = "[" + body + "]"
		}
		if _, err := parseTopicSeed([]byte(body)); err == nil {
			t.Errorf("%s: want error", name)
		}
	}
	if _, err := parseTopicSeed([]byte("[" + good + "]")); err != nil {
		t.Errorf("good: %v", err)
	}
}

func TestTopicsStored(t *testing.T) {
	ctx := context.Background()
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	topics, err := st.Topics(ctx)
	if err != nil || len(topics) != 7 {
		t.Fatalf("topics: %d %v", len(topics), err)
	}
	seeds, _ := parseTopicSeed(topicSeed)
	for i, tp := range topics {
		if tp.ID != seeds[i].ID {
			t.Errorf("order %d: %s, want %s", i, tp.ID, seeds[i].ID)
		}
		if !json.Valid(tp.Content) || string(tp.Content)[0] != '{' {
			t.Errorf("%s: content %s", tp.ID, tp.Content)
		}
		var a, b any
		json.Unmarshal(tp.Content, &a)
		json.Unmarshal(seeds[i].Content, &b)
		x, _ := json.Marshal(a)
		y, _ := json.Marshal(b)
		if string(x) != string(y) {
			t.Errorf("%s: content did not round-trip", tp.ID)
		}
		if len(tp.Courses) == 0 {
			t.Errorf("%s: no courses", tp.ID)
		}
	}
	ai, err := st.TopicOf(ctx, "ai-apps")
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, c := range ai.Courses {
		ids = append(ids, c.ID)
	}
	if !contains(ids, "ai-agent") || !contains(ids, "advanced") {
		t.Errorf("ai-apps courses: %v", ids)
	}
	var r courseRow
	if err := st.db.First(&r, "id = ?", "ai-agent").Error; err != nil || r.Topic != "ai-apps" {
		t.Errorf("ai-agent topic: %q %v", r.Topic, err)
	}
	// 課程順序跟種子一樣
	var courses []courseSeedRow
	json.Unmarshal(courseSeed, &courses)
	var want []string
	for _, c := range courses {
		if c.Topic == "ai-apps" {
			want = append(want, c.ID)
		}
	}
	if strings.Join(ids, ",") != strings.Join(want, ",") {
		t.Errorf("order: %v, want %v", ids, want)
	}
	if _, err := st.TopicOf(ctx, "nope"); err != ErrTopicNotFound {
		t.Errorf("unknown: %v", err)
	}
	// 重跑不會重複或出錯
	if err := st.SeedTopics(ctx); err != nil {
		t.Fatal(err)
	}
	if err := st.SeedCourses(ctx); err != nil {
		t.Fatal(err)
	}
	var n int64
	st.db.Model(&topicRow{}).Count(&n)
	if n != 7 {
		t.Errorf("rows after reseed: %d", n)
	}
}

func TestSeedCoursesUnknownTopic(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	bad := []byte(`[{"id":"x","title":"X","access":"free","topic":"ghost"}]`)
	err = st.seedCoursesJSON(context.Background(), bad, topicSeed)
	if err == nil || !strings.Contains(err.Error(), "ghost") {
		t.Fatalf("want unknown topic error, got %v", err)
	}
	var n int64
	st.db.Model(&courseRow{}).Where("id = ?", "x").Count(&n)
	if n != 0 {
		t.Error("bad course was written")
	}
}

func contains(l []string, s string) bool {
	for _, v := range l {
		if v == s {
			return true
		}
	}
	return false
}
