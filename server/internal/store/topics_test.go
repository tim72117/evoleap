package store

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

func openTopicsStore(t *testing.T) *Store {
	t.Helper()
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

// 種子的結構:主題 id、名稱、content 是 JSON 物件;順序就是 position
func TestTopicSeedShape(t *testing.T) {
	seeds, err := parseTopicSeed(topicSeed)
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, tp := range seeds {
		ids = append(ids, tp.ID)
		if !topicIDPattern.MatchString(tp.ID) || tp.Name == "" || tp.Slogan == "" {
			t.Errorf("主題 %q 要有合規的 id、name、slogan", tp.ID)
		}
		if _, err := validateTopic(tp.Name, tp.Slogan, tp.Path, tp.SEOTitle, tp.Description, tp.Content); err != nil {
			t.Errorf("主題 %s: %v", tp.ID, err)
		}
		var obj map[string]any
		if len(tp.Content) == 0 || json.Unmarshal(tp.Content, &obj) != nil || obj == nil {
			t.Errorf("主題 %s 的 content 要是 JSON 物件", tp.ID)
		}
	}
	if got := strings.Join(ids, ","); got != "software,launch,kids,web,ai-apps,monetize,life-data,claude-code" {
		t.Errorf("主題順序: %s", got)
	}
}

func TestTopicsSeededAndListed(t *testing.T) {
	st := openTopicsStore(t)
	ts, err := st.ListTopics(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(ts) != 8 || ts[0].ID != "software" || ts[7].ID != "claude-code" {
		t.Fatalf("主題: %+v", ts)
	}
	by := map[string]Topic{}
	for _, tp := range ts {
		by[tp.ID] = tp
	}
	var kids struct {
		Preview struct {
			Script string `json:"script"`
		} `json:"preview"`
		Start struct{ Label, Path string }
	}
	if err := json.Unmarshal(by["kids"].Content, &kids); err != nil || kids.Preview.Script != "kids/0.1.json" || kids.Start.Path != "/courses/kids/0-1" {
		t.Errorf("kids content: %v %s", err, by["kids"].Content)
	}
	var sw struct {
		Lede  string
		Learn []struct{ Level, Text string }
	}
	if err := json.Unmarshal(by["software"].Content, &sw); err != nil || len(sw.Learn) != 2 || sw.Learn[0].Level != "起步" || !strings.HasPrefix(sw.Lede, "線上互動課程") {
		t.Errorf("software content: %v %s", err, by["software"].Content)
	}
	if by["monetize"].Path != "" || by["claude-code"].Path != "/courses/claude-code" {
		t.Errorf("path: %+v %+v", by["monetize"], by["claude-code"])
	}
	if _, err := st.TopicOf(context.Background(), "nope"); !errors.Is(err, ErrTopicNotFound) {
		t.Errorf("TopicOf: %v", err)
	}
}

// 同步:種子為準(更新欄位與順序、刪掉種子沒有的主題),課程引用不存在的主題時整批失敗,主題還被課程引用時保留並警告
func TestTopicSync(t *testing.T) {
	ctx := context.Background()
	st := openEmpty(t)
	dir := t.TempDir()
	topics1 := `[{"id":"a","name":"甲","slogan":"s","path":"/topics/a","content":{"x":1}},{"id":"b","name":"乙","content":{}},{"id":"c","name":"丙","path":"/courses/c"}]`
	courses := `[{"id":"c1","title":"課","access":"free","topicId":"a","units":[]},{"id":"c2","title":"課二","access":"free","topicId":"c","overview":false,"units":[]}]`
	if _, err := st.syncSeeds(ctx, []byte(topics1), []byte(courses), dir); err != nil {
		t.Fatal(err)
	}
	ts, _ := st.ListTopics(ctx)
	if len(ts) != 3 || ts[0].ID != "a" || ts[1].ID != "b" || string(ts[0].Content) != `{"x":1}` || ts[1].Content != nil {
		t.Fatalf("第一次: %+v", ts)
	}
	lc, _ := st.ListCourses(ctx)
	if len(lc) != 2 || lc[1].Overview == nil || *lc[1].Overview || lc[0].Overview != nil || lc[0].Topic != "甲" || lc[1].TopicPath != "/courses/c" {
		t.Errorf("課程清單: %+v", lc)
	}
	// 換順序、改內容、拿掉沒人用的 b
	topics2 := `[{"id":"c","name":"丙(新)","path":"/courses/c"},{"id":"a","name":"甲","path":"/topics/a","content":{"y":2}}]`
	if _, err := st.syncSeeds(ctx, []byte(topics2), []byte(courses), dir); err != nil {
		t.Fatal(err)
	}
	ts, _ = st.ListTopics(ctx)
	if len(ts) != 2 || ts[0].ID != "c" || ts[0].Name != "丙(新)" || string(ts[1].Content) != `{"y":2}` || ts[1].Slogan != "" {
		t.Errorf("第二次: %+v", ts)
	}
	// 拿掉還有課程用的主題:同步成功、主題保留(警告見 TestSyncKeepsReferencedTopicWithWarning)
	topics3 := `[{"id":"c","name":"丙(改)","path":"/courses/c"}]`
	if _, err := st.syncSeeds(ctx, []byte(topics3), []byte(courses), dir); err != nil {
		t.Errorf("主題還有課程引用,同步不該失敗: %v", err)
	}
	if ts, _ = st.ListTopics(ctx); len(ts) != 2 || ts[0].Name != "丙(改)" {
		t.Errorf("被引用的主題要保留: %+v", ts)
	}
	// 課程引用不存在的主題、沒有 path 的主題
	bad := `[{"id":"c1","title":"課","access":"free","topicId":"zzz","units":[]}]`
	if _, err := st.syncSeeds(ctx, []byte(topics2), []byte(bad), dir); err == nil || !strings.Contains(err.Error(), "zzz") {
		t.Errorf("不存在的主題: %v", err)
	}
	noPath := `[{"id":"c1","title":"課","access":"free","topicId":"p","units":[]}]`
	if _, err := st.syncSeeds(ctx, []byte(`[{"id":"p","name":"規劃中"}]`), []byte(noPath), dir); err == nil {
		t.Error("沒有 path 的主題不能有課程屬於它")
	}
	// 種子驗證:id 重複、content 不是物件、path 沒有 /
	for _, s := range []string{
		`[{"id":"a","name":"x"},{"id":"a","name":"y"}]`,
		`[{"id":"A_","name":"x"}]`,
		`[{"id":"a","name":"x","content":[1]}]`,
		`[{"id":"a","name":"x","content":"s"}]`,
		`[{"id":"a","name":"x","path":"nope"}]`,
		`[{"id":"a","name":""}]`,
	} {
		if _, err := st.syncSeeds(ctx, []byte(s), []byte(`[]`), dir); err == nil {
			t.Errorf("該被拒絕: %s", s)
		}
	}
}

func TestUpdateTopic(t *testing.T) {
	ctx := context.Background()
	st := openTopicsStore(t)
	name, slogan := "新名", ""
	content := json.RawMessage(`{ "learn": [ "x" ] }`)
	if err := st.UpdateTopic(ctx, "a@b.c", "monetize", TopicPatch{Name: &name, Slogan: &slogan, Content: &content}); err != nil {
		t.Fatal(err)
	}
	tp, _ := st.TopicOf(ctx, "monetize")
	if tp.Name != "新名" || tp.Slogan != "" || string(tp.Content) != `{"learn":["x"]}` {
		t.Errorf("更新: %+v %s", tp, tp.Content)
	}
	// 沒給的欄位不動
	if err := st.UpdateTopic(ctx, "a@b.c", "monetize", TopicPatch{Name: &name}); err != nil {
		t.Fatal(err)
	}
	if tp, _ = st.TopicOf(ctx, "monetize"); string(tp.Content) != `{"learn":["x"]}` {
		t.Errorf("content 不該被動: %s", tp.Content)
	}
	for _, c := range []string{`[]`, `1`, `"x"`, `null`} {
		raw := json.RawMessage(c)
		if err := st.UpdateTopic(ctx, "a@b.c", "monetize", TopicPatch{Content: &raw}); !errors.Is(err, ErrInvalidCourseData) {
			t.Errorf("content %s 該被拒絕: %v", c, err)
		}
	}
	big := json.RawMessage(`{"x":"` + strings.Repeat("a", maxTopicContentBytes) + `"}`)
	if err := st.UpdateTopic(ctx, "a@b.c", "monetize", TopicPatch{Content: &big}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("太大該被拒絕: %v", err)
	}
	if err := st.UpdateTopic(ctx, "a@b.c", "nope", TopicPatch{Name: &name}); !errors.Is(err, ErrTopicNotFound) {
		t.Errorf("不存在: %v", err)
	}
	empty := ""
	if err := st.UpdateTopic(ctx, "a@b.c", "kids", TopicPatch{Path: &empty}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("還有課程的主題不能清 path: %v", err)
	}
	if err := st.UpdateTopic(ctx, "a@b.c", "monetize", TopicPatch{Name: &empty}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("name 不能空: %v", err)
	}
	ch, _ := st.CourseChanges(ctx, 5)
	if len(ch) == 0 || ch[0].Action != "topic.update" {
		t.Errorf("修改紀錄: %+v", ch)
	}
}
