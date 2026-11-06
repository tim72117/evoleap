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

// courseRow 記錄每門課的存取方式,Access 為 subscription 代表要訂閱才能看,api 依它判斷權限。
// 存取方式的唯一來源是 courses_seed.json,啟動時同步進這張表,前端 content/levels.ts 也讀同一份。
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

// CourseAccess 回傳課程的存取方式,以及訂閱課程需要的最低方案(其他課程是空字串)。
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
}

//go:embed courses_seed.json
var courseSeed []byte

// SeedCourses 把 courses_seed.json 同步進資料表:新增還不存在的課程,更新已存在課程的名稱與存取方式。
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
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "access", "tier", "updated_at"}),
	}).Create(&rows).Error
}
