package api

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/subscription"
	"github.com/tim72117/subscription/paddle"
)

// 同時送達的事件要依序處理才不會出錯。要有列鎖才測得出來,所以只在 Postgres 上跑(SQLite 沒有列鎖)。
func concurrentService(t *testing.T) (*store.Store, *subscription.Service, string) {
	t.Helper()
	if os.Getenv("TEST_DATABASE_URL") == "" {
		t.Skip("需要 TEST_DATABASE_URL")
	}
	st := openTestStore(t)
	user, err := st.CreatePasswordUser(context.Background(), "amy@example.com", "amy", "hash")
	if err != nil {
		t.Fatal(err)
	}
	return st, testSubscriptionsWith(t, st, paddle.New(paddle.Config{}), testPrices...), user.ID
}

func applyAll(t *testing.T, svc *subscription.Service, events []subscription.Event) {
	t.Helper()
	var wg sync.WaitGroup
	errs := make(chan error, len(events))
	for _, ev := range events {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.Apply(context.Background(), ev, []byte("{}"))
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestConcurrentEventsKeepLatest(t *testing.T) {
	_, svc, userID := concurrentService(t)
	start := time.Date(2026, 11, 5, 8, 0, 0, 0, time.UTC)
	const count = 30
	events := make([]subscription.Event, count)
	for i := range events {
		status := subscription.StatusActive
		if i == count-1 {
			status = subscription.StatusCanceled // 最新的事件是取消,不管誰先寫入,最後都要停權
		}
		events[i] = subscription.Event{
			ID:         fmt.Sprintf("evt_%d", i),
			Kind:       subscription.EventChanged,
			ExternalID: "sub_1",
			UserID:     userID,
			PriceID:    "pri_sub",
			Status:     status,
			OccurredAt: start.Add(time.Duration(i) * time.Minute),
		}
	}
	// 先處理一筆,鎖的那一列才存在;否則第一次新增那一列就會擋住其他交易,測不到鎖本身。
	applyAll(t, svc, events[:1])
	applyAll(t, svc, events[1:])
	status, err := svc.Status(context.Background(), userID)
	if err != nil {
		t.Fatal(err)
	}
	if status.CurrentTier != "free" {
		t.Errorf("舊事件蓋掉了最新的取消: %q", status.CurrentTier)
	}
}

// 同一個人同時結帳兩次,只有一筆算數,另一筆要被取消。
func TestConcurrentSubscriptionsOnlyOneCounts(t *testing.T) {
	st, svc, userID := concurrentService(t)
	start := time.Date(2026, 11, 5, 8, 0, 0, 0, time.UTC)
	const count = 30
	events := make([]subscription.Event, count)
	for i := range events {
		events[i] = subscription.Event{
			ID:         fmt.Sprintf("evt_%d", i),
			Kind:       subscription.EventChanged,
			ExternalID: fmt.Sprintf("sub_%d", i),
			UserID:     userID,
			PriceID:    "pri_sub",
			Status:     subscription.StatusActive,
			OccurredAt: start,
		}
	}
	// 先有一筆已結束的訂閱,使用者的鎖才存在,理由同上。
	for _, status := range []subscription.Status{subscription.StatusActive, subscription.StatusCanceled} {
		applyAll(t, svc, []subscription.Event{{
			ID: "evt_old_" + string(status), Kind: subscription.EventChanged, ExternalID: "sub_old", UserID: userID, PriceID: "pri_sub", Status: status,
			OccurredAt: start.Add(-time.Hour),
		}})
	}
	applyAll(t, svc, events)
	var counted, tasks int64
	if err := st.DB().Table("subscriptions").Where("user_id = ? AND duplicate = ? AND status = ?", userID, false, "active").Count(&counted).Error; err != nil {
		t.Fatal(err)
	}
	if err := st.DB().Table("subscription_tasks").Count(&tasks).Error; err != nil {
		t.Fatal(err)
	}
	if counted != 1 || tasks != count-1 {
		t.Errorf("算數 %d 筆,取消 %d 筆", counted, tasks)
	}
}
