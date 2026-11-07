package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/tim72117/evoleap/internal/store"
)

// 管理後台 API(/api/admin/*)。沿用 tripace 的做法:不另建管理員帳號系統,
// 管理員就是「一般會員 + Email 白名單」——登入走一般的 cookie JWT,再比對
// 環境變數 ADMIN_BOOTSTRAP_EMAIL(可用逗號分隔多個)。未設定白名單時沒有任何人是管理員(fail-closed)。
//
// 與 tripace 的差異:管理員必須用 Google 登入(Email 經驗證),純密碼帳號不算;
// 另外未登入回 401,已登入但不是管理員回 403
// (tripace 一律 401;shuttle 前端需要分辨「要登入」與「沒有權限」)。
//
// 已知限制(同 tripace):管理權限依附在無狀態的 30 天 JWT 上,無法單獨撤銷某一把 token;
// 要立即失效只能移出白名單(每次請求都會重新比對 Email,所以移出後立刻生效)。

// IsAdminEmail 判斷 email 是否在白名單內;比對時忽略大小寫與前後空白,白名單為空一律 false。
func IsAdminEmail(email, allowlist string) bool {
	email = store.NormalizeEmail(email)
	if email == "" {
		return false
	}
	for _, item := range strings.Split(allowlist, ",") {
		if item = store.NormalizeEmail(item); item != "" && item == email {
			return true
		}
	}
	return false
}

// isAdmin 要求 Email 在白名單內,且帳號經 Google 驗證過 Email:
// 密碼註冊不驗證 Email 所有權,否則任何人都能搶在管理員之前用白名單的 Email 註冊成管理員。
// 綁定 Google 時會清掉先前設的密碼,並讓綁定前的登入 cookie 失效(見 store.UpsertGoogleUser),搶註冊的人不能再登入。
func (s *Server) isAdmin(u store.User) bool {
	return u.GoogleVerified && IsAdminEmail(u.Email, s.cfg.AdminEmails)
}

// requireAdmin 要求已登入且在管理員白名單內;未登入 401、非管理員 403。
// cfg.OpenAdmin(本機 -open-studio)時不檢查:有登入就帶著那位使用者,沒登入給一個空的使用者。
func (s *Server) requireAdmin(h func(http.ResponseWriter, *http.Request, store.User)) http.HandlerFunc {
	if s.cfg.OpenAdmin {
		return s.requireAuth(func(w http.ResponseWriter, r *http.Request) {
			user, _ := s.currentUser(r)
			h(w, r, user)
		})
	}
	return s.requireUser(func(w http.ResponseWriter, r *http.Request, user store.User) {
		if !s.isAdmin(user) {
			writeError(w, http.StatusForbidden, "forbidden", "沒有管理權限")
			return
		}
		h(w, r, user)
	})
}

// Access 是一個請求對內部頁(研發基地)的權限。
type Access int

const (
	// AccessDenied:看不到內部頁(已登入但不是管理員,或伺服器沒開放登入)。
	AccessDenied Access = iota
	// AccessGuest:未登入,登入後可能有權限。
	AccessGuest
	// AccessAllowed:管理員。
	AccessAllowed
)

// InternalAccess 判斷這個請求能不能看內部頁,條件與 /api/admin/* 相同。
// 由 cmd/server 的靜態檔處理器呼叫,每次請求都重新比對白名單。
func (s *Server) InternalAccess(r *http.Request) Access {
	if !s.authEnabled() {
		return AccessDenied
	}
	user, ok := s.currentUser(r)
	if !ok {
		return AccessGuest
	}
	if s.isAdmin(user) {
		return AccessAllowed
	}
	return AccessDenied
}

func (s *Server) handleAdminMe(w http.ResponseWriter, r *http.Request, user store.User) {
	writeJSON(w, http.StatusOK, s.authBody(user))
}

func (s *Server) handleAdminOverview(w http.ResponseWriter, r *http.Request, _ store.User) {
	o, err := s.cfg.Store.AdminOverview(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, o)
}

func (s *Server) handleAdminUsers(w http.ResponseWriter, r *http.Request, _ store.User) {
	users, err := s.cfg.Store.AdminUsers(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"total": len(users), "users": users})
}

// handleAdminUserProgress 回傳單一使用者的基本資料與各課進度。
func (s *Server) handleAdminUserProgress(w http.ResponseWriter, r *http.Request, _ store.User) {
	id := r.PathValue("id")
	user, err := s.cfg.Store.UserByID(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "找不到這位使用者")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	list, err := s.cfg.Store.ProgressList(r.Context(), id)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user, "progress": list})
}
