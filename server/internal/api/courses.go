package api

import (
	"errors"
	"net/http"

	"github.com/tim72117/evoleap/internal/store"
)

// courseAccessResponse 是使用者能不能看這門課。
type courseAccessResponse struct {
	Access  store.Access `json:"access"`
	Allowed bool         `json:"allowed"`
	Reason  string       `json:"reason,omitempty"`
}

// handleCourseAccess 回傳目前的使用者能不能看這門課,未登入也可以呼叫。
func (s *Server) handleCourseAccess(w http.ResponseWriter, r *http.Request) {
	result, err := s.courseAccess(r, r.PathValue("id"))
	if errors.Is(err, store.ErrCourseNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "找不到這門課")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// courseAccess 判斷權限,要提供付費內容的端點都要經過這裡。不認識的存取方式一律不放行。
func (s *Server) courseAccess(r *http.Request, id string) (courseAccessResponse, error) {
	access, err := s.cfg.Store.CourseAccess(r.Context(), id)
	if err != nil {
		return courseAccessResponse{}, err
	}
	result := courseAccessResponse{Access: access}
	if access == store.AccessFree {
		result.Allowed = true
		return result, nil
	}
	user, loggedIn := s.currentUser(r)
	if !loggedIn {
		result.Reason = "login_required"
		return result, nil
	}
	switch access {
	case store.AccessLoginFree:
		result.Allowed = true
	case store.AccessSubscription:
		result.Reason = "subscription_required"
		if s.cfg.Subscriptions != nil {
			_, subscribed, err := s.cfg.Subscriptions.Current(r.Context(), user.ID)
			if err != nil {
				return courseAccessResponse{}, err
			}
			if subscribed {
				result.Allowed, result.Reason = true, ""
			}
		}
	default:
		result.Reason = "subscription_required"
	}
	return result, nil
}
