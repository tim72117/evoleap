// Package plans 是本專案的方案資料。方案的邏輯與資料表都在 packages/subscription,這裡只決定有哪些方案。
package plans

import (
	"time"

	"github.com/tim72117/subscription"
)

// 方案等級由低到高;課程的最低方案(courses_seed.json 的 tier)要是這裡的其中一個。
const (
	Free     subscription.Tier = "free"
	Basic    subscription.Tier = "basic"
	Advanced subscription.Tier = "advanced"
)

// Catalog 由 main 注入方案服務。
var Catalog = subscription.Catalog{
	Default: Free,
	Plans: []subscription.Plan{
		{Tier: Free, Name: "免費"},
		{Tier: Basic, Name: "基礎課程"},
		{Tier: Advanced, Name: "全部課程"},
	},
}

// SourceAds 是廣告方案的來源:免費,可以看 basic 的課程,每一課開始前播一段廣告。一個使用者一筆(ExternalID = 使用者 ID),沒有期限。
const SourceAds subscription.Source = "ads"

// AdsTier 是廣告方案涵蓋的等級。
const AdsTier = Basic

// AdSeconds 是片頭廣告的長度:開始播放後要過了這麼久,才發這一課的通行證。
const AdSeconds = 15

// AdPassTTL 是看完廣告後這一課的通行證有效時間;期間重新整理不用再看。
const AdPassTTL = 30 * time.Minute
