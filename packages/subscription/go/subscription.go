// Package subscription 管理方案、權益與訂閱狀態,不依賴任何使用它的專案。
// 方案內容由專案透過 Catalog 傳入,使用者一律只用 ID 表示。
package subscription

import (
	"context"
	"fmt"
	"time"
)

// expiryGrace 是當期結束後保留權限的時間。續訂事件正常會在到期前後送達,
// 超過這段時間還沒收到,就當作訂閱已結束,避免遺失取消事件時權限永久有效。
const expiryGrace = 7 * 24 * time.Hour

// pastDueGrace 是扣款失敗時,當期結束後保留權限的上限。權限由金流商重試結束後的事件決定,
// 這裡只防止該事件遺失。Paddle 預設重試 30 天,調整重試期間時要跟著改。
const pastDueGrace = 35 * 24 * time.Hour

// Tier 是方案代號。
type Tier string

// BillingPeriod 是計費週期。
type BillingPeriod string

const (
	BillingMonthly BillingPeriod = "monthly"
	BillingYearly  BillingPeriod = "yearly"
)

// Env 是金流商的環境,不同環境的價格 ID 不同。
type Env string

const (
	EnvSandbox    Env = "sandbox"
	EnvProduction Env = "production"
)

// Price 是方案在金流商的一個價格。金額由金流商決定,這裡只記 ID、週期與環境。
type Price struct {
	ID     string        `json:"id"`
	Period BillingPeriod `json:"period"`
	Env    Env           `json:"-"`
}

// Plan 是方案代號對應的內容。
type Plan struct {
	Tier Tier   `json:"tier"`
	Name string `json:"name"`
	// Prices 是可以訂閱這個方案的價格;沒有價格的方案不能結帳。
	Prices []Price `json:"prices,omitempty"`
}

// Catalog 是專案提供的方案清單,Plans 由低到高排列,必須包含 Default。
// 高的方案包含低的方案的全部權益(見 Includes)。
type Catalog struct {
	Default Tier
	Plans   []Plan
}

// Validate 檢查方案資料。ForEnv 會濾掉環境不符的價格,所以要在篩選前檢查,寫錯才不會被默默略過。
func (c Catalog) Validate() error {
	tiers := map[Tier]bool{}
	prices := map[string]bool{}
	for _, plan := range c.Plans {
		if tiers[plan.Tier] {
			return fmt.Errorf("subscription: 方案 %q 重複", plan.Tier)
		}
		tiers[plan.Tier] = true
		for _, price := range plan.Prices {
			if price.ID == "" || prices[price.ID] {
				return fmt.Errorf("subscription: 方案 %q 的價格 ID %q 是空的或重複", plan.Tier, price.ID)
			}
			prices[price.ID] = true
			if price.Period != BillingMonthly && price.Period != BillingYearly {
				return fmt.Errorf("subscription: 價格 %q 的週期 %q 不正確", price.ID, price.Period)
			}
			if price.Env != EnvSandbox && price.Env != EnvProduction {
				return fmt.Errorf("subscription: 價格 %q 的環境 %q 不正確", price.ID, price.Env)
			}
		}
	}
	if !tiers[c.Default] {
		return fmt.Errorf("subscription: 預設方案 %q 不存在", c.Default)
	}
	return nil
}

// rank 回傳方案在清單中的位置;不存在時回傳 -1。
func (c Catalog) rank(tier Tier) int {
	for i, plan := range c.Plans {
		if plan.Tier == tier {
			return i
		}
	}
	return -1
}

// HasPrices 回傳是否有任何方案可以結帳。
func (c Catalog) HasPrices() bool {
	for _, plan := range c.Plans {
		if len(plan.Prices) > 0 {
			return true
		}
	}
	return false
}

// ForEnv 回傳只含這個環境價格的方案清單,不會改動原本的清單。
func (c Catalog) ForEnv(env Env) Catalog {
	plans := make([]Plan, len(c.Plans))
	for i, plan := range c.Plans {
		plan.Prices = nil
		for _, price := range c.Plans[i].Prices {
			if price.Env == env {
				plan.Prices = append(plan.Prices, price)
			}
		}
		plans[i] = plan
	}
	return Catalog{Default: c.Default, Plans: plans}
}

// Status 是訂閱的狀態。
type Status string

const (
	StatusActive Status = "active"
	// StatusPastDue 代表續訂扣款失敗,金流商還在重試。
	StatusPastDue  Status = "past_due"
	StatusPaused   Status = "paused"
	StatusCanceled Status = "canceled"
	// StatusRevoked 代表全額退款或爭議款成立。同一筆訂閱之後的事件都不會讓它恢復。
	StatusRevoked Status = "revoked"
)

// Source 是訂閱的來源,值由呼叫端決定。
type Source string

// Subscription 是金流商的一筆訂閱,一個使用者可能有很多筆(重新訂閱、重複訂閱),權限看有沒有任一筆有效。
// 事件對不上帳號時 UserID 是空的,之後對上了才補;Tier 與 Status 要等訂閱事件才有。
type Subscription struct {
	Source     Source
	ExternalID string
	UserID     string
	Tier       Tier
	// PriceID 是目前訂閱的價格,用來判斷方案與計費週期;更換方案後由事件更新。
	PriceID string
	Status  Status
	// CustomerID 是金流商的顧客 ID,開啟管理訂閱的入口時要用。
	CustomerID       string
	CurrentPeriodEnd *time.Time
	// CancelAt 是已排定取消的時間,到時候才會收到取消事件。
	CancelAt *time.Time
	// Duplicate 代表建立時使用者已有另一筆有效訂閱。這筆會在當期結束時取消,已付的款項要人工退款。
	Duplicate bool
	// LastEventAt 是最後套用的金流商事件時間,用來跳過晚到的舊事件。
	LastEventAt *time.Time
}

// Store 是訂閱資料的儲存介面。
type Store interface {
	// Transact 在同一個交易內執行 fn,fn 回傳錯誤時全部不寫入。
	Transact(ctx context.Context, fn func(tx Tx) error) error
	// SubscriptionsOf 回傳使用者的全部訂閱。
	SubscriptionsOf(ctx context.Context, userID string) ([]Subscription, error)
	// EventPayload 回傳事件的原始內容;沒有這個事件或內容已清除時第二個值為 false。
	EventPayload(ctx context.Context, source Source, eventID string) ([]byte, bool, error)
	// PurgePayloads 清除 before 之前收到的事件原始內容,事件紀錄本身保留。
	PurgePayloads(ctx context.Context, before time.Time) error
	// ClaimTasks 取出到期的工作並把下次執行時間往後移到 now 加上 backoff,其他程序在那之前不會拿到同一筆。
	ClaimTasks(ctx context.Context, source Source, now time.Time, limit int, backoff func(attempts int) time.Duration) ([]Task, error)
	// FinishTask 記下工作的結果:runErr 為 nil 代表完成;giveUp 為 true 代表不再重試。
	FinishTask(ctx context.Context, task Task, now time.Time, runErr error, giveUp bool) error
}

// Tx 是交易內可以做的操作。
type Tx interface {
	// Lock 鎖定 key 到交易結束,同一個 key 的交易會依序執行。
	Lock(ctx context.Context, key string) error
	// Subscription 回傳一筆訂閱;沒有紀錄時第二個值為 false。
	Subscription(ctx context.Context, source Source, externalID string) (Subscription, bool, error)
	// SubscriptionsOf 回傳使用者的全部訂閱。
	SubscriptionsOf(ctx context.Context, userID string) ([]Subscription, error)
	// SaveSubscription 新增或覆蓋一筆訂閱。
	SaveSubscription(ctx context.Context, sub Subscription) error
	// HasEvent 回傳事件是否處理過,以及當時的結果。
	HasEvent(ctx context.Context, source Source, eventID string) (Outcome, bool, error)
	// SaveEvent 保存事件與處理結果;已有紀錄時更新結果,原始內容不變。
	SaveEvent(ctx context.Context, record EventRecord) error
	// SavePayment 保存付款紀錄;同一個來源的同一筆交易只留一筆,以最後的內容為準。
	SavePayment(ctx context.Context, payment Payment) error
	// AddTask 排入工作。同一筆訂閱的同一種工作只有一筆,已放棄的會重新開始,已完成的不再執行。
	AddTask(ctx context.Context, task Task, now time.Time) error
}

// Outcome 是事件的處理結果。
type Outcome string

const (
	// OutcomeApplied 代表已寫入訂閱紀錄或付款紀錄。
	OutcomeApplied Outcome = "applied"
	// OutcomeStale 代表晚到或已經處理過,不需要改變訂閱狀態。
	OutcomeStale Outcome = "stale"
	// OutcomeUnknownUser 代表對不上使用者,要人工處理。
	OutcomeUnknownUser Outcome = "unknown_user"
	// OutcomeUnknownPrice 代表價格不屬於任何方案,要人工處理。
	OutcomeUnknownPrice Outcome = "unknown_price"
	// OutcomeDuplicate 代表使用者已有另一筆有效訂閱。新的這筆會在當期結束時取消,已付的款項要人工退款。
	OutcomeDuplicate Outcome = "duplicate"
)

// EventRecord 是一筆保存下來的事件,用來對帳與人工處理。
type EventRecord struct {
	Source  Source
	Event   Event
	Outcome Outcome
	// Payload 是金流商送來的原始內容,用來重新處理事件;保存 payloadRetention 後清除。
	Payload []byte
}

// Payment 是一筆收到的款項,用來對帳與處理退款。金額與發票以金流商為準。
// 對不上訂閱或帳號時 ExternalID、UserID 可能是空的。
type Payment struct {
	Source        Source
	TransactionID string
	ExternalID    string
	UserID        string
	PriceID       string
	PaidAt        time.Time
}

// CurrentSubscription 是畫面需要的訂閱狀態。
type CurrentSubscription struct {
	Status           Status     `json:"status"`
	PriceID          string     `json:"priceId,omitempty"`
	CurrentPeriodEnd *time.Time `json:"currentPeriodEnd,omitempty"`
	CancelAt         *time.Time `json:"cancelAt,omitempty"`
}

// PlanStatus 是使用者目前的方案與全部方案。
type PlanStatus struct {
	CurrentTier  Tier                 `json:"currentTier"`
	CurrentPlan  Plan                 `json:"currentPlan"`
	Plans        []Plan               `json:"plans"`
	Subscribed   bool                 `json:"subscribed"`
	Subscription *CurrentSubscription `json:"subscription,omitempty"`
}

// Options 是專案提供的設定。
type Options struct {
	// Provider 是金流商;nil 代表不接受付款。
	Provider Provider
	// UserExists 回傳使用者是否存在,用來過濾事件帶來的使用者 ID;nil 代表不檢查。
	UserExists func(ctx context.Context, userID string) (bool, error)
	// Now 是目前時間,測試用;nil 代表 time.Now。
	Now func() time.Time
}

// Service 是專案使用訂閱功能的入口。
type Service struct {
	store      Store
	catalog    Catalog
	provider   Provider
	userExists func(ctx context.Context, userID string) (bool, error)
	now        func() time.Time
}

func New(store Store, catalog Catalog, opts Options) *Service {
	s := &Service{store: store, catalog: catalog, provider: opts.Provider, userExists: opts.UserExists, now: opts.Now}
	if s.now == nil {
		s.now = time.Now
	}
	return s
}

// Provider 回傳金流商;沒有設定時回傳 nil。
func (s *Service) Provider() Provider { return s.provider }

// Plans 回傳全部方案。
func (s *Service) Plans() []Plan { return s.catalog.Plans }

// Includes 回傳 have 方案是否包含 need 方案的權益:方案清單中排在後面的包含前面的。
// 任一個方案不存在時回傳 false。
func (s *Service) Includes(have, need Tier) bool {
	h, n := s.catalog.rank(have), s.catalog.rank(need)
	return h >= 0 && n >= 0 && h >= n
}

// Plan 回傳方案;不存在時第二個值為 false。
func (s *Service) Plan(tier Tier) (Plan, bool) {
	return s.find(tier)
}

// TierForPrice 回傳價格所屬的方案。
func (s *Service) TierForPrice(priceID string) (Tier, bool) {
	for _, plan := range s.catalog.Plans {
		for _, price := range plan.Prices {
			if price.ID == priceID {
				return plan.Tier, true
			}
		}
	}
	return "", false
}

// grantsAccess 判斷狀態是否有權限。扣款失敗時金流商還在重試,重試結束才會變成暫停或取消,期間保留權限。
func grantsAccess(status Status) bool {
	return status == StatusActive || status == StatusPastDue
}

// hasAccess 判斷訂閱現在是否有效:狀態有權限,而且沒有超過當期結束時間加上寬限期。
func (s *Service) hasAccess(sub Subscription) bool {
	if !grantsAccess(sub.Status) {
		return false
	}
	grace := expiryGrace
	if sub.Status == StatusPastDue {
		grace = pastDueGrace
	}
	return sub.CurrentPeriodEnd == nil || !s.now().After(sub.CurrentPeriodEnd.Add(grace))
}

// Current 回傳使用者最主要的有效訂閱:重複訂閱排在後面,正常的排在扣款失敗的前面,再來是到期日較晚的。
// 沒有有效的訂閱時第二個值為 false。
func (s *Service) Current(ctx context.Context, userID string) (Subscription, bool, error) {
	subs, err := s.store.SubscriptionsOf(ctx, userID)
	if err != nil {
		return Subscription{}, false, err
	}
	var best Subscription
	found := false
	for _, sub := range subs {
		if s.hasAccess(sub) && (!found || betterThan(sub, best)) {
			best, found = sub, true
		}
	}
	return best, found, nil
}

func betterThan(a, b Subscription) bool {
	if a.Duplicate != b.Duplicate {
		return b.Duplicate
	}
	if a.Status != b.Status {
		return a.Status == StatusActive
	}
	if a.CurrentPeriodEnd == nil || b.CurrentPeriodEnd == nil {
		return a.CurrentPeriodEnd == nil && b.CurrentPeriodEnd != nil
	}
	return a.CurrentPeriodEnd.After(*b.CurrentPeriodEnd)
}

// Status 回傳使用者目前的方案與訂閱狀態。沒有有效訂閱或代號已不存在時,都視為預設方案。
func (s *Service) Status(ctx context.Context, userID string) (PlanStatus, error) {
	sub, ok, err := s.Current(ctx, userID)
	if err != nil {
		return PlanStatus{}, err
	}
	if !ok {
		return s.statusFor(s.catalog.Default), nil
	}
	status := s.statusFor(sub.Tier)
	status.Subscribed = true
	status.Subscription = &CurrentSubscription{Status: sub.Status, PriceID: sub.PriceID, CurrentPeriodEnd: sub.CurrentPeriodEnd, CancelAt: sub.CancelAt}
	return status, nil
}

func (s *Service) statusFor(tier Tier) PlanStatus {
	plan, ok := s.find(tier)
	if !ok {
		plan, _ = s.find(s.catalog.Default)
	}
	return PlanStatus{CurrentTier: plan.Tier, CurrentPlan: plan, Plans: s.catalog.Plans}
}

func (s *Service) find(tier Tier) (Plan, bool) {
	for _, p := range s.catalog.Plans {
		if p.Tier == tier {
			return p, true
		}
	}
	return Plan{}, false
}
