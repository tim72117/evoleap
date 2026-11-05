// Package paddle 用 Paddle Billing 實作 subscription.Provider。
package paddle

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/tim72117/subscription"
)

const (
	SandboxURL    = "https://sandbox-api.paddle.com"
	ProductionURL = "https://api.paddle.com"

	// Source 是記在訂閱紀錄上的來源代號。
	Source subscription.Source = "paddle"

	// 允許的時間差:Paddle 每次重送都會產生新的時間戳,這裡只需要容納兩邊的時鐘誤差。
	signatureMaxAge = 5 * time.Minute
	maxUserIDLen    = 64
	requestTimeout  = 10 * time.Second
)

// Config 是 Paddle 的設定。
type Config struct {
	// APIKey 用於建立結帳、取消與查詢訂閱;只處理 webhook 時可以留空。
	APIKey string
	// WebhookSecret 是通知目的地的簽章金鑰(pdl_ntfset_ 開頭),sandbox 與正式環境各有一把。
	WebhookSecret string
	// ClientToken 是前端 Paddle.js 用的 client-side token,可以公開。
	ClientToken string
	// BaseURL 留空時連 sandbox。
	BaseURL string
}

// Provider 實作 subscription.Provider。
type Provider struct {
	cfg    Config
	client *http.Client
}

var _ subscription.Provider = (*Provider)(nil)

func New(cfg Config) *Provider {
	if cfg.BaseURL == "" {
		cfg.BaseURL = SandboxURL
	}
	return &Provider{cfg: cfg, client: &http.Client{Timeout: requestTimeout}}
}

func (p *Provider) Source() subscription.Source { return Source }

// ClientConfig 回傳 Paddle.js 的 client token 與環境;沒有 token 時前端不載入 Paddle.js。
func (p *Provider) ClientConfig() map[string]string {
	if p.cfg.ClientToken == "" {
		return nil
	}
	environment := "sandbox"
	if p.cfg.BaseURL == ProductionURL {
		environment = "production"
	}
	return map[string]string{"token": p.cfg.ClientToken, "environment": environment}
}

// CreateCheckout 建立交易。回傳的 SessionID 是交易 ID,交給 Paddle.js 開啟結帳;
// URL 要在 Paddle 設定預設付款連結才會有。
func (p *Provider) CreateCheckout(ctx context.Context, req subscription.CheckoutRequest) (subscription.Checkout, error) {
	in := map[string]any{
		"items":       []map[string]any{{"price_id": req.PriceID, "quantity": 1}},
		"custom_data": map[string]string{"userId": req.UserID},
	}
	var out struct {
		ID       string `json:"id"`
		Checkout struct {
			URL string `json:"url"`
		} `json:"checkout"`
	}
	if err := p.call(ctx, http.MethodPost, "/transactions", in, &out); err != nil {
		return subscription.Checkout{}, err
	}
	return subscription.Checkout{URL: out.Checkout.URL, SessionID: out.ID}, nil
}

// Cancel 取消訂閱,下一個計費週期開始時生效。
func (p *Provider) Cancel(ctx context.Context, externalID string) error {
	in := map[string]string{"effective_from": "next_billing_period"}
	return p.call(ctx, http.MethodPost, "/subscriptions/"+url.PathEscape(externalID)+"/cancel", in, nil)
}

// ManageLinks 建立 Paddle 顧客入口的連結,連結是暫時的,每次要重新取得。API key 要有 customer_portal_session.write 權限。
func (p *Provider) ManageLinks(ctx context.Context, sub subscription.Subscription) (subscription.ManageLinks, error) {
	if sub.CustomerID == "" {
		return subscription.ManageLinks{}, errors.New("paddle: 訂閱沒有顧客 ID")
	}
	var out struct {
		URLs struct {
			General struct {
				Overview string `json:"overview"`
			} `json:"general"`
			Subscriptions []struct {
				ID               string `json:"id"`
				UpdatePaymentURL string `json:"update_subscription_payment_method"`
			} `json:"subscriptions"`
		} `json:"urls"`
	}
	in := map[string][]string{"subscription_ids": {sub.ExternalID}}
	if err := p.call(ctx, http.MethodPost, "/customers/"+url.PathEscape(sub.CustomerID)+"/portal-sessions", in, &out); err != nil {
		return subscription.ManageLinks{}, err
	}
	if out.URLs.General.Overview == "" {
		return subscription.ManageLinks{}, errors.New("paddle: 顧客入口沒有連結")
	}
	links := subscription.ManageLinks{URL: out.URLs.General.Overview}
	for _, item := range out.URLs.Subscriptions {
		if item.ID == sub.ExternalID {
			links.UpdatePaymentURL = item.UpdatePaymentURL
		}
	}
	return links, nil
}

// call 呼叫 Paddle API,out 對應回應的 data 欄位。
func (p *Provider) call(ctx context.Context, method, path string, in, out any) error {
	if p.cfg.APIKey == "" {
		return errors.New("paddle: 未設定 API key")
	}
	var body io.Reader
	if in != nil {
		raw, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, p.cfg.BaseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+p.cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("paddle: %s %s: %d %s", method, path, res.StatusCode, raw)
	}
	if out == nil {
		return nil
	}
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return fmt.Errorf("paddle: %s %s: %w", method, path, err)
	}
	return json.Unmarshal(envelope.Data, out)
}

type event struct {
	EventID    string          `json:"event_id"`
	EventType  string          `json:"event_type"`
	OccurredAt time.Time       `json:"occurred_at"`
	Data       json.RawMessage `json:"data"`
}

type customData struct {
	UserID string `json:"userId"`
}

// user 回傳結帳時帶的使用者 ID。userId 可能是瀏覽器帶的,只決定「記在誰身上」;太長的值不是我們的使用者 ID。
func (c customData) user() string {
	if len(c.UserID) > maxUserIDLen {
		return ""
	}
	return c.UserID
}

type item struct {
	Price struct {
		ID string `json:"id"`
	} `json:"price"`
}

type subscriptionData struct {
	ID              string     `json:"id"`
	Status          string     `json:"status"`
	CustomerID      string     `json:"customer_id"`
	CustomData      customData `json:"custom_data"`
	Items           []item     `json:"items"`
	ScheduledChange *struct {
		Action      string    `json:"action"`
		EffectiveAt time.Time `json:"effective_at"`
	} `json:"scheduled_change"`
	CurrentBillingPeriod *struct {
		EndsAt time.Time `json:"ends_at"`
	} `json:"current_billing_period"`
}

type transactionData struct {
	ID             string     `json:"id"`
	SubscriptionID string     `json:"subscription_id"`
	CustomData     customData `json:"custom_data"`
	Items          []item     `json:"items"`
	Payments       []struct {
		Status     string     `json:"status"`
		CapturedAt *time.Time `json:"captured_at"`
	} `json:"payments"`
}

type adjustmentData struct {
	Action         string `json:"action"`
	Type           string `json:"type"`
	Status         string `json:"status"`
	SubscriptionID string `json:"subscription_id"`
}

// ParseWebhook 驗證簽章後轉成共通事件。一定要用原始內容驗證簽章,不能先解析再重新序列化。
func (p *Provider) ParseWebhook(headers subscription.Header, body []byte) (*subscription.Event, error) {
	if !verifySignature(p.cfg.WebhookSecret, headers.Get("Paddle-Signature"), body, time.Now()) {
		return nil, fmt.Errorf("%w: 簽章不正確", subscription.ErrInvalidWebhook)
	}
	return p.ParseEvent(body)
}

// ParseEvent 解析通知內容,不驗證簽章。
func (p *Provider) ParseEvent(body []byte) (*subscription.Event, error) {
	var e event
	if err := json.Unmarshal(body, &e); err != nil {
		return nil, fmt.Errorf("%w: %v", subscription.ErrInvalidWebhook, err)
	}
	switch {
	case strings.HasPrefix(e.EventType, "subscription."):
		return parseSubscription(e)
	case e.EventType == "adjustment.created", e.EventType == "adjustment.updated":
		return parseAdjustment(e)
	case e.EventType == "transaction.completed":
		return parseTransaction(e)
	}
	return nil, nil
}

func parseSubscription(e event) (*subscription.Event, error) {
	var data subscriptionData
	if err := json.Unmarshal(e.Data, &data); err != nil {
		return nil, fmt.Errorf("%w: %v", subscription.ErrInvalidWebhook, err)
	}
	status, err := mapStatus(data.Status)
	if err != nil {
		return nil, err
	}
	out := &subscription.Event{
		ID:         e.EventID,
		Kind:       subscription.EventChanged,
		ExternalID: data.ID,
		UserID:     data.CustomData.user(),
		CustomerID: data.CustomerID,
		Status:     status,
		OccurredAt: e.OccurredAt,
	}
	if data.ScheduledChange != nil && data.ScheduledChange.Action == "cancel" {
		at := data.ScheduledChange.EffectiveAt
		out.CancelAt = &at
	}
	if len(data.Items) > 0 {
		out.PriceID = data.Items[0].Price.ID
	}
	if data.CurrentBillingPeriod != nil {
		end := data.CurrentBillingPeriod.EndsAt
		out.CurrentPeriodEnd = &end
	}
	return out, nil
}

// parseTransaction 轉成付款事件。付款時間取成功的那次付款,沒有時用事件時間。
func parseTransaction(e event) (*subscription.Event, error) {
	var data transactionData
	if err := json.Unmarshal(e.Data, &data); err != nil {
		return nil, fmt.Errorf("%w: %v", subscription.ErrInvalidWebhook, err)
	}
	if data.ID == "" {
		return nil, fmt.Errorf("%w: 交易沒有 ID", subscription.ErrInvalidWebhook)
	}
	out := &subscription.Event{
		ID:            e.EventID,
		Kind:          subscription.EventPaid,
		ExternalID:    data.SubscriptionID,
		UserID:        data.CustomData.user(),
		OccurredAt:    e.OccurredAt,
		TransactionID: data.ID,
		PaidAt:        e.OccurredAt,
	}
	if len(data.Items) > 0 {
		out.PriceID = data.Items[0].Price.ID
	}
	for _, payment := range data.Payments {
		if payment.Status == "captured" && payment.CapturedAt != nil {
			out.PaidAt = *payment.CapturedAt
			break
		}
	}
	return out, nil
}

// parseAdjustment:全額退款或爭議款核准後才停權;部分退款、不是訂閱的款項都不處理。
func parseAdjustment(e event) (*subscription.Event, error) {
	var data adjustmentData
	if err := json.Unmarshal(e.Data, &data); err != nil {
		return nil, fmt.Errorf("%w: %v", subscription.ErrInvalidWebhook, err)
	}
	isReversal := data.Action == "refund" || data.Action == "chargeback"
	if data.Status != "approved" || !isReversal || data.Type == "partial" || data.SubscriptionID == "" {
		return nil, nil
	}
	return &subscription.Event{
		ID:         e.EventID,
		Kind:       subscription.EventRevoked,
		ExternalID: data.SubscriptionID,
		OccurredAt: e.OccurredAt,
	}, nil
}

// mapStatus 不認識的狀態回傳錯誤,讓 Paddle 重送,不能猜測使用者有沒有權限。
func mapStatus(status string) (subscription.Status, error) {
	switch status {
	case "active", "trialing":
		return subscription.StatusActive, nil
	case "past_due":
		return subscription.StatusPastDue, nil
	case "paused":
		return subscription.StatusPaused, nil
	case "canceled":
		return subscription.StatusCanceled, nil
	}
	return "", fmt.Errorf("paddle: 不認識的訂閱狀態 %q", status)
}

// verifySignature 驗證 Paddle-Signature 標頭(ts=…;h1=…),簽章內容是「ts:原始內容」。
func verifySignature(secret, header string, body []byte, at time.Time) bool {
	var ts string
	var signatures []string
	for _, part := range strings.Split(header, ";") {
		key, value, _ := strings.Cut(part, "=")
		switch key {
		case "ts":
			ts = value
		case "h1":
			signatures = append(signatures, value)
		}
	}
	sec, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return false
	}
	if age := at.Sub(time.Unix(sec, 0)); age > signatureMaxAge || age < -signatureMaxAge {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + ":"))
	mac.Write(body)
	expected := mac.Sum(nil)
	for _, signature := range signatures {
		if got, err := hex.DecodeString(signature); err == nil && hmac.Equal(got, expected) {
			return true
		}
	}
	return false
}
