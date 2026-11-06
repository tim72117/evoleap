package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/tim72117/evoleap/internal/auth"
	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/subscription"
	"github.com/tim72117/subscription/paddle"
)

// Paddle 的解析與訂閱規則的測試在 packages/subscription;這裡只確認專案的接線。

const testPaddleSecret = "pdl_ntfset_test"

var testPrices = []subscription.Price{
	{ID: "pri_sub", Period: subscription.BillingMonthly, Env: subscription.EnvSandbox},
	{ID: "pri_year", Period: subscription.BillingYearly, Env: subscription.EnvSandbox},
}

// newPaddleServer 回傳接上 Paddle 的伺服器;Paddle API 是假的,canceled 記下被取消的訂閱。
func newPaddleServer(t *testing.T) (h http.Handler, canceled *[]string) {
	t.Helper()
	return newPaddleServerOn(t, openTestStore(t))
}

func newPaddleServerOn(t *testing.T, st *store.Store) (h http.Handler, canceled *[]string) {
	t.Helper()
	canceled = &[]string{}
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)
		// 取消前會先查訂閱狀態;這裡一律回「還在續訂」,只記下真正送出的取消。
		if r.Method == http.MethodGet {
			io.WriteString(w, `{"data":{"status":"active","scheduled_change":null}}`)
			return
		}
		*canceled = append(*canceled, r.URL.Path)
		io.WriteString(w, `{"data":{}}`)
	}))
	t.Cleanup(api.Close)
	provider := paddle.New(paddle.Config{APIKey: "key", WebhookSecret: testPaddleSecret, BaseURL: api.URL})
	return New(Config{
		Store:         st,
		Subscriptions: testSubscriptionsWith(t, st, provider, testPrices...),
		Signer:        auth.NewSigner("test-secret", time.Hour),
		AdminEmails:   "admin@example.com",
	}).Routes(), canceled
}

func paddleSignature(secret, body string, at time.Time) string {
	ts := fmt.Sprint(at.Unix())
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + ":" + body))
	return "ts=" + ts + ";h1=" + hex.EncodeToString(mac.Sum(nil))
}

func postPaddle(h http.Handler, body, signature string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/paddle/webhook", strings.NewReader(body))
	req.Header.Set("Paddle-Signature", signature)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// withEventID 換掉事件 ID。同一個 ID 會被當成重送,不會再處理。
func withEventID(body, id string) string {
	return strings.Replace(body, "evt_1", id, 1)
}

func deliver(t *testing.T, h http.Handler, body string) {
	t.Helper()
	if rec := postPaddle(h, body, paddleSignature(testPaddleSecret, body, time.Now())); rec.Code != http.StatusOK {
		t.Fatalf("webhook: %d %s", rec.Code, rec.Body)
	}
}

func subscriptionEvent(status, userID, priceID string) string {
	return fmt.Sprintf(`{"event_id":"evt_1","event_type":"subscription.updated","occurred_at":"2026-11-05T08:00:00Z","data":{"id":"sub_1","status":%q,"custom_data":{"userId":%q},"items":[{"price":{"id":%q}}]}}`, status, userID, priceID)
}

// registerUser 註冊會員,回傳 cookie 與會員 ID。
func registerUser(t *testing.T, h http.Handler, email string) (*http.Cookie, string) {
	t.Helper()
	cookie := registerCookie(t, h, email)
	rec := call(h, http.MethodGet, "/api/me", "", cookie)
	body := rec.Body.String()
	_, rest, ok := strings.Cut(body, `"id":"`)
	if !ok {
		t.Fatalf("no id in /api/me: %s", body)
	}
	id, _, _ := strings.Cut(rest, `"`)
	return cookie, id
}

func planTier(t *testing.T, h http.Handler, cookie *http.Cookie) string {
	t.Helper()
	rec := call(h, http.MethodGet, "/api/plan/me", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("plan: %d %s", rec.Code, rec.Body)
	}
	_, rest, ok := strings.Cut(rec.Body.String(), `"currentTier":"`)
	if !ok {
		t.Fatalf("no tier: %s", rec.Body)
	}
	tier, _, _ := strings.Cut(rest, `"`)
	return tier
}

func TestPaddleWebhookRejectsBadSignature(t *testing.T) {
	h, _ := newPaddleServer(t)
	cookie, id := registerUser(t, h, "amy@example.com")
	body := subscriptionEvent("active", id, "pri_sub")
	if rec := postPaddle(h, body, paddleSignature("wrong", body, time.Now())); rec.Code != http.StatusUnauthorized {
		t.Errorf("%d %s", rec.Code, rec.Body)
	}
	if got := planTier(t, h, cookie); got != "free" {
		t.Errorf("未通過驗證不可開通: %s", got)
	}
}

func TestPaddleWebhookNotConfigured(t *testing.T) {
	h := New(Config{Store: openTestStore(t), Signer: auth.NewSigner("test-secret", time.Hour)}).Routes()
	body := subscriptionEvent("active", "u", "pri_sub")
	if rec := postPaddle(h, body, paddleSignature("", body, time.Now())); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("未設定金流不可接受事件: %d %s", rec.Code, rec.Body)
	}
}

func TestPaddleSubscriptionGrantsOnlyThatUser(t *testing.T) {
	h, _ := newPaddleServer(t)
	amy, amyID := registerUser(t, h, "amy@example.com")
	bob, _ := registerUser(t, h, "bob@example.com")

	body := subscriptionEvent("active", amyID, "pri_sub")
	deliver(t, h, body)
	deliver(t, h, body) // Paddle 重送

	if got := planTier(t, h, amy); got != "basic" {
		t.Errorf("amy: %s", got)
	}
	if got := planTier(t, h, bob); got != "free" {
		t.Errorf("bob: %s", got)
	}

	deliver(t, h, withEventID(strings.Replace(subscriptionEvent("canceled", amyID, "pri_sub"), "T08:00", "T09:00", 1), "evt_canceled"))
	if got := planTier(t, h, amy); got != "free" {
		t.Errorf("取消後: %s", got)
	}
}

func TestPaddleBothBillingPeriodsGrantSubscriber(t *testing.T) {
	h, _ := newPaddleServer(t)
	cookie, id := registerUser(t, h, "amy@example.com")
	deliver(t, h, subscriptionEvent("active", id, "pri_year"))
	if got := planTier(t, h, cookie); got != "basic" {
		t.Errorf("年繳: %s", got)
	}
	rec := call(h, http.MethodGet, "/api/plan/plans", "", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"prices":[{"id":"pri_sub","period":"monthly"},{"id":"pri_year","period":"yearly"}]`) {
		t.Errorf("價格: %d %s", rec.Code, rec.Body)
	}
}

func TestPaddleIgnoresUnknownPriceUserAndEvent(t *testing.T) {
	h, _ := newPaddleServer(t)
	cookie, id := registerUser(t, h, "amy@example.com")
	deliver(t, h, subscriptionEvent("active", id, "pri_other"))
	deliver(t, h, withEventID(subscriptionEvent("active", "", "pri_sub"), "evt_2"))
	deliver(t, h, `{"event_id":"evt_x","event_type":"customer.created","data":{"id":"ctm_1"}}`)
	if got := planTier(t, h, cookie); got != "free" {
		t.Errorf("不可開通: %s", got)
	}
}

func TestPaddleRefundRevokesAndCancels(t *testing.T) {
	h, canceled := newPaddleServer(t)
	cookie, id := registerUser(t, h, "amy@example.com")
	deliver(t, h, subscriptionEvent("active", id, "pri_sub"))

	refund := `{"event_id":"evt_adj","event_type":"adjustment.updated","occurred_at":"2026-11-05T09:00:00Z","data":{"action":"refund","type":"full","status":"approved","subscription_id":"sub_1"}}`
	deliver(t, h, refund)
	if got := planTier(t, h, cookie); got != "free" {
		t.Errorf("全額退款要停權: %s", got)
	}
	if len(*canceled) != 1 || (*canceled)[0] != "/subscriptions/sub_1/cancel" {
		t.Errorf("全額退款要停止續訂: %v", *canceled)
	}

	later := withEventID(strings.Replace(subscriptionEvent("active", id, "pri_sub"), "T08:00", "T10:00", 1), "evt_later")
	deliver(t, h, later)
	if got := planTier(t, h, cookie); got != "free" {
		t.Errorf("退款後不可復活: %s", got)
	}
}

func TestPaddleDuplicateSubscriptionIsCanceledAndRecorded(t *testing.T) {
	st := openTestStore(t)
	h, canceled := newPaddleServerOn(t, st)
	cookie, id := registerUser(t, h, "amy@example.com")
	deliver(t, h, subscriptionEvent("active", id, "pri_sub"))

	second := strings.NewReplacer(`"id":"sub_1"`, `"id":"sub_2"`, "evt_1", "evt_2", "T08:00", "T09:00").Replace(subscriptionEvent("active", id, "pri_sub"))
	deliver(t, h, second)
	deliver(t, h, second) // 重送不可再取消一次
	if len(*canceled) != 1 || (*canceled)[0] != "/subscriptions/sub_2/cancel" {
		t.Errorf("要取消新的那筆一次: %v", *canceled)
	}
	if got := planTier(t, h, cookie); got != "basic" {
		t.Errorf("原本的訂閱要保留: %s", got)
	}

	var outcome string
	if err := st.DB().Table("subscription_events").Select("outcome").Where("event_id = ?", "evt_2").Scan(&outcome).Error; err != nil {
		t.Fatal(err)
	}
	if outcome != "duplicate" {
		t.Errorf("事件紀錄: %q", outcome)
	}
}

func TestPaddleKeepsRecordOfUnmatchedEvents(t *testing.T) {
	st := openTestStore(t)
	h, _ := newPaddleServerOn(t, st)
	deliver(t, h, subscriptionEvent("active", "", "pri_sub"))
	var outcome string
	if err := st.DB().Table("subscription_events").Select("outcome").Where("event_id = ?", "evt_1").Scan(&outcome).Error; err != nil {
		t.Fatal(err)
	}
	if outcome != "unknown_user" {
		t.Errorf("對不上帳號也要留紀錄: %q", outcome)
	}
}

func TestPaddleTransactionKeepsPayment(t *testing.T) {
	st := openTestStore(t)
	h, _ := newPaddleServerOn(t, st)
	cookie, id := registerUser(t, h, "amy@example.com")
	deliver(t, h, subscriptionEvent("active", id, "pri_sub"))

	completed := `{"event_id":"evt_t","event_type":"transaction.completed","occurred_at":"2026-11-05T08:05:00Z","data":{"id":"txn_1","subscription_id":"sub_1","custom_data":null,"items":[{"price":{"id":"pri_sub"}}],"payments":[{"status":"captured","captured_at":"2026-11-05T08:00:00Z"}]}}`
	deliver(t, h, completed)
	deliver(t, h, completed) // Paddle 重送只留一筆
	deliver(t, h, `{"event_id":"evt_u","event_type":"transaction.completed","occurred_at":"2026-11-05T08:06:00Z","data":{"id":"txn_2","subscription_id":"sub_9","custom_data":null,"items":[]}}`)

	var payments []struct {
		TransactionID string
		UserID        string
		PaidAt        time.Time
	}
	if err := st.DB().Table("subscription_payments").Order("transaction_id").Find(&payments).Error; err != nil {
		t.Fatal(err)
	}
	if len(payments) != 2 || payments[0].TransactionID != "txn_1" || payments[0].UserID != id || payments[1].TransactionID != "txn_2" || payments[1].UserID != "" {
		t.Fatalf("付款紀錄: %+v", payments)
	}
	if want := time.Date(2026, 11, 5, 8, 0, 0, 0, time.UTC); !payments[0].PaidAt.Equal(want) {
		t.Errorf("付款時間: %v", payments[0].PaidAt)
	}
	var outcome string
	if err := st.DB().Table("subscription_events").Select("outcome").Where("transaction_id = ?", "txn_2").Scan(&outcome).Error; err != nil {
		t.Fatal(err)
	}
	if outcome != "unknown_user" {
		t.Errorf("事件紀錄: %q", outcome)
	}
	if got := planTier(t, h, cookie); got != "basic" {
		t.Errorf("付款事件不影響權限: %s", got)
	}
}

func TestPaddleRefundBeforeSubscriptionKeepsRevoked(t *testing.T) {
	h, canceled := newPaddleServer(t)
	cookie, id := registerUser(t, h, "amy@example.com")
	deliver(t, h, `{"event_id":"evt_adj","event_type":"adjustment.updated","occurred_at":"2026-11-05T09:00:00Z","data":{"action":"refund","type":"full","status":"approved","subscription_id":"sub_1"}}`)
	deliver(t, h, subscriptionEvent("active", id, "pri_sub"))
	if got := planTier(t, h, cookie); got != "free" {
		t.Errorf("已退款不可開通: %s", got)
	}
	if len(*canceled) != 1 || (*canceled)[0] != "/subscriptions/sub_1/cancel" {
		t.Errorf("要停止續訂: %v", *canceled)
	}
}

func TestPaddleIgnoresUserThatDoesNotExist(t *testing.T) {
	st := openTestStore(t)
	h, _ := newPaddleServerOn(t, st)
	deliver(t, h, subscriptionEvent("active", "someone-else", "pri_sub"))
	var outcome string
	if err := st.DB().Table("subscription_events").Select("outcome").Where("event_id = ?", "evt_1").Scan(&outcome).Error; err != nil {
		t.Fatal(err)
	}
	if outcome != "unknown_user" {
		t.Errorf("%q", outcome)
	}
}

func TestPaddleEventKeepsPayload(t *testing.T) {
	st := openTestStore(t)
	h, _ := newPaddleServerOn(t, st)
	_, id := registerUser(t, h, "amy@example.com")
	body := subscriptionEvent("active", id, "pri_sub")
	deliver(t, h, body)
	var payload string
	if err := st.DB().Table("subscription_events").Select("payload").Where("event_id = ?", "evt_1").Scan(&payload).Error; err != nil {
		t.Fatal(err)
	}
	if payload != body {
		t.Errorf("原始內容: %q", payload)
	}
}

func TestAdminDeleteUserStopsSubscriptionAndKeepsRecords(t *testing.T) {
	st := openTestStore(t)
	h, canceled := newPaddleServerOn(t, st)
	boss, err := st.UpsertGoogleUser(context.Background(), "sub-admin", "admin@example.com", true, "Boss")
	if err != nil {
		t.Fatal(err)
	}
	token, err := auth.NewSigner("test-secret", time.Hour).Sign(boss.ID)
	if err != nil {
		t.Fatal(err)
	}
	admin := &http.Cookie{Name: sessionCookie, Value: token}
	_, id := registerUser(t, h, "amy@example.com")
	deliver(t, h, subscriptionEvent("active", id, "pri_sub"))
	if rec := call(h, http.MethodDelete, "/api/admin/users/"+id, "", admin); rec.Code != http.StatusOK {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if len(*canceled) != 1 || (*canceled)[0] != "/subscriptions/sub_1/cancel" {
		t.Errorf("要停止續訂: %v", *canceled)
	}
	var kept int64
	if err := st.DB().Table("subscriptions").Where("user_id = ?", id).Count(&kept).Error; err != nil || kept != 1 {
		t.Errorf("訂閱紀錄要保留: %d %v", kept, err)
	}
}

func TestAdminReplaysEvent(t *testing.T) {
	st := openTestStore(t)
	h, _ := newPaddleServerOn(t, st)
	boss, err := st.UpsertGoogleUser(context.Background(), "sub-admin", "admin@example.com", true, "Boss")
	if err != nil {
		t.Fatal(err)
	}
	token, err := auth.NewSigner("test-secret", time.Hour).Sign(boss.ID)
	if err != nil {
		t.Fatal(err)
	}
	admin := &http.Cookie{Name: sessionCookie, Value: token}
	amy, id := registerUser(t, h, "amy@example.com")
	deliver(t, h, subscriptionEvent("active", id, "pri_sub"))
	if rec := call(h, http.MethodPost, "/api/admin/subscription-events/evt_1/replay", "", amy); rec.Code != http.StatusForbidden {
		t.Errorf("非管理員: %d", rec.Code)
	}
	if rec := call(h, http.MethodPost, "/api/admin/subscription-events/evt_1/replay", "", admin); rec.Code != http.StatusOK {
		t.Errorf("%d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodPost, "/api/admin/subscription-events/none/replay", "", admin); rec.Code != http.StatusNotFound {
		t.Errorf("沒有這個事件: %d", rec.Code)
	}
}
