package store

import (
	"context"
	"sort"
	"time"
)

// 管理後台用的唯讀彙整。資料量小(會員數與課程數都不大),直接把兩張表讀出來在 Go 裡彙整,
// 避免在 SQL 裡對時間欄位做聚合——SQLite 與 Postgres 對聚合後的時間型別回傳不一致。

// completedRatio 以上視為「看完」(位置 / 總長)。
const completedRatio = 0.9

// AdminUser 是使用者列表的一列:基本資料加上播放進度概況。
type AdminUser struct {
	User
	LessonCount int        `json:"lessonCount"` // 有進度紀錄的課數
	Completed   int        `json:"completed"`   // 其中看完的課數
	WatchedMs   int64      `json:"watchedMs"`   // 各課目前位置加總
	LastActive  *time.Time `json:"lastActive"`  // 最近一次儲存進度的時間;從未看過為 null
}

// LessonStat 是單一課的整體統計。
type LessonStat struct {
	Lesson     string  `json:"lesson"`
	Learners   int     `json:"learners"`   // 有進度紀錄的會員數
	Completed  int     `json:"completed"`  // 看完的會員數
	AvgPercent float64 `json:"avgPercent"` // 平均觀看百分比(0–100)
	// 訪客(未登入)的紀錄,見 guest.go
	GuestViews     int   `json:"guestViews"`     // 訪客打開這一課的次數
	GuestVisitors  int   `json:"guestVisitors"`  // 打開過這一課的訪客數(不同的訪客代號)
	GuestWatchedMs int64 `json:"guestWatchedMs"` // 訪客在這一課累計的播放時間
}

// AdminOverview 是儀表板的總覽數字。
type AdminOverview struct {
	Users       int          `json:"users"`
	ActiveUsers int          `json:"activeUsers"` // 至少有一筆進度的會員數
	Guests      int          `json:"guests"`      // 保存期間內有紀錄的訪客數(不同的訪客代號)
	Lessons     []LessonStat `json:"lessons"`
}

func isCompleted(p progressRow) bool {
	return p.DurationMs > 0 && float64(p.PositionMs) >= float64(p.DurationMs)*completedRatio
}

// AdminUsers 回傳所有使用者與其進度概況,最近註冊的在前。
func (s *Store) AdminUsers(ctx context.Context) ([]AdminUser, error) {
	var users []userRow
	if err := s.db.WithContext(ctx).Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, err
	}
	var rows []progressRow
	if err := s.db.WithContext(ctx).Find(&rows).Error; err != nil {
		return nil, err
	}
	byUser := make(map[string]*AdminUser, len(users))
	out := make([]AdminUser, len(users))
	for i, u := range users {
		out[i] = AdminUser{User: u.toUser()}
		byUser[u.ID] = &out[i]
	}
	for _, p := range rows {
		u := byUser[p.UserID]
		if u == nil {
			continue
		}
		u.LessonCount++
		if isCompleted(p) {
			u.Completed++
		}
		u.WatchedMs += int64(p.PositionMs)
		if u.LastActive == nil || p.UpdatedAt.After(*u.LastActive) {
			t := p.UpdatedAt
			u.LastActive = &t
		}
	}
	return out, nil
}

// AdminOverview 回傳會員數與各課統計(學習人數多的在前,再來是訪客打開次數)。
func (s *Store) AdminOverview(ctx context.Context) (AdminOverview, error) {
	var total int64
	if err := s.db.WithContext(ctx).Model(&userRow{}).Count(&total).Error; err != nil {
		return AdminOverview{}, err
	}
	var rows []progressRow
	if err := s.db.WithContext(ctx).Find(&rows).Error; err != nil {
		return AdminOverview{}, err
	}
	var views []guestViewRow
	if err := s.db.WithContext(ctx).Find(&views).Error; err != nil {
		return AdminOverview{}, err
	}
	type acc struct {
		learners, completed, measured int // measured:知道總長的紀錄數(平均進度只算這些)
		percent                       float64
		guestViews                    int
		guestWatched                  int64
		guests                        map[string]bool
	}
	lessons := map[string]*acc{}
	lessonOf := func(name string) *acc {
		a := lessons[name]
		if a == nil {
			a = &acc{guests: map[string]bool{}}
			lessons[name] = a
		}
		return a
	}
	active := map[string]bool{}
	for _, p := range rows {
		active[p.UserID] = true
		a := lessonOf(p.Lesson)
		a.learners++
		if isCompleted(p) {
			a.completed++
		}
		if p.DurationMs > 0 {
			a.measured++
			ratio := float64(p.PositionMs) / float64(p.DurationMs)
			if ratio > 1 {
				ratio = 1
			}
			a.percent += ratio * 100
		}
	}
	guests := map[string]bool{}
	for _, v := range views {
		guests[v.GuestID] = true
		a := lessonOf(v.Lesson)
		a.guestViews++
		a.guestWatched += int64(v.WatchedMs)
		a.guests[v.GuestID] = true
	}
	stats := make([]LessonStat, 0, len(lessons))
	for name, a := range lessons {
		avg := 0.0
		if a.measured > 0 {
			avg = a.percent / float64(a.measured)
		}
		stats = append(stats, LessonStat{
			Lesson: name, Learners: a.learners, Completed: a.completed, AvgPercent: avg,
			GuestViews: a.guestViews, GuestVisitors: len(a.guests), GuestWatchedMs: a.guestWatched,
		})
	}
	sort.Slice(stats, func(i, j int) bool {
		if stats[i].Learners != stats[j].Learners {
			return stats[i].Learners > stats[j].Learners
		}
		if stats[i].GuestViews != stats[j].GuestViews {
			return stats[i].GuestViews > stats[j].GuestViews
		}
		return stats[i].Lesson < stats[j].Lesson
	})
	return AdminOverview{Users: int(total), ActiveUsers: len(active), Guests: len(guests), Lessons: stats}, nil
}
