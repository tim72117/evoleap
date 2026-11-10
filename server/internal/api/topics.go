package api

import (
	"errors"
	"net/http"

	"github.com/tim72117/evoleap/internal/store"
)

// handleTopics 回傳所有主題(依 position),每個主題帶它底下的課程。公開資料、不用登入,不隨使用者變,跟課程地圖一樣短暫快取;沒接資料庫時回 503。
func (s *Server) handleTopics(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "no_store", "課程資料庫尚未設定")
		return
	}
	topics, err := s.cfg.Store.Topics(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	writeJSON(w, http.StatusOK, map[string]any{"topics": topics})
}

// handleTopic 回傳一個主題與它底下的課程。
func (s *Server) handleTopic(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "no_store", "課程資料庫尚未設定")
		return
	}
	t, err := s.cfg.Store.TopicOf(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrTopicNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "找不到這個主題")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	writeJSON(w, http.StatusOK, t)
}
