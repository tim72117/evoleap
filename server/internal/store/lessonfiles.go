package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 每一課的腳本檔(舞台腳本、子腳本、開場與試做),以及各自的旁白清單(.voice.json)與章節音軌清單(.mix.json)。
// 課的資料只記路徑:一課的 script 加上 files;檔案內容放在這張表(用 evoleap script push 修改)。
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

// SyncLessonFilesJSON 依給定的課程資料(格式同固定測試資料 fixture/courses.json)把每一課的腳本檔從 dir 讀進 lesson_files,其餘的 .json 讀進 studio_files(測試用)。
// 資料指定的檔,資料庫沒有就新增,已經有的只改掛到那一課、內容不動;不再指定的檔移到 studio_files。指定的檔不存在,或一個檔寫在兩課底下時回傳錯誤。
func (s *Store) SyncLessonFilesJSON(ctx context.Context, seed []byte, dir string) error {
	seeds, err := parseCourseSeed(seed)
	if err != nil {
		return err
	}
	files, err := readLessonFiles(seeds, dir)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error { return syncLessonFiles(tx, seeds, files) })
}

// seedFiles 是從腳本目錄讀出來、要寫進資料庫的檔:種子指定給各課的(lessons)與其餘的 .json(others,研發基地的候選)。
type seedFiles struct {
	lessons []lessonFileRow
	others  []studioFileRow
}

// readLessonFiles 讀出種子指定給各課的腳本檔與目錄裡其餘的 .json,並檢查一個檔只能屬於一課、種子寫到的檔要存在。
// 只讀檔案、不碰資料庫,讓 syncLessonFiles 的交易不用等讀檔。
func readLessonFiles(seeds []courseSeedRow, dir string) (seedFiles, error) {
	var out seedFiles
	owner := map[string]string{} // 路徑 → 哪一課(一個檔只能屬於一課)
	for _, c := range seeds {
		// 課程簡介影片:屬於這門課(課號是空的),和各課的檔一樣一個檔只能屬於一處
		if c.IntroScript != "" {
			for _, p := range lessonFilePaths(dir, lessonSeed{Script: c.IntroScript}) {
				if prev, ok := owner[p]; ok {
					return seedFiles{}, fmt.Errorf("腳本 %s 同時屬於 %s 與課程 %s 的簡介影片,一個檔只能屬於一處", p, prev, c.ID)
				}
				owner[p] = c.ID + " 簡介影片"
				b, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(p)))
				if err != nil {
					return seedFiles{}, fmt.Errorf("課程 %s 的簡介影片:讀不到腳本 %s:%w", c.ID, p, err)
				}
				out.lessons = append(out.lessons, lessonFileRow{Path: p, CourseID: c.ID, LessonID: "", Content: string(b)})
			}
		}
		for _, u := range c.Units {
			for _, l := range u.Lessons {
				for _, p := range lessonFilePaths(dir, l) {
					who := c.ID + " " + l.ID
					if prev, ok := owner[p]; ok {
						if prev == who {
							continue // 同一課寫了兩次(例如 files 又寫了會自動加上的 .voice.json)
						}
						return seedFiles{}, fmt.Errorf("腳本 %s 同時寫在課程 %s 和 %s,一個檔只能屬於一課", p, prev, who)
					}
					owner[p] = who
					b, err := os.ReadFile(filepath.Join(dir, p))
					if err != nil {
						return seedFiles{}, fmt.Errorf("課程 %s 的 %s:讀不到腳本 %s:%w", c.ID, l.ID, p, err)
					}
					out.lessons = append(out.lessons, lessonFileRow{Path: p, CourseID: c.ID, LessonID: l.ID, Content: string(b)})
				}
			}
		}
	}
	err := filepath.WalkDir(dir, func(p string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || filepath.Ext(p) != ".json" {
			return err
		}
		rel, err := filepath.Rel(dir, p)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		if _, ok := owner[rel]; ok {
			return nil
		}
		b, err := os.ReadFile(p)
		out.others = append(out.others, studioFileRow{Path: rel, Content: string(b)})
		return err
	})
	if err != nil {
		return seedFiles{}, fmt.Errorf("讀取研發基地的腳本:%w", err)
	}
	return out, nil
}

// syncLessonFiles 把讀好的檔寫進資料庫(在呼叫端的交易裡),順序要緊:
//  1. 種子指定的檔寫進 lesson_files:沒有的新增;已經有的只改掛到種子寫的課(course_id、lesson_id),內容不動。
//  2. 種子裡的課程底下、種子已經不指定的檔移出 lesson_files,帶著資料庫裡的內容放進 studio_files(已經有同路徑的就不動)。
//  3. 目錄裡其餘的 .json 補進 studio_files(已經有的不動,所以第 2 步移過去的內容不會被檔案蓋掉);
//     還掛在某一課底下的(例如種子沒寫單元的課程,或種子以外的課程裡用 evoleap script push 掛上的)跳過。
func syncLessonFiles(tx *gorm.DB, seeds []courseSeedRow, files seedFiles) error {
	if len(files.lessons) > 0 {
		err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "path"}},
			DoUpdates: clause.AssignmentColumns([]string{"course_id", "lesson_id"}),
		}).CreateInBatches(files.lessons, 20).Error
		if err != nil {
			return err
		}
	}
	var courses []string
	for _, c := range seeds {
		if c.Units != nil {
			courses = append(courses, c.ID)
		}
	}
	if len(courses) > 0 {
		q := tx.Where("course_id IN ?", courses)
		if len(files.lessons) > 0 {
			paths := make([]string, len(files.lessons))
			for i, r := range files.lessons {
				paths[i] = r.Path
			}
			q = q.Where("path NOT IN ?", paths)
		}
		var dropped []lessonFileRow
		if err := q.Find(&dropped).Error; err != nil {
			return err
		}
		if len(dropped) > 0 {
			moved := make([]studioFileRow, len(dropped))
			paths := make([]string, len(dropped))
			for i, r := range dropped {
				moved[i] = studioFileRow{Path: r.Path, Content: r.Content}
				paths[i] = r.Path
			}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(moved, 20).Error; err != nil {
				return err
			}
			if err := tx.Where("path IN ?", paths).Delete(&lessonFileRow{}).Error; err != nil {
				return err
			}
		}
	}
	// 資料庫裡還掛在某一課底下的檔,不再當成研發基地的檔補一份
	var inLessons []string
	if err := tx.Model(&lessonFileRow{}).Pluck("path", &inLessons).Error; err != nil {
		return err
	}
	owned := map[string]bool{}
	for _, p := range inLessons {
		owned[p] = true
	}
	var studio []studioFileRow
	for _, f := range files.others {
		if !owned[f.Path] {
			studio = append(studio, f)
		}
	}
	if len(studio) > 0 {
		return tx.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(studio, 20).Error
	}
	return nil
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
	if err := db.First(&c, "id = ?", f.CourseID).Error; err != nil {
		return LessonFile{}, notFoundAs(err)
	}
	// 課號是空的:課程簡介影片(課程層級的檔),公開給所有訪客,狀態視為 open、免費;檔案要還是這門課現在指定的簡介影片(或它的旁白、音軌)
	if f.LessonID == "" {
		base := strings.TrimSuffix(strings.TrimSuffix(path, ".voice.json"), ".mix.json")
		if base == path {
			base = strings.TrimSuffix(path, ".json")
		}
		if strings.TrimSuffix(c.IntroScript, ".json") != base {
			return LessonFile{}, ErrLessonFileNotFound
		}
		return LessonFile{CourseID: f.CourseID, LessonID: "", Status: LessonOpen, Access: AccessFree, Content: f.Content}, nil
	}
	if err := db.First(&l, "course_id = ? AND id = ?", f.CourseID, f.LessonID).Error; err != nil {
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

// addMissingScripts 把目錄裡資料庫還沒有的 .json 補進研發基地(已經掛在某一課或研發基地的不動)。目錄不存在時什麼都不做。
func addMissingScripts(tx *gorm.DB, dir string) error {
	if _, err := os.Stat(dir); errors.Is(err, os.ErrNotExist) {
		return nil
	}
	files, err := readLessonFiles(nil, dir)
	if err != nil {
		return err
	}
	return syncLessonFiles(tx, nil, files)
}
