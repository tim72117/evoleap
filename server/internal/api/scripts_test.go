package api

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tim72117/evoleap/internal/store"
	"github.com/tim72117/evoleap/internal/store/fixture"
)

// 腳本檔依所屬那一課把關:免費預覽誰都拿得到、登入後免費要登入、草稿只給管理員(其他人當作不存在)
func TestLessonFileGate(t *testing.T) {
	env := newAdminEnv(t, "boss@example.com")
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "lab"), 0o755); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{"free.json", "member.json", "draft.json", "lab/demo.json"} {
		if err := os.WriteFile(filepath.Join(dir, p), []byte(`{"from":"`+p+`"}`), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	units := `[{"id":"0","title":"序章","lessons":[` +
		`{"id":"0.1","title":"一","access":"free","status":"open","script":"free.json"},` +
		`{"id":"0.2","title":"二","status":"open","script":"member.json"},` +
		`{"id":"0.3","title":"三","status":"draft","script":"draft.json"}]}]`
	if err := env.st.ReplaceUnitsJSON("software", units); err != nil {
		t.Fatal(err)
	}
	if err := env.st.SyncLessonFilesJSON(context.Background(), []byte(`[{"id":"software","title":"t","access":"login-free","units":`+units+`}]`), dir); err != nil {
		t.Fatal(err)
	}
	amy := registerCookie(t, env.h, "amy@example.com")
	boss := env.googleCookie(t, "boss@example.com")
	cases := []struct {
		name   string
		path   string
		cookie *http.Cookie
		code   int
	}{
		{"免費預覽、訪客", "free.json", nil, http.StatusOK},
		{"登入後免費、訪客", "member.json", nil, http.StatusUnauthorized},
		{"登入後免費、會員", "member.json", amy, http.StatusOK},
		{"草稿、會員", "draft.json", amy, http.StatusNotFound},
		{"草稿、管理員", "draft.json", boss, http.StatusOK},
		{"沒有這個檔", "nope.json", boss, http.StatusNotFound},
		{"研發基地的腳本、會員", "lab/demo.json", amy, http.StatusNotFound},
		{"研發基地的腳本、管理員", "lab/demo.json", boss, http.StatusOK},
		{"沒有的旁白清單:回 null,不是 404", "free.voice.json", nil, http.StatusOK},
		{"看不到的章節音軌清單:也回 null", "draft.mix.json", amy, http.StatusOK},
	}
	for _, c := range cases {
		rec := call(env.h, http.MethodGet, "/api/scripts/"+c.path, "", c.cookie)
		if rec.Code != c.code {
			t.Errorf("%s: %d %s", c.name, rec.Code, rec.Body)
		}
		if strings.HasSuffix(c.path, ".voice.json") || strings.HasSuffix(c.path, ".mix.json") {
			if rec.Body.String() != "null\n" {
				t.Errorf("%s: body %q", c.name, rec.Body)
			}
			continue
		}
		if c.code == http.StatusOK && rec.Body.String() != `{"from":"`+c.path+`"}` {
			t.Errorf("%s: body %s", c.name, rec.Body)
		}
	}
	// 腳本清單只給管理員
	if rec := call(env.h, http.MethodGet, "/api/scripts", "", amy); rec.Code != http.StatusForbidden {
		t.Errorf("清單、會員: %d", rec.Code)
	}
	if rec := call(env.h, http.MethodGet, "/api/scripts", "", boss); rec.Code != http.StatusOK || rec.Body.String() != `{"paths":["draft.json","free.json","lab/demo.json","member.json"]}`+"\n" {
		t.Errorf("清單、管理員: %d %q", rec.Code, rec.Body)
	}
	if cc := call(env.h, http.MethodGet, "/api/scripts/free.json", "", nil).Header().Get("Cache-Control"); cc != "public, max-age=300" {
		t.Errorf("免費預覽可以共用快取: %q", cc)
	}
	if cc := call(env.h, http.MethodGet, "/api/scripts/member.json", "", amy).Header().Get("Cache-Control"); cc != "private, no-store" {
		t.Errorf("要登入的不能共用快取: %q", cc)
	}
}

// 沒接資料庫:沒有種子備援,回 503(課程與腳本只讀資料庫)
func TestLessonFileWithoutStore(t *testing.T) {
	h := New(Config{}).Routes()
	if rec := call(h, http.MethodGet, "/api/scripts/l0/0.intro.json", "", nil); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("沒接資料庫: %d %s", rec.Code, rec.Body)
	}
	// 選用的旁白清單、章節音軌清單照舊回 null,不讓瀏覽器記成載入失敗
	if rec := call(h, http.MethodGet, "/api/scripts/l0/0.intro.voice.json", "", nil); rec.Code != http.StatusOK || rec.Body.String() != "null\n" {
		t.Errorf("沒接資料庫的旁白清單: %d %q", rec.Code, rec.Body)
	}
}

// 單課存取規則依據資料:每一個腳本檔,訪客拿到什麼由資料庫裡那一課的狀態與存取方式決定,
// 草稿 404、免費(free)200、其他(登入後免費、訂閱)401。不寫死課號或「前幾課」,資料怎麼設就怎麼驗證。
func TestLessonFileGateFollowsData(t *testing.T) {
	dir := filepath.Join("..", "..", "..", "web", "src", "content", "live")
	if _, err := os.Stat(dir); err != nil {
		t.Skip("沒有腳本目錄(Docker 建置後端時只有 server/)")
	}
	env := newAdminEnv(t, "boss@example.com")
	ctx := context.Background()
	if err := env.st.SyncLessonFilesJSON(ctx, fixture.Courses, dir); err != nil {
		t.Fatal(err)
	}
	paths, err := env.st.ScriptPaths(ctx)
	if err != nil {
		t.Fatal(err)
	}
	seen := map[int]int{}
	subscription := 0
	for _, p := range paths {
		if strings.HasSuffix(p, ".voice.json") || strings.HasSuffix(p, ".mix.json") {
			continue
		}
		f, err := env.st.LessonFileOf(ctx, p)
		if errors.Is(err, store.ErrLessonFileNotFound) {
			continue // 研發基地的腳本不屬於任何一課
		}
		if err != nil {
			t.Fatal(err)
		}
		want := http.StatusUnauthorized
		switch {
		case f.Status == store.LessonDraft:
			want = http.StatusNotFound
		case f.Access == store.AccessFree:
			want = http.StatusOK
		}
		seen[want]++
		if f.Access == store.AccessSubscription {
			subscription++
		}
		if rec := call(env.h, http.MethodGet, "/api/scripts/"+p, "", nil); rec.Code != want {
			t.Errorf("%s(%s %s/%s,access=%q):訪客 %d,資料決定的是 %d", p, f.Status, f.CourseID, f.LessonID, f.Access, rec.Code, want)
		}
	}
	// 資料裡至少要有免費、要登入、訂閱與草稿的課,否則這個測試什麼都沒驗證
	if seen[http.StatusOK] == 0 || seen[http.StatusUnauthorized] == 0 || seen[http.StatusNotFound] == 0 || subscription == 0 {
		t.Errorf("資料裡要同時有免費、要登入、訂閱與草稿的課:%v 訂閱 %d", seen, subscription)
	}
}
