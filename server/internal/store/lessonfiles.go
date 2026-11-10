package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 每一課的腳本檔(舞台腳本、子腳本、開場與試做),以及各自的旁白清單(.voice.json)與章節音軌清單(.mix.json)。
// 種子(courses_seed.json)只記路徑:一課的 script 加上 files;檔案本身在 web/src/content/live/,寫入課程資料時(正式環境是部署時的同步工作 cmd/sync,本機是後端啟動時)讀進這張表,
// 一個檔案一列、記著屬於哪一門課的哪一課。前端只透過 GET /api/scripts/{path} 取得,所以能依那一課的狀態與存取方式把關。
type lessonFileRow struct {
	// Path 是 web/src/content/live/ 底下的相對路徑(例如 l0/0.0-tools.json),前端用它取檔
	Path     string `gorm:"primaryKey;size:200"`
	CourseID string `gorm:"size:64;not null;index:idx_lesson_files_lesson"`
	LessonID string `gorm:"size:32;not null;index:idx_lesson_files_lesson"`
	Content  string `gorm:"type:text;not null"`
}

func (lessonFileRow) TableName() string { return "lesson_files" }

// studioFileRow 是不屬於任何一課、只給研發基地用的腳本檔(lab/、promo/ 與草稿),只有管理員拿得到。
// 腳本目錄裡沒有掛在任何一課底下的 .json 都放這裡。
type studioFileRow struct {
	Path    string `gorm:"primaryKey;size:200"`
	Content string `gorm:"type:text;not null"`
}

func (studioFileRow) TableName() string { return "studio_files" }

// ErrLessonFileNotFound 是查不到這個腳本檔時回傳的錯誤。
var ErrLessonFileNotFound = errors.New("lesson file not found")

// LessonFile 是一個腳本檔,以及它所屬那一課的狀態與實際的存取方式(沒有例外時就是這門課的)。
type LessonFile struct {
	CourseID string
	LessonID string
	Status   string
	Access   Access
	Content  string
}

// lessonFilePaths 回傳一課要讀進資料庫的檔案:script 與 files,每一個再加上存在的 .voice.json、.mix.json。
func lessonFilePaths(dir string, l lessonSeed) []string {
	var paths []string
	for _, p := range append([]string{l.Script}, l.Files...) {
		if p == "" {
			continue
		}
		paths = append(paths, p)
		for _, ext := range []string{".voice.json", ".mix.json"} {
			extra := strings.TrimSuffix(p, ".json") + ext
			if _, err := os.Stat(filepath.Join(dir, extra)); err == nil {
				paths = append(paths, extra)
			}
		}
	}
	return paths
}

// SyncLessonFiles 依 courses_seed.json 把每一課的腳本檔從 dir(web/src/content/live)讀進 lesson_files,其餘的 .json 讀進 studio_files。
// 只新增資料庫還沒有的檔,已經有的不動:上線後腳本以資料庫為準,改腳本用 evoleap script push(見 coursesadmin.go)。
// 種子寫到的檔案不存在時回傳錯誤(啟動失敗),免得上線後課程頁才發現少了腳本。
func (s *Store) SyncLessonFiles(ctx context.Context, dir string) error {
	return s.SyncLessonFilesJSON(ctx, courseSeed, dir)
}

// SyncLessonFilesJSON 同 SyncLessonFiles,但種子用給定的 JSON(格式同 courses_seed.json);測試用,不依賴真正的腳本目錄。
func (s *Store) SyncLessonFilesJSON(ctx context.Context, seed []byte, dir string) error {
	var seeds []courseSeedRow
	if err := json.Unmarshal(seed, &seeds); err != nil {
		return fmt.Errorf("parse course seed: %w", err)
	}
	var rows []lessonFileRow
	owner := map[string]string{} // 路徑 → 哪一課(一個檔只能屬於一課)
	for _, c := range seeds {
		for _, u := range c.Units {
			for _, l := range u.Lessons {
				for _, p := range lessonFilePaths(dir, l) {
					who := c.ID + " " + l.ID
					if prev, ok := owner[p]; ok {
						if prev == who {
							continue // 同一課寫了兩次(例如 files 又寫了會自動加上的 .voice.json)
						}
						return fmt.Errorf("腳本 %s 同時寫在課程 %s 和 %s,一個檔只能屬於一課", p, prev, who)
					}
					owner[p] = who
					b, err := os.ReadFile(filepath.Join(dir, p))
					if err != nil {
						return fmt.Errorf("課程 %s 的 %s:讀不到腳本 %s:%w", c.ID, l.ID, p, err)
					}
					rows = append(rows, lessonFileRow{Path: p, CourseID: c.ID, LessonID: l.ID, Content: string(b)})
				}
			}
		}
	}
	owned := map[string]bool{}
	for _, r := range rows {
		owned[r.Path] = true
	}
	// 資料庫裡已經掛在某一課底下的檔(例如管理員用 evoleap script push -course -lesson 從研發基地搬過去的),不再當成研發基地的檔補一份
	var inLessons []string
	if err := s.db.WithContext(ctx).Model(&lessonFileRow{}).Pluck("path", &inLessons).Error; err != nil {
		return err
	}
	for _, p := range inLessons {
		owned[p] = true
	}
	var studio []studioFileRow
	err := filepath.WalkDir(dir, func(p string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || filepath.Ext(p) != ".json" {
			return err
		}
		rel, err := filepath.Rel(dir, p)
		if err != nil || owned[filepath.ToSlash(rel)] {
			return err
		}
		b, err := os.ReadFile(p)
		studio = append(studio, studioFileRow{Path: filepath.ToSlash(rel), Content: string(b)})
		return err
	})
	if err != nil {
		return fmt.Errorf("讀取研發基地的腳本:%w", err)
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if len(rows) > 0 {
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(rows, 20).Error; err != nil {
				return err
			}
		}
		if len(studio) > 0 {
			return tx.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(studio, 20).Error
		}
		return nil
	})
}

// LessonFileOf 回傳一個腳本檔與它那一課的狀態、存取方式;沒有這個檔回 ErrLessonFileNotFound。
func (s *Store) LessonFileOf(ctx context.Context, path string) (LessonFile, error) {
	db := s.db.WithContext(ctx)
	var f lessonFileRow
	if err := db.First(&f, "path = ?", path).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return LessonFile{}, ErrLessonFileNotFound
		}
		return LessonFile{}, err
	}
	// 檔案所屬的課或課程已經不在(例如部署交替時另一版的種子拿掉了這一課):當作沒有這個檔
	var l lessonRow
	var c courseRow
	if err := db.First(&l, "course_id = ? AND id = ?", f.CourseID, f.LessonID).Error; err != nil {
		return LessonFile{}, notFoundAs(err)
	}
	if err := db.First(&c, "id = ?", f.CourseID).Error; err != nil {
		return LessonFile{}, notFoundAs(err)
	}
	return LessonFile{CourseID: f.CourseID, LessonID: f.LessonID, Status: l.Status, Access: effectiveAccess(l.Access, c.Access), Content: f.Content}, nil
}

func notFoundAs(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrLessonFileNotFound
	}
	return err
}

// 一課的存取方式沒寫就照這門課的
func effectiveAccess(lesson, course string) Access {
	if lesson == "" {
		return Access(course)
	}
	return Access(lesson)
}

// SeedLessonFile 不經資料庫,直接從內嵌的種子與 dir 裡的檔案找一課的腳本檔:沒接資料庫時用,讓免登入的課照常能播。
func SeedLessonFile(dir, path string) (LessonFile, error) {
	var seeds []courseSeedRow
	if err := json.Unmarshal(courseSeed, &seeds); err != nil {
		return LessonFile{}, fmt.Errorf("parse course seed: %w", err)
	}
	for _, c := range seeds {
		for _, u := range c.Units {
			for _, l := range u.Lessons {
				for _, p := range lessonFilePaths(dir, l) {
					if p != path {
						continue
					}
					b, err := os.ReadFile(filepath.Join(dir, p))
					if err != nil {
						return LessonFile{}, err
					}
					return LessonFile{CourseID: c.ID, LessonID: l.ID, Status: l.Status, Access: effectiveAccess(l.Access, c.Access), Content: string(b)}, nil
				}
			}
		}
	}
	return LessonFile{}, ErrLessonFileNotFound
}

// StudioFileOf 回傳研發基地用的腳本檔內容;沒有這個檔回 ErrLessonFileNotFound。
func (s *Store) StudioFileOf(ctx context.Context, path string) (string, error) {
	var f studioFileRow
	if err := s.db.WithContext(ctx).First(&f, "path = ?", path).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", ErrLessonFileNotFound
		}
		return "", err
	}
	return f.Content, nil
}

// ScriptPaths 回傳所有腳本檔的路徑(課程的與研發基地的),依路徑排序;研發基地的腳本清單用。
func (s *Store) ScriptPaths(ctx context.Context) ([]string, error) {
	var paths []string
	err := s.db.WithContext(ctx).Raw("SELECT path FROM lesson_files UNION SELECT path FROM studio_files ORDER BY path").Scan(&paths).Error
	return paths, err
}
