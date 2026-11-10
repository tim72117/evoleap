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
	if _, err := st.StartCliAuth(ctx, "https://evil.example.com/cb", ""); err == nil {
		t.Error("非本機網址要拒絕")
	}
	id, err := st.StartCliAuth(ctx, "http://127.0.0.1:5555/callback", "")
	if err != nil {
		t.Fatal(err)
	}
	if name, err := st.CliAuthName(ctx, id); err != nil || name != "evoleap CLI" {
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
	if _, err := st.StartCliAuth(ctx, "http://127.0.0.1:5555/"+strings.Repeat("x", 300), ""); !errors.Is(err, ErrCliAuthInvalid) {
		t.Errorf("回呼網址太長: %v", err)
	}
}
