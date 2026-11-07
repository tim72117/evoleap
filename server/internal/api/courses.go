package api

import (
	"errors"
	"net/http"

	"github.com/tim72117/evoleap/internal/store"
)

// handleCourseMap 回傳一門課的課程地圖(單元與每一堂課,資料來自 courses、course_units、lessons 表)。
// 公開資料,不用登入,登入功能沒開(沒設定 Google 登入)也照常回傳;只有沒接資料庫時回 503(前端改用內建的課程資料)。
// 每一堂的 access 已經套用過這門課的預設,前端照它標「免費預覽」「登入後學習」。
func (s *Server) handleCourseMap(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "no_store", "課程資料庫尚未設定")
		return
	}
	m, err := s.cfg.Store.CourseMapOf(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrCourseNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "找不到這門課")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	// 課程地圖只在部署時改變(種子資料),短暫快取即可
	w.Header().Set("Cache-Control", "public, max-age=60")
	writeJSON(w, http.StatusOK, m)
}
