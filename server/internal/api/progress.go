package api

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/tim72117/evoleap/internal/store"
)

// 播放進度只給登入的會員:訪客的進度不存(前端不會呼叫,後端也一律回 401)。

const (
	maxLessonLen = 200
	maxMs        = 24 * 60 * 60 * 1000 // 一天;超過視為不合理的值
	posSlackMs   = 1000                // 位置可以略超過總長(前端四捨五入、影格誤差),超過這個範圍視為不合理
)

// requireUser 取得登入的會員;未登入回 401。
func (s *Server) requireUser(h func(http.ResponseWriter, *http.Request, store.User)) http.HandlerFunc {
	return s.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		user, ok := s.currentUser(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized", "請先登入")
			return
		}
		h(w, r, user)
	})
}

// handleProgressGet:帶 ?lesson= 回單一課的進度(沒有紀錄回 progress: null),不帶則回全部。
// 兒童模式(kids.go)時,進度讀寫的是這個孩子自己的(child_progress),看完一課另外記一筆上課紀錄;家長本人的進度不動。
func (s *Server) handleProgressGet(w http.ResponseWriter, r *http.Request, user store.User) {
	child, kids := s.kidsChild(r, user, true)
	if lesson := r.URL.Query().Get("lesson"); lesson != "" {
		var p store.Progress
		var err error
		if kids {
			p, err = s.cfg.Store.ChildProgressOf(r.Context(), child.ID, lesson)
		} else {
			p, err = s.cfg.Store.ProgressOf(r.Context(), user.ID, lesson)
		}
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusOK, map[string]any{"progress": nil})
			return
		}
		if err != nil {
			internalError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"progress": p})
		return
	}
	var list []store.Progress
	var err error
	if kids {
		list, err = s.cfg.Store.ChildProgressList(r.Context(), child.ID)
	} else {
		list, err = s.cfg.Store.ProgressList(r.Context(), user.ID)
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"progress": list})
}

func (s *Server) handleProgressPut(w http.ResponseWriter, r *http.Request, user store.User) {
	var req store.Progress
	if !decode(w, r, &req) {
		return
	}
	req.Lesson = strings.TrimSpace(req.Lesson)
	if req.Lesson == "" || utf8.RuneCountInString(req.Lesson) > maxLessonLen ||
		req.PositionMs < 0 || req.PositionMs > maxMs || req.DurationMs < 0 || req.DurationMs > maxMs ||
		req.PositionMs > req.DurationMs+posSlackMs {
		writeError(w, http.StatusBadRequest, "invalid_progress", "進度資料不正確")
		return
	}
	if child, kids := s.kidsChild(r, user, true); kids {
		if _, err := s.cfg.Store.SaveChildProgress(r.Context(), child.ID, req); err != nil {
			internalError(w, err)
		} else {
			w.WriteHeader(http.StatusNoContent)
		}
		return
	}
	if err := s.cfg.Store.SaveProgress(r.Context(), user.ID, req); err != nil {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
