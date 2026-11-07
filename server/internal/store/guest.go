package store

import (
	"context"
	"time"

	"gorm.io/gorm"
)

// 訪客的上課紀錄:未登入的人每打開一課記一筆(點選課程的時間),播放時累計實際播放的時間。
// 訪客只用 evoleap_guest cookie 裡的隨機代號區分,不連到任何帳號;超過 GuestRetention 的紀錄會刪掉。

// GuestRetention 是訪客紀錄保存的期間(也是訪客 cookie 的有效期間)。
const GuestRetention = 180 * 24 * time.Hour

// GuestView 是訪客打開一課的一筆紀錄。
type GuestView struct {
	ID        string    `json:"id"`
	GuestID   string    `json:"guestId"`
	Lesson    string    `json:"lesson"`
	WatchedMs int       `json:"watchedMs"`
	OpenedAt  time.Time `json:"openedAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type guestViewRow struct {
	ID        string    `gorm:"primaryKey;size:32"`
	GuestID   string    `gorm:"index;size:32;not null"`
	Lesson    string    `gorm:"size:200;not null"`
	WatchedMs int       `gorm:"not null"`
	OpenedAt  time.Time `gorm:"index"`
	UpdatedAt time.Time
}

func (guestViewRow) TableName() string { return "guest_views" }

func (r guestViewRow) toView() GuestView {
	return GuestView{ID: r.ID, GuestID: r.GuestID, Lesson: r.Lesson, WatchedMs: r.WatchedMs, OpenedAt: r.OpenedAt, UpdatedAt: r.UpdatedAt}
}

// NewGuestID 產生訪客代號(隨機 32 位十六進位字元)。
func NewGuestID() string { return newID() + newID()[:8] }

// OpenGuestView 記一筆「訪客打開了這一課」,回傳這筆紀錄的編號(之後用它累計播放時間)。
func (s *Store) OpenGuestView(ctx context.Context, guestID, lesson string) (string, error) {
	t := now()
	row := guestViewRow{ID: NewGuestID(), GuestID: guestID, Lesson: lesson, OpenedAt: t, UpdatedAt: t}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return "", err
	}
	return row.ID, nil
}

// SetGuestWatched 更新這筆紀錄累計的播放時間;只會變多(重送或順序錯亂的舊值不會蓋掉新的)。
// 紀錄不存在或不屬於這位訪客時回 ErrNotFound。
func (s *Store) SetGuestWatched(ctx context.Context, guestID, viewID string, watchedMs int) error {
	res := s.db.WithContext(ctx).Model(&guestViewRow{}).
		Where("id = ? AND guest_id = ?", viewID, guestID).
		Updates(map[string]any{
			// SQLite 與 Postgres 的取大值函式不同(max／GREATEST),用 CASE 兩邊都能跑
			"watched_ms": gorm.Expr("CASE WHEN watched_ms < ? THEN ? ELSE watched_ms END", watchedMs, watchedMs),
			"updated_at": now(),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// GuestViews 回傳某位訪客的紀錄,最近打開的在前(測試與查詢用)。
func (s *Store) GuestViews(ctx context.Context, guestID string) ([]GuestView, error) {
	var rows []guestViewRow
	if err := s.db.WithContext(ctx).Where("guest_id = ?", guestID).Order("opened_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]GuestView, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.toView())
	}
	return out, nil
}

// PruneGuestViews 刪掉打開時間早於 before 的訪客紀錄,回傳刪掉幾筆。
func (s *Store) PruneGuestViews(ctx context.Context, before time.Time) (int64, error) {
	// 存的是 UTC;SQLite 以字串比較,時區要一致
	res := s.db.WithContext(ctx).Where("opened_at < ?", before.UTC()).Delete(&guestViewRow{})
	return res.RowsAffected, res.Error
}
