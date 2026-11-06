package subscription

import "testing"

func TestCatalogValidate(t *testing.T) {
	price := Price{ID: "pri_1", Period: BillingMonthly, Env: EnvSandbox}
	valid := Catalog{Default: "free", Plans: []Plan{{Tier: "free"}, {Tier: "pro", Prices: []Price{price}}}}
	if err := valid.Validate(); err != nil {
		t.Errorf("正確的清單: %v", err)
	}
	withPrice := func(p Price) Catalog {
		return Catalog{Default: "free", Plans: []Plan{{Tier: "free"}, {Tier: "pro", Prices: []Price{p}}}}
	}
	for name, catalog := range map[string]Catalog{
		"預設方案不存在":   {Default: "none", Plans: []Plan{{Tier: "free"}}},
		"方案重複":      {Default: "free", Plans: []Plan{{Tier: "free"}, {Tier: "free"}}},
		"價格 ID 重複":  {Default: "free", Plans: []Plan{{Tier: "free", Prices: []Price{price}}, {Tier: "pro", Prices: []Price{price}}}},
		"價格 ID 是空的": withPrice(Price{Period: BillingMonthly, Env: EnvSandbox}),
		"漏寫週期":      withPrice(Price{ID: "pri_1", Env: EnvSandbox}),
		"漏寫環境":      withPrice(Price{ID: "pri_1", Period: BillingMonthly}),
	} {
		if err := catalog.Validate(); err == nil {
			t.Errorf("%s: 要回傳錯誤", name)
		}
	}
}

func TestCatalogForEnv(t *testing.T) {
	catalog := Catalog{Default: "free", Plans: []Plan{
		{Tier: "free"},
		{Tier: "pro", Prices: []Price{{ID: "pri_test", Env: EnvSandbox}, {ID: "pri_live", Env: EnvProduction}}},
	}}
	got := catalog.ForEnv(EnvProduction)
	if prices := got.Plans[1].Prices; len(prices) != 1 || prices[0].ID != "pri_live" {
		t.Errorf("%+v", prices)
	}
	if got.Default != "free" || len(got.Plans) != 2 || !got.HasPrices() {
		t.Errorf("%+v", got)
	}
	if empty := (Catalog{Plans: []Plan{{Tier: "free"}}}); empty.HasPrices() {
		t.Error("沒有價格")
	}
	if len(catalog.Plans[1].Prices) != 2 {
		t.Errorf("不可改動原本的清單: %+v", catalog)
	}
}

func TestIncludesFollowsCatalogOrder(t *testing.T) {
	svc := New(nil, Catalog{Default: "free", Plans: []Plan{{Tier: "free"}, {Tier: "basic"}, {Tier: "advanced"}}}, Options{})
	cases := []struct {
		have, need Tier
		want       bool
	}{
		{"advanced", "basic", true},
		{"advanced", "advanced", true},
		{"basic", "advanced", false},
		{"free", "basic", false},
		{"basic", "", false},
		{"gone", "basic", false},
	}
	for _, c := range cases {
		if got := svc.Includes(c.have, c.need); got != c.want {
			t.Errorf("Includes(%q, %q) = %v", c.have, c.need, got)
		}
	}
}
