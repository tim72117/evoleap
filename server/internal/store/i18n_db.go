package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 課程資訊翻譯的資料庫部分(通用欄位表):
//
//	i18n_sources              可翻譯欄位的登記表(原文索引):原表(courses、course_units、lessons、topics)才是原文的唯一真實來源,
//	                          這張表是副本,由課程同步工作與改原文的 CLI 動作一併維護(syncI18nSources);出錯以原表為準、可重建。不參與顯示。
//	i18n_translations         譯文,一個欄位一列;source_hash 是翻譯當時的原文雜湊,和登記表現在的雜湊不同就是過時(不另存旗標)
//	i18n_translation_history  只新增,每次譯文異動一筆
//	i18n_languages            語言、回退語言、是否公開、是否啟用
//
// 鍵 (kind, ref, path):kind 是 course|unit|lesson|topic(之後會加腳本節點);ref 是 id,單元與課用「課程id/單元id」「課程id/課id」(和 LangPack 的鍵一致);
// path 是欄位路徑:title、summary、about.0(說明的每一段一列)…;主題的內容逐欄、逐項登記(見 topiccontent.go)。
// 術語表(glossary)、語音(voice_clips)、i18n_dirty 之後再加,不影響這四張表。

// 可翻譯欄位的種類
const (
	I18nCourse = "course"
	I18nUnit   = "unit"
	I18nLesson = "lesson"
	I18nTopic  = "topic"
	// 主題的清單項目(ref=主題id/項目id)與預覽段落說明(ref=主題id/段落名稱)
	I18nTopicItem    = "topic_item"
	I18nTopicSection = "topic_section"
)

// 譯文的狀態:draft 草稿、reviewed 已審、published 已發布(只有 published 會顯示在網站上)
const (
	I18nDraft     = "draft"
	I18nReviewed  = "reviewed"
	I18nPublished = "published"
)

// 譯文的來源:human 人工、ai 機器翻譯、import 從匯入檔寫入(上線前的英文初稿、測試資料)
const (
	I18nOriginHuman  = "human"
	I18nOriginAI     = "ai"
	I18nOriginImport = "import"
)

// SourceLang 是原文的語言(原表存的語言)。
const SourceLang = "zh-TW"

type i18nSourceRow struct {
	Kind       string `gorm:"primaryKey;size:16"`
	Ref        string `gorm:"primaryKey;size:200"`
	Path       string `gorm:"primaryKey;size:200"`
	SourceLang string `gorm:"size:16;not null;default:zh-TW"`
	SourceText string `gorm:"type:text;not null"`
	SourceHash string `gorm:"size:64;not null"`
	UpdatedAt  time.Time
	// RemovedAt 不是空的代表原文已經被刪掉(軟刪除,譯文與歷史留著);原文又出現時清掉
	RemovedAt *time.Time
}

func (i18nSourceRow) TableName() string { return "i18n_sources" }

// i18nTranslationRow:索引 idx_i18n_tr_lang_ref (lang, kind, ref) 供一次讀整個語言包,idx_i18n_tr_status (status) 供待辦清單。
type i18nTranslationRow struct {
	Kind          string    `gorm:"primaryKey;size:16;index:idx_i18n_tr_lang_ref,priority:2"`
	Ref           string    `gorm:"primaryKey;size:200;index:idx_i18n_tr_lang_ref,priority:3"`
	Path          string    `gorm:"primaryKey;size:200"`
	Lang          string    `gorm:"primaryKey;size:16;index:idx_i18n_tr_lang_ref,priority:1"`
	Value         string    `gorm:"type:text;not null"`
	Status        string    `gorm:"size:16;not null;index:idx_i18n_tr_status"`
	SourceHash    string    `gorm:"size:64;not null"`
	Origin        string    `gorm:"size:16;not null"`
	Model         string    `gorm:"size:100"`
	PromptVersion string    `gorm:"size:50"`
	UpdatedBy     string    `gorm:"size:320"`
	UpdatedAt     time.Time `gorm:"not null"`
}

func (i18nTranslationRow) TableName() string { return "i18n_translations" }

type i18nHistoryRow struct {
	ID        uint   `gorm:"primaryKey"`
	Kind      string `gorm:"size:16;not null;index:idx_i18n_hist_key,priority:1"`
	Ref       string `gorm:"size:200;not null;index:idx_i18n_hist_key,priority:2"`
	Path      string `gorm:"size:200;not null;index:idx_i18n_hist_key,priority:3"`
	Lang      string `gorm:"size:16;not null;index:idx_i18n_hist_key,priority:4"`
	OldValue  string `gorm:"type:text"`
	NewValue  string `gorm:"type:text;not null"`
	OldStatus string `gorm:"size:16"`
	NewStatus string `gorm:"size:16;not null"`
	Origin    string `gorm:"size:16;not null"`
	Model     string `gorm:"size:100"`
	ChangedBy string `gorm:"size:320"`
	At        time.Time
	Reason    string `gorm:"size:500"`
}

func (i18nHistoryRow) TableName() string { return "i18n_translation_history" }

type i18nLanguageRow struct {
	Code         string `gorm:"primaryKey;size:16"`
	Name         string `gorm:"size:64;not null"`
	FallbackLang string `gorm:"size:16"`
	IsSource     bool   `gorm:"not null"`
	Public       bool   `gorm:"not null"`
	Enabled      bool   `gorm:"not null"`
	Position     int
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (i18nLanguageRow) TableName() string { return "i18n_languages" }

func i18nHash(text string) string {
	h := sha256.Sum256([]byte(text))
	return hex.EncodeToString(h[:])
}

// i18nField 是一個欄位:鍵加上文字(原文或譯文)。
type i18nField struct {
	Kind, Ref, Path, Text string
}

// collectI18nSeedSources 從測試用的課程、主題資料收集同樣的欄位(規則和 collectI18nSources 相同),
// 也就是測試譯文對應的中文原文;匯入時用它的雜湊當 source_hash(見 importI18nSeed)。
func collectI18nSeedSources(topicsJSON, coursesJSON []byte) (map[string]string, error) {
	courses, err := parseCourseSeed(coursesJSON)
	if err != nil {
		return nil, err
	}
	topics, err := parseTopicSeed(topicsJSON)
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	add := func(kind, ref, path, text string) {
		if text != "" {
			f := i18nField{kind, ref, path, text}
			out[f.key()] = text
		}
	}
	for _, c := range courses {
		add(I18nCourse, c.ID, "title", c.Title)
		add(I18nCourse, c.ID, "summary", c.Summary)
		add(I18nCourse, c.ID, "seoTitle", c.SEOTitle)
		add(I18nCourse, c.ID, "description", c.Description)
		for i, p := range c.About {
			add(I18nCourse, c.ID, "about."+strconv.Itoa(i), p)
		}
		for _, u := range c.Units {
			ref := c.ID + "/" + u.ID
			add(I18nUnit, ref, "title", u.Title)
			add(I18nUnit, ref, "subtitle", u.Subtitle)
			add(I18nUnit, ref, "label", u.Label)
			for _, l := range u.Lessons {
				lref := c.ID + "/" + l.ID
				add(I18nLesson, lref, "title", l.Title)
				add(I18nLesson, lref, "summary", l.Summary)
			}
		}
	}
	for _, t := range topics {
		add(I18nTopic, t.ID, "name", t.Name)
		add(I18nTopic, t.ID, "slogan", t.Slogan)
		add(I18nTopic, t.ID, "seoTitle", t.SEOTitle)
		add(I18nTopic, t.ID, "description", t.Description)
		var c topicContentJSON
		if len(t.Content) > 0 && json.Unmarshal(t.Content, &c) == nil {
			add(I18nTopic, t.ID, "lede", c.Lede)
			for i, v := range c.Learn {
				ref := t.ID + "/learn-" + strconv.Itoa(i+1)
				switch x := v.(type) {
				case string:
					add(I18nTopicItem, ref, "text", x)
				case map[string]any:
					text, _ := x["text"].(string)
					level, _ := x["level"].(string)
					add(I18nTopicItem, ref, "text", text)
					add(I18nTopicItem, ref, "level", level)
				}
			}
		}
	}
	return out, nil
}

func (f i18nField) key() string { return f.Kind + "\x00" + f.Ref + "\x00" + f.Path }

// ensureI18nLanguages 補上預設的語言(只補缺,不改管理員調過的設定)。
func ensureI18nLanguages(tx *gorm.DB) error {
	at := now()
	rows := []i18nLanguageRow{
		{Code: SourceLang, Name: "繁體中文", IsSource: true, Public: true, Enabled: true, Position: 0, CreatedAt: at, UpdatedAt: at},
		{Code: LangEN, Name: "English", FallbackLang: SourceLang, Public: true, Enabled: true, Position: 1, CreatedAt: at, UpdatedAt: at},
	}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
}

// collectI18nSources 從原表讀出所有可翻譯的欄位(空的欄位不登記)。
func collectI18nSources(tx *gorm.DB) ([]i18nField, error) {
	var out []i18nField
	add := func(kind, ref, path, text string) {
		if text != "" {
			out = append(out, i18nField{kind, ref, path, text})
		}
	}
	var courses []courseRow
	if err := tx.Find(&courses).Error; err != nil {
		return nil, err
	}
	for _, c := range courses {
		add(I18nCourse, c.ID, "title", c.Title)
		add(I18nCourse, c.ID, "summary", c.Summary)
		add(I18nCourse, c.ID, "seoTitle", c.SEOTitle)
		add(I18nCourse, c.ID, "description", c.Description)
		for i, p := range splitAbout(c.About) {
			add(I18nCourse, c.ID, "about."+strconv.Itoa(i), p)
		}
	}
	var units []unitRow
	if err := tx.Find(&units).Error; err != nil {
		return nil, err
	}
	for _, u := range units {
		ref := u.CourseID + "/" + u.ID
		add(I18nUnit, ref, "title", u.Title)
		add(I18nUnit, ref, "subtitle", u.Subtitle)
		add(I18nUnit, ref, "label", u.Label)
	}
	var lessons []lessonRow
	if err := tx.Find(&lessons).Error; err != nil {
		return nil, err
	}
	for _, l := range lessons {
		ref := l.CourseID + "/" + l.ID
		add(I18nLesson, ref, "title", l.Title)
		add(I18nLesson, ref, "summary", l.Summary)
	}
	var topics []topicRow
	if err := tx.Find(&topics).Error; err != nil {
		return nil, err
	}
	for _, t := range topics {
		add(I18nTopic, t.ID, "name", t.Name)
		add(I18nTopic, t.ID, "slogan", t.Slogan)
		add(I18nTopic, t.ID, "seoTitle", t.SEOTitle)
		add(I18nTopic, t.ID, "description", t.Description)
		if !t.Structured {
			continue
		}
		for _, f := range []struct{ path, text string }{
			{"lede", t.Lede}, {"tag", t.Tag}, {"intro", t.Intro}, {"learnTitle", t.LearnTitle},
			{"startLabel", t.StartLabel}, {"previewIntro", t.PreviewIntro}, {"sampleCaption", t.SampleCaption},
		} {
			add(I18nTopic, t.ID, f.path, f.text)
		}
	}
	var items []topicItemRow
	if err := tx.Find(&items).Error; err != nil {
		return nil, err
	}
	for _, it := range items {
		add(I18nTopicItem, it.TopicID+"/"+it.ID, "text", it.Text)
		add(I18nTopicItem, it.TopicID+"/"+it.ID, "level", it.Level)
	}
	var sections []topicSectionRow
	if err := tx.Find(&sections).Error; err != nil {
		return nil, err
	}
	for _, sec := range sections {
		add(I18nTopicSection, sec.TopicID+"/"+sec.Name, "note", sec.Note)
	}
	return out, nil
}

// syncI18nSources 讓登記表跟原表一致(在呼叫端的交易裡):新的欄位登記、原文變了就更新雜湊、原表已經沒有的欄位軟刪除(removed_at)、又出現的取消軟刪除。
// 原表才是真實來源,這裡只是副本,所以每次整個重算(資料量很小)。
func syncI18nSources(tx *gorm.DB) error {
	want, err := collectI18nSources(tx)
	if err != nil {
		return err
	}
	var have []i18nSourceRow
	if err := tx.Find(&have).Error; err != nil {
		return err
	}
	existing := make(map[string]i18nSourceRow, len(have))
	for _, r := range have {
		existing[i18nField{Kind: r.Kind, Ref: r.Ref, Path: r.Path}.key()] = r
	}
	at := now()
	seen := make(map[string]bool, len(want))
	var inserts []i18nSourceRow
	for _, f := range want {
		k := f.key()
		seen[k] = true
		h := i18nHash(f.Text)
		e, ok := existing[k]
		switch {
		case !ok:
			inserts = append(inserts, i18nSourceRow{Kind: f.Kind, Ref: f.Ref, Path: f.Path, SourceLang: SourceLang, SourceText: f.Text, SourceHash: h, UpdatedAt: at})
		case e.SourceHash != h || e.SourceText != f.Text || e.RemovedAt != nil:
			err := tx.Model(&i18nSourceRow{}).Where("kind = ? AND ref = ? AND path = ?", f.Kind, f.Ref, f.Path).
				Updates(map[string]any{"source_text": f.Text, "source_hash": h, "updated_at": at, "removed_at": nil}).Error
			if err != nil {
				return err
			}
		}
	}
	for k, e := range existing {
		if seen[k] || e.RemovedAt != nil {
			continue
		}
		err := tx.Model(&i18nSourceRow{}).Where("kind = ? AND ref = ? AND path = ?", e.Kind, e.Ref, e.Path).
			Updates(map[string]any{"removed_at": at, "updated_at": at}).Error
		if err != nil {
			return err
		}
	}
	if len(inserts) > 0 {
		return tx.CreateInBatches(inserts, 50).Error
	}
	return nil
}

// flattenPack 把語言包攤平成「一個欄位一列」(about 一段一列,主題 content 整塊一列),順序固定。
func flattenPack(p *LangPack) []i18nField {
	var out []i18nField
	add := func(kind, ref, path, text string) {
		if text != "" {
			out = append(out, i18nField{kind, ref, path, text})
		}
	}
	for _, id := range sortedKeys(p.Courses) {
		c := p.Courses[id]
		add(I18nCourse, id, "title", c.Title)
		add(I18nCourse, id, "summary", c.Summary)
		add(I18nCourse, id, "seoTitle", c.SEOTitle)
		add(I18nCourse, id, "description", c.Description)
		for i, para := range c.About {
			add(I18nCourse, id, "about."+strconv.Itoa(i), para)
		}
	}
	for _, id := range sortedKeys(p.Units) {
		u := p.Units[id]
		add(I18nUnit, id, "title", u.Title)
		add(I18nUnit, id, "subtitle", u.Subtitle)
		add(I18nUnit, id, "label", u.Label)
	}
	for _, id := range sortedKeys(p.Lessons) {
		l := p.Lessons[id]
		add(I18nLesson, id, "title", l.Title)
		add(I18nLesson, id, "summary", l.Summary)
	}
	for _, id := range sortedKeys(p.Topics) {
		t := p.Topics[id]
		add(I18nTopic, id, "name", t.Name)
		add(I18nTopic, id, "slogan", t.Slogan)
		add(I18nTopic, id, "seoTitle", t.SEOTitle)
		add(I18nTopic, id, "description", t.Description)
		for _, path := range sortedKeys(t.Fields) {
			add(I18nTopic, id, path, t.Fields[path])
		}
	}
	for _, ref := range sortedKeys(p.TopicItems) {
		add(I18nTopicItem, ref, "text", p.TopicItems[ref].Text)
		add(I18nTopicItem, ref, "level", p.TopicItems[ref].Level)
	}
	for _, ref := range sortedKeys(p.TopicSections) {
		add(I18nTopicSection, ref, "note", p.TopicSections[ref])
	}
	return out
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// importI18nSeed(只給測試資料用,正式的譯文隨 InitCatalog 寫入)把測試譯文補進資料庫(在呼叫端的交易裡):status=published、origin=import,
// source_hash 取「這份譯文當時對應的中文」(seedSrc 同欄位)的雜湊,
// 所以資料庫的中文已經和它不同的欄位,匯入後就是過時(stale);seedSrc 沒有這個欄位才退回登記表目前的雜湊。只補缺:資料庫已經有的譯文(任何狀態)不覆蓋,登記表沒有(原表沒有這個欄位或已刪除)的跳過。
// 要先 syncI18nSources。回傳新增與跳過的欄位數。
func importI18nSeed(tx *gorm.DB, lang string, pack *LangPack, seedSrc map[string]string) (added, skipped int, err error) {
	var srcs []i18nSourceRow
	if err := tx.Where("removed_at IS NULL").Find(&srcs).Error; err != nil {
		return 0, 0, err
	}
	hashes := make(map[string]string, len(srcs))
	for _, r := range srcs {
		hashes[i18nField{Kind: r.Kind, Ref: r.Ref, Path: r.Path}.key()] = r.SourceHash
	}
	var have []i18nTranslationRow
	if err := tx.Select("kind", "ref", "path").Where("lang = ?", lang).Find(&have).Error; err != nil {
		return 0, 0, err
	}
	done := make(map[string]bool, len(have))
	for _, r := range have {
		done[i18nField{Kind: r.Kind, Ref: r.Ref, Path: r.Path}.key()] = true
	}
	at := now()
	var rows []i18nTranslationRow
	var hist []i18nHistoryRow
	for _, f := range flattenPack(pack) {
		h, ok := hashes[f.key()]
		if !ok {
			skipped++
			continue
		}
		if text, ok := seedSrc[f.key()]; ok {
			h = i18nHash(text)
		}
		if done[f.key()] {
			continue
		}
		rows = append(rows, i18nTranslationRow{Kind: f.Kind, Ref: f.Ref, Path: f.Path, Lang: lang, Value: f.Text, Status: I18nPublished, SourceHash: h, Origin: I18nOriginImport, UpdatedBy: "sync", UpdatedAt: at})
		hist = append(hist, i18nHistoryRow{Kind: f.Kind, Ref: f.Ref, Path: f.Path, Lang: lang, NewValue: f.Text, NewStatus: I18nPublished, Origin: I18nOriginImport, ChangedBy: "sync", At: at, Reason: "從測試譯文補進(只補缺)"})
	}
	if len(rows) > 0 {
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(rows, 50).Error; err != nil {
			return 0, 0, err
		}
		if err := tx.CreateInBatches(hist, 50).Error; err != nil {
			return 0, 0, err
		}
	}
	return len(rows), skipped, nil
}

// syncI18n 是寫課程資料的交易裡做的翻譯部分:補語言、重算登記表。
func syncI18n(tx *gorm.DB) error {
	if err := ensureI18nLanguages(tx); err != nil {
		return err
	}
	return syncI18nSources(tx)
}

// syncI18nSeeded 同 syncI18n,再把測試的英文譯文(i18nEN,nil 表示沒有)補進資料庫(只補缺);只給測試資料用(Seed、InitFromSeed)。
func syncI18nSeeded(tx *gorm.DB, topicsJSON, coursesJSON, i18nEN []byte) error {
	if err := syncI18n(tx); err != nil {
		return err
	}
	if i18nEN == nil {
		return nil
	}
	pack, err := parseI18n(i18nEN)
	if err != nil {
		return err
	}
	seedSrc, err := collectI18nSeedSources(topicsJSON, coursesJSON)
	if err != nil {
		return err
	}
	if _, _, err := importI18nSeed(tx, LangEN, pack, seedSrc); err != nil {
		return fmt.Errorf("import i18n %s: %w", LangEN, err)
	}
	return nil
}

// ---- 讀取:語言包 ----

const i18nPackTTL = 30 * time.Second

type cachedPack struct {
	pack *LangPack
	at   time.Time
}

type i18nCache struct {
	mu    sync.Mutex
	packs map[string]cachedPack
}

func (c *i18nCache) get(lang string) (*LangPack, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.packs[lang]
	if !ok || time.Since(e.at) > i18nPackTTL {
		return nil, false
	}
	return e.pack, true
}

func (c *i18nCache) put(lang string, p *LangPack) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.packs == nil {
		c.packs = map[string]cachedPack{}
	}
	c.packs[lang] = cachedPack{p, time.Now()}
}

func (c *i18nCache) clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.packs = nil
}

// LangPack 回傳這個語言的語言包(已發布的譯文),記憶體快取 30 秒、這個行程寫入譯文時立刻失效(別台實例最多慢 30 秒)。
// 空字串、沒登記、沒啟用或不公開的語言回 nil(原文);沒翻的欄位保留原文;過時(原文改過)的仍顯示舊譯文。
// 回退語言照 i18n_languages:英文回退到原文,所以沒翻的欄位就是原文;回退語言若不是原文,先套回退語言再套這個語言。
func (s *Store) LangPack(ctx context.Context, lang string) (*LangPack, error) {
	if lang == "" {
		return nil, nil
	}
	if p, ok := s.i18n.get(lang); ok {
		return p, nil
	}
	p, err := s.buildLangPack(ctx, lang)
	if err != nil {
		return nil, err
	}
	s.i18n.put(lang, p)
	return p, nil
}

func (s *Store) buildLangPack(ctx context.Context, lang string) (*LangPack, error) {
	db := s.db.WithContext(ctx)
	var langs []i18nLanguageRow
	if err := db.Find(&langs).Error; err != nil {
		return nil, err
	}
	byCode := make(map[string]i18nLanguageRow, len(langs))
	for _, l := range langs {
		byCode[l.Code] = l
	}
	top, ok := byCode[lang]
	if !ok || !top.Enabled || !top.Public || top.IsSource {
		return nil, nil
	}
	// 回退鏈:這個語言 → 它的回退語言 …,到原文(或沒有回退)為止,最多 4 層
	chain := []string{lang}
	for cur := top; len(chain) < 4; {
		next, ok := byCode[cur.FallbackLang]
		if !ok || next.IsSource || next.Code == SourceLang || contains(chain, next.Code) {
			break
		}
		chain = append(chain, next.Code)
		cur = next
	}
	var out *LangPack
	for i := len(chain) - 1; i >= 0; i-- {
		p, err := s.packOf(ctx, chain[i])
		if err != nil {
			return nil, err
		}
		if out == nil {
			out = p
		} else {
			mergePack(out, p)
		}
	}
	return out, nil
}

func contains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

// packOf 由資料庫已發布的譯文組出一個語言的語言包;沒有任何已發布的譯文就是空的語言包(全部顯示原文)。
func (s *Store) packOf(ctx context.Context, lang string) (*LangPack, error) {
	var rows []i18nTranslationRow
	if err := s.db.WithContext(ctx).Where("lang = ? AND status = ?", lang, I18nPublished).Find(&rows).Error; err != nil {
		return nil, err
	}
	return packFromRows(rows), nil
}

// ---- 讀取:英文版課程頁(SEO 與 sitemap 用) ----

// 一門課「有英文版」的條件:課名有已發布的英文譯文(英文有公開而且啟用)。其他沒翻的欄位保留中文。
func hasCourseTitle(p *LangPack, id string) bool { return p != nil && p.Courses[id].Title != "" }

// ErrEnglishUnavailable 表示中文課程地圖讀到了,但譯文讀不到:中文頁照常回應,英文頁當成暫時無法提供。
var ErrEnglishUnavailable = errors.New("讀不到課程譯文")

// CourseMapWithEnglish 回傳公開的課程地圖(中文)與英文版;沒有英文版時 en 是 nil。
// 只有譯文讀不到時回傳中文地圖與 ErrEnglishUnavailable。
// 譯文每次都直接查資料庫(不經語言包的記憶體快取):快取只有呼叫端(課程頁 SEO)那一層,讀不到就是錯誤。
func (s *Store) CourseMapWithEnglish(ctx context.Context, id string) (zh CourseMap, en *CourseMap, err error) {
	if zh, err = s.CourseMapOf(ctx, id, false); err != nil {
		return CourseMap{}, nil, err
	}
	pack, err := s.buildLangPack(ctx, LangEN)
	if err != nil {
		return zh, nil, fmt.Errorf("%w:%w", ErrEnglishUnavailable, err)
	}
	if !hasCourseTitle(pack, id) {
		return zh, nil, nil
	}
	// Localize 原地修改,再讀一份,不和中文版共用單元與課的 slice
	m, err := s.CourseMapOf(ctx, id, false)
	if err != nil {
		return CourseMap{}, nil, err
	}
	m.Localize(pack)
	return zh, &m, nil
}

// EnglishCourseIDs 回傳有英文版的課程 id(sitemap 用)。
func (s *Store) EnglishCourseIDs(ctx context.Context) (map[string]bool, error) {
	pack, err := s.buildLangPack(ctx, LangEN)
	if err != nil {
		return nil, err
	}
	out := map[string]bool{}
	if pack != nil {
		for id := range pack.Courses {
			if hasCourseTitle(pack, id) {
				out[id] = true
			}
		}
	}
	return out, nil
}

// packFromRows 把「一個欄位一列」的譯文組回語言包。
func packFromRows(rows []i18nTranslationRow) *LangPack {
	p := &LangPack{Courses: map[string]i18nCourse{}, Units: map[string]i18nUnit{}, Lessons: map[string]i18nLesson{}, Topics: map[string]i18nTopic{}, TopicItems: map[string]i18nTopicItem{}, TopicSections: map[string]string{}}
	about := map[string]map[int]string{}
	for _, r := range rows {
		v := r.Value
		switch r.Kind {
		case I18nCourse:
			c := p.Courses[r.Ref]
			switch {
			case r.Path == "title":
				c.Title = v
			case r.Path == "summary":
				c.Summary = v
			case r.Path == "seoTitle":
				c.SEOTitle = v
			case r.Path == "description":
				c.Description = v
			case strings.HasPrefix(r.Path, "about."):
				if i, err := strconv.Atoi(strings.TrimPrefix(r.Path, "about.")); err == nil && i >= 0 {
					if about[r.Ref] == nil {
						about[r.Ref] = map[int]string{}
					}
					about[r.Ref][i] = v
				}
			}
			p.Courses[r.Ref] = c
		case I18nUnit:
			u := p.Units[r.Ref]
			switch r.Path {
			case "title":
				u.Title = v
			case "subtitle":
				u.Subtitle = v
			case "label":
				u.Label = v
			}
			p.Units[r.Ref] = u
		case I18nLesson:
			l := p.Lessons[r.Ref]
			switch r.Path {
			case "title":
				l.Title = v
			case "summary":
				l.Summary = v
			}
			p.Lessons[r.Ref] = l
		case I18nTopic:
			t := p.Topics[r.Ref]
			switch r.Path {
			case "name":
				t.Name = v
			case "slogan":
				t.Slogan = v
			case "seoTitle":
				t.SEOTitle = v
			case "description":
				t.Description = v
			default:
				if t.Fields == nil {
					t.Fields = map[string]string{}
				}
				t.Fields[r.Path] = v
			}
			p.Topics[r.Ref] = t
		case I18nTopicItem:
			it := p.TopicItems[r.Ref]
			switch r.Path {
			case "text":
				it.Text = v
			case "level":
				it.Level = v
			}
			p.TopicItems[r.Ref] = it
		case I18nTopicSection:
			if r.Path == "note" {
				p.TopicSections[r.Ref] = v
			}
		}
	}
	for id, items := range about {
		max := -1
		for i := range items {
			if i > max {
				max = i
			}
		}
		paras := make([]string, max+1)
		for i, v := range items {
			paras[i] = v
		}
		c := p.Courses[id]
		c.About = paras
		p.Courses[id] = c
	}
	return p
}

// mergePack 把 src 套在 dst 上(src 有的欄位蓋過 dst):回退語言鏈用。
func mergePack(dst, src *LangPack) {
	if src == nil {
		return
	}
	for id, s := range src.Courses {
		d := dst.Courses[id]
		pick(&d.Title, s.Title)
		pick(&d.Summary, s.Summary)
		pick(&d.SEOTitle, s.SEOTitle)
		pick(&d.Description, s.Description)
		if len(s.About) > 0 {
			d.About = s.About
		}
		dst.Courses[id] = d
	}
	for id, s := range src.Units {
		d := dst.Units[id]
		pick(&d.Title, s.Title)
		pick(&d.Subtitle, s.Subtitle)
		pick(&d.Label, s.Label)
		dst.Units[id] = d
	}
	for id, s := range src.Lessons {
		d := dst.Lessons[id]
		pick(&d.Title, s.Title)
		pick(&d.Summary, s.Summary)
		dst.Lessons[id] = d
	}
	for id, s := range src.Topics {
		d := dst.Topics[id]
		pick(&d.Name, s.Name)
		pick(&d.Slogan, s.Slogan)
		pick(&d.SEOTitle, s.SEOTitle)
		pick(&d.Description, s.Description)
		for k, v := range s.Fields {
			if d.Fields == nil {
				d.Fields = map[string]string{}
			}
			d.Fields[k] = v
		}
		dst.Topics[id] = d
	}
	for ref, s := range src.TopicItems {
		d := dst.TopicItems[ref]
		pick(&d.Text, s.Text)
		pick(&d.Level, s.Level)
		dst.TopicItems[ref] = d
	}
	for ref, s := range src.TopicSections {
		dst.TopicSections[ref] = s
	}
}

// ---- 管理:列出、讀、寫、缺的 ----

// I18nItem 是一筆譯文(給管理 API 與 CLI):Stale 是原文在翻譯之後改過(譯文的 source_hash 和登記表現在的不同);Removed 是原文已經被刪掉。
type I18nItem struct {
	Kind          string    `json:"kind"`
	Ref           string    `json:"ref"`
	Path          string    `json:"path"`
	Lang          string    `json:"lang"`
	Value         string    `json:"value"`
	Status        string    `json:"status"`
	Origin        string    `json:"origin"`
	Model         string    `json:"model,omitempty"`
	PromptVersion string    `json:"promptVersion,omitempty"`
	UpdatedBy     string    `json:"updatedBy,omitempty"`
	UpdatedAt     time.Time `json:"updatedAt"`
	SourceText    string    `json:"sourceText,omitempty"`
	Stale         bool      `json:"stale,omitempty"`
	Removed       bool      `json:"removed,omitempty"`
}

// I18nHistory 是譯文的一筆異動紀錄。
type I18nHistory struct {
	At        time.Time `json:"at"`
	OldValue  string    `json:"oldValue,omitempty"`
	NewValue  string    `json:"newValue"`
	OldStatus string    `json:"oldStatus,omitempty"`
	NewStatus string    `json:"newStatus"`
	Origin    string    `json:"origin"`
	Model     string    `json:"model,omitempty"`
	ChangedBy string    `json:"changedBy,omitempty"`
	Reason    string    `json:"reason,omitempty"`
}

// I18nFilter 是列出譯文的條件;空的欄位不篩。Limit 預設 500、最多 5000。
type I18nFilter struct {
	Lang, Kind, Ref, Status string
	StaleOnly               bool
	Limit                   int
}

func validI18nStatus(s string) bool {
	return s == I18nDraft || s == I18nReviewed || s == I18nPublished
}

func validI18nKind(k string) bool {
	return k == I18nCourse || k == I18nUnit || k == I18nLesson || k == I18nTopic || k == I18nTopicItem || k == I18nTopicSection
}

func (s *Store) sourceMap(db *gorm.DB) (map[string]i18nSourceRow, error) {
	var srcs []i18nSourceRow
	if err := db.Find(&srcs).Error; err != nil {
		return nil, err
	}
	m := make(map[string]i18nSourceRow, len(srcs))
	for _, r := range srcs {
		m[i18nField{Kind: r.Kind, Ref: r.Ref, Path: r.Path}.key()] = r
	}
	return m, nil
}

func itemOf(r i18nTranslationRow, src i18nSourceRow, hasSrc bool) I18nItem {
	it := I18nItem{Kind: r.Kind, Ref: r.Ref, Path: r.Path, Lang: r.Lang, Value: r.Value, Status: r.Status, Origin: r.Origin, Model: r.Model, PromptVersion: r.PromptVersion, UpdatedBy: r.UpdatedBy, UpdatedAt: r.UpdatedAt}
	if hasSrc {
		it.SourceText = src.SourceText
		it.Removed = src.RemovedAt != nil
		it.Stale = !it.Removed && src.SourceHash != r.SourceHash
	}
	return it
}

// ListI18n 列出譯文(依 kind、ref、path、lang 排序)。
func (s *Store) ListI18n(ctx context.Context, f I18nFilter) ([]I18nItem, error) {
	if f.Status != "" && !validI18nStatus(f.Status) {
		return nil, invalid("status 要是 draft、reviewed 或 published")
	}
	if f.Kind != "" && !validI18nKind(f.Kind) {
		return nil, invalid("kind 要是 course、unit、lesson、topic、topic_item 或 topic_section")
	}
	limit := f.Limit
	if limit <= 0 {
		limit = 500
	}
	if limit > 5000 {
		limit = 5000
	}
	db := s.db.WithContext(ctx)
	q := db.Order("kind, ref, path, lang")
	for col, v := range map[string]string{"lang": f.Lang, "kind": f.Kind, "ref": f.Ref, "status": f.Status} {
		if v != "" {
			q = q.Where(col+" = ?", v)
		}
	}
	var rows []i18nTranslationRow
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	srcs, err := s.sourceMap(db)
	if err != nil {
		return nil, err
	}
	out := []I18nItem{}
	for _, r := range rows {
		src, ok := srcs[i18nField{Kind: r.Kind, Ref: r.Ref, Path: r.Path}.key()]
		it := itemOf(r, src, ok)
		if f.StaleOnly && !it.Stale {
			continue
		}
		out = append(out, it)
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

// GetI18n 回傳一筆譯文與它的異動紀錄(新的在前,最多 50 筆);沒有時回 ErrNotFound。
func (s *Store) GetI18n(ctx context.Context, kind, ref, path, lang string) (I18nItem, []I18nHistory, error) {
	db := s.db.WithContext(ctx)
	var r i18nTranslationRow
	err := db.First(&r, "kind = ? AND ref = ? AND path = ? AND lang = ?", kind, ref, path, lang).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return I18nItem{}, nil, ErrNotFound
	}
	if err != nil {
		return I18nItem{}, nil, err
	}
	var src i18nSourceRow
	hasSrc := db.First(&src, "kind = ? AND ref = ? AND path = ?", kind, ref, path).Error == nil
	var hs []i18nHistoryRow
	if err := db.Where("kind = ? AND ref = ? AND path = ? AND lang = ?", kind, ref, path, lang).Order("id DESC").Limit(50).Find(&hs).Error; err != nil {
		return I18nItem{}, nil, err
	}
	hist := make([]I18nHistory, len(hs))
	for i, h := range hs {
		hist[i] = I18nHistory{At: h.At, OldValue: h.OldValue, NewValue: h.NewValue, OldStatus: h.OldStatus, NewStatus: h.NewStatus, Origin: h.Origin, Model: h.Model, ChangedBy: h.ChangedBy, Reason: h.Reason}
	}
	return itemOf(r, src, hasSrc), hist, nil
}

// I18nSet 是寫入一筆譯文的內容。Status 空的當 draft、Origin 空的當 human。
type I18nSet struct {
	Kind          string `json:"kind"`
	Ref           string `json:"ref"`
	Path          string `json:"path"`
	Lang          string `json:"lang"`
	Value         string `json:"value"`
	Status        string `json:"status,omitempty"`
	Origin        string `json:"origin,omitempty"`
	Model         string `json:"model,omitempty"`
	PromptVersion string `json:"promptVersion,omitempty"`
	Reason        string `json:"reason,omitempty"`
}

const maxI18nValueBytes = 64 << 10

// SetI18n 新增或取代一筆譯文,並記一筆異動紀錄(舊值、新值、舊新狀態、來源、誰、原因)。
// 欄位要已經登記在 i18n_sources(而且原文沒被刪),語言要登記、啟用、不是原文語言;source_hash 記下寫入當下的原文雜湊。
// 值、狀態、雜湊都沒變時不寫紀錄。
func (s *Store) SetI18n(ctx context.Context, user string, in I18nSet) (I18nItem, error) {
	if in.Status == "" {
		in.Status = I18nDraft
	}
	if in.Origin == "" {
		in.Origin = I18nOriginHuman
	}
	if !validI18nKind(in.Kind) {
		return I18nItem{}, invalid("kind 要是 course、unit、lesson、topic、topic_item 或 topic_section")
	}
	if !validI18nStatus(in.Status) {
		return I18nItem{}, invalid("status 要是 draft、reviewed 或 published")
	}
	if in.Origin != I18nOriginHuman && in.Origin != I18nOriginAI && in.Origin != I18nOriginImport {
		return I18nItem{}, invalid("origin 要是 human、ai 或 import")
	}
	in.Value = strings.TrimSpace(in.Value)
	if in.Value == "" {
		return I18nItem{}, invalid("value 不能是空的")
	}
	if len(in.Value) > maxI18nValueBytes {
		return I18nItem{}, invalid("value 超過 %dKB", maxI18nValueBytes>>10)
	}
	if len([]rune(in.Reason)) > 500 || len([]rune(in.Model)) > 100 || len([]rune(in.PromptVersion)) > 50 {
		return I18nItem{}, invalid("reason 最多 500 字、model 最多 100 字、promptVersion 最多 50 字")
	}
	var out I18nItem
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var lg i18nLanguageRow
		if err := tx.First(&lg, "code = ?", in.Lang).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return invalid("不認得的語言 %q", in.Lang)
			}
			return err
		}
		if lg.IsSource || !lg.Enabled {
			return invalid("語言 %q 是原文或沒有啟用,不能寫譯文", in.Lang)
		}
		var src i18nSourceRow
		err := tx.First(&src, "kind = ? AND ref = ? AND path = ?", in.Kind, in.Ref, in.Path).Error
		if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && src.RemovedAt != nil) {
			return invalid("沒有這個可翻譯的欄位 %s %s %s(見 evoleap i18n missing)", in.Kind, in.Ref, in.Path)
		}
		if err != nil {
			return err
		}
		var old i18nTranslationRow
		err = tx.First(&old, "kind = ? AND ref = ? AND path = ? AND lang = ?", in.Kind, in.Ref, in.Path, in.Lang).Error
		exists := err == nil
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		value := in.Value
		if in.Kind == I18nTopic && in.Path == "content" {
			var obj map[string]json.RawMessage
			_ = json.Unmarshal([]byte(value), &obj)
			if raw, err := json.Marshal(obj); err == nil {
				value = string(raw)
			}
		}
		at := now()
		row := i18nTranslationRow{Kind: in.Kind, Ref: in.Ref, Path: in.Path, Lang: in.Lang, Value: value, Status: in.Status, SourceHash: src.SourceHash, Origin: in.Origin, Model: in.Model, PromptVersion: in.PromptVersion, UpdatedBy: user, UpdatedAt: at}
		out = itemOf(row, src, true)
		if exists && old.Value == row.Value && old.Status == row.Status && old.SourceHash == row.SourceHash && old.Origin == row.Origin && old.Model == row.Model {
			out.UpdatedAt = old.UpdatedAt
			return nil
		}
		if err := tx.Save(&row).Error; err != nil {
			return err
		}
		h := i18nHistoryRow{Kind: in.Kind, Ref: in.Ref, Path: in.Path, Lang: in.Lang, NewValue: row.Value, NewStatus: row.Status, Origin: in.Origin, Model: in.Model, ChangedBy: user, At: at, Reason: in.Reason}
		if exists {
			h.OldValue, h.OldStatus = old.Value, old.Status
		}
		return tx.Create(&h).Error
	})
	if err != nil {
		return I18nItem{}, err
	}
	s.i18n.clear()
	return out, nil
}

// I18nMissing 是一個還要翻(或要重翻)的欄位:Reason 是 missing(還沒有譯文)或 stale(原文在翻譯之後改過);Status 是現有譯文的狀態。
type I18nMissing struct {
	Kind       string `json:"kind"`
	Ref        string `json:"ref"`
	Path       string `json:"path"`
	SourceText string `json:"sourceText"`
	Reason     string `json:"reason"`
	Status     string `json:"status,omitempty"`
}

// MissingI18n 列出登記表有(原文沒被刪)、這個語言還沒有譯文或譯文過時的欄位。kind 空的不篩。
func (s *Store) MissingI18n(ctx context.Context, lang, kind string) ([]I18nMissing, error) {
	if kind != "" && !validI18nKind(kind) {
		return nil, invalid("kind 要是 course、unit、lesson、topic、topic_item 或 topic_section")
	}
	db := s.db.WithContext(ctx)
	var lg i18nLanguageRow
	if err := db.First(&lg, "code = ?", lang).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, invalid("不認得的語言 %q", lang)
		}
		return nil, err
	}
	q := db.Where("removed_at IS NULL").Order("kind, ref, path")
	if kind != "" {
		q = q.Where("kind = ?", kind)
	}
	var srcs []i18nSourceRow
	if err := q.Find(&srcs).Error; err != nil {
		return nil, err
	}
	var trs []i18nTranslationRow
	if err := db.Where("lang = ?", lang).Find(&trs).Error; err != nil {
		return nil, err
	}
	have := make(map[string]i18nTranslationRow, len(trs))
	for _, t := range trs {
		have[i18nField{Kind: t.Kind, Ref: t.Ref, Path: t.Path}.key()] = t
	}
	out := []I18nMissing{}
	for _, r := range srcs {
		t, ok := have[i18nField{Kind: r.Kind, Ref: r.Ref, Path: r.Path}.key()]
		switch {
		case !ok:
			out = append(out, I18nMissing{Kind: r.Kind, Ref: r.Ref, Path: r.Path, SourceText: r.SourceText, Reason: "missing"})
		case t.SourceHash != r.SourceHash:
			out = append(out, I18nMissing{Kind: r.Kind, Ref: r.Ref, Path: r.Path, SourceText: r.SourceText, Reason: "stale", Status: t.Status})
		}
	}
	return out, nil
}
