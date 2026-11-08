package api

import (
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/tim72117/evoleap/internal/store"
)

// 訪客的上課紀錄(未登入的人):打開一課(或按下播放首頁的展示影片,lesson 以 home: 開頭;看到登入門檻時 gate: 開頭;打開首頁、課程地圖時 page: 開頭)時 POST /api/guest/views 記一筆,
// 播放時 PUT /api/guest/views/{id} 回報累計的播放時間、頁面在前景的時間、播放器載入完成的時間或載入錯誤。
// 打開時另外記裝置類型(由 User-Agent 分類,爬蟲標成 bot)與進站來源(前端傳的 document.referrer,只留網域)。
// 訪客代號放在 evoleap_guest cookie(HttpOnly,伺服器第一次記錄時發給瀏覽器),只用來把同一個瀏覽器的紀錄串在一起,不連到帳號。
// 已登入的會員不記在這裡(會員有自己的播放進度),兩個端點對會員一律回 204、什麼都不做。
// 例外:訪客在登入頁登入或註冊成功時,auth.go 的 noteGuestLogin 在這位訪客的登入頁紀錄記下結果(只記結果,不記帳號)。

const guestCookie = "evoleap_guest"

// guestPruneEvery 是清理過期訪客紀錄的最短間隔:在記錄新的一筆時順手清,不另外排程。
const guestPruneEvery = time.Hour

// guestOpenLimit 是每個來源 IP 每分鐘可記錄幾次「打開一課」,擋住灌資料的請求(和登入限流一樣只在有設定 AuthRateLimit 時啟用)。
const guestOpenLimit = 60

var guestIDPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)

// 爬蟲與自動化瀏覽器的 User-Agent(會執行 JavaScript、會打開課程頁,但不會按播放)
var botUA = regexp.MustCompile(`(?i)bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|bingpreview|python|curl|wget|httpclient|phantom|puppeteer|playwright|selenium|scrapy|go-http`)

// maxLoadErrorLen 是載入錯誤訊息最多存幾個字(超過截斷)。
const maxLoadErrorLen = 200

// deviceOf 把 User-Agent 分成爬蟲、手機、平板、桌機;只存分類,不存原始字串。
func deviceOf(ua string) string {
	l := strings.ToLower(ua)
	switch {
	case ua == "" || botUA.MatchString(ua):
		return store.DeviceBot
	case strings.Contains(l, "ipad") || strings.Contains(l, "tablet") || (strings.Contains(l, "android") && !strings.Contains(l, "mobile")):
		return store.DeviceTablet
	case strings.Contains(l, "mobi") || strings.Contains(l, "iphone") || strings.Contains(l, "android"):
		return store.DeviceMobile
	default:
		return store.DeviceDesktop
	}
}

// sourceOf 把前端回報的 document.referrer 換成進站來源:只留網域(去掉 www.);空的是直接進入,本站是 self。
func sourceOf(referrer, host string) string {
	if strings.TrimSpace(referrer) == "" {
		return store.SourceDirect
	}
	u, err := url.Parse(referrer)
	if err != nil || u.Hostname() == "" {
		return store.SourceDirect
	}
	h := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	self := strings.TrimPrefix(strings.ToLower(host), "www.")
	if i := strings.LastIndex(self, ":"); i >= 0 && !strings.Contains(self, "]") {
		self = self[:i]
	}
	if h == self {
		return store.SourceSelf
	}
	if len(h) > 100 {
		h = h[:100]
	}
	return h
}

// truncateRunes 截斷成最多 n 個字。
func truncateRunes(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}

// guestPruner 記住上次清理的時間,避免每一筆都去刪。
type guestPruner struct {
	mu   sync.Mutex
	last time.Time
}

func (p *guestPruner) due(now time.Time) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if now.Sub(p.last) < guestPruneEvery {
		return false
	}
	p.last = now
	return true
}

// guestID 讀出 cookie 裡的訪客代號;沒有或格式不對時回空字串。
func guestID(r *http.Request) string {
	c, err := r.Cookie(guestCookie)
	if err != nil || !guestIDPattern.MatchString(c.Value) {
		return ""
	}
	return c.Value
}

func (s *Server) guestCookie(id string) *http.Cookie {
	return &http.Cookie{
		Name:     guestCookie,
		Value:    id,
		Path:     "/",
		MaxAge:   int(store.GuestRetention.Seconds()),
		HttpOnly: true,
		Secure:   s.cfg.SecureCookie,
		SameSite: http.SameSiteLaxMode,
	}
}

// isMember:帶著有效的登入 cookie(會員的紀錄不記在訪客這裡)。
func (s *Server) isMember(r *http.Request) bool {
	_, ok := s.currentUser(r)
	return ok
}

func (s *Server) handleGuestOpen(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Lesson string `json:"lesson"`
		// From 是前端的 document.referrer(進站來源),伺服器只留網域
		From string `json:"from"`
	}
	if !decode(w, r, &req) {
		return
	}
	req.Lesson = strings.TrimSpace(req.Lesson)
	if req.Lesson == "" || utf8.RuneCountInString(req.Lesson) > maxLessonLen {
		writeError(w, http.StatusBadRequest, "invalid_lesson", "課程資料不正確")
		return
	}
	if s.isMember(r) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if s.guestOpen != nil && !s.guestOpen.allow(clientIP(r)) {
		writeRateLimited(w)
		return
	}
	id := guestID(r)
	if id == "" {
		id = store.NewGuestID()
		http.SetCookie(w, s.guestCookie(id))
	}
	meta := store.GuestMeta{Device: deviceOf(r.UserAgent()), Source: sourceOf(req.From, r.Host)}
	viewID, err := s.cfg.Store.OpenGuestView(r.Context(), id, req.Lesson, meta)
	if err != nil {
		internalError(w, err)
		return
	}
	if s.prune.due(time.Now()) {
		// 清理失敗不影響這次記錄,下次再試
		_, _ = s.cfg.Store.PruneGuestViews(r.Context(), time.Now().Add(-store.GuestRetention))
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": viewID})
}

func (s *Server) handleGuestWatch(w http.ResponseWriter, r *http.Request) {
	var req struct {
		WatchedMs int `json:"watchedMs"`
		// 以下是找出「打開了卻沒有播放」原因用的:頁面在前景的時間、播放器多久載入完成、載入失敗的訊息
		VisibleMs int    `json:"visibleMs"`
		ReadyMs   int    `json:"readyMs"`
		Error     string `json:"error"`
		// 這次造訪到目前為止的足跡(只會往後加)
		Events []store.GuestEvent `json:"events"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.WatchedMs < 0 || req.WatchedMs > maxMs || req.VisibleMs < 0 || req.VisibleMs > maxMs || req.ReadyMs < 0 || req.ReadyMs > maxMs {
		writeError(w, http.StatusBadRequest, "invalid_watched", "播放時間不正確")
		return
	}
	if len(req.Events) > store.MaxGuestEvents {
		req.Events = req.Events[:store.MaxGuestEvents]
	}
	for i := range req.Events {
		e := &req.Events[i]
		if e.T < 0 || e.T > maxMs {
			writeError(w, http.StatusBadRequest, "invalid_events", "足跡資料不正確")
			return
		}
		e.E = truncateRunes(strings.TrimSpace(e.E), store.MaxGuestEventLen)
	}
	if s.isMember(r) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	id := guestID(r)
	if id == "" {
		writeError(w, http.StatusNotFound, "not_found", "找不到這筆紀錄")
		return
	}
	err := s.cfg.Store.ReportGuestView(r.Context(), id, r.PathValue("id"), store.GuestReport{
		WatchedMs: req.WatchedMs,
		VisibleMs: req.VisibleMs,
		ReadyMs:   req.ReadyMs,
		LoadError: truncateRunes(strings.TrimSpace(req.Error), maxLoadErrorLen),
		Events:    req.Events,
	})
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "找不到這筆紀錄")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
