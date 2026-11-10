package store

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// courseRow 記錄每門課的存取方式,Access 為 subscription 代表要訂閱才能看。
// 資料來源是 courses_seed.json,寫入課程資料時(正式環境是部署時的同步工作 cmd/sync,本機是後端啟動時)同步進這張表。課程地圖 API 回傳它,腳本檔(GET /api/scripts)依它與每一課的 access 把關;
// 訂閱檢查還沒做(訂閱課程的腳本只給管理員)。前端 /courses/... 的單課頁要不要登入仍看 content/catalog.ts,content/courseMap.test.ts 檢查兩邊一致。
type courseRow struct {
	ID     string `gorm:"primaryKey;size:64"`
	Title  string `gorm:"size:200;not null"`
	Access string `gorm:"size:16;not null"`
	// Tier 是訂閱課程需要的最低方案(例如 basic、advanced);其他課程是空的。
	Tier string `gorm:"size:32"`
	// Topic 是這門課屬於哪個主題(topics 表的 id,見 topics.go)。
	Topic     string `gorm:"column:topic_id;size:32;index"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (courseRow) TableName() string { return "courses" }

// Access 是課程的存取方式。
type Access string

const (
	AccessFree         Access = "free"
	AccessLoginFree    Access = "login-free"
	AccessSubscription Access = "subscription"
)

// ErrCourseNotFound 是查不到課程時回傳的錯誤。
var ErrCourseNotFound = errors.New("course not found")

// CourseAccess 回傳課程的存取方式(之後的訂閱檢查用,目前還沒有呼叫的地方),以及訂閱課程需要的最低方案(其他課程是空字串)。
func (s *Store) CourseAccess(ctx context.Context, id string) (Access, string, error) {
	var r courseRow
	err := s.db.WithContext(ctx).First(&r, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", "", ErrCourseNotFound
	}
	if err != nil {
		return "", "", err
	}
	return Access(r.Access), r.Tier, nil
}

// courseSeedRow 是 courses_seed.json 的一列。
type courseSeedRow struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Access string `json:"access"`
	Tier   string `json:"tier,omitempty"`
	// Topic 是課程所屬主題的 id,必須在 topics_seed.json 裡
	Topic string `json:"topic"`
	// Units 是這門課的單元與每一堂課(見 lessons.go);沒寫就不動這門課的單元與課
	Units []unitSeed `json:"units,omitempty"`
}

//go:embed courses_seed.json
var courseSeed []byte

// retiredCourses 是已經合併進別的課程、不再存在的課程 id → 合併後的課程 id。
// 「做出自己的軟體」原本是 tools(起步)、ai-tools(零基礎)、vibe-coding-basics(基礎)三門課,現在是一門課 software,三個階段是它的三個單元。
// 種子同步完(新課程已經建好、腳本檔已經改掛到新課程底下)之後,資料庫裡舊課程的課程、單元、課與腳本檔列就沒有用了,在這裡清掉
// (部署時的同步工作與本機後端啟動時都會跑,已經清掉就什麼都不做)。播放進度存的是腳本路徑,不受影響。
var retiredCourses = map[string]string{
	"tools":              "software",
	"ai-tools":           "software",
	"vibe-coding-basics": "software",
}

// retiredIn 回傳這份種子底下要清掉的舊課程 id:合併後的課程在種子裡、舊的已經不在種子裡才清(自訂種子的測試不受影響)。
func retiredIn(seeds []courseSeedRow) []string {
	have := map[string]bool{}
	for _, c := range seeds {
		have[c.ID] = true
	}
	var ids []string
	for old, merged := range retiredCourses {
		if have[merged] && !have[old] {
			ids = append(ids, old)
		}
	}
	return ids
}

// deleteRetiredCourses 刪掉舊課程的腳本檔、課、單元與課程本身。要等腳本檔都改掛到合併後的課程之後才能呼叫(SyncLessonFiles 的最後一步),
// 所以 SeedCourses 不清:只跑到種子同步、沒接著同步腳本檔時,舊課程的列留著,腳本檔還找得到它們的課程。
func deleteRetiredCourses(tx *gorm.DB, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	for _, t := range []any{&lessonFileRow{}, &lessonRow{}, &unitRow{}, &courseRow{}} {
		col := "course_id IN ?"
		if _, ok := t.(*courseRow); ok {
			col = "id IN ?"
		}
		if err := tx.Delete(t, col, ids).Error; err != nil {
			return err
		}
	}
	return nil
}

// SeedCourses 把 courses_seed.json 的課程、單元與課寫進資料庫:沒有的新增,已經有的用種子的內容更新。
// 現階段以種子為準,資料庫只是讀取用的複本;種子沒寫到的列(例如 CLI 另外加的)不會被刪,也不會被改。
// 等課程架構穩定,才改成以資料庫為準、由管理員用 evoleap CLI 修改(見 coursesadmin.go),到時這裡要改回只補新的。
func (s *Store) SeedCourses(ctx context.Context) error {
	return s.seedCoursesJSON(ctx, courseSeed, topicSeed)
}

// seedCoursesJSON 是 SeedCourses 的實作,種子內容由參數給(測試可以給自訂的);主題在同一個交易裡先寫入,課程指向不存在的主題就整批失敗。
func (s *Store) seedCoursesJSON(ctx context.Context, courses, topics []byte) error {
	var seeds []courseSeedRow
	if err := json.Unmarshal(courses, &seeds); err != nil {
		return fmt.Errorf("parse course seed: %w", err)
	}
	topicSeeds, err := parseTopicSeed(topics)
	if err != nil {
		return err
	}
	known := map[string]bool{}
	for _, t := range topicSeeds {
		known[t.ID] = true
	}
	for _, c := range seeds {
		if !known[c.Topic] {
			return fmt.Errorf("course seed %s: unknown topic %q", c.ID, c.Topic)
		}
	}
	at := now()
	rows := make([]courseRow, len(seeds))
	for i, c := range seeds {
		rows[i] = courseRow{ID: c.ID, Title: c.Title, Access: c.Access, Tier: c.Tier, Topic: c.Topic, CreatedAt: at, UpdatedAt: at}
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := upsertTopics(tx, topicSeeds); err != nil {
			return err
		}
		err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"title", "access", "tier", "topic_id", "updated_at"}),
		}).Create(&rows).Error
		if err != nil {
			return err
		}
		for _, c := range seeds {
			if c.Units == nil {
				continue
			}
			if err := upsertUnits(tx, c.ID, c.Units); err != nil {
				return fmt.Errorf("sync units of %s: %w", c.ID, err)
			}
		}
		// 舊課程要等 SyncLessonFiles 把腳本檔改掛到新課程之後才清(見 lessonfiles.go)
		return nil
	})
}
