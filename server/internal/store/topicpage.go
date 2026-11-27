package store

// 主題頁的區塊:一個主題頁由幾個依序排列的區塊(topic_sections)組成,區塊裡的卡片、群組、條列是 topic_blocks。
// 讓各主題頁能由同一個頁面照區塊畫;用 evoleap topic section-*、block-* 修改。
// 區塊的 id 同時是頁面上的錨點(#map、#units …),所以 levels 區塊固定是 map、units 區塊固定是 units;
// hero、levels、units 一頁最多各一個。eyebrow、title、lead 留空時前端用內建的區塊標題(依語言)。
//
// 各種類用到的欄位:
//
//	hero    eyebrow=大標上方小字、title=大標(換行分行)、lead=說明(空的用 levels 區塊 source 課程的 about)
//	levels  source=課程 id 時卡片是那門課公開的單元,block.ref 對單元 id;source 空的時卡片是 block 本身,ref 是課程 id。
//	        variant=編號要接在哪一門課的階段後面(空的從 0 起算)。
//	        block:variant=插圖、label=等級名稱、text=簡述、note=先備條件;子項目的 text 是重點
//	cards   variant=numbered 時帶編號;block:title、text
//	lists   block:variant=fit|not_fit|requirement、title(空的用內建標題);子項目的 text 是條列
//	units   source=課程 id;block:ref=單元 id、label=顯示編號、text=核心概念、note=實作、variant=planned

import (
	"context"
	"errors"
	"regexp"
	"slices"
	"strings"

	"gorm.io/gorm"
)

type topicSectionDataRow struct {
	TopicID  string `gorm:"primaryKey;size:64"`
	ID       string `gorm:"primaryKey;size:64"`
	Kind     string `gorm:"size:16;not null"`
	Position int
	Eyebrow  string `gorm:"size:200;not null;default:''"`
	Title    string `gorm:"type:text;not null;default:''"`
	Lead     string `gorm:"type:text;not null;default:''"`
	Source   string `gorm:"size:64;not null;default:''"`
	Variant  string `gorm:"size:64;not null;default:''"`
}

func (topicSectionDataRow) TableName() string { return "topic_sections" }

type topicBlockRow struct {
	TopicID   string `gorm:"primaryKey;size:64"`
	ID        string `gorm:"primaryKey;size:64"`
	SectionID string `gorm:"size:64;not null"`
	ParentID  string `gorm:"size:64;not null;default:''"`
	Position  int
	Title     string `gorm:"type:text;not null;default:''"`
	Text      string `gorm:"type:text;not null;default:''"`
	Note      string `gorm:"type:text;not null;default:''"`
	Ref       string `gorm:"size:64;not null;default:''"`
	Variant   string `gorm:"size:32;not null;default:''"`
	Label     string `gorm:"size:100;not null;default:''"`
}

func (topicBlockRow) TableName() string { return "topic_blocks" }

// PageSection 是主題頁的一個區塊(API、匯出、匯入同一個形狀)。
type PageSection struct {
	ID      string      `json:"id"`
	Kind    string      `json:"kind"`
	Eyebrow string      `json:"eyebrow,omitempty"`
	Title   string      `json:"title,omitempty"`
	Lead    string      `json:"lead,omitempty"`
	Source  string      `json:"source,omitempty"`
	Variant string      `json:"variant,omitempty"`
	Blocks  []PageBlock `json:"blocks,omitempty"`
}

// PageBlock 是區塊裡的一項;Children 只有一層。
type PageBlock struct {
	ID       string      `json:"id,omitempty"`
	Title    string      `json:"title,omitempty"`
	Text     string      `json:"text,omitempty"`
	Note     string      `json:"note,omitempty"`
	Ref      string      `json:"ref,omitempty"`
	Variant  string      `json:"variant,omitempty"`
	Label    string      `json:"label,omitempty"`
	Children []PageBlock `json:"children,omitempty"`
}

// PageSectionPatch、PageBlockPatch:nil 代表不改。
type PageSectionPatch struct {
	Eyebrow, Title, Lead, Source, Variant *string
}

type PageBlockPatch struct {
	Title, Text, Note, Ref, Variant, Label *string
}

var pageSectionKinds = []string{"hero", "levels", "cards", "lists", "units"}

var pageIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)

const maxPageTextRunes = 2000

func checkRunes(fields map[string]lim) error {
	for name, f := range fields {
		if len([]rune(f.v)) > f.max {
			return invalid("%s 最多 %d 字", name, f.max)
		}
	}
	return nil
}

type lim = struct {
	v   string
	max int
}

func checkSectionRow(r topicSectionDataRow) error {
	if !pageIDPattern.MatchString(r.ID) || len(r.ID) > 64 {
		return invalid("區塊 id %q 不合規則(小寫英數與 -,最多 64 字)", r.ID)
	}
	if !slices.Contains(pageSectionKinds, r.Kind) {
		return invalid("kind 要是 %s", strings.Join(pageSectionKinds, "、"))
	}
	return checkRunes(map[string]lim{"eyebrow": {r.Eyebrow, 200}, "title": {r.Title, maxPageTextRunes}, "lead": {r.Lead, maxPageTextRunes}, "source": {r.Source, 64}, "variant": {r.Variant, 64}})
}

func checkBlockRow(r topicBlockRow) error {
	if !pageIDPattern.MatchString(r.ID) || len(r.ID) > 64 {
		return invalid("項目 id %q 不合規則(小寫英數與 -,最多 64 字)", r.ID)
	}
	if r.Title == "" && r.Text == "" && r.Note == "" && r.Ref == "" && r.Variant == "" && r.Label == "" {
		return invalid("項目不能全部欄位都是空的")
	}
	return checkRunes(map[string]lim{"title": {r.Title, maxPageTextRunes}, "text": {r.Text, maxPageTextRunes}, "note": {r.Note, maxPageTextRunes}, "ref": {r.Ref, 64}, "variant": {r.Variant, 32}, "label": {r.Label, 100}})
}

// loadTopicPage 讀一個主題的區塊(依顯示順序)。
func loadTopicPage(db *gorm.DB, topicID string) ([]PageSection, error) {
	var sections []topicSectionDataRow
	if err := db.Session(&gorm.Session{}).Where("topic_id = ?", topicID).Order("position, id").Find(&sections).Error; err != nil {
		return nil, err
	}
	var blocks []topicBlockRow
	if err := db.Session(&gorm.Session{}).Where("topic_id = ?", topicID).Order("position, id").Find(&blocks).Error; err != nil {
		return nil, err
	}
	var tree func(section, parent string) []PageBlock
	tree = func(section, parent string) []PageBlock {
		var out []PageBlock
		for _, b := range blocks {
			if b.SectionID == section && b.ParentID == parent {
				n := PageBlock{ID: b.ID, Title: b.Title, Text: b.Text, Note: b.Note, Ref: b.Ref, Variant: b.Variant, Label: b.Label}
				if parent == "" {
					n.Children = tree(section, b.ID)
				}
				out = append(out, n)
			}
		}
		return out
	}
	out := make([]PageSection, len(sections))
	for i, s := range sections {
		out[i] = PageSection{ID: s.ID, Kind: s.Kind, Eyebrow: s.Eyebrow, Title: s.Title, Lead: s.Lead, Source: s.Source, Variant: s.Variant, Blocks: tree(s.ID, "")}
	}
	return out, nil
}

// TopicPage 回傳一個主題頁的區塊;主題不存在時回 ErrTopicNotFound。
func (s *Store) TopicPage(ctx context.Context, topicID string) ([]PageSection, error) {
	db := s.db.WithContext(ctx)
	if ok, err := exists(db, &topicRow{}, "id = ?", topicID); err != nil {
		return nil, err
	} else if !ok {
		return nil, ErrTopicNotFound
	}
	return loadTopicPage(db, topicID)
}

func deleteTopicPage(tx *gorm.DB, topicID string) error {
	if err := tx.Where("topic_id = ?", topicID).Delete(&topicBlockRow{}).Error; err != nil {
		return err
	}
	return tx.Where("topic_id = ?", topicID).Delete(&topicSectionDataRow{}).Error
}

// 固定 id 的區塊種類:頁內與首頁的連結寫的是 #map、#units
var fixedSectionID = map[string]string{"levels": "map", "units": "units"}

// checkPageShape 檢查整頁的組合:各種類的數量、固定 id、必填欄位與 variant 的值。
func checkPageShape(sections []PageSection) error {
	seen := map[string]bool{}
	for _, s := range sections {
		if s.Kind == "hero" || s.Kind == "levels" || s.Kind == "units" {
			if seen[s.Kind] {
				return invalid("一頁只能有一個 %s 區塊", s.Kind)
			}
			seen[s.Kind] = true
		}
		if id := fixedSectionID[s.Kind]; id != "" && s.ID != id {
			return invalid("%s 區塊的 id 要是 %s", s.Kind, id)
		}
		if s.Kind == "units" && s.Source == "" {
			return invalid("units 區塊要有 source(課程 id)")
		}
		if s.Kind == "cards" && s.Variant != "" && s.Variant != "numbered" {
			return invalid("cards 區塊的 variant 是 numbered 或留空")
		}
		for _, b := range s.Blocks {
			switch s.Kind {
			case "levels":
				if !validCourseArt[b.Variant] {
					return invalid("不認得的插圖 %q(tools、chat、build、agent、advanced 或留空)", b.Variant)
				}
				if b.Ref == "" {
					return invalid("levels 區塊的項目要有 ref")
				}
			case "lists":
				if !slices.Contains([]string{"", "fit", "not_fit", "requirement"}, b.Variant) {
					return invalid("lists 區塊的 variant 是 fit、not_fit、requirement 或留空")
				}
			case "units":
				if b.Variant != "" && b.Variant != "planned" {
					return invalid("units 區塊的 variant 是 planned 或留空")
				}
				if b.Ref == "" {
					return invalid("units 區塊的項目要有 ref(單元 id)")
				}
			}
		}
	}
	return nil
}

// brokenPageRefs 找出指到不存在的課程或單元的參照。
func brokenPageRefs(db *gorm.DB, sections []PageSection) ([]string, error) {
	var out []string
	check := func(label string, model any, query string, args ...any) error {
		ok, err := exists(db.Session(&gorm.Session{}), model, query, args...)
		if err == nil && !ok {
			out = append(out, label)
		}
		return err
	}
	course := func(id string) error { return check("課程 "+id, &courseRow{}, "id = ?", id) }
	for _, s := range sections {
		var refs []error
		if (s.Kind == "levels" || s.Kind == "units") && s.Source != "" {
			refs = append(refs, course(s.Source))
		}
		if s.Kind == "levels" && s.Variant != "" {
			refs = append(refs, course(s.Variant))
		}
		for _, b := range s.Blocks {
			switch {
			case s.Kind == "levels" && s.Source == "":
				refs = append(refs, course(b.Ref))
			case s.Kind == "levels" || s.Kind == "units":
				refs = append(refs, check("單元 "+s.Source+"/"+b.Ref, &unitRow{}, "course_id = ? AND id = ?", s.Source, b.Ref))
			}
		}
		if err := errors.Join(refs...); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// writeTopicPage 以 sections 整份取代一個主題的區塊(匯入、測試資料用);沒給 id 的項目自動編號。
func writeTopicPage(tx *gorm.DB, topicID string, sections []PageSection) error {
	if err := checkPageShape(sections); err != nil {
		return err
	}
	if err := deleteTopicPage(tx, topicID); err != nil {
		return err
	}
	seenSection, seenBlock := map[string]bool{}, map[string]bool{}
	var rows []topicSectionDataRow
	var blocks []topicBlockRow
	var add func(section, parent string, list []PageBlock) error
	add = func(section, parent string, list []PageBlock) error {
		for i, b := range list {
			if b.ID == "" {
				b.ID = newTopicItemID("block")
			}
			if seenBlock[b.ID] {
				return invalid("項目 id %q 重複", b.ID)
			}
			seenBlock[b.ID] = true
			row := topicBlockRow{TopicID: topicID, ID: b.ID, SectionID: section, ParentID: parent, Position: i, Title: b.Title, Text: b.Text, Note: b.Note, Ref: b.Ref, Variant: b.Variant, Label: b.Label}
			if err := checkBlockRow(row); err != nil {
				return err
			}
			blocks = append(blocks, row)
			if len(b.Children) > 0 {
				if parent != "" {
					return invalid("子項目只能有一層")
				}
				if err := add(section, b.ID, b.Children); err != nil {
					return err
				}
			}
		}
		return nil
	}
	for i, s := range sections {
		if seenSection[s.ID] {
			return invalid("區塊 id %q 重複", s.ID)
		}
		seenSection[s.ID] = true
		row := topicSectionDataRow{TopicID: topicID, ID: s.ID, Kind: s.Kind, Position: i, Eyebrow: s.Eyebrow, Title: s.Title, Lead: s.Lead, Source: s.Source, Variant: s.Variant}
		if err := checkSectionRow(row); err != nil {
			return err
		}
		rows = append(rows, row)
		if err := add(s.ID, "", s.Blocks); err != nil {
			return err
		}
	}
	if len(rows) > 0 {
		if err := tx.Create(&rows).Error; err != nil {
			return err
		}
	}
	if len(blocks) > 0 {
		return tx.CreateInBatches(blocks, 50).Error
	}
	return nil
}

// pageTx 在交易裡改一個主題頁:edit 拿到現在的區塊就地修改,再整份寫回。
func (s *Store) pageTx(ctx context.Context, user, topicID, action string, detail any, edit func(page *[]PageSection) error) error {
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		if err := lockTopic(tx, topicID); err != nil {
			return err
		}
		if ok, err := exists(tx, &topicRow{}, "id = ?", topicID); err != nil {
			return err
		} else if !ok {
			return ErrTopicNotFound
		}
		page, err := loadTopicPage(tx, topicID)
		if err != nil {
			return err
		}
		// 只擋這次改出來的壞參照:原本就壞的(例如課程刪掉了)不擋其他修改
		before, err := brokenPageRefs(tx, page)
		if err != nil {
			return err
		}
		if err := edit(&page); err != nil {
			return err
		}
		after, err := brokenPageRefs(tx, page)
		if err != nil {
			return err
		}
		for _, ref := range after {
			if !slices.Contains(before, ref) {
				return invalid("找不到%s", ref)
			}
		}
		if err := writeTopicPage(tx, topicID, page); err != nil {
			return err
		}
		if err := tx.Model(&topicRow{}).Where("id = ?", topicID).UpdateColumn("updated_at", now()).Error; err != nil {
			return err
		}
		return s.recordChange(tx, user, action, topicID, detail)
	})
}

func sectionIndex(page []PageSection, id string) (int, error) {
	i := slices.IndexFunc(page, func(s PageSection) bool { return s.ID == id })
	if i < 0 {
		return 0, invalid("沒有這個區塊 %q(用 evoleap topic show 看 sections)", id)
	}
	return i, nil
}

// insertAt 把 v 插到第 at 個(從 1 起算);0 代表最後。
func insertAt[T any](list []T, v T, at int) ([]T, error) {
	if at < 0 || at > len(list)+1 {
		return nil, invalid("at 要在 1 到 %d 之間", len(list)+1)
	}
	if at == 0 {
		return append(list, v), nil
	}
	return slices.Insert(list, at-1, v), nil
}

func reorder[T any](list []T, id func(T) string, ids []string) error {
	byID := map[string]T{}
	var have []string
	for _, v := range list {
		have = append(have, id(v))
		byID[id(v)] = v
	}
	if len(have) == 0 || !samePermutation(have, ids) {
		return invalid("ids 要剛好是全部項目各一次")
	}
	for i, k := range ids {
		list[i] = byID[k]
	}
	return nil
}

func trimInto(dst *string, v *string) {
	if v != nil {
		*dst = strings.TrimSpace(*v)
	}
}

// AddPageSection 新增一個區塊(不含項目)。
func (s *Store) AddPageSection(ctx context.Context, user, topicID string, sec PageSection, at int) error {
	sec.Blocks = nil
	return s.pageTx(ctx, user, topicID, "topic.section.add", sec, func(page *[]PageSection) error {
		if slices.ContainsFunc(*page, func(x PageSection) bool { return x.ID == sec.ID }) {
			return invalid("區塊 %s 已經存在", sec.ID)
		}
		out, err := insertAt(*page, sec, at)
		*page = out
		return err
	})
}

func (s *Store) SetPageSection(ctx context.Context, user, topicID, sectionID string, p PageSectionPatch) error {
	return s.pageTx(ctx, user, topicID, "topic.section.set", map[string]any{"id": sectionID, "patch": p}, func(page *[]PageSection) error {
		i, err := sectionIndex(*page, sectionID)
		if err != nil {
			return err
		}
		x := &(*page)[i]
		trimInto(&x.Eyebrow, p.Eyebrow)
		trimInto(&x.Title, p.Title)
		trimInto(&x.Lead, p.Lead)
		trimInto(&x.Source, p.Source)
		trimInto(&x.Variant, p.Variant)
		return nil
	})
}

func (s *Store) DeletePageSection(ctx context.Context, user, topicID, sectionID string) error {
	return s.pageTx(ctx, user, topicID, "topic.section.delete", map[string]any{"id": sectionID}, func(page *[]PageSection) error {
		i, err := sectionIndex(*page, sectionID)
		if err != nil {
			return err
		}
		*page = slices.Delete(*page, i, i+1)
		return nil
	})
}

func (s *Store) OrderPageSections(ctx context.Context, user, topicID string, ids []string) error {
	return s.pageTx(ctx, user, topicID, "topic.section.order", ids, func(page *[]PageSection) error {
		return reorder(*page, func(x PageSection) string { return x.ID }, ids)
	})
}

// blockList 找出放某個項目的清單與它的位置。
func blockList(page []PageSection, blockID string) (*[]PageBlock, int, error) {
	for i := range page {
		for j := range page[i].Blocks {
			if page[i].Blocks[j].ID == blockID {
				return &page[i].Blocks, j, nil
			}
			for k := range page[i].Blocks[j].Children {
				if page[i].Blocks[j].Children[k].ID == blockID {
					return &page[i].Blocks[j].Children, k, nil
				}
			}
		}
	}
	return nil, 0, invalid("沒有這個項目 %q(用 evoleap topic show 看 sections)", blockID)
}

// childList 是區塊底下(parent 空的)或某個項目底下的清單。
func childList(page []PageSection, sectionID, parent string) (*[]PageBlock, error) {
	i, err := sectionIndex(page, sectionID)
	if err != nil {
		return nil, err
	}
	if parent == "" {
		return &page[i].Blocks, nil
	}
	j := slices.IndexFunc(page[i].Blocks, func(b PageBlock) bool { return b.ID == parent })
	if j < 0 {
		return nil, invalid("區塊 %s 沒有項目 %q", sectionID, parent)
	}
	return &page[i].Blocks[j].Children, nil
}

// AddPageBlock 新增一個項目;parent 非空時是那個項目的子項目。回傳新項目的 id。
func (s *Store) AddPageBlock(ctx context.Context, user, topicID, sectionID, parent string, b PageBlock, at int) (string, error) {
	b.ID, b.Children = newTopicItemID("block"), nil
	for _, f := range []*string{&b.Title, &b.Text, &b.Note, &b.Ref, &b.Variant, &b.Label} {
		*f = strings.TrimSpace(*f)
	}
	err := s.pageTx(ctx, user, topicID, "topic.block.add", map[string]any{"section": sectionID, "parent": parent, "block": b}, func(page *[]PageSection) error {
		list, err := childList(*page, sectionID, parent)
		if err != nil {
			return err
		}
		out, err := insertAt(*list, b, at)
		if err != nil {
			return err
		}
		*list = out
		return nil
	})
	return b.ID, err
}

func (s *Store) SetPageBlock(ctx context.Context, user, topicID, blockID string, p PageBlockPatch) error {
	return s.pageTx(ctx, user, topicID, "topic.block.set", map[string]any{"id": blockID, "patch": p}, func(page *[]PageSection) error {
		list, i, err := blockList(*page, blockID)
		if err != nil {
			return err
		}
		b := &(*list)[i]
		trimInto(&b.Title, p.Title)
		trimInto(&b.Text, p.Text)
		trimInto(&b.Note, p.Note)
		trimInto(&b.Ref, p.Ref)
		trimInto(&b.Variant, p.Variant)
		trimInto(&b.Label, p.Label)
		return nil
	})
}

// DeletePageBlock 刪掉一個項目與它的子項目。
func (s *Store) DeletePageBlock(ctx context.Context, user, topicID, blockID string) error {
	return s.pageTx(ctx, user, topicID, "topic.block.delete", map[string]any{"id": blockID}, func(page *[]PageSection) error {
		list, i, err := blockList(*page, blockID)
		if err != nil {
			return err
		}
		*list = slices.Delete(*list, i, i+1)
		return nil
	})
}

func (s *Store) OrderPageBlocks(ctx context.Context, user, topicID, sectionID, parent string, ids []string) error {
	return s.pageTx(ctx, user, topicID, "topic.block.order", map[string]any{"section": sectionID, "parent": parent, "ids": ids}, func(page *[]PageSection) error {
		list, err := childList(*page, sectionID, parent)
		if err != nil {
			return err
		}
		return reorder(*list, func(b PageBlock) string { return b.ID }, ids)
	})
}
