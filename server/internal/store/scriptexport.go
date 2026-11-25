package store

import (
	"context"
	"fmt"
)

// ScriptExportFile 是備份用的一個腳本檔:來源(lesson_files 或 studio_files)、路徑、所屬課程與課(研發基地的檔沒有)與原始內容。
type ScriptExportFile struct {
	Source   string `json:"source"` // "lesson" 或 "studio"
	Path     string `json:"path"`
	CourseID string `json:"courseId,omitempty"`
	LessonID string `json:"lessonId,omitempty"`
	Content  string `json:"content"`
}

// 備份的來源:lesson_files 與 studio_files
const (
	ScriptSourceLesson = "lesson"
	ScriptSourceStudio = "studio"
)

// ExportScripts 唯讀地讀出腳本檔的完整內容(含 .voice.json、.mix.json),依路徑排序。
// source 是 "lesson"、"studio";空字串兩張表都讀(課程的在前)。只做 SELECT,不寫資料庫。
func (s *Store) ExportScripts(ctx context.Context, source string) ([]ScriptExportFile, error) {
	var out []ScriptExportFile
	if source == "" || source == ScriptSourceLesson {
		var rows []lessonFileRow
		if err := s.db.WithContext(ctx).Order("path").Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, r := range rows {
			out = append(out, ScriptExportFile{Source: ScriptSourceLesson, Path: r.Path, CourseID: r.CourseID, LessonID: r.LessonID, Content: r.Content})
		}
	}
	if source == "" || source == ScriptSourceStudio {
		var rows []studioFileRow
		if err := s.db.WithContext(ctx).Order("path").Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, r := range rows {
			out = append(out, ScriptExportFile{Source: ScriptSourceStudio, Path: r.Path, Content: r.Content})
		}
	}
	if source != "" && source != ScriptSourceLesson && source != ScriptSourceStudio {
		return nil, fmt.Errorf("source 只能是 lesson 或 studio:%q", source)
	}
	return out, nil
}
