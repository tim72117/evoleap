package api

import (
	"net/http"

	"github.com/tim72117/evoleap/internal/store"
)

// handleScriptExport 唯讀地回傳腳本檔的完整內容,給備份用(GET /api/admin/script-export?source=lesson|studio,不給 source 就兩張表都給,只給管理員)。
// 每個檔:來源、路徑、所屬課程與課、原始內容。只讀資料庫,所以拿到的是正式資料庫的現況。
func (s *Server) handleScriptExport(w http.ResponseWriter, r *http.Request, _ store.User) {
	if s.cfg.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "no_database", "課程資料還沒連上資料庫")
		return
	}
	source := r.URL.Query().Get("source")
	if source != "" && source != store.ScriptSourceLesson && source != store.ScriptSourceStudio {
		writeError(w, http.StatusBadRequest, "bad_request", "source 只能是 lesson 或 studio")
		return
	}
	files, err := s.cfg.Store.ExportScripts(r.Context(), source)
	if err != nil {
		internalError(w, err)
		return
	}
	if files == nil {
		files = []store.ScriptExportFile{}
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, map[string]any{"files": files})
}
