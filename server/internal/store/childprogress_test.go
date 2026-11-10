package store

import (
	"context"
	"errors"
	"testing"
)

func TestChildProgressAndLessons(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	a, _ := st.CreateChild(ctx, "parent1", "小花")
	b, _ := st.CreateChild(ctx, "parent1", "小明")
	save := func(childID string, pos, dur int) bool {
		t.Helper()
		logged, err := st.SaveChildProgress(ctx, childID, Progress{Lesson: "kids:kids/0.1.json", PositionMs: pos, DurationMs: dur})
		if err != nil {
			t.Fatal(err)
		}
		return logged
	}
	// 播到一半不記;播完記一筆;看完後再存(例如來回拖)不重複記
	if save(a.ID, 30_000, 120_000) {
		t.Error("播到一半不該記")
	}
	if !save(a.ID, 118_000, 120_000) {
		t.Error("看完要記一筆")
	}
	if save(a.ID, 120_000, 120_000) {
		t.Error("已經看完,再存不重複記")
	}
	// 重看一遍:回到開頭再看完,再記一筆
	save(a.ID, 0, 120_000)
	if !save(a.ID, 119_000, 120_000) {
		t.Error("重看再看完要再記一筆")
	}
	logs, err := st.ChildLessons(ctx, a.ID)
	if err != nil || len(logs) != 2 || logs[0].Lesson != "kids:kids/0.1.json" {
		t.Fatalf("小花的上課紀錄: %+v %v", logs, err)
	}

	// 每個孩子分開:小明沒有紀錄,進度也是空的
	if logs, _ := st.ChildLessons(ctx, b.ID); len(logs) != 0 {
		t.Errorf("小明不該有小花的紀錄: %+v", logs)
	}
	if list, _ := st.ChildProgressList(ctx, b.ID); len(list) != 0 {
		t.Errorf("小明不該有小花的進度: %+v", list)
	}
	if p, err := st.ChildProgressOf(ctx, a.ID, "kids:kids/0.1.json"); err != nil || p.PositionMs != 119_000 {
		t.Errorf("小花的進度: %+v %v", p, err)
	}
	// 家長本人的進度不受影響
	if list, _ := st.ProgressList(ctx, "parent1"); len(list) != 0 {
		t.Errorf("家長的進度不該被寫到: %+v", list)
	}

	// 刪掉孩子:進度與上課紀錄一起刪
	if err := st.DeleteChild(ctx, "parent1", a.ID); err != nil {
		t.Fatal(err)
	}
	if logs, _ := st.ChildLessons(ctx, a.ID); len(logs) != 0 {
		t.Errorf("刪掉後還有紀錄: %+v", logs)
	}
	if _, err := st.ChildProgressOf(ctx, a.ID, "kids:kids/0.1.json"); !errors.Is(err, ErrNotFound) {
		t.Errorf("刪掉後還有進度: %v", err)
	}
}
