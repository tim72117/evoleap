package api

import (
	"errors"
	"net/http"
	"time"

	"github.com/tim72117/evoleap/internal/store"
)

// 兒童模式(粗略版,規則見 store/kids.go):
//   GET    /api/kids/children          家長的孩子(含每週時段)
//   POST   /api/kids/children          新增 {"name": "小花"}
//   PATCH  /api/kids/children/{id}     改暱稱、時段或每次上課多久 {"name": …, "slots": [{"day": 1, "time": "16:00"}], "minutes": 30}
//   DELETE /api/kids/children/{id}     連同他的播放進度與上課紀錄
//   GET    /api/kids/children/{id}/lessons  上課紀錄(每看完一課一筆:哪一課、什麼時候看完),家長課表用
//   GET    /api/kids/mode              這台裝置的兒童模式:{"active": false} 或 {"active": true, "child": …, "schedule": …}
//   POST   /api/kids/mode              開啟 {"childId": "…"}(記在這台裝置的 cookie)
//   DELETE /api/kids/mode              離開
// 兒童模式下,腳本 API(scripts.go)只給兒童課,而且只在上課時段給;家長是管理員也一樣。

const kidsCookie = "evoleap_kids"

func (s *Server) kidsCookie(value string, maxAge int) *http.Cookie {
	return &http.Cookie{Name: kidsCookie, Value: value, Path: "/", MaxAge: maxAge, HttpOnly: true, Secure: s.cfg.SecureCookie, SameSite: http.SameSiteLaxMode}
}

// kidsChild 回傳這個請求的兒童模式孩子:有 cookie、已登入、而且是這位家長的孩子才算;否則 ok 是 false。
func (s *Server) kidsChild(r *http.Request, user store.User, loggedIn bool) (store.Child, bool) {
	c, err := r.Cookie(kidsCookie)
	if err != nil || c.Value == "" || !loggedIn || s.cfg.Store == nil {
		return store.Child{}, false
	}
	child, err := s.cfg.Store.ChildOf(r.Context(), user.ID, c.Value)
	if err != nil {
		return store.Child{}, false
	}
	return child, true
}

// kidsScheduleNow 是現在的上課狀態(測試可以換掉時間)
var kidsNow = time.Now

func writeChildErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrInvalidChild):
		writeError(w, http.StatusBadRequest, "invalid_child", err.Error())
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "找不到這個孩子")
	default:
		internalError(w, err)
	}
}

func (s *Server) handleChildren(w http.ResponseWriter, r *http.Request, user store.User) {
	children, err := s.cfg.Store.Children(r.Context(), user.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"children": children, "maxSlots": store.MaxSlots, "maxMinutes": store.MaxMinutes, "avatars": store.Avatars})
}

func (s *Server) handleChildCreate(w http.ResponseWriter, r *http.Request, user store.User) {
	var body struct {
		Name string `json:"name"`
	}
	if !decode(w, r, &body) {
		return
	}
	child, err := s.cfg.Store.CreateChild(r.Context(), user.ID, body.Name)
	if err != nil {
		writeChildErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"child": child})
}

func (s *Server) handleChildUpdate(w http.ResponseWriter, r *http.Request, user store.User) {
	var p store.ChildPatch
	if !decode(w, r, &p) {
		return
	}
	child, err := s.cfg.Store.UpdateChild(r.Context(), user.ID, r.PathValue("id"), p)
	if err != nil {
		writeChildErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"child": child})
}

func (s *Server) handleChildLessons(w http.ResponseWriter, r *http.Request, user store.User) {
	child, err := s.cfg.Store.ChildOf(r.Context(), user.ID, r.PathValue("id"))
	if err != nil {
		writeChildErr(w, err)
		return
	}
	lessons, err := s.cfg.Store.ChildLessons(r.Context(), child.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lessons": lessons})
}

func (s *Server) handleChildDelete(w http.ResponseWriter, r *http.Request, user store.User) {
	if err := s.cfg.Store.DeleteChild(r.Context(), user.ID, r.PathValue("id")); err != nil {
		writeChildErr(w, err)
		return
	}
	// 刪掉的正好是這台裝置兒童模式的孩子:一併離開
	if c, err := r.Cookie(kidsCookie); err == nil && c.Value == r.PathValue("id") {
		http.SetCookie(w, s.kidsCookie("", -1))
	}
	w.WriteHeader(http.StatusNoContent)
}

// kidsModeBody 是兒童模式的狀態:孩子、每週時段與現在的上課狀態
func kidsModeBody(child store.Child) map[string]any {
	return map[string]any{"active": true, "child": child, "schedule": store.ScheduleAt(child.Slots, child.Minutes, kidsNow())}
}

func (s *Server) handleKidsModeGet(w http.ResponseWriter, r *http.Request) {
	user, loggedIn := s.currentUser(r)
	child, ok := s.kidsChild(r, user, loggedIn)
	if !ok {
		writeJSON(w, http.StatusOK, map[string]any{"active": false})
		return
	}
	writeJSON(w, http.StatusOK, kidsModeBody(child))
}

func (s *Server) handleKidsModeStart(w http.ResponseWriter, r *http.Request, user store.User) {
	var body struct {
		ChildID string `json:"childId"`
	}
	if !decode(w, r, &body) {
		return
	}
	child, err := s.cfg.Store.ChildOf(r.Context(), user.ID, body.ChildID)
	if err != nil {
		writeChildErr(w, err)
		return
	}
	http.SetCookie(w, s.kidsCookie(child.ID, 60*60*24*30))
	writeJSON(w, http.StatusOK, kidsModeBody(child))
}

func (s *Server) handleKidsModeStop(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, s.kidsCookie("", -1))
	w.WriteHeader(http.StatusNoContent)
}

// parentOnly 擋兒童模式中的家長設定(新增、修改、刪除孩子,換一個孩子進兒童模式):孩子拿著家長的裝置時不能自己改上課時段。
// 家長要改設定,先離開兒童模式。
func (s *Server) parentOnly(h func(http.ResponseWriter, *http.Request, store.User)) func(http.ResponseWriter, *http.Request, store.User) {
	return func(w http.ResponseWriter, r *http.Request, user store.User) {
		if _, kids := s.kidsChild(r, user, true); kids {
			writeError(w, http.StatusForbidden, "kids_parent_only", "兒童模式中不能變更設定，請家長先離開兒童模式")
			return
		}
		h(w, r, user)
	}
}

// kidsGate 在兒童模式下擋腳本:不是兒童課的不給(403 kids_only),兒童課不在上課時段也不給(403 kids_closed,訊息附下一堂時間),
// 還沒輪到的課也不給(403 kids_locked:只有看完的課和接下來那一課,見 store.KidsLessonOpen)。
// 回傳 true 代表已經寫出回應。f.CourseID 是空字串代表不屬於任何一課(研發基地的腳本)。
func (s *Server) kidsGate(w http.ResponseWriter, r *http.Request, user store.User, loggedIn bool, f store.LessonFile) bool {
	child, ok := s.kidsChild(r, user, loggedIn)
	if !ok {
		return false
	}
	if f.CourseID != "kids" {
		writeError(w, http.StatusForbidden, "kids_only", "兒童模式只能看兒童課程")
		return true
	}
	sch := store.ScheduleAt(child.Slots, child.Minutes, kidsNow())
	if sch.Open {
		open, err := s.cfg.Store.KidsLessonOpen(r.Context(), child.ID, f.CourseID, f.LessonID)
		if err != nil {
			internalError(w, err)
			return true
		}
		if !open {
			writeError(w, http.StatusForbidden, "kids_locked", "這一課還沒到，先上完前面的課")
			return true
		}
		return false
	}
	if sch.Next != nil {
		writeErrorWith(w, http.StatusForbidden, "kids_closed", "還沒到上課時間，下一堂是 "+store.SlotLabel(*sch.Next), map[string]any{"next": *sch.Next})
		return true
	}
	writeError(w, http.StatusForbidden, "kids_closed", "還沒到上課時間，請家長在會員空間排入上課時段")
	return true
}
