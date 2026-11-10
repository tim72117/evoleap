package store

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 兒童的播放進度與上課紀錄,每個孩子分開(兒童模式時,進度 API 依兒童模式的 cookie 讀寫這裡,見 api/progress.go):
//   child_progress:每個孩子每一課一列,播到哪裡(和會員的 progress 同樣的欄位)
//   child_lessons :上課紀錄,孩子每看完一課記一筆(重看一遍再看完會再記一筆),家長課表照它排「已上完」

// FinishTailMs 是播到最後幾毫秒內就算看完(和前端 member/memberCourses.ts 的 FINISH_TAIL_MS 相同)
const FinishTailMs = 5000

func finished(positionMs, durationMs int) bool {
	return durationMs > 0 && durationMs-positionMs <= FinishTailMs
}

type childProgressRow struct {
	ChildID    string `gorm:"primaryKey;size:32"`
	Lesson     string `gorm:"primaryKey;size:200"`
	PositionMs int    `gorm:"not null"`
	DurationMs int    `gorm:"not null"`
	UpdatedAt  time.Time
}

func (childProgressRow) TableName() string { return "child_progress" }

func (r childProgressRow) toProgress() Progress {
	return Progress{Lesson: r.Lesson, PositionMs: r.PositionMs, DurationMs: r.DurationMs, UpdatedAt: r.UpdatedAt}
}

type childLessonRow struct {
	ID         string    `gorm:"primaryKey;size:32"`
	ChildID    string    `gorm:"size:32;not null;index"`
	Lesson     string    `gorm:"size:200;not null"`
	FinishedAt time.Time `gorm:"not null;index"`
}

func (childLessonRow) TableName() string { return "child_lessons" }

// ChildLesson 是一筆上課紀錄:哪一課、什麼時候看完。
type ChildLesson struct {
	Lesson     string    `json:"lesson"`
	FinishedAt time.Time `json:"finishedAt"`
}

// SaveChildProgress 寫入孩子在某一課的進度;這一次從「沒看完」變成「看完」時,另外記一筆上課紀錄(回傳 logged)。
func (s *Store) SaveChildProgress(ctx context.Context, childID string, p Progress) (logged bool, err error) {
	at := now()
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 先鎖住這個孩子(children 那一列):同一個孩子同時送來兩次進度時一次一個,「看完」只記一筆
		var lock childRow
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").First(&lock, "id = ?", childID).Error; err != nil {
			return notFound(err)
		}
		var prev childProgressRow
		err := tx.First(&prev, "child_id = ? AND lesson = ?", childID, p.Lesson).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		wasFinished := err == nil && finished(prev.PositionMs, prev.DurationMs)
		row := childProgressRow{ChildID: childID, Lesson: p.Lesson, PositionMs: p.PositionMs, DurationMs: p.DurationMs, UpdatedAt: at}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "child_id"}, {Name: "lesson"}},
			DoUpdates: clause.AssignmentColumns([]string{"position_ms", "duration_ms", "updated_at"}),
		}).Create(&row).Error; err != nil {
			return err
		}
		if finished(p.PositionMs, p.DurationMs) && !wasFinished {
			logged = true
			return tx.Create(&childLessonRow{ID: newID(), ChildID: childID, Lesson: p.Lesson, FinishedAt: at}).Error
		}
		return nil
	})
	return logged, err
}

// KidsLessonOpen 回傳孩子現在能不能上這一課(兒童模式的鎖頭,前端 kidsMode/progress.ts 同一套規則):
// 看完的課可以重看;沒看完的只有「接下來那一課」,也就是已開放的課裡照順序第一個還沒看完的。進度的課號是「課程:腳本」(例如 kids:kids/0.1.json)。
func (s *Store) KidsLessonOpen(ctx context.Context, childID, courseID, lessonID string) (bool, error) {
	db := s.db.WithContext(ctx)
	var lessons []lessonRow
	if err := db.Where("course_id = ?", courseID).Order("position").Find(&lessons).Error; err != nil {
		return false, err
	}
	var rows []childProgressRow
	if err := db.Where("child_id = ?", childID).Find(&rows).Error; err != nil {
		return false, err
	}
	done := map[string]bool{}
	for _, r := range rows {
		if finished(r.PositionMs, r.DurationMs) {
			done[r.Lesson] = true
		}
	}
	next := ""
	for _, l := range lessons {
		if l.Script == "" {
			continue
		}
		fin := done[courseID+":"+l.Script]
		if l.ID == lessonID && fin {
			return true, nil
		}
		if next == "" && !fin && l.Status == LessonOpen {
			next = l.ID
		}
	}
	return next != "" && next == lessonID, nil
}

// ChildProgressOf 回傳孩子在某一課的進度;沒有紀錄時回 ErrNotFound。
func (s *Store) ChildProgressOf(ctx context.Context, childID, lesson string) (Progress, error) {
	var r childProgressRow
	if err := s.db.WithContext(ctx).First(&r, "child_id = ? AND lesson = ?", childID, lesson).Error; err != nil {
		return Progress{}, notFound(err)
	}
	return r.toProgress(), nil
}

// ChildProgressList 回傳孩子所有課的進度,最近看的在前。
func (s *Store) ChildProgressList(ctx context.Context, childID string) ([]Progress, error) {
	var rows []childProgressRow
	if err := s.db.WithContext(ctx).Where("child_id = ?", childID).Order("updated_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Progress, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.toProgress())
	}
	return out, nil
}

// ChildLessons 回傳孩子的上課紀錄,依看完的時間排(早的在前)。
func (s *Store) ChildLessons(ctx context.Context, childID string) ([]ChildLesson, error) {
	var rows []childLessonRow
	if err := s.db.WithContext(ctx).Where("child_id = ?", childID).Order("finished_at, id").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]ChildLesson, 0, len(rows))
	for _, r := range rows {
		out = append(out, ChildLesson{Lesson: r.Lesson, FinishedAt: r.FinishedAt})
	}
	return out, nil
}

// deleteChildRecords 刪掉孩子的進度與上課紀錄(刪孩子時一起刪)。
func deleteChildRecords(tx *gorm.DB, childID string) error {
	if err := tx.Where("child_id = ?", childID).Delete(&childProgressRow{}).Error; err != nil {
		return err
	}
	return tx.Where("child_id = ?", childID).Delete(&childLessonRow{}).Error
}
