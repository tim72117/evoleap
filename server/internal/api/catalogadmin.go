package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/tim72117/evoleap/internal/store"
)

// maxInitBytes 是初始化請求的大小上限(課程資訊加上全部腳本)。
const maxInitBytes = 64 << 20

// handleCatalogExport 唯讀回傳課程資訊,給備份用(GET /api/admin/catalog-export)。
func (s *Server) handleCatalogExport(w http.ResponseWriter, r *http.Request, _ store.User) {
	if s.cfg.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "no_database", "課程資料還沒連上資料庫")
		return
	}
	cat, err := s.cfg.Store.ExportCatalog(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, cat)
}

// handleInit 把課程資訊與腳本寫進空資料庫(POST /api/admin/init)。
func (s *Server) handleInit(w http.ResponseWriter, r *http.Request, _ store.User) {
	if s.cfg.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "no_database", "課程資料還沒連上資料庫")
		return
	}
	var in struct {
		store.Catalog
		Files []store.ScriptExportFile `json:"files"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxInitBytes)).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "請求格式錯誤:"+err.Error())
		return
	}
	err := s.cfg.Store.InitCatalog(r.Context(), in.Catalog, in.Files)
	switch {
	case errors.Is(err, store.ErrCoursesExist):
		writeError(w, http.StatusConflict, "courses_exist", err.Error())
	case errors.Is(err, store.ErrInvalidCourseData):
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
	case err != nil:
		internalError(w, err)
	default:
		writeJSON(w, http.StatusOK, map[string]any{"courses": len(in.Courses), "files": len(in.Files)})
	}
}
