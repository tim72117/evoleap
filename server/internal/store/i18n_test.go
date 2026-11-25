package store

import (
	"encoding/json"
	"os"
	"testing"
)

func TestI18nKeysExistInSeeds(t *testing.T) {
	var cs []courseSeedRow
	raw, _ := os.ReadFile("courses_seed.json")
	if err := json.Unmarshal(raw, &cs); err != nil {
		t.Fatal(err)
	}
	units, lessons, courses := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, c := range cs {
		courses[c.ID] = true
		for _, u := range c.Units {
			units[c.ID+"/"+u.ID] = true
			for _, l := range u.Lessons {
				lessons[c.ID+"/"+l.ID] = true
			}
		}
	}
	tp, err := parseTopicSeed(topicSeed)
	if err != nil {
		t.Fatal(err)
	}
	topics := map[string]bool{}
	for _, x := range tp {
		topics[x.ID] = true
	}
	b := seedPacks[LangEN]
	for k := range b.Courses {
		if !courses[k] {
			t.Errorf("英文課程 %s 不在種子裡", k)
		}
	}
	for k := range b.Units {
		if !units[k] {
			t.Errorf("英文單元 %s 不在種子裡", k)
		}
	}
	for k := range b.Lessons {
		if !lessons[k] {
			t.Errorf("英文課 %s 不在種子裡", k)
		}
	}
	for k := range b.Topics {
		if !topics[k] {
			t.Errorf("英文主題 %s 不在種子裡", k)
		}
	}
	for k := range lessons {
		if _, ok := b.Lessons[k]; !ok {
			t.Errorf("課 %s 還沒有英文", k)
		}
	}
}

func TestLocalizeFallsBackToOriginal(t *testing.T) {
	m := CourseMap{ID: "software", Title: "原文", Units: []MapUnit{{ID: "nope", Title: "單元"}}}
	m.Localize(nil)
	if m.Title != "原文" {
		t.Fatal("沒有語言包不該改內容")
	}
	m.Localize(seedPacks[LangEN])
	if m.Title != "Build Your Own Software" || m.Units[0].Title != "單元" {
		t.Fatalf("got %q / %q", m.Title, m.Units[0].Title)
	}
}
