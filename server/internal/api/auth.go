package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"unicode/utf8"

	"github.com/tim72117/shuttle/internal/auth"
	"github.com/tim72117/shuttle/internal/store"
)

// 登入狀態存在 HttpOnly cookie(內容是自家 JWT),前端 JS 讀不到 token;
// 前端與 API 同源,SameSite=Lax 擋掉跨站表單送出的請求。

const sessionCookie = "shuttle_session"

const minPasswordLen = 8

type authResponse struct {
	User store.User `json:"user"`
}

// authEnabled 回報登入功能是否可用(有設定資料庫)。
func (s *Server) authEnabled() bool { return s.cfg.Store != nil && s.cfg.Signer != nil }

// requireAuth 在登入功能停用時回 503,避免對 nil Store 操作。
func (s *Server) requireAuth(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.authEnabled() {
			writeError(w, http.StatusServiceUnavailable, "auth_disabled", "登入功能尚未開放")
			return
		}
		h(w, r)
	}
}

func (s *Server) handleAuthConfig(w http.ResponseWriter, r *http.Request) {
	clientID := ""
	if s.authEnabled() {
		clientID = s.cfg.GoogleClientID
	}
	writeJSON(w, http.StatusOK, map[string]any{"enabled": s.authEnabled(), "googleClientId": clientID})
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if !decode(w, r, &req) {
		return
	}
	email := store.NormalizeEmail(req.Email)
	if _, err := mail.ParseAddress(email); err != nil || strings.ContainsAny(email, " <>") {
		writeError(w, http.StatusBadRequest, "invalid_email", "Email 格式不正確")
		return
	}
	if utf8.RuneCountInString(req.Password) < minPasswordLen {
		writeError(w, http.StatusBadRequest, "weak_password", "密碼至少需要 8 個字元")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = strings.SplitN(email, "@", 2)[0]
	}
	if utf8.RuneCountInString(name) > 50 {
		writeError(w, http.StatusBadRequest, "invalid_name", "名稱最多 50 個字")
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		internalError(w, err)
		return
	}
	user, err := s.cfg.Store.CreatePasswordUser(r.Context(), email, name, hash)
	if errors.Is(err, store.ErrAlreadyExists) {
		writeError(w, http.StatusConflict, "email_taken", "這個 Email 已經註冊過，請直接登入")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	s.startSession(w, user)
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !decode(w, r, &req) {
		return
	}
	user, hash, err := s.cfg.Store.CredentialsByEmail(r.Context(), req.Email)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		internalError(w, err)
		return
	}
	// 帳號不存在、只綁 Google 沒有密碼、密碼錯誤都回同一個訊息,不透露帳號是否存在。
	if err != nil || hash == "" || auth.VerifyPassword(req.Password, hash) != nil {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Email 或密碼不正確")
		return
	}
	s.startSession(w, user)
}

type googleRequest struct {
	Credential string `json:"credential"`
}

func (s *Server) handleGoogle(w http.ResponseWriter, r *http.Request) {
	if s.cfg.GoogleClientID == "" {
		writeError(w, http.StatusNotFound, "google_disabled", "目前未開放 Google 登入")
		return
	}
	var req googleRequest
	if !decode(w, r, &req) {
		return
	}
	id, err := auth.VerifyGoogleToken(r.Context(), req.Credential, s.cfg.GoogleClientID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_google_token", "Google 登入驗證失敗，請再試一次")
		return
	}
	// 管理員白名單的 Email 綁定 Google 時清掉既有的密碼(可能是別人搶先密碼註冊的),一般會員不清
	user, err := s.cfg.Store.UpsertGoogleUser(r.Context(), id.Sub, id.Email, id.EmailVerified, id.Name, IsAdminEmail(id.Email, s.cfg.AdminEmails))
	if errors.Is(err, store.ErrGoogleConflict) {
		writeError(w, http.StatusConflict, "google_conflict", "這個 Email 已經綁定另一個 Google 帳號")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	s.startSession(w, user)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, s.cookie("", -1))
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	// 未登入不是錯誤(訪客瀏覽是常態),回 200 + user: null,避免瀏覽器主控台每頁都記一筆 401。
	user, ok := s.currentUser(r)
	if !ok {
		writeJSON(w, http.StatusOK, map[string]any{"user": nil})
		return
	}
	writeJSON(w, http.StatusOK, authResponse{User: user})
}

// currentUser 從登入 cookie 取得目前使用者;token 無效或使用者已不存在時回傳 false。
func (s *Server) currentUser(r *http.Request) (store.User, bool) {
	if !s.authEnabled() {
		return store.User{}, false
	}
	c, err := r.Cookie(sessionCookie)
	if err != nil {
		return store.User{}, false
	}
	claims, err := s.cfg.Signer.Verify(c.Value)
	if err != nil {
		return store.User{}, false
	}
	user, err := s.cfg.Store.UserByID(r.Context(), claims.Sub)
	if err != nil {
		return store.User{}, false
	}
	return user, true
}

func (s *Server) startSession(w http.ResponseWriter, user store.User) {
	token, err := s.cfg.Signer.Sign(user.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	http.SetCookie(w, s.cookie(token, int(s.cfg.Signer.TTL().Seconds())))
	writeJSON(w, http.StatusOK, authResponse{User: user})
}

func (s *Server) cookie(value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     sessionCookie,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   s.cfg.SecureCookie,
		SameSite: http.SameSiteLaxMode,
	}
}

// decode 讀取 JSON 請求本文(上限 64KB);失敗時已寫出 400。
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, "json_required", "請以 JSON 送出")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "請求格式不正確")
		return false
	}
	return true
}

func internalError(w http.ResponseWriter, err error) {
	log.Printf("api: %v", err)
	writeError(w, http.StatusInternalServerError, "internal", "伺服器發生錯誤，請稍後再試")
}
