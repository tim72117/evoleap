// Package storetest 給 store 以外的套件測試用:開一個寫好固定課程資料(見 fixture)的資料庫。
package storetest

import (
	"context"
	"fmt"

	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/evoleap/internal/store/fixture"
)

// Open 開資料庫並寫入固定的主題、課程、單元與課(不含腳本檔)。
func Open(dsn string) (*store.Store, error) {
	s, err := store.Connect(dsn)
	if err != nil {
		return nil, err
	}
	if err := s.Seed(context.Background(), fixture.Topics, fixture.Courses, fixture.I18nEN); err != nil {
		return nil, fmt.Errorf("seed fixture: %w", err)
	}
	return s, nil
}
