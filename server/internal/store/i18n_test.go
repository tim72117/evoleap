package store

import "testing"

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
