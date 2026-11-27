package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/tim72117/evoleap/internal/store"
)

// handleLessonFile 回傳一個腳本檔(GET /api/scripts/{path},path 例如 l0/0.0-tools.json)。
// 課程的腳本依所屬那一課把關:管理員都看得到;其他人只拿得到已開放(open)的課,access free 不用登入,login-free 要登入,
// 訂閱課程等訂閱功能上線前不給。研發基地的腳本(不屬於任何一課)只給管理員。
// 拿不到的草稿、規劃中的課與研發基地的腳本,對其他人一律當作不存在(404,選用的旁白與章節音軌清單回 null),不透露有這個檔。
// 課程與腳本只讀資料庫,沒有種子備援:沒接資料庫時回 503。
// writeOptionalNull:旁白清單(.voice.json)、章節音軌清單(.mix.json)是選用的(很多腳本沒有):
// 沒有或看不到時回 null(200),瀏覽器不會記成載入失敗。是這兩種就回應並回傳 true。
func writeOptionalNull(w http.ResponseWriter, path string) bool {
	if !strings.HasSuffix(path, ".voice.json") && !strings.HasSuffix(path, ".mix.json") {
		return false
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, nil)
	return true
}

func (s *Server) handleLessonFile(w http.ResponseWriter, r *http.Request) {
	path := r.PathValue("path")
	user, loggedIn := s.currentUser(r)
	admin := s.cfg.OpenAdmin || (loggedIn && s.isAdmin(user))
	notFound := func() {
		if writeOptionalNull(w, path) {
			return
		}
		writeError(w, http.StatusNotFound, "not_found", "找不到這個腳本")
	}

	if s.cfg.Store == nil {
		// 選用的旁白清單、章節音軌清單照舊回 null,其他回 503
		if writeOptionalNull(w, path) {
			return
		}
		writeError(w, http.StatusServiceUnavailable, "no_database", "課程資料還沒連上資料庫")
		return
	}
	var content string
	public := false
	f, err := s.cfg.Store.LessonFileOf(r.Context(), path)
	// 兒童模式(kids.go):只給兒童課、只在上課時段給;排在管理員之前,家長是管理員也一樣
	if err == nil || errors.Is(err, store.ErrLessonFileNotFound) {
		if s.kidsGate(w, r, user, loggedIn, f) {
			return
		}
	}
	// ?draft=1:管理員預覽草稿;這個路徑沒有草稿(或不是管理員)就照已發布版本
	if admin && r.URL.Query().Get("draft") == "1" {
		draft, derr := s.cfg.Store.ScriptDraftContent(r.Context(), path)
		if derr == nil {
			w.Header().Set("Cache-Control", "private, no-store")
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			_, _ = w.Write([]byte(draft))
			return
		}
		if !errors.Is(derr, store.ErrDraftNotFound) {
			internalError(w, derr)
			return
		}
	}
	switch {
	case errors.Is(err, store.ErrLessonFileNotFound):
		// 不屬於任何一課:研發基地的腳本(要有資料庫,只給管理員)
		if !admin {
			notFound()
			return
		}
		if content, err = s.cfg.Store.StudioFileOf(r.Context(), path); errors.Is(err, store.ErrLessonFileNotFound) {
			notFound()
			return
		}
	case err != nil:
	case admin:
		content = f.Content
	case f.Status != store.LessonOpen:
		notFound()
		return
	case f.Access == store.AccessFree:
		content, public = f.Content, true
	case !loggedIn:
		writeError(w, http.StatusUnauthorized, "login_required", "這一課要登入才能觀看")
		return
	case f.Access != store.AccessLoginFree:
		writeError(w, http.StatusForbidden, "subscription_required", "這一課要訂閱才能觀看")
		return
	default:
		content = f.Content
	}
	if err != nil {
		internalError(w, err)
		return
	}
	// 兒童課要看兒童模式的時段與進度,不給共用快取;其他免費課的快取依 cookie 區分,開了兒童模式(多了 evoleap_kids)就不會拿到之前快取的檔而繞過 kidsGate
	if public && f.CourseID != "kids" {
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.Header().Set("Vary", "Cookie")
	} else {
		w.Header().Set("Cache-Control", "private, no-store")
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write([]byte(content))
}

// handleScriptPaths 回傳所有腳本檔的路徑(GET /api/scripts,只給管理員):研發基地挑腳本用。
func (s *Server) handleScriptPaths(w http.ResponseWriter, r *http.Request, _ store.User) {
	paths, err := s.cfg.Store.ScriptPaths(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, map[string][]string{"paths": paths})
}
