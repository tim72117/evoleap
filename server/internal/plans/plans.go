// Package plans 是本專案的方案資料。方案的邏輯與資料表都在 packages/subscription,這裡只決定有哪些方案。
package plans

import "github.com/tim72117/subscription"

// Catalog 由 main 依環境篩選後注入訂閱服務。
// 價格 ID 不是機密,金額在 Paddle 後台設定;還沒建立價格前留空,收費頁會顯示即將開放。格式:
// {ID: "pri_…", Period: subscription.BillingMonthly, Env: subscription.EnvSandbox}
var Catalog = subscription.Catalog{
	Default: "free",
	Plans: []subscription.Plan{
		{Tier: "free", Name: "免費版"},
		{Tier: "subscriber", Name: "訂閱版", Prices: []subscription.Price{}},
	},
}
