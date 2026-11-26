package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 管理員改課程資料(evoleap CLI 經 /api/admin/courses/*、/api/admin/scripts/*)。
// 課程結構與腳本都以資料庫為準,空資料庫手動初始化(見 catalog.go)。新增、刪除、排序見 structure.go。
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

// CoursePatch 是一門課要改的欄位;nil 代表不改。
type CoursePatch struct {
	Access *string `json:"access,omitempty"`
	Title  *string `json:"title,omitempty"`
	// 課程資訊(見 courseRow):簡介、說明段落、搜尋結果的標題與描述、插圖樣式;給空字串(About 給空陣列)代表清掉
	Summary     *string   `json:"summary,omitempty"`
	About       *[]string `json:"about,omitempty"`
	SEOTitle    *string   `json:"seoTitle,omitempty"`
	Description *string   `json:"description,omitempty"`
	Art         *string   `json:"art,omitempty"`
	IntroScript *string   `json:"introScript,omitempty"`
	// 所屬主題(topics 表的 id,見 courseRow;給空字串清掉,該課就不列在全部課程)與有沒有課程總覽頁
	TopicID  *string `json:"topicId,omitempty"`
	Overview *bool   `json:"overview,omitempty"`
}

// UpdateCourse 改一門課自己的存取方式或課名並記一筆修改紀錄(course.update);課程不存在時回 ErrCourseNotFound。
// 沒有自己寫 access 的課照這門課的(見 effectiveAccess),所以改了課程的 access,那些課也跟著變。
func (s *Store) UpdateCourse(ctx context.Context, user, courseID string, p CoursePatch) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var c courseRow
		err := tx.First(&c, "id = ?", courseID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrCourseNotFound
		}
		if err != nil {
			return err
		}
		if p.Access != nil {
			c.Access = strings.TrimSpace(*p.Access)
		}
		if p.Title != nil {
			c.Title = strings.TrimSpace(*p.Title)
		}
		about := splitAbout(c.About)
		if p.Summary != nil {
			c.Summary = strings.TrimSpace(*p.Summary)
		}
		if p.About != nil {
			about = make([]string, len(*p.About))
			for i, para := range *p.About {
				about[i] = strings.TrimSpace(para)
			}
		}
		if p.SEOTitle != nil {
			c.SEOTitle = strings.TrimSpace(*p.SEOTitle)
		}
		if p.Description != nil {
			c.Description = strings.TrimSpace(*p.Description)
		}
		if p.Art != nil {
			c.Art = strings.TrimSpace(*p.Art)
		}
		oldIntro := c.IntroScript
		if p.IntroScript != nil {
			c.IntroScript = strings.TrimSpace(*p.IntroScript)
		}
		if p.TopicID != nil {
			c.TopicID = strings.TrimSpace(*p.TopicID)
		}
		if p.Overview != nil {
			c.Overview = *p.Overview
		}
		if err := validateCourseTopicID(tx, c.TopicID); err != nil {
			return err
		}
		if err := validateCourseInfo(c.Art, c.Summary, c.Description, c.SEOTitle, c.IntroScript, about); err != nil {
			return err
		}
		c.About = joinAbout(about)
		// 換掉或拿掉簡介影片:舊檔(含旁白、音軌清單)移回研發基地,免得卡在這門課上誰都讀不到
		if oldIntro != "" && oldIntro != c.IntroScript {
			if err := moveFilesToStudio(tx, "course_id = ? AND lesson_id = '' AND path IN ?", courseID, introFiles(oldIntro)); err != nil {
				return err
			}
		}
		if p.IntroScript != nil && c.IntroScript != "" {
			for _, path := range introFiles(c.IntroScript) {
				if err := attachIntroScript(tx, courseID, path); err != nil {
					return err
				}
			}
		}
		switch Access(c.Access) {
		case AccessFree, AccessLoginFree, AccessSubscription:
		default:
			return invalid("不認得的 access %q(課程要是 free、login-free 或 subscription)", c.Access)
		}
		if c.Title == "" {
			return invalid("title 不能是空的")
		}
		if err := tx.Model(&courseRow{}).Where("id = ?", courseID).
			Select("access", "title", "summary", "about", "seo_title", "description", "art", "intro_script", "topic_id", "overview", "updated_at").
			Updates(&courseRow{Access: c.Access, Title: c.Title, Summary: c.Summary, About: c.About, SEOTitle: c.SEOTitle, Description: c.Description, Art: c.Art, IntroScript: c.IntroScript, TopicID: c.TopicID, Overview: c.Overview, UpdatedAt: now()}).Error; err != nil {
			return err
		}
		if err := syncI18nSources(tx); err != nil {
			return err
		}
		return s.recordChange(tx, user, "course.update", courseID, p)
	})
}

// introFiles 是一支簡介影片用到的檔:主腳本與同名的旁白、音軌清單。
func introFiles(script string) []string {
	base := strings.TrimSuffix(script, ".json")
	return []string{script, base + ".voice.json", base + ".mix.json"}
}

// introOwner 回傳把 path 當簡介影片檔(主腳本、旁白或音軌清單)的課程 id;沒有回空字串。
func introOwner(tx *gorm.DB, path string) (string, error) {
	var courses []courseRow
	if err := tx.Select("id", "intro_script").Where("intro_script <> ''").Find(&courses).Error; err != nil {
		return "", err
	}
	for _, c := range courses {
		if slices.Contains(introFiles(c.IntroScript), path) {
			return c.ID, nil
		}
	}
	return "", nil
}

// attachIntroScript 把研發基地的腳本改掛成這門課的簡介影片(課號是空的);已經掛在別的課底下回錯誤,資料庫沒有這個檔就不處理。
func attachIntroScript(tx *gorm.DB, courseID, path string) error {
	var f lessonFileRow
	err := tx.First(&f, "path = ?", path).Error
	if err == nil {
		if f.CourseID != courseID || f.LessonID != "" {
			return invalid("%s 已經屬於課程 %s 的 %s,一個檔只能屬於一處", path, f.CourseID, f.LessonID)
		}
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	var studio studioFileRow
	if err := tx.First(&studio, "path = ?", path).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if err := tx.Create(&lessonFileRow{Path: path, CourseID: courseID, Content: studio.Content}).Error; err != nil {
		return err
	}
	return tx.Where("path = ?", path).Delete(&studioFileRow{}).Error
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
		if err := syncI18nSources(tx); err != nil {
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
			// 簡介影片的檔(例如課程設好之後才傳的旁白清單)直接掛到那門課
			owner, err := introOwner(tx, path)
			if err != nil {
				return err
			}
			if owner != "" {
				if err := tx.Create(&lessonFileRow{Path: path, CourseID: owner, Content: string(content)}).Error; err != nil {
					return err
				}
				if err := tx.Where("path = ?", path).Delete(&studioFileRow{}).Error; err != nil {
					return err
				}
				break
			}
			row := studioFileRow{Path: path, Content: string(content)}
			if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "path"}}, DoUpdates: clause.AssignmentColumns([]string{"content"})}).Create(&row).Error; err != nil {
				return err
			}
		}
		return s.recordChange(tx, user, "script.put", path, map[string]any{"course": courseID, "lesson": lessonID, "bytes": len(content)})
	})
}
