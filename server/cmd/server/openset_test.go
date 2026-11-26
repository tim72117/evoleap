package main

import (
	"context"
	"errors"
	"testing"
	"time"
)

// 已開放的課的查詢有快取;查詢失敗用上一次的結果,沒有成功過才回錯誤
func TestCachedOpenLessons(t *testing.T) {
	calls := 0
	fail := false
	c := cachedOpenLessons(func(context.Context) (map[string]bool, error) {
		calls++
		if fail {
			return nil, errors.New("db down")
		}
		return map[string]bool{"kids/0.1": true}, nil
	}, 30*time.Millisecond)
	ctx := context.Background()
	if _, err := c(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := c(ctx); err != nil || calls != 1 {
		t.Errorf("快取內不查資料庫: calls=%d err=%v", calls, err)
	}
	time.Sleep(40 * time.Millisecond)
	fail = true
	got, err := c(ctx)
	if err != nil || !got["kids/0.1"] || calls != 2 {
		t.Errorf("過期後查詢失敗要用上一次的結果: %v %v calls=%d", got, err, calls)
	}
	fresh := cachedOpenLessons(func(context.Context) (map[string]bool, error) { return nil, errors.New("down") }, time.Minute)
	if _, err := fresh(ctx); err == nil {
		t.Error("沒有成功過又查不到,要回錯誤")
	}
	if cachedOpenLessons(nil, time.Minute) != nil {
		t.Error("沒接資料庫要回 nil")
	}
}

// 空的結果也算有快取;失敗後有舊結果可用時,隔一陣子才再查,不會每個請求都打資料庫
func TestCachedOpenLessonsEmptyAndRetryDelay(t *testing.T) {
	calls := 0
	fail := false
	c := cachedOpenLessons(func(context.Context) (map[string]bool, error) {
		calls++
		if fail {
			return nil, errors.New("db down")
		}
		return nil, nil // 沒有任何開放的課
	}, 20*time.Millisecond)
	ctx := context.Background()
	if got, err := c(ctx); err != nil || got == nil {
		t.Fatalf("空結果要回非 nil 的 map: %v %v", got, err)
	}
	c(ctx)
	if calls != 1 {
		t.Errorf("空結果也要快取: calls=%d", calls)
	}
	time.Sleep(30 * time.Millisecond)
	fail = true
	for i := 0; i < 5; i++ {
		if _, err := c(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if calls != 2 {
		t.Errorf("失敗後不該每個請求都再查: calls=%d", calls)
	}
}
