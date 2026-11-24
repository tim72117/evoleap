package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// 課程地圖:公開、不用登入
func TestCourseMapAPI(t *testing.T) {
	h := newTestServer(t)
	rec := call(h, http.MethodGet, "/api/courses/kids/map", "", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"id":"0.1"`) {
		t.Fatalf("kids map: %d %s", rec.Code, rec.Body)
	}
	if rec := call(h, http.MethodGet, "/api/courses/nope/map", "", nil); rec.Code != http.StatusNotFound {
		t.Errorf("unknown: %d", rec.Code)
	}
}

// 課程地圖 API 帶課程資訊(簡介、說明段落、搜尋標題與描述、插圖)與單元的 label、hidden
func TestCourseMapInfoShape(t *testing.T) {
	h := newTestServer(t)
	rec := call(h, http.MethodGet, "/api/courses/software/map", "", nil)
	var m struct {
		Summary, SEOTitle, Description, Art string
		About                               []string
		Units                               []struct {
			ID, Label string
			Hidden    bool
		}
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil || rec.Code != http.StatusOK {
		t.Fatalf("software map: %d %v", rec.Code, err)
	}
	if m.Summary == "" || len(m.About) == 0 || m.SEOTitle == "" || m.Description == "" || m.Art != "tools" {
		t.Errorf("課程資訊: %+v", m)
	}
	for _, u := range m.Units {
		if u.Label == "" || u.Hidden != (u.ID == "ai-tools") {
			t.Errorf("單元 %s: label=%q hidden=%v", u.ID, u.Label, u.Hidden)
		}
	}
	if !strings.Contains(rec.Body.String(), `"seoTitle":`) || !strings.Contains(rec.Body.String(), `"hidden":true`) {
		t.Errorf("JSON 欄位名稱: %s", rec.Body)
	}
	// 沒有資訊的欄位不輸出
	if rec := call(h, http.MethodGet, "/api/courses/advanced/map", "", nil); strings.Contains(rec.Body.String(), `"hidden"`) || strings.Contains(rec.Body.String(), `"about"`) {
		t.Errorf("空欄位要省略: %s", rec.Body)
	}
}

// 登入功能沒開(沒有 Signer)時課程地圖照常回傳;沒接資料庫才回 503
func TestCourseMapWithoutAuth(t *testing.T) {
	st := openTestStore(t)
	rec := call(New(Config{Store: st}).Routes(), http.MethodGet, "/api/courses/kids/map", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("no signer: %d %s", rec.Code, rec.Body)
	}
	if rec := call(New(Config{}).Routes(), http.MethodGet, "/api/courses/kids/map", "", nil); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("no store: %d", rec.Code)
	}
}

// 草稿的課:訪客看到規劃中、沒有腳本;管理員(本機 -open-studio)看得到草稿與腳本;有草稿的課不快取
func TestCourseMapDrafts(t *testing.T) {
	st := openTestStore(t)
	if err := st.ReplaceUnitsJSON("software", `[{"id":"0","title":"序章","lessons":[{"id":"0.1","title":"一","status":"draft","script":"x/0.1.json"}]}]`); err != nil {
		t.Fatal(err)
	}
	guest := call(New(Config{Store: st}).Routes(), http.MethodGet, "/api/courses/software/map", "", nil)
	if guest.Code != http.StatusOK || strings.Contains(guest.Body.String(), `"draft"`) || strings.Contains(guest.Body.String(), "launch/1.1.json") {
		t.Fatalf("guest: %d %s", guest.Code, guest.Body)
	}
	if cc := guest.Header().Get("Cache-Control"); cc != "private, no-store" {
		t.Errorf("guest cache: %q", cc)
	}
	admin := call(New(Config{Store: st, OpenAdmin: true}).Routes(), http.MethodGet, "/api/courses/software/map", "", nil)
	if !strings.Contains(admin.Body.String(), `"status":"draft","script":"x/0.1.json"`) {
		t.Fatalf("admin: %s", admin.Body)
	}
	if cc := admin.Header().Get("Cache-Control"); cc != "private, no-store" {
		t.Errorf("admin cache: %q", cc)
	}
	// 沒有草稿的課照舊可以共用快取
	if cc := call(New(Config{Store: st}).Routes(), http.MethodGet, "/api/courses/claude-code/map", "", nil).Header().Get("Cache-Control"); cc != "public, max-age=60" {
		t.Errorf("claude-code cache: %q", cc)
	}
}

// 課程清單(全部課程頁用):公開、依 position 排序、帶主題欄位(topicId、topic、topicSlogan、topicPath)、沒有課程總覽頁的才有 overview:false
func TestCourseListAPI(t *testing.T) {
	h := newTestServer(t)
	rec := call(h, http.MethodGet, "/api/courses", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("list: %d %s", rec.Code, rec.Body)
	}
	t.Logf("GET /api/courses 回應:\n%s", rec.Body)
	var out struct {
		Courses []map[string]any `json:"courses"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	var ids []string
	byID := map[string]map[string]any{}
	for _, c := range out.Courses {
		id := c["id"].(string)
		ids = append(ids, id)
		byID[id] = c
	}
	want := "software,ai-agent,advanced,web,launch,claude-code,kids"
	if got := strings.Join(ids, ","); got != want {
		t.Fatalf("順序: %s,要 %s", got, want)
	}
	sw := byID["software"]
	if sw["topicId"] != "software" || sw["topic"] != "做出自己的軟體" || sw["topicPath"] != "/topics/software" || sw["topicSlogan"] == "" || sw["title"] == "" || sw["access"] == "" {
		t.Errorf("software: %v", sw)
	}
	for _, id := range []string{"ai-agent", "advanced"} {
		if byID[id]["topicId"] != "ai-apps" || byID[id]["topic"] != "打造 AI 互動軟體" || byID[id]["topicPath"] != "/topics/ai-apps" {
			t.Errorf("%s 要在 ai-apps 主題: %v", id, byID[id])
		}
	}
	for id, c := range byID {
		if c["topicPath"] == nil || c["topic"] == nil {
			t.Errorf("%s 要有 topic、topicPath: %v", id, c)
		}
		ov, has := c["overview"]
		if (id == "ai-agent") != has || (has && ov != false) {
			t.Errorf("%s 的 overview(只有 ai-agent 輸出 false): %v", id, c)
		}
	}
	for id, path := range map[string]string{"web": "/courses/web", "launch": "/courses/launch", "claude-code": "/courses/claude-code", "kids": "/courses/kids"} {
		if byID[id]["topicPath"] != path || byID[id]["topicId"] != id {
			t.Errorf("%s: %v", id, byID[id])
		}
	}
	if _, has := byID["advanced"]["summary"]; has && byID["advanced"]["summary"] == "" {
		t.Errorf("空的 summary 要省略")
	}
}

// 沒接資料庫時課程清單回 503
func TestCourseListNoStore(t *testing.T) {
	if rec := call(New(Config{}).Routes(), http.MethodGet, "/api/courses", "", nil); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("no store: %d", rec.Code)
	}
}

// 主題清單:公開、依 position 排序、content 是整包的其餘內容
func TestTopicListAPI(t *testing.T) {
	h := newTestServer(t)
	rec := call(h, http.MethodGet, "/api/topics", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("topics: %d %s", rec.Code, rec.Body)
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "public, max-age=60" {
		t.Errorf("cache: %q", cc)
	}
	var out struct {
		Topics []struct {
			ID, Name, Slogan, Path, SEOTitle, Description string
			Content                                       map[string]any
		} `json:"topics"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	var ids []string
	by := map[string]int{}
	for i, tp := range out.Topics {
		ids = append(ids, tp.ID)
		by[tp.ID] = i
	}
	if got := strings.Join(ids, ","); got != "software,launch,kids,web,ai-apps,monetize,life-data,claude-code" {
		t.Fatalf("順序: %s", got)
	}
	kids := out.Topics[by["kids"]]
	preview, _ := kids.Content["preview"].(map[string]any)
	if kids.Name != "給孩子的網頁程式" || kids.Path != "/courses/kids" || kids.SEOTitle == "" || preview["script"] != "kids/0.1.json" {
		t.Errorf("kids: %+v", kids)
	}
	if start, _ := kids.Content["start"].(map[string]any); start["path"] != "/courses/kids/0-1" || start["label"] != "開始第一課" {
		t.Errorf("kids start: %v", kids.Content["start"])
	}
	if learn, _ := out.Topics[by["software"]].Content["learn"].([]any); len(learn) != 2 {
		t.Errorf("software learn: %v", out.Topics[by["software"]].Content["learn"])
	}
	// 規劃中的主題沒有 path;沒有的欄位省略
	if m := out.Topics[by["monetize"]]; m.Path != "" || m.SEOTitle != "" || m.Name != "AI 變現術" {
		t.Errorf("monetize: %+v", m)
	}
	if strings.Contains(rec.Body.String(), `"path":""`) {
		t.Errorf("空欄位要省略: %s", rec.Body)
	}
}

func TestTopicListNoStore(t *testing.T) {
	if rec := call(New(Config{}).Routes(), http.MethodGet, "/api/topics", "", nil); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("no store: %d", rec.Code)
	}
}

// 首頁主題卡片的觀看次數:公開、帶快取、只有次數
func TestTopicViewsAPI(t *testing.T) {
	rec := call(newTestServer(t), http.MethodGet, "/api/topics/views", "", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"views"`) {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "public, max-age=300" {
		t.Errorf("cache: %q", cc)
	}
}
