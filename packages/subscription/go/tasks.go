package subscription

import (
	"context"
	"log"
	"time"
)

const (
	taskBatch       = 10
	taskMaxAttempts = 10
	taskMaxBackoff  = 6 * time.Hour
	// workerInterval 是背景工作的執行間隔。
	workerInterval = time.Minute
	// payloadRetention 是事件原始內容的保存時間。內容比事件紀錄多(例如付款方式的摘要),只留到足夠處理問題。
	payloadRetention = 90 * 24 * time.Hour
	purgeInterval    = 24 * time.Hour
)

// TaskKind 是要向金流商做的工作。
type TaskKind string

// TaskCancel 是在當期結束時取消訂閱。
const TaskCancel TaskKind = "cancel"

// Task 是排入資料庫、由背景重試的工作。Attempts 包含這次。
type Task struct {
	Source     Source
	ExternalID string
	Kind       TaskKind
	Attempts   int
}

func taskBackoff(attempts int) time.Duration {
	backoff := time.Minute << min(attempts, 16)
	return min(backoff, taskMaxBackoff)
}

// RunTasks 執行到期的工作。失敗的工作會在之後重試,超過次數就放棄並留下紀錄,要人工處理。
func (s *Service) RunTasks(ctx context.Context) {
	if s.provider == nil {
		return
	}
	tasks, err := s.store.ClaimTasks(ctx, s.provider.Source(), s.now(), taskBatch, taskBackoff)
	if err != nil {
		log.Printf("subscription: 無法取得工作: %v", err)
		return
	}
	for _, task := range tasks {
		runErr := s.runTask(ctx, task)
		giveUp := runErr != nil && task.Attempts >= taskMaxAttempts
		if runErr != nil {
			log.Printf("subscription: 訂閱 %s 的工作 %s 第 %d 次失敗: %v", task.ExternalID, task.Kind, task.Attempts, runErr)
		}
		if giveUp {
			log.Printf("subscription: 訂閱 %s 的工作 %s 不再重試,要人工處理", task.ExternalID, task.Kind)
		}
		if err := s.store.FinishTask(ctx, task, s.now(), runErr, giveUp); err != nil {
			log.Printf("subscription: 無法記錄工作結果: %v", err)
		}
	}
}

func (s *Service) runTask(ctx context.Context, task Task) error {
	return s.provider.Cancel(ctx, task.ExternalID)
}

// Run 在背景定期執行工作並清除過期的事件原始內容,直到 ctx 結束。
// 處理事件後也會順便執行一次,這裡負責重試。
func (s *Service) Run(ctx context.Context) {
	s.PurgeExpired(ctx)
	tick := time.NewTicker(workerInterval)
	defer tick.Stop()
	purge := time.NewTicker(purgeInterval)
	defer purge.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			s.RunTasks(ctx)
		case <-purge.C:
			s.PurgeExpired(ctx)
		}
	}
}

// PurgeExpired 清除過期的事件原始內容,事件紀錄本身保留。
func (s *Service) PurgeExpired(ctx context.Context) {
	if err := s.store.PurgePayloads(ctx, s.now().Add(-payloadRetention)); err != nil {
		log.Printf("subscription: 無法清除事件原始內容: %v", err)
	}
}
