package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
)

// 訪客的上課紀錄:未登入的人每打開一課記一筆(點選課程的時間),播放時累計實際播放的時間。
// 訪客只用 evoleap_guest cookie 裡的隨機代號區分,不連到任何帳號;超過 GuestRetention 的紀錄會刪掉。
// 為了看出「打開了卻沒有播放」的原因,另外記:裝置類型(由 User-Agent 判斷的分類,不存原始字串)、進站來源(只存網域)、
// 播放器多久載入完成、載入失敗的訊息、頁面在前景的時間,以及這次造訪的足跡(Events:點了哪個按鈕、捲動、切到別的分頁、離開到哪一頁)。

// GuestRetention 是訪客紀錄保存的期間(也是訪客 cookie 的有效期間)。
const GuestRetention = 180 * 24 * time.Hour

// PagePrefix 是首頁、課程地圖這類不是單課的頁面紀錄(lesson 為 page:<網址>,前端 guestActivity.ts 的 PAGE_PREFIX)
const PagePrefix = "page:"

// LoginPage 是訪客打開登入／註冊頁的紀錄(前端 auth/LoginPage.tsx)
const LoginPage = PagePrefix + "/login"

// 登入頁紀錄的結果(Outcome):在這一頁用 Email 登入、Email 註冊、Google 登入成功
const (
	LoginSignIn   = "signin"
	LoginRegister = "register"
	LoginGoogle   = "google"
)

// GuestView 是訪客打開一課的一筆紀錄。
type GuestView struct {
	ID        string       `json:"id"`
	GuestID   string       `json:"guestId"`
	Lesson    string       `json:"lesson"`
	WatchedMs int          `json:"watchedMs"`
	Device    string       `json:"device"`
	Source    string       `json:"source"`
	ReadyMs   int          `json:"readyMs"`
	LoadError string       `json:"loadError"`
	VisibleMs int          `json:"visibleMs"`
	Events    []GuestEvent `json:"events"`
	OpenedAt  time.Time    `json:"openedAt"`
	UpdatedAt time.Time    `json:"updatedAt"`
}

// GuestEvent 是造訪足跡裡的一件事:T 是打開後第幾毫秒,E 是事件代碼(ready、error、click:<按鈕名稱>、scroll:<百分比>、hide、show、play、pause、leave:<網址>、close,見 web/src/courses/guestActivity.ts)。
type GuestEvent struct {
	T int    `json:"t"`
	E string `json:"e"`
}

// MaxGuestEvents 是一筆紀錄最多存幾件事;MaxGuestEventLen 是事件代碼最多幾個字。
const (
	MaxGuestEvents   = 40
	MaxGuestEventLen = 80
)

// 裝置類型(GuestView.Device);空字串是加上這個欄位以前的舊紀錄。
const (
	DeviceBot     = "bot"
	DeviceMobile  = "mobile"
	DeviceTablet  = "tablet"
	DeviceDesktop = "desktop"
)

// 進站來源(GuestView.Source)除了網域以外的兩種值;空字串是加上這個欄位以前的舊紀錄。
const (
	SourceDirect = "direct" // 沒有來源(直接輸入網址、書籤、App 內開啟)
	SourceSelf   = "self"   // 從本站其他頁面進來
)

// GuestMeta 是打開一課時一起記下的資料。
type GuestMeta struct {
	Device string
	Source string
}

// GuestReport 是播放時回報的資料:WatchedMs、VisibleMs 只會變多;ReadyMs、LoadError 只記第一次(0／空字串表示這次沒有)。
// Events 是到目前為止的整份足跡(前端只會往後加),比存著的長才換上去(晚到的舊資料不會蓋掉新的)。
type GuestReport struct {
	WatchedMs int
	VisibleMs int
	ReadyMs   int
	LoadError string
	Events    []GuestEvent
}

type guestViewRow struct {
	ID        string `gorm:"primaryKey;size:32"`
	GuestID   string `gorm:"index;size:32;not null"`
	Lesson    string `gorm:"size:200;not null"`
	WatchedMs int    `gorm:"not null"`
	Device    string `gorm:"size:16;not null;default:''"`
	Source    string `gorm:"size:100;not null;default:''"`
	ReadyMs   int    `gorm:"not null;default:0"`
	LoadError string `gorm:"size:200;not null;default:''"`
	VisibleMs int    `gorm:"not null;default:0"`
	Events    string `gorm:"type:text;not null;default:''"`
	// Outcome:登入頁的紀錄才有,在這一頁登入或註冊成功時由伺服器記下(LoginSignIn 等);只記結果,不記帳號
	Outcome   string    `gorm:"size:16;not null;default:''"`
	OpenedAt  time.Time `gorm:"index"`
	UpdatedAt time.Time
}

func (guestViewRow) TableName() string { return "guest_views" }

func (r guestViewRow) toView() GuestView {
	return GuestView{
		ID: r.ID, GuestID: r.GuestID, Lesson: r.Lesson, WatchedMs: r.WatchedMs,
		Device: r.Device, Source: r.Source, ReadyMs: r.ReadyMs, LoadError: r.LoadError, VisibleMs: r.VisibleMs,
		Events: parseEvents(r.Events), OpenedAt: r.OpenedAt, UpdatedAt: r.UpdatedAt,
	}
}

func parseEvents(s string) []GuestEvent {
	out := []GuestEvent{}
	if s != "" {
		_ = json.Unmarshal([]byte(s), &out) // 壞掉的資料當成沒有
	}
	return out
}

// NewGuestID 產生訪客代號(隨機 32 位十六進位字元)。
func NewGuestID() string { return newID() + newID()[:8] }

// OpenGuestView 記一筆「訪客打開了這一課」,回傳這筆紀錄的編號(之後用它累計播放時間)。
func (s *Store) OpenGuestView(ctx context.Context, guestID, lesson string, meta GuestMeta) (string, error) {
	t := now()
	row := guestViewRow{ID: NewGuestID(), GuestID: guestID, Lesson: lesson, Device: meta.Device, Source: meta.Source, OpenedAt: t, UpdatedAt: t}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return "", err
	}
	return row.ID, nil
}

// ReportGuestView 更新這筆紀錄:播放時間、前景時間只會變多(重送或順序錯亂的舊值不會蓋掉新的);
// 載入時間與載入錯誤只記第一次。紀錄不存在或不屬於這位訪客時回 ErrNotFound。
func (s *Store) ReportGuestView(ctx context.Context, guestID, viewID string, rep GuestReport) error {
	// SQLite 與 Postgres 的取大值函式不同(max／GREATEST),用 CASE 兩邊都能跑
	fields := map[string]any{
		"watched_ms": gorm.Expr("CASE WHEN watched_ms < ? THEN ? ELSE watched_ms END", rep.WatchedMs, rep.WatchedMs),
		"visible_ms": gorm.Expr("CASE WHEN visible_ms < ? THEN ? ELSE visible_ms END", rep.VisibleMs, rep.VisibleMs),
		"updated_at": now(),
	}
	if rep.ReadyMs > 0 {
		fields["ready_ms"] = gorm.Expr("CASE WHEN ready_ms = 0 THEN ? ELSE ready_ms END", rep.ReadyMs)
	}
	if rep.LoadError != "" {
		fields["load_error"] = gorm.Expr("CASE WHEN load_error = '' THEN ? ELSE load_error END", rep.LoadError)
	}
	if len(rep.Events) > 0 {
		b, err := json.Marshal(rep.Events)
		if err != nil {
			return err
		}
		// 足跡只會往後加:比存著的長才換(SQLite 與 Postgres 的 length 都算字數)
		fields["events"] = gorm.Expr("CASE WHEN length(events) < ? THEN ? ELSE events END", utf8.RuneCount(b), string(b))
	}
	res := s.db.WithContext(ctx).Model(&guestViewRow{}).
		Where("id = ? AND guest_id = ?", viewID, guestID).
		Updates(fields)
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

// noteLoginWindow:登入成功時,只把結果記在這段時間內打開的登入頁紀錄上(太久以前打開的不算這一次)
const noteLoginWindow = 6 * time.Hour

// NoteGuestLogin 在這位訪客最近一次打開登入頁的紀錄記下登入／註冊成功(outcome 是 LoginSignIn 等)。
// 登入後瀏覽器就是會員,前端不能再回報訪客紀錄,所以由登入的端點記。只記結果,不記是哪個帳號。沒有符合的紀錄時什麼都不做。
func (s *Store) NoteGuestLogin(ctx context.Context, guestID, outcome string) error {
	var row guestViewRow
	err := s.db.WithContext(ctx).
		Where("guest_id = ? AND lesson = ? AND opened_at > ?", guestID, LoginPage, now().Add(-noteLoginWindow)).
		Order("opened_at desc").First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Model(&guestViewRow{}).Where("id = ?", row.ID).Updates(map[string]any{"outcome": outcome, "updated_at": now()}).Error
}
