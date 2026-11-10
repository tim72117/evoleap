package api

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
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
	if err := env.st.ReplaceUnitsJSON("tools", units); err != nil {
		t.Fatal(err)
	}
	if err := env.st.SyncLessonFilesJSON(context.Background(), []byte(`[{"id":"tools","title":"t","access":"login-free","units":`+units+`}]`), dir); err != nil {
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

// 沒接資料庫:照內嵌的種子直接讀腳本目錄,只有免登入的課拿得到(登入功能停用)
func TestLessonFileWithoutStore(t *testing.T) {
	dir := filepath.Join("..", "..", "..", "web", "src", "content", "live")
	if _, err := os.Stat(dir); err != nil {
		t.Skip("沒有腳本目錄(Docker 建置後端時只有 server/)")
	}
	h := New(Config{ScriptsDir: dir}).Routes()
	for path, code := range map[string]int{
		"l0/0.intro.json":         http.StatusOK,
		"l0/0.0-tools.json":       http.StatusUnauthorized,
		"launch/1.1.json":         http.StatusUnauthorized,
		"lab/actors/browser.json": http.StatusNotFound,
	} {
		if rec := call(h, http.MethodGet, "/api/scripts/"+path, "", nil); rec.Code != code {
			t.Errorf("%s: %d %s", path, rec.Code, rec.Body)
		}
	}
}
