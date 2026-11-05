package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/glebarez/sqlite"
	"github.com/tim72117/subscription/gormstore"
	"gorm.io/gorm"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/tim72117/subscription"
)

var _ subscription.Header = http.Header{}

// newStore 回傳記憶體裡的資料表。
func newStore(t *testing.T) *gormstore.Store {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { sqlDB.Close() })
	store, err := gormstore.New(db)
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func newHandler(t *testing.T) (*Handler, *subscription.Service) {
	t.Helper()
	svc := subscription.New(newStore(t), subscription.Catalog{
		Default: "free",
		Plans:   []subscription.Plan{{Tier: "free", Name: "免費版"}, {Tier: "pro", Name: "付費版"}},
	}, subscription.Options{})
	return New(svc, Options{
		UserID: func(r *http.Request) (string, bool) {
			id := r.Header.Get("X-User")
			return id, id != ""
		},
	}), svc
}

func me(h *Handler, user string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if user != "" {
		req.Header.Set("X-User", user)
	}
	rec := httptest.NewRecorder()
	h.Me(rec, req)
	return rec
}

func currentTier(t *testing.T, rec *httptest.ResponseRecorder) subscription.Tier {
	t.Helper()
	var body subscription.PlanStatus
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v (%s)", err, rec.Body)
	}
	return body.CurrentTier
}

// fakeProvider 是假的金流商。
type fakeProvider struct{ subscription.Provider }

func (fakeProvider) Source() subscription.Source { return "fake" }

func (fakeProvider) ClientConfig() map[string]string {
	return map[string]string{"token": "test_1"}
}

func (fakeProvider) CreateCheckout(_ context.Context, req subscription.CheckoutRequest) (subscription.Checkout, error) {
	return subscription.Checkout{SessionID: "txn_" + req.UserID}, nil
}

func (fakeProvider) ManageLinks(_ context.Context, sub subscription.Subscription) (subscription.ManageLinks, error) {
	return subscription.ManageLinks{URL: "https://pay.example/" + sub.ExternalID, UpdatePaymentURL: "https://pay.example/card/" + sub.ExternalID}, nil
}

func newPaymentHandler(t *testing.T) (*Handler, *subscription.Service) {
	t.Helper()
	svc := subscription.New(newStore(t), subscription.Catalog{
		Default: "free",
		Plans:   []subscription.Plan{{Tier: "free"}, {Tier: "pro", Prices: []subscription.Price{{ID: "pri_pro", Period: subscription.BillingMonthly}}}},
	}, subscription.Options{Provider: fakeProvider{}})
	return New(svc, Options{
		UserID: func(r *http.Request) (string, bool) {
			id := r.Header.Get("X-User")
			return id, id != ""
		},
	}), svc
}

// subscribe 讓使用者有一筆有效的訂閱。
func subscribe(t *testing.T, svc *subscription.Service, user string) {
	t.Helper()
	ev := subscription.Event{ID: "evt_" + user, Kind: subscription.EventChanged, ExternalID: "sub_" + user, UserID: user, PriceID: "pri_pro", Status: subscription.StatusActive}
	if _, err := svc.Apply(context.Background(), ev, []byte("{}")); err != nil {
		t.Fatal(err)
	}
}

func post(handler http.HandlerFunc, user, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	if user != "" {
		req.Header.Set("X-User", user)
	}
	rec := httptest.NewRecorder()
	handler(rec, req)
	return rec
}

func TestCheckout(t *testing.T) {
	h, svc := newPaymentHandler(t)
	if rec := post(h.Checkout, "", `{"priceId":"pri_pro"}`); rec.Code != http.StatusUnauthorized {
		t.Errorf("未登入: %d", rec.Code)
	}
	if rec := post(h.Checkout, "amy", `{"priceId":"pri_other"}`); rec.Code != http.StatusBadRequest {
		t.Errorf("不認識的價格: %d", rec.Code)
	}
	if rec := post(h.Checkout, "amy", `not json`); rec.Code != http.StatusBadRequest {
		t.Errorf("內容錯誤: %d", rec.Code)
	}
	rec := post(h.Checkout, "amy", `{"priceId":"pri_pro"}`)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "txn_amy") {
		t.Errorf("結帳: %d %s", rec.Code, rec.Body)
	}
	subscribe(t, svc, "amy")
	if rec := post(h.Checkout, "amy", `{"priceId":"pri_pro"}`); rec.Code != http.StatusConflict {
		t.Errorf("已訂閱不可重複結帳: %d", rec.Code)
	}
}

func TestManage(t *testing.T) {
	h, svc := newPaymentHandler(t)
	ctx := context.Background()
	if rec := post(h.Manage, "amy", ""); rec.Code != http.StatusNotFound {
		t.Errorf("沒有訂閱: %d", rec.Code)
	}
	ev := subscription.Event{ID: "evt_bob", Kind: subscription.EventChanged, ExternalID: "sub_1", UserID: "bob", PriceID: "pri_pro", Status: subscription.StatusPastDue}
	if _, err := svc.Apply(ctx, ev, []byte("{}")); err != nil {
		t.Fatal(err)
	}
	rec := post(h.Manage, "bob", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "pay.example/sub_1") {
		t.Errorf("扣款失敗也要能管理: %d %s", rec.Code, rec.Body)
	}
}

func TestPlansListsPrices(t *testing.T) {
	h, _ := newPaymentHandler(t)
	rec := httptest.NewRecorder()
	h.Plans(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `{"id":"pri_pro","period":"monthly"}`) || !strings.Contains(rec.Body.String(), `"client":{"token":"test_1"}`) {
		t.Errorf("%d %s", rec.Code, rec.Body)
	}
}

func TestPaymentsDisabled(t *testing.T) {
	h, _ := newHandler(t)
	list := httptest.NewRecorder()
	h.Plans(list, httptest.NewRequest(http.MethodGet, "/", nil))
	if got := strings.TrimSpace(list.Body.String()); got != `{"plans":[]}` {
		t.Errorf("未設定金流不可公開價格: %s", got)
	}
	if rec := post(h.Checkout, "amy", "{}"); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("checkout: %d", rec.Code)
	}
	if rec := post(h.Manage, "amy", ""); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("manage: %d", rec.Code)
	}
	if rec := post(h.Webhook, "", "{}"); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("webhook: %d", rec.Code)
	}
}

func TestMeRequiresLogin(t *testing.T) {
	h, _ := newHandler(t)
	if rec := me(h, ""); rec.Code != http.StatusUnauthorized {
		t.Errorf("status %d", rec.Code)
	}
}

func TestMeDefaultsToCatalogDefault(t *testing.T) {
	h, _ := newHandler(t)
	rec := me(h, "amy")
	if rec.Code != http.StatusOK || currentTier(t, rec) != "free" {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
}

func TestSubscriptionOnlyAffectsThatUser(t *testing.T) {
	h, svc := newPaymentHandler(t)
	subscribe(t, svc, "amy")
	if got := currentTier(t, me(h, "amy")); got != "pro" {
		t.Errorf("amy = %q", got)
	}
	if got := currentTier(t, me(h, "bob")); got != "free" {
		t.Errorf("bob = %q", got)
	}
}

func TestUnknownTierFallsBackToDefault(t *testing.T) {
	store := newStore(t)
	err := store.Transact(context.Background(), func(tx subscription.Tx) error {
		return tx.SaveSubscription(context.Background(), subscription.Subscription{Source: "fake", ExternalID: "sub_1", UserID: "amy", Tier: "retired", Status: subscription.StatusActive})
	})
	if err != nil {
		t.Fatal(err)
	}
	svc := subscription.New(store, subscription.Catalog{Default: "free", Plans: []subscription.Plan{{Tier: "free"}}}, subscription.Options{})
	h := New(svc, Options{UserID: func(*http.Request) (string, bool) { return "amy", true }})
	if got := currentTier(t, me(h, "amy")); got != "free" {
		t.Errorf("amy = %q", got)
	}
}
