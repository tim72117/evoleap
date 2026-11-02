package store

import (
	"context"
	"time"

	"gorm.io/gorm/clause"
)

// Progress 是一位使用者在一課的播放進度(只有登入的會員才會儲存)。
type Progress struct {
	Lesson     string    `json:"lesson"`
	PositionMs int       `json:"positionMs"`
	DurationMs int       `json:"durationMs"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type progressRow struct {
	UserID     string `gorm:"primaryKey;size:32"`
	Lesson     string `gorm:"primaryKey;size:200"`
	PositionMs int    `gorm:"not null"`
	DurationMs int    `gorm:"not null"`
	UpdatedAt  time.Time
}

func (progressRow) TableName() string { return "progress" }

func (r progressRow) toProgress() Progress {
	return Progress{Lesson: r.Lesson, PositionMs: r.PositionMs, DurationMs: r.DurationMs, UpdatedAt: r.UpdatedAt}
}

// SaveProgress 寫入(或覆蓋)使用者在某一課的進度。
func (s *Store) SaveProgress(ctx context.Context, userID string, p Progress) error {
	row := progressRow{UserID: userID, Lesson: p.Lesson, PositionMs: p.PositionMs, DurationMs: p.DurationMs, UpdatedAt: now()}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "lesson"}},
		DoUpdates: clause.AssignmentColumns([]string{"position_ms", "duration_ms", "updated_at"}),
	}).Create(&row).Error
}

// ProgressOf 回傳使用者在某一課的進度;沒有紀錄時回 ErrNotFound。
func (s *Store) ProgressOf(ctx context.Context, userID, lesson string) (Progress, error) {
	var r progressRow
	if err := s.db.WithContext(ctx).First(&r, "user_id = ? AND lesson = ?", userID, lesson).Error; err != nil {
		return Progress{}, notFound(err)
	}
	return r.toProgress(), nil
}

// ProgressList 回傳使用者所有課的進度,最近看的在前。
func (s *Store) ProgressList(ctx context.Context, userID string) ([]Progress, error) {
	var rows []progressRow
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("updated_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Progress, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.toProgress())
	}
	return out, nil
}
