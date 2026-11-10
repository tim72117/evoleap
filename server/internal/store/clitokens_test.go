package store

import (
	"context"
	"errors"
	"testing"
	"time"
)

// CLI token:發出後能用、撤銷或過期就失效、使用者的登入全部失效時也跟著失效
func TestCliTokenLifecycle(t *testing.T) {
	st := openSeeded(t)
	ctx := context.Background()
	u, err := st.CreatePasswordUser(ctx, "boss@example.com", "Boss", "x")
	if err != nil {
		t.Fatal(err)
	}
	issue := func() string {
		t.Helper()
		id, err := st.StartCliAuth(ctx, "http://127.0.0.1:5555/callback", "")
		if err != nil {
			t.Fatal(err)
		}
		_, code, err := st.ApproveCliAuth(ctx, id, u.ID)
		if err != nil {
			t.Fatal(err)
		}
		tok, err := st.ExchangeCliAuth(ctx, id, code)
		if err != nil {
			t.Fatal(err)
		}
		return tok
	}
	tok := issue()
	if got, err := st.UserByCliToken(ctx, tok); err != nil || got.ID != u.ID {
		t.Fatalf("剛發的 token: %+v %v", got, err)
	}
	if _, err := st.UserByCliToken(ctx, "evc_nope"); !errors.Is(err, ErrNotFound) {
		t.Errorf("不存在的 token: %v", err)
	}
	// evoleap logout:撤銷自己
	if err := st.RevokeCliTokenValue(ctx, tok); err != nil {
		t.Fatal(err)
	}
	if _, err := st.UserByCliToken(ctx, tok); !errors.Is(err, ErrNotFound) {
		t.Errorf("logout 後: %v", err)
	}
	// evoleap token revoke -id:依代號撤銷
	tok = issue()
	list, err := st.CliTokens(ctx)
	if err != nil || len(list) != 1 || list[0].UserEmail != "boss@example.com" {
		t.Fatalf("清單: %+v %v", list, err)
	}
	if err := st.RevokeCliToken(ctx, list[0].ID); err != nil {
		t.Fatal(err)
	}
	if _, err := st.UserByCliToken(ctx, tok); !errors.Is(err, ErrNotFound) {
		t.Errorf("revoke 後: %v", err)
	}
	if err := st.RevokeCliToken(ctx, list[0].ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("撤銷兩次: %v", err)
	}
	// 過期
	tok = issue()
	if err := st.db.Model(&cliTokenRow{}).Where("1 = 1").Update("expires_at", now().Add(-time.Minute)).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := st.UserByCliToken(ctx, tok); !errors.Is(err, ErrNotFound) {
		t.Errorf("過期後: %v", err)
	}
	// 使用者的登入全部失效(例如綁定 Google)
	tok = issue()
	if err := st.db.Model(&userRow{}).Where("id = ?", u.ID).Update("sessions_valid_after", now().Add(time.Hour).Unix()).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := st.UserByCliToken(ctx, tok); !errors.Is(err, ErrNotFound) {
		t.Errorf("使用者的登入全部失效後: %v", err)
	}
}
