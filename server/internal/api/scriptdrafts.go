package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/tim72117/evoleap/internal/store"
)

// 腳本草稿與發布的管理 API(見 store/scriptdrafts.go)。

func writeDraftError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrDraftNotFound):
		writeError(w, http.StatusNotFound, "not_found", "找不到草稿")
	case errors.Is(err, store.ErrDraftConflict):
		writeError(w, http.StatusConflict, "draft_conflict", err.Error())
	default:
		writeCourseDataError(w, err)
	}
}

func (s *Server) handleScriptDrafts(w http.ResponseWriter, r *http.Request, _ store.User) {
	drafts, err := s.cfg.Store.ScriptDrafts(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"drafts": drafts})
}

func (s *Server) handleScriptDraftGet(w http.ResponseWriter, r *http.Request, _ store.User) {
	content, err := s.cfg.Store.ScriptDraftContent(r.Context(), r.PathValue("path"))
	if err != nil {
		writeDraftError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write([]byte(content))
}

func (s *Server) handleScriptDraftPut(w http.ResponseWriter, r *http.Request, user store.User) {
	body, err := io.ReadAll(io.LimitReader(r.Body, maxScriptBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "讀不到內容")
		return
	}
	if len(body) > maxScriptBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "too_large", "腳本超過 2MB")
		return
	}
	q := r.URL.Query()
	draft, err := s.cfg.Store.PutScriptDraft(r.Context(), user.Email, r.PathValue("path"), q.Get("course"), q.Get("lesson"), body)
	if err != nil {
		writeDraftError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, draft)
}

func (s *Server) handleScriptDraftDrop(w http.ResponseWriter, r *http.Request, _ store.User) {
	path := r.PathValue("path")
	if err := s.cfg.Store.DropScriptDraft(r.Context(), path); err != nil {
		writeDraftError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"dropped": path})
}

func (s *Server) handleScriptPublish(w http.ResponseWriter, r *http.Request, user store.User) {
	var req struct {
		Paths []string `json:"paths"`
		Force bool     `json:"force"`
	}
	if json.NewDecoder(r.Body).Decode(&req) != nil || len(req.Paths) == 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "要給 paths")
		return
	}
	published, err := s.cfg.Store.PublishScriptDrafts(r.Context(), user.Email, req.Paths, req.Force)
	if err != nil {
		writeDraftError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"published": published})
}
