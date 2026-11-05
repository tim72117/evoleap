package subscription

import (
	"context"
	"errors"
	"time"
)

// ErrEventNotReplayable 是事件不存在或原始內容已清除,無法重新處理時回傳的錯誤。
var ErrEventNotReplayable = errors.New("subscription: event not replayable")

// runTasksTimeout 是處理完事件後順便執行工作的時間上限,不能讓金流商等太久。
const runTasksTimeout = 10 * time.Second

// Apply 處理金流商的事件。訂閱狀態、事件紀錄與要做的工作在同一個交易內寫入,回傳錯誤時都不會留下,呼叫端要讓金流商重送。
// 重送的事件直接回傳當時的結果;對不上帳號或價格重送也沒有用,所以不算錯誤,由 Outcome 表示。
// 向金流商取消訂閱是排入工作後才做,金流商出錯不會讓事件失敗。
func (s *Service) Apply(ctx context.Context, ev Event, payload []byte) (Outcome, error) {
	outcome, err := s.process(ctx, ev, payload, false)
	if err != nil {
		return "", err
	}
	s.runTasksAfterEvent(ctx)
	return outcome, nil
}

// Replay 用保存的原始內容重新處理事件,例如補上方案價格之後處理當時對不上的付款。
func (s *Service) Replay(ctx context.Context, eventID string) (Outcome, error) {
	if s.provider == nil {
		return "", ErrEventNotReplayable
	}
	payload, ok, err := s.store.EventPayload(ctx, s.provider.Source(), eventID)
	if err != nil {
		return "", err
	}
	if !ok {
		return "", ErrEventNotReplayable
	}
	ev, err := s.provider.ParseEvent(payload)
	if err != nil {
		return "", err
	}
	if ev == nil {
		return "", ErrEventNotReplayable
	}
	outcome, err := s.process(ctx, *ev, payload, true)
	if err != nil {
		return "", err
	}
	s.runTasksAfterEvent(ctx)
	return outcome, nil
}

func (s *Service) process(ctx context.Context, ev Event, payload []byte, replay bool) (outcome Outcome, err error) {
	source := s.provider.Source()
	// 查帳號放在交易外面,交易內不用另一條資料庫連線。
	if ev.UserID != "" && s.userExists != nil {
		exists, err := s.userExists(ctx, ev.UserID)
		if err != nil {
			return "", err
		}
		if !exists {
			ev.UserID = ""
		}
	}
	key := "event:" + ev.ID
	if ev.ExternalID != "" {
		key = "sub:" + string(source) + ":" + ev.ExternalID
	}
	err = s.store.Transact(ctx, func(tx Tx) error {
		if err := tx.Lock(ctx, key); err != nil {
			return err
		}
		if !replay {
			seen, ok, err := tx.HasEvent(ctx, source, ev.ID)
			if err != nil {
				return err
			}
			if ok {
				outcome = seen
				return nil
			}
		}
		// fn 可能重試,每次都從原本的事件開始。
		record := ev
		var err error
		switch ev.Kind {
		case EventPaid:
			outcome, err = s.applyPaid(ctx, tx, source, &record)
		case EventRevoked:
			outcome, err = s.applyRevoked(ctx, tx, source, &record)
		default:
			outcome, err = s.applyChanged(ctx, tx, source, &record)
		}
		if err != nil {
			return err
		}
		return tx.SaveEvent(ctx, EventRecord{Source: source, Event: record, Outcome: outcome, Payload: payload})
	})
	if err != nil {
		return "", err
	}
	return outcome, nil
}

// ownerOf 決定訂閱屬於誰:已經記下的帳號不會被事件改掉。
func ownerOf(current, fromEvent string) string {
	if current != "" {
		return current
	}
	return fromEvent
}

func (s *Service) applyChanged(ctx context.Context, tx Tx, source Source, ev *Event) (Outcome, error) {
	tier, ok := s.TierForPrice(ev.PriceID)
	if !ok {
		return OutcomeUnknownPrice, nil
	}
	cur, found, err := tx.Subscription(ctx, source, ev.ExternalID)
	if err != nil {
		return "", err
	}
	userID := ownerOf(cur.UserID, ev.UserID)
	ev.UserID = userID

	fresh := cur.Status != StatusRevoked && (cur.LastEventAt == nil || !ev.OccurredAt.Before(*cur.LastEventAt))
	next := cur
	if fresh {
		next = Subscription{
			Status:           ev.Status,
			CurrentPeriodEnd: ev.CurrentPeriodEnd,
			CancelAt:         ev.CancelAt,
			Duplicate:        cur.Duplicate,
			LastEventAt:      &ev.OccurredAt,
		}
	}
	// 晚到的事件不能改狀態,但可能補上之前缺的帳號與方案。
	next.Source, next.ExternalID, next.UserID, next.Tier = source, ev.ExternalID, userID, tier
	if ev.CustomerID != "" {
		next.CustomerID = ev.CustomerID
	} else if next.CustomerID == "" {
		next.CustomerID = cur.CustomerID
	}
	duplicate, err := s.markDuplicate(ctx, tx, cur, found, &next)
	if err != nil {
		return "", err
	}
	if err := tx.SaveSubscription(ctx, next); err != nil {
		return "", err
	}
	switch {
	case duplicate:
		return OutcomeDuplicate, nil
	case !fresh:
		return OutcomeStale, nil
	case userID == "":
		return OutcomeUnknownUser, nil
	}
	return OutcomeApplied, nil
}

// markDuplicate 在訂閱開始算數時,判斷使用者是否已有另一筆有效訂閱(例如開兩個分頁各結帳一次)。
// 是的話標記並排入取消,否則金流商會繼續扣款;事件先後不影響,晚到的那筆才算重複。
func (s *Service) markDuplicate(ctx context.Context, tx Tx, cur Subscription, found bool, next *Subscription) (bool, error) {
	if next.UserID == "" || next.Duplicate || !grantsAccess(next.Status) {
		return false, nil
	}
	if found && cur.UserID != "" && grantsAccess(cur.Status) {
		return false, nil
	}
	if err := tx.Lock(ctx, "user:"+next.UserID); err != nil {
		return false, err
	}
	others, err := tx.SubscriptionsOf(ctx, next.UserID)
	if err != nil {
		return false, err
	}
	for _, other := range others {
		if other.Source == next.Source && other.ExternalID == next.ExternalID {
			continue
		}
		if !other.Duplicate && s.hasAccess(other) {
			next.Duplicate = true
			return true, tx.AddTask(ctx, Task{Source: next.Source, ExternalID: next.ExternalID, Kind: TaskCancel}, s.now())
		}
	}
	return false, nil
}

// applyRevoked:全額退款或爭議款立即停權。退款不一定會結束金流商那邊的訂閱,所以也要取消。
// 退款可能比訂閱事件先到,先留下已退款的紀錄,之後的事件只會補上帳號,不會讓它恢復。
func (s *Service) applyRevoked(ctx context.Context, tx Tx, source Source, ev *Event) (Outcome, error) {
	cur, _, err := tx.Subscription(ctx, source, ev.ExternalID)
	if err != nil {
		return "", err
	}
	ev.UserID = cur.UserID
	if cur.Status == StatusRevoked {
		return OutcomeStale, nil
	}
	cur.Source, cur.ExternalID = source, ev.ExternalID
	cur.Status = StatusRevoked
	cur.LastEventAt = &ev.OccurredAt
	if err := tx.SaveSubscription(ctx, cur); err != nil {
		return "", err
	}
	if err := tx.AddTask(ctx, Task{Source: source, ExternalID: ev.ExternalID, Kind: TaskCancel}, s.now()); err != nil {
		return "", err
	}
	return OutcomeApplied, nil
}

// applyPaid 保存付款紀錄,不影響權限。對不上帳號或價格也要留下,才查得到這筆款項。
// 金流商不保證訂閱事件帶著 userId,所以交易帶的 userId 也用來補上訂閱的帳號。
func (s *Service) applyPaid(ctx context.Context, tx Tx, source Source, ev *Event) (Outcome, error) {
	cur, found, err := tx.Subscription(ctx, source, ev.ExternalID)
	if err != nil {
		return "", err
	}
	userID := ownerOf(cur.UserID, ev.UserID)
	ev.UserID = userID

	outcome := OutcomeApplied
	if ev.ExternalID != "" && cur.UserID == "" && userID != "" {
		next := cur
		next.Source, next.ExternalID, next.UserID = source, ev.ExternalID, userID
		duplicate, err := s.markDuplicate(ctx, tx, cur, found, &next)
		if err != nil {
			return "", err
		}
		if duplicate {
			outcome = OutcomeDuplicate
		}
		if err := tx.SaveSubscription(ctx, next); err != nil {
			return "", err
		}
	}
	if userID == "" {
		outcome = OutcomeUnknownUser
	} else if _, ok := s.TierForPrice(ev.PriceID); !ok && outcome == OutcomeApplied {
		outcome = OutcomeUnknownPrice
	}
	payment := Payment{Source: source, TransactionID: ev.TransactionID, ExternalID: ev.ExternalID, UserID: userID, PriceID: ev.PriceID, PaidAt: ev.PaidAt}
	if err := tx.SavePayment(ctx, payment); err != nil {
		return "", err
	}
	return outcome, nil
}

// CancelUser 排入取消使用者的全部有效訂閱,刪除帳號前呼叫。訂閱與付款紀錄會保留,用來對帳與處理爭議。
func (s *Service) CancelUser(ctx context.Context, userID string) error {
	err := s.store.Transact(ctx, func(tx Tx) error {
		if err := tx.Lock(ctx, "user:"+userID); err != nil {
			return err
		}
		subs, err := tx.SubscriptionsOf(ctx, userID)
		if err != nil {
			return err
		}
		for _, sub := range subs {
			if !grantsAccess(sub.Status) {
				continue
			}
			if err := tx.AddTask(ctx, Task{Source: sub.Source, ExternalID: sub.ExternalID, Kind: TaskCancel}, s.now()); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	s.runTasksAfterEvent(ctx)
	return nil
}

func (s *Service) runTasksAfterEvent(ctx context.Context) {
	if s.provider == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), runTasksTimeout)
	defer cancel()
	s.RunTasks(ctx)
}
