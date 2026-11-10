package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 一門課(courses)底下分單元(course_units),單元底下是一堂一堂的課(lessons)。
// 現階段以 courses_seed.json 為準:同步時(正式環境是部署時的同步工作 cmd/sync,本機是後端啟動時)新增沒有的單元與課,
// 已經有的用種子的內容更新,種子拿掉的不會從資料庫刪除。等課程架構穩定,才改成以資料庫為準(管理員用 evoleap CLI 修改)。
// 一堂課的存取方式(access)空的就照這門課,只有例外才填(例如第一課免費預覽)。
// 狀態 draft(草稿)是公開與否的閘口:只有管理員看得到它是草稿、拿得到腳本路徑,其他人看到的是規劃中。

type unitRow struct {
	CourseID string `gorm:"primaryKey;size:64"`
	ID       string `gorm:"primaryKey;size:32"`
	Title    string `gorm:"size:200;not null"`
	// Subtitle 是課程地圖上單元標題下的小字(兒童課是解釋概念的比喻,網頁怎麼運作是這個單元回答的問題)
	Subtitle string `gorm:"size:500"`
	Position int    `gorm:"not null"`
	// Access、Tier:這個單元底下的課預設的存取方式與最低方案;空字串代表照這門課的。
	// 一門課的單元可以有不同的存取方式(例如「做出自己的軟體」的起步、零基礎、基礎三個階段),
	// 一課自己的 access 優先於單元的,單元優先於課程的(見 effectiveAccess)。
	Access string `gorm:"size:16"`
	Tier   string `gorm:"size:32"`
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
	// Status:open(已開放,可以上)、draft(草稿,只有管理員能上)、planned(規劃中)
	Status string `gorm:"size:16;not null"`
	// Script 是這一課課程頁要播的舞台腳本(web/src/content/live/ 底下的路徑,例如 launch/0.1.json);檔案內容在 lesson_files(見 lessonfiles.go)。
	// 沒有課程頁的課是空的
	Script string `gorm:"size:200"`
	// Minutes 是預估的學習時間(分鐘,含影片與跟做);0 代表還沒估
	Minutes int `gorm:"not null;default:0"`
}

func (lessonRow) TableName() string { return "lessons" }

// 一堂課的狀態。
const (
	LessonOpen    = "open"
	LessonDraft   = "draft"
	LessonPlanned = "planned"
)

// unitSeed、lessonSeed 是 courses_seed.json 裡一門課的 units。
type unitSeed struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	// Access、Tier 是這個單元底下的課預設的存取方式與最低方案(見 unitRow);沒寫就照這門課的
	Access  string       `json:"access,omitempty"`
	Tier    string       `json:"tier,omitempty"`
	Lessons []lessonSeed `json:"lessons"`
}

type lessonSeed struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Summary string `json:"summary"`
	Access  string `json:"access,omitempty"`
	Status  string `json:"status"`
	Script  string `json:"script,omitempty"`
	// Files 是 script 以外這一課要用的腳本檔(子腳本、開場、試做),和 script 一起讀進 lesson_files(見 lessonfiles.go)
	Files   []string `json:"files,omitempty"`
	Minutes int      `json:"minutes,omitempty"`
}

// validateLesson 檢查一課的狀態、存取方式,以及「規劃中的課不能有腳本」;種子(unitRows)與 CLI(UpdateLesson、PutScript)共用。
func validateLesson(status, access string, hasScript bool) error {
	switch status {
	case LessonOpen, LessonDraft:
	case LessonPlanned:
		if hasScript {
			return errors.New("規劃中的課不能有腳本(script 或 files),要先改成草稿(draft)")
		}
	default:
		return errors.New("status 要是 open、draft 或 planned")
	}
	return validateAccess(access)
}

// validateAccess 檢查存取方式;空字串代表照上一層的(課照單元、單元照課程)。
func validateAccess(access string) error {
	switch Access(access) {
	case "", AccessFree, AccessLoginFree, AccessSubscription:
		return nil
	}
	return fmt.Errorf("不認得的 access %q(要是 free、login-free、subscription,或空字串照上一層)", access)
}

// unitRows 把種子的單元與課轉成資料列,並檢查狀態、存取方式與「規劃中的課不能有腳本」。
func unitRows(courseID string, units []unitSeed) ([]unitRow, []lessonRow, error) {
	var us []unitRow
	var ls []lessonRow
	for i, u := range units {
		if err := validateAccess(u.Access); err != nil {
			return nil, nil, fmt.Errorf("課程 %s 的單元 %s:%s", courseID, u.ID, err)
		}
		us = append(us, unitRow{CourseID: courseID, ID: u.ID, Title: u.Title, Subtitle: u.Subtitle, Position: i, Access: u.Access, Tier: u.Tier})
		for _, l := range u.Lessons {
			if err := validateLesson(l.Status, l.Access, l.Script != "" || len(l.Files) > 0); err != nil {
				return nil, nil, fmt.Errorf("課程 %s 的 %s:%s", courseID, l.ID, err)
			}
			ls = append(ls, lessonRow{CourseID: courseID, ID: l.ID, UnitID: u.ID, Title: l.Title, Summary: l.Summary, Position: len(ls), Access: l.Access, Status: l.Status, Script: l.Script, Minutes: l.Minutes})
		}
	}
	return us, ls, nil
}

// syncUnits 把一門課的單元與課整份換成給定的內容(ReplaceUnitsJSON 用,測試準備資料)。
func syncUnits(tx *gorm.DB, courseID string, units []unitSeed) error {
	us, ls, err := unitRows(courseID, units)
	if err != nil {
		return err
	}
	if err := tx.Delete(&lessonRow{}, "course_id = ?", courseID).Error; err != nil {
		return err
	}
	if err := tx.Delete(&unitRow{}, "course_id = ?", courseID).Error; err != nil {
		return err
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

// upsertUnits 把種子的單元與課寫進資料庫:沒有的新增,已經有的全部欄位用種子的內容更新(現階段以種子為準,見 SeedCourses)。
// 種子中間插入新課或把課搬到別的單元時,順序(position)與所屬單元(unit_id)也一併更新,才不會撞號、放錯單元。
func upsertUnits(tx *gorm.DB, courseID string, units []unitSeed) error {
	us, ls, err := unitRows(courseID, units)
	if err != nil {
		return err
	}
	key := []clause.Column{{Name: "course_id"}, {Name: "id"}}
	if len(us) > 0 {
		if err := tx.Clauses(clause.OnConflict{Columns: key, DoUpdates: clause.AssignmentColumns([]string{"title", "subtitle", "position", "access", "tier"})}).Create(&us).Error; err != nil {
			return err
		}
	}
	if len(ls) > 0 {
		return tx.Clauses(clause.OnConflict{Columns: key, DoUpdates: clause.AssignmentColumns([]string{"unit_id", "title", "summary", "position", "access", "status", "script", "minutes"})}).Create(&ls).Error
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
	// hasDrafts:這門課有沒有草稿的課(不論看的人能不能看到)
	hasDrafts bool
}

type MapUnit struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	// Access、Tier 是這個單元的存取方式與最低方案(已套用這門課的預設)
	Access  Access      `json:"access"`
	Tier    string      `json:"tier,omitempty"`
	Lessons []MapLesson `json:"lessons"`
}

type MapLesson struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Summary string `json:"summary"`
	// Access 是這一堂實際的存取方式(沒有例外時就是這門課的)
	Access Access `json:"access"`
	Status string `json:"status"`
	// Script 是課程頁要播的腳本;只有看得到這一課的人才有(草稿只給管理員)
	Script string `json:"script,omitempty"`
	// Minutes 是預估的學習時間(分鐘);還沒估的課沒有這個欄位
	Minutes int `json:"minutes,omitempty"`
}

// CourseMapOf 回傳一門課的課程地圖;課程不存在時回 ErrCourseNotFound。
// drafts 為 false 時(不是管理員),草稿的課當成規劃中:狀態改成 planned、不給腳本路徑。
func (s *Store) CourseMapOf(ctx context.Context, id string, drafts bool) (CourseMap, error) {
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
		tier := u.Tier
		if tier == "" {
			tier = c.Tier
		}
		m.Units = append(m.Units, MapUnit{ID: u.ID, Title: u.Title, Subtitle: u.Subtitle, Access: effectiveAccess(u.Access, c.Access), Tier: tier, Lessons: []MapLesson{}})
	}
	for _, l := range lessons {
		i, ok := index[l.UnitID]
		if !ok {
			continue
		}
		access := effectiveAccess(l.Access, string(m.Units[i].Access))
		status, script := l.Status, l.Script
		if status == LessonDraft {
			m.hasDrafts = true
		}
		if status == LessonDraft && !drafts {
			status, script = LessonPlanned, ""
		}
		m.Units[i].Lessons = append(m.Units[i].Lessons, MapLesson{ID: l.ID, Title: l.Title, Summary: l.Summary, Access: access, Status: status, Script: script, Minutes: l.Minutes})
	}
	return m, nil
}

// HasDrafts 回報這門課有沒有草稿的課,不論看的人能不能看到(有的話,回應會依看的人不同,不能共用快取)。
func (m CourseMap) HasDrafts() bool { return m.hasDrafts }

// ReplaceUnitsJSON 把一門課的單元與課換成給定的 JSON(格式同 courses_seed.json 的 units);給測試準備資料用,測試不該依賴種子目前的內容。
func (s *Store) ReplaceUnitsJSON(courseID, units string) error {
	var us []unitSeed
	if err := json.Unmarshal([]byte(units), &us); err != nil {
		return err
	}
	return s.db.Transaction(func(tx *gorm.DB) error { return syncUnits(tx, courseID, us) })
}
