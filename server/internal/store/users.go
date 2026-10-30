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
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

type userRow struct {
	ID           string  `gorm:"primaryKey;size:32"`
	Email        string  `gorm:"uniqueIndex;size:320;not null"` // 一律小寫儲存
	Name         string  `gorm:"size:100;not null"`
	PasswordHash string  `gorm:"size:200"`            // 只用 Google 登入的帳號為空
	GoogleSub    *string `gorm:"uniqueIndex;size:64"` // Google 帳號的穩定 ID;未綁定為 NULL
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (userRow) TableName() string { return "users" }

func (r userRow) toUser() User {
	return User{ID: r.ID, Email: r.Email, Name: r.Name, CreatedAt: r.CreatedAt}
}

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
func (s *Store) UpsertGoogleUser(ctx context.Context, sub, email string, emailVerified bool, name string) (User, error) {
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
	if email != "" && emailVerified {
		err = db.First(&r, "email = ?", email).Error
		if err == nil {
			if err := db.Model(&r).Updates(map[string]any{"google_sub": sub, "updated_at": now()}).Error; err != nil {
				return User{}, err
			}
			return r.toUser(), nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return User{}, err
		}
	} else {
		// 沒有已驗證的 Email 時不建立帳號,避免以未驗證的 Email 佔用他人信箱。
		return User{}, errors.New("google account email not verified")
	}

	if name == "" {
		name = strings.SplitN(email, "@", 2)[0]
	}
	t := now()
	r = userRow{ID: newID(), Email: email, Name: name, GoogleSub: &sub, CreatedAt: t, UpdatedAt: t}
	if err := db.Create(&r).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return User{}, ErrAlreadyExists
		}
		return User{}, err
	}
	return r.toUser(), nil
}

func notFound(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrNotFound
	}
	return err
}
