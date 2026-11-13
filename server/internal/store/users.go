package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

// User 是對外使用的使用者資料(不含密碼雜湊)。
type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	// Locale:網站介面語言偏好("zh-Hant"、"en");空字串表示沒選過,前端依瀏覽器語言決定。
	Locale    string    `json:"locale"`
	CreatedAt time.Time `json:"createdAt"`
	// GoogleVerified:這個帳號的 Email 經 Google 驗證過。密碼註冊不驗證 Email 所有權,
	// 所以管理員身分只承認這種帳號(見 api/admin.go)。不對外輸出。
	GoogleVerified bool `json:"-"`
	// SessionsValidAfter:早於這個時間(Unix 秒)發出的登入 cookie 一律無效。不對外輸出。
	SessionsValidAfter int64 `json:"-"`
}

type userRow struct {
	ID                 string  `gorm:"primaryKey;size:32"`
	Email              string  `gorm:"uniqueIndex;size:320;not null"` // 一律小寫儲存
	Name               string  `gorm:"size:100;not null"`
	PasswordHash       string  `gorm:"size:200"`                    // 只用 Google 登入的帳號為空
	GoogleSub          *string `gorm:"uniqueIndex;size:64"`         // Google 帳號的穩定 ID;未綁定為 NULL
	SessionsValidAfter int64   `gorm:"not null;default:0"`          // 綁定 Google 時更新,讓先前的登入 cookie 失效
	Locale             string  `gorm:"size:10;not null;default:''"` // 介面語言偏好,見 User.Locale
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

func (userRow) TableName() string { return "users" }

func (r userRow) toUser() User {
	return User{ID: r.ID, Email: r.Email, Name: r.Name, Locale: r.Locale, CreatedAt: r.CreatedAt, GoogleVerified: r.GoogleSub != nil, SessionsValidAfter: r.SessionsValidAfter}
}

// MaxEmailLen、MaxNameLen 是註冊與 Google 登入接受的長度上限,都在資料庫欄位長度之內。
const (
	MaxEmailLen = 254
	MaxNameLen  = 50
)

// NormalizeEmail 去除前後空白並轉小寫。
func NormalizeEmail(email string) string { return strings.ToLower(strings.TrimSpace(email)) }

func newID() string {
	b := make([]byte, 12)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *Store) UserByID(ctx context.Context, id string) (User, error) {
	var r userRow
	if err := s.db.WithContext(ctx).First(&r, "id = ?", id).Error; err != nil {
		return User{}, notFound(err)
	}
	return r.toUser(), nil
}

// CredentialsByEmail 回傳使用者與密碼雜湊(登入驗證用)。
func (s *Store) CredentialsByEmail(ctx context.Context, email string) (User, string, error) {
	// Postgres 不接受含 NUL 的字串,這種 Email 本來就不可能存在。
	if strings.ContainsRune(email, 0) {
		return User{}, "", ErrNotFound
	}
	var r userRow
	if err := s.db.WithContext(ctx).First(&r, "email = ?", NormalizeEmail(email)).Error; err != nil {
		return User{}, "", notFound(err)
	}
	return r.toUser(), r.PasswordHash, nil
}

// CreatePasswordUser 建立 Email + 密碼帳號;Email 已存在時回傳 ErrAlreadyExists。
func (s *Store) CreatePasswordUser(ctx context.Context, email, name, passwordHash string) (User, error) {
	t := now()
	r := userRow{ID: newID(), Email: NormalizeEmail(email), Name: name, PasswordHash: passwordHash, CreatedAt: t, UpdatedAt: t}
	if err := s.db.WithContext(ctx).Create(&r).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return User{}, ErrAlreadyExists
		}
		return User{}, err
	}
	return r.toUser(), nil
}

// UpsertGoogleUser 以 Google sub 找使用者;找不到時,若同 Email 的帳號存在就綁定
// (只在 Google 已驗證該 Email 時),否則建立新帳號。
// 綁定到既有帳號時,該帳號已經綁了另一個 Google 帳號就回傳 ErrGoogleConflict,不會覆蓋。
// 密碼註冊不驗證 Email 所有權,帳號可能是別人搶先註冊的,所以綁定時清掉密碼、並讓綁定前發出的登入 cookie 失效,
// 之後只有 Google 驗證過的本人能登入。
// 同時登入造成的唯一索引衝突會重試一次:對方已經建好資料,重查就會命中。
func (s *Store) UpsertGoogleUser(ctx context.Context, sub, email string, emailVerified bool, name string) (User, error) {
	user, err := s.upsertGoogleUser(ctx, sub, email, emailVerified, name)
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		user, err = s.upsertGoogleUser(ctx, sub, email, emailVerified, name)
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return User{}, ErrAlreadyExists
	}
	return user, err
}

func (s *Store) upsertGoogleUser(ctx context.Context, sub, email string, emailVerified bool, name string) (User, error) {
	db := s.db.WithContext(ctx)
	var r userRow
	err := db.First(&r, "google_sub = ?", sub).Error
	if err == nil {
		return r.toUser(), nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, err
	}

	email = NormalizeEmail(email)
	if email == "" || !emailVerified {
		// 沒有已驗證的 Email 時不建立帳號,避免以未驗證的 Email 佔用他人信箱。
		return User{}, ErrGoogleEmailUnverified
	}
	err = db.First(&r, "email = ?", email).Error
	if err == nil {
		if r.GoogleSub != nil {
			// sub 相同代表是同時進行的另一次登入剛建好的,不是衝突。
			if *r.GoogleSub == sub {
				return r.toUser(), nil
			}
			return User{}, ErrGoogleConflict
		}
		t := now()
		res := db.Model(&userRow{}).Where("id = ? AND google_sub IS NULL", r.ID).Updates(map[string]any{
			"google_sub":           sub,
			"password_hash":        "",
			"sessions_valid_after": t.Unix(),
			"updated_at":           t,
		})
		if res.Error != nil {
			return User{}, res.Error
		}
		if res.RowsAffected == 0 {
			// 查到之後被同時進行的另一次登入綁走了,重查才知道是同一人還是衝突。
			return User{}, gorm.ErrDuplicatedKey
		}
		r.GoogleSub = &sub
		r.SessionsValidAfter = t.Unix()
		return r.toUser(), nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, err
	}

	name = limitName(name)
	if name == "" {
		name = limitName(strings.SplitN(email, "@", 2)[0])
	}
	t := now()
	r = userRow{ID: newID(), Email: email, Name: name, GoogleSub: &sub, CreatedAt: t, UpdatedAt: t}
	if err := db.Create(&r).Error; err != nil {
		return User{}, err
	}
	return r.toUser(), nil
}

// limitName 去掉前後空白與 NUL(Postgres 不接受),並截到名稱上限。Google 回傳的名稱長度不由我們決定。
func limitName(name string) string {
	name = strings.TrimSpace(strings.ReplaceAll(name, "\x00", ""))
	if runes := []rune(name); len(runes) > MaxNameLen {
		name = string(runes[:MaxNameLen])
	}
	return name
}

func notFound(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrNotFound
	}
	return err
}

// Locales 是網站介面支援的語言。
var Locales = []string{"zh-Hant", "en"}

// UpdateUserProfile 一次改使用者的顯示名稱與介面語言(nil 的不改);兩個欄位在同一個 UPDATE 裡寫入,不會只改到一半。
// name 與 locale 由呼叫端先檢查過(名稱長度、locale 在 Locales 裡)。使用者不存在時回傳 ErrNotFound。
func (s *Store) UpdateUserProfile(ctx context.Context, id string, name, locale *string) (User, error) {
	updates := map[string]any{"updated_at": now()}
	if name != nil {
		updates["name"] = *name
	}
	if locale != nil {
		updates["locale"] = *locale
	}
	res := s.db.WithContext(ctx).Model(&userRow{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		return User{}, res.Error
	}
	if res.RowsAffected == 0 {
		return User{}, ErrNotFound
	}
	return s.UserByID(ctx, id)
}

// UpdateUserName 改使用者的顯示名稱(會員空間);name 由呼叫端先檢查過長度。使用者不存在時回傳 ErrNotFound。
func (s *Store) UpdateUserName(ctx context.Context, id, name string) (User, error) {
	return s.UpdateUserProfile(ctx, id, &name, nil)
}

// UpdateUserLocale 更新使用者的介面語言偏好(呼叫端先確認 locale 在 Locales 裡)。
func (s *Store) UpdateUserLocale(ctx context.Context, id, locale string) (User, error) {
	return s.UpdateUserProfile(ctx, id, nil, &locale)
}
