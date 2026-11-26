package store

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 課程資訊(主題、課程、單元、課)的匯出與手動初始化:匯出的內容備份到 GCS(見 server/backup/README.md),
// 空資料庫由管理員手動寫回(POST /api/admin/init)。格式同種子檔,腳本檔另外帶(同 ExportScripts)。

// Catalog 是一整份課程資訊。
type Catalog struct {
	Topics  []topicSeedRow  `json:"topics"`
	Courses []courseSeedRow `json:"courses"`
	// Translations 是全部譯文(不含修改歷史)
	Translations []CatalogTranslation `json:"translations,omitempty"`
}

// CatalogTranslation 是一個欄位的譯文;SourceHash 是翻譯當時中文原文的 sha256,和現在的原文不同就是過時。
type CatalogTranslation struct {
	Kind       string `json:"kind"`
	Ref        string `json:"ref"`
	Path       string `json:"path"`
	Lang       string `json:"lang"`
	Value      string `json:"value"`
	Status     string `json:"status"`
	SourceHash string `json:"sourceHash"`
	Origin     string `json:"origin"`
	Model      string `json:"model,omitempty"`
}

// ErrCoursesExist 表示資料庫已經有課程,不能再初始化。
var ErrCoursesExist = errors.New("資料庫已經有課程,只有空資料庫能初始化")

// ExportCatalog 讀出資料庫現在的課程資訊。
func (s *Store) ExportCatalog(ctx context.Context) (Catalog, error) {
	var out Catalog
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		topics, err := loadTopics(tx, "")
		if err != nil {
			return err
		}
		for _, t := range topics {
			row := topicSeedRow{ID: t.ID, Name: t.Name, Slogan: t.Slogan, Path: t.Path, SEOTitle: t.SEOTitle, Description: t.Description, Content: t.Content}
			if t.parts != nil {
				for _, it := range t.parts.items {
					if row.ItemIDs == nil {
						row.ItemIDs = map[string][]string{}
					}
					row.ItemIDs[it.Kind] = append(row.ItemIDs[it.Kind], it.ID)
				}
			}
			out.Topics = append(out.Topics, row)
		}
		var courses []courseRow
		if err := tx.Order("position, id").Find(&courses).Error; err != nil {
			return err
		}
		var units []unitRow
		if err := tx.Order("position, id").Find(&units).Error; err != nil {
			return err
		}
		var lessons []lessonRow
		if err := tx.Order("position, id").Find(&lessons).Error; err != nil {
			return err
		}
		for _, c := range courses {
			overview := c.Overview
			row := courseSeedRow{ID: c.ID, Title: c.Title, Access: c.Access, Tier: c.Tier, Summary: c.Summary, About: splitAbout(c.About), SEOTitle: c.SEOTitle, Description: c.Description, Art: c.Art, IntroScript: c.IntroScript, TopicID: c.TopicID, Overview: &overview}
			for _, u := range units {
				if u.CourseID != c.ID {
					continue
				}
				unit := unitSeed{ID: u.ID, Title: u.Title, Subtitle: u.Subtitle, Label: u.Label, Hidden: u.Hidden, Lessons: []lessonSeed{}}
				for _, l := range lessons {
					if l.CourseID == c.ID && l.UnitID == u.ID {
						unit.Lessons = append(unit.Lessons, lessonSeed{ID: l.ID, Title: l.Title, Summary: l.Summary, Access: l.Access, Status: l.Status, Script: l.Script, Minutes: l.Minutes})
					}
				}
				row.Units = append(row.Units, unit)
			}
			out.Courses = append(out.Courses, row)
		}
		var trs []i18nTranslationRow
		if err := tx.Order("lang, kind, ref, path").Find(&trs).Error; err != nil {
			return err
		}
		for _, r := range trs {
			out.Translations = append(out.Translations, CatalogTranslation{Kind: r.Kind, Ref: r.Ref, Path: r.Path, Lang: r.Lang, Value: r.Value, Status: r.Status, SourceHash: r.SourceHash, Origin: r.Origin, Model: r.Model})
		}
		return nil
	})
	return out, err
}

// InitCatalog 把課程資訊與腳本檔寫進還沒有任何課程的資料庫;全部在一個交易裡,失敗整批不寫。
func (s *Store) InitCatalog(ctx context.Context, cat Catalog, files []ScriptExportFile) error {
	if len(cat.Courses) == 0 {
		return invalid("courses 不能是空的")
	}
	known := map[string]bool{}
	for _, c := range cat.Courses {
		known[c.ID] = true
	}
	var lessons []lessonFileRow
	var studio []studioFileRow
	for _, f := range files {
		if !strings.HasSuffix(f.Path, ".json") || strings.Contains(f.Path, "..") || strings.HasPrefix(f.Path, "/") {
			return invalid("不合法的腳本路徑 %q", f.Path)
		}
		switch f.Source {
		case ScriptSourceLesson:
			if !known[f.CourseID] {
				return invalid("腳本 %s 屬於清單沒有的課程 %q", f.Path, f.CourseID)
			}
			lessons = append(lessons, lessonFileRow{Path: f.Path, CourseID: f.CourseID, LessonID: f.LessonID, Content: f.Content})
		case ScriptSourceStudio:
			studio = append(studio, studioFileRow{Path: f.Path, Content: f.Content})
		default:
			return invalid("source 只能是 lesson 或 studio:%q", f.Source)
		}
	}
	var trs []i18nTranslationRow
	for _, t := range cat.Translations {
		if !validI18nKind(t.Kind) || !validI18nStatus(t.Status) || t.Ref == "" || t.Path == "" || t.Lang == "" {
			return invalid("不合法的譯文 %s %s %s", t.Kind, t.Ref, t.Path)
		}
		trs = append(trs, i18nTranslationRow{Kind: t.Kind, Ref: t.Ref, Path: t.Path, Lang: t.Lang, Value: t.Value, Status: t.Status, SourceHash: t.SourceHash, Origin: t.Origin, Model: t.Model, UpdatedBy: "init", UpdatedAt: now()})
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if empty, err := noCourses(tx); err != nil {
			return err
		} else if !empty {
			return ErrCoursesExist
		}
		if err := seedTopics(tx, cat.Topics); err != nil {
			return invalid("%s", err)
		}
		if err := seedCourses(tx, cat.Courses); err != nil {
			return invalid("%s", err)
		}
		itemIDs := map[string]map[string][]string{}
		for _, t := range cat.Topics {
			itemIDs[t.ID] = t.ItemIDs
		}
		if _, err := structureTopics(tx, itemIDs); err != nil {
			return err
		}
		// 初始化之前研發基地可能已經有腳本(例如管理員先上傳過):以備份為準蓋掉,
		// 屬於某一課的路徑也從研發基地拿掉,一個檔只在一處
		if len(lessons) > 0 {
			paths := make([]string, len(lessons))
			for i, r := range lessons {
				paths[i] = r.Path
			}
			if err := tx.Where("path IN ?", paths).Delete(&studioFileRow{}).Error; err != nil {
				return err
			}
			if err := tx.CreateInBatches(lessons, 20).Error; err != nil {
				return err
			}
		}
		if len(studio) > 0 {
			if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "path"}}, UpdateAll: true}).CreateInBatches(studio, 20).Error; err != nil {
				return err
			}
		}
		if len(trs) > 0 {
			if err := tx.CreateInBatches(trs, 50).Error; err != nil {
				return err
			}
		}
		return syncI18n(tx)
	})
	if err != nil {
		return err
	}
	s.i18n.clear()
	return nil
}
