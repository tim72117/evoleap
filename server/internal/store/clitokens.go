package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

// evoleap CLI 的登入 token:不是網站登入用的 JWT,而是一串隨機字串(evc_ 開頭),資料庫只存雜湊。
// 每次呼叫都查這張表,所以能撤銷:刪掉那一列就立刻失效(evoleap logout、evoleap token revoke)。有效期 7 天,到期要重新登入。
// 使用者的登入全部失效(SessionsValidAfter,例如綁定 Google 時)也會讓之前發出的 CLI token 失效。

// cliTokenTTL 是 CLI token 的有效期
const cliTokenTTL = 7 * 24 * time.Hour

// cliTokenPrefix 讓 Authorization: Bearer 看得出是 CLI token
const cliTokenPrefix = "evc_"

type cliTokenRow struct {
	// ID 是給人看、用來撤銷的代號(不是 token 本身)
	ID        string `gorm:"primaryKey;size:64"`
	TokenHash string `gorm:"size:64;not null;uniqueIndex"`
	UserID    string `gorm:"size:64;not null;index"`
	// Name 是登入時 CLI 的名稱(例如 evoleap CLI(某台電腦))
	Name       string    `gorm:"size:100;not null"`
	CreatedAt  time.Time `gorm:"not null"`
	ExpiresAt  time.Time `gorm:"not null"`
	LastUsedAt time.Time `gorm:"not null"`
}

func (cliTokenRow) TableName() string { return "cli_tokens" }

// CliToken 是給 API 回傳的 CLI 登入(不含 token 本身)。
type CliToken struct {
	ID         string    `json:"id"`
	UserEmail  string    `json:"user"`
	Name       string    `json:"name"`
	CreatedAt  time.Time `json:"createdAt"`
	ExpiresAt  time.Time `json:"expiresAt"`
	LastUsedAt time.Time `json:"lastUsedAt"`
}

// IsCliToken 判斷 Authorization: Bearer 帶的是不是 CLI token。
func IsCliToken(token string) bool { return strings.HasPrefix(token, cliTokenPrefix) }

// createCliToken 發一個新的 CLI token 給 userID,回傳 token 本身(只在這時候看得到,資料庫只存雜湊)。
func createCliToken(tx *gorm.DB, userID, name string) (string, error) {
	secret, err := randomToken()
	if err != nil {
		return "", err
	}
	id, err := randomToken()
	if err != nil {
		return "", err
	}
	token := cliTokenPrefix + secret
	at := now()
	row := cliTokenRow{ID: id[:12], TokenHash: hashCode(token), UserID: userID, Name: name, CreatedAt: at, ExpiresAt: at.Add(cliTokenTTL), LastUsedAt: at}
	if err := tx.Create(&row).Error; err != nil {
		return "", err
	}
	return token, nil
}

// UserByCliToken 回傳 CLI token 的使用者;token 不存在(撤銷了)、過期,或使用者的登入已全部失效時回 ErrNotFound。順便記下最後使用時間。
func (s *Store) UserByCliToken(ctx context.Context, token string) (User, error) {
	db := s.db.WithContext(ctx)
	var row cliTokenRow
	err := db.First(&row, "token_hash = ? AND expires_at > ?", hashCode(token), now()).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	user, err := s.UserByID(ctx, row.UserID)
	if err != nil {
		return User{}, err
	}
	if row.CreatedAt.Unix() < user.SessionsValidAfter {
		return User{}, ErrNotFound
	}
	// 最後使用時間最多一分鐘寫一次,免得 CLI 每個請求都寫資料庫
	if at := now(); at.Sub(row.LastUsedAt) > time.Minute {
		if err := db.Model(&cliTokenRow{}).Where("id = ?", row.ID).Update("last_used_at", at).Error; err != nil {
			return User{}, err
		}
	}
	return user, nil
}

// CliTokens 回傳還沒過期的 CLI 登入(最近使用的在前)。
func (s *Store) CliTokens(ctx context.Context) ([]CliToken, error) {
	var out []CliToken
	err := s.db.WithContext(ctx).Raw(`SELECT t.id, u.email AS user_email, t.name, t.created_at, t.expires_at, t.last_used_at
		FROM cli_tokens t JOIN users u ON u.id = t.user_id WHERE t.expires_at > ? ORDER BY t.last_used_at DESC`, now()).Scan(&out).Error
	return out, err
}

// RevokeCliToken 撤銷一個 CLI 登入(依代號);不存在回 ErrNotFound。
func (s *Store) RevokeCliToken(ctx context.Context, id string) error {
	res := s.db.WithContext(ctx).Where("id = ?", id).Delete(&cliTokenRow{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// RevokeCliTokenValue 撤銷帶來的這個 token 本身(evoleap logout);不存在也當作成功。
func (s *Store) RevokeCliTokenValue(ctx context.Context, token string) error {
	return s.db.WithContext(ctx).Where("token_hash = ?", hashCode(token)).Delete(&cliTokenRow{}).Error
}
