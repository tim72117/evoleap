package store

import (
	"context"
	"testing"
	"time"
)

// 首頁主題卡片的觀看次數:訪客打開(不含爬蟲)加上會員有播放紀錄的課;只算有腳本的課,依主題加總
func TestTopicViews(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	now := time.Now()
	add := func(id, lesson, device string) {
		t.Helper()
		if err := st.db.Create(&guestViewRow{ID: id, GuestID: "g" + id, Lesson: lesson, Device: device, OpenedAt: now, UpdatedAt: now}).Error; err != nil {
			t.Fatal(err)
		}
	}
	add("1", "live:web/0.1.json", DeviceDesktop)
	add("2", "live:web/0.1.json", DeviceMobile)
	add("3", "live:web/0.1.json", DeviceBot) // 爬蟲不算
	add("4", "kids:kids/0.1.json", DeviceDesktop)
	add("5", "page:/", DeviceDesktop)              // 不是課的紀錄不算
	add("6", "live:nope/none.json", DeviceDesktop) // 沒有對應的課不算
	add("7", "live:web/1.3.json", DeviceDesktop)   // 草稿的課(web 1.3)不算
	if err := st.db.Create(&progressRow{UserID: "u1", Lesson: "live:web/0.1.json", PositionMs: 1, DurationMs: 2, UpdatedAt: now}).Error; err != nil {
		t.Fatal(err)
	}
	got, err := st.TopicViews(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if got["web"] != 3 || got["kids"] != 1 || len(got) != 2 {
		t.Errorf("觀看次數: %v(預期 web=3、kids=1)", got)
	}
}
