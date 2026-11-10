package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/tim72117/evoleap/internal/store"
)

// 管理員改課程資料(evoleap CLI 呼叫,也可用登入 cookie);全部經 requireAdmin,每次修改記在 course_changes。
//
//	GET   /api/admin/courses                          課程清單與各狀態的課數
//	GET   /api/admin/courses/{id}                     一門課的課程地圖(含草稿、腳本、時間)
//	PATCH /api/admin/courses/{id}/lessons/{lesson}    改一課:status、access、minutes、title、summary、script
//	PUT   /api/admin/scripts/{path...}?course=&lesson= 寫入一個腳本檔(新增或取代);讀取用 GET /api/scripts/{path}
//	GET   /api/admin/course-changes?limit=            最近的修改紀錄
//	GET   /api/admin/schema-check                     資料庫結構檢查(資料表定義與實際欄位、主鍵是否一致,有沒有遺留表)

// 腳本檔的大小上限(目前最大的腳本約 100KB)
const maxScriptBytes = 2 << 20

func (s *Server) handleAdminCourses(w http.ResponseWriter, r *http.Request, _ store.User) {
	courses, err := s.cfg.Store.AdminCourses(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"courses": courses})
}

func (s *Server) handleAdminCourse(w http.ResponseWriter, r *http.Request, _ store.User) {
	m, err := s.cfg.Store.CourseMapOf(r.Context(), r.PathValue("id"), true)
	if errors.Is(err, store.ErrCourseNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "找不到這門課")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

// writeCourseDataError 把修改課程資料的錯誤轉成回應:不合規則 400(訊息寫明原因)、找不到 404。
func writeCourseDataError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrInvalidCourseData):
		writeError(w, http.StatusBadRequest, "invalid", err.Error())
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "找不到這一課")
	default:
		internalError(w, err)
	}
}

func (s *Server) handleAdminLessonUpdate(w http.ResponseWriter, r *http.Request, user store.User) {
	var p store.LessonPatch
	if json.NewDecoder(r.Body).Decode(&p) != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "格式錯誤")
		return
	}
	course, lesson := r.PathValue("id"), r.PathValue("lesson")
	if err := s.cfg.Store.UpdateLesson(r.Context(), user.Email, course, lesson, p); err != nil {
		writeCourseDataError(w, err)
		return
	}
	s.handleAdminCourse(w, r, user)
}

func (s *Server) handleAdminScriptPut(w http.ResponseWriter, r *http.Request, user store.User) {
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
	path := r.PathValue("path")
	if err := s.cfg.Store.PutScript(r.Context(), user.Email, path, q.Get("course"), q.Get("lesson"), body); err != nil {
		writeCourseDataError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": path, "bytes": len(body)})
}

func (s *Server) handleAdminCourseChanges(w http.ResponseWriter, r *http.Request, _ store.User) {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 || limit > 200 {
		limit = 20
	}
	changes, err := s.cfg.Store.CourseChanges(r.Context(), limit)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"changes": changes})
}

// handleSchemaCheck 比對程式的資料表定義與資料庫實際的欄位、主鍵,並列出遺留表(GET /api/admin/schema-check,見 store/schema_check.go)
func (s *Server) handleSchemaCheck(w http.ResponseWriter, r *http.Request, _ store.User) {
	report, err := s.cfg.Store.CheckSchema(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, report)
}
