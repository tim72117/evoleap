package store

// 主題內容的結構化:單一值是 topics 的欄位,清單項目一項一列(topic_items),課程預覽的段落說明在 topic_preview_sections。
// 對外(GET /api/topics、匯出、topic set -content-file)仍是原本的 content JSON 物件,由這裡組合與拆解。
// structured=false 的主題(還沒轉換,或內容拆開後組不回原樣)照舊讀 topics.content。

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"reflect"
	"slices"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type topicItemRow struct {
	TopicID  string `gorm:"primaryKey;size:64"`
	ID       string `gorm:"primaryKey;size:64"`
	Kind     string `gorm:"size:16;not null"`
	Position int
	Text     string `gorm:"type:text;not null"`
	Level    string `gorm:"size:100;not null;default:''"`
}

func (topicItemRow) TableName() string { return "topic_items" }

type topicSectionRow struct {
	TopicID     string `gorm:"primaryKey;size:64"`
	Name        string `gorm:"primaryKey;size:100"`
	Note        string `gorm:"type:text;not null"`
	Interactive bool   `gorm:"not null"`
}

func (topicSectionRow) TableName() string { return "topic_preview_sections" }

// TopicFields 是 topics 表上的內容欄位。
type TopicFields struct {
	Icon          string `gorm:"size:32;not null;default:''"`
	Lede          string `gorm:"type:text;not null;default:''"`
	Tag           string `gorm:"size:200;not null;default:''"`
	Intro         string `gorm:"type:text;not null;default:''"`
	LearnTitle    string `gorm:"size:100;not null;default:''"`
	Status        string `gorm:"size:16;not null;default:''"` // open 或 planned
	StartLabel    string `gorm:"size:100;not null;default:''"`
	StartCourse   string `gorm:"size:64;not null;default:''"`
	StartLesson   string `gorm:"size:64;not null;default:''"`
	PreviewScript string `gorm:"size:200;not null;default:''"`
	PreviewIntro  string `gorm:"type:text;not null;default:''"`
	SampleCaption string `gorm:"type:text;not null;default:''"`
}

var topicFieldColumns = []string{"structured", "icon", "lede", "tag", "intro", "learn_title", "status", "start_label", "start_course", "start_lesson", "preview_script", "preview_intro", "sample_caption"}

const (
	topicStatusOpen    = "open"
	topicStatusPlanned = "planned"
)

// topicItemKinds 是清單項目的種類(順序固定,組 content 與列出時用)。
var topicItemKinds = []string{"outcome", "pain", "scenario", "flow", "learn", "sample_before", "sample_after"}

// topicParts 是一個主題拆開後的內容。
type topicParts struct {
	f        TopicFields
	items    []topicItemRow // 同一種類內依顯示順序
	sections []topicSectionRow
}

type topicContentJSON struct {
	Icon       string            `json:"icon,omitempty"`
	Lede       string            `json:"lede,omitempty"`
	Tag        string            `json:"tag,omitempty"`
	Intro      string            `json:"intro,omitempty"`
	LearnTitle string            `json:"learnTitle,omitempty"`
	Open       bool              `json:"open,omitempty"`
	Start      *topicStartJSON   `json:"start,omitempty"`
	Outcomes   []string          `json:"outcomes,omitempty"`
	Pains      []string          `json:"pains,omitempty"`
	Scenarios  []string          `json:"scenarios,omitempty"`
	Flow       []string          `json:"flow,omitempty"`
	Learn      []any             `json:"learn,omitempty"`
	Sample     *topicSampleJSON  `json:"sample,omitempty"`
	Preview    *topicPreviewJSON `json:"preview,omitempty"`
}

type topicStartJSON struct {
	Label string `json:"label"`
	Path  string `json:"path"`
}

type topicSampleJSON struct {
	Caption string   `json:"caption"`
	Before  []string `json:"before"`
	After   []string `json:"after"`
}

type topicPreviewJSON struct {
	Script   string                      `json:"script"`
	Intro    string                      `json:"intro,omitempty"`
	Sections map[string]topicSectionJSON `json:"sections,omitempty"`
}

type topicSectionJSON struct {
	Note        string `json:"note,omitempty"`
	Interactive bool   `json:"interactive,omitempty"`
}

type topicLearnJSON struct {
	Level string `json:"level"`
	Text  string `json:"text"`
}

// content 把拆開的內容組回 content JSON;完全沒有內容時回 nil。
func (p topicParts) content() json.RawMessage {
	c := topicContentJSON{Icon: p.f.Icon, Lede: p.f.Lede, Tag: p.f.Tag, Intro: p.f.Intro, LearnTitle: p.f.LearnTitle, Open: p.f.Status == topicStatusOpen}
	if p.f.StartCourse != "" {
		c.Start = &topicStartJSON{Label: p.f.StartLabel, Path: "/courses/" + p.f.StartCourse + "/" + LessonSlug(p.f.StartCourse == stagedCourseID, p.f.StartLesson)}
	}
	sample := topicSampleJSON{Caption: p.f.SampleCaption, Before: []string{}, After: []string{}}
	for _, it := range p.items {
		switch it.Kind {
		case "outcome":
			c.Outcomes = append(c.Outcomes, it.Text)
		case "pain":
			c.Pains = append(c.Pains, it.Text)
		case "scenario":
			c.Scenarios = append(c.Scenarios, it.Text)
		case "flow":
			c.Flow = append(c.Flow, it.Text)
		case "learn":
			if it.Level == "" {
				c.Learn = append(c.Learn, it.Text)
			} else {
				c.Learn = append(c.Learn, topicLearnJSON{it.Level, it.Text})
			}
		case "sample_before":
			sample.Before = append(sample.Before, it.Text)
		case "sample_after":
			sample.After = append(sample.After, it.Text)
		}
	}
	if sample.Caption != "" || len(sample.Before)+len(sample.After) > 0 {
		c.Sample = &sample
	}
	if p.f.PreviewScript != "" || p.f.PreviewIntro != "" || len(p.sections) > 0 {
		c.Preview = &topicPreviewJSON{Script: p.f.PreviewScript, Intro: p.f.PreviewIntro}
		for _, s := range p.sections {
			if c.Preview.Sections == nil {
				c.Preview.Sections = map[string]topicSectionJSON{}
			}
			c.Preview.Sections[s.Name] = topicSectionJSON{s.Note, s.Interactive}
		}
	}
	raw, err := json.Marshal(c)
	if err != nil || string(raw) == "{}" {
		return nil
	}
	return raw
}

// startLesson 把 /courses/<課程>/<課> 換成課程 id 與課號;沒有這一課回 false。
func startLesson(tx *gorm.DB, path string) (course, lesson string, ok bool, err error) {
	parts := strings.Split(path, "/")
	if len(parts) != 4 || parts[0] != "" || parts[1] != "courses" {
		return "", "", false, nil
	}
	var ids []string
	if err := tx.Model(&lessonRow{}).Where("course_id = ?", parts[2]).Pluck("id", &ids).Error; err != nil {
		return "", "", false, err
	}
	for _, id := range ids {
		if LessonSlug(parts[2] == stagedCourseID, id) == parts[3] {
			return parts[2], id, true, nil
		}
	}
	return "", "", false, nil
}

func newTopicItemID(kind string) string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return kind + "-" + hex.EncodeToString(b)
}

// assignItemIDs 決定每個項目的 id:備份帶的(依種類與順序)優先,其次沿用同種類同文字的舊項目;
// 某種類的項目數沒變時,剩下的依順序沿用(改錯字:譯文標成過時而不是消失);其餘用 idFor 產生。
func assignItemIDs(items []topicItemRow, ids map[string][]string, old []topicItemRow, idFor func(kind string, n int) string) {
	unused := slices.Clone(old)
	slices.SortStableFunc(unused, func(a, b topicItemRow) int { return a.Position - b.Position })
	used := map[string]bool{}
	take := func(i int, match func(o topicItemRow) bool) {
		if j := slices.IndexFunc(unused, match); j >= 0 {
			items[i].ID = unused[j].ID
			used[items[i].ID] = true
			unused = slices.Delete(unused, j, j+1)
		}
	}
	for i := range items {
		it := &items[i]
		if given := ids[it.Kind]; it.Position < len(given) && given[it.Position] != "" && !used[given[it.Position]] {
			it.ID = given[it.Position]
			used[it.ID] = true
		}
	}
	for i := range items {
		if it := items[i]; it.ID == "" {
			take(i, func(o topicItemRow) bool { return o.Kind == it.Kind && o.Text == it.Text && !used[o.ID] })
		}
	}
	n, before := map[string]int{}, map[string]int{}
	for _, it := range items {
		n[it.Kind]++
	}
	for _, o := range old {
		before[o.Kind]++
	}
	for i := range items {
		if it := items[i]; it.ID == "" && n[it.Kind] == before[it.Kind] {
			take(i, func(o topicItemRow) bool { return o.Kind == it.Kind && !used[o.ID] })
		}
		if items[i].ID == "" {
			items[i].ID = idFor(items[i].Kind, items[i].Position+1)
		}
	}
}

// parseTopicParts 拆開 content。拆完組不回原樣(不認得的欄位、start 指向不存在的課…)回驗證錯誤。
// 項目 id 見 assignItemIDs。
func parseTopicParts(tx *gorm.DB, topicID, content string, ids map[string][]string, old []topicItemRow, idFor func(kind string, n int) string) (topicParts, error) {
	var p topicParts
	if strings.TrimSpace(content) == "" {
		content = "{}"
	}
	var c struct {
		topicContentJSON
		Learn []json.RawMessage `json:"learn"`
	}
	if err := json.Unmarshal([]byte(content), &c); err != nil {
		return p, invalid("content 的欄位型別不對:%s", err)
	}
	p.f = TopicFields{Icon: c.Icon, Lede: c.Lede, Tag: c.Tag, Intro: c.Intro, LearnTitle: c.LearnTitle, Status: topicStatusPlanned}
	if c.Open {
		p.f.Status = topicStatusOpen
	}
	if c.Start != nil {
		course, lesson, ok, err := startLesson(tx, c.Start.Path)
		if err != nil {
			return p, err
		}
		if !ok {
			return p, invalid("content.start.path 要指向存在的一課(/courses/<課程>/<課>):%q", c.Start.Path)
		}
		p.f.StartLabel, p.f.StartCourse, p.f.StartLesson = c.Start.Label, course, lesson
	}
	count := map[string]int{}
	add := func(kind, text, level string) {
		p.items = append(p.items, topicItemRow{TopicID: topicID, Kind: kind, Position: count[kind], Text: text, Level: level})
		count[kind]++
	}
	for _, list := range []struct {
		kind  string
		texts []string
	}{{"outcome", c.Outcomes}, {"pain", c.Pains}, {"scenario", c.Scenarios}, {"flow", c.Flow}} {
		for _, t := range list.texts {
			add(list.kind, t, "")
		}
	}
	for _, raw := range c.Learn {
		var text string
		if json.Unmarshal(raw, &text) == nil {
			add("learn", text, "")
			continue
		}
		var item topicLearnJSON
		if err := json.Unmarshal(raw, &item); err != nil {
			return p, invalid("content.learn 的每一項要是文字或 {level, text}")
		}
		add("learn", item.Text, item.Level)
	}
	if c.Sample != nil {
		p.f.SampleCaption = c.Sample.Caption
		for _, t := range c.Sample.Before {
			add("sample_before", t, "")
		}
		for _, t := range c.Sample.After {
			add("sample_after", t, "")
		}
	}
	if c.Preview != nil {
		p.f.PreviewScript, p.f.PreviewIntro = c.Preview.Script, c.Preview.Intro
		for _, name := range sortedKeys(c.Preview.Sections) {
			if len([]rune(name)) > 100 {
				return p, invalid("content.preview.sections 的段落名稱最多 100 字")
			}
			s := c.Preview.Sections[name]
			p.sections = append(p.sections, topicSectionRow{TopicID: topicID, Name: name, Note: s.Note, Interactive: s.Interactive})
		}
	}
	assignItemIDs(p.items, ids, old, idFor)
	if err := checkPartLengths(p); err != nil {
		return p, err
	}
	if !sameContent(content, string(p.content())) {
		return p, invalid("content 有不認得或無法保存的欄位")
	}
	return p, nil
}

// checkPartLengths 對照欄位的長度上限:SQLite 不限長度,Postgres 超過會讓整個寫入失敗。
func checkPartLengths(p topicParts) error {
	type limit struct {
		name, value string
		max         int
	}
	limits := []limit{
		{"icon", p.f.Icon, 32}, {"tag", p.f.Tag, 200}, {"learnTitle", p.f.LearnTitle, 100},
		{"start.label", p.f.StartLabel, 100}, {"preview.script", p.f.PreviewScript, 200},
	}
	for _, it := range p.items {
		limits = append(limits, limit{"learn 的 level", it.Level, 100}, limit{"項目 id", it.ID, 64})
	}
	for _, l := range limits {
		if len([]rune(l.value)) > l.max {
			return invalid("content 的 %s 最多 %d 字", l.name, l.max)
		}
	}
	return nil
}

// sameContent 比較兩份 content 的意義是否相同(空字串、false、null、空陣列、空物件視同沒有)。
func sameContent(a, b string) bool {
	var prune func(v any) any
	prune = func(v any) any {
		switch x := v.(type) {
		case map[string]any:
			out := map[string]any{}
			for k, e := range x {
				if e = prune(e); e != nil {
					out[k] = e
				}
			}
			if len(out) > 0 {
				return out
			}
		case []any:
			var out []any
			for _, e := range x {
				out = append(out, prune(e))
			}
			if len(out) > 0 {
				return out
			}
		case string:
			if x != "" {
				return x
			}
		case bool:
			if x {
				return x
			}
		default:
			return x
		}
		return nil
	}
	parse := func(s string) any {
		var v any
		if s != "" {
			_ = json.Unmarshal([]byte(s), &v)
		}
		return prune(v)
	}
	return reflect.DeepEqual(parse(a), parse(b))
}

// writeTopicParts 把拆開的內容寫進資料庫(取代原有的項目與段落),拿掉的項目、段落的譯文一併刪掉。
func writeTopicParts(tx *gorm.DB, user, topicID string, p topicParts) error {
	var oldItems []topicItemRow
	if err := tx.Where("topic_id = ?", topicID).Find(&oldItems).Error; err != nil {
		return err
	}
	var oldSections []topicSectionRow
	if err := tx.Where("topic_id = ?", topicID).Find(&oldSections).Error; err != nil {
		return err
	}
	for _, o := range oldItems {
		if !slices.ContainsFunc(p.items, func(n topicItemRow) bool { return n.ID == o.ID }) {
			if err := dropTranslations(tx, user, I18nTopicItem, topicID+"/"+o.ID); err != nil {
				return err
			}
		}
	}
	for _, o := range oldSections {
		if !slices.ContainsFunc(p.sections, func(n topicSectionRow) bool { return n.Name == o.Name }) {
			if err := dropTranslations(tx, user, I18nTopicSection, topicID+"/"+o.Name); err != nil {
				return err
			}
		}
	}
	if err := deleteTopicParts(tx, topicID); err != nil {
		return err
	}
	if len(p.items) > 0 {
		if err := tx.Create(&p.items).Error; err != nil {
			return err
		}
	}
	if len(p.sections) > 0 {
		if err := tx.Create(&p.sections).Error; err != nil {
			return err
		}
	}
	return tx.Model(&topicRow{}).Where("id = ?", topicID).Select(topicFieldColumns).Updates(&topicRow{Structured: true, TopicFields: p.f}).Error
}

func deleteTopicParts(tx *gorm.DB, topicID string) error {
	if err := tx.Where("topic_id = ?", topicID).Delete(&topicItemRow{}).Error; err != nil {
		return err
	}
	return tx.Where("topic_id = ?", topicID).Delete(&topicSectionRow{}).Error
}

// structureTopics 把還沒轉換的主題拆進結構化的欄位與表(可重複執行);拆不出原樣的保持原狀並記一則 log。
// ids 是備份帶的項目 id(主題 id → 種類 → 依序的 id)。回傳這次轉換的主題數。要在課程寫入之後呼叫(start 要對得到課)。
func structureTopics(tx *gorm.DB, ids map[string]map[string][]string) (int, error) {
	var rows []topicRow
	if err := tx.Where("structured = ?", false).Order("position, id").Find(&rows).Error; err != nil {
		return 0, err
	}
	n := 0
	for _, t := range rows {
		var old []topicItemRow
		if err := tx.Where("topic_id = ?", t.ID).Find(&old).Error; err != nil {
			return n, err
		}
		// 第一次轉換用固定的 id(種類-序號),之後新增的項目用隨機 id,刪掉的 id 不會被重用
		p, err := parseTopicParts(tx, t.ID, t.Content, ids[t.ID], old, func(kind string, i int) string {
			if len(old) == 0 {
				return fmt.Sprintf("%s-%d", kind, i)
			}
			return newTopicItemID(kind)
		})
		if errors.Is(err, ErrInvalidCourseData) {
			log.Printf("主題 %s 維持舊格式:%v", t.ID, err)
			continue
		}
		if err != nil {
			return n, err
		}
		// 先搶下這一列:多台伺服器同時啟動時只有一台寫入
		res := tx.Model(&topicRow{}).Where("id = ? AND structured = ?", t.ID, false).UpdateColumn("structured", true)
		if res.Error != nil {
			return n, res.Error
		}
		if res.RowsAffected == 0 {
			continue
		}
		if err := writeTopicParts(tx, "sync", t.ID, p); err != nil {
			return n, err
		}
		n++
	}
	return n, nil
}

// lockTopic 鎖住主題那一列到交易結束(Postgres;SQLite 本來就一次一個寫入者),同時改同一主題的清單才不會互相蓋掉。
func lockTopic(tx *gorm.DB, id string) error {
	var ids []string
	return tx.Model(&topicRow{}).Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", id).Pluck("id", &ids).Error
}

// loadTopics 讀主題列,連同項目與段落組成 Topic;where 空的代表全部。
func loadTopics(db *gorm.DB, id string) ([]Topic, error) {
	q := func() *gorm.DB { return db.Session(&gorm.Session{}) }
	rowsQ, itemsQ, secQ := q(), q(), q()
	if id != "" {
		rowsQ, itemsQ, secQ = rowsQ.Where("id = ?", id), itemsQ.Where("topic_id = ?", id), secQ.Where("topic_id = ?", id)
	}
	var rows []topicRow
	if err := rowsQ.Order("position, id").Find(&rows).Error; err != nil {
		return nil, err
	}
	var items []topicItemRow
	if err := itemsQ.Order("topic_id, position, id").Find(&items).Error; err != nil {
		return nil, err
	}
	var sections []topicSectionRow
	if err := secQ.Order("topic_id, name").Find(&sections).Error; err != nil {
		return nil, err
	}
	out := make([]Topic, len(rows))
	for i, r := range rows {
		t := r.topic()
		if r.Structured {
			p := &topicParts{f: r.TopicFields}
			for _, kind := range topicItemKinds {
				for _, it := range items {
					if it.TopicID == r.ID && it.Kind == kind {
						p.items = append(p.items, it)
					}
				}
			}
			for _, s := range sections {
				if s.TopicID == r.ID {
					p.sections = append(p.sections, s)
				}
			}
			t.parts, t.Content = p, p.content()
		}
		out[i] = t
	}
	return out, nil
}
