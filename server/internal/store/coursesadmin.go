package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 管理員改課程資料(evoleap CLI 經 /api/admin/courses/*、/api/admin/scripts/*):正式環境的課程資料以資料庫為準,
// 種子(courses_seed.json)只補資料庫還沒有的課程、單元、課與腳本檔(見 SeedCourses、SyncLessonFiles)。
// 每次修改都記一筆 course_changes:誰、什麼時候、改了什麼。

// courseChangeRow 是一筆課程資料的修改紀錄。
type courseChangeRow struct {
	ID        uint      `gorm:"primaryKey"`
	At        time.Time `gorm:"not null;index"`
	UserEmail string    `gorm:"size:320;not null"`
	// Action 例如 lesson.update、script.put
	Action string `gorm:"size:32;not null"`
	// Target 例如 tools 0.1、l0/0.0-tools.json
	Target string `gorm:"size:200;not null"`
	// Detail 是改了什麼(JSON)
	Detail string `gorm:"type:text;not null"`
}

func (courseChangeRow) TableName() string { return "course_changes" }

// CourseChange 是給 API 回傳的修改紀錄。
type CourseChange struct {
	At     time.Time       `json:"at"`
	User   string          `json:"user"`
	Action string          `json:"action"`
	Target string          `json:"target"`
	Detail json.RawMessage `json:"detail"`
}

// ErrInvalidCourseData 是修改內容不合規則(狀態、存取方式、時間、腳本格式…)時回傳的錯誤,訊息寫明原因。
var ErrInvalidCourseData = errors.New("課程資料不合規則")

func invalid(format string, args ...any) error {
	return fmt.Errorf("%w:%s", ErrInvalidCourseData, fmt.Sprintf(format, args...))
}

func (s *Store) recordChange(tx *gorm.DB, user, action, target string, detail any) error {
	b, err := json.Marshal(detail)
	if err != nil {
		return err
	}
	return tx.Create(&courseChangeRow{At: now(), UserEmail: user, Action: action, Target: target, Detail: string(b)}).Error
}

// CourseChanges 回傳最近的修改紀錄(新的在前)。
func (s *Store) CourseChanges(ctx context.Context, limit int) ([]CourseChange, error) {
	var rows []courseChangeRow
	if err := s.db.WithContext(ctx).Order("id DESC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]CourseChange, len(rows))
	for i, r := range rows {
		out[i] = CourseChange{At: r.At, User: r.UserEmail, Action: r.Action, Target: r.Target, Detail: json.RawMessage(r.Detail)}
	}
	return out, nil
}

// CourseSummary 是課程清單的一列:存取方式與各狀態的課數。
type CourseSummary struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Access  string `json:"access"`
	Tier    string `json:"tier,omitempty"`
	Open    int    `json:"open"`
	Draft   int    `json:"draft"`
	Planned int    `json:"planned"`
}

// AdminCourses 回傳所有課程與各狀態的課數(依建立順序)。
func (s *Store) AdminCourses(ctx context.Context) ([]CourseSummary, error) {
	var out []CourseSummary
	err := s.db.WithContext(ctx).Raw(`SELECT c.id, c.title, c.access, c.tier,
		COUNT(CASE WHEN l.status = 'open' THEN 1 END) AS open,
		COUNT(CASE WHEN l.status = 'draft' THEN 1 END) AS draft,
		COUNT(CASE WHEN l.status = 'planned' THEN 1 END) AS planned
		FROM courses c LEFT JOIN lessons l ON l.course_id = c.id
		GROUP BY c.id, c.title, c.access, c.tier, c.created_at ORDER BY c.created_at, c.id`).Scan(&out).Error
	return out, err
}

// LessonPatch 是要改的欄位;nil 代表不改。Access 給空字串代表照這門課的。
type LessonPatch struct {
	Status  *string `json:"status,omitempty"`
	Access  *string `json:"access,omitempty"`
	Minutes *int    `json:"minutes,omitempty"`
	Title   *string `json:"title,omitempty"`
	Summary *string `json:"summary,omitempty"`
	Script  *string `json:"script,omitempty"`
}

// UpdateLesson 改一課的欄位並記一筆修改紀錄;改完的課照 lessons.go 的規則檢查(狀態、存取方式、規劃中的課不能有腳本)。
func (s *Store) UpdateLesson(ctx context.Context, user, courseID, lessonID string, p LessonPatch) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var l lessonRow
		err := tx.First(&l, "course_id = ? AND id = ?", courseID, lessonID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		set := func(dst *string, v *string) {
			if v != nil {
				*dst = strings.TrimSpace(*v)
			}
		}
		set(&l.Status, p.Status)
		set(&l.Access, p.Access)
		set(&l.Title, p.Title)
		set(&l.Summary, p.Summary)
		set(&l.Script, p.Script)
		if p.Minutes != nil {
			l.Minutes = *p.Minutes
		}
		if err := validateLesson(l.Status, l.Access, l.Script != ""); err != nil {
			return invalid("%s", err)
		}
		// 腳本要已經上傳、而且屬於這一課(evoleap script push -course -lesson),否則課程頁會載不到,或照別一課的權限把關
		if p.Script != nil && l.Script != "" {
			var f lessonFileRow
			err := tx.First(&f, "path = ?", l.Script).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return invalid("找不到腳本 %s,請先用 evoleap script push 上傳", l.Script)
			}
			if err != nil {
				return err
			}
			if f.CourseID != courseID || f.LessonID != lessonID {
				return invalid("%s 屬於課程 %s 的 %s,不是這一課的", l.Script, f.CourseID, f.LessonID)
			}
		}
		if l.Minutes < 0 {
			return invalid("minutes 不能是負的")
		}
		if l.Title == "" {
			return invalid("title 不能是空的")
		}
		if err := tx.Model(&lessonRow{}).Where("course_id = ? AND id = ?", courseID, lessonID).
			Select("status", "access", "minutes", "title", "summary", "script").Updates(&l).Error; err != nil {
			return err
		}
		return s.recordChange(tx, user, "lesson.update", courseID+" "+lessonID, p)
	})
}

// PutScript 寫入一個腳本檔(新增或取代內容)並記一筆修改紀錄。
// 給 courseID、lessonID 時掛在那一課底下(那一課要存在;同一個檔不能屬於別的課);
// 沒給時:已經是某一課的檔就只換內容,否則當成研發基地的檔。內容必須是 JSON。
func (s *Store) PutScript(ctx context.Context, user, path, courseID, lessonID string, content []byte) error {
	if !strings.HasSuffix(path, ".json") || strings.Contains(path, "..") || strings.HasPrefix(path, "/") {
		return invalid("path 要是 web/src/content/live/ 底下的相對路徑,以 .json 結尾")
	}
	if !json.Valid(content) {
		return invalid("內容不是有效的 JSON")
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var owned lessonFileRow
		err := tx.First(&owned, "path = ?", path).Error
		exists := err == nil
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		switch {
		case courseID != "" || lessonID != "":
			var l lessonRow
			if err := tx.First(&l, "course_id = ? AND id = ?", courseID, lessonID).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return invalid("找不到課程 %s 的 %s", courseID, lessonID)
				}
				return err
			}
			if err := validateLesson(l.Status, l.Access, true); err != nil {
				return invalid("課程 %s 的 %s:%s", courseID, lessonID, err)
			}
			if exists && (owned.CourseID != courseID || owned.LessonID != lessonID) {
				return invalid("%s 已經屬於課程 %s 的 %s,一個檔只能屬於一課", path, owned.CourseID, owned.LessonID)
			}
			row := lessonFileRow{Path: path, CourseID: courseID, LessonID: lessonID, Content: string(content)}
			if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "path"}}, DoUpdates: clause.AssignmentColumns([]string{"content"})}).Create(&row).Error; err != nil {
				return err
			}
			// 從研發基地搬到某一課底下的檔,研發基地那份就不要了
			if err := tx.Where("path = ?", path).Delete(&studioFileRow{}).Error; err != nil {
				return err
			}
		case exists:
			if err := tx.Model(&lessonFileRow{}).Where("path = ?", path).Update("content", string(content)).Error; err != nil {
				return err
			}
		default:
			row := studioFileRow{Path: path, Content: string(content)}
			if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "path"}}, DoUpdates: clause.AssignmentColumns([]string{"content"})}).Create(&row).Error; err != nil {
				return err
			}
		}
		return s.recordChange(tx, user, "script.put", path, map[string]any{"course": courseID, "lesson": lessonID, "bytes": len(content)})
	})
}
