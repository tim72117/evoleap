// Package gormstore 用 gorm 實作方案紀錄的儲存,資料表由本套件自己管理。
package gormstore

import (
	"context"
	"fmt"
	"time"

	"github.com/tim72117/subscription"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Row 是 subscriptions 表的一列。匯出是為了讓專案的資料表結構檢查也看得到這張表(Models)。
// 欄位沿用 feat/subscription 分支的命名,之後接金流時 AutoMigrate 只會加欄位。
type Row struct {
	Source           string `gorm:"primaryKey;size:32"`
	ExternalID       string `gorm:"primaryKey;size:128"`
	UserID           string `gorm:"size:64;index"`
	Tier             string `gorm:"size:32"`
	Status           string `gorm:"size:32"`
	CurrentPeriodEnd *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (Row) TableName() string { return "subscriptions" }

// Models 回傳本套件管理的資料表定義。
func Models() []any { return []any{&Row{}} }

func toRow(sub subscription.Subscription) Row {
	return Row{
		Source:           string(sub.Source),
		ExternalID:       sub.ExternalID,
		UserID:           sub.UserID,
		Tier:             string(sub.Tier),
		Status:           string(sub.Status),
		CurrentPeriodEnd: sub.CurrentPeriodEnd,
	}
}

func fromRow(r Row) subscription.Subscription {
	return subscription.Subscription{
		Source:           subscription.Source(r.Source),
		ExternalID:       r.ExternalID,
		UserID:           r.UserID,
		Tier:             subscription.Tier(r.Tier),
		Status:           subscription.Status(r.Status),
		CurrentPeriodEnd: r.CurrentPeriodEnd,
	}
}

// Store 實作 subscription.Store。
type Store struct {
	db *gorm.DB
}

// New 同步資料表並回傳 Store。
func New(db *gorm.DB) (*Store, error) {
	if err := db.AutoMigrate(Models()...); err != nil {
		return nil, fmt.Errorf("migrate subscriptions: %w", err)
	}
	return &Store{db: db}, nil
}

// NewService 同步資料表並建立方案服務;catalog 是專案注入的方案資料。
func NewService(db *gorm.DB, catalog subscription.Catalog, opts subscription.Options) (*subscription.Service, error) {
	store, err := New(db)
	if err != nil {
		return nil, err
	}
	return subscription.New(store, catalog, opts), nil
}

func (s *Store) SubscriptionsOf(ctx context.Context, userID string) ([]subscription.Subscription, error) {
	var rows []Row
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]subscription.Subscription, len(rows))
	for i, r := range rows {
		out[i] = fromRow(r)
	}
	return out, nil
}

func (s *Store) SaveSubscription(ctx context.Context, sub subscription.Subscription) error {
	r := toRow(sub)
	now := time.Now()
	r.CreatedAt, r.UpdatedAt = now, now
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "source"}, {Name: "external_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"user_id", "tier", "status", "current_period_end", "updated_at"}),
	}).Create(&r).Error
}
