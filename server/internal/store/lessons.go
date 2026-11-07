package store

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// 一門課(courses)底下分單元(course_units),單元底下是一堂一堂的課(lessons)。
// 和 courses 一樣以 courses_seed.json 為準:啟動時整份同步(這門課底下的單元與課先刪再建,種子拿掉的就跟著消失)。
// 一堂課的存取方式(access)空的就照這門課,只有例外才填(例如第一課免費預覽)。

type unitRow struct {
	CourseID string `gorm:"primaryKey;size:64"`
	ID       string `gorm:"primaryKey;size:32"`
	Title    string `gorm:"size:200;not null"`
	// Metaphor 是這個單元用來解釋概念的比喻(課程地圖上的小字)
	Metaphor string `gorm:"size:500"`
	Position int    `gorm:"not null"`
}

func (unitRow) TableName() string { return "course_units" }

type lessonRow struct {
	CourseID string `gorm:"primaryKey;size:64"`
	ID       string `gorm:"primaryKey;size:32"`
	UnitID   string `gorm:"size:32;not null"`
	Title    string `gorm:"size:200;not null"`
	// Summary 是這一堂學會什麼(課程地圖上的一句話)
	Summary  string `gorm:"size:500"`
	Position int    `gorm:"not null"`
	// Access 空字串代表照這門課的存取方式
	Access string `gorm:"size:16"`
	// Status:open(已開放,可以上)、planned(規劃中)
	Status string `gorm:"size:16;not null"`
}

func (lessonRow) TableName() string { return "lessons" }

// 一堂課的狀態。
const (
	LessonOpen    = "open"
	LessonPlanned = "planned"
)

// unitSeed、lessonSeed 是 courses_seed.json 裡一門課的 units。
type unitSeed struct {
	ID       string       `json:"id"`
	Title    string       `json:"title"`
	Metaphor string       `json:"metaphor"`
	Lessons  []lessonSeed `json:"lessons"`
}

type lessonSeed struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Summary string `json:"summary"`
	Access  string `json:"access,omitempty"`
	Status  string `json:"status"`
}

// syncUnits 把一門課的單元與課整份換成種子的內容。
func syncUnits(tx *gorm.DB, courseID string, units []unitSeed) error {
	if err := tx.Delete(&lessonRow{}, "course_id = ?", courseID).Error; err != nil {
		return err
	}
	if err := tx.Delete(&unitRow{}, "course_id = ?", courseID).Error; err != nil {
		return err
	}
	var us []unitRow
	var ls []lessonRow
	for i, u := range units {
		us = append(us, unitRow{CourseID: courseID, ID: u.ID, Title: u.Title, Metaphor: u.Metaphor, Position: i})
		for _, l := range u.Lessons {
			if l.Status != LessonOpen && l.Status != LessonPlanned {
				return fmt.Errorf("課程 %s 的 %s:status 要是 open 或 planned", courseID, l.ID)
			}
			switch Access(l.Access) {
			case "", AccessFree, AccessLoginFree, AccessSubscription:
			default:
				return fmt.Errorf("課程 %s 的 %s:不認得的 access %q", courseID, l.ID, l.Access)
			}
			ls = append(ls, lessonRow{CourseID: courseID, ID: l.ID, UnitID: u.ID, Title: l.Title, Summary: l.Summary, Position: len(ls), Access: l.Access, Status: l.Status})
		}
	}
	if len(us) > 0 {
		if err := tx.Create(&us).Error; err != nil {
			return err
		}
	}
	if len(ls) > 0 {
		return tx.Create(&ls).Error
	}
	return nil
}

// CourseMap 是一門課的課程地圖:課程、單元與每一堂課(依順序)。
type CourseMap struct {
	ID     string    `json:"id"`
	Title  string    `json:"title"`
	Access Access    `json:"access"`
	Tier   string    `json:"tier,omitempty"`
	Units  []MapUnit `json:"units"`
}

type MapUnit struct {
	ID       string      `json:"id"`
	Title    string      `json:"title"`
	Metaphor string      `json:"metaphor"`
	Lessons  []MapLesson `json:"lessons"`
}

type MapLesson struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Summary string `json:"summary"`
	// Access 是這一堂實際的存取方式(沒有例外時就是這門課的)
	Access Access `json:"access"`
	Status string `json:"status"`
}

// CourseMapOf 回傳一門課的課程地圖;課程不存在時回 ErrCourseNotFound。
func (s *Store) CourseMapOf(ctx context.Context, id string) (CourseMap, error) {
	db := s.db.WithContext(ctx)
	var c courseRow
	if err := db.First(&c, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return CourseMap{}, ErrCourseNotFound
		}
		return CourseMap{}, err
	}
	var units []unitRow
	if err := db.Where("course_id = ?", id).Order("position").Find(&units).Error; err != nil {
		return CourseMap{}, err
	}
	var lessons []lessonRow
	if err := db.Where("course_id = ?", id).Order("position").Find(&lessons).Error; err != nil {
		return CourseMap{}, err
	}
	m := CourseMap{ID: c.ID, Title: c.Title, Access: Access(c.Access), Tier: c.Tier, Units: make([]MapUnit, 0, len(units))}
	index := map[string]int{}
	for _, u := range units {
		index[u.ID] = len(m.Units)
		m.Units = append(m.Units, MapUnit{ID: u.ID, Title: u.Title, Metaphor: u.Metaphor, Lessons: []MapLesson{}})
	}
	for _, l := range lessons {
		i, ok := index[l.UnitID]
		if !ok {
			continue
		}
		access := Access(l.Access)
		if access == "" {
			access = m.Access
		}
		m.Units[i].Lessons = append(m.Units[i].Lessons, MapLesson{ID: l.ID, Title: l.Title, Summary: l.Summary, Access: access, Status: l.Status})
	}
	return m, nil
}
