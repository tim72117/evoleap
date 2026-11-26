package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func topicsByID(t *testing.T, s *Store) map[string]Topic {
	t.Helper()
	ts, err := s.AdminTopics(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]Topic{}
	for _, tp := range ts {
		out[tp.ID] = tp
	}
	return out
}

// 舊格式(只有 content 欄位)的資料庫轉換後,對外的內容意義不變;轉不了的保持原樣;重跑不改任何東西。
func TestStructureTopicsConversion(t *testing.T) {
	s := openTopicsStore(t)
	legacy := `{"open":true,"lede":"說明","start":{"label":"開始第一課","path":"/courses/kids/0-1"},"pains":["乙","甲"],"learn":["一",{"level":"起步","text":"二"}],"sample":{"caption":"示意","before":["a"],"after":["b"]},"preview":{"script":"kids/0.1.json","sections":{"找找看":{"note":"n","interactive":true}}}}`
	odd := `{"lede":"x","mystery":1}`
	for id, content := range map[string]string{"kids": legacy, "web": odd} {
		if err := s.db.Model(&topicRow{}).Where("id = ?", id).Updates(map[string]any{"content": content, "structured": false}).Error; err != nil {
			t.Fatal(err)
		}
		if err := deleteTopicParts(s.db, id); err != nil {
			t.Fatal(err)
		}
	}
	if n, err := structureTopics(s.db, nil); err != nil || n != 1 {
		t.Fatalf("轉換 %d 個:%v", n, err)
	}
	got := topicsByID(t, s)
	if !sameContent(legacy, string(got["kids"].Content)) {
		t.Errorf("內容變了:%s", got["kids"].Content)
	}
	if len(got["kids"].Items) != 6 || got["kids"].Items[0].ID != "pain-1" {
		t.Errorf("items: %+v", got["kids"].Items)
	}
	if string(got["web"].Content) != odd || got["web"].Items != nil {
		t.Errorf("轉不了的要保持原樣:%s", got["web"].Content)
	}
	if n, err := structureTopics(s.db, nil); err != nil || n != 0 {
		t.Errorf("重跑應該不動:%d %v", n, err)
	}
}

// 逐項修改:id 不變、譯文過時但仍對得上;刪掉的項目譯文一併消失;匯出帶 id,復原後譯文仍對得上。
func TestTopicItemsAndTranslations(t *testing.T) {
	ctx := context.Background()
	s := openTopicsStore(t)
	if err := s.CreateTopic(ctx, "a", "extra", "新主題", "", ""); err != nil {
		t.Fatal(err)
	}
	first, err := s.AddTopicItem(ctx, "a", "extra", "pain", "第一", "", 0)
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.AddTopicItem(ctx, "a", "extra", "pain", "第二", "", 1)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{first, second} {
		if _, err := s.SetI18n(ctx, "a", I18nSet{Kind: I18nTopicItem, Ref: "extra/" + id, Path: "text", Lang: LangEN, Value: "EN " + id, Status: I18nPublished}); err != nil {
			t.Fatal(err)
		}
	}
	english := func(s *Store) string {
		t.Helper()
		ts, err := s.ListTopics(ctx)
		if err != nil {
			t.Fatal(err)
		}
		pack, err := s.LangPack(ctx, LangEN)
		if err != nil {
			t.Fatal(err)
		}
		LocalizeTopics(ts, pack)
		for _, tp := range ts {
			if tp.ID == "extra" {
				return string(tp.Content)
			}
		}
		return ""
	}
	if got, want := english(s), `{"pains":["EN `+second+`","EN `+first+`"]}`; got != want {
		t.Errorf("英文 %s,要 %s", got, want)
	}
	if err := s.OrderTopicItems(ctx, "a", "extra", "pain", []string{first, second}); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteTopicItem(ctx, "a", "extra", second); err != nil {
		t.Fatal(err)
	}
	// 整份重寫時,文字相同的項目沿用 id
	content := json.RawMessage(`{"pains":["第零","第一"]}`)
	if err := s.UpdateTopic(ctx, "a", "extra", TopicPatch{Content: &content}); err != nil {
		t.Fatal(err)
	}
	items := topicsByID(t, s)["extra"].Items
	if len(items) != 2 || items[1].ID != first || items[0].ID == second {
		t.Fatalf("items: %+v", items)
	}

	cat, err := s.ExportCatalog(ctx)
	if err != nil {
		t.Fatal(err)
	}
	fresh := openEmpty(t)
	if err := fresh.InitCatalog(ctx, cat, nil); err != nil {
		t.Fatal(err)
	}
	if got := english(fresh); !strings.Contains(got, "EN "+first) {
		t.Errorf("復原後譯文對不上:%s", got)
	}

	if err := s.DeleteTopic(ctx, "a", "extra"); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteTopic(ctx, "a", "kids"); err == nil {
		t.Error("還有課程的主題不能刪")
	}
	if err := s.DeleteTopic(ctx, "a", "nope"); err != ErrTopicNotFound {
		t.Errorf("不存在:%v", err)
	}
}

// 英文版:逐欄、逐項、段落說明套用譯文;中文清掉的欄位不再出現舊譯文;整份重寫改一個字時譯文標成過時而不是消失;超長的值擋下。
func TestTopicEnglishAfterEdits(t *testing.T) {
	ctx := context.Background()
	s := openTopicsStore(t)
	english := func(id string) string {
		t.Helper()
		ts, err := s.ListTopics(ctx)
		if err != nil {
			t.Fatal(err)
		}
		s.i18n.clear()
		pack, err := s.LangPack(ctx, LangEN)
		if err != nil {
			t.Fatal(err)
		}
		LocalizeTopics(ts, pack)
		for _, tp := range ts {
			if tp.ID == id {
				return string(tp.Content)
			}
		}
		return ""
	}
	for id, wants := range map[string][]string{"launch": {"Test pain", "Test learn title", "Test start"}, "kids": {"Test section note"}} {
		for _, want := range wants {
			if got := english(id); !strings.Contains(got, want) {
				t.Errorf("%s 缺 %q:%s", id, want, got)
			}
		}
	}

	before := topicsByID(t, s)["launch"]
	var content map[string]any
	if err := json.Unmarshal(before.Content, &content); err != nil {
		t.Fatal(err)
	}
	delete(content, "learnTitle")
	content["pains"].([]any)[0] = "改過一個字"
	raw, _ := json.Marshal(content)
	patch := json.RawMessage(raw)
	if err := s.UpdateTopic(ctx, "a", "launch", TopicPatch{Content: &patch}); err != nil {
		t.Fatal(err)
	}
	got := english("launch")
	if strings.Contains(got, "Test learn title") {
		t.Errorf("清掉的欄位不該出現舊譯文:%s", got)
	}
	if !strings.Contains(got, "Test pain") || topicsByID(t, s)["launch"].Items[0].ID != before.Items[0].ID {
		t.Errorf("改字後 id 與譯文要留著:%s", got)
	}

	long := json.RawMessage(`{"tag":"` + strings.Repeat("字", 201) + `"}`)
	if err := s.UpdateTopic(ctx, "a", "launch", TopicPatch{Content: &long}); !errors.Is(err, ErrInvalidCourseData) {
		t.Errorf("超長要擋下:%v", err)
	}
}
