package api

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/tim72117/evoleap/internal/auth"
	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/subscription"
	"github.com/tim72117/subscription/gormstore"
)

// testSubscriptions 建立訂閱服務,方案代號和正式的一樣(free、basic、advanced);基礎方案的價格是 prices,
// 進階方案固定是 pri_adv。
func testSubscriptions(t *testing.T, st *store.Store, prices ...subscription.Price) *subscription.Service {
	t.Helper()
	return testSubscriptionsWith(t, st, nil, prices...)
}

// testSubscriptionsWith 和 testSubscriptions 一樣,再接上金流商。
func testSubscriptionsWith(t *testing.T, st *store.Store, provider subscription.Provider, prices ...subscription.Price) *subscription.Service {
	t.Helper()
	svc, err := gormstore.NewService(st.DB(), subscription.Catalog{
		Default: "free",
		Plans: []subscription.Plan{
			{Tier: "free", Name: "免費"},
			{Tier: "basic", Name: "基礎方案", Prices: prices},
			{Tier: "advanced", Name: "進階方案", Prices: []subscription.Price{{ID: "pri_adv", Period: subscription.BillingMonthly, Env: subscription.EnvSandbox}}},
		},
	}, subscription.Options{Provider: provider, UserExists: st.UserExists})
	if err != nil {
		t.Fatal(err)
	}
	return svc
}

// 方案邏輯的測試在 packages/subscription;這裡只確認專案的接線與資料表。
func TestPlanRoutes(t *testing.T) {
	st := openTestStore(t)
	h := New(Config{Store: st, Signer: auth.NewSigner("test-secret", time.Hour), Subscriptions: testSubscriptions(t, st)}).Routes()
	amy := registerCookie(t, h, "amy@example.com")

	if rec := call(h, http.MethodGet, "/api/plan/me", "", nil); rec.Code != http.StatusUnauthorized {
		t.Errorf("guest: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/plan/me", "", amy); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"currentTier":"free"`) {
		t.Fatalf("default: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/plan/plans", "", nil); rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"plans":[]}` {
		t.Errorf("未設定金流不可公開價格: %d %s", rec.Code, rec.Body)
	}
	for _, path := range []string{"/api/plan/checkout", "/api/plan/manage"} {
		if rec := call(h, http.MethodPost, path, "{}", nil); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s guest: %d %s", path, rec.Code, rec.Body)
		}
		if rec := call(h, http.MethodPost, path, "{}", amy); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("%s 未設定金流: %d %s", path, rec.Code, rec.Body)
		}
	}
}
