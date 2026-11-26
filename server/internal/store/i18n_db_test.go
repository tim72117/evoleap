package store

import (
	"context"
	"github.com/tim72117/evoleap/internal/store/fixture"
	"path/filepath"
	"reflect"
	"testing"

	"gorm.io/gorm"
)

func openI18nStore(t *testing.T) (*Store, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.db")
	st, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st, path
}

func countRows(t *testing.T, st *Store, model any, where string, args ...any) int64 {
	t.Helper()
	var n int64
	q := st.db.Model(model)
	if where != "" {
		q = q.Where(where, args...)
	}
	if err := q.Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

// 表與索引建立、遷移冪等:再開一次(再跑一次同步)不會多出列,種子語言只補缺。
func TestI18nTablesAndIdempotentMigration(t *testing.T) {
	st, path := openI18nStore(t)
	m := st.db.Migrator()
	for _, tbl := range []any{&i18nSourceRow{}, &i18nTranslationRow{}, &i18nHistoryRow{}, &i18nLanguageRow{}} {
		if !m.HasTable(tbl) {
			t.Errorf("缺資料表 %T", tbl)
		}
	}
	if !m.HasIndex(&i18nTranslationRow{}, "idx_i18n_tr_lang_ref") || !m.HasIndex(&i18nTranslationRow{}, "idx_i18n_tr_status") {
		t.Error("i18n_translations 缺索引")
	}
	var langs []i18nLanguageRow
	if err := st.db.Order("position").Find(&langs).Error; err != nil || len(langs) != 2 {
		t.Fatalf("languages = %v, %v", langs, err)
	}
	if langs[0].Code != "zh-TW" || !langs[0].IsSource || langs[1].Code != "en" || langs[1].FallbackLang != "zh-TW" || !langs[1].Public || !langs[1].Enabled {
		t.Errorf("種子語言不對: %+v", langs)
	}
	src, tr, hist := countRows(t, st, &i18nSourceRow{}, ""), countRows(t, st, &i18nTranslationRow{}, ""), countRows(t, st, &i18nHistoryRow{}, "")
	if src == 0 || tr == 0 || hist != tr {
		t.Fatalf("sources=%d translations=%d history=%d", src, tr, hist)
	}
	st.Close()
	st2, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer st2.Close()
	if got := countRows(t, st2, &i18nSourceRow{}, ""); got != src {
		t.Errorf("sources %d → %d", src, got)
	}
	if got := countRows(t, st2, &i18nTranslationRow{}, ""); got != tr {
		t.Errorf("translations %d → %d", tr, got)
	}
	if got := countRows(t, st2, &i18nHistoryRow{}, ""); got != hist {
		t.Errorf("history %d → %d(沒有新增的譯文不該再寫紀錄)", hist, got)
	}
	if got := countRows(t, st2, &i18nLanguageRow{}, ""); got != 2 {
		t.Errorf("languages = %d", got)
	}
}

// 匯入的譯文:published、origin=import、雜湊是原表當下的原文雜湊;初稿裡資料庫有原文的欄位都進了資料庫,沒有原文的跳過。
func TestI18nImportCoversSeedAndHashesFromSources(t *testing.T) {
	st, _ := openI18nStore(t)
	var rows []i18nTranslationRow
	if err := st.db.Where("lang = ?", LangEN).Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	have := map[string]i18nTranslationRow{}
	for _, r := range rows {
		if r.Status != I18nPublished || r.Origin != I18nOriginImport {
			t.Fatalf("%s %s %s: status=%s origin=%s", r.Kind, r.Ref, r.Path, r.Status, r.Origin)
		}
		have[i18nField{Kind: r.Kind, Ref: r.Ref, Path: r.Path}.key()] = r
	}
	want := importable(t, st, testPack(t))
	if len(want) == 0 || len(want) == len(flattenPack(testPack(t))) {
		t.Fatalf("測試資料要同時有「有原文」與「沒有原文」的欄位: %d", len(want))
	}
	for _, f := range want {
		r, ok := have[f.key()]
		if !ok {
			t.Errorf("種子欄位沒進資料庫: %s %s %s", f.Kind, f.Ref, f.Path)
			continue
		}
		if r.Value != f.Text {
			t.Errorf("%s %s %s 值不同", f.Kind, f.Ref, f.Path)
		}
		var src i18nSourceRow
		if err := st.db.First(&src, "kind = ? AND ref = ? AND path = ?", f.Kind, f.Ref, f.Path).Error; err != nil {
			t.Fatal(err)
		}
		if r.SourceHash != i18nHash(src.SourceText) || src.SourceHash != r.SourceHash {
			t.Errorf("%s %s %s 雜湊不是原文的雜湊", f.Kind, f.Ref, f.Path)
		}
	}
	if len(have) != len(want) {
		t.Errorf("資料庫 %d 列,有原文的初稿 %d 欄", len(have), len(want))
	}
}

// importable 回傳語言包裡資料庫有對應原文的欄位(其餘匯入時跳過)。
func importable(t *testing.T, st *Store, pack *LangPack) []i18nField {
	t.Helper()
	var srcs []i18nSourceRow
	if err := st.db.Where("removed_at IS NULL").Find(&srcs).Error; err != nil {
		t.Fatal(err)
	}
	has := map[string]bool{}
	for _, r := range srcs {
		has[i18nField{Kind: r.Kind, Ref: r.Ref, Path: r.Path}.key()] = true
	}
	var out []i18nField
	for _, f := range flattenPack(pack) {
		if has[f.key()] {
			out = append(out, f)
		}
	}
	return out
}

// 只補缺不覆蓋:改過的譯文、草稿、被刪掉又補回的,同步後各自符合預期。
func TestI18nImportOnlyFillsMissing(t *testing.T) {
	st, _ := openI18nStore(t)
	ctx := context.Background()
	if _, err := st.SetI18n(ctx, "a@x", I18nSet{Kind: I18nCourse, Ref: "software", Path: "title", Lang: LangEN, Value: "Edited Title", Status: I18nPublished}); err != nil {
		t.Fatal(err)
	}
	if _, err := st.SetI18n(ctx, "a@x", I18nSet{Kind: I18nLesson, Ref: "software/0.1", Path: "title", Lang: LangEN, Value: "Draft Title", Status: I18nDraft}); err != nil {
		t.Fatal(err)
	}
	deleted := i18nTranslationRow{Kind: I18nCourse, Ref: "web", Path: "summary", Lang: LangEN}
	if err := st.db.Delete(&deleted).Error; err != nil {
		t.Fatal(err)
	}
	if err := st.Seed(ctx, fixture.Topics, fixture.Courses, fixture.I18nEN); err != nil { // 等於再跑一次同步
		t.Fatal(err)
	}
	var r i18nTranslationRow
	st.db.First(&r, "kind = ? AND ref = ? AND path = ? AND lang = ?", I18nCourse, "software", "title", LangEN)
	r2, r3 := i18nTranslationRow{}, i18nTranslationRow{}
	if r.Value != "Edited Title" || r.Origin != I18nOriginHuman {
		t.Errorf("已有的譯文被覆蓋: %+v", r)
	}
	st.db.First(&r2, "kind = ? AND ref = ? AND path = ? AND lang = ?", I18nLesson, "software/0.1", "title", LangEN)
	if r2.Value != "Draft Title" || r2.Status != I18nDraft {
		t.Errorf("草稿被覆蓋: %+v", r2)
	}
	if err := st.db.First(&r3, "kind = ? AND ref = ? AND path = ? AND lang = ?", I18nCourse, "web", "summary", LangEN).Error; err != nil || r3.Origin != I18nOriginImport {
		t.Errorf("缺的沒補回: %+v %v", r3, err)
	}
}

// 原文改了:雜湊變、譯文過時(missing 與 list --stale 看得到),但仍然照舊顯示舊譯文;發布草稿前不會顯示。
func TestI18nStaleDetectionAndDraftNotShown(t *testing.T) {
	st, _ := openI18nStore(t)
	ctx := context.Background()
	title := "新的課名"
	if err := st.UpdateCourse(ctx, "a@x", "software", CoursePatch{Title: &title}); err != nil {
		t.Fatal(err)
	}
	stale, err := st.ListI18n(ctx, I18nFilter{Lang: LangEN, StaleOnly: true})
	if err != nil || len(stale) != 1 || stale[0].Ref != "software" || stale[0].Path != "title" || !stale[0].Stale || stale[0].SourceText != title {
		t.Fatalf("stale = %+v, %v", stale, err)
	}
	miss, err := st.MissingI18n(ctx, LangEN, I18nCourse) // 主題 content 目前有些還沒翻,這裡只看課程
	if err != nil || len(miss) != 1 || miss[0].Reason != "stale" || miss[0].Path != "title" {
		t.Fatalf("missing = %+v, %v", miss, err)
	}
	pack, err := st.LangPack(ctx, LangEN)
	if err != nil {
		t.Fatal(err)
	}
	m := CourseMap{ID: "software", Title: title}
	m.Localize(pack)
	if m.Title != "Test Course One" {
		t.Errorf("過時的譯文仍要顯示舊的: %q", m.Title)
	}
	// 重新翻譯(草稿)後不再過時,但草稿不顯示,所以回到…舊的已發布譯文被草稿取代,公開頁沒有譯文就是原文
	if _, err := st.SetI18n(ctx, "a@x", I18nSet{Kind: I18nCourse, Ref: "software", Path: "title", Lang: LangEN, Value: "New Title"}); err != nil {
		t.Fatal(err)
	}
	if stale, _ := st.ListI18n(ctx, I18nFilter{Lang: LangEN, StaleOnly: true}); len(stale) != 0 {
		t.Errorf("重翻後不該還過時: %+v", stale)
	}
	pack, _ = st.LangPack(ctx, LangEN)
	m = CourseMap{ID: "software", Title: title}
	m.Localize(pack)
	if m.Title != title {
		t.Errorf("草稿不該顯示: %q", m.Title)
	}
	if _, err := st.SetI18n(ctx, "a@x", I18nSet{Kind: I18nCourse, Ref: "software", Path: "title", Lang: LangEN, Value: "New Title", Status: I18nPublished}); err != nil {
		t.Fatal(err)
	}
	pack, _ = st.LangPack(ctx, LangEN) // 寫入後快取立刻失效
	m = CourseMap{ID: "software", Title: title}
	m.Localize(pack)
	if m.Title != "New Title" {
		t.Errorf("發布後要顯示新譯文: %q", m.Title)
	}
}

// 異動紀錄:每次寫入一筆,舊值、新值、舊新狀態、來源與人都有;沒變就不寫。
func TestI18nHistory(t *testing.T) {
	st, _ := openI18nStore(t)
	ctx := context.Background()
	in := I18nSet{Kind: I18nUnit, Ref: "software/tools", Path: "title", Lang: LangEN, Value: "Tools v2", Status: I18nReviewed, Origin: I18nOriginAI, Model: "m1", Reason: "試譯"}
	var units []unitRow
	st.db.Where("course_id = ?", "software").Find(&units)
	if len(units) == 0 {
		t.Skip("software 沒有單元")
	}
	in.Ref = "software/" + units[0].ID
	_, _, err := st.GetI18n(ctx, in.Kind, in.Ref, in.Path, in.Lang)
	if err != nil && err != ErrNotFound {
		t.Fatal(err)
	}
	before, hist0, _ := st.GetI18n(ctx, in.Kind, in.Ref, in.Path, in.Lang)
	if _, err := st.SetI18n(ctx, "bob@x", in); err != nil {
		t.Fatal(err)
	}
	if _, err := st.SetI18n(ctx, "bob@x", in); err != nil { // 沒變
		t.Fatal(err)
	}
	item, hist, err := st.GetI18n(ctx, in.Kind, in.Ref, in.Path, in.Lang)
	if err != nil || item.Value != "Tools v2" || item.Status != I18nReviewed || item.Origin != I18nOriginAI || item.UpdatedBy != "bob@x" {
		t.Fatalf("item = %+v, %v", item, err)
	}
	if len(hist) != len(hist0)+1 {
		t.Fatalf("history %d → %d", len(hist0), len(hist))
	}
	h := hist[0]
	if h.OldValue != before.Value || h.OldStatus != before.Status || h.NewValue != "Tools v2" || h.NewStatus != I18nReviewed || h.Origin != I18nOriginAI || h.Model != "m1" || h.ChangedBy != "bob@x" || h.Reason != "試譯" {
		t.Errorf("history = %+v (before %+v)", h, before)
	}
}

// 寫入的檢查:不認得的語言、原文語言、沒登記的欄位、壞狀態、空值、主題 content 不是物件。
func TestI18nSetValidation(t *testing.T) {
	st, _ := openI18nStore(t)
	ctx := context.Background()
	ok := I18nSet{Kind: I18nCourse, Ref: "software", Path: "title", Lang: LangEN, Value: "x"}
	cases := map[string]func(*I18nSet){
		"語言不存在":   func(s *I18nSet) { s.Lang = "xx" },
		"原文語言":    func(s *I18nSet) { s.Lang = "zh-TW" },
		"沒登記的欄位":  func(s *I18nSet) { s.Path = "nope" },
		"沒登記的課程":  func(s *I18nSet) { s.Ref = "nope" },
		"壞狀態":     func(s *I18nSet) { s.Status = "live" },
		"壞來源":     func(s *I18nSet) { s.Origin = "robot" },
		"空值":      func(s *I18nSet) { s.Value = "  " },
		"壞 kind":  func(s *I18nSet) { s.Kind = "script" },
		"content": func(s *I18nSet) { s.Kind, s.Ref, s.Path, s.Value = I18nTopic, "software", "content", `["a"]` },
	}
	for name, mod := range cases {
		in := ok
		mod(&in)
		if _, err := st.SetI18n(ctx, "a@x", in); err == nil {
			t.Errorf("%s 應該被拒絕", name)
		}
	}
	if _, err := st.SetI18n(ctx, "a@x", ok); err != nil {
		t.Errorf("合法的寫入失敗: %v", err)
	}
}

// 原文被刪:登記表軟刪除(removed_at),譯文與歷史留著,不能再寫、不列在缺的;原文回來就取消軟刪除。
func TestI18nSoftDeleteAndRevive(t *testing.T) {
	st, _ := openI18nStore(t)
	ctx := context.Background()
	var l lessonRow
	if err := st.db.First(&l, "course_id = ?", "software").Error; err != nil {
		t.Fatal(err)
	}
	ref := l.CourseID + "/" + l.ID
	trCount := countRows(t, st, &i18nTranslationRow{}, "")
	if err := st.db.Delete(&l).Error; err != nil {
		t.Fatal(err)
	}
	if err := syncI18nSources(st.db); err != nil {
		t.Fatal(err)
	}
	var src i18nSourceRow
	if err := st.db.First(&src, "kind = ? AND ref = ? AND path = ?", I18nLesson, ref, "title").Error; err != nil || src.RemovedAt == nil {
		t.Fatalf("title 該被軟刪除: %+v %v", src, err)
	}
	if got := countRows(t, st, &i18nTranslationRow{}, ""); got != trCount {
		t.Errorf("譯文不該被刪: %d → %d", trCount, got)
	}
	if _, err := st.SetI18n(ctx, "a@x", I18nSet{Kind: I18nLesson, Ref: ref, Path: "title", Lang: LangEN, Value: "x"}); err == nil {
		t.Error("原文已刪的欄位不該能寫譯文")
	}
	miss, _ := st.MissingI18n(ctx, LangEN, I18nLesson)
	for _, m := range miss {
		if m.Ref == ref {
			t.Errorf("已刪的欄位不該列在 missing: %+v", m)
		}
	}
	if err := st.db.Create(&l).Error; err != nil {
		t.Fatal(err)
	}
	if err := syncI18nSources(st.db); err != nil {
		t.Fatal(err)
	}
	var back i18nSourceRow
	st.db.First(&back, "kind = ? AND ref = ? AND path = ?", I18nLesson, ref, "title")
	if back.RemovedAt != nil {
		t.Error("原文回來要取消軟刪除")
	}
}

// 沒有 about 以外的細節:說明段落一段一列,缺的段落保留原文。
func TestI18nAboutPerParagraph(t *testing.T) {
	cases := []struct {
		name string
		tr   map[string]string
		want []string
	}{
		{"只翻第 0 段", map[string]string{"about.0": "A"}, []string{"A", "乙", "丙"}},
		{"只翻第 1 段", map[string]string{"about.1": "B"}, []string{"甲", "B", "丙"}},
		{"譯文比原文多", map[string]string{"about.0": "A", "about.1": "B", "about.2": "C", "about.3": "D"}, []string{"A", "B", "C", "D"}},
		{"全翻", map[string]string{"about.0": "A", "about.1": "B", "about.2": "C"}, []string{"A", "B", "C"}},
	}
	for _, c := range cases {
		var rows []i18nTranslationRow
		for p, v := range c.tr {
			rows = append(rows, i18nTranslationRow{Kind: I18nCourse, Ref: "c", Path: p, Value: v})
		}
		m := CourseMap{ID: "c", About: []string{"甲", "乙", "丙"}}
		m.Localize(packFromRows(rows))
		if !reflect.DeepEqual(m.About, c.want) {
			t.Errorf("%s: about = %v, want %v", c.name, m.About, c.want)
		}
	}
}

// 沒有任何程式內的譯文備援:資料庫沒有已發布的譯文就是原文;英文版課程頁以「課名有已發布的譯文」為準。
func TestI18nOnlyFromDatabase(t *testing.T) {
	st, _ := openI18nStore(t)
	ctx := context.Background()
	has := func(want bool) {
		t.Helper()
		st.i18n.clear()
		zh, en, err := st.CourseMapWithEnglish(ctx, "web")
		if err != nil || (en != nil) != want {
			t.Fatalf("en = %v, %v, want %v", en, err, want)
		}
		ids, err := st.EnglishCourseIDs(ctx)
		if err != nil || ids["web"] != want {
			t.Fatalf("ids = %v, %v", ids, err)
		}
		if en != nil && (en.Title != "Test Course Four" || en.Units[0].Lessons[0].Title != "Test web lesson" || zh.Units[0].Lessons[0].Title == en.Units[0].Lessons[0].Title || en.Units[0].Lessons[1].Title != zh.Units[0].Lessons[1].Title) {
			t.Errorf("英文版要套譯文、沒翻的保留中文,中文版不受影響: %+v / %+v", en.Units[0], zh.Units[0])
		}
	}
	has(true)
	// 課名退回草稿:沒有英文版
	if _, err := st.SetI18n(ctx, "a@x", I18nSet{Kind: I18nCourse, Ref: "web", Path: "title", Lang: LangEN, Value: "x", Status: I18nDraft}); err != nil {
		t.Fatal(err)
	}
	has(false)
	if err := st.db.Where("1 = 1").Delete(&i18nTranslationRow{}).Error; err != nil {
		t.Fatal(err)
	}
	has(false)
	p, err := st.LangPack(ctx, LangEN)
	if err != nil || p == nil || len(flattenPack(p)) != 0 {
		t.Errorf("沒有譯文就是原文: %+v %v", p, err)
	}
	// 不支援的語言、停用的語言是原文
	if p, _ := st.LangPack(ctx, ""); p != nil {
		t.Error("空語言要是 nil")
	}
	if p, _ := st.LangPack(ctx, "fr"); p != nil {
		t.Error("沒登記的語言要是 nil")
	}
	st.db.Model(&i18nLanguageRow{}).Where("code = ?", LangEN).Update("public", false)
	st.i18n.clear()
	if p, _ := st.LangPack(ctx, LangEN); p != nil {
		t.Error("不公開的語言要是 nil")
	}
}

// 首次匯入的雜湊取種子當時的中文:資料庫的中文已經和種子不同的欄位匯入後是 stale,相同的不是。
func TestI18nImportStaleWhenDatabaseSourceDiffersFromSeed(t *testing.T) {
	st, _ := openI18nStore(t)
	ctx := context.Background()
	title := "資料庫裡改過的課名"
	if err := st.UpdateCourse(ctx, "a@x", "software", CoursePatch{Title: &title}); err != nil {
		t.Fatal(err)
	}
	if err := st.db.Where("1 = 1").Delete(&i18nTranslationRow{}).Error; err != nil {
		t.Fatal(err)
	}
	seedSrc, err := collectI18nSeedSources(fixture.Topics, fixture.Courses)
	if err != nil {
		t.Fatal(err)
	}
	if err := st.db.Transaction(func(tx *gorm.DB) error {
		if err := syncI18nSources(tx); err != nil {
			return err
		}
		_, _, err := importI18nSeed(tx, LangEN, testPack(t), seedSrc)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	stale, err := st.ListI18n(ctx, I18nFilter{Lang: LangEN, StaleOnly: true})
	if err != nil || len(stale) != 1 || stale[0].Ref != "software" || stale[0].Path != "title" {
		t.Fatalf("stale = %+v, %v", stale, err)
	}
	st.i18n.clear()
	pack, _ := st.LangPack(ctx, LangEN)
	m := CourseMap{ID: "software", Title: title}
	m.Localize(pack)
	if m.Title != "Test Course One" {
		t.Errorf("過時仍要顯示: %q", m.Title)
	}
}

// 結尾換行:值前後的空白不存進去;有無結尾換行寫兩次不產生第二筆歷史。
func TestI18nSetTrimsValue(t *testing.T) {
	st, _ := openI18nStore(t)
	ctx := context.Background()
	in := I18nSet{Kind: I18nCourse, Ref: "software", Path: "summary", Lang: LangEN, Value: "Clean text\r\n", Status: I18nDraft}
	item, err := st.SetI18n(ctx, "a@x", in)
	if err != nil || item.Value != "Clean text" {
		t.Fatalf("item = %+v, %v", item, err)
	}
	_, h1, _ := st.GetI18n(ctx, I18nCourse, "software", "summary", LangEN)
	in.Value = "  Clean text"
	if _, err := st.SetI18n(ctx, "a@x", in); err != nil {
		t.Fatal(err)
	}
	got, h2, _ := st.GetI18n(ctx, I18nCourse, "software", "summary", LangEN)
	if got.Value != "Clean text" || len(h2) != len(h1) {
		t.Errorf("value = %q, history %d → %d", got.Value, len(h1), len(h2))
	}
}
