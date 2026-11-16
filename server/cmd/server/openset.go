package main

import (
	"context"
	"reflect"
	"sync"
	"time"
)

// 查詢失敗後,在有舊結果可用時,隔多久再試(避免資料庫故障時每個請求都去打它)
const openRetryDelay = 10 * time.Second

// cachedOpenLessons 把「已開放的課」的資料庫查詢包一層程序內快取(sitemap 與頁面裡的課程連結共用):
// 公開端點被連續請求時不會每次都查資料庫。查詢時不握著鎖(不然資料庫慢時全部排隊);
// 查詢失敗就用上一次成功的結果(並延後 openRetryDelay 再試),還沒有成功過才回傳錯誤。
// 在有快取期間回傳的是同一個 map(呼叫端用它的身分判斷結果有沒有變,見 mapID)。open 為 nil(沒接資料庫)時回傳 nil。
func cachedOpenLessons(open openLessons, ttl time.Duration) openLessons {
	if open == nil {
		return nil
	}
	var mu sync.Mutex
	var cached map[string]bool
	var ok bool // 有沒有成功過(空的 map 也算)
	var cachedAt time.Time
	return func(ctx context.Context) (map[string]bool, error) {
		mu.Lock()
		got, has, at := cached, ok, cachedAt
		mu.Unlock()
		if has && time.Since(at) < ttl {
			return got, nil
		}
		fresh, err := open(ctx)
		if err != nil {
			if has {
				mu.Lock()
				cachedAt = time.Now().Add(openRetryDelay - ttl) // 過 openRetryDelay 才再試
				mu.Unlock()
				return got, nil
			}
			return nil, err
		}
		if fresh == nil {
			fresh = map[string]bool{}
		}
		mu.Lock()
		cached, ok, cachedAt = fresh, true, time.Now()
		mu.Unlock()
		return fresh, nil
	}
}

// mapID 是 map 的身分(同一個 map 就是同一個結果;nil 為 0):cachedOpenLessons 在快取期間回傳同一個 map,
// 依它的身分就能知道已開放的課有沒有變,不必每個請求都重組頁面與 sitemap。
func mapID(m map[string]bool) uintptr {
	if m == nil {
		return 0
	}
	return reflect.ValueOf(m).Pointer()
}
