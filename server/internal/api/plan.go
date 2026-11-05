package api

import (
	"net/http"

	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/subscription/httpapi"
)

// planRoutes 把訂閱套件的 handler 掛到專案的路由上。
func (s *Server) planRoutes(mux *http.ServeMux) {
	h := httpapi.New(s.cfg.Subscriptions, httpapi.Options{
		UserID: func(r *http.Request) (string, bool) {
			user, ok := s.currentUser(r)
			return user.ID, ok
		},
	})
	mux.HandleFunc("GET /api/plan/plans", h.Plans)
	mux.HandleFunc("GET /api/plan/me", s.requireAuth(h.Me))
	mux.HandleFunc("POST /api/plan/checkout", s.requireAuth(h.Checkout))
	mux.HandleFunc("POST /api/plan/manage", s.requireAuth(h.Manage))
	mux.HandleFunc("POST /api/paddle/webhook", h.Webhook)
	mux.HandleFunc("POST /api/admin/subscription-events/{id}/replay", s.requireAdmin(func(w http.ResponseWriter, r *http.Request, _ store.User) {
		h.Replay(w, r)
	}))
}
