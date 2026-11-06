// Package plans 是本專案的方案資料。方案的邏輯與資料表都在 packages/subscription,這裡只決定有哪些方案。
package plans

import "github.com/tim72117/subscription"

// Catalog 由 main 依環境篩選後注入訂閱服務。
// 價格 ID 不是機密,金額在 Paddle 後台設定;還沒建立價格前留空,收費頁會顯示即將開放。格式:
// {ID: "pri_…", Period: subscription.BillingMonthly, Env: subscription.EnvSandbox}
// 方案由低到高排列,高的包含低的全部課程:進階方案可以看基礎方案的課。
// 課程要哪個方案寫在 internal/store/courses_seed.json 的 tier。
var Catalog = subscription.Catalog{
	Default: Free,
	Plans: []subscription.Plan{
		{Tier: Free, Name: "免費"},
		{Tier: Basic, Name: "基礎方案", Prices: []subscription.Price{
			{ID: "pri_01m6nxb949g594z9n1ydtd346m", Period: subscription.BillingMonthly, Env: subscription.EnvSandbox},
			{ID: "pri_01m6nxb9c0pnn76wm2nfaxxgwf", Period: subscription.BillingYearly, Env: subscription.EnvSandbox},
		}},
		{Tier: Advanced, Name: "進階方案", Prices: []subscription.Price{
			{ID: "pri_01m6pzaxagxyfp9hqny2g4a66w", Period: subscription.BillingMonthly, Env: subscription.EnvSandbox},
			{ID: "pri_01m6pzaxk0tnq9cbtvhpg16qbk", Period: subscription.BillingYearly, Env: subscription.EnvSandbox},
		}},
	},
}

// 方案代號。
const (
	Free     subscription.Tier = "free"
	Basic    subscription.Tier = "basic"
	Advanced subscription.Tier = "advanced"
)
