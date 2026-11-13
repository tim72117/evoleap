package store

import (
	"context"
	"errors"
	"testing"
	"time"
)

func newUser(t *testing.T, st *Store, email, name string) User {
	t.Helper()
	u, err := st.CreatePasswordUser(context.Background(), email, name, "hash")
	if err != nil {
		t.Fatal(err)
	}
	return u
}

// 配對:孩子產生配對碼 → 家長輸入 → 孩子的帳號記在孩子底下,帳號原本的兒童課進度併進來;碼只能用一次
func TestPairChild(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	parent := newUser(t, st, "mom@example.com", "媽媽")
	kid := newUser(t, st, "kid@example.com", "小明")

	// 孩子帳號原本在兒童課看過的進度(0.1 看完、0.2 看到一半),其他課的進度不併
	for _, p := range []Progress{
		{Lesson: "kids:kids/0.1.json", PositionMs: 59000, DurationMs: 60000},
		{Lesson: "kids:kids/0.2.json", PositionMs: 20000, DurationMs: 60000},
		{Lesson: "tools:l0/0.0-tools.json", PositionMs: 10000, DurationMs: 60000},
	} {
		if err := st.SaveProgress(ctx, kid.ID, p); err != nil {
			t.Fatal(err)
		}
	}

	code, exp, err := st.CreatePairCode(ctx, kid.ID)
	if err != nil || len(code) != 6 || time.Until(exp) < 9*time.Minute || time.Until(exp) > PairCodeTTL {
		t.Fatalf("產生配對碼: %q %v %v", code, exp, err)
	}
	// 重新產生:舊的碼作廢
	code2, _, err := st.CreatePairCode(ctx, kid.ID)
	if err != nil || (code2 == code) {
		t.Fatalf("重新產生: %q %v", code2, err)
	}
	if _, err := st.PairChild(ctx, parent.ID, code, ""); !errors.Is(err, ErrPairCode) {
		t.Errorf("舊的碼: %v", err)
	}
	if _, err := st.PairChild(ctx, parent.ID, "000000", ""); !errors.Is(err, ErrPairCode) {
		t.Errorf("不存在的碼: %v", err)
	}
	// 不能配對自己的帳號
	if _, err := st.PairChild(ctx, kid.ID, code2, ""); !errors.Is(err, ErrInvalidPair) {
		t.Errorf("自己配對自己: %v", err)
	}

	child, err := st.PairChild(ctx, parent.ID, code2, "")
	if err != nil || !child.Paired || child.Name != "小明" || child.AccountUserID != kid.ID || child.AccountLabel != "小明" {
		t.Fatalf("配對(新增孩子): %+v %v", child, err)
	}
	// 進度併進來:只有兒童課;看完的課有一筆上課紀錄
	list, err := st.ChildProgressList(ctx, child.ID)
	if err != nil || len(list) != 2 {
		t.Fatalf("併進來的進度: %+v %v", list, err)
	}
	lessons, _ := st.ChildLessons(ctx, child.ID)
	if len(lessons) != 1 || lessons[0].Lesson != "kids:kids/0.1.json" {
		t.Errorf("上課紀錄: %+v", lessons)
	}
	// 碼只能用一次;孩子本人查得到自己的檔案;家長的清單有配對標示
	if _, err := st.PairChild(ctx, parent.ID, code2, ""); !errors.Is(err, ErrPairCode) {
		t.Errorf("碼用過了: %v", err)
	}
	if got, err := st.ChildByAccount(ctx, kid.ID); err != nil || got.ID != child.ID {
		t.Errorf("ChildByAccount: %+v %v", got, err)
	}
	if _, err := st.ChildByAccount(ctx, parent.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("家長不是孩子帳號: %v", err)
	}
	kids, _ := st.Children(ctx, parent.ID)
	if len(kids) != 1 || !kids[0].Paired || kids[0].AccountLabel != "小明" {
		t.Errorf("家長的清單: %+v", kids)
	}
	// 已經配對的帳號不能再產生碼、也不能配給別的家長
	if _, _, err := st.CreatePairCode(ctx, kid.ID); !errors.Is(err, ErrInvalidPair) {
		t.Errorf("已配對的帳號產生碼: %v", err)
	}
	// 解除配對:孩子檔案與進度留著,帳號回到一般帳號
	if err := st.UnpairChild(ctx, parent.ID, child.ID); err != nil {
		t.Fatal(err)
	}
	if err := st.UnpairChild(ctx, parent.ID, child.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("沒配對時解除: %v", err)
	}
	if _, err := st.ChildByAccount(ctx, kid.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("解除之後: %v", err)
	}
	if list, _ := st.ChildProgressList(ctx, child.ID); len(list) != 2 {
		t.Errorf("解除之後進度還在: %+v", list)
	}
}

// 接到既有的孩子:原本的時段與進度留著,帳號進度取看得比較遠的;帳號沒有名稱時用遮住一部分的 Email
func TestPairExistingChild(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	parent := newUser(t, st, "mom@example.com", "")
	kid := newUser(t, st, "kiddo@example.com", "")
	existing, _ := st.CreateChild(ctx, parent.ID, "花花")
	slots := []Slot{{Day: 1, Time: "16:00"}}
	if _, err := st.UpdateChild(ctx, parent.ID, existing.ID, ChildPatch{Slots: &slots}); err != nil {
		t.Fatal(err)
	}
	// 孩子檔案這邊 0.1 看到 30 秒、帳號那邊看到 50 秒:取 50 秒;0.2 檔案這邊看完了、帳號只看一半:不倒退
	st.SaveChildProgress(ctx, existing.ID, Progress{Lesson: "kids:kids/0.1.json", PositionMs: 30000, DurationMs: 60000})
	st.SaveChildProgress(ctx, existing.ID, Progress{Lesson: "kids:kids/0.2.json", PositionMs: 59000, DurationMs: 60000})
	st.SaveProgress(ctx, kid.ID, Progress{Lesson: "kids:kids/0.1.json", PositionMs: 50000, DurationMs: 60000})
	st.SaveProgress(ctx, kid.ID, Progress{Lesson: "kids:kids/0.2.json", PositionMs: 10000, DurationMs: 60000})

	code, _, _ := st.CreatePairCode(ctx, kid.ID)
	// 別人的孩子、不存在的孩子都接不上
	other := newUser(t, st, "dad@example.com", "")
	if _, err := st.PairChild(ctx, other.ID, code, existing.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("接到別人的孩子: %v", err)
	}
	child, err := st.PairChild(ctx, parent.ID, code, existing.ID)
	if err != nil || child.ID != existing.ID || child.Name != "花花" || len(child.Slots) != 1 || child.AccountLabel != "k***@example.com" {
		t.Fatalf("接到既有的孩子: %+v %v", child, err)
	}
	p1, _ := st.ChildProgressOf(ctx, existing.ID, "kids:kids/0.1.json")
	p2, _ := st.ChildProgressOf(ctx, existing.ID, "kids:kids/0.2.json")
	if p1.PositionMs != 50000 || p2.PositionMs != 59000 {
		t.Errorf("進度: 0.1=%d 0.2=%d", p1.PositionMs, p2.PositionMs)
	}
	// 這個孩子已經配對了帳號:不能再接另一個
	kid2 := newUser(t, st, "kid2@example.com", "")
	code2, _, _ := st.CreatePairCode(ctx, kid2.ID)
	if _, err := st.PairChild(ctx, parent.ID, code2, existing.ID); !errors.Is(err, ErrInvalidPair) {
		t.Errorf("孩子已經有帳號: %v", err)
	}
}

// 有自己孩子的帳號(家長)不能當成孩子的帳號;家長的孩子滿了不能再新增配對;過期的碼不能用
func TestPairLimits(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	parent := newUser(t, st, "mom@example.com", "媽媽")
	other := newUser(t, st, "other@example.com", "")
	st.CreateChild(ctx, other.ID, "有孩子的人")
	if _, _, err := st.CreatePairCode(ctx, other.ID); !errors.Is(err, ErrInvalidPair) {
		t.Errorf("有孩子的帳號產生碼: %v", err)
	}
	for i := 0; i < MaxChildren; i++ {
		if _, err := st.CreateChild(ctx, parent.ID, "孩子"); err != nil {
			t.Fatal(err)
		}
	}
	kid := newUser(t, st, "kid@example.com", "")
	code, _, _ := st.CreatePairCode(ctx, kid.ID)
	if _, err := st.PairChild(ctx, parent.ID, code, ""); !errors.Is(err, ErrInvalidChild) {
		t.Errorf("孩子滿了: %v", err)
	}
	// 過期
	st.db.Model(&pairCodeRow{}).Where("code = ?", code).Update("expires_at", time.Now().Add(-time.Minute))
	if _, err := st.PairChild(ctx, parent.ID, code, ""); !errors.Is(err, ErrPairCode) {
		t.Errorf("過期的碼: %v", err)
	}
}
