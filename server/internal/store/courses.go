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
	Tier      string `gorm:"size:32"`
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
	// Units 是這門課的單元與每一堂課(見 lessons.go);沒寫就不動這門課的單元與課
	Units []unitSeed `json:"units,omitempty"`
}

//go:embed courses_seed.json
var courseSeed []byte

// SeedCourses 把 courses_seed.json 裡資料庫還沒有的課程、單元與課新增進去,已經有的不動:
// 課程資料以資料庫為準,上線後由管理員用 evoleap CLI 修改(見 coursesadmin.go),種子只負責第一次建立與新加的課。
func (s *Store) SeedCourses(ctx context.Context) error {
	var seeds []courseSeedRow
	if err := json.Unmarshal(courseSeed, &seeds); err != nil {
		return fmt.Errorf("parse course seed: %w", err)
	}
	at := now()
	rows := make([]courseRow, len(seeds))
	for i, c := range seeds {
		rows[i] = courseRow{ID: c.ID, Title: c.Title, Access: c.Access, Tier: c.Tier, CreatedAt: at, UpdatedAt: at}
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error; err != nil {
			return err
		}
		for _, c := range seeds {
			if c.Units == nil {
				continue
			}
			if err := insertMissingUnits(tx, c.ID, c.Units); err != nil {
				return fmt.Errorf("sync units of %s: %w", c.ID, err)
			}
		}
		return nil
	})
}
