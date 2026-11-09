package store

import (
	"context"
	"encoding/json"
	"sort"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
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

// PathStep 是路徑上的一站:打開的頁面或課(lesson,同 guest_views.lesson),這一站有沒有播放。
type PathStep struct {
	Lesson string `json:"lesson"`
	Played bool   `json:"played"`
}

// PathCount 是一條路徑與走過的次數。Played 是其中有播放過任何東西的次數。
type PathCount struct {
	Steps  []PathStep `json:"steps"`
	Count  int        `json:"count"`
	Played int        `json:"played"`
}

const (
	// pathSessionGap:同一位訪客兩次打開之間超過這麼久,算成另一次造訪
	pathSessionGap = 30 * time.Minute
	// maxPathSteps:路徑最多列幾站(之後的合併成「…」)
	maxPathSteps = 6
	// maxPaths:後台列出最常見的幾條路徑
	maxPaths = 20
	homePage = PagePrefix + "/"
)

// homePaths 把每位訪客的紀錄依時間串成一次次造訪,只看從首頁進來的(造訪的第一站是首頁),
// 統計走過的路徑:首頁 → 課程地圖 → 某一課(有沒有播放)…。爬蟲與沒有裝置資料的舊紀錄不算。
func homePaths(views []guestViewRow) (top []PathCount, total int) {
	byGuest := map[string][]guestViewRow{}
	for _, v := range views {
		if v.Device == "" || v.Device == DeviceBot {
			continue
		}
		byGuest[v.GuestID] = append(byGuest[v.GuestID], v)
	}
	type acc struct {
		steps         []PathStep
		count, played int
	}
	paths := map[string]*acc{}
	// last 是這次造訪的最後一筆:看它的足跡怎麼結束(關掉頁面記成 exit;換到沒有記錄的頁面,例如登入頁,記成 leave:<網址>)
	add := func(steps []PathStep, last guestViewRow) {
		if len(steps) == 0 || steps[0].Lesson != homePage {
			return
		}
		if ev := parseEvents(last.Events); len(ev) > 0 {
			switch e := ev[len(ev)-1].E; {
			case e == "close":
				steps = append(steps, PathStep{Lesson: "exit"})
			case strings.HasPrefix(e, "leave:"):
				steps = append(steps, PathStep{Lesson: e})
			}
		}
		played := false
		for _, s := range steps {
			played = played || s.Played
		}
		if len(steps) > maxPathSteps {
			steps = append(steps[:maxPathSteps:maxPathSteps], PathStep{Lesson: "…"})
		}
		b, _ := json.Marshal(steps)
		a := paths[string(b)]
		if a == nil {
			a = &acc{steps: steps}
			paths[string(b)] = a
		}
		a.count++
		total++
		if played {
			a.played++
		}
	}
	for _, list := range byGuest {
		sort.Slice(list, func(i, j int) bool { return list[i].OpenedAt.Before(list[j].OpenedAt) })
		var steps []PathStep
		var lastActive time.Time
		var prev guestViewRow
		for _, v := range list {
			if len(steps) > 0 && v.OpenedAt.Sub(lastActive) > pathSessionGap {
				add(steps, prev)
				steps = nil
			}
			prev = v
			step := PathStep{Lesson: v.Lesson, Played: v.WatchedMs > 0}
			// 同一頁連續記了兩筆(例如重新整理)只算一站
			if n := len(steps); n > 0 && steps[n-1].Lesson == step.Lesson {
				steps[n-1].Played = steps[n-1].Played || step.Played
			} else {
				steps = append(steps, step)
			}
			if v.UpdatedAt.After(lastActive) {
				lastActive = v.UpdatedAt
			}
			if v.OpenedAt.After(lastActive) {
				lastActive = v.OpenedAt
			}
		}
		add(steps, prev)
	}
	out := make([]PathCount, 0, len(paths))
	for _, a := range paths {
		out = append(out, PathCount{Steps: a.steps, Count: a.count, Played: a.played})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return len(out[i].Steps) < len(out[j].Steps)
	})
	if len(out) > maxPaths {
		out = out[:maxPaths]
	}
	return out, total
}

// maxIdleVisits 是後台列出幾筆最近沒播放的造訪。
const maxIdleVisits = 30

// maxHomeStays:後台「首頁停留時間」最多列幾個訪客。
const maxHomeStays = 50

// homeGuestIDLen:後台只顯示訪客代號的前幾碼(夠分辨不同人,又不會整串外流)。
const homeGuestIDLen = 8

// HomeStay 是一個訪客在首頁(page:/)的停留:停留時間是頁面在前景的時間。
type HomeStay struct {
	Guest      string    `json:"guest"`      // 訪客代號的前 homeGuestIDLen 碼
	Device     string    `json:"device"`     // 最近一次造訪的裝置
	Source     string    `json:"source"`     // 最近一次造訪的來源
	Visits     int       `json:"visits"`     // 打開首頁幾次
	TotalMs    int64     `json:"totalMs"`    // 首頁停留合計
	LongestMs  int       `json:"longestMs"`  // 最長的一次
	MaxScroll  int       `json:"maxScroll"`  // 捲到最深的百分比(25 的倍數;沒捲動是 0)
	LastOpened time.Time `json:"lastOpened"` // 最後一次打開首頁
}

// homeStays 依訪客彙整首頁的停留時間(不含爬蟲與沒有裝置資料的舊紀錄)。
func homeStays(views []guestViewRow) []HomeStay {
	byGuest := map[string]*HomeStay{}
	for _, v := range views {
		if v.Lesson != PagePrefix+"/" || v.Device == "" || v.Device == DeviceBot {
			continue
		}
		h := byGuest[v.GuestID]
		if h == nil {
			id := v.GuestID
			if len(id) > homeGuestIDLen {
				id = id[:homeGuestIDLen]
			}
			h = &HomeStay{Guest: id}
			byGuest[v.GuestID] = h
		}
		h.Visits++
		h.TotalMs += int64(v.VisibleMs)
		if v.VisibleMs > h.LongestMs {
			h.LongestMs = v.VisibleMs
		}
		for _, e := range parseEvents(v.Events) {
			rest, ok := strings.CutPrefix(e.E, "scroll:")
			if !ok {
				continue
			}
			if pct, err := strconv.Atoi(strings.TrimSuffix(rest, "%")); err == nil && pct > h.MaxScroll {
				h.MaxScroll = pct
			}
		}
		if !v.OpenedAt.Before(h.LastOpened) {
			h.LastOpened, h.Device, h.Source = v.OpenedAt, v.Device, v.Source
		}
	}
	out := make([]HomeStay, 0, len(byGuest))
	for _, h := range byGuest {
		out = append(out, *h)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].LastOpened.After(out[j].LastOpened) })
	if len(out) > maxHomeStays {
		out = out[:maxHomeStays]
	}
	return out
}

// GuestBreakdown 是訪客紀錄(有裝置資料的)的分類統計。
type GuestBreakdown struct {
	Devices []Count `json:"devices"` // 每種裝置打開幾次(含爬蟲)
	Sources []Count `json:"sources"` // 真人從哪裡進站(最多 10 個)
	Errors  []Count `json:"errors"`  // 真人遇到的載入錯誤(最多 10 個)
	// 真人打開後沒有播放的,依頁面在前景的時間分組:不到 10 秒、10–60 秒、超過 1 分鐘
	IdleVisible []Count `json:"idleVisible"`
	// 最近沒有播放的真人造訪(含登入門檻),新的在前,最多 maxIdleVisits 筆
	IdleVisits []GuestVisit `json:"idleVisits"`
	// 從首頁進來的造訪走過的路徑,最常見的在前,最多 maxPaths 條
	HomePaths []PathCount `json:"homePaths"`
	// 從首頁進來的造訪次數
	HomeVisits int `json:"homeVisits"`
	// 每個真人訪客在首頁停留多久,最近來過的在前,最多 maxHomeStays 人
	HomeStays []HomeStay `json:"homeStays"`
	// 訪客打開登入／註冊頁的次數與結果
	Login LoginStats `json:"login"`
}

// LoginStats 是訪客打開登入／註冊頁(store.LoginPage)的統計:結果、想去哪一課、登入失敗的訊息。
type LoginStats struct {
	Visits int `json:"visits"` // 真人打開幾次
	// 結果:signin(Email 登入)、register(Email 註冊)、google(Google 登入)、failed(試過但失敗,最後沒有登入)、left(沒有登入就離開)
	Outcomes []Count `json:"outcomes"`
	Next     []Count `json:"next"`  // 登入後要回到哪裡(登入頁的 next 參數;直接打開登入頁是 /)
	Fails    []Count `json:"fails"` // 登入或註冊失敗時看到的訊息
	// Google 登入按鈕:畫好幾次、從打開登入頁到畫好的平均毫秒、載入失敗幾次與原因(有設定 Google 登入時才有)
	GoogleReady      int     `json:"googleReady"`
	GoogleReadyAvgMs int64   `json:"googleReadyAvgMs"`
	GoogleFailed     int     `json:"googleFailed"`
	GoogleErrors     []Count `json:"googleErrors"`
}

// loginStats 統計真人打開登入頁的紀錄。結果由伺服器在登入成功時記(Outcome);沒有結果的看足跡:有失敗訊息(fail:)算 failed,否則 left。
func loginStats(views []guestViewRow) LoginStats {
	st := LoginStats{}
	outcomes, next, fails, googleErrs := map[string]int{}, map[string]int{}, map[string]int{}, map[string]int{}
	var readySum int64
	for _, v := range views {
		if v.Lesson != LoginPage || v.Device == "" || v.Device == DeviceBot {
			continue
		}
		st.Visits++
		if v.ReadyMs > 0 {
			st.GoogleReady++
			readySum += int64(v.ReadyMs)
		}
		if v.LoadError != "" {
			st.GoogleFailed++
			googleErrs[v.LoadError]++
		}
		failed := false
		to := "/"
		for _, e := range parseEvents(v.Events) {
			switch {
			case strings.HasPrefix(e.E, "fail:"):
				failed = true
				fails[strings.TrimPrefix(e.E, "fail:")]++
			case strings.HasPrefix(e.E, "next:"):
				to = strings.TrimPrefix(e.E, "next:")
			}
		}
		next[to]++
		switch {
		case v.Outcome != "":
			outcomes[v.Outcome]++
		case failed:
			outcomes["failed"]++
		default:
			outcomes["left"]++
		}
	}
	st.Outcomes = topCounts(outcomes, 0)
	st.Next = topCounts(next, 10)
	st.Fails = topCounts(fails, 10)
	st.GoogleReadyAvgMs = avgOf(readySum, st.GoogleReady)
	st.GoogleErrors = topCounts(googleErrs, 10)
	return st
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
// since 不是零值時只列出這段時間內註冊或有播放的會員,課數、播放時間也只算這段時間內更新過的進度。
func (s *Store) AdminUsers(ctx context.Context, since time.Time) ([]AdminUser, error) {
	var users []userRow
	if err := s.db.WithContext(ctx).Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, err
	}
	var rows []progressRow
	if err := sinceScope(s.db.WithContext(ctx), "updated_at", since).Find(&rows).Error; err != nil {
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
	if since.IsZero() {
		return out, nil
	}
	kept := out[:0]
	for _, u := range out {
		if u.LessonCount > 0 || !u.CreatedAt.Before(since) {
			kept = append(kept, u)
		}
	}
	return kept, nil
}

// sinceScope:since 不是零值時只取 col >= since 的資料。
// 時間一律存成 UTC(now());SQLite 的時間是文字、比對是比字串,since 也要換成 UTC 才比得準。
func sinceScope(db *gorm.DB, col string, since time.Time) *gorm.DB {
	if since.IsZero() {
		return db
	}
	return db.Where(col+" >= ?", since.UTC())
}

// AdminOverview 回傳會員數與各課統計(學習人數多的在前,再來是訪客打開次數)。
// since 不是零值時只算這段時間內的資料:會員數是這段時間內註冊的,進度看更新時間,訪客紀錄看打開時間。
func (s *Store) AdminOverview(ctx context.Context, since time.Time) (AdminOverview, error) {
	var total int64
	if err := sinceScope(s.db.WithContext(ctx).Model(&userRow{}), "created_at", since).Count(&total).Error; err != nil {
		return AdminOverview{}, err
	}
	var rows []progressRow
	if err := sinceScope(s.db.WithContext(ctx), "updated_at", since).Find(&rows).Error; err != nil {
		return AdminOverview{}, err
	}
	var views []guestViewRow
	if err := sinceScope(s.db.WithContext(ctx), "opened_at", since).Find(&views).Error; err != nil {
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
		// 首頁、課程地圖不是課:不算進各課概況、漏斗與裝置／來源分布(它們的去向看 HomePaths)
		if strings.HasPrefix(v.Lesson, PagePrefix) {
			continue
		}
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
	home, homeVisits := homePaths(views)
	breakdown := GuestBreakdown{
		IdleVisits: idleVisits,
		HomePaths:  home,
		HomeVisits: homeVisits,
		HomeStays:  homeStays(views),
		Login:      loginStats(views),
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
