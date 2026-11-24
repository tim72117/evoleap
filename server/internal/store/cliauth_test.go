package store

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// CLI 登入:只接受本機網址;核准一次;token 只能換一次
func TestCliAuth(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	if _, err := st.StartCliAuth(ctx, "https://evil.example.com/cb", "", nil); err == nil {
		t.Error("非本機網址要拒絕")
	}
	id, err := st.StartCliAuth(ctx, "http://127.0.0.1:5555/callback", "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if name, host, err := st.CliAuthName(ctx, id); host != "127.0.0.1:5555" || err != nil || name != "evoleap CLI" {
		t.Errorf("name: %q %v", name, err)
	}
	if _, err := st.ExchangeCliAuth(ctx, id, "x"); !errors.Is(err, ErrCliAuthNotFound) {
		t.Errorf("還沒核准不能換: %v", err)
	}
	redirect, code, err := st.ApproveCliAuth(ctx, id, "u1")
	if err != nil || redirect != "http://127.0.0.1:5555/callback" || code == "" {
		t.Fatalf("approve: %q %q %v", redirect, code, err)
	}
	// 核准了但還沒換:資料庫裡還沒有任何 token(CLI 沒來換就不會有一個沒人拿著的 token)
	var n int64
	st.db.Model(&cliTokenRow{}).Count(&n)
	if n != 0 {
		t.Errorf("核准時不該發 token: %d", n)
	}
	if _, _, err := st.ApproveCliAuth(ctx, id, "u1"); !errors.Is(err, ErrCliAuthNotFound) {
		t.Errorf("不能核准兩次: %v", err)
	}
	// 釣魚:發起登入的人只有 id,沒有送到管理員電腦上的驗證碼,換不到 token
	for _, c := range []string{"", "wrong", id} {
		if _, err := st.ExchangeCliAuth(ctx, id, c); !errors.Is(err, ErrCliAuthNotFound) {
			t.Errorf("驗證碼 %q 不該換得到: %v", c, err)
		}
	}
	if tok, err := st.ExchangeCliAuth(ctx, id, code); err != nil || !IsCliToken(tok) {
		t.Errorf("exchange: %q %v", tok, err)
	}
	if _, err := st.ExchangeCliAuth(ctx, id, code); !errors.Is(err, ErrCliAuthNotFound) {
		t.Errorf("只能換一次: %v", err)
	}
	if _, err := st.StartCliAuth(ctx, "http://127.0.0.1:5555/"+strings.Repeat("x", 300), "", nil); !errors.Is(err, ErrCliAuthInvalid) {
		t.Errorf("回呼網址太長: %v", err)
	}
}

const omixorCallback = "https://omixor.io/oauth/evoleap/callback"

// 白名單:空的時候行為不變;有項目時只有逐字相同的網址通過(不做前綴、正規化、帳號密碼、fragment、http)
func TestCliAuthRedirectAllowlist(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	if _, err := st.StartCliAuth(ctx, omixorCallback, "", nil); !errors.Is(err, ErrCliAuthInvalid) || !strings.Contains(err.Error(), "redirect_uri 只能是本機網址") {
		t.Errorf("清單為空要拒絕且訊息不變: %v", err)
	}
	allow := []string{omixorCallback}
	if _, err := st.StartCliAuth(ctx, omixorCallback, "", allow); err != nil {
		t.Errorf("清單內的網址要通過: %v", err)
	}
	if _, err := st.StartCliAuth(ctx, "http://127.0.0.1:5555/callback", "", allow); err != nil {
		t.Errorf("本機網址仍要通過: %v", err)
	}
	for _, bad := range []string{
		omixorCallback + "/", omixorCallback + "x", "https://evil.example/oauth/evoleap/callback",
		"http://omixor.io/oauth/evoleap/callback", "https://omixor.io@evil.example/oauth/evoleap/callback",
		omixorCallback + "#x", "https://OMIXOR.io/oauth/evoleap/callback", omixorCallback + "?a=1",
	} {
		if _, err := st.StartCliAuth(ctx, bad, "", allow); !errors.Is(err, ErrCliAuthInvalid) {
			t.Errorf("%q 該被拒絕: %v", bad, err)
		}
	}
	// 全是控制字元的名稱不能變成空的
	idEmpty, _ := st.StartCliAuth(ctx, omixorCallback, "", allow)
	if n, _, _ := st.CliAuthName(ctx, idEmpty); n != "evoleap CLI" {
		t.Errorf("空名稱要用預設: %q", n)
	}
	// 名稱:控制字元去掉、最多 80 字
	id, err := st.StartCliAuth(ctx, omixorCallback, "omixor OAuth: \x1b[31m"+strings.Repeat("字", 100), allow)
	if err != nil {
		t.Fatal(err)
	}
	name, host, _ := st.CliAuthName(ctx, id)
	if host != "omixor.io" || len([]rune(name)) != 80 || strings.ContainsRune(name, 0x1b) {
		t.Errorf("name/host: %q %q", name, host)
	}
}

// A 回呼的驗證碼換不到 B 登記的 token;驗證碼重放也不行
func TestCliAuthCodeBoundToSession(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	allow := []string{omixorCallback}
	a, _ := st.StartCliAuth(ctx, omixorCallback, "", allow)
	b, _ := st.StartCliAuth(ctx, "http://127.0.0.1:5555/callback", "", allow)
	_, codeA, err := st.ApproveCliAuth(ctx, a, "u1")
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := st.ApproveCliAuth(ctx, b, "u1"); err != nil {
		t.Fatal(err)
	}
	if _, err := st.ExchangeCliAuth(ctx, b, codeA); !errors.Is(err, ErrCliAuthNotFound) {
		t.Errorf("A 的驗證碼不能換 B: %v", err)
	}
	if _, err := st.ExchangeCliAuth(ctx, a, codeA); err != nil {
		t.Errorf("A 自己的驗證碼要能換: %v", err)
	}
	if _, err := st.ExchangeCliAuth(ctx, a, codeA); !errors.Is(err, ErrCliAuthNotFound) {
		t.Errorf("重放要失敗: %v", err)
	}
}

func TestParseCliAuthRedirectAllowlist(t *testing.T) {
	if l, err := ParseCliAuthRedirectAllowlist(""); err != nil || len(l) != 0 {
		t.Errorf("空: %v %v", l, err)
	}
	if l, err := ParseCliAuthRedirectAllowlist(" " + omixorCallback + " , https://b.example/cb "); err != nil || len(l) != 2 {
		t.Errorf("兩項: %v %v", l, err)
	}
	for _, bad := range []string{"http://omixor.io/cb", "omixor.io/cb", "https://u@omixor.io/cb", "https://omixor.io/cb#x", "https:///cb", "ftp://omixor.io/cb"} {
		if _, err := ParseCliAuthRedirectAllowlist(bad); err == nil {
			t.Errorf("%q 該被拒絕", bad)
		}
	}
}
