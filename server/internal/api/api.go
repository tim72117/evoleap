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
}

type Server struct {
	cfg Config
}

func New(cfg Config) *Server {
	return &Server{cfg: cfg}
}

// Routes 回傳 /api/* 的路由。新增端點時在這裡註冊。
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/auth/config", s.handleAuthConfig)
	mux.HandleFunc("POST /api/auth/register", s.requireAuth(s.handleRegister))
	mux.HandleFunc("POST /api/auth/login", s.requireAuth(s.handleLogin))
	mux.HandleFunc("POST /api/auth/google", s.requireAuth(s.handleGoogle))
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("GET /api/me", s.handleMe)
	mux.HandleFunc("GET /api/progress", s.requireUser(s.handleProgressGet))
	mux.HandleFunc("PUT /api/progress", s.requireUser(s.handleProgressPut))
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// writeError 回傳 {"error": code, "message": 給使用者看的訊息}。
func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}
