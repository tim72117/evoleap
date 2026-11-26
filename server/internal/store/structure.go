package store

// 課程結構的新增、刪除、排序(evoleap CLI 經 /api/admin/*)。課程結構以資料庫為準,空資料庫手動初始化(見 catalog.go)。
// 每次修改都記一筆 course_changes。刪除只刪結構:掛在底下的腳本檔帶著內容移到研發基地(studio_files),不會遺失。

import (
	"context"
	"errors"
	"regexp"
	"slices"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	courseIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9.-]{0,63}$`)
	itemIDPattern   = regexp.MustCompile(`^[a-z0-9][a-z0-9.-]{0,31}$`)
)

// NewCourse 是要新增的課程;其餘欄位(說明、插圖、簡介影片…)建好後用 UpdateCourse 改。
type NewCourse struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Access  string `json:"access"`
	TopicID string `json:"topicId,omitempty"`
}

// NewUnit 是要新增的單元,排在最後。
type NewUnit struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle,omitempty"`
	Label    string `json:"label,omitempty"`
	Hidden   bool   `json:"hidden,omitempty"`
}

// UnitPatch 是單元要改的欄位;nil 代表不改。
type UnitPatch struct {
	Title    *string `json:"title,omitempty"`
	Subtitle *string `json:"subtitle,omitempty"`
	Label    *string `json:"label,omitempty"`
	Hidden   *bool   `json:"hidden,omitempty"`
}

// NewLesson 是要新增的一課,排在單元最後;status 空的是 planned。
type NewLesson struct {
	ID      string `json:"id"`
	UnitID  string `json:"unitId"`
	Title   string `json:"title"`
	Summary string `json:"summary,omitempty"`
	Access  string `json:"access,omitempty"`
	Status  string `json:"status,omitempty"`
	Minutes int    `json:"minutes,omitempty"`
}

// OutlineUnit 是大綱裡的一個單元:順序即顯示順序。
type OutlineUnit struct {
	ID      string   `json:"id"`
	Lessons []string `json:"lessons"`
}

func (s *Store) structureTx(ctx context.Context, fn func(tx *gorm.DB) error) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := fn(tx); err != nil {
			return err
		}
		return syncI18nSources(tx)
	})
}

// find 回傳這張表裡符合條件的列存不存在。
func exists(tx *gorm.DB, model any, query string, args ...any) (bool, error) {
	var n int64
	err := tx.Model(model).Where(query, args...).Count(&n).Error
	return n > 0, err
}

func requireCourse(tx *gorm.DB, courseID string) error {
	ok, err := exists(tx, &courseRow{}, "id = ?", courseID)
	if err == nil && !ok {
		return ErrCourseNotFound
	}
	return err
}

// CreateCourse 新增一門課,排在最後。
func (s *Store) CreateCourse(ctx context.Context, user string, c NewCourse) error {
	c.Title = strings.TrimSpace(c.Title)
	if !courseIDPattern.MatchString(c.ID) {
		return invalid("課程 id 只能用小寫英數、. 和 -")
	}
	if c.Title == "" {
		return invalid("title 不能是空的")
	}
	if err := checkLengths(c.Title, "", ""); err != nil {
		return err
	}
	switch Access(c.Access) {
	case AccessFree, AccessLoginFree, AccessSubscription:
	default:
		return invalid("不認得的 access %q(課程要是 free、login-free 或 subscription)", c.Access)
	}
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		if ok, err := exists(tx, &courseRow{}, "id = ?", c.ID); err != nil {
			return err
		} else if ok {
			return invalid("課程 %s 已經存在", c.ID)
		}
		if err := validateCourseTopicID(tx, c.TopicID); err != nil {
			return err
		}
		var last int
		if err := tx.Model(&courseRow{}).Select("COALESCE(MAX(position), -1)").Scan(&last).Error; err != nil {
			return err
		}
		at := now()
		if err := tx.Create(&courseRow{ID: c.ID, Title: c.Title, Access: c.Access, TopicID: c.TopicID, Overview: true, Position: last + 1, CreatedAt: at, UpdatedAt: at}).Error; err != nil {
			return err
		}
		return s.recordChange(tx, user, "course.create", c.ID, c)
	})
}

// DeleteCourse 刪掉一門沒有任何單元的課。
func (s *Store) DeleteCourse(ctx context.Context, user, courseID string) error {
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		if err := requireCourse(tx, courseID); err != nil {
			return err
		}
		if ok, err := exists(tx, &unitRow{}, "course_id = ?", courseID); err != nil {
			return err
		} else if ok {
			return invalid("課程 %s 還有單元,要先刪掉單元", courseID)
		}
		if err := moveFilesToStudio(tx, "course_id = ?", courseID); err != nil {
			return err
		}
		if err := tx.Where("id = ?", courseID).Delete(&courseRow{}).Error; err != nil {
			return err
		}
		if err := dropTranslations(tx, user, I18nCourse, courseID); err != nil {
			return err
		}
		return s.recordChange(tx, user, "course.delete", courseID, nil)
	})
}

// OrderCourses 依給定的順序排列課程;要列出全部課程。
func (s *Store) OrderCourses(ctx context.Context, user string, ids []string) error {
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		var have []string
		if err := tx.Model(&courseRow{}).Pluck("id", &have).Error; err != nil {
			return err
		}
		if !sameSet(have, ids) {
			return invalid("順序要剛好列出全部 %d 門課各一次", len(have))
		}
		for i, id := range ids {
			if err := tx.Model(&courseRow{}).Where("id = ?", id).Update("position", i).Error; err != nil {
				return err
			}
		}
		return s.recordChange(tx, user, "course.order", "courses", ids)
	})
}

// CreateUnit 在課程最後新增一個單元。
func (s *Store) CreateUnit(ctx context.Context, user, courseID string, u NewUnit) error {
	u.Title = strings.TrimSpace(u.Title)
	if !itemIDPattern.MatchString(u.ID) {
		return invalid("單元 id 只能用小寫英數、. 和 -(最多 32 字)")
	}
	if u.Title == "" {
		return invalid("title 不能是空的")
	}
	if err := checkLengths(u.Title, u.Subtitle, u.Label); err != nil {
		return err
	}
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		if err := requireCourse(tx, courseID); err != nil {
			return err
		}
		if ok, err := exists(tx, &unitRow{}, "course_id = ? AND id = ?", courseID, u.ID); err != nil {
			return err
		} else if ok {
			return invalid("單元 %s 已經存在", u.ID)
		}
		var last int
		if err := tx.Model(&unitRow{}).Where("course_id = ?", courseID).Select("COALESCE(MAX(position), -1)").Scan(&last).Error; err != nil {
			return err
		}
		if err := tx.Create(&unitRow{CourseID: courseID, ID: u.ID, Title: u.Title, Subtitle: u.Subtitle, Label: u.Label, Hidden: u.Hidden, Position: last + 1}).Error; err != nil {
			return err
		}
		return s.recordChange(tx, user, "unit.create", courseID+" "+u.ID, u)
	})
}

// UpdateUnit 改單元的欄位。
func (s *Store) UpdateUnit(ctx context.Context, user, courseID, unitID string, p UnitPatch) error {
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		var u unitRow
		err := tx.First(&u, "course_id = ? AND id = ?", courseID, unitID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		value := func(v *string) string {
			if v == nil {
				return ""
			}
			return strings.TrimSpace(*v)
		}
		if err := checkLengths(value(p.Title), value(p.Subtitle), value(p.Label)); err != nil {
			return err
		}
		set := func(dst *string, v *string) {
			if v != nil {
				*dst = strings.TrimSpace(*v)
			}
		}
		set(&u.Title, p.Title)
		set(&u.Subtitle, p.Subtitle)
		set(&u.Label, p.Label)
		if p.Hidden != nil {
			u.Hidden = *p.Hidden
		}
		if u.Title == "" {
			return invalid("title 不能是空的")
		}
		if err := tx.Model(&unitRow{}).Where("course_id = ? AND id = ?", courseID, unitID).Select("title", "subtitle", "label", "hidden").Updates(&u).Error; err != nil {
			return err
		}
		return s.recordChange(tx, user, "unit.update", courseID+" "+unitID, p)
	})
}

// DeleteUnit 刪掉一個沒有課的單元。
func (s *Store) DeleteUnit(ctx context.Context, user, courseID, unitID string) error {
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		if ok, err := exists(tx, &unitRow{}, "course_id = ? AND id = ?", courseID, unitID); err != nil {
			return err
		} else if !ok {
			return ErrNotFound
		}
		if ok, err := exists(tx, &lessonRow{}, "course_id = ? AND unit_id = ?", courseID, unitID); err != nil {
			return err
		} else if ok {
			return invalid("單元 %s 還有課,要先刪掉或移走", unitID)
		}
		if err := tx.Where("course_id = ? AND id = ?", courseID, unitID).Delete(&unitRow{}).Error; err != nil {
			return err
		}
		if err := dropTranslations(tx, user, I18nUnit, courseID+"/"+unitID); err != nil {
			return err
		}
		return s.recordChange(tx, user, "unit.delete", courseID+" "+unitID, nil)
	})
}

// CreateLesson 在單元最後新增一課。
func (s *Store) CreateLesson(ctx context.Context, user, courseID string, l NewLesson) error {
	l.Title = strings.TrimSpace(l.Title)
	if l.Status == "" {
		l.Status = LessonPlanned
	}
	if !itemIDPattern.MatchString(l.ID) {
		return invalid("課號只能用小寫英數、. 和 -(最多 32 字)")
	}
	if l.Title == "" {
		return invalid("title 不能是空的")
	}
	if err := checkLengths(l.Title, l.Summary, ""); err != nil {
		return err
	}
	if l.Minutes < 0 {
		return invalid("minutes 不能是負的")
	}
	if err := validateLesson(l.Status, l.Access, false); err != nil {
		return invalid("%s", err)
	}
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		var ids []string
		if err := tx.Model(&lessonRow{}).Where("course_id = ?", courseID).Pluck("id", &ids).Error; err != nil {
			return err
		}
		staged := courseID == stagedCourseID
		for _, id := range ids {
			if id != l.ID && LessonSlug(staged, id) == LessonSlug(staged, l.ID) {
				return invalid("課號 %s 和 %s 的網址相同(%s),換一個課號", l.ID, id, LessonSlug(staged, l.ID))
			}
		}
		if ok, err := exists(tx, &unitRow{}, "course_id = ? AND id = ?", courseID, l.UnitID); err != nil {
			return err
		} else if !ok {
			return invalid("找不到課程 %s 的單元 %s", courseID, l.UnitID)
		}
		if ok, err := exists(tx, &lessonRow{}, "course_id = ? AND id = ?", courseID, l.ID); err != nil {
			return err
		} else if ok {
			return invalid("課號 %s 已經存在", l.ID)
		}
		// 先排到最後,再依單元順序重排,讓它落在所屬單元的最後
		var last int
		if err := tx.Model(&lessonRow{}).Where("course_id = ?", courseID).Select("COALESCE(MAX(position), -1)").Scan(&last).Error; err != nil {
			return err
		}
		if err := tx.Create(&lessonRow{CourseID: courseID, ID: l.ID, UnitID: l.UnitID, Title: l.Title, Summary: l.Summary, Position: last + 1, Access: l.Access, Status: l.Status, Minutes: l.Minutes}).Error; err != nil {
			return err
		}
		if err := renumberLessons(tx, courseID); err != nil {
			return err
		}
		return s.recordChange(tx, user, "lesson.create", courseID+" "+l.ID, l)
	})
}

// DeleteLesson 刪掉一課。開放中的課不能直接刪,要先改成 draft 或 planned。
func (s *Store) DeleteLesson(ctx context.Context, user, courseID, lessonID string) error {
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		var l lessonRow
		err := tx.First(&l, "course_id = ? AND id = ?", courseID, lessonID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if l.Status == LessonOpen {
			return invalid("%s 開放中,要先改成 draft 或 planned 才能刪", lessonID)
		}
		if topic, err := topicStartsAt(tx, courseID, lessonID); err != nil {
			return err
		} else if topic != "" {
			return invalid("主題 %s 的「開始第一課」指向 %s,先用 topic set -content-file 改掉", topic, lessonID)
		}
		if err := moveFilesToStudio(tx, "course_id = ? AND lesson_id = ?", courseID, lessonID); err != nil {
			return err
		}
		if err := tx.Where("course_id = ? AND id = ?", courseID, lessonID).Delete(&lessonRow{}).Error; err != nil {
			return err
		}
		if err := renumberLessons(tx, courseID); err != nil {
			return err
		}
		if err := dropTranslations(tx, user, I18nLesson, courseID+"/"+lessonID); err != nil {
			return err
		}
		return s.recordChange(tx, user, "lesson.delete", courseID+" "+lessonID, l)
	})
}

// SetOutline 重排一門課的單元與課,也可以把課移到別的單元。大綱要剛好列出現有的每個單元與每一課各一次。
func (s *Store) SetOutline(ctx context.Context, user, courseID string, outline []OutlineUnit) error {
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		if err := requireCourse(tx, courseID); err != nil {
			return err
		}
		var units, lessons, newUnits, newLessons []string
		if err := tx.Model(&unitRow{}).Where("course_id = ?", courseID).Pluck("id", &units).Error; err != nil {
			return err
		}
		if err := tx.Model(&lessonRow{}).Where("course_id = ?", courseID).Pluck("id", &lessons).Error; err != nil {
			return err
		}
		for _, u := range outline {
			newUnits = append(newUnits, u.ID)
			newLessons = append(newLessons, u.Lessons...)
		}
		if !sameSet(units, newUnits) || !sameSet(lessons, newLessons) {
			return invalid("大綱要剛好列出現有的 %d 個單元與 %d 堂課各一次(新增、刪除用別的指令)", len(units), len(lessons))
		}
		position := 0
		for i, u := range outline {
			if err := tx.Model(&unitRow{}).Where("course_id = ? AND id = ?", courseID, u.ID).Update("position", i).Error; err != nil {
				return err
			}
			for _, id := range u.Lessons {
				if err := tx.Model(&lessonRow{}).Where("course_id = ? AND id = ?", courseID, id).Updates(map[string]any{"unit_id": u.ID, "position": position}).Error; err != nil {
					return err
				}
				position++
			}
		}
		return s.recordChange(tx, user, "course.outline", courseID, outline)
	})
}

// renumberLessons 依「單元順序、單元內原順序」把課的 position 重編成連續數字。
func renumberLessons(tx *gorm.DB, courseID string) error {
	var ids []string
	err := tx.Raw(`SELECT l.id FROM lessons l JOIN course_units u ON u.course_id = l.course_id AND u.id = l.unit_id
		WHERE l.course_id = ? ORDER BY u.position, l.position, l.id`, courseID).Scan(&ids).Error
	if err != nil {
		return err
	}
	for i, id := range ids {
		if err := tx.Model(&lessonRow{}).Where("course_id = ? AND id = ?", courseID, id).Update("position", i).Error; err != nil {
			return err
		}
	}
	return nil
}

// moveFilesToStudio 把符合條件的課程腳本檔帶著內容移到研發基地(已有同路徑的以課程這份為準)。
func moveFilesToStudio(tx *gorm.DB, query string, args ...any) error {
	var files []lessonFileRow
	if err := tx.Where(query, args...).Find(&files).Error; err != nil || len(files) == 0 {
		return err
	}
	moved := make([]studioFileRow, len(files))
	paths := make([]string, len(files))
	for i, f := range files {
		moved[i] = studioFileRow{Path: f.Path, Content: f.Content}
		paths[i] = f.Path
	}
	if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "path"}}, DoUpdates: clause.AssignmentColumns([]string{"content"})}).Create(&moved).Error; err != nil {
		return err
	}
	return tx.Where("path IN ?", paths).Delete(&lessonFileRow{}).Error
}

func sameSet(a, b []string) bool {
	x, y := slices.Clone(a), slices.Clone(b)
	slices.Sort(x)
	slices.Sort(y)
	return slices.Equal(x, y)
}

// checkLengths 依欄位的上限(字數,和資料表一致)檢查:SQLite 不擋超長,正式的 Postgres 會回內部錯誤。
func checkLengths(title, subtitle, label string) error {
	if len([]rune(title)) > 200 || len([]rune(subtitle)) > 500 || len([]rune(label)) > 32 {
		return invalid("title 最多 200 字、subtitle 與 summary 最多 500 字、label 最多 32 字")
	}
	return nil
}

// dropTranslations 刪掉一個項目的譯文:之後用同一個 id 建的是別的內容,不能沿用舊譯文。舊的值記在翻譯歷史裡。
func dropTranslations(tx *gorm.DB, user, kind, ref string) error {
	var rows []i18nTranslationRow
	if err := tx.Where("kind = ? AND ref = ?", kind, ref).Find(&rows).Error; err != nil || len(rows) == 0 {
		return err
	}
	at := now()
	hist := make([]i18nHistoryRow, len(rows))
	for i, r := range rows {
		hist[i] = i18nHistoryRow{Kind: r.Kind, Ref: r.Ref, Path: r.Path, Lang: r.Lang, OldValue: r.Value, OldStatus: r.Status, NewStatus: I18nDraft, Origin: r.Origin, ChangedBy: user, At: at, Reason: "原文項目已刪除"}
	}
	if err := tx.CreateInBatches(hist, 50).Error; err != nil {
		return err
	}
	return tx.Where("kind = ? AND ref = ?", kind, ref).Delete(&i18nTranslationRow{}).Error
}

// LessonSlug 是課號在單課網址裡的寫法(和前端的 lessonUrl 同一個規則):小數點換成 -;分階段的軟體課去掉起步階段的 0. 前綴。
func LessonSlug(staged bool, id string) string {
	if staged {
		id = strings.TrimPrefix(id, "0.")
	}
	return strings.ReplaceAll(id, ".", "-")
}

// stagedCourseID 是網址分階段的課(前端 catalog 裡有 stages 的只有它)。
const stagedCourseID = "software"
