package api

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/tim72117/evoleap/internal/store"
)

// handleLessonFile 回傳一個腳本檔(GET /api/scripts/{path},path 例如 l0/0.0-tools.json)。
// 課程的腳本依所屬那一課把關:管理員都看得到;其他人只拿得到已開放(open)的課,access free 不用登入,login-free 要登入,
// subscription 要有包含這門課所需方案的有效訂閱(courses.go 的 subscribedFor)。研發基地的腳本(不屬於任何一課)只給管理員。
// 拿不到的草稿、規劃中的課與研發基地的腳本,對其他人一律當作不存在(404,選用的旁白與章節音軌清單回 null),不透露有這個檔。
// 沒接資料庫時(Cloud Run 沒設 DATABASE_URL)直接照內嵌的種子讀 ScriptsDir 裡的檔:登入功能停用,所以只有免登入的課拿得到。
func (s *Server) handleLessonFile(w http.ResponseWriter, r *http.Request) {
	path := r.PathValue("path")
	user, loggedIn := s.currentUser(r)
	admin := s.cfg.OpenAdmin || (loggedIn && s.isAdmin(user))
	notFound := func() {
		// 旁白清單、章節音軌清單是選用的(很多腳本沒有):沒有或看不到時回 null(200),瀏覽器不會記成載入失敗
		if strings.HasSuffix(path, ".voice.json") || strings.HasSuffix(path, ".mix.json") {
			w.Header().Set("Cache-Control", "private, no-store")
			writeJSON(w, http.StatusOK, nil)
			return
		}
		writeError(w, http.StatusNotFound, "not_found", "找不到這個腳本")
	}

	var content string
	public := false
	var f store.LessonFile
	var err error
	if s.cfg.Store == nil {
		f, err = store.SeedLessonFile(s.cfg.ScriptsDir, path)
	} else {
		f, err = s.cfg.Store.LessonFileOf(r.Context(), path)
	}
	// 兒童模式(kids.go):只給兒童課、只在上課時段給;排在管理員之前,家長是管理員也一樣
	if err == nil || errors.Is(err, store.ErrLessonFileNotFound) {
		if s.kidsGate(w, r, user, loggedIn, f) {
			return
		}
	}
	switch {
	case errors.Is(err, store.ErrLessonFileNotFound):
		// 不屬於任何一課:研發基地的腳本(要有資料庫,只給管理員)
		if !admin || s.cfg.Store == nil {
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
	case f.Access == store.AccessLoginFree:
		content = f.Content
	default:
		// 訂閱課程(以及不認識的存取方式)要有包含這門課所需方案的有效訂閱
		ok := false
		if f.Access == store.AccessSubscription {
			if ok, err = s.subscribedFor(r, user.ID, f.CourseID); err != nil {
				internalError(w, err)
				return
			}
		}
		if !ok {
			writeError(w, http.StatusForbidden, "subscription_required", "這一課要訂閱才能觀看")
			return
		}
		content = f.Content
	}
	if err != nil {
		internalError(w, err)
		return
	}
	body := []byte(content)
	// 本機開發:直接讀磁碟上最新的檔案,改了腳本不用重啟伺服器(把關仍照資料庫)
	if s.cfg.LiveDir != "" {
		if b, err := os.ReadFile(filepath.Join(s.cfg.LiveDir, path)); err == nil {
			body = b
		}
	}
	// 本機開發讀磁碟上的檔案時不快取,改了腳本重新整理就看得到。
	// 兒童課要看兒童模式的時段與進度,不給共用快取;其他免費課的快取依 cookie 區分,開了兒童模式(多了 evoleap_kids)就不會拿到之前快取的檔而繞過 kidsGate
	if public && s.cfg.LiveDir == "" && f.CourseID != "kids" {
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.Header().Set("Vary", "Cookie")
	} else {
		w.Header().Set("Cache-Control", "private, no-store")
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(body)
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
