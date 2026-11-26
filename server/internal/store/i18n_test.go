package store

import (
	"testing"

	"github.com/tim72117/evoleap/internal/store/fixture"
)

func testPack(t *testing.T) *LangPack {
	t.Helper()
	p, err := parseI18n(fixture.I18nEN)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestLocalizeFallsBackToOriginal(t *testing.T) {
	m := CourseMap{ID: "software", Title: "原文", Units: []MapUnit{{ID: "nope", Title: "單元"}}}
	m.Localize(nil)
	if m.Title != "原文" {
		t.Fatal("沒有語言包不該改內容")
	}
	m.Localize(testPack(t))
	if m.Title != "Test Course One" || m.Units[0].Title != "單元" {
		t.Fatalf("got %q / %q", m.Title, m.Units[0].Title)
	}
}
