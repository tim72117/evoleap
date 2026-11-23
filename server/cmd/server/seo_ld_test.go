package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"
)

const topicHTML = `<title>t</title><script type="application/ld+json" data-seo>{"@type":"ItemList","itemListElement":[` +
	`{"@type":"ListItem","position":1,"name":"0.1 a","evoleapLesson":{"course":"kids","id":"0.1","url":"https://evoleap.io/courses/kids/0-1"}},` +
	`{"@type":"ListItem","position":2,"name":"3.1 b","evoleapLesson":{"course":"kids","id":"3.1","url":"https://evoleap.io/courses/kids/3-1"}},` +
	`{"@type":"ListItem","position":3,"name":"9.9 沒有課程頁"}]}</script><script type="application/ld+json" data-seo>{"@type":"BreadcrumbList"}</script>`

// 頁面結構化資料的課程連結依資料庫:開放的課附 url,沒開放的不附,evoleapLesson 一律不出現在回應裡
func TestLessonLinksFollowOpenSet(t *testing.T) {
	dist := fstest.MapFS{"index.html": {Data: []byte(topicHTML)}, "courses/kids/index.html": {Data: []byte(topicHTML)}}
	get := func(open openLessons) string {
		rec := httptest.NewRecorder()
		newStaticHandlerWithOpen(dist, openAccess, open).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/courses/kids", nil))
		if rec.Code != 200 {
			t.Fatalf("%d", rec.Code)
		}
		return rec.Body.String()
	}
	body := get(func(context.Context) (map[string]bool, error) { return map[string]bool{"kids/0.1": true}, nil })
	if !strings.Contains(body, `"url":"https://evoleap.io/courses/kids/0-1"`) {
		t.Errorf("開放的課要附網址: %s", body)
	}
	if strings.Contains(body, "courses/kids/3-1") || strings.Contains(body, lessonLinkKey) {
		t.Errorf("沒開放的課不附網址,也不留標記: %s", body)
	}
	if !strings.Contains(body, `"@type":"BreadcrumbList"`) || !strings.Contains(body, "沒有課程頁") {
		t.Errorf("其他結構化資料不受影響: %s", body)
	}
	// 沒接資料庫(nil)或查不到:所有課都不附網址
	for name, open := range map[string]openLessons{
		"nil": nil,
		"查不到": func(context.Context) (map[string]bool, error) { return nil, errors.New("db down") },
	} {
		if b := get(open); strings.Contains(b, "courses/kids/0-1") || strings.Contains(b, lessonLinkKey) {
			t.Errorf("%s: %s", name, b)
		}
	}
}

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

// 標記格式不對(不是物件)也一律拿掉,不出現在回應裡
func TestPatchRemovesMalformedMarker(t *testing.T) {
	body := []byte(`<script type="application/ld+json" data-seo>{"itemListElement":[{"name":"a","evoleapLesson":"kids/0.1"},{"name":"b","evoleapLesson":[1,2]}]}</script>`)
	out := string(patchLessonLinks(body, map[string]bool{"kids/0.1": true}))
	if strings.Contains(out, lessonLinkKey) || strings.Contains(out, `"url"`) {
		t.Errorf("格式不對的標記要拿掉、不附 url: %s", out)
	}
}

// 已開放的課沒變(同一個 map)就沿用處理好的頁面;變了才重做
func TestDynamicPageReusedWhileOpenSetUnchanged(t *testing.T) {
	pg := newPage([]byte(topicHTML), false)
	set := map[string]bool{"kids/0.1": true}
	open := func(context.Context) (map[string]bool, error) { return set, nil }
	r := httptest.NewRequest(http.MethodGet, "/courses/kids", nil)
	a := dynamicPage(r, pg, open)
	if b := dynamicPage(r, pg, open); a != b {
		t.Error("開放的課沒變,應該沿用上一次處理好的頁面")
	}
	set = map[string]bool{"kids/0.1": true, "kids/3.1": true}
	c := dynamicPage(r, pg, open)
	if c == a || !strings.Contains(string(c.body), "courses/kids/3-1") {
		t.Errorf("開放的課變了要重做: %s", c.body)
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
