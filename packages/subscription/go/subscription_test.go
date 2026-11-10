package subscription_test

import (
	"context"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/tim72117/subscription"
	"github.com/tim72117/subscription/gormstore"
	"gorm.io/gorm"
)

var catalog = subscription.Catalog{
	Default: "free",
	Plans:   []subscription.Plan{{Tier: "free", Name: "免費"}, {Tier: "basic", Name: "基礎"}, {Tier: "advanced", Name: "進階"}},
}

func TestCatalog(t *testing.T) {
	if err := catalog.Validate(); err != nil {
		t.Fatal(err)
	}
	bad := subscription.Catalog{Default: "x", Plans: []subscription.Plan{{Tier: "free"}}}
	if bad.Validate() == nil {
		t.Error("預設方案不存在應該失敗")
	}
	dup := subscription.Catalog{Default: "free", Plans: []subscription.Plan{{Tier: "free"}, {Tier: "free"}}}
	if dup.Validate() == nil {
		t.Error("重複方案應該失敗")
	}
	cases := []struct {
		have, need subscription.Tier
		want       bool
	}{
		{"basic", "basic", true},
		{"advanced", "basic", true},
		{"basic", "advanced", false},
		{"free", "basic", false},
		{"nope", "free", false},
		{"advanced", "nope", false},
	}
	for _, c := range cases {
		if got := catalog.Covers(c.have, c.need); got != c.want {
			t.Errorf("Covers(%s, %s) = %v", c.have, c.need, got)
		}
	}
}

func newService(t *testing.T, now *time.Time, grace func(subscription.Source) time.Duration) *subscription.Service {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	svc, err := gormstore.NewService(db, catalog, subscription.Options{Grace: grace, Now: func() time.Time { return *now }})
	if err != nil {
		t.Fatal(err)
	}
	return svc
}

func TestGrantAndActive(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 11, 10, 0, 0, 0, 0, time.UTC)
	svc := newService(t, &now, func(src subscription.Source) time.Duration {
		if src == "paid" {
			return 7 * 24 * time.Hour
		}
		return 0
	})

	if err := svc.Grant(ctx, subscription.Subscription{Source: "ads", ExternalID: "u1", UserID: "u1", Tier: "basic"}); err != nil {
		t.Fatal(err)
	}
	// 重複選擇只會覆蓋同一筆
	if err := svc.Grant(ctx, subscription.Subscription{Source: "ads", ExternalID: "u1", UserID: "u1", Tier: "basic"}); err != nil {
		t.Fatal(err)
	}
	if err := svc.Grant(ctx, subscription.Subscription{Source: "ads", ExternalID: "u1", UserID: "u1", Tier: "nope"}); err == nil {
		t.Error("不存在的方案應該失敗")
	}
	end := now.Add(time.Hour)
	if err := svc.Grant(ctx, subscription.Subscription{Source: "paid", ExternalID: "p1", UserID: "u1", Tier: "advanced", CurrentPeriodEnd: &end}); err != nil {
		t.Fatal(err)
	}

	active, err := svc.Active(ctx, "u1")
	if err != nil || len(active) != 2 || active[0].Tier != "advanced" || active[1].Source != "ads" {
		t.Fatalf("active = %+v, %v", active, err)
	}

	// 期限過了但還在寬限期內
	now = end.Add(24 * time.Hour)
	if active, _ = svc.Active(ctx, "u1"); len(active) != 2 {
		t.Fatalf("寬限期內應該還有效: %+v", active)
	}
	// 超過寬限期
	now = end.Add(8 * 24 * time.Hour)
	if active, _ = svc.Active(ctx, "u1"); len(active) != 1 || active[0].Source != "ads" {
		t.Fatalf("超過寬限期: %+v", active)
	}

	// 取消後就不算
	if err := svc.Grant(ctx, subscription.Subscription{Source: "ads", ExternalID: "u1", UserID: "u1", Tier: "basic", Status: subscription.StatusCanceled}); err != nil {
		t.Fatal(err)
	}
	if active, _ = svc.Active(ctx, "u1"); len(active) != 0 {
		t.Fatalf("取消後: %+v", active)
	}

	// 沒有寬限期的來源,期限一到就失效
	short := now.Add(time.Minute)
	if err := svc.Grant(ctx, subscription.Subscription{Source: "ads", ExternalID: "u2", UserID: "u2", Tier: "basic", CurrentPeriodEnd: &short}); err != nil {
		t.Fatal(err)
	}
	now = short.Add(time.Second)
	if active, _ = svc.Active(ctx, "u2"); len(active) != 0 {
		t.Fatalf("沒有寬限期: %+v", active)
	}
}
