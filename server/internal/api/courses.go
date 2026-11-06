package api

import (
	"errors"
	"net/http"

	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/subscription"
)

// courseAccessResponse 是使用者能不能看這門課。
type courseAccessResponse struct {
	Access  store.Access `json:"access"`
	Allowed bool         `json:"allowed"`
	Reason  string       `json:"reason,omitempty"`
	// Plan 是訂閱課程需要的最低方案名稱(例如「進階方案」),沒權限時畫面用來說明要訂哪個方案。
	Plan string `json:"plan,omitempty"`
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
	access, tier, err := s.cfg.Store.CourseAccess(r.Context(), id)
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
		// 要有有效訂閱,而且方案包含這門課需要的方案(進階包含基礎);沒寫方案或方案不存在一律不放行
		result.Reason = "subscription_required"
		if s.cfg.Subscriptions != nil {
			need := subscription.Tier(tier)
			if plan, ok := s.cfg.Subscriptions.Plan(need); ok {
				result.Plan = plan.Name
			}
			sub, subscribed, err := s.cfg.Subscriptions.Current(r.Context(), user.ID)
			if err != nil {
				return courseAccessResponse{}, err
			}
			if subscribed && s.cfg.Subscriptions.Includes(sub.Tier, need) {
				result.Allowed, result.Reason, result.Plan = true, "", ""
			}
		}
	default:
		result.Reason = "subscription_required"
	}
	return result, nil
}
