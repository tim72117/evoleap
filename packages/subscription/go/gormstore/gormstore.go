// Package gormstore 用 gorm 實作訂閱資料的儲存,資料表由本套件自己管理。
package gormstore

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/tim72117/subscription"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type row struct {
	Source           string `gorm:"primaryKey;size:32"`
	ExternalID       string `gorm:"primaryKey;size:128"`
	UserID           string `gorm:"size:64;index"`
	Tier             string `gorm:"size:32"`
	PriceID          string `gorm:"size:64"`
	Status           string `gorm:"size:32"`
	CustomerID       string `gorm:"size:64"`
	CurrentPeriodEnd *time.Time
	CancelAt         *time.Time
	Duplicate        bool `gorm:"not null;default:false"`
	LastEventAt      *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (row) TableName() string { return "subscriptions" }

// eventRow 是金流商事件的紀錄,用來對帳與人工處理,不刪除。Payload 是原始內容,保存一段時間後清除。
type eventRow struct {
	Source           string `gorm:"primaryKey;size:32"`
	EventID          string `gorm:"primaryKey;size:128"`
	Kind             string `gorm:"size:32;not null"`
	ExternalID       string `gorm:"size:128;index"`
	UserID           string `gorm:"size:64;index"`
	PriceID          string `gorm:"size:64"`
	Status           string `gorm:"size:32"`
	CurrentPeriodEnd *time.Time
	OccurredAt       time.Time
	TransactionID    string `gorm:"size:128;index"`
	Outcome          string `gorm:"size:32;index;not null"`
	Payload          []byte
	CreatedAt        time.Time `gorm:"index"`
	UpdatedAt        time.Time
}

func (eventRow) TableName() string { return "subscription_events" }

// paymentRow 是收到的款項,用來對帳與處理退款。不刪除。
type paymentRow struct {
	Source        string `gorm:"primaryKey;size:32"`
	TransactionID string `gorm:"primaryKey;size:128"`
	ExternalID    string `gorm:"size:128;index"`
	UserID        string `gorm:"size:64;index"`
	PriceID       string `gorm:"size:64"`
	PaidAt        time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func (paymentRow) TableName() string { return "subscription_payments" }

// taskRow 是要向金流商做的工作。DoneAt、FailedAt 都是空的才會執行;FailedAt 有值的要人工處理。
type taskRow struct {
	Source     string    `gorm:"primaryKey;size:32"`
	ExternalID string    `gorm:"primaryKey;size:128"`
	Kind       string    `gorm:"primaryKey;size:32"`
	Attempts   int       `gorm:"not null;default:0"`
	NextAt     time.Time `gorm:"index"`
	LastError  string    `gorm:"size:1000"`
	DoneAt     *time.Time
	FailedAt   *time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func (taskRow) TableName() string { return "subscription_tasks" }

// lockRow 只用來讓同一個 key 的交易依序執行。訂閱可能還沒有紀錄,所以不能鎖訂閱本身。
type lockRow struct {
	LockKey string `gorm:"primaryKey;size:255"`
}

func (lockRow) TableName() string { return "subscription_locks" }

func toRow(sub subscription.Subscription) row {
	return row{
		Source:           string(sub.Source),
		ExternalID:       sub.ExternalID,
		UserID:           sub.UserID,
		Tier:             string(sub.Tier),
		PriceID:          sub.PriceID,
		Status:           string(sub.Status),
		CustomerID:       sub.CustomerID,
		CurrentPeriodEnd: sub.CurrentPeriodEnd,
		CancelAt:         sub.CancelAt,
		Duplicate:        sub.Duplicate,
		LastEventAt:      sub.LastEventAt,
	}
}

func fromRow(r row) subscription.Subscription {
	return subscription.Subscription{
		Source:           subscription.Source(r.Source),
		ExternalID:       r.ExternalID,
		UserID:           r.UserID,
		Tier:             subscription.Tier(r.Tier),
		PriceID:          r.PriceID,
		Status:           subscription.Status(r.Status),
		CustomerID:       r.CustomerID,
		CurrentPeriodEnd: r.CurrentPeriodEnd,
		CancelAt:         r.CancelAt,
		Duplicate:        r.Duplicate,
		LastEventAt:      r.LastEventAt,
	}
}

// Store 實作 subscription.Store。
type Store struct {
	db *gorm.DB
}

// New 同步資料表並回傳 Store。
func New(db *gorm.DB) (*Store, error) {
	if err := db.AutoMigrate(&row{}, &eventRow{}, &paymentRow{}, &taskRow{}, &lockRow{}); err != nil {
		return nil, fmt.Errorf("migrate subscriptions: %w", err)
	}
	return &Store{db: db}, nil
}

// NewService 同步資料表並建立訂閱服務;catalog 是專案注入的方案資料。
func NewService(db *gorm.DB, catalog subscription.Catalog, opts subscription.Options) (*subscription.Service, error) {
	store, err := New(db)
	if err != nil {
		return nil, err
	}
	return subscription.New(store, catalog, opts), nil
}

func (s *Store) Transact(ctx context.Context, fn func(subscription.Tx) error) error {
	return s.db.WithContext(ctx).Transaction(func(db *gorm.DB) error {
		return fn(tx{db})
	})
}

func (s *Store) SubscriptionsOf(ctx context.Context, userID string) ([]subscription.Subscription, error) {
	return tx{s.db}.SubscriptionsOf(ctx, userID)
}

func (s *Store) EventPayload(ctx context.Context, source subscription.Source, eventID string) ([]byte, bool, error) {
	var r eventRow
	err := s.db.WithContext(ctx).Select("payload").First(&r, "source = ? AND event_id = ?", string(source), eventID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return r.Payload, len(r.Payload) > 0, nil
}

func (s *Store) PurgePayloads(ctx context.Context, before time.Time) error {
	return s.db.WithContext(ctx).Model(&eventRow{}).
		Where("created_at < ? AND payload IS NOT NULL", before).
		UpdateColumn("payload", nil).Error
}

func (s *Store) ClaimTasks(ctx context.Context, source subscription.Source, now time.Time, limit int, backoff func(int) time.Duration) ([]subscription.Task, error) {
	var tasks []subscription.Task
	err := s.db.WithContext(ctx).Transaction(func(db *gorm.DB) error {
		var rows []taskRow
		err := db.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
			Where("source = ? AND done_at IS NULL AND failed_at IS NULL AND next_at <= ?", string(source), now).
			Order("next_at").Limit(limit).Find(&rows).Error
		if err != nil {
			return err
		}
		tasks = tasks[:0]
		for _, r := range rows {
			task := subscription.Task{Source: source, ExternalID: r.ExternalID, Kind: subscription.TaskKind(r.Kind), Attempts: r.Attempts + 1}
			err := taskKey(db, task).UpdateColumns(map[string]any{"attempts": task.Attempts, "next_at": now.Add(backoff(task.Attempts))}).Error
			if err != nil {
				return err
			}
			tasks = append(tasks, task)
		}
		return nil
	})
	return tasks, err
}

func (s *Store) FinishTask(ctx context.Context, task subscription.Task, now time.Time, runErr error, giveUp bool) error {
	updates := map[string]any{}
	if runErr == nil {
		updates["done_at"] = now
		updates["last_error"] = ""
	} else {
		message := runErr.Error()
		if len(message) > 1000 {
			message = message[:1000]
		}
		updates["last_error"] = message
		if giveUp {
			updates["failed_at"] = now
		}
	}
	return taskKey(s.db.WithContext(ctx), task).UpdateColumns(updates).Error
}

func taskKey(db *gorm.DB, task subscription.Task) *gorm.DB {
	return db.Model(&taskRow{}).Where("source = ? AND external_id = ? AND kind = ?", string(task.Source), task.ExternalID, string(task.Kind))
}

// tx 實作 subscription.Tx。
type tx struct {
	db *gorm.DB
}

func (t tx) Lock(ctx context.Context, key string) error {
	db := t.db.WithContext(ctx)
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&lockRow{LockKey: key}).Error; err != nil {
		return err
	}
	var r lockRow
	return db.Clauses(clause.Locking{Strength: "UPDATE"}).First(&r, "lock_key = ?", key).Error
}

func (t tx) Subscription(ctx context.Context, source subscription.Source, externalID string) (subscription.Subscription, bool, error) {
	var r row
	err := t.db.WithContext(ctx).First(&r, "source = ? AND external_id = ?", string(source), externalID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return subscription.Subscription{}, false, nil
	}
	if err != nil {
		return subscription.Subscription{}, false, err
	}
	return fromRow(r), true, nil
}

func (t tx) SubscriptionsOf(ctx context.Context, userID string) ([]subscription.Subscription, error) {
	var rows []row
	if err := t.db.WithContext(ctx).Find(&rows, "user_id = ?", userID).Error; err != nil {
		return nil, err
	}
	subs := make([]subscription.Subscription, len(rows))
	for i, r := range rows {
		subs[i] = fromRow(r)
	}
	return subs, nil
}

func (t tx) SaveSubscription(ctx context.Context, sub subscription.Subscription) error {
	r := toRow(sub)
	return t.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "source"}, {Name: "external_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"user_id", "tier", "price_id", "status", "customer_id", "current_period_end", "cancel_at", "duplicate", "last_event_at", "updated_at",
		}),
	}).Create(&r).Error
}

func (t tx) HasEvent(ctx context.Context, source subscription.Source, eventID string) (subscription.Outcome, bool, error) {
	var r eventRow
	err := t.db.WithContext(ctx).Select("outcome").First(&r, "source = ? AND event_id = ?", string(source), eventID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return subscription.Outcome(r.Outcome), true, nil
}

func (t tx) SaveEvent(ctx context.Context, record subscription.EventRecord) error {
	ev := record.Event
	r := eventRow{
		Source:           string(record.Source),
		EventID:          ev.ID,
		Kind:             string(ev.Kind),
		ExternalID:       ev.ExternalID,
		UserID:           ev.UserID,
		PriceID:          ev.PriceID,
		Status:           string(ev.Status),
		CurrentPeriodEnd: ev.CurrentPeriodEnd,
		OccurredAt:       ev.OccurredAt,
		TransactionID:    ev.TransactionID,
		Outcome:          string(record.Outcome),
		Payload:          record.Payload,
	}
	return t.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "source"}, {Name: "event_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"user_id", "outcome", "updated_at"}),
	}).Create(&r).Error
}

func (t tx) SavePayment(ctx context.Context, payment subscription.Payment) error {
	r := paymentRow{
		Source:        string(payment.Source),
		TransactionID: payment.TransactionID,
		ExternalID:    payment.ExternalID,
		UserID:        payment.UserID,
		PriceID:       payment.PriceID,
		PaidAt:        payment.PaidAt,
	}
	return t.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "source"}, {Name: "transaction_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"external_id", "user_id", "price_id", "paid_at", "updated_at"}),
	}).Create(&r).Error
}

func (t tx) AddTask(ctx context.Context, task subscription.Task, now time.Time) error {
	r := taskRow{Source: string(task.Source), ExternalID: task.ExternalID, Kind: string(task.Kind), NextAt: now}
	return t.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "source"}, {Name: "external_id"}, {Name: "kind"}},
		DoUpdates: clause.Assignments(map[string]any{"attempts": 0, "next_at": now, "failed_at": nil}),
		Where:     clause.Where{Exprs: []clause.Expression{clause.Expr{SQL: "subscription_tasks.failed_at IS NOT NULL"}}},
	}).Create(&r).Error
}
