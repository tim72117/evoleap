package api

// 課程結構的新增、刪除、排序(只給管理員,見 store/structure.go)。

import (
	"encoding/json"
	"net/http"

	"github.com/tim72117/evoleap/internal/store"
)

func decodeAdmin(w http.ResponseWriter, r *http.Request, v any) bool {
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 128<<10))
	d.DisallowUnknownFields()
	if d.Decode(v) != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "格式錯誤")
		return false
	}
	return true
}

func writeAdminResult(w http.ResponseWriter, err error) {
	if err != nil {
		writeCourseDataError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleAdminCourseCreate(w http.ResponseWriter, r *http.Request, user store.User) {
	var c store.NewCourse
	if decodeAdmin(w, r, &c) {
		writeAdminResult(w, s.cfg.Store.CreateCourse(r.Context(), user.Email, c))
	}
}

func (s *Server) handleAdminCourseDelete(w http.ResponseWriter, r *http.Request, user store.User) {
	writeAdminResult(w, s.cfg.Store.DeleteCourse(r.Context(), user.Email, r.PathValue("id")))
}

func (s *Server) handleAdminCourseOrder(w http.ResponseWriter, r *http.Request, user store.User) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if decodeAdmin(w, r, &body) {
		writeAdminResult(w, s.cfg.Store.OrderCourses(r.Context(), user.Email, body.IDs))
	}
}

func (s *Server) handleAdminOutline(w http.ResponseWriter, r *http.Request, user store.User) {
	var body struct {
		Units []store.OutlineUnit `json:"units"`
	}
	if decodeAdmin(w, r, &body) {
		writeAdminResult(w, s.cfg.Store.SetOutline(r.Context(), user.Email, r.PathValue("id"), body.Units))
	}
}

func (s *Server) handleAdminUnitCreate(w http.ResponseWriter, r *http.Request, user store.User) {
	var u store.NewUnit
	if decodeAdmin(w, r, &u) {
		writeAdminResult(w, s.cfg.Store.CreateUnit(r.Context(), user.Email, r.PathValue("id"), u))
	}
}

func (s *Server) handleAdminUnitUpdate(w http.ResponseWriter, r *http.Request, user store.User) {
	var p store.UnitPatch
	if decodeAdmin(w, r, &p) {
		writeAdminResult(w, s.cfg.Store.UpdateUnit(r.Context(), user.Email, r.PathValue("id"), r.PathValue("unit"), p))
	}
}

func (s *Server) handleAdminUnitDelete(w http.ResponseWriter, r *http.Request, user store.User) {
	writeAdminResult(w, s.cfg.Store.DeleteUnit(r.Context(), user.Email, r.PathValue("id"), r.PathValue("unit")))
}

func (s *Server) handleAdminLessonCreate(w http.ResponseWriter, r *http.Request, user store.User) {
	var l store.NewLesson
	if decodeAdmin(w, r, &l) {
		writeAdminResult(w, s.cfg.Store.CreateLesson(r.Context(), user.Email, r.PathValue("id"), l))
	}
}

func (s *Server) handleAdminLessonDelete(w http.ResponseWriter, r *http.Request, user store.User) {
	writeAdminResult(w, s.cfg.Store.DeleteLesson(r.Context(), user.Email, r.PathValue("id"), r.PathValue("lesson")))
}
