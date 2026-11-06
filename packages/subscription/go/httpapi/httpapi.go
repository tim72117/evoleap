// Package httpapi 提供訂閱功能的 HTTP handler。路徑、限流與使用者身分都由專案決定。
package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	"github.com/tim72117/subscription"
)

const (
	maxWebhookBody = 1 << 20
	maxRequestBody = 1 << 10
)

// Options 是專案提供的設定。
type Options struct {
	// UserID 回傳目前登入的使用者;未登入時第二個值為 false。
	UserID func(r *http.Request) (string, bool)
}

// Handler 的方法可以直接掛到專案的路由上。
type Handler struct {
	svc  *subscription.Service
	opts Options
}

func New(svc *subscription.Service, opts Options) *Handler {
	return &Handler{svc: svc, opts: opts}
}

// Me 回傳使用者目前的方案與全部方案。
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.opts.UserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "請先登入")
		return
	}
	if h.svc == nil {
		writeError(w, http.StatusServiceUnavailable, "plans_disabled", "方案功能未啟用")
		return
	}
	status, err := h.svc.Status(r.Context(), userID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

// Plans 回傳全部方案與價格,不需要登入。金流未設定時回空清單,畫面不該提供結帳。
func (h *Handler) Plans(w http.ResponseWriter, r *http.Request) {
	plans := []subscription.Plan{}
	provider := h.provider()
	if provider != nil {
		plans = h.svc.Plans()
	}
	body := map[string]any{"plans": plans}
	if provider != nil {
		if client := provider.ClientConfig(); client != nil {
			body["client"] = client
		}
	}
	writeJSON(w, http.StatusOK, body)
}

// Checkout 建立結帳。價格必須屬於某個方案,已有有效訂閱時不能重複結帳。
func (h *Handler) Checkout(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.paymentUser(w, r)
	if !ok {
		return
	}
	var req struct {
		PriceID string `json:"priceId"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRequestBody)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "內容無法讀取")
		return
	}
	if _, ok := h.svc.TierForPrice(req.PriceID); !ok {
		writeError(w, http.StatusBadRequest, "invalid_price", "沒有這個訂閱價格")
		return
	}
	_, subscribed, err := h.svc.Current(r.Context(), userID)
	if err != nil {
		internalError(w, err)
		return
	}
	if subscribed {
		writeError(w, http.StatusConflict, "already_subscribed", "已經訂閱了")
		return
	}
	checkout, err := h.provider().CreateCheckout(r.Context(), subscription.CheckoutRequest{UserID: userID, PriceID: req.PriceID})
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": checkout.URL, "sessionId": checkout.SessionID})
}

// changeTarget 讀取要換成的價格並找出要更換的訂閱;不符合條件時已寫好錯誤回應,第三個值為 false。
// 價格必須屬於某個方案、和目前的價格不同;使用者要有有效、不是重複的訂閱。
func (h *Handler) changeTarget(w http.ResponseWriter, r *http.Request) (subscription.Subscription, string, bool) {
	userID, ok := h.paymentUser(w, r)
	if !ok {
		return subscription.Subscription{}, "", false
	}
	var req struct {
		PriceID string `json:"priceId"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRequestBody)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "內容無法讀取")
		return subscription.Subscription{}, "", false
	}
	if _, ok := h.svc.TierForPrice(req.PriceID); !ok {
		writeError(w, http.StatusBadRequest, "invalid_price", "沒有這個訂閱價格")
		return subscription.Subscription{}, "", false
	}
	sub, subscribed, err := h.svc.Current(r.Context(), userID)
	if err != nil {
		internalError(w, err)
		return subscription.Subscription{}, "", false
	}
	if !subscribed || sub.Duplicate {
		writeError(w, http.StatusNotFound, "no_subscription", "沒有可以更換的訂閱")
		return subscription.Subscription{}, "", false
	}
	if sub.PriceID == req.PriceID {
		writeError(w, http.StatusConflict, "same_price", "已經是這個方案了")
		return subscription.Subscription{}, "", false
	}
	return sub, req.PriceID, true
}

// ChangePreview 試算更換方案的差額,不會真的更換。
func (h *Handler) ChangePreview(w http.ResponseWriter, r *http.Request) {
	sub, priceID, ok := h.changeTarget(w, r)
	if !ok {
		return
	}
	preview, err := h.provider().PreviewChange(r.Context(), sub.ExternalID, priceID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, preview)
}

// Change 更換方案(升級、降級或換計費週期),差額按比例立即結算。方案變更以之後收到的事件為準。
func (h *Handler) Change(w http.ResponseWriter, r *http.Request) {
	sub, priceID, ok := h.changeTarget(w, r)
	if !ok {
		return
	}
	if err := h.provider().ChangePlan(r.Context(), sub.ExternalID, priceID); err != nil {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Manage 回傳使用者管理訂閱的網址。
func (h *Handler) Manage(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.paymentUser(w, r)
	if !ok {
		return
	}
	sub, subscribed, err := h.svc.Current(r.Context(), userID)
	if err != nil {
		internalError(w, err)
		return
	}
	if !subscribed {
		writeError(w, http.StatusNotFound, "no_subscription", "沒有可以管理的訂閱")
		return
	}
	links, err := h.provider().ManageLinks(r.Context(), sub)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": links.URL, "updatePaymentUrl": links.UpdatePaymentURL})
}

// provider 回傳金流商;訂閱服務或金流商沒有設定時回傳 nil。
func (h *Handler) provider() subscription.Provider {
	if h.svc == nil {
		return nil
	}
	return h.svc.Provider()
}

// Replay 用保存的原始內容重新處理事件,路徑參數 id 是事件 ID。要由專案限制只有管理員能呼叫。
func (h *Handler) Replay(w http.ResponseWriter, r *http.Request) {
	if h.provider() == nil {
		writeError(w, http.StatusServiceUnavailable, "payments_disabled", "付款功能未啟用")
		return
	}
	outcome, err := h.svc.Replay(r.Context(), r.PathValue("id"))
	if errors.Is(err, subscription.ErrEventNotReplayable) {
		writeError(w, http.StatusNotFound, "not_replayable", "沒有這個事件,或原始內容已清除")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]subscription.Outcome{"outcome": outcome})
}

// paymentUser 確認已登入且金流已設定,否則寫好錯誤回應並回傳 false。
func (h *Handler) paymentUser(w http.ResponseWriter, r *http.Request) (string, bool) {
	userID, ok := h.opts.UserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized", "請先登入")
		return "", false
	}
	if h.provider() == nil {
		writeError(w, http.StatusServiceUnavailable, "payments_disabled", "付款功能未啟用")
		return "", false
	}
	return userID, true
}

// Webhook 接收金流商的通知。回非 2xx 時金流商會重送,所以只有處理成功或確定不需處理才回 2xx。
func (h *Handler) Webhook(w http.ResponseWriter, r *http.Request) {
	provider := h.provider()
	if provider == nil {
		writeError(w, http.StatusServiceUnavailable, "payments_disabled", "付款功能未啟用")
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxWebhookBody))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "內容無法讀取")
		return
	}
	ev, err := provider.ParseWebhook(r.Header, body)
	if errors.Is(err, subscription.ErrInvalidWebhook) {
		writeError(w, http.StatusUnauthorized, "invalid_webhook", "通知驗證失敗")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	if ev != nil {
		if err := h.apply(r, *ev, body); err != nil {
			internalError(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"received": true})
}

func (h *Handler) apply(r *http.Request, ev subscription.Event, body []byte) error {
	outcome, err := h.svc.Apply(r.Context(), ev, body)
	if err != nil {
		return err
	}
	if ev.Kind == subscription.EventPaid {
		if outcome != subscription.OutcomeApplied {
			log.Printf("subscription: 交易 %s 對不上(%s),訂閱 %q,價格 %q,要人工處理", ev.TransactionID, outcome, ev.ExternalID, ev.PriceID)
		}
		return nil
	}
	switch outcome {
	case subscription.OutcomeUnknownPrice:
		log.Printf("subscription: 訂閱 %s 的價格 %q 沒有對應的方案,要人工處理", ev.ExternalID, ev.PriceID)
	case subscription.OutcomeUnknownUser:
		log.Printf("subscription: 訂閱 %s 對不上帳號,要人工處理", ev.ExternalID)
	case subscription.OutcomeDuplicate:
		log.Printf("subscription: 使用者 %s 重複訂閱 %s,已停止續訂,已付款項要人工退款", ev.UserID, ev.ExternalID)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}

func internalError(w http.ResponseWriter, err error) {
	log.Printf("subscription: %v", err)
	writeError(w, http.StatusInternalServerError, "internal", "伺服器發生錯誤，請稍後再試")
}
