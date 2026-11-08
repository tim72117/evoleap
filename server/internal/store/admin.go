package store

import (
	"context"
	"sort"
	"strings"
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
	// 訪客漏斗:只算有裝置資料的紀錄(加上這些欄位之後的),爬蟲另外算、不進漏斗
	GuestBots    int `json:"guestBots"`    // 爬蟲、自動化瀏覽器打開的次數
	GuestTracked int `json:"guestTracked"` // 真人打開的次數(漏斗的第一層)
	GuestReady   int `json:"guestReady"`   // 其中播放器載入完成的
	GuestFailed  int `json:"guestFailed"`  // 其中載入失敗的
	GuestPlayed  int `json:"guestPlayed"`  // 其中有播放的
	// 真人打開卻沒播放的紀錄,頁面平均在前景多久(ms)
	GuestIdleVisibleMs int64 `json:"guestIdleVisibleMs"`
	// 載入完成平均花多久(ms)
	GuestReadyAvgMs int64 `json:"guestReadyAvgMs"`
}

// Count 是一個分類與它的筆數(裝置、來源、錯誤訊息)。
type Count struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// GuestVisit 是一次沒有播放的造訪(後台看這些人在頁面上做了什麼)。
type GuestVisit struct {
	Lesson    string       `json:"lesson"`
	Device    string       `json:"device"`
	Source    string       `json:"source"`
	ReadyMs   int          `json:"readyMs"`
	LoadError string       `json:"loadError"`
	VisibleMs int          `json:"visibleMs"`
	Events    []GuestEvent `json:"events"`
	OpenedAt  time.Time    `json:"openedAt"`
}

// maxIdleVisits 是後台列出幾筆最近沒播放的造訪。
const maxIdleVisits = 30

// GuestBreakdown 是訪客紀錄(有裝置資料的)的分類統計。
type GuestBreakdown struct {
	Devices []Count `json:"devices"` // 每種裝置打開幾次(含爬蟲)
	Sources []Count `json:"sources"` // 真人從哪裡進站(最多 10 個)
	Errors  []Count `json:"errors"`  // 真人遇到的載入錯誤(最多 10 個)
	// 真人打開後沒有播放的,依頁面在前景的時間分組:不到 10 秒、10–60 秒、超過 1 分鐘
	IdleVisible []Count `json:"idleVisible"`
	// 最近沒有播放的真人造訪(含登入門檻),新的在前,最多 maxIdleVisits 筆
	IdleVisits []GuestVisit `json:"idleVisits"`
}

// AdminOverview 是儀表板的總覽數字。
type AdminOverview struct {
	Users       int            `json:"users"`
	ActiveUsers int            `json:"activeUsers"` // 至少有一筆進度的會員數
	Guests      int            `json:"guests"`      // 保存期間內有紀錄的訪客數(不同的訪客代號)
	Lessons     []LessonStat   `json:"lessons"`
	GuestStats  GuestBreakdown `json:"guestStats"`
}

// topCounts 依筆數由多到少排好,最多留 limit 個(limit <= 0 不限)。
func topCounts(m map[string]int, limit int) []Count {
	out := make([]Count, 0, len(m))
	for k, v := range m {
		out = append(out, Count{Name: k, Count: v})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Name < out[j].Name
	})
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out
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
		bots, tracked, ready, failed  int
		played, idle                  int
		idleVisible, readySum         int64
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
	idleVisits := []GuestVisit{}
	devices, sources, errs := map[string]int{}, map[string]int{}, map[string]int{}
	idleBuckets := map[string]int{}
	for _, v := range views {
		guests[v.GuestID] = true
		a := lessonOf(v.Lesson)
		a.guestViews++
		a.guestWatched += int64(v.WatchedMs)
		a.guests[v.GuestID] = true
		if v.Device == "" { // 舊紀錄沒有漏斗資料
			continue
		}
		devices[v.Device]++
		if v.Device == DeviceBot {
			a.bots++
			continue
		}
		a.tracked++
		if v.Source != "" {
			sources[v.Source]++
		}
		if v.ReadyMs > 0 {
			a.ready++
			a.readySum += int64(v.ReadyMs)
		}
		if v.LoadError != "" {
			a.failed++
			errs[v.LoadError]++
		}
		if v.WatchedMs > 0 {
			a.played++
			continue
		}
		a.idle++
		a.idleVisible += int64(v.VisibleMs)
		idleVisits = append(idleVisits, GuestVisit{
			Lesson: v.Lesson, Device: v.Device, Source: v.Source, ReadyMs: v.ReadyMs, LoadError: v.LoadError,
			VisibleMs: v.VisibleMs, Events: parseEvents(v.Events), OpenedAt: v.OpenedAt,
		})
		// 登入門檻頁沒有播放器,不算進「沒播放的人待了多久」
		if strings.HasPrefix(v.Lesson, "gate:") {
			continue
		}
		switch {
		case v.VisibleMs < 10_000:
			idleBuckets["under10s"]++
		case v.VisibleMs < 60_000:
			idleBuckets["10to60s"]++
		default:
			idleBuckets["over60s"]++
		}
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
			GuestBots: a.bots, GuestTracked: a.tracked, GuestReady: a.ready, GuestFailed: a.failed, GuestPlayed: a.played,
			GuestIdleVisibleMs: avgOf(a.idleVisible, a.idle), GuestReadyAvgMs: avgOf(a.readySum, a.ready),
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
	sort.Slice(idleVisits, func(i, j int) bool { return idleVisits[i].OpenedAt.After(idleVisits[j].OpenedAt) })
	if len(idleVisits) > maxIdleVisits {
		idleVisits = idleVisits[:maxIdleVisits]
	}
	breakdown := GuestBreakdown{
		IdleVisits: idleVisits,
		Devices:    topCounts(devices, 0),
		Sources:    topCounts(sources, 10),
		Errors:     topCounts(errs, 10),
		IdleVisible: []Count{
			{Name: "under10s", Count: idleBuckets["under10s"]},
			{Name: "10to60s", Count: idleBuckets["10to60s"]},
			{Name: "over60s", Count: idleBuckets["over60s"]},
		},
	}
	return AdminOverview{Users: int(total), ActiveUsers: len(active), Guests: len(guests), Lessons: stats, GuestStats: breakdown}, nil
}

func avgOf(sum int64, n int) int64 {
	if n == 0 {
		return 0
	}
	return sum / int64(n)
}
