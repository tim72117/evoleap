package store

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

// 首頁停留時間依訪客彙整;since 只算這段時間內打開的紀錄。
func TestAdminOverviewHomeStaysAndSince(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	// 資料照正式寫入的方式存成 UTC,篩選起點用非 UTC 的時區:SQLite 比的是字串,兩邊時區不同時也要算對
	taipei := time.FixedZone("UTC+8", 8*60*60)
	now := now()
	rows := []guestViewRow{
		// 訪客甲:今天打開首頁兩次,第二次捲到一半
		{ID: "a1", GuestID: "guestaaaa-0001", Lesson: "page:/", Device: "desktop", Source: "direct", VisibleMs: 4000, OpenedAt: now.Add(-2 * time.Hour)},
		{ID: "a2", GuestID: "guestaaaa-0001", Lesson: "page:/", Device: "mobile", Source: "google.com", VisibleMs: 9000,
			Events: `[{"t":100,"e":"scroll:25%"},{"t":900,"e":"scroll:50%"}]`, OpenedAt: now.Add(-10 * time.Minute)},
		// 訪客乙:三天前打開首頁
		{ID: "b1", GuestID: "guestbbbb-0002", Lesson: "page:/", Device: "desktop", VisibleMs: 7000, OpenedAt: now.Add(-72 * time.Hour)},
		// 爬蟲與別的頁面不算
		{ID: "c1", GuestID: "guestcccc-0003", Lesson: "page:/", Device: DeviceBot, VisibleMs: 1000, OpenedAt: now},
		{ID: "a3", GuestID: "guestaaaa-0001", Lesson: "page:/topics/web", Device: "desktop", VisibleMs: 5000, OpenedAt: now},
	}
	if err := st.db.Create(&rows).Error; err != nil {
		t.Fatal(err)
	}

	all, err := st.AdminOverview(ctx, time.Time{})
	if err != nil {
		t.Fatal(err)
	}
	stays := all.GuestStats.HomeStays
	if len(stays) != 2 {
		t.Fatalf("stays = %+v", stays)
	}
	a := stays[0]
	if a.Guest != "guestaaa" || a.Visits != 2 || a.TotalMs != 13000 || a.LongestMs != 9000 || a.MaxScroll != 50 || a.Device != "mobile" || a.Source != "google.com" {
		t.Errorf("guest a = %+v", a)
	}
	if stays[1].Guest != "guestbbb" || stays[1].TotalMs != 7000 {
		t.Errorf("guest b = %+v", stays[1])
	}
	if all.Guests != 3 {
		t.Errorf("guests = %d, want 3", all.Guests)
	}

	recent, err := st.AdminOverview(ctx, now.Add(-30*time.Minute).In(taipei))
	if err != nil {
		t.Fatal(err)
	}
	if s := recent.GuestStats.HomeStays; len(s) != 1 || s[0].Visits != 1 || s[0].TotalMs != 9000 {
		t.Errorf("30m stays = %+v", s)
	}
	if recent.Guests != 2 { // 甲、爬蟲
		t.Errorf("30m guests = %d, want 2", recent.Guests)
	}
}
