// Package subscription 管理方案與使用者的方案紀錄,不依賴任何使用它的專案。
// 方案內容由專案透過 Catalog 傳入,使用者一律只用 ID 表示。
//
// 這一版從 feat/subscription 分支抽出方案與權限的部分,先不含金流(Paddle、webhook、付款紀錄、取消重試)。
// 目前方案只由專案自己寫入(Service.Grant),例如使用者選了廣告方案;之後接金流時,金流事件也是寫進同一張表。
package subscription

import (
	"context"
	"fmt"
	"time"
)

// Tier 是方案等級。Catalog.Plans 的順序就是由低到高,高的等級涵蓋低的。
type Tier string

// Plan 是方案等級對應的內容。
type Plan struct {
	Tier Tier   `json:"tier"`
	Name string `json:"name"`
}

// Catalog 是專案提供的方案清單,Plans 由低到高排列,必須包含 Default。
type Catalog struct {
	Default Tier
	Plans   []Plan
}

// Validate 檢查方案資料:不能重複,而且要有預設方案。
func (c Catalog) Validate() error {
	tiers := map[Tier]bool{}
	for _, plan := range c.Plans {
		if plan.Tier == "" || tiers[plan.Tier] {
			return fmt.Errorf("subscription: 方案 %q 是空的或重複", plan.Tier)
		}
		tiers[plan.Tier] = true
	}
	if !tiers[c.Default] {
		return fmt.Errorf("subscription: 預設方案 %q 不存在", c.Default)
	}
	return nil
}

// Rank 回傳方案的高低(Plans 裡的位置);不在清單裡時第二個值為 false。
func (c Catalog) Rank(tier Tier) (int, bool) {
	for i, plan := range c.Plans {
		if plan.Tier == tier {
			return i, true
		}
	}
	return 0, false
}

// Covers 回傳 have 等級能不能看要求 need 等級的內容。任何一邊不在清單裡都不放行。
func (c Catalog) Covers(have, need Tier) bool {
	h, ok1 := c.Rank(have)
	n, ok2 := c.Rank(need)
	return ok1 && ok2 && h >= n
}

// Status 是方案紀錄的狀態。
type Status string

const (
	StatusActive   Status = "active"
	StatusCanceled Status = "canceled"
)

// Source 是方案紀錄的來源,值由呼叫端決定,例如 "ads"(廣告方案)、之後的 "paddle"。
type Source string

// Subscription 是使用者的一筆方案紀錄。一個使用者可能有很多筆(不同來源),權限看有沒有任一筆有效。
type Subscription struct {
	Source Source
	// ExternalID 在同一個來源裡唯一;專案自己開的方案可以用使用者 ID。
	ExternalID string
	UserID     string
	Tier       Tier
	Status     Status
	// CurrentPeriodEnd 是有效期限;nil 代表沒有期限(例如廣告方案)。
	CurrentPeriodEnd *time.Time
}

// Store 是方案紀錄的儲存介面。
type Store interface {
	// SubscriptionsOf 回傳使用者的全部方案紀錄。
	SubscriptionsOf(ctx context.Context, userID string) ([]Subscription, error)
	// SaveSubscription 新增或覆蓋一筆方案紀錄(以 Source + ExternalID 為準)。
	SaveSubscription(ctx context.Context, sub Subscription) error
}

// Options 是專案提供的設定。
type Options struct {
	// Grace 回傳某個來源在期限過後還保留權限的時間;nil 或回傳 0 代表期限一到就失效。
	// 付費訂閱的續訂事件可能晚到,之後接金流時可以給它寬限期;專案自己開的方案不需要。
	Grace func(Source) time.Duration
	// Now 是目前時間,測試用;nil 代表 time.Now。
	Now func() time.Time
}

// Service 是專案使用方案功能的入口。
type Service struct {
	store   Store
	catalog Catalog
	grace   func(Source) time.Duration
	now     func() time.Time
}

func New(store Store, catalog Catalog, opts Options) *Service {
	s := &Service{store: store, catalog: catalog, grace: opts.Grace, now: opts.Now}
	if s.now == nil {
		s.now = time.Now
	}
	return s
}

// Catalog 回傳方案清單。
func (s *Service) Catalog() Catalog { return s.catalog }

// hasAccess 判斷方案紀錄現在是否有效:狀態是 active,而且沒有超過期限加上這個來源的寬限期。
func (s *Service) hasAccess(sub Subscription) bool {
	if sub.Status != StatusActive {
		return false
	}
	if sub.CurrentPeriodEnd == nil {
		return true
	}
	var grace time.Duration
	if s.grace != nil {
		grace = s.grace(sub.Source)
	}
	return !s.now().After(sub.CurrentPeriodEnd.Add(grace))
}

// Active 回傳使用者全部有效的方案紀錄,等級高的在前。等級不在方案清單裡的不算。
func (s *Service) Active(ctx context.Context, userID string) ([]Subscription, error) {
	subs, err := s.store.SubscriptionsOf(ctx, userID)
	if err != nil {
		return nil, err
	}
	var out []Subscription
	for _, sub := range subs {
		if _, ok := s.catalog.Rank(sub.Tier); ok && s.hasAccess(sub) {
			out = append(out, sub)
		}
	}
	for i := 1; i < len(out); i++ {
		for j := i; j > 0; j-- {
			a, _ := s.catalog.Rank(out[j].Tier)
			b, _ := s.catalog.Rank(out[j-1].Tier)
			if a <= b {
				break
			}
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out, nil
}

// Grant 寫入一筆專案自己開的方案紀錄(不經金流),例如使用者選了廣告方案。同一個 Source + ExternalID 會覆蓋。
func (s *Service) Grant(ctx context.Context, sub Subscription) error {
	if _, ok := s.catalog.Rank(sub.Tier); !ok {
		return fmt.Errorf("subscription: 方案 %q 不存在", sub.Tier)
	}
	if sub.Source == "" || sub.ExternalID == "" || sub.UserID == "" {
		return fmt.Errorf("subscription: 來源、編號與使用者都要有值")
	}
	if sub.Status == "" {
		sub.Status = StatusActive
	}
	return s.store.SaveSubscription(ctx, sub)
}
