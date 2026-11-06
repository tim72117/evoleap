package subscription_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/tim72117/subscription"
	"github.com/tim72117/subscription/gormstore"
	"gorm.io/gorm"
)

var (
	start   = time.Date(2026, 11, 5, 8, 0, 0, 0, time.UTC)
	catalog = subscription.Catalog{Default: "free", Plans: []subscription.Plan{
		{Tier: "free"},
		{Tier: "pro", Prices: []subscription.Price{{ID: "pri_month", Period: subscription.BillingMonthly}, {ID: "pri_year", Period: subscription.BillingYearly}}},
	}}
)

// fakeProvider 記下被取消的訂閱(canceled 含期滿與立刻取消,canceledNow 只有立刻取消);
// cancelErr 不是 nil 時取消失敗。原始內容就是事件的 JSON。
type fakeProvider struct {
	subscription.Provider
	canceled    []string
	canceledNow []string
	cancelErr   error
}

func (*fakeProvider) Source() subscription.Source { return "paddle" }

func (p *fakeProvider) Cancel(_ context.Context, externalID string) error {
	if p.cancelErr != nil {
		return p.cancelErr
	}
	p.canceled = append(p.canceled, externalID)
	return nil
}

func (p *fakeProvider) CancelNow(ctx context.Context, externalID string) error {
	if err := p.Cancel(ctx, externalID); err != nil {
		return err
	}
	p.canceledNow = append(p.canceledNow, externalID)
	return nil
}

func (*fakeProvider) ParseEvent(body []byte) (*subscription.Event, error) {
	var ev subscription.Event
	if err := json.Unmarshal(body, &ev); err != nil {
		return nil, err
	}
	return &ev, nil
}

type harness struct {
	t        *testing.T
	db       *gorm.DB
	svc      *subscription.Service
	provider *fakeProvider
	now      time.Time
}

func newHarness(t *testing.T) *harness {
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
	h := &harness{t: t, db: db, provider: &fakeProvider{}, now: start}
	h.svc = h.service(catalog)
	return h
}

func (h *harness) service(c subscription.Catalog) *subscription.Service {
	h.t.Helper()
	svc, err := gormstore.NewService(h.db, c, subscription.Options{
		Provider:   h.provider,
		UserExists: func(_ context.Context, id string) (bool, error) { return id != "ghost", nil },
		Now:        func() time.Time { return h.now },
	})
	if err != nil {
		h.t.Fatal(err)
	}
	return svc
}

func (h *harness) apply(ev subscription.Event) subscription.Outcome {
	h.t.Helper()
	payload, _ := json.Marshal(ev)
	outcome, err := h.svc.Apply(context.Background(), ev, payload)
	if err != nil {
		h.t.Fatalf("%+v: %v", ev, err)
	}
	return outcome
}

func (h *harness) tier(user string) subscription.Tier {
	h.t.Helper()
	status, err := h.svc.Status(context.Background(), user)
	if err != nil {
		h.t.Fatal(err)
	}
	return status.CurrentTier
}

func changed(externalID string, status subscription.Status, after time.Duration) subscription.Event {
	return subscription.Event{ID: fmt.Sprintf("evt_%s_%s_%s", externalID, status, after), Kind: subscription.EventChanged, ExternalID: externalID, UserID: "amy", PriceID: "pri_year", Status: status, OccurredAt: start.Add(after)}
}

func revoked(externalID string, after time.Duration) subscription.Event {
	return subscription.Event{ID: fmt.Sprintf("evt_revoked_%s_%s", externalID, after), Kind: subscription.EventRevoked, ExternalID: externalID, OccurredAt: start.Add(after)}
}

func paid(transactionID, externalID, userID, priceID string) subscription.Event {
	return subscription.Event{ID: "evt_" + transactionID, Kind: subscription.EventPaid, ExternalID: externalID, UserID: userID, PriceID: priceID, TransactionID: transactionID, PaidAt: start, OccurredAt: start}
}

func TestAccessFollowsEvents(t *testing.T) {
	const hour = time.Hour
	active, pastDue, paused, canceled := subscription.StatusActive, subscription.StatusPastDue, subscription.StatusPaused, subscription.StatusCanceled
	cases := []struct {
		name   string
		events []subscription.Event
		want   subscription.Tier
	}{
		{"訂閱", []subscription.Event{changed("sub_1", active, 0)}, "pro"},
		{"取消", []subscription.Event{changed("sub_1", active, 0), changed("sub_1", canceled, hour)}, "free"},
		{"舊事件晚到不可讓取消的訂閱復活", []subscription.Event{changed("sub_1", canceled, hour), changed("sub_1", active, 0)}, "free"},
		{"舊事件晚到不可取消有效的訂閱", []subscription.Event{changed("sub_1", active, hour), changed("sub_1", canceled, 0)}, "pro"},
		{"扣款重試期間保留權限", []subscription.Event{changed("sub_1", active, 0), changed("sub_1", pastDue, hour)}, "pro"},
		{"重試失敗後停權", []subscription.Event{changed("sub_1", pastDue, 0), changed("sub_1", paused, hour)}, "free"},
		{"退款立即停權", []subscription.Event{changed("sub_1", active, 0), revoked("sub_1", hour)}, "free"},
		{"退款後的事件不可讓訂閱復活", []subscription.Event{changed("sub_1", active, 0), revoked("sub_1", hour), changed("sub_1", active, 2*hour)}, "free"},
		{"退款比訂閱事件先到也不可開通", []subscription.Event{revoked("sub_1", hour), changed("sub_1", active, 0)}, "free"},
		{"退款後可以重新訂閱", []subscription.Event{changed("sub_1", active, 0), revoked("sub_1", hour), changed("sub_2", active, 2*hour)}, "pro"},
		{"舊訂閱結束不影響新訂閱", []subscription.Event{changed("sub_1", canceled, 0), changed("sub_2", active, hour), changed("sub_1", canceled, 2*hour)}, "pro"},
		{"價格對不上不開通", []subscription.Event{{ID: "evt_x", Kind: subscription.EventChanged, ExternalID: "sub_1", UserID: "amy", PriceID: "pri_other", Status: active, OccurredAt: start}}, "free"},
		{"帳號不存在不開通", []subscription.Event{{ID: "evt_x", Kind: subscription.EventChanged, ExternalID: "sub_1", UserID: "ghost", PriceID: "pri_year", Status: active, OccurredAt: start}}, "free"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newHarness(t)
			for _, ev := range tc.events {
				h.apply(ev)
			}
			if got := h.tier("amy"); got != tc.want {
				t.Errorf("%q", got)
			}
		})
	}
}

func TestOutcomes(t *testing.T) {
	h := newHarness(t)
	first := changed("sub_1", subscription.StatusActive, time.Hour)
	if got := h.apply(first); got != subscription.OutcomeApplied {
		t.Errorf("套用: %q", got)
	}
	if got := h.apply(first); got != subscription.OutcomeApplied {
		t.Errorf("重送回傳當時的結果: %q", got)
	}
	if got := h.apply(changed("sub_1", subscription.StatusCanceled, 0)); got != subscription.OutcomeStale {
		t.Errorf("晚到: %q", got)
	}
	ghost := changed("sub_2", subscription.StatusActive, 0)
	ghost.UserID = "ghost"
	if got := h.apply(ghost); got != subscription.OutcomeUnknownUser {
		t.Errorf("帳號不存在: %q", got)
	}
	price := changed("sub_3", subscription.StatusActive, 0)
	price.PriceID = "pri_other"
	if got := h.apply(price); got != subscription.OutcomeUnknownPrice {
		t.Errorf("價格: %q", got)
	}
}

func TestDuplicateIsCanceledOnceAndKeepsOriginal(t *testing.T) {
	h := newHarness(t)
	h.apply(changed("sub_1", subscription.StatusActive, 0))
	second := changed("sub_2", subscription.StatusActive, time.Hour)
	if got := h.apply(second); got != subscription.OutcomeDuplicate {
		t.Fatalf("%q", got)
	}
	h.apply(second)
	h.apply(changed("sub_2", subscription.StatusActive, 2*time.Hour))
	if len(h.provider.canceled) != 1 || h.provider.canceled[0] != "sub_2" {
		t.Errorf("要取消新的那筆一次: %v", h.provider.canceled)
	}
	if len(h.provider.canceledNow) != 0 {
		t.Errorf("重複訂閱只在期滿取消: %v", h.provider.canceledNow)
	}
	current, ok, err := h.svc.Current(context.Background(), "amy")
	if err != nil || !ok || current.ExternalID != "sub_1" {
		t.Errorf("主要的訂閱: %+v %v %v", current, ok, err)
	}
	// 重複的那筆退款,不影響原本的訂閱。
	h.apply(revoked("sub_2", 3*time.Hour))
	if got := h.tier("amy"); got != "pro" {
		t.Errorf("重複的退款後: %q", got)
	}
	// 原本的訂閱退款,不再有其他有效訂閱就停權。
	h.apply(revoked("sub_1", 4*time.Hour))
	if got := h.tier("amy"); got != "free" {
		t.Errorf("都退款後: %q", got)
	}
}

func TestExpiredSubscriptionIsNotDuplicate(t *testing.T) {
	h := newHarness(t)
	end := start.Add(24 * time.Hour)
	ev := changed("sub_1", subscription.StatusActive, 0)
	ev.CurrentPeriodEnd = &end
	h.apply(ev)
	h.now = end.Add(8 * 24 * time.Hour)
	if got := h.apply(changed("sub_2", subscription.StatusActive, time.Hour)); got != subscription.OutcomeApplied {
		t.Errorf("%q", got)
	}
	if len(h.provider.canceled) != 0 {
		t.Errorf("%v", h.provider.canceled)
	}
}

func TestCancelFailureDoesNotFailEventAndIsRetried(t *testing.T) {
	ctx := context.Background()
	h := newHarness(t)
	h.apply(changed("sub_1", subscription.StatusActive, 0))
	h.provider.cancelErr = errors.New("paddle down")
	if got := h.apply(revoked("sub_1", time.Hour)); got != subscription.OutcomeApplied {
		t.Fatalf("金流商失敗不影響事件: %q", got)
	}
	if got := h.tier("amy"); got != "free" {
		t.Errorf("停權不等金流商: %q", got)
	}
	// 還沒到下次重試的時間。
	h.provider.cancelErr = nil
	h.svc.RunTasks(ctx)
	if len(h.provider.canceled) != 0 {
		t.Errorf("提早重試: %v", h.provider.canceled)
	}
	h.now = h.now.Add(time.Hour)
	h.svc.RunTasks(ctx)
	h.svc.RunTasks(ctx)
	if len(h.provider.canceled) != 1 {
		t.Errorf("重試成功一次: %v", h.provider.canceled)
	}
	h.now = h.now.Add(24 * time.Hour)
	h.svc.RunTasks(ctx)
	if len(h.provider.canceled) != 1 {
		t.Errorf("完成後不再執行: %v", h.provider.canceled)
	}
}

func TestTaskGivesUpAndCanRestart(t *testing.T) {
	ctx := context.Background()
	h := newHarness(t)
	h.provider.cancelErr = errors.New("paddle down")
	h.apply(changed("sub_0", subscription.StatusActive, 0))
	h.apply(changed("sub_1", subscription.StatusActive, 0))
	for range 12 {
		h.now = h.now.Add(7 * time.Hour)
		h.svc.RunTasks(ctx)
	}
	var row struct {
		Attempts int
		FailedAt *time.Time
	}
	if err := h.db.Table("subscription_tasks").Where("external_id = ?", "sub_1").Scan(&row).Error; err != nil {
		t.Fatal(err)
	}
	if row.FailedAt == nil || row.Attempts != 10 {
		t.Fatalf("超過次數要放棄: %+v", row)
	}
	// 放棄的工作在同一筆訂閱又要取消時重新開始。
	h.provider.cancelErr = nil
	h.svc.RunTasks(ctx)
	if len(h.provider.canceled) != 0 {
		t.Errorf("放棄後不再執行: %v", h.provider.canceled)
	}
	h.apply(revoked("sub_1", time.Hour))
	if len(h.provider.canceledNow) != 1 || h.provider.canceledNow[0] != "sub_1" {
		t.Errorf("刪除帳號要立刻取消: %v", h.provider.canceledNow)
	}
}

// 退款只排定期滿取消的話,顧客能在金流商入口撤回,之後照常扣款卻沒有權限,所以要立刻取消。
func TestRefundCancelsImmediately(t *testing.T) {
	h := newHarness(t)
	h.apply(changed("sub_1", subscription.StatusActive, 0))
	h.apply(revoked("sub_1", time.Hour))
	if len(h.provider.canceledNow) != 1 || h.provider.canceledNow[0] != "sub_1" {
		t.Errorf("退款要立刻取消: %v", h.provider.canceledNow)
	}
}

func TestPaymentLinksSubscriptionToUser(t *testing.T) {
	withoutUser := changed("sub_1", subscription.StatusActive, 0)
	withoutUser.UserID = ""
	t.Run("訂閱事件先到", func(t *testing.T) {
		h := newHarness(t)
		if got := h.apply(withoutUser); got != subscription.OutcomeUnknownUser {
			t.Errorf("%q", got)
		}
		if got := h.tier("amy"); got != "free" {
			t.Errorf("還對不上: %q", got)
		}
		h.apply(paid("txn_1", "sub_1", "amy", "pri_year"))
		if got := h.tier("amy"); got != "pro" {
			t.Errorf("對上之後: %q", got)
		}
	})
	t.Run("交易事件先到", func(t *testing.T) {
		h := newHarness(t)
		h.apply(paid("txn_1", "sub_1", "amy", "pri_year"))
		if got := h.tier("amy"); got != "free" {
			t.Errorf("付款不開通權限: %q", got)
		}
		if got := h.apply(withoutUser); got != subscription.OutcomeApplied {
			t.Errorf("%q", got)
		}
		if got := h.tier("amy"); got != "pro" {
			t.Errorf("%q", got)
		}
	})
	t.Run("對上之後發現是重複訂閱", func(t *testing.T) {
		h := newHarness(t)
		h.apply(changed("sub_0", subscription.StatusActive, 0))
		h.apply(withoutUser)
		if got := h.apply(paid("txn_1", "sub_1", "amy", "pri_year")); got != subscription.OutcomeDuplicate {
			t.Errorf("%q", got)
		}
		if len(h.provider.canceled) != 1 || h.provider.canceled[0] != "sub_1" {
			t.Errorf("%v", h.provider.canceled)
		}
	})
	t.Run("事件帶的帳號不能改掉已記下的帳號", func(t *testing.T) {
		h := newHarness(t)
		h.apply(changed("sub_1", subscription.StatusActive, 0))
		other := changed("sub_1", subscription.StatusActive, time.Hour)
		other.UserID = "bob"
		h.apply(other)
		h.apply(paid("txn_1", "sub_1", "bob", "pri_year"))
		if h.tier("amy") != "pro" || h.tier("bob") != "free" {
			t.Errorf("amy %q bob %q", h.tier("amy"), h.tier("bob"))
		}
	})
}

func TestPaymentRecords(t *testing.T) {
	type payment struct {
		TransactionID string
		UserID        string
		PaidAt        time.Time
	}
	cases := []struct {
		name     string
		ev       subscription.Event
		outcome  subscription.Outcome
		wantUser string
	}{
		{"訂閱紀錄的帳號優先", paid("txn_1", "sub_1", "bob", "pri_year"), subscription.OutcomeApplied, "amy"},
		{"續訂沒有帶 userId", paid("txn_2", "sub_1", "", "pri_year"), subscription.OutcomeApplied, "amy"},
		{"訂閱事件還沒到", paid("txn_3", "sub_9", "bob", "pri_year"), subscription.OutcomeApplied, "bob"},
		{"對不上帳號也要留紀錄", paid("txn_4", "sub_9", "", "pri_year"), subscription.OutcomeUnknownUser, ""},
		{"帳號不存在也要留紀錄", paid("txn_5", "sub_9", "ghost", "pri_year"), subscription.OutcomeUnknownUser, ""},
		{"對不上價格也要留紀錄", paid("txn_6", "sub_1", "", "pri_other"), subscription.OutcomeUnknownPrice, "amy"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newHarness(t)
			h.apply(changed("sub_1", subscription.StatusActive, 0))
			if got := h.apply(tc.ev); got != tc.outcome {
				t.Fatalf("%q", got)
			}
			h.apply(tc.ev)
			var rows []payment
			if err := h.db.Table("subscription_payments").Find(&rows).Error; err != nil {
				t.Fatal(err)
			}
			if len(rows) != 1 || rows[0].UserID != tc.wantUser || !rows[0].PaidAt.Equal(start) {
				t.Errorf("付款紀錄: %+v", rows)
			}
		})
	}
}

func TestPaymentDoesNotRestoreAccess(t *testing.T) {
	h := newHarness(t)
	h.apply(changed("sub_1", subscription.StatusCanceled, 0))
	h.apply(paid("txn_1", "sub_1", "amy", "pri_year"))
	if got := h.tier("amy"); got != "free" {
		t.Errorf("%q", got)
	}
	if len(h.provider.canceled) != 0 {
		t.Errorf("%v", h.provider.canceled)
	}
}

func TestAccessEndsAfterGrace(t *testing.T) {
	end := start.Add(30 * 24 * time.Hour)
	const day = 24 * time.Hour
	cases := []struct {
		status subscription.Status
		days   time.Duration
	}{
		{subscription.StatusActive, 7},
		{subscription.StatusPastDue, 35},
	}
	for _, tc := range cases {
		t.Run(string(tc.status), func(t *testing.T) {
			h := newHarness(t)
			ev := changed("sub_1", tc.status, 0)
			ev.CurrentPeriodEnd = &end
			h.apply(ev)
			h.now = end.Add(tc.days * day)
			if got := h.tier("amy"); got != "pro" {
				t.Errorf("上限當下: %q", got)
			}
			h.now = h.now.Add(time.Second)
			if got := h.tier("amy"); got != "free" {
				t.Errorf("超過上限: %q", got)
			}
		})
	}
}

func TestStatusForScreen(t *testing.T) {
	h := newHarness(t)
	status, err := h.svc.Status(context.Background(), "amy")
	if err != nil || status.Subscribed || status.Subscription != nil {
		t.Errorf("沒有訂閱: %+v %v", status, err)
	}
	end := start.Add(30 * 24 * time.Hour)
	ev := changed("sub_1", subscription.StatusPastDue, 0)
	ev.CurrentPeriodEnd, ev.CancelAt, ev.CustomerID = &end, &end, "ctm_1"
	h.apply(ev)
	status, err = h.svc.Status(context.Background(), "amy")
	if err != nil || !status.Subscribed || status.Subscription == nil || status.Subscription.Status != subscription.StatusPastDue ||
		!status.Subscription.CurrentPeriodEnd.Equal(end) || !status.Subscription.CancelAt.Equal(end) {
		t.Errorf("%+v %v", status, err)
	}
	current, _, _ := h.svc.Current(context.Background(), "amy")
	if current.CustomerID != "ctm_1" {
		t.Errorf("顧客 ID: %+v", current)
	}
	// 之後的事件沒帶顧客 ID 也要保留;排定的取消被撤銷要清掉。
	later := changed("sub_1", subscription.StatusActive, time.Hour)
	h.apply(later)
	current, _, _ = h.svc.Current(context.Background(), "amy")
	if current.CustomerID != "ctm_1" || current.CancelAt != nil {
		t.Errorf("%+v", current)
	}
}

func TestCurrentIgnoresExpired(t *testing.T) {
	h := newHarness(t)
	end := start.Add(30 * 24 * time.Hour)
	first := changed("sub_1", subscription.StatusPastDue, 0)
	first.CurrentPeriodEnd = &end
	h.apply(first)
	h.now = end.Add(36 * 24 * time.Hour)
	h.apply(changed("sub_2", subscription.StatusActive, time.Hour))
	current, ok, err := h.svc.Current(context.Background(), "amy")
	if err != nil || !ok || current.ExternalID != "sub_2" {
		t.Errorf("%+v %v %v", current, ok, err)
	}
}

func TestReplay(t *testing.T) {
	ctx := context.Background()
	h := newHarness(t)
	narrow := subscription.Catalog{Default: "free", Plans: []subscription.Plan{{Tier: "free"}}}
	h.svc = h.service(narrow)
	ev := changed("sub_1", subscription.StatusActive, 0)
	if got := h.apply(ev); got != subscription.OutcomeUnknownPrice {
		t.Fatalf("%q", got)
	}
	// 補上價格之後重新處理。
	h.svc = h.service(catalog)
	if got := h.apply(ev); got != subscription.OutcomeUnknownPrice {
		t.Errorf("重送不會重新處理: %q", got)
	}
	if got, err := h.svc.Replay(ctx, ev.ID); err != nil || got != subscription.OutcomeApplied {
		t.Fatalf("%q %v", got, err)
	}
	if got := h.tier("amy"); got != "pro" {
		t.Errorf("%q", got)
	}
	var outcome string
	if err := h.db.Table("subscription_events").Select("outcome").Where("event_id = ?", ev.ID).Scan(&outcome).Error; err != nil || outcome != "applied" {
		t.Errorf("%q %v", outcome, err)
	}
	if _, err := h.svc.Replay(ctx, "evt_none"); !errors.Is(err, subscription.ErrEventNotReplayable) {
		t.Errorf("沒有這個事件: %v", err)
	}
	// 原始內容過期後清除,事件紀錄保留。
	h.now = time.Now().Add(91 * 24 * time.Hour)
	h.svc.PurgeExpired(ctx)
	if _, err := h.svc.Replay(ctx, ev.ID); !errors.Is(err, subscription.ErrEventNotReplayable) {
		t.Errorf("內容已清除: %v", err)
	}
	var count int64
	if err := h.db.Table("subscription_events").Where("event_id = ?", ev.ID).Count(&count).Error; err != nil || count != 1 {
		t.Errorf("事件紀錄要保留: %d %v", count, err)
	}
}

func TestCancelUserQueuesActiveSubscriptions(t *testing.T) {
	h := newHarness(t)
	h.apply(changed("sub_1", subscription.StatusActive, 0))
	h.apply(changed("sub_2", subscription.StatusCanceled, 0))
	if err := h.svc.CancelUser(context.Background(), "amy"); err != nil {
		t.Fatal(err)
	}
	if len(h.provider.canceled) != 1 || h.provider.canceled[0] != "sub_1" {
		t.Errorf("%v", h.provider.canceled)
	}
}
