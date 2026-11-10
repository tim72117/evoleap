package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/tim72117/evoleap/internal/store"
)

// 會員空間(前端 /member)用的 API:目前只能改顯示名稱。之後要加的欄位放在 meUpdateRequest,
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
	Name *string `json:"name"`
}

func (s *Server) handleMeUpdate(w http.ResponseWriter, r *http.Request, user store.User) {
	var req meUpdateRequest
	if !decode(w, r, &req) {
		return
	}
	if req.Name == nil {
		writeJSON(w, http.StatusOK, s.authBody(user))
		return
	}
	name := strings.TrimSpace(*req.Name)
	if msg := nameProblem(name); msg != "" {
		writeError(w, http.StatusBadRequest, "invalid_name", msg)
		return
	}
	updated, err := s.cfg.Store.UpdateUserName(r.Context(), user.ID, name)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusUnauthorized, "unauthorized", "請先登入")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.authBody(updated))
}
