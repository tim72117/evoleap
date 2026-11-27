package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 腳本草稿:改腳本時先存在 script_drafts,管理員用 ?draft=1 預覽,確認後發布才寫進 lesson_files／studio_files。
// 一個路徑最多一份草稿。BaseHash 記著建立草稿時已發布版本的指紋,發布時已發布版本被別人改過就拒絕。
type scriptDraftRow struct {
	Path string `gorm:"primaryKey;size:200"`
	// CourseID、LessonID 是發布時要掛到哪一課;空的照發布當下的歸屬(沒有歸屬的是研發基地的檔)
	CourseID string `gorm:"size:64;not null"`
	LessonID string `gorm:"size:32;not null"`
	Content  string `gorm:"type:text;not null"`
	// BaseHash 是建立草稿時已發布內容的 SHA-256;當時還沒有已發布版本的是空字串
	BaseHash  string    `gorm:"size:64;not null"`
	UpdatedBy string    `gorm:"size:255;not null"`
	UpdatedAt time.Time `gorm:"not null"`
}

func (scriptDraftRow) TableName() string { return "script_drafts" }

var (
	// ErrDraftNotFound 是這個路徑沒有草稿。
	ErrDraftNotFound = errors.New("script draft not found")
	// ErrDraftConflict 是建立草稿之後,已發布版本被改過了。
	ErrDraftConflict = errors.New("已發布版本在草稿之後改過了")
)

// ScriptDraft 是給 API 回傳的草稿資訊(不含內容)。
type ScriptDraft struct {
	Path      string    `json:"path"`
	CourseID  string    `json:"courseId,omitempty"`
	LessonID  string    `json:"lessonId,omitempty"`
	Bytes     int       `json:"bytes"`
	UpdatedBy string    `json:"updatedBy"`
	UpdatedAt time.Time `json:"updatedAt"`
	// New:還沒有已發布版本
	New bool `json:"new"`
	// Stale:建立草稿之後已發布版本改過了,發布時要加 force
	Stale bool `json:"stale"`
}

func contentHash(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}

// publishedHash 回傳這個路徑已發布內容的指紋;還沒有已發布版本回空字串。
func publishedHash(tx *gorm.DB, path string) (string, error) {
	for _, m := range []any{&lessonFileRow{}, &studioFileRow{}} {
		var contents []string
		if err := tx.Model(m).Where("path = ?", path).Pluck("content", &contents).Error; err != nil {
			return "", err
		}
		if len(contents) > 0 {
			return contentHash(contents[0]), nil
		}
	}
	return "", nil
}

// PutScriptDraft 新增或取代一個草稿,不動已發布版本。檢查規則和 PutScript 一樣。
// 已經有草稿時保留原本的 BaseHash;沒給 courseID、lessonID 時保留草稿原本指定的課。
func (s *Store) PutScriptDraft(ctx context.Context, user, path, courseID, lessonID string, content []byte) (ScriptDraft, error) {
	if err := validateScript(path, content); err != nil {
		return ScriptDraft{}, err
	}
	var out ScriptDraft
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row scriptDraftRow
		err := tx.First(&row, "path = ?", path).Error
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			hash, err := publishedHash(tx, path)
			if err != nil {
				return err
			}
			row = scriptDraftRow{Path: path, BaseHash: hash}
		case err != nil:
			return err
		}
		if courseID != "" || lessonID != "" {
			row.CourseID, row.LessonID = courseID, lessonID
		}
		if row.CourseID != "" || row.LessonID != "" {
			if err := checkScriptTarget(tx, path, row.CourseID, row.LessonID); err != nil {
				return err
			}
		}
		row.Content, row.UpdatedBy, row.UpdatedAt = string(content), user, now()
		if err := tx.Clauses(clause.OnConflict{UpdateAll: true}).Create(&row).Error; err != nil {
			return err
		}
		out, err = draftInfo(tx, row)
		return err
	})
	return out, err
}

func draftInfo(tx *gorm.DB, row scriptDraftRow) (ScriptDraft, error) {
	hash, err := publishedHash(tx, row.Path)
	if err != nil {
		return ScriptDraft{}, err
	}
	return ScriptDraft{
		Path: row.Path, CourseID: row.CourseID, LessonID: row.LessonID, Bytes: len(row.Content),
		UpdatedBy: row.UpdatedBy, UpdatedAt: row.UpdatedAt, New: hash == "", Stale: hash != row.BaseHash,
	}, nil
}

// ScriptDrafts 列出所有草稿,依路徑排序。
func (s *Store) ScriptDrafts(ctx context.Context) ([]ScriptDraft, error) {
	db := s.db.WithContext(ctx)
	var rows []scriptDraftRow
	if err := db.Order("path").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]ScriptDraft, 0, len(rows))
	for _, r := range rows {
		d, err := draftInfo(db, r)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, nil
}

// ScriptDraftContent 回傳一個草稿的內容。
func (s *Store) ScriptDraftContent(ctx context.Context, path string) (string, error) {
	var row scriptDraftRow
	if err := s.db.WithContext(ctx).First(&row, "path = ?", path).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", ErrDraftNotFound
		}
		return "", err
	}
	return row.Content, nil
}

// DropScriptDraft 丟掉一個草稿;已發布版本不受影響。
func (s *Store) DropScriptDraft(ctx context.Context, path string) error {
	res := s.db.WithContext(ctx).Where("path = ?", path).Delete(&scriptDraftRow{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrDraftNotFound
	}
	return nil
}

// PublishScriptDrafts 把指定路徑的草稿發布成正式版本,回傳發布了哪些路徑。
// 主腳本會連同它的旁白清單、章節音軌清單草稿一起發布(分開發布旁白會和字幕對不上)。
// 全部在同一個交易裡:任何一個失敗就都不發布。force 時略過「已發布版本改過了」的檢查。
func (s *Store) PublishScriptDrafts(ctx context.Context, user string, paths []string, force bool) ([]string, error) {
	var published []string
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		published = nil
		var rows []scriptDraftRow
		for _, p := range paths {
			var main scriptDraftRow
			found := tx.Where("path = ?", p).Limit(1).Find(&main)
			if found.Error != nil {
				return found.Error
			}
			group := []scriptDraftRow{}
			if found.RowsAffected > 0 {
				group = append(group, main)
			}
			if !strings.HasSuffix(p, ".voice.json") && !strings.HasSuffix(p, ".mix.json") {
				base := strings.TrimSuffix(p, ".json")
				var companions []scriptDraftRow
				if err := tx.Where("path IN ?", []string{base + ".voice.json", base + ".mix.json"}).Order("path DESC").Find(&companions).Error; err != nil {
					return err
				}
				group = append(group, companions...)
			}
			if len(group) == 0 {
				return fmt.Errorf("%w:%s", ErrDraftNotFound, p)
			}
			for _, r := range group {
				if !slices.ContainsFunc(rows, func(x scriptDraftRow) bool { return x.Path == r.Path }) {
					rows = append(rows, r)
				}
			}
		}
		if !force {
			var stale []string
			for _, r := range rows {
				hash, err := publishedHash(tx, r.Path)
				if err != nil {
					return err
				}
				if hash != r.BaseHash {
					stale = append(stale, r.Path)
				}
			}
			if len(stale) > 0 {
				sort.Strings(stale)
				return fmt.Errorf("%w:%s", ErrDraftConflict, strings.Join(stale, "、"))
			}
		}
		for _, r := range rows {
			if err := s.putScript(tx, user, "script.publish", r.Path, r.CourseID, r.LessonID, []byte(r.Content)); err != nil {
				return err
			}
			if err := tx.Where("path = ?", r.Path).Delete(&scriptDraftRow{}).Error; err != nil {
				return err
			}
			published = append(published, r.Path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return published, nil
}
