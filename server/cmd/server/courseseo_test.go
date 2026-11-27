package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/evoleap/internal/store/storetest"
)

const testManifest = `{"site":"evoleap","origin":"https://evoleap.io","courseList":{"name":"全部課程","path":"/courses"},"pages":[
{"path":"/courses/software","course":"software","coursePath":"/courses/software","kind":"overview"},
{"path":"/courses/web","course":"web","coursePath":"/courses/web","kind":"overview","listLessons":true},
{"path":"/courses/gone","course":"gone","coursePath":"/courses/gone","kind":"overview"},
{"path":"/en/courses/web","course":"web","coursePath":"/en/courses/web","kind":"overview","lang":"en","listLessons":true},
{"path":"/en/courses/gone","course":"gone","coursePath":"/en/courses/gone","kind":"overview","lang":"en"},
{"path":"/topics/ai-apps","kind":"topic","topic":"ai-apps","items":[{"course":"ai-agent","path":"/topics/ai-apps"},{"course":"gone","path":"/courses/gone"},{"course":"advanced","path":"/courses/advanced"}],"courseLd":{"course":"ai-agent"}},
{"path":"/topics/gone","kind":"topic","topic":"gone","items":[]},
{"path":"/courses","kind":"list","title":"清單標題","description":"清單描述","items":[{"course":"software","path":"/courses/software"}]},
{"path":"/courses/advanced/topic-1","course":"advanced","coursePath":"/courses/advanced","kind":"chapter","chapter":{"unit":"1","label":"主題 1"}},
{"path":"/courses/advanced/topic-9","course":"advanced","coursePath":"/courses/advanced","kind":"chapter","chapter":{"unit":"9","label":"主題 9"}}],"lessons":[
{"course":"software","coursePath":"/courses/software","style":"staged","ogType":"article"},
{"course":"web","coursePath":"/courses/web","style":"topic"},
{"course":"gone","coursePath":"/courses/gone","style":"topic"}]}`

func courseDist() fstest.MapFS {
	shell := &fstest.MapFile{Data: []byte(`<head><title>%SEO_TITLE%</title><meta name="description" content="%SEO_DESCRIPTION%" data-seo><!--seo:robots--><link rel="canonical" href="https://evoleap.io/c/%SEO_SLUG%" data-seo>
    <link rel="alternate" hreflang="en" href="https://evoleap.io/en/x" data-seo><!--seo:jsonld--></head>`)}
	dist := fstest.MapFS{
		"index.html":    {Data: []byte(`<title>home</title>`)},
		"404.html":      {Data: []byte(`<title>not found</title>`)},
		coursePagesFile: {Data: []byte(testManifest)},
	}
	for _, p := range []string{"courses/software", "courses/web", "courses/gone", "en/courses/web", "en/courses/gone", "topics/ai-apps", "topics/gone", "courses", "courses/advanced/topic-1", "courses/advanced/topic-9"} {
		dist[p+"/index.html"] = shell
	}
	for _, c := range []string{"software", "web", "gone"} {
		dist[lessonShellDir+"/"+c+".html"] = shell
	}
	return dist
}

func fixtureLoader(t *testing.T) courseLoader {
	t.Helper()
	st, err := storetest.Open(filepath.Join(t.TempDir(), "seo.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st.CourseMapWithEnglish
}

func TestCoursePagesFromDatabase(t *testing.T) {
	dist := courseDist()
	h := newStaticHandlerWithCourses(dist, openAccess, newCourseSEO(dist, fixtureLoader(t)))

	body := func(path string) string {
		t.Helper()
		rec := get(h, http.MethodGet, path, nil)
		if rec.Code != 200 {
			t.Fatalf("%s: %d %s", path, rec.Code, rec.Body)
		}
		b := rec.Body.String()
		if strings.Contains(b, "%SEO_") || strings.Contains(b, "<!--seo:") {
			t.Errorf("%s: 空位沒填完: %s", path, b)
		}
		return b
	}
	has := func(b string, want ...string) {
		t.Helper()
		for _, w := range want {
			if !strings.Contains(b, w) {
				t.Errorf("缺少 %q: %s", w, b)
			}
		}
	}

	overview := body("/courses/software")
	has(overview, `"@type":"Course"`, `"@type":"BreadcrumbList"`, `rel="alternate"`)
	if strings.Contains(overview, "noindex") || strings.Contains(overview, `"@type":"ItemList"`) {
		t.Errorf("分階段的總覽頁收錄、不列課: %s", overview)
	}
	// 序章:標題是「課名｜課程名稱」,太短的一句話接上課程名稱與課名
	has(body("/courses/software/intro"), "｜測試課一 · evoleap</title>", "測試課一：", `href="https://evoleap.io/c/intro"`)
	// 先不公開的單元:noindex(標頭也要)、沒有 hreflang
	rec := get(h, http.MethodGet, "/courses/software/1-0", nil)
	if rec.Code != 200 || rec.Header().Get("X-Robots-Tag") != "noindex, nofollow" || !strings.Contains(rec.Body.String(), noindexMarker) || strings.Contains(rec.Body.String(), `rel="alternate"`) {
		t.Errorf("hidden 單元要 noindex: %d %v %s", rec.Code, rec.Header(), rec.Body)
	}
	// 清單只有開放而且有腳本的課附網址;草稿(web 1.3)不附
	list := body("/courses/web")
	has(list, `"@type":"ItemList"`, `"url":"https://evoleap.io/courses/web/0-1"`, `"name":"1.3 `)
	if strings.Contains(list, `"url":"https://evoleap.io/courses/web/1-3"`) || strings.Contains(list, ".json") {
		t.Errorf("草稿的課不附網址,也不露出腳本: %s", list)
	}
	has(body("/courses/web/1-3"), "｜測試課四 · evoleap</title>", `"name":"全部課程"`)
	// 沒有英文版的 /en/...:中文頁的資料,標頭 noindex
	if rec := get(h, http.MethodGet, "/en/courses/web/1-3", nil); rec.Code != 200 || rec.Header().Get("X-Robots-Tag") == "" || strings.Contains(rec.Body.String(), "%SEO_") {
		t.Errorf("/en 的單課頁: %d %v", rec.Code, rec.Header())
	}
	// 資料庫沒有這一課、這門課,或清單沒有的網址:404
	for _, p := range []string{"/courses/software/999", "/courses/gone", "/courses/gone/1", "/courses/nope", "/courses/nope/1", "/courses/software/0-intro", "/courses/web/0-1/x", "/courses/web/999/", "/en/courses/web/999"} {
		if rec := get(h, http.MethodGet, p, nil); rec.Code != 404 || !strings.Contains(rec.Body.String(), "not found") {
			t.Errorf("%s: %d %s", p, rec.Code, rec.Body)
		}
	}
	// ETag、結尾斜線、清單不對外
	etag := get(h, http.MethodGet, "/courses/web", nil).Header().Get("ETag")
	if rec := get(h, http.MethodGet, "/courses/web", map[string]string{"If-None-Match": etag}); etag == "" || rec.Code != 304 {
		t.Errorf("ETag: %q %d", etag, rec.Code)
	}
	if rec := get(h, http.MethodGet, "/courses/web/", nil); rec.Code != 301 {
		t.Errorf("結尾斜線: %d", rec.Code)
	}
	// 單課網址:結尾斜線與 /index.html 導到標準網址;樣板檔不對外
	for from, to := range map[string]string{"/courses/web/1-3/": "/courses/web/1-3", "/courses/web/1-3/index.html": "/courses/web/1-3"} {
		if rec := get(h, http.MethodGet, from, nil); rec.Code != 301 || rec.Header().Get("Location") != to {
			t.Errorf("%s: %d %q", from, rec.Code, rec.Header().Get("Location"))
		}
	}
	if rec := get(h, http.MethodGet, "/"+lessonShellDir+"/web.html", nil); rec.Code != 404 {
		t.Errorf("樣板檔不對外提供: %d", rec.Code)
	}
	if rec := get(h, http.MethodGet, "/"+coursePagesFile, nil); rec.Code != 404 {
		t.Errorf("清單不對外提供: %d", rec.Code)
	}
}

// 沒接資料庫:課程頁 503 + Retry-After,其他頁照常
func TestCoursePagesWithoutDatabase(t *testing.T) {
	dist := courseDist()
	c := newCourseSEO(dist, nil)
	h := newStaticHandlerWithCourses(dist, openAccess, c)
	rec := get(h, http.MethodGet, "/courses/web", nil)
	if rec.Code != 503 || rec.Header().Get("Retry-After") == "" || strings.Contains(rec.Body.String(), "%SEO_") {
		t.Errorf("%d %v %s", rec.Code, rec.Header(), rec.Body)
	}
	if rec := get(h, http.MethodGet, "/", nil); rec.Code != 200 {
		t.Errorf("首頁: %d", rec.Code)
	}
	if rec := get(c.apiHandler(), http.MethodGet, "/api/seo/page?path=/courses/web", nil); rec.Code != 503 || rec.Header().Get("Retry-After") == "" {
		t.Errorf("api: %d", rec.Code)
	}
}

// 快取:期限內不查資料庫;過期後讀不到回 503,不拿舊資料頂替;恢復後回 200 並用新資料
func TestCoursePagesCacheExpiry(t *testing.T) {
	dist := courseDist()
	calls := 0
	title := "舊名稱"
	var fail error
	c := newCourseSEO(dist, func(context.Context, string) (store.CourseMap, *store.CourseMap, error) {
		calls++
		return store.CourseMap{ID: "web", Title: title}, nil, fail
	})
	now := time.Now()
	c.now = func() time.Time { return now }
	h := newStaticHandlerWithCourses(dist, openAccess, c)
	want := func(status, n int, text string) {
		t.Helper()
		rec := get(h, http.MethodGet, "/courses/web", nil)
		if rec.Code != status || calls != n || !strings.Contains(rec.Body.String(), text) {
			t.Errorf("status=%d calls=%d body=%s", rec.Code, calls, rec.Body)
		}
	}
	want(200, 1, "舊名稱")
	title = "新名稱"
	now = now.Add(courseSEOTTL - time.Second)
	want(200, 1, "舊名稱")
	now = now.Add(2 * time.Second)
	fail = errors.New("db down")
	want(503, 2, "暫時無法讀取")
	want(503, 3, "暫時無法讀取")
	fail = nil
	want(200, 4, "新名稱")
	// 課被刪掉:過期後 404
	now = now.Add(courseSEOTTL)
	fail = store.ErrCourseNotFound
	want(404, 5, "not found")
}

// 瀏覽器端換頁讀的端點和 server HTML 是同一份資料
func TestSEOPageAPI(t *testing.T) {
	c := newCourseSEO(courseDist(), fixtureLoader(t))
	api := c.apiHandler()
	rec := get(api, http.MethodGet, "/api/seo/page?path=/courses/software/1-0", nil)
	var m pageMeta
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil || rec.Code != 200 {
		t.Fatalf("%d %v %s", rec.Code, err, rec.Body)
	}
	if m.Path != "/courses/software/1-0" || !m.Noindex || m.Title == "" || m.Description == "" || m.OgType != "article" || len(m.JSONLD) != 1 {
		t.Errorf("%+v", m)
	}
	for _, p := range []string{"/courses/software/999", "/courses/gone", "/", ""} {
		if rec := get(api, http.MethodGet, "/api/seo/page?path="+p, nil); rec.Code != 404 {
			t.Errorf("%q: %d", p, rec.Code)
		}
	}
	var none *courseSEO
	if rec := get(none.apiHandler(), http.MethodGet, "/api/seo/page?path=/courses/web", nil); rec.Code != 503 {
		t.Errorf("沒有清單: %d", rec.Code)
	}
}

// sitemap 用的清單:先不公開單元的課、還沒有腳本的課,就算開放了也不收錄
func TestOpenLessonKeysSkipsHiddenUnits(t *testing.T) {
	st, err := storetest.Open(filepath.Join(t.TempDir(), "open.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.ReplaceUnitsJSON("web", `[{"id":"a","title":"a","lessons":[{"id":"1","title":"x","status":"open","script":"web/x.json"},{"id":"3","title":"z","status":"open"}]},{"id":"b","title":"b","hidden":true,"lessons":[{"id":"2","title":"y","status":"open","script":"web/y.json"}]}]`); err != nil {
		t.Fatal(err)
	}
	keys, err := st.OpenLessonKeys(context.Background())
	if err != nil || !keys["web/1"] || keys["web/2"] || keys["web/3"] {
		t.Errorf("%v %v", keys, err)
	}
}

// 英文課程總覽:請求時讀資料庫的譯文;沒有英文版回中文頁並 noindex、中文頁沒有 hreflang;讀不到 503,沒有舊資料或程式內備援
func TestEnglishCoursePages(t *testing.T) {
	st, err := storetest.Open(filepath.Join(t.TempDir(), "en.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	dist := courseDist()
	var fail error
	c := newCourseSEO(dist, func(ctx context.Context, id string) (store.CourseMap, *store.CourseMap, error) {
		if fail != nil {
			return store.CourseMap{}, nil, fail
		}
		return st.CourseMapWithEnglish(ctx, id)
	})
	now := time.Now()
	c.now = func() time.Time { return now }
	h := newStaticHandlerWithCourses(dist, openAccess, c)
	api := c.apiHandler()
	meta := func(p string) (m pageMeta) {
		t.Helper()
		rec := get(api, http.MethodGet, "/api/seo/page?path="+p, nil)
		if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil || rec.Code != 200 {
			t.Fatalf("%s: %d %v %s", p, rec.Code, err, rec.Body)
		}
		return m
	}

	rec := get(h, http.MethodGet, "/en/courses/web", nil)
	body := rec.Body.String()
	for _, w := range []string{"<title>Test Course Four: test search title · evoleap</title>", "Test description: web.", `"inLanguage":"en"`, `"All Courses"`, "Test web lesson", `rel="alternate"`} {
		if !strings.Contains(body, w) {
			t.Errorf("缺少 %q: %s", w, body)
		}
	}
	if rec.Code != 200 || rec.Header().Get("X-Robots-Tag") != "" {
		t.Errorf("%d %v", rec.Code, rec.Header())
	}
	if m := meta("/en/courses/web"); m.Lang != "en" || m.Noindex || m.NoEnglish || m.Title != "Test Course Four: test search title · evoleap" {
		t.Errorf("%+v", m)
	}
	if rec := get(h, http.MethodGet, "/en/courses/gone", nil); rec.Code != 404 {
		t.Errorf("沒有這門課: %d", rec.Code)
	}

	// 課名的譯文退回草稿:沒有英文版
	if _, err := st.SetI18n(context.Background(), "a@x", store.I18nSet{Kind: store.I18nCourse, Ref: "web", Path: "title", Lang: store.LangEN, Value: "x", Status: store.I18nDraft}); err != nil {
		t.Fatal(err)
	}
	now = now.Add(courseSEOTTL)
	rec = get(h, http.MethodGet, "/en/courses/web", nil)
	body = rec.Body.String()
	if rec.Code != 200 || rec.Header().Get("X-Robots-Tag") != "noindex, nofollow" || strings.Contains(body, `rel="alternate"`) || strings.Contains(body, "Test Course Four") {
		t.Errorf("沒有英文版: %d %v %s", rec.Code, rec.Header(), body)
	}
	if zh := get(h, http.MethodGet, "/courses/web", nil); zh.Code != 200 || zh.Header().Get("X-Robots-Tag") != "" || strings.Contains(zh.Body.String(), `rel="alternate"`) {
		t.Errorf("中文頁收錄但沒有 hreflang: %d %s", zh.Code, zh.Body)
	}
	if m := meta("/en/courses/web"); m.Path != "/courses/web" || !m.Noindex || !m.NoEnglish || m.Lang != "" {
		t.Errorf("%+v", m)
	}

	fail = errors.New("db down")
	now = now.Add(courseSEOTTL)
	if rec := get(h, http.MethodGet, "/en/courses/web", nil); rec.Code != 503 || rec.Header().Get("Retry-After") == "" {
		t.Errorf("讀不到: %d", rec.Code)
	}
	if rec := get(api, http.MethodGet, "/api/seo/page?path=/en/courses/web", nil); rec.Code != 503 {
		t.Errorf("api 讀不到: %d", rec.Code)
	}
}

// 主題頁、全部課程、規劃中章節:名稱讀資料庫;讀不到 503、資料庫沒有 404,過期後不拿舊資料頂替
func TestTopicAndChapterPages(t *testing.T) {
	st, err := storetest.Open(filepath.Join(t.TempDir(), "topic.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	dist := courseDist()
	c := newCourseSEO(dist, st.CourseMapWithEnglish)
	var fail error
	c.loadTopic = func(ctx context.Context, id string) (store.Topic, error) {
		if fail != nil {
			return store.Topic{}, fail
		}
		return st.TopicOf(ctx, id)
	}
	now := time.Now()
	c.now = func() time.Time { return now }
	h := newStaticHandlerWithCourses(dist, openAccess, c)
	has := func(path string, want ...string) {
		t.Helper()
		rec := get(h, http.MethodGet, path, nil)
		b := rec.Body.String()
		if rec.Code != 200 || rec.Header().Get("X-Robots-Tag") != "" || strings.Contains(b, "%SEO_") || !strings.Contains(b, `rel="alternate"`) {
			t.Fatalf("%s: %d %s", path, rec.Code, b)
		}
		for _, w := range want {
			if !strings.Contains(b, w) {
				t.Errorf("%s 缺少 %q: %s", path, w, b)
			}
		}
	}
	topic, err := st.TopicOf(context.Background(), "ai-apps")
	if err != nil {
		t.Fatal(err)
	}
	// 資料庫沒有的課(gone)不列
	has("/topics/ai-apps", "<title>"+topic.SEOTitle+" · evoleap</title>", `"@type":"ItemList"`, `"name":"測試課二"`, `"url":"https://evoleap.io/courses/advanced"`, `"@type":"Course"`, `"description":"測試課二的簡介。"`)
	has("/courses", "<title>清單標題 · evoleap</title>", `content="清單描述"`, `"name":"測試課一"`)
	advanced, _, err := st.CourseMapWithEnglish(context.Background(), "advanced")
	if err != nil {
		t.Fatal(err)
	}
	rec := get(h, http.MethodGet, "/courses/advanced/topic-1", nil)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), "<title>主題 1 "+advanced.Units[0].Title+" · evoleap</title>") {
		t.Errorf("章節頁: %d %s", rec.Code, rec.Body)
	}
	for _, p := range []string{"/topics/gone", "/courses/advanced/topic-9"} {
		if rec := get(h, http.MethodGet, p, nil); rec.Code != 404 {
			t.Errorf("%s: %d", p, rec.Code)
		}
	}
	fail = errors.New("db down")
	now = now.Add(courseSEOTTL)
	if rec := get(h, http.MethodGet, "/topics/ai-apps", nil); rec.Code != 503 || rec.Header().Get("Retry-After") == "" {
		t.Errorf("讀不到: %d", rec.Code)
	}
}
