package store

import (
	"context"
	"fmt"

	"github.com/tim72117/evoleap/internal/store/fixture"
)

// Open 開資料庫並寫入固定的主題、課程、單元與課(不含腳本檔;其他套件的測試用 storetest.Open)。
func Open(dsn string) (*Store, error) {
	s, err := Connect(dsn)
	if err != nil {
		return nil, err
	}
	if err := s.Seed(context.Background(), fixture.Topics, fixture.Courses, fixture.I18nEN); err != nil {
		return nil, fmt.Errorf("seed fixture: %w", err)
	}
	return s, nil
}

// syncCoursesJSON 用固定的主題與給定的課程資料初始化(資料庫已經有課程時只補腳本檔)。
func (s *Store) syncCoursesJSON(ctx context.Context, seed []byte, dir string) error {
	_, err := s.syncSeeds(ctx, fixture.Topics, seed, fixture.I18nEN, dir)
	return err
}
