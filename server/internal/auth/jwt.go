// Package auth 提供登入相關的基礎元件:自家 JWT(HS256)簽發與驗證、
// 密碼雜湊、Google ID Token 驗證。參考 tripace 的同名套件。
package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"time"
)

// DefaultDevJWTSecret 是本機開發用的簽章金鑰;正式環境以 JWT_SECRET 環境變數覆寫。
const DefaultDevJWTSecret = "dev-secret-change-me"

// ResolveSecretFromEnv 回傳 JWT_SECRET 環境變數,未設定時退回 DefaultDevJWTSecret。
func ResolveSecretFromEnv() string {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return s
	}
	return DefaultDevJWTSecret
}

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpired      = errors.New("token expired")
)

// Claims 是自家 JWT 的內容。
type Claims struct {
	Sub string `json:"sub"` // 使用者 ID
	Exp int64  `json:"exp"` // 到期(Unix 秒)
	Iat int64  `json:"iat"` // 簽發(Unix 秒)
}

// Signer 用一把對稱金鑰簽發/驗證 JWT。
type Signer struct {
	secret []byte
	ttl    time.Duration
}

func NewSigner(secret string, ttl time.Duration) *Signer {
	return &Signer{secret: []byte(secret), ttl: ttl}
}

// TTL 回傳 token 有效期,供 cookie Max-Age 使用。
func (s *Signer) TTL() time.Duration { return s.ttl }

// Sign 為使用者簽一個 JWT。
func (s *Signer) Sign(userID string) (string, error) {
	now := time.Now()
	cb, err := json.Marshal(Claims{Sub: userID, Iat: now.Unix(), Exp: now.Add(s.ttl).Unix()})
	if err != nil {
		return "", err
	}
	hb, _ := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	signingInput := b64(hb) + "." + b64(cb)
	return signingInput + "." + s.mac(signingInput), nil
}

// Verify 驗證 JWT 並回傳 claims。
func (s *Signer) Verify(token string) (*Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, ErrInvalidToken
	}
	signingInput := parts[0] + "." + parts[1]
	// 常數時間比較,防時序攻擊。
	if !hmac.Equal([]byte(s.mac(signingInput)), []byte(parts[2])) {
		return nil, ErrInvalidToken
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, ErrInvalidToken
	}
	var c Claims
	if err := json.Unmarshal(raw, &c); err != nil || c.Sub == "" {
		return nil, ErrInvalidToken
	}
	if time.Now().Unix() > c.Exp {
		return nil, ErrExpired
	}
	return &c, nil
}

// SignPurpose 用同一把金鑰簽一段短期資料(例如片頭廣告的通行證)。格式是「內容.簽章」兩段,
// 簽章算進 purpose,不同用途的 token 不能互換,也不會被 Verify 當成登入 JWT(登入 JWT 是三段)。
func (s *Signer) SignPurpose(purpose string, payload []byte) string {
	body := b64(payload)
	return body + "." + s.mac(purpose+":"+body)
}

// VerifyPurpose 驗證 SignPurpose 簽的 token 並回傳內容;到期要由呼叫端看內容判斷。
func (s *Signer) VerifyPurpose(purpose, token string) ([]byte, error) {
	body, sig, ok := strings.Cut(token, ".")
	if !ok || strings.Contains(sig, ".") {
		return nil, ErrInvalidToken
	}
	if !hmac.Equal([]byte(s.mac(purpose+":"+body)), []byte(sig)) {
		return nil, ErrInvalidToken
	}
	raw, err := base64.RawURLEncoding.DecodeString(body)
	if err != nil {
		return nil, ErrInvalidToken
	}
	return raw, nil
}

func (s *Signer) mac(input string) string {
	h := hmac.New(sha256.New, s.secret)
	h.Write([]byte(input))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}

func b64(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }
