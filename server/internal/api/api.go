// Package api 定義 /api/* 底下的 HTTP 端點。
package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/tim72117/evoleap/internal/auth"
	"github.com/tim72117/evoleap/internal/store"
)

type Config struct {
	// Store 與 Signer 為 nil 時登入功能停用(未設定資料庫),其餘端點照常運作。
	Store  *store.Store
	Signer *auth.Signer
	// GoogleClientID 是 Google 登入(GSI)的 OAuth 用戶端 ID;空字串代表未啟用 Google 登入。
	GoogleClientID string
	// SecureCookie 為 true 時登入 cookie 加上 Secure(正式環境 HTTPS)。
	SecureCookie bool
	// AdminEmails 是管理員 Email 白名單(逗號分隔,環境變數 ADMIN_BOOTSTRAP_EMAIL);空字串代表沒有管理員。
	AdminEmails string
	// AuthRateLimit 是每個來源 IP 每分鐘可嘗試登入、註冊的次數;0 代表不限流(本機開發與 E2E 用)。
	AuthRateLimit int
	// OpenAdmin 為 true 時管理後台 API(/api/admin/*)不檢查登入與白名單(-open-studio,只給本機開發用;Cloud Run 上 main 會拒絕啟動)。
	OpenAdmin bool
	// VerifyGoogle 驗證 Google 登入憑證;nil 時用 auth.VerifyGoogleToken。測試可替換。
	VerifyGoogle func(ctx context.Context, credential, clientID string) (auth.GoogleIdentity, error)
}

type Server struct {
	cfg Config
	// authIP、loginEmail、guestOpen 在 cfg.AuthRateLimit 為 0 時是 nil,代表不限流。
	authIP     *rateLimiter
	loginEmail *rateLimiter
	guestOpen  *rateLimiter
	prune      guestPruner
}

func New(cfg Config) *Server {
	s := &Server{cfg: cfg}
	if cfg.AuthRateLimit > 0 {
		s.authIP = newRateLimiter(cfg.AuthRateLimit, time.Minute)
		s.loginEmail = newRateLimiter(loginEmailLimit, time.Minute)
		s.guestOpen = newRateLimiter(guestOpenLimit, time.Minute)
	}
	return s
}

// Routes 回傳 /api/* 的路由。新增端點時在這裡註冊。
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/auth/config", s.handleAuthConfig)
	mux.HandleFunc("POST /api/auth/register", s.limitAuth(s.requireAuth(s.handleRegister)))
	mux.HandleFunc("POST /api/auth/login", s.limitAuth(s.requireAuth(s.handleLogin)))
	mux.HandleFunc("POST /api/auth/google", s.limitAuth(s.requireAuth(s.handleGoogle)))
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("GET /api/me", s.handleMe)
	mux.HandleFunc("GET /api/progress", s.requireUser(s.handleProgressGet))
	mux.HandleFunc("PUT /api/progress", s.requireUser(s.handleProgressPut))
	mux.HandleFunc("GET /api/courses/{id}/map", s.handleCourseMap)
	mux.HandleFunc("POST /api/guest/views", s.requireAuth(s.handleGuestOpen))
	mux.HandleFunc("PUT /api/guest/views/{id}", s.requireAuth(s.handleGuestWatch))
	mux.HandleFunc("GET /api/admin/me", s.requireAdmin(s.handleAdminMe))
	mux.HandleFunc("GET /api/admin/overview", s.requireAdmin(s.handleAdminOverview))
	mux.HandleFunc("GET /api/admin/users", s.requireAdmin(s.handleAdminUsers))
	mux.HandleFunc("GET /api/admin/users/{id}/progress", s.requireAdmin(s.handleAdminUserProgress))
	return mux
}

// handleHealth 回報服務與資料庫是否正常;資料庫連不上時回 503。
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.cfg.Store.Ping(ctx); err != nil {
		log.Printf("health: db ping: %v", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db_unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// writeJSON 預設不快取;handler 先設了 Cache-Control(例如課程地圖)就照它的。
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if w.Header().Get("Cache-Control") == "" {
		w.Header().Set("Cache-Control", "no-store")
	}
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// writeError 回傳 {"error": code, "message": 給使用者看的訊息}。
func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}
