package main

// 課程相關頁面(課程總覽、單課、規劃中章節)的 <title>、description、noindex 與結構化資料:請求時讀資料庫組出來,
// 組法只寫在這裡(瀏覽器端換頁讀 GET /api/seo/page 拿同一份)。前端 build(web/src/seo/coursePages.ts、build.ts)
// 只輸出網址清單與單課網址樣式(dist/course-pages.json)和留好空位的 HTML,不含任何課程內容,也沒有備援。
// 單課頁 /courses/<課程>/<課號> 不逐課產生:一門課一份 HTML(dist/lesson-shells/),哪些課存在看資料庫,新增課不用重新 build。
//   - 資料庫讀不到(或沒接資料庫):503 + Retry-After
//   - 資料庫沒有這門課或這一課:404
// 英文版只有課程總覽(/en/courses/<課程>):課名有已發布的英文譯文才有;沒有的回中文頁並 noindex(static.go),中文頁也不放 hreflang。
// 沒翻的個別欄位保留中文(和 ?lang=en 的 API、瀏覽器畫面一致)。譯文只從資料庫讀,讀不到同樣回 503。
// 只用公開的課程地圖(草稿當成規劃中),和 GET /api/courses/{id}/map 給訪客的內容相同。
// 每門課的課程地圖在程序內記 courseSEOTTL;過期後讀不到就回 503,不拿舊資料頂替。

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf16"

	"github.com/tim72117/evoleap/internal/store"
)

const (
	// coursePagesFile 是前端 build 輸出的課程頁清單(只給 server 讀,不對外提供)
	coursePagesFile = "course-pages.json"
	courseSEOTTL    = time.Minute
	// courseLoadTimeout:資料庫卡住時不讓頁面一直等,當作讀不到
	courseLoadTimeout = 5 * time.Second
	retryAfterSeconds = "30"
)

// 頁面 HTML 裡的空位,和 web/src/seo/build.ts 一致
const (
	titleSlot       = "%SEO_TITLE%"
	descriptionSlot = "%SEO_DESCRIPTION%"
	robotsSlot      = "<!--seo:robots-->"
	jsonLDSlot      = "<!--seo:jsonld-->"
	slugSlot        = "%SEO_SLUG%" // 單課頁 canonical、og:url 的網址最後一段
)

// lessonShellDir 是單課頁 HTML 在 dist 裡的資料夾(只給 server 用,不直接對外提供)
const lessonShellDir = "lesson-shells"

// 不收錄的頁面沒有 hreflang(和 web/src/seo/pages.ts 的 headTags 一致)
var alternateLink = regexp.MustCompile(`\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*" data-seo>`)

var (
	errNoSuchPage  = errors.New("no such course page")
	errNoEnglish   = errors.New("course page has no english version")
	errUnavailable = errors.New("course database unavailable")
)

type courseManifest struct {
	Site       string `json:"site"`
	Origin     string `json:"origin"`
	CourseList struct {
		Name string `json:"name"`
		Path string `json:"path"`
	} `json:"courseList"`
	Pages []courseEntry `json:"pages"`
	// Lessons:一門課一筆單課網址樣式 <coursePath>/<課號>
	Lessons []courseEntry `json:"lessons"`
}

type courseEntry struct {
	Path       string `json:"path"`
	Course     string `json:"course"`
	CoursePath string `json:"coursePath"`
	// Kind:overview、chapter(規劃中章節,內容是前端的,資料庫沒有對應的課);單課頁由樣式組出,是 lesson
	Kind string `json:"kind"`
	// Slug:單課網址的最後一段(請求時填入)
	Slug        string `json:"-"`
	Style       string `json:"style"`
	ListLessons bool   `json:"listLessons"`
	Chapter     *struct {
		Name    string `json:"name"`
		Summary string `json:"summary"`
	} `json:"chapter"`
	// Lang:英文版課程總覽(/en/courses/<課程>)是 "en",其餘空的
	Lang string `json:"lang"`
	// Noindex:整門課先不公開(前端的設定);先不公開的單元依資料庫
	Noindex bool   `json:"noindex"`
	OgType  string `json:"ogType"`
}

// pageMeta 和前端的 PageMeta(web/src/seo/pages.ts)同一個形狀
type pageMeta struct {
	Path        string `json:"path"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Noindex     bool   `json:"noindex,omitempty"`
	OgType      string `json:"ogType,omitempty"`
	JSONLD      []any  `json:"jsonLd,omitempty"`
	Lang        string `json:"lang,omitempty"`
	// NoEnglish:這門課沒有英文版,瀏覽器端不放 hreflang(和 server 的 HTML 一致)
	NoEnglish bool `json:"noEnglish,omitempty"`
}

// courseLoader 讀一門課的公開課程地圖與英文版(沒有英文版時 en 是 nil);課程不存在回 store.ErrCourseNotFound
type courseLoader func(ctx context.Context, id string) (zh store.CourseMap, en *store.CourseMap, err error)

// courseSnapshot 是某一刻讀到的課程地圖(nil 代表資料庫沒有這門課)
type courseSnapshot struct {
	// enUnavailable:譯文這次讀不到(en 是 nil,但不代表沒有英文版)
	enUnavailable bool
	m             *store.CourseMap
	en            *store.CourseMap // nil:沒有英文版
	at            time.Time
}

type renderedPage struct {
	from *courseSnapshot
	page *page
}

type courseSEO struct {
	manifest courseManifest
	entries  map[string]courseEntry
	lessons  map[string]courseEntry // 單課樣式,key 是 coursePath
	shells   map[string]*page       // 單課頁 HTML,key 是 coursePath
	load     courseLoader           // nil:沒接資料庫
	ttl      time.Duration
	now      func() time.Time

	mu       sync.Mutex
	courses  map[string]*courseSnapshot
	rendered map[string]renderedPage
}

// newCourseSEO 讀 dist 的課程頁清單;沒有清單(例如只有佔位的 embed)時回 nil。
func newCourseSEO(dist fs.FS, load courseLoader) *courseSEO {
	body, err := fs.ReadFile(dist, coursePagesFile)
	if err != nil {
		return nil
	}
	c := &courseSEO{load: load, ttl: courseSEOTTL, now: time.Now, entries: map[string]courseEntry{}, lessons: map[string]courseEntry{}, shells: map[string]*page{}, courses: map[string]*courseSnapshot{}, rendered: map[string]renderedPage{}}
	if err := json.Unmarshal(body, &c.manifest); err != nil {
		panic(coursePagesFile + ": " + err.Error())
	}
	for _, e := range c.manifest.Pages {
		c.entries[e.Path] = e
	}
	for _, t := range c.manifest.Lessons {
		shell, err := fs.ReadFile(dist, lessonShellDir+"/"+t.Course+".html")
		if err != nil {
			panic(coursePagesFile + ": " + err.Error())
		}
		c.lessons[t.CoursePath] = t
		c.shells[t.CoursePath] = newPage(shell, false)
	}
	return c
}

// entry 回傳這個路徑的課程頁設定:固定網址的頁,或某門課的單課網址(那一課存不存在要看資料庫)
func (c *courseSEO) entry(p string) (courseEntry, bool) {
	if c == nil {
		return courseEntry{}, false
	}
	if e, ok := c.entries[p]; ok {
		return e, true
	}
	dir, slug := path.Split(p)
	e, ok := c.lessons[strings.TrimSuffix(dir, "/")]
	if !ok || slug == "" || strings.Contains(slug, ".") {
		return courseEntry{}, false
	}
	e.Path, e.Kind, e.Slug = p, "lesson", slug
	return e, true
}

// has 回報這個路徑是不是課程相關頁面
func (c *courseSEO) has(path string) bool {
	_, ok := c.entry(path)
	return ok
}

// lessonShell 回傳單課網址用的 HTML(還沒填資料);不是單課網址時回 nil
func (c *courseSEO) lessonShell(p string) *page {
	if e, ok := c.entry(p); ok && e.Kind == "lesson" {
		return c.shells[e.CoursePath]
	}
	return nil
}

func (c *courseSEO) snapshot(ctx context.Context, id string) (*courseSnapshot, error) {
	c.mu.Lock()
	snap := c.courses[id]
	c.mu.Unlock()
	if snap != nil && c.now().Sub(snap.at) < c.ttl {
		return snap, nil
	}
	if c.load == nil {
		return nil, errUnavailable
	}
	// 查詢時不握著鎖,資料庫慢時不讓其他頁面排隊
	ctx, cancel := context.WithTimeout(ctx, courseLoadTimeout)
	defer cancel()
	m, en, err := c.load(ctx, id)
	fresh := &courseSnapshot{at: c.now()}
	switch {
	case err == nil:
		fresh.m, fresh.en = &m, en
	case errors.Is(err, store.ErrEnglishUnavailable):
		// 譯文讀不到不影響中文頁;這段快取期間不放英文版連結,英文頁回 503
		log.Printf("讀取課程 %s:%v", id, err)
		fresh.m, fresh.enUnavailable = &m, true
	case !errors.Is(err, store.ErrCourseNotFound):
		log.Printf("讀取課程 %s 失敗:%v", id, err)
		return nil, errUnavailable
	}
	c.mu.Lock()
	c.courses[id] = fresh
	c.mu.Unlock()
	return fresh, nil
}

// meta 回傳一個課程頁的 SEO 資料;英文頁但這門課沒有英文版時回 errNoEnglish
func (c *courseSEO) meta(ctx context.Context, path string) (pageMeta, *courseSnapshot, error) {
	e, ok := c.entry(path)
	if !ok {
		return pageMeta{}, nil, errNoSuchPage
	}
	snap, err := c.snapshot(ctx, e.Course)
	if err != nil {
		return pageMeta{}, nil, err
	}
	if snap.m == nil {
		return pageMeta{}, nil, errNoSuchPage
	}
	course := snap.m
	if e.Lang == "en" {
		if snap.enUnavailable {
			return pageMeta{}, nil, errUnavailable
		}
		if course = snap.en; course == nil {
			return pageMeta{}, nil, errNoEnglish
		}
	}
	m, ok := c.compose(e, course)
	if !ok {
		return pageMeta{}, nil, errNoSuchPage
	}
	m.NoEnglish = snap.en == nil
	return m, snap, nil
}

// 結構化資料(JSON-LD)
type ldCrumbs struct {
	Context string      `json:"@context"`
	Type    string      `json:"@type"`
	Items   []ldElement `json:"itemListElement"`
}

type ldList struct {
	Context string      `json:"@context"`
	Type    string      `json:"@type"`
	Name    string      `json:"name"`
	Items   []ldElement `json:"itemListElement"`
}

type ldElement struct {
	Type     string `json:"@type"`
	Position int    `json:"position"`
	Name     string `json:"name"`
	Item     string `json:"item,omitempty"`
	URL      string `json:"url,omitempty"`
}

type ldCourse struct {
	Context     string     `json:"@context"`
	Type        string     `json:"@type"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	URL         string     `json:"url"`
	InLanguage  string     `json:"inLanguage"`
	Provider    ldProvider `json:"provider"`
}

type ldProvider struct {
	Type string `json:"@type"`
	Name string `json:"name"`
	URL  string `json:"url"`
}

const schemaOrg = "https://schema.org"

type crumb struct{ name, path string }

func (c *courseSEO) breadcrumb(items ...crumb) ldCrumbs {
	return c.breadcrumbFrom("首頁", items...)
}

func (c *courseSEO) breadcrumbFrom(home string, items ...crumb) ldCrumbs {
	out := ldCrumbs{Context: schemaOrg, Type: "BreadcrumbList"}
	for i, it := range append([]crumb{{home, "/"}}, items...) {
		out.Items = append(out.Items, ldElement{Type: "ListItem", Position: i + 1, Name: it.name, Item: c.manifest.Origin + it.path})
	}
	return out
}

func (c *courseSEO) courseLD(name, description, path string) ldCourse {
	return ldCourse{Context: schemaOrg, Type: "Course", Name: name, Description: description, URL: c.manifest.Origin + path, InLanguage: "zh-Hant",
		Provider: ldProvider{Type: "Organization", Name: c.manifest.Site, URL: c.manifest.Origin + "/"}}
}

// longEnough:課程地圖上的一句話有些太短(例如序章),描述要接上課程名稱與課名。長度照前端的算法(UTF-16)
func longEnough(s string) bool { return len(utf16.Encode([]rune(s))) >= 20 }

func firstNonEmpty(xs ...string) string {
	for _, x := range xs {
		if x != "" {
			return x
		}
	}
	return ""
}

// compose 組出一頁的 SEO 資料;資料庫沒有這一課時回 false。
func (c *courseSEO) compose(e courseEntry, m *store.CourseMap) (pageMeta, bool) {
	title := func(name string) string { return name + " · " + c.manifest.Site }
	list := crumb{c.manifest.CourseList.Name, c.manifest.CourseList.Path}
	overview := crumb{m.Title, e.CoursePath}
	// 麵包屑的上一層是所屬主題;主題就是這門課自己(網頁怎麼運作等)時接全部課程,不連回自己
	topic := crumb{m.Topic, m.TopicPath}
	parent := topic
	if topic.name == "" || topic.path == "" || topic.path == e.CoursePath {
		parent = list
	}
	// 主題名稱用在兒童課、網頁怎麼運作等單課頁;沒有主題就用課程名稱
	if topic.name == "" || topic.path == "" {
		topic = overview
	}
	description := firstNonEmpty(m.Description, m.Summary, m.Title)
	out := pageMeta{Path: e.Path, Noindex: e.Noindex, OgType: e.OgType, Lang: e.Lang}
	// 英文版(只有總覽):麵包屑接英文的課程清單(主題頁沒有英文版);課頁沒有英文版,清單不附網址
	english := e.Lang == "en"

	switch e.Kind {
	case "overview":
		out.Title = title(firstNonEmpty(m.SEOTitle, m.Title))
		out.Description = description
		ld := c.courseLD(m.Title, description, e.Path)
		crumbs := c.breadcrumb(parent, overview)
		if english {
			ld.InLanguage = "en"
			crumbs = c.breadcrumbFrom("Home", crumb{"All Courses", "/en" + c.manifest.CourseList.Path}, overview)
		}
		out.JSONLD = []any{ld, crumbs}
		if e.ListLessons {
			var items []ldElement
			for _, u := range m.Units {
				if u.Hidden {
					continue // 先不公開的單元不列
				}
				for _, l := range u.Lessons {
					item := ldElement{Type: "ListItem", Position: len(items) + 1, Name: l.ID + " " + l.Title}
					// 開放而且有課程頁(腳本)的課才附網址
					if !english && l.Status == store.LessonOpen && l.Script != "" {
						item.URL = c.manifest.Origin + e.Path + "/" + store.LessonSlug(false, l.ID)
					}
					items = append(items, item)
				}
			}
			if len(items) > 0 {
				out.JSONLD = append(out.JSONLD, ldList{Context: schemaOrg, Type: "ItemList", Name: m.Title, Items: items})
			}
		}
		return out, true

	case "chapter":
		if e.Chapter == nil {
			return pageMeta{}, false
		}
		out.Title = title(e.Chapter.Name)
		out.Description = e.Chapter.Summary
		out.JSONLD = []any{c.breadcrumb(parent, overview, crumb{e.Chapter.Name, e.Path})}
		return out, true
	}

	var lesson *store.MapLesson
units:
	for _, u := range m.Units {
		for i := range u.Lessons {
			if store.LessonSlug(e.Style == "staged", u.Lessons[i].ID) == e.Slug {
				lesson = &u.Lessons[i]
				// 先不公開的單元:網址打得開但不收錄
				out.Noindex = out.Noindex || u.Hidden
				break units
			}
		}
	}
	if lesson == nil {
		return pageMeta{}, false
	}
	// 還沒開放或還沒有腳本的課頁只顯示「還沒開放」:打得開但不收錄(和 sitemap 的條件一致)
	out.Noindex = out.Noindex || lesson.Status != store.LessonOpen || lesson.Script == ""
	name, summary := lesson.Title, lesson.Summary
	// 單課頁的 document.title 是「課名｜課程名稱 · 站名」(web/src/content/lessonDisplay.ts)
	out.Title = title(name + "｜" + m.Title)

	if e.Style == "staged" {
		// 分階段的軟體課:標籤是「序章」「第 N 課」(起步階段 0.N 顯示為 N);規劃中的課是章節頁(「課號 課名」)
		var label string
		switch {
		case lesson.Status == store.LessonPlanned:
			label = lesson.ID + " " + name
			out.Title = title(label)
		case lesson.ID == "0.intro":
			label = "序章 " + name
		default:
			label = "第 " + strings.TrimPrefix(lesson.ID, "0.") + " 課 " + name
		}
		switch {
		case summary == "":
			out.Description = description
		case longEnough(summary):
			out.Description = summary
		default:
			out.Description = summary + m.Title + "：" + name + "。"
		}
		out.JSONLD = []any{c.breadcrumb(parent, overview, crumb{label, e.Path})}
		return out, true
	}

	full := topic.name + "：" + name
	crumbs := c.breadcrumb(list, topic, crumb{name, e.Path})
	switch e.Style {
	case "launch":
		out.Description = summary + full + "。"
		out.JSONLD = []any{crumbs}
		return out, true
	case "kids":
		if summary != "" && !longEnough(summary) {
			summary += full + "。"
		}
	}
	out.Description = firstNonEmpty(summary, description)
	out.JSONLD = []any{crumbs, c.courseLD(full, out.Description, e.Path)}
	return out, true
}

var htmlEscaper = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;")

// fillShell 把一頁的資料填進 build 產生的 HTML 空位
func fillShell(shell []byte, e courseEntry, m pageMeta) ([]byte, error) {
	html := string(shell)
	robots := ""
	if m.Noindex || m.NoEnglish {
		html = alternateLink.ReplaceAllString(html, "")
	}
	if m.Noindex {
		if !e.Noindex { // 整門先不公開的課,build 的 HTML 已經帶了 robots
			robots = noindexMarker + `, nofollow" data-seo>`
		}
	}
	var ld strings.Builder
	for _, data := range m.JSONLD {
		// json.Marshal 預設把 < > & 跳脫成 < 等,不會提早結束 script 元素
		b, err := json.Marshal(data)
		if err != nil {
			return nil, err
		}
		ld.WriteString(`<script type="application/ld+json" data-seo>`)
		ld.Write(b)
		ld.WriteString(`</script>`)
	}
	// 一次換完:資料裡就算出現空位的字樣也不會再被換掉
	return []byte(strings.NewReplacer(
		titleSlot, htmlEscaper.Replace(m.Title),
		descriptionSlot, htmlEscaper.Replace(m.Description),
		robotsSlot, robots,
		jsonLDSlot, ld.String(),
		slugSlot, htmlEscaper.Replace(e.Slug),
	).Replace(html)), nil
}

// render 回傳填好資料的頁面;課程資料沒重新讀過就沿用上一次的結果
func (c *courseSEO) render(ctx context.Context, path string, shell *page) (*page, error) {
	m, snap, err := c.meta(ctx, path)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if r, ok := c.rendered[path]; ok && r.from == snap {
		return r.page, nil
	}
	e, _ := c.entry(path)
	body, err := fillShell(shell.body, e, m)
	if err != nil {
		return nil, err
	}
	out := newPageWith(body, false, gzipFast)
	c.rendered[path] = renderedPage{from: snap, page: out}
	return out, nil
}

// serveUnavailable:課程資料讀不到時的回應,請爬蟲與瀏覽器晚點再來
func serveUnavailable(w http.ResponseWriter, r *http.Request) {
	h := w.Header()
	h.Set("Content-Type", "text/html; charset=utf-8")
	h.Set("Cache-Control", "no-store")
	h.Set("Retry-After", retryAfterSeconds)
	w.WriteHeader(http.StatusServiceUnavailable)
	if r.Method != http.MethodHead {
		_, _ = w.Write([]byte(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>暫時無法讀取課程</title><p>暫時無法讀取課程資料,請稍後重新整理。</p></html>`))
	}
}

// apiHandler 是 GET /api/seo/page?path=/courses/...:瀏覽器端換頁時拿和 server HTML 同一份的 SEO 資料。
// c 為 nil(這份 build 沒有課程頁清單)時回 503。
func (c *courseSEO) apiHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		fail := func(status int, code string) {
			if status == http.StatusServiceUnavailable {
				w.Header().Set("Retry-After", retryAfterSeconds)
			}
			w.WriteHeader(status)
			_, _ = w.Write([]byte(`{"error":{"code":` + strconv.Quote(code) + `}}`))
		}
		if c == nil {
			fail(http.StatusServiceUnavailable, "unavailable")
			return
		}
		p := r.URL.Query().Get("path")
		m, _, err := c.meta(r.Context(), p)
		// 沒有英文版:和 server 回的 HTML 一樣,給中文頁的資料並 noindex
		if errors.Is(err, errNoEnglish) {
			m, _, err = c.meta(r.Context(), strings.TrimPrefix(p, "/en"))
			m.Noindex = true
		}
		switch {
		case errors.Is(err, errNoSuchPage):
			fail(http.StatusNotFound, "not_found")
		case err != nil:
			fail(http.StatusServiceUnavailable, "unavailable")
		default:
			_ = json.NewEncoder(w).Encode(m)
		}
	})
}
