package api

import (
	"errors"
	"net/http"

	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/subscription"
)

// handleCourseMap 回傳一門課的課程地圖(單元與每一堂課,資料來自 courses、course_units、lessons 表)。
// 公開資料,不用登入,登入功能沒開(沒設定 Google 登入)也照常回傳;只有沒接資料庫時回 503(前端改用內建的課程資料)。
// 每一堂的 access 已經套用過這門課的預設,前端照它標「免費預覽」「登入後學習」。
// 草稿(draft)的課只有管理員看得到狀態與腳本路徑(本機 -open-studio 也算),其他人看到的是規劃中。
func (s *Server) handleCourseMap(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "no_store", "課程資料庫尚未設定")
		return
	}
	admin := s.cfg.OpenAdmin
	if !admin {
		if user, ok := s.currentUser(r); ok {
			admin = s.isAdmin(user)
		}
	}
	m, err := s.cfg.Store.CourseMapOf(r.Context(), r.PathValue("id"), admin)
	if errors.Is(err, store.ErrCourseNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "找不到這門課")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	// 課程地圖只在部署時改變(種子資料),短暫快取即可。有草稿的課時內容依看的人不同(管理員登入前後也不同),一律不快取
	if m.HasDrafts() {
		w.Header().Set("Cache-Control", "private, no-store")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=60")
	}
	writeJSON(w, http.StatusOK, m)
}

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
