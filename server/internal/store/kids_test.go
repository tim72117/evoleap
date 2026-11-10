package store

import (
	"context"
	"errors"
	"testing"
	"time"
)

func tw(s string) time.Time {
	t, err := time.ParseInLocation("2006-01-02 15:04", s, KidsZone)
	if err != nil {
		panic(err)
	}
	return t
}

// 2026-11-10 是週二
func TestScheduleAt(t *testing.T) {
	slots := []Slot{{Day: 1, Time: "16:00"}, {Day: 5, Time: "10:00"}}
	cases := []struct {
		at     string
		open   bool
		nextAt string
	}{
		{"2026-11-10 15:59", false, "2026-11-10 16:00"},
		{"2026-11-10 16:00", true, "2026-11-14 10:00"},
		{"2026-11-10 16:59", true, "2026-11-14 10:00"},
		{"2026-11-10 17:00", false, "2026-11-14 10:00"},
		// 週日晚上:下一堂是下週二
		{"2026-11-15 20:00", false, "2026-11-17 16:00"},
	}
	for _, c := range cases {
		s := ScheduleAt(slots, 60, tw(c.at))
		if s.Open != c.open || s.NextAt == nil || !s.NextAt.Equal(tw(c.nextAt)) {
			t.Errorf("%s: open=%v next=%v, want open=%v next=%s", c.at, s.Open, s.NextAt, c.open, c.nextAt)
		}
	}
	// 用別的時區問也照台灣時間算
	if s := ScheduleAt(slots, 60, tw("2026-11-10 16:30").UTC()); !s.Open || s.Current.Time != "16:00" {
		t.Errorf("UTC 的時間: %+v", s)
	}
	// 週日深夜開始的時段跨到週一
	if s := ScheduleAt([]Slot{{Day: 6, Time: "23:30"}}, 60, tw("2026-11-16 00:10")); !s.Open {
		t.Error("跨過午夜的時段")
	}
	// 家長設定每次 30 分鐘:16:30 就關了
	if s := ScheduleAt(slots, 30, tw("2026-11-10 16:29")); !s.Open || !s.EndsAt.Equal(tw("2026-11-10 16:30")) {
		t.Errorf("30 分鐘的時段: %+v", s)
	}
	if s := ScheduleAt(slots, 30, tw("2026-11-10 16:30")); s.Open {
		t.Error("30 分鐘到了要關")
	}
	if s := ScheduleAt(nil, 60, tw("2026-11-10 16:00")); s.Open || s.NextAt != nil {
		t.Errorf("沒有時段: %+v", s)
	}
}

func TestChildren(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	c, err := st.CreateChild(ctx, "parent1", " 小花 ")
	if err != nil || c.Name != "小花" || len(c.Slots) != 0 || c.Minutes != MaxMinutes || c.Avatar != Avatars[0] {
		t.Fatalf("新增: %+v %v", c, err)
	}
	slots := []Slot{{Day: 5, Time: "10:00"}, {Day: 1, Time: "16:00"}}
	c, err = st.UpdateChild(ctx, "parent1", c.ID, ChildPatch{Slots: &slots})
	if err != nil || len(c.Slots) != 2 || c.Slots[0].Day != 1 {
		t.Fatalf("排時段(依一週順序): %+v %v", c, err)
	}
	for _, bad := range [][]Slot{
		{{1, "16:00"}, {2, "16:00"}, {3, "16:00"}, {4, "16:00"}},
		{{7, "16:00"}},
		{{1, "4pm"}},
		{{1, "16:00"}, {1, "16:00"}},
	} {
		if _, err := st.UpdateChild(ctx, "parent1", c.ID, ChildPatch{Slots: &bad}); !errors.Is(err, ErrInvalidChild) {
			t.Errorf("不合規則的時段 %v: %v", bad, err)
		}
	}
	// 每次上課多久:5–60 分鐘,以 5 分鐘為單位
	m := 30
	if c, err = st.UpdateChild(ctx, "parent1", c.ID, ChildPatch{Minutes: &m}); err != nil || c.Minutes != 30 {
		t.Errorf("設定 30 分鐘: %+v %v", c, err)
	}
	for _, bad := range []int{0, 3, 61, 90, 22} {
		if _, err := st.UpdateChild(ctx, "parent1", c.ID, ChildPatch{Minutes: &bad}); !errors.Is(err, ErrInvalidChild) {
			t.Errorf("%d 分鐘: %v", bad, err)
		}
	}
	// 頭像:第二個孩子給下一個沒用過的;只能從清單裡選
	if c2, _ := st.CreateChild(ctx, "parent1", "小明"); c2.Avatar != Avatars[1] {
		t.Errorf("第二個孩子的頭像: %q", c2.Avatar)
	}
	fox := "🦊"
	if c, err = st.UpdateChild(ctx, "parent1", c.ID, ChildPatch{Avatar: &fox}); err != nil || c.Avatar != "🦊" {
		t.Errorf("換頭像: %+v %v", c, err)
	}
	bad := "<b>"
	if _, err := st.UpdateChild(ctx, "parent1", c.ID, ChildPatch{Avatar: &bad}); !errors.Is(err, ErrInvalidChild) {
		t.Errorf("不在清單裡的頭像: %v", err)
	}
	// 別的家長拿不到、改不到、刪不到
	if _, err := st.ChildOf(ctx, "parent2", c.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("別人的孩子: %v", err)
	}
	name := "x"
	if _, err := st.UpdateChild(ctx, "parent2", c.ID, ChildPatch{Name: &name}); !errors.Is(err, ErrNotFound) {
		t.Errorf("改別人的孩子: %v", err)
	}
	if err := st.DeleteChild(ctx, "parent2", c.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("刪別人的孩子: %v", err)
	}
	if _, err := st.CreateChild(ctx, "parent1", ""); !errors.Is(err, ErrInvalidChild) {
		t.Errorf("空的暱稱: %v", err)
	}
	if err := st.DeleteChild(ctx, "parent1", c.ID); err != nil {
		t.Errorf("刪掉: %v", err)
	}
}
