package api

import (
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/tim72117/evoleap/internal/store"
)

// 會員空間(前端 /member)用的 API:改顯示名稱與介面語言。之後要加的欄位放在 meUpdateRequest,
// 沒帶的欄位(nil)不改。Email 是登入用的帳號,不在這裡改。

// requireSiteUser 同 requireUser,但只認網站登入的 cookie:evoleap CLI 的 Bearer token 是給 CLI 呼叫課程 API 用的,
// 不能拿來改帳號資料(token 外流時影響範圍較小)。
func (s *Server) requireSiteUser(h func(http.ResponseWriter, *http.Request, store.User)) http.HandlerFunc {
	return s.requireUser(func(w http.ResponseWriter, r *http.Request, user store.User) {
		if _, err := r.Cookie(sessionCookie); err != nil {
			writeError(w, http.StatusUnauthorized, "site_login_required", "請在網站登入後再修改帳號資料")
			return
		}
		h(w, r, user)
	})
}

type meUpdateRequest struct {
	Name   *string `json:"name"`
	Locale *string `json:"locale"`
}

func (s *Server) handleMeUpdate(w http.ResponseWriter, r *http.Request, user store.User) {
	var req meUpdateRequest
	if !decode(w, r, &req) {
		return
	}
	// 先檢查所有欄位,有一個不合格就都不改
	var name string
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
		if msg := nameProblem(name); msg != "" {
			writeError(w, http.StatusBadRequest, "invalid_name", msg)
			return
		}
	}
	if req.Locale != nil && !slices.Contains(store.Locales, *req.Locale) {
		writeError(w, http.StatusBadRequest, "invalid_locale", "不支援這個語言")
		return
	}
	// 名稱與語言在同一個 UPDATE 裡寫入:不會只改到一個
	var namePtr *string
	if req.Name != nil {
		namePtr = &name
	}
	user, err := s.cfg.Store.UpdateUserProfile(r.Context(), user.ID, namePtr, req.Locale)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusUnauthorized, "unauthorized", "請先登入")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.authBody(user))
}
