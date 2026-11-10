package store

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// topicRow 是前端的「主題」(主題頁與首頁上的主題區塊用的文案):一個主題對應一條學習路線,底下有幾門課(courses.topic_id)。
// 資料來源是 topics_seed.json,啟動(Open)與部署時的同步工作都會寫進這張表;Content 是各主題自己的版面內容(痛點、學到什麼、流程…),
// 各主題欄位不盡相同,所以存成 JSON 字串,後端不解讀。
type topicRow struct {
	ID          string `gorm:"primaryKey;size:32"`
	Name        string `gorm:"size:200;not null"`
	Slogan      string `gorm:"size:500"`
	Description string `gorm:"type:text"`
	SeoTitle    string `gorm:"size:300"`
	CoursePath  string `gorm:"size:200"`
	TopicPath   string `gorm:"size:200"`
	Position    int    `gorm:"not null"`
	Content     string `gorm:"type:text;not null"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (topicRow) TableName() string { return "topics" }

// ErrTopicNotFound 是查不到主題時回傳的錯誤。
var ErrTopicNotFound = errors.New("topic not found")

// TopicCourse 是主題底下的一門課。
type TopicCourse struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Access string `json:"access"`
	Tier   string `json:"tier,omitempty"`
}

// Topic 是一個主題,Courses 是它底下的課程(依種子順序)。
type Topic struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Slogan      string          `json:"slogan"`
	Description string          `json:"description"`
	SeoTitle    string          `json:"seoTitle"`
	CoursePath  string          `json:"coursePath"`
	TopicPath   string          `json:"topicPath"`
	Position    int             `json:"position"`
	Content     json.RawMessage `json:"content"`
	Courses     []TopicCourse   `json:"courses"`
}

// topicSeedRow 是 topics_seed.json 的一列。
type topicSeedRow struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Slogan      string          `json:"slogan"`
	Description string          `json:"description"`
	SeoTitle    string          `json:"seoTitle"`
	CoursePath  string          `json:"coursePath"`
	TopicPath   string          `json:"topicPath"`
	Position    int             `json:"position"`
	Content     json.RawMessage `json:"content"`
}

//go:embed topics_seed.json
var topicSeed []byte

// parseTopicSeed 解析並檢查主題種子:id 不能空白或重複、名稱與路徑要有、路徑要是 /courses/<id>、/topics/<id>、content 要是 JSON 物件。
func parseTopicSeed(data []byte) ([]topicSeedRow, error) {
	var seeds []topicSeedRow
	if err := json.Unmarshal(data, &seeds); err != nil {
		return nil, fmt.Errorf("parse topic seed: %w", err)
	}
	seen := map[string]bool{}
	for i, t := range seeds {
		if t.ID == "" {
			return nil, fmt.Errorf("topic seed #%d: id is empty", i)
		}
		if seen[t.ID] {
			return nil, fmt.Errorf("topic seed %s: duplicate id", t.ID)
		}
		seen[t.ID] = true
		if t.Name == "" || t.CoursePath == "" || t.TopicPath == "" {
			return nil, fmt.Errorf("topic seed %s: name, coursePath and topicPath are required", t.ID)
		}
		if t.CoursePath != "/courses/"+t.ID || t.TopicPath != "/topics/"+t.ID {
			return nil, fmt.Errorf("topic seed %s: paths must be /courses/%s and /topics/%s", t.ID, t.ID, t.ID)
		}
		var obj map[string]json.RawMessage
		if err := json.Unmarshal(t.Content, &obj); err != nil || obj == nil {
			return nil, fmt.Errorf("topic seed %s: content must be a JSON object", t.ID)
		}
	}
	return seeds, nil
}

// upsertTopics 把主題種子寫進資料庫:沒有的新增,已經有的全部欄位用種子的內容更新(跟課程一樣以種子為準)。
func upsertTopics(tx *gorm.DB, seeds []topicSeedRow) error {
	if len(seeds) == 0 {
		return nil
	}
	at := now()
	rows := make([]topicRow, len(seeds))
	for i, t := range seeds {
		rows[i] = topicRow{
			ID: t.ID, Name: t.Name, Slogan: t.Slogan, Description: t.Description, SeoTitle: t.SeoTitle,
			CoursePath: t.CoursePath, TopicPath: t.TopicPath, Position: t.Position, Content: string(t.Content),
			CreatedAt: at, UpdatedAt: at,
		}
	}
	return tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"name", "slogan", "description", "seo_title", "course_path", "topic_path", "position", "content", "updated_at",
		}),
	}).Create(&rows).Error
}

// SeedTopics 把 topics_seed.json 的主題寫進資料庫(沒有的新增、已有的用種子更新),檢查不過就整批不寫。
func (s *Store) SeedTopics(ctx context.Context) error {
	seeds, err := parseTopicSeed(topicSeed)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error { return upsertTopics(tx, seeds) })
}

// seedCourseOrder 是課程在種子裡的順序(id → 序號);同一次同步寫入的課程建立時間相同,顯示順序要靠它。
func seedCourseOrder() map[string]int {
	var seeds []courseSeedRow
	order := map[string]int{}
	if json.Unmarshal(courseSeed, &seeds) == nil {
		for i, c := range seeds {
			order[c.ID] = i
		}
	}
	return order
}

func (s *Store) topicCourses(ctx context.Context, ids ...string) (map[string][]TopicCourse, error) {
	var rows []courseRow
	q := s.db.WithContext(ctx).Where("topic_id <> ''")
	if len(ids) > 0 {
		q = q.Where("topic_id IN ?", ids)
	}
	if err := q.Order("created_at, id").Find(&rows).Error; err != nil {
		return nil, err
	}
	order := seedCourseOrder()
	rank := func(id string) int {
		if n, ok := order[id]; ok {
			return n
		}
		return len(order)
	}
	sort.SliceStable(rows, func(i, j int) bool { return rank(rows[i].ID) < rank(rows[j].ID) })
	out := map[string][]TopicCourse{}
	for _, r := range rows {
		out[r.Topic] = append(out[r.Topic], TopicCourse{ID: r.ID, Title: r.Title, Access: r.Access, Tier: r.Tier})
	}
	return out, nil
}

func (r topicRow) topic(courses []TopicCourse) Topic {
	if courses == nil {
		courses = []TopicCourse{}
	}
	return Topic{
		ID: r.ID, Name: r.Name, Slogan: r.Slogan, Description: r.Description, SeoTitle: r.SeoTitle,
		CoursePath: r.CoursePath, TopicPath: r.TopicPath, Position: r.Position,
		Content: json.RawMessage(strings.TrimSpace(r.Content)), Courses: courses,
	}
}

// Topics 回傳所有主題(依 position),每個主題帶它底下的課程。
func (s *Store) Topics(ctx context.Context) ([]Topic, error) {
	var rows []topicRow
	if err := s.db.WithContext(ctx).Order("position, id").Find(&rows).Error; err != nil {
		return nil, err
	}
	courses, err := s.topicCourses(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Topic, len(rows))
	for i, r := range rows {
		out[i] = r.topic(courses[r.ID])
	}
	return out, nil
}

// TopicOf 回傳一個主題與它底下的課程;沒有這個主題回 ErrTopicNotFound。
func (s *Store) TopicOf(ctx context.Context, id string) (Topic, error) {
	var r topicRow
	err := s.db.WithContext(ctx).First(&r, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Topic{}, ErrTopicNotFound
	}
	if err != nil {
		return Topic{}, err
	}
	courses, err := s.topicCourses(ctx, id)
	if err != nil {
		return Topic{}, err
	}
	return r.topic(courses[id]), nil
}
