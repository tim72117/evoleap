package store

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// topicRow 是一個主題(首頁卡片、主題頁、全部課程頁的分組標題),以資料庫為準,用 evoleap topic set 修改。
// 一個主題底下有幾門課由 courses.topic_id 決定;單一課程的主題,Path 是那門課的課程總覽網址(例如 /courses/web)。規劃中的主題還沒有主題頁,Path 是空的。
type topicRow struct {
	ID       string `gorm:"primaryKey;size:64"`
	Position int
	Name     string `gorm:"size:100;not null"`
	Slogan   string `gorm:"size:200"`
	// Path 是主題頁的網址(/ 開頭);規劃中的主題沒有
	Path string `gorm:"size:100"`
	// SEOTitle、Description 是搜尋結果的標題與描述
	SEOTitle    string `gorm:"size:200"`
	Description string `gorm:"size:500"`
	// Content 是舊格式的內容(整包 JSON);只有還沒轉換的主題在用,下一版移除
	Content string `gorm:"type:text;not null"`
	// Structured 為 true 時內容在下面的欄位與 topic_items、topic_preview_sections(見 topiccontent.go),Content 不再使用
	Structured  bool `gorm:"not null;default:false"`
	TopicFields `gorm:"embedded"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (topicRow) TableName() string { return "topics" }

// maxTopicContentBytes 是主題 content 的大小上限
const maxTopicContentBytes = 64 << 10

// ErrTopicNotFound 是查不到主題時回傳的錯誤。
var ErrTopicNotFound = errors.New("topic not found")

// topicSeedRow 是 主題資料 的一列;陣列的順序就是主題的 position。
type topicSeedRow struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Slogan      string          `json:"slogan,omitempty"`
	Path        string          `json:"path,omitempty"`
	SEOTitle    string          `json:"seoTitle,omitempty"`
	Description string          `json:"description,omitempty"`
	Content     json.RawMessage `json:"content,omitempty"`
	// ItemIDs 是清單項目的 id(種類 → 依序),讓復原後譯文仍對得上
	ItemIDs map[string][]string `json:"itemIds,omitempty"`
	// Sections 是主題頁的區塊;沒寫就不動資料庫現有的
	Sections []PageSection `json:"sections,omitempty"`
}

func parseTopicSeed(seed []byte) ([]topicSeedRow, error) {
	var seeds []topicSeedRow
	if err := json.Unmarshal(seed, &seeds); err != nil {
		return nil, fmt.Errorf("parse topic seed: %w", err)
	}
	return seeds, nil
}

var topicIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)

// validateTopic 檢查主題的欄位(種子與管理員更新共用),回傳整理過的 content(壓縮成一行的 JSON 物件;空的當成 {})。
func validateTopic(name, slogan, path, seoTitle, description string, content []byte) (string, error) {
	if name == "" {
		return "", invalid("name 不能是空的")
	}
	if len([]rune(name)) > 100 || len([]rune(slogan)) > 200 || len([]rune(path)) > 100 {
		return "", invalid("name 最多 100 字、slogan 最多 200 字、path 最多 100 字")
	}
	if path != "" && (!strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") || strings.ContainsFunc(path, func(r rune) bool { return r == '\\' || unicode.IsControl(r) })) {
		return "", invalid("path 要是站內網址(/ 開頭,不能含反斜線或控制字元),或留空(還沒有主題頁)")
	}
	if len([]rune(seoTitle)) > 200 || len([]rune(description)) > 500 {
		return "", invalid("seoTitle 最多 200 字、description 最多 500 字")
	}
	if len(bytes.TrimSpace(content)) == 0 {
		return "{}", nil
	}
	if len(content) > maxTopicContentBytes {
		return "", invalid("content 超過 %dKB", maxTopicContentBytes>>10)
	}
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(content, &obj); err != nil || obj == nil {
		return "", invalid("content 要是 JSON 物件({...})")
	}
	if err := checkTopicContent(content); err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := json.Compact(&buf, content); err != nil {
		return "", invalid("content 不是有效的 JSON")
	}
	return buf.String(), nil
}

// checkTopicContent 檢查前端會讀的欄位型別(不認得的鍵由 parseTopicParts 拒絕):型別打錯前端那一欄就顯示不出來。
func checkTopicContent(content []byte) error {
	var c struct {
		Icon, Lede, Tag, Intro, LearnTitle string
		Open                               bool
		Outcomes, Pains, Scenarios, Flow   []string
		Sample                             *struct {
			Caption       string
			Before, After []string
		}
		Preview *struct {
			Script, Intro string
			Sections      map[string]struct {
				Note        string
				Interactive bool
			}
		}
		Start *struct{ Label, Path string }
		Learn []json.RawMessage
	}
	if err := json.Unmarshal(content, &c); err != nil {
		return invalid("content 的欄位型別不對:%s", err)
	}
	for _, raw := range c.Learn {
		var text string
		var item struct{ Level, Text string }
		if json.Unmarshal(raw, &text) != nil && json.Unmarshal(raw, &item) != nil {
			return invalid("content.learn 的每一項要是文字或 {level, text}")
		}
	}
	return nil
}

// seedTopics 把種子的主題寫進資料庫(在呼叫端的交易裡):沒有的新增、已經有的用種子的內容更新,position 依種子陣列的順序。種子是空的就不動。
func seedTopics(tx *gorm.DB, seeds []topicSeedRow) error {
	if len(seeds) == 0 {
		return nil
	}
	at := now()
	rows := make([]topicRow, len(seeds))
	seen := map[string]bool{}
	for i, t := range seeds {
		if !topicIDPattern.MatchString(t.ID) || len(t.ID) > 64 {
			return fmt.Errorf("主題 id %q 不合規則(小寫英數與 -,最多 64 字)", t.ID)
		}
		if seen[t.ID] {
			return fmt.Errorf("主題 id %q 重複", t.ID)
		}
		seen[t.ID] = true
		content, err := validateTopic(t.Name, t.Slogan, t.Path, t.SEOTitle, t.Description, t.Content)
		if err != nil {
			return fmt.Errorf("主題 %s:%w", t.ID, err)
		}
		rows[i] = topicRow{ID: t.ID, Position: i, Name: t.Name, Slogan: t.Slogan, Path: t.Path, SEOTitle: t.SEOTitle, Description: t.Description, Content: content, CreatedAt: at, UpdatedAt: at}
	}
	for _, t := range seeds {
		if t.Sections != nil {
			if err := writeTopicPage(tx, t.ID, t.Sections); err != nil {
				return fmt.Errorf("主題 %s:%w", t.ID, err)
			}
		}
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"position", "name", "slogan", "path", "seo_title", "description", "content", "structured", "updated_at"}),
	}).Create(&rows).Error
}

// pruneTopics 刪掉資料庫有、種子已經沒有的主題;還有課程引用(topic_id)的主題(只會是種子以外的課程,例如管理員用 CLI 掛上去的)不刪,
// 回傳一則警告(列出主題 id 與引用它的課程 id),同步照常完成。要在課程同步之後呼叫(種子的課程可能剛從舊主題搬走)。
// 種子是空的(測試或還沒有主題)不刪。
func pruneTopics(tx *gorm.DB, seeds []topicSeedRow) ([]string, error) {
	if len(seeds) == 0 {
		return nil, nil
	}
	ids := make([]string, len(seeds))
	for i, t := range seeds {
		ids[i] = t.ID
	}
	var stale []string
	if err := tx.Model(&topicRow{}).Where("id NOT IN ?", ids).Order("id").Pluck("id", &stale).Error; err != nil {
		return nil, err
	}
	if len(stale) == 0 {
		return nil, nil
	}
	var refs []struct{ ID, TopicID string }
	if err := tx.Model(&courseRow{}).Select("id", "topic_id").Where("topic_id IN ?", stale).Order("topic_id, id").Scan(&refs).Error; err != nil {
		return nil, err
	}
	byTopic := map[string][]string{}
	for _, r := range refs {
		byTopic[r.TopicID] = append(byTopic[r.TopicID], r.ID)
	}
	var warnings, deletable []string
	for _, id := range stale {
		if cs := byTopic[id]; len(cs) > 0 {
			warnings = append(warnings, fmt.Sprintf("主題 %s 已經不在種子裡,但還有課程屬於它,先保留(課程:%s);請改課程的 topicId 或把主題加回種子", id, strings.Join(cs, "、")))
		} else {
			deletable = append(deletable, id)
		}
	}
	if len(deletable) == 0 {
		return warnings, nil
	}
	for _, id := range deletable {
		if err := deleteTopicParts(tx, id); err != nil {
			return warnings, err
		}
		if err := deleteTopicPage(tx, id); err != nil {
			return warnings, err
		}
	}
	return warnings, tx.Where("id IN ?", deletable).Delete(&topicRow{}).Error
}

// Topic 是給 API 回傳的主題(GET /api/topics);Content 是 JSON 物件,沒有內容時省略。
type Topic struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Slogan      string          `json:"slogan,omitempty"`
	Path        string          `json:"path,omitempty"`
	SEOTitle    string          `json:"seoTitle,omitempty"`
	Description string          `json:"description,omitempty"`
	Content     json.RawMessage `json:"content,omitempty"`
	// Items 是清單項目(只有管理端的清單帶)
	Items []TopicItem `json:"items,omitempty"`
	// Sections 是主題頁的區塊(只有管理端的清單帶;公開的是 GET /api/topics/{id}/page)
	Sections []PageSection `json:"sections,omitempty"`
	parts    *topicParts
}

func (r topicRow) topic() Topic {
	t := Topic{ID: r.ID, Name: r.Name, Slogan: r.Slogan, Path: r.Path, SEOTitle: r.SEOTitle, Description: r.Description}
	if r.Content != "" && r.Content != "{}" {
		t.Content = json.RawMessage(r.Content)
	}
	return t
}

// ListTopics 回傳所有主題,依 position 排序(同順位依 id)。
func (s *Store) ListTopics(ctx context.Context) ([]Topic, error) {
	return loadTopics(s.db.WithContext(ctx), "")
}

// TopicOf 回傳一個主題;不存在時回 ErrTopicNotFound。
func (s *Store) TopicOf(ctx context.Context, id string) (Topic, error) {
	if id == "" {
		return Topic{}, ErrTopicNotFound
	}
	ts, err := loadTopics(s.db.WithContext(ctx), id)
	if err != nil {
		return Topic{}, err
	}
	if len(ts) == 0 {
		return Topic{}, ErrTopicNotFound
	}
	return ts[0], nil
}

// TopicPatch 是一個主題要改的欄位;nil 代表不改,給空字串代表清掉(name 不能清)。Content 是整包換掉的 JSON 物件。
type TopicPatch struct {
	Name        *string          `json:"name,omitempty"`
	Slogan      *string          `json:"slogan,omitempty"`
	Path        *string          `json:"path,omitempty"`
	SEOTitle    *string          `json:"seoTitle,omitempty"`
	Description *string          `json:"description,omitempty"`
	Content     *json.RawMessage `json:"content,omitempty"`
}

// UpdateTopic 改一個主題並記一筆修改紀錄(topic.update);主題不存在時回 ErrTopicNotFound。
// 和課程一樣,種子裡有的主題下次同步會被蓋回種子的內容。清掉 path 時不能還有課程屬於這個主題(全部課程頁要有主題頁網址)。
func (s *Store) UpdateTopic(ctx context.Context, user, id string, p TopicPatch) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockTopic(tx, id); err != nil {
			return err
		}
		var t topicRow
		err := tx.First(&t, "id = ?", id).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTopicNotFound
		}
		if err != nil {
			return err
		}
		set := func(dst *string, v *string) {
			if v != nil {
				*dst = strings.TrimSpace(*v)
			}
		}
		set(&t.Name, p.Name)
		set(&t.Slogan, p.Slogan)
		set(&t.Path, p.Path)
		set(&t.SEOTitle, p.SEOTitle)
		set(&t.Description, p.Description)
		content := []byte(t.Content)
		if p.Content != nil {
			content = *p.Content
		} else if t.Structured {
			content = nil // 已結構化的主題沒改內容時不看舊欄位
		}
		cleaned, err := validateTopic(t.Name, t.Slogan, t.Path, t.SEOTitle, t.Description, content)
		if err != nil {
			return err
		}
		if p.Content != nil {
			var old []topicItemRow
			if err := tx.Where("topic_id = ?", id).Find(&old).Error; err != nil {
				return err
			}
			parts, err := parseTopicParts(tx, id, cleaned, nil, old, func(kind string, _ int) string { return newTopicItemID(kind) })
			if err != nil {
				return err
			}
			if err := writeTopicParts(tx, user, id, parts); err != nil {
				return err
			}
		}
		if t.Path == "" {
			var n int64
			if err := tx.Model(&courseRow{}).Where("topic_id = ?", id).Count(&n).Error; err != nil {
				return err
			}
			if n > 0 {
				return invalid("還有 %d 門課屬於這個主題,path 不能清掉", n)
			}
		}
		if err := tx.Model(&topicRow{}).Where("id = ?", id).
			Select("name", "slogan", "path", "seo_title", "description", "updated_at").
			Updates(&topicRow{Name: t.Name, Slogan: t.Slogan, Path: t.Path, SEOTitle: t.SEOTitle, Description: t.Description, UpdatedAt: now()}).Error; err != nil {
			return err
		}
		if err := syncI18nSources(tx); err != nil {
			return err
		}
		return s.recordChange(tx, user, "topic.update", id, p)
	})
}

// TopicViews 回傳每個主題的觀看次數(首頁主題卡片顯示用):底下各課的「訪客打開(不含爬蟲)」加上「會員有播放紀錄的課」。
// 一課的播放進度每個會員只有一筆,所以會員算「看過幾堂」,不是播放幾次。只算已開放(open)的課:草稿與規劃中的課(管理員或測試打開)不算,公開的數字才不會被灌。同一筆紀錄對到好幾課(共用腳本)只算一次。
func (s *Store) TopicViews(ctx context.Context) (map[string]int, error) {
	const byLesson = " JOIN lessons l ON (%s.lesson = 'live:' || l.script OR %s.lesson = 'kids:' || l.script) JOIN courses c ON c.id = l.course_id" +
		" WHERE l.script IS NOT NULL AND l.script <> '' AND c.topic_id IS NOT NULL AND c.topic_id <> '' AND l.status = 'open'"
	type row struct {
		TopicID string
		N       int
	}
	views := map[string]int{}
	for _, q := range []string{
		"SELECT c.topic_id AS topic_id, COUNT(DISTINCT g.id) AS n FROM guest_views g" + fmt.Sprintf(byLesson, "g", "g") + " AND g.device <> 'bot' GROUP BY c.topic_id",
		"SELECT c.topic_id AS topic_id, COUNT(DISTINCT p.user_id || '/' || p.lesson) AS n FROM progress p" + fmt.Sprintf(byLesson, "p", "p") + " GROUP BY c.topic_id",
	} {
		var rows []row
		if err := s.db.WithContext(ctx).Raw(q).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, r := range rows {
			views[r.TopicID] += r.N
		}
	}
	return views, nil
}
