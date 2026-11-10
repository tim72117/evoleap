package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/tim72117/evoleap/internal/plans"
	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/subscription"
)

// 方案與廣告方案(看廣告換觀看權)的端點。方案紀錄在 packages/subscription,這裡只管路由、登入與片頭廣告的通行證。
//
// 流程:訂閱課程的單課頁先問 GET /api/courses/{id}/access?lesson=;沒有方案時前端轉到收費頁,選了廣告方案(POST /api/plan/ads)後回來。
// 廣告方案的人每一課要先看片頭廣告:POST /api/plan/ads/start 拿到開始時間的簽章,過了 plans.AdSeconds 秒再 POST /api/plan/ads/finish,
// 伺服器發這一課的通行證(HttpOnly cookie,plans.AdPassTTL 內有效),腳本檔(GET /api/scripts)看到通行證才給。
// 網頁廣告沒辦法由伺服器確認真的看完,這裡只確認時間到了;所以廣告方案只涵蓋 basic 的課程。

const (
	adStartPurpose = "ad-start"
	adPassPurpose  = "ad-pass"
	adPassCookie   = "evoleap_ad_pass"
	// adStartTTL 是開始播放的簽章多久內可以換通行證,太舊的不收
	adStartTTL = 10 * time.Minute
)

// simulateHeader 是管理員在前端「模擬身分」時帶的標頭(會員空間的切換:guest、member、subscriber)。
// 只有真正的管理員送的才算數,其他人送了一律忽略;只影響這個檔案裡的權限判斷(課程權限、方案狀態),不影響腳本檔與後台。
const simulateHeader = "X-Simulate-Role"

// simulatedRole 回傳管理員正在模擬的身分;不是管理員、或沒有模擬時回傳空字串。
func (s *Server) simulatedRole(r *http.Request, user store.User) string {
	if !s.isAdmin(user) {
		return ""
	}
	switch role := r.Header.Get(simulateHeader); role {
	case "guest", "member", "subscriber":
		return role
	}
	return ""
}

// adNow 是片頭廣告計時用的目前時間,測試可以替換。
var adNow = time.Now

func (s *Server) planRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/plan/me", s.requirePlans(s.requireUser(s.handlePlanMe)))
	mux.HandleFunc("POST /api/plan/ads", s.requirePlans(s.requireSiteUser(s.handleChooseAds)))
	mux.HandleFunc("POST /api/plan/ads/start", s.requirePlans(s.requireUser(s.handleAdStart)))
	mux.HandleFunc("POST /api/plan/ads/finish", s.requirePlans(s.requireUser(s.handleAdFinish)))
	mux.HandleFunc("GET /api/courses/{id}/access", s.handleCourseAccess)
}

// requirePlans:沒接資料庫時沒有方案服務,回 503。
func (s *Server) requirePlans(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.Plans == nil {
			writeError(w, http.StatusServiceUnavailable, "plans_disabled", "方案功能尚未開放")
			return
		}
		h(w, r)
	}
}

// userPlan 是使用者目前的方案。
type userPlan struct {
	// Plan:free(沒有方案)、ads(廣告方案)、subscription(付費訂閱,金流接上後才會有)
	Plan string            `json:"plan"`
	Tier subscription.Tier `json:"tier"`
	// paid、ads 是各自涵蓋的最高等級;沒有時是空字串
	paid subscription.Tier
	ads  subscription.Tier
}

// simulatedSubscriber 為 true 時,不管紀錄怎麼寫都當成付費訂閱者(管理員模擬「已訂閱」)。
func (s *Server) planOf(r *http.Request, userID string, simulatedSubscriber bool) (userPlan, error) {
	p := userPlan{Plan: "free", Tier: plans.Catalog.Default}
	if s.cfg.Plans == nil {
		if simulatedSubscriber {
			p.Plan, p.Tier, p.paid = "subscription", plans.Advanced, plans.Advanced
		}
		return p, nil
	}
	active, err := s.cfg.Plans.Active(r.Context(), userID)
	if err != nil {
		return p, err
	}
	// Active 由高到低排,每種來源取第一筆就是最高的
	for _, sub := range active {
		if sub.Source == plans.SourceAds {
			if p.ads == "" {
				p.ads = sub.Tier
			}
		} else if p.paid == "" {
			p.paid = sub.Tier
		}
	}
	if simulatedSubscriber {
		p.paid = plans.Advanced
	}
	switch {
	case p.paid != "":
		p.Plan, p.Tier = "subscription", p.paid
	case p.ads != "":
		p.Plan, p.Tier = "ads", p.ads
	}
	return p, nil
}

func (s *Server) handlePlanMe(w http.ResponseWriter, r *http.Request, user store.User) {
	p, err := s.planOf(r, user.ID, s.simulatedRole(r, user) == "subscriber")
	if err != nil {
		internalError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, p)
}

// handleChooseAds 選擇廣告方案。重複選不會多一筆;已經有付費訂閱的人也可以選,但權限照較高的算。
func (s *Server) handleChooseAds(w http.ResponseWriter, r *http.Request, user store.User) {
	err := s.cfg.Plans.Grant(r.Context(), subscription.Subscription{
		Source: plans.SourceAds, ExternalID: user.ID, UserID: user.ID, Tier: plans.AdsTier,
	})
	if err != nil {
		internalError(w, err)
		return
	}
	s.handlePlanMe(w, r, user)
}

// lessonDecision 是一個人能不能看一課的結果。
type lessonDecision struct {
	Allowed bool
	// Reason:login_required、plan_required(不放行時)
	Reason string
	// Ad 為 true 代表要先看片頭廣告(廣告方案,還沒有這一課的通行證)
	Ad bool
}

// decideLesson 判斷權限,課程頁的權限查詢與腳本檔都經過這裡。不認識的存取方式一律不放行。
func (s *Server) decideLesson(r *http.Request, courseID, lessonID string, la store.LessonAccess) (lessonDecision, error) {
	if la.Access == store.AccessFree {
		return lessonDecision{Allowed: true}, nil
	}
	user, loggedIn := s.currentUser(r)
	if !loggedIn {
		return lessonDecision{Reason: "login_required"}, nil
	}
	role := s.simulatedRole(r, user)
	if role == "guest" {
		return lessonDecision{Reason: "login_required"}, nil
	}
	if s.isAdmin(user) && role == "" {
		return lessonDecision{Allowed: true}, nil
	}
	switch la.Access {
	case store.AccessLoginFree:
		return lessonDecision{Allowed: true}, nil
	case store.AccessSubscription:
	default:
		return lessonDecision{Reason: "plan_required"}, nil
	}
	p, err := s.planOf(r, user.ID, role == "subscriber")
	if err != nil {
		return lessonDecision{}, err
	}
	need := subscription.Tier(la.Tier)
	if p.paid != "" && plans.Catalog.Covers(p.paid, need) {
		return lessonDecision{Allowed: true}, nil
	}
	if p.ads != "" && plans.Catalog.Covers(p.ads, need) {
		return lessonDecision{Allowed: true, Ad: !s.hasAdPass(r, user.ID, courseID, lessonID)}, nil
	}
	return lessonDecision{Reason: "plan_required"}, nil
}

type courseAccessResponse struct {
	Access  store.Access `json:"access"`
	Allowed bool         `json:"allowed"`
	Reason  string       `json:"reason,omitempty"`
	Ad      bool         `json:"ad,omitempty"`
}

// handleCourseAccess 回傳目前的使用者能不能看這門課的某一課(?lesson=,沒帶就看整門課),未登入也可以呼叫。
func (s *Server) handleCourseAccess(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "no_store", "課程資料庫尚未設定")
		return
	}
	courseID, lessonID := r.PathValue("id"), r.URL.Query().Get("lesson")
	la, err := s.cfg.Store.LessonAccessOf(r.Context(), courseID, lessonID)
	if errors.Is(err, store.ErrCourseNotFound) || errors.Is(err, store.ErrLessonFileNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "找不到這門課")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	d, err := s.decideLesson(r, courseID, lessonID, la)
	if err != nil {
		internalError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, courseAccessResponse{Access: la.Access, Allowed: d.Allowed, Reason: d.Reason, Ad: d.Ad})
}

// adClaims 是片頭廣告簽章的內容:開始播放(ad-start)與通行證(ad-pass)共用,At 分別是開始時間與到期時間(Unix 毫秒)。
type adClaims struct {
	User   string `json:"u"`
	Course string `json:"c"`
	Lesson string `json:"l"`
	At     int64  `json:"t"`
}

func (s *Server) signAd(purpose string, c adClaims) string {
	b, _ := json.Marshal(c)
	return s.cfg.Signer.SignPurpose(purpose, b)
}

func (s *Server) verifyAd(purpose, token string) (adClaims, bool) {
	raw, err := s.cfg.Signer.VerifyPurpose(purpose, token)
	if err != nil {
		return adClaims{}, false
	}
	var c adClaims
	if json.Unmarshal(raw, &c) != nil || c.User == "" || c.Course == "" {
		return adClaims{}, false
	}
	return c, true
}

// hasAdPass 回傳請求帶的通行證是不是這個人、這一課的,而且還沒過期。
func (s *Server) hasAdPass(r *http.Request, userID, courseID, lessonID string) bool {
	cookie, err := r.Cookie(adPassCookie)
	if err != nil {
		return false
	}
	c, ok := s.verifyAd(adPassPurpose, cookie.Value)
	return ok && c.User == userID && c.Course == courseID && c.Lesson == lessonID && adNow().UnixMilli() <= c.At
}

type adLessonRequest struct {
	Course string `json:"course"`
	Lesson string `json:"lesson"`
}

// handleAdStart 開始播放片頭廣告:回傳開始時間的簽章與要等的秒數。只有廣告方案、而且這一課在廣告方案涵蓋範圍內的人可以開始。
func (s *Server) handleAdStart(w http.ResponseWriter, r *http.Request, user store.User) {
	var req adLessonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Course == "" || req.Lesson == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "缺少課程或課號")
		return
	}
	la, err := s.cfg.Store.LessonAccessOf(r.Context(), req.Course, req.Lesson)
	if errors.Is(err, store.ErrCourseNotFound) || errors.Is(err, store.ErrLessonFileNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "找不到這一課")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	p, err := s.planOf(r, user.ID, false)
	if err != nil {
		internalError(w, err)
		return
	}
	if p.ads == "" || la.Access != store.AccessSubscription || !plans.Catalog.Covers(p.ads, subscription.Tier(la.Tier)) {
		writeError(w, http.StatusForbidden, "plan_required", "這一課不在你的方案裡")
		return
	}
	token := s.signAd(adStartPurpose, adClaims{User: user.ID, Course: req.Course, Lesson: req.Lesson, At: adNow().UnixMilli()})
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "seconds": plans.AdSeconds})
}

// handleAdFinish 片頭廣告播完:確認開始的時間夠久,發這一課的通行證(HttpOnly cookie)。
func (s *Server) handleAdFinish(w http.ResponseWriter, r *http.Request, user store.User) {
	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_token", "廣告紀錄無效，請重新整理")
		return
	}
	c, ok := s.verifyAd(adStartPurpose, req.Token)
	now := adNow()
	if !ok || c.User != user.ID || now.Sub(time.UnixMilli(c.At)) > adStartTTL {
		writeError(w, http.StatusBadRequest, "invalid_token", "廣告紀錄無效，請重新整理")
		return
	}
	// 留一點誤差給網路延遲
	if now.Sub(time.UnixMilli(c.At)) < plans.AdSeconds*time.Second-time.Second {
		writeError(w, http.StatusConflict, "too_early", "廣告還沒播完")
		return
	}
	pass := s.signAd(adPassPurpose, adClaims{User: user.ID, Course: c.Course, Lesson: c.Lesson, At: now.Add(plans.AdPassTTL).UnixMilli()})
	http.SetCookie(w, &http.Cookie{
		Name:     adPassCookie,
		Value:    pass,
		Path:     "/",
		MaxAge:   int(plans.AdPassTTL.Seconds()),
		HttpOnly: true,
		Secure:   s.cfg.SecureCookie,
		SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusNoContent)
}
