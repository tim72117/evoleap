package paddle

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/tim72117/subscription"
)

const testSecret = "pdl_ntfset_test"

func sign(secret, body string, at time.Time) http.Header {
	ts := fmt.Sprint(at.Unix())
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + ":" + body))
	h := http.Header{}
	h.Set("Paddle-Signature", "ts="+ts+";h1="+hex.EncodeToString(mac.Sum(nil)))
	return h
}

func parse(t *testing.T, body string) *subscription.Event {
	t.Helper()
	ev, err := New(Config{WebhookSecret: testSecret}).ParseWebhook(sign(testSecret, body, time.Now()), []byte(body))
	if err != nil {
		t.Fatalf("parse %s: %v", body, err)
	}
	return ev
}

func TestParseWebhookRejectsBadSignatures(t *testing.T) {
	p := New(Config{WebhookSecret: testSecret})
	body := `{"event_id":"evt_1","event_type":"subscription.activated","data":{"status":"active"}}`
	now := time.Now()
	cases := map[string]http.Header{
		"沒有簽章":  {},
		"金鑰錯誤":  sign("wrong", body, now),
		"內容被改":  sign(testSecret, body+" ", now),
		"時間太舊":  sign(testSecret, body, now.Add(-time.Hour)),
		"時間在未來": sign(testSecret, body, now.Add(time.Hour)),
		"格式錯誤":  {"Paddle-Signature": {"ts=abc;h1=zz"}},
	}
	for name, headers := range cases {
		if _, err := p.ParseWebhook(headers, []byte(body)); !errors.Is(err, subscription.ErrInvalidWebhook) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestParseSubscriptionEvent(t *testing.T) {
	ev := parse(t, `{"event_id":"evt_1","event_type":"subscription.activated","occurred_at":"2026-11-05T08:00:00.123Z","data":{
		"id":"sub_1","status":"active","customer_id":"ctm_1","custom_data":{"userId":"amy"},
		"items":[{"price":{"id":"pri_1"}}],
		"scheduled_change":{"action":"cancel","effective_at":"2026-12-05T08:00:00Z","resume_at":null},
		"current_billing_period":{"starts_at":"2026-11-05T08:00:00Z","ends_at":"2026-12-05T08:00:00Z"}}}`)
	end := time.Date(2026, 12, 5, 8, 0, 0, 0, time.UTC)
	if ev.ID != "evt_1" || ev.Kind != subscription.EventChanged || ev.ExternalID != "sub_1" || ev.UserID != "amy" ||
		ev.PriceID != "pri_1" || ev.Status != subscription.StatusActive || !ev.CurrentPeriodEnd.Equal(end) || ev.OccurredAt.IsZero() ||
		ev.CustomerID != "ctm_1" || !ev.CancelAt.Equal(end) {
		t.Errorf("%+v", ev)
	}
	ev = parse(t, `{"event_type":"subscription.updated","data":{"id":"sub_1","status":"active","scheduled_change":{"action":"pause","effective_at":"2026-12-05T08:00:00Z"}}}`)
	if ev.CancelAt != nil {
		t.Errorf("暫停不是取消: %+v", ev.CancelAt)
	}
}

func TestParseSubscriptionStatuses(t *testing.T) {
	for paddle, want := range map[string]subscription.Status{
		"active":   subscription.StatusActive,
		"trialing": subscription.StatusActive,
		"past_due": subscription.StatusPastDue,
		"paused":   subscription.StatusPaused,
		"canceled": subscription.StatusCanceled,
	} {
		ev := parse(t, fmt.Sprintf(`{"event_type":"subscription.updated","data":{"id":"sub_1","status":%q,"current_billing_period":null,"custom_data":null}}`, paddle))
		if ev.Status != want {
			t.Errorf("%s: %q", paddle, ev.Status)
		}
	}
	body := `{"event_type":"subscription.updated","data":{"id":"sub_1","status":"new_status"}}`
	if _, err := New(Config{WebhookSecret: testSecret}).ParseWebhook(sign(testSecret, body, time.Now()), []byte(body)); err == nil || errors.Is(err, subscription.ErrInvalidWebhook) {
		t.Errorf("不認識的狀態要讓 Paddle 重送: %v", err)
	}
}

func TestParseDropsOversizedUserID(t *testing.T) {
	ev := parse(t, fmt.Sprintf(`{"event_type":"subscription.created","data":{"id":"sub_1","status":"active","custom_data":{"userId":%q}}}`, strings.Repeat("x", 100)))
	if ev.UserID != "" {
		t.Errorf("%q", ev.UserID)
	}
}

func TestParseAdjustment(t *testing.T) {
	adjustment := func(action, kind, status, sub string) string {
		return fmt.Sprintf(`{"event_id":"evt_adj","event_type":"adjustment.updated","occurred_at":"2026-11-05T08:00:00Z","data":{"action":%q,"type":%q,"status":%q,"subscription_id":%q}}`, action, kind, status, sub)
	}
	for _, body := range []string{
		adjustment("refund", "partial", "approved", "sub_1"),
		adjustment("refund", "full", "pending_approval", "sub_1"),
		adjustment("refund", "full", "rejected", "sub_1"),
		adjustment("credit", "full", "approved", "sub_1"),
		adjustment("refund", "full", "approved", ""),
	} {
		if ev := parse(t, body); ev != nil {
			t.Errorf("%s 不該停權: %+v", body, ev)
		}
	}
	for _, action := range []string{"refund", "chargeback"} {
		ev := parse(t, adjustment(action, "full", "approved", "sub_1"))
		if ev == nil || ev.Kind != subscription.EventRevoked || ev.ExternalID != "sub_1" || ev.OccurredAt.IsZero() {
			t.Errorf("%s: %+v", action, ev)
		}
	}
}

func TestParseTransactionCompleted(t *testing.T) {
	ev := parse(t, `{"event_id":"evt_t","event_type":"transaction.completed","occurred_at":"2026-11-05T08:05:00Z","data":{
		"id":"txn_1","subscription_id":"sub_1","custom_data":{"userId":"amy"},
		"items":[{"price":{"id":"pri_1"}}],
		"payments":[{"status":"error","captured_at":null},{"status":"captured","captured_at":"2026-11-05T08:00:00Z"}]}}`)
	paidAt := time.Date(2026, 11, 5, 8, 0, 0, 0, time.UTC)
	if ev.ID != "evt_t" || ev.Kind != subscription.EventPaid || ev.TransactionID != "txn_1" || ev.ExternalID != "sub_1" ||
		ev.UserID != "amy" || ev.PriceID != "pri_1" || !ev.PaidAt.Equal(paidAt) {
		t.Errorf("%+v", ev)
	}
	// 續訂的交易可能沒有 custom_data,也可能沒有成功付款的時間。
	ev = parse(t, `{"event_id":"evt_t","event_type":"transaction.completed","occurred_at":"2026-11-05T08:05:00Z","data":{"id":"txn_2","subscription_id":null,"custom_data":null,"items":[],"payments":[]}}`)
	if ev.UserID != "" || ev.ExternalID != "" || !ev.PaidAt.Equal(paidAt.Add(5*time.Minute)) {
		t.Errorf("%+v", ev)
	}
	body := `{"event_type":"transaction.completed","data":{}}`
	if _, err := New(Config{WebhookSecret: testSecret}).ParseWebhook(sign(testSecret, body, time.Now()), []byte(body)); !errors.Is(err, subscription.ErrInvalidWebhook) {
		t.Errorf("沒有交易 ID: %v", err)
	}
	if ev := parse(t, `{"event_type":"transaction.paid","data":{"id":"txn_1"}}`); ev != nil {
		t.Errorf("只處理 completed: %+v", ev)
	}
}

func TestParseEventSkipsSignature(t *testing.T) {
	ev, err := New(Config{WebhookSecret: testSecret}).ParseEvent([]byte(`{"event_id":"evt_1","event_type":"subscription.updated","data":{"id":"sub_1","status":"active"}}`))
	if err != nil || ev == nil || ev.ID != "evt_1" {
		t.Errorf("%+v %v", ev, err)
	}
}

func TestParseIgnoresOtherEvents(t *testing.T) {
	if ev := parse(t, `{"event_type":"customer.created","data":{"id":"ctm_1"}}`); ev != nil {
		t.Errorf("%+v", ev)
	}
}

// fakeAPI 回傳固定內容,並記下收到的請求。
func fakeAPI(t *testing.T, response string) (*Provider, *string) {
	t.Helper()
	var got string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		got = r.Method + " " + r.URL.Path + " " + r.Header.Get("Authorization") + " " + string(body)
		io.WriteString(w, response)
	}))
	t.Cleanup(srv.Close)
	return New(Config{APIKey: "key", BaseURL: srv.URL}), &got
}

func TestClientConfig(t *testing.T) {
	if got := New(Config{}).ClientConfig(); got != nil {
		t.Errorf("沒有 token: %v", got)
	}
	if got := New(Config{ClientToken: "test_1"}).ClientConfig(); got["token"] != "test_1" || got["environment"] != "sandbox" {
		t.Errorf("sandbox: %v", got)
	}
	if got := New(Config{ClientToken: "live_1", BaseURL: ProductionURL}).ClientConfig(); got["environment"] != "production" {
		t.Errorf("production: %v", got)
	}
}

func TestCreateCheckout(t *testing.T) {
	p, got := fakeAPI(t, `{"data":{"id":"txn_1","checkout":{"url":"https://pay.example/txn_1"}}}`)
	checkout, err := p.CreateCheckout(context.Background(), subscription.CheckoutRequest{UserID: "amy", PriceID: "pri_1"})
	if err != nil {
		t.Fatal(err)
	}
	if checkout.SessionID != "txn_1" || checkout.URL != "https://pay.example/txn_1" {
		t.Errorf("%+v", checkout)
	}
	for _, want := range []string{"POST /transactions Bearer key", `"price_id":"pri_1"`, `"userId":"amy"`} {
		if !strings.Contains(*got, want) {
			t.Errorf("缺少 %s: %s", want, *got)
		}
	}
}

func TestCancelTakesEffectAtPeriodEnd(t *testing.T) {
	p, got := fakeAPI(t, `{"data":{}}`)
	if err := p.Cancel(context.Background(), "sub_1"); err != nil {
		t.Fatal(err)
	}
	if want := `POST /subscriptions/sub_1/cancel Bearer key {"effective_from":"next_billing_period"}`; *got != want {
		t.Errorf("%s", *got)
	}
}

func TestManageLinks(t *testing.T) {
	sub := subscription.Subscription{ExternalID: "sub_1", CustomerID: "ctm_1"}
	p, got := fakeAPI(t, `{"data":{"urls":{"general":{"overview":"https://pay.example/overview"},"subscriptions":[{"id":"sub_1","update_subscription_payment_method":"https://pay.example/card","cancel_subscription":"https://pay.example/cancel"}]}}}`)
	links, err := p.ManageLinks(context.Background(), sub)
	if err != nil || links.URL != "https://pay.example/overview" || links.UpdatePaymentURL != "https://pay.example/card" {
		t.Errorf("%+v %v", links, err)
	}
	if want := `POST /customers/ctm_1/portal-sessions Bearer key {"subscription_ids":["sub_1"]}`; *got != want {
		t.Errorf("%s", *got)
	}
	p, _ = fakeAPI(t, `{"data":{"urls":{"general":{"overview":""}}}}`)
	if _, err := p.ManageLinks(context.Background(), sub); err == nil {
		t.Error("沒有連結要回傳錯誤")
	}
	if _, err := p.ManageLinks(context.Background(), subscription.Subscription{ExternalID: "sub_1"}); err == nil {
		t.Error("沒有顧客 ID 要回傳錯誤")
	}
}

func TestAPIErrors(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":{"code":"forbidden"}}`, http.StatusForbidden)
	}))
	defer srv.Close()
	if err := New(Config{APIKey: "key", BaseURL: srv.URL}).Cancel(context.Background(), "sub_1"); err == nil {
		t.Error("非 2xx 要回傳錯誤")
	}
	if err := New(Config{BaseURL: srv.URL}).Cancel(context.Background(), "sub_1"); err == nil {
		t.Error("沒有 API key 要回傳錯誤")
	}
}
