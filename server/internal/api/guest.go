package api

import (
	"errors"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/tim72117/evoleap/internal/store"
)

// 訪客的上課紀錄(未登入的人):打開一課(或按下播放首頁的展示影片,lesson 以 home: 開頭)時 POST /api/guest/views 記一筆,播放時 PUT /api/guest/views/{id} 回報累計的播放時間。
// 訪客代號放在 evoleap_guest cookie(HttpOnly,伺服器第一次記錄時發給瀏覽器),只用來把同一個瀏覽器的紀錄串在一起,不連到帳號。
// 已登入的會員不記在這裡(會員有自己的播放進度),兩個端點對會員一律回 204、什麼都不做。

const guestCookie = "evoleap_guest"

// guestPruneEvery 是清理過期訪客紀錄的最短間隔:在記錄新的一筆時順手清,不另外排程。
const guestPruneEvery = time.Hour

// guestOpenLimit 是每個來源 IP 每分鐘可記錄幾次「打開一課」,擋住灌資料的請求(和登入限流一樣只在有設定 AuthRateLimit 時啟用)。
const guestOpenLimit = 60

var guestIDPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)

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
	viewID, err := s.cfg.Store.OpenGuestView(r.Context(), id, req.Lesson)
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
	}
	if !decode(w, r, &req) {
		return
	}
	if req.WatchedMs < 0 || req.WatchedMs > maxMs {
		writeError(w, http.StatusBadRequest, "invalid_watched", "播放時間不正確")
		return
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
	err := s.cfg.Store.SetGuestWatched(r.Context(), id, r.PathValue("id"), req.WatchedMs)
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
