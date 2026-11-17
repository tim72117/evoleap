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
	// Units 是這門課的單元與每一堂課(見 lessons.go);沒寫(不是空陣列)就不動這門課的單元、課與腳本檔
	Units []unitSeed `json:"units,omitempty"`
}

//go:embed courses_seed.json
var courseSeed []byte

// SeedCourses 把 courses_seed.json 的課程、單元與課寫進資料庫(課程結構以種子為準):
// 沒有的新增;已經有的用種子的內容更新(課程的 title、access、tier,單元與每一課的各欄位,見 upsertUnits);
// 種子裡的課程,資料庫有、種子已經沒有的單元與課會被刪除。種子沒有的課程整門不動(不刪、不改)。
// 管理員用 evoleap CLI 改的課程資料(見 coursesadmin.go)下次同步會被蓋回種子的內容,要長期保留得同時改種子。
func (s *Store) SeedCourses(ctx context.Context) error {
	seeds, err := parseCourseSeed(courseSeed)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error { return seedCourses(tx, seeds) })
}

func parseCourseSeed(seed []byte) ([]courseSeedRow, error) {
	var seeds []courseSeedRow
	if err := json.Unmarshal(seed, &seeds); err != nil {
		return nil, fmt.Errorf("parse course seed: %w", err)
	}
	return seeds, nil
}

// seedCourses 是 SeedCourses 的實作,在呼叫端的交易裡執行(SyncCourses 和腳本檔的同步放在同一個交易)。
func seedCourses(tx *gorm.DB, seeds []courseSeedRow) error {
	if len(seeds) == 0 {
		return nil
	}
	at := now()
	rows := make([]courseRow, len(seeds))
	for i, c := range seeds {
		rows[i] = courseRow{ID: c.ID, Title: c.Title, Access: c.Access, Tier: c.Tier, CreatedAt: at, UpdatedAt: at}
	}
	err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "access", "tier", "updated_at"}),
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
	return nil
}
