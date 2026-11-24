package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode"

	"gorm.io/gorm"
)

// CLI 登入(evoleap login,仿照 tripace 的 cliauth):
//  1. CLI 在本機開一個臨時伺服器,向 POST /api/cli-auth/start 登記它的 loopback 網址,換回一個 id。
//  2. CLI 打開瀏覽器到網站的核准頁(/login/cli?id=…),只有管理員能按核准;核准時伺服器記下核准的人,
//     並產生一個一次性的驗證碼(只存雜湊),瀏覽器被導回登記的 loopback 網址,驗證碼只出現在這個導回的網址上。
//  3. CLI 從自己的 loopback 伺服器收到驗證碼,用 id 加驗證碼向 POST /api/cli-auth/exchange 換 token:這時才發 token,只能換一次。
//
// 為什麼要驗證碼:id 誰都能自己發起(start 不用登入),只憑 id 就能換 token 的話,攻擊者可以自己 start、
// 把核准頁的連結寄給管理員,等管理員按下核准就搶先換走 token。驗證碼只會被送到管理員那台電腦的 loopback 網址,
// 攻擊者拿不到;而 loopback 網址只在 start 當下登記一次、只接受 localhost/127.0.0.1,網址的內容改不了它。

// cliAuthTTL 是一筆登入 session 的存活時間:短到 id 外洩也幾乎沒有可乘之機,長到夠在瀏覽器裡登入、核准。
const cliAuthTTL = 10 * time.Minute

var cliAuthLoopbackRE = regexp.MustCompile(`^http://(localhost|127\.0\.0\.1):\d+/`)

// ErrCliAuthInvalid 是登記的內容不合規則(回呼網址不是本機、太長)時回傳的錯誤,訊息寫明原因。
var ErrCliAuthInvalid = errors.New("CLI 登入要求不合規則")

// ErrCliAuthNotFound 是 session 不存在、已過期或 token 已經被換走時回傳的錯誤。
var ErrCliAuthNotFound = errors.New("cli auth session not found")

type cliAuthSessionRow struct {
	ID          string `gorm:"primaryKey;size:64"`
	RedirectURI string `gorm:"size:300;not null"`
	// Name 是核准頁上顯示的 CLI 名稱(「evoleap CLI 想要登入」)
	Name string `gorm:"size:100;not null"`
	// ApprovedBy 是核准的管理員;token 在 CLI 換的那一刻才發給這個人(資料庫裡從來不存 token 本身)
	ApprovedBy string `gorm:"size:64;not null;default:''"`
	// CodeHash 是核准時產生的一次性驗證碼的 SHA-256(驗證碼本身只放在導回 CLI 的網址上)
	CodeHash  string `gorm:"size:64;not null;default:''"`
	Approved  bool   `gorm:"not null;default:false"`
	Exchanged bool   `gorm:"not null;default:false"`
	ExpiresAt time.Time
	CreatedAt time.Time
}

func (cliAuthSessionRow) TableName() string { return "cli_auth_sessions" }

// ParseCliAuthRedirectAllowlist 解析環境變數 CLI_AUTH_REDIRECT_ALLOWLIST(逗號分隔的完整網址)。
// 每一項都必須是 https、有主機、沒有 userinfo 與 fragment、不超過 300 字,否則整份回錯誤(設定寫錯就該讓啟動失敗,不要默默放寬或略過)。
func ParseCliAuthRedirectAllowlist(raw string) ([]string, error) {
	var list []string
	for _, item := range strings.Split(raw, ",") {
		if item = strings.TrimSpace(item); item == "" {
			continue
		}
		u, err := url.Parse(item)
		if err != nil || u.Scheme != "https" || u.Host == "" || u.Hostname() == "" || u.User != nil || u.Fragment != "" || strings.Contains(item, "#") || len(item) > 300 {
			return nil, fmt.Errorf("CLI_AUTH_REDIRECT_ALLOWLIST 的項目必須是 https 完整網址(不可有帳號密碼或 #):%q", item)
		}
		list = append(list, item)
	}
	return list, nil
}

// cliAuthRedirectOK:本機 loopback 網址,或與白名單其中一項逐字完全相同(不做前綴、萬用字元、子網域,也不正規化大小寫與結尾斜線)。
func cliAuthRedirectOK(redirectURI string, allow []string) bool {
	if cliAuthLoopbackRE.MatchString(redirectURI) {
		return true
	}
	for _, a := range allow {
		if redirectURI == a {
			return true
		}
	}
	return false
}

// CliAuthRedirectHost 回傳回呼網址的主機(含埠),核准頁顯示給管理員看「核准後會被導去哪裡」。
func CliAuthRedirectHost(redirectURI string) string {
	if u, err := url.Parse(redirectURI); err == nil {
		return u.Host
	}
	return ""
}

// StartCliAuth 登記一筆待核准的 CLI 登入;redirectURI 必須是本機 loopback 網址,或與 allow(部署設定的白名單)某一項完全相同。回傳放進網址也安全的 id。
func (s *Store) StartCliAuth(ctx context.Context, redirectURI, name string, allow []string) (string, error) {
	if len(redirectURI) > 300 {
		return "", fmt.Errorf("%w:redirect_uri 太長", ErrCliAuthInvalid)
	}
	if !cliAuthRedirectOK(redirectURI, allow) {
		return "", fmt.Errorf("%w:redirect_uri 只能是本機網址(http://localhost:<port>/… 或 http://127.0.0.1:<port>/…)", ErrCliAuthInvalid)
	}
	// 先去掉控制字元與頭尾空白,再套預設名稱(全是控制字元的名稱不能變成空的)
	name = strings.TrimSpace(strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, name))
	if name == "" {
		name = "evoleap CLI"
	}
	if r := []rune(name); len(r) > 80 {
		name = string(r[:80])
	}
	id, err := randomToken()
	if err != nil {
		return "", err
	}
	at := now()
	db := s.db.WithContext(ctx)
	// 順便清掉過期的 session,這張表不會一直長大
	if err := db.Where("expires_at < ?", at).Delete(&cliAuthSessionRow{}).Error; err != nil {
		return "", err
	}
	row := cliAuthSessionRow{ID: id, RedirectURI: redirectURI, Name: name, ExpiresAt: at.Add(cliAuthTTL), CreatedAt: at}
	if err := db.Create(&row).Error; err != nil {
		return "", err
	}
	return row.ID, nil
}

func randomToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

func (s *Store) pendingCliAuth(ctx context.Context, id string) (cliAuthSessionRow, error) {
	var row cliAuthSessionRow
	err := s.db.WithContext(ctx).First(&row, "id = ? AND expires_at > ?", id, now()).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return row, ErrCliAuthNotFound
	}
	return row, err
}

// CliAuthName 回傳一筆還沒過期、還沒核准的登入要顯示的 CLI 名稱與回呼網址的主機(核准頁用)。
func (s *Store) CliAuthName(ctx context.Context, id string) (name, host string, err error) {
	row, err := s.pendingCliAuth(ctx, id)
	if err != nil {
		return "", "", err
	}
	if row.Approved {
		return "", "", ErrCliAuthNotFound
	}
	return row.Name, CliAuthRedirectHost(row.RedirectURI), nil
}

// ApproveCliAuth 由 userID(核准的管理員)核准一筆登入:記下核准的人與一次性驗證碼的雜湊,
// 回傳要把瀏覽器導回去的 CLI loopback 網址與驗證碼(只放在那個網址上)。每筆只能核准一次。
// 這時還不發 token:CLI 沒來換(逾時、關掉終端機)就不會有一個沒人拿著、卻能用的 token。
func (s *Store) ApproveCliAuth(ctx context.Context, id, userID string) (redirect, code string, err error) {
	row, err := s.pendingCliAuth(ctx, id)
	if err != nil {
		return "", "", err
	}
	if code, err = randomToken(); err != nil {
		return "", "", err
	}
	res := s.db.WithContext(ctx).Model(&cliAuthSessionRow{}).Where("id = ? AND approved = ?", id, false).
		Updates(map[string]any{"approved": true, "approved_by": userID, "code_hash": hashCode(code)})
	if res.Error != nil {
		return "", "", res.Error
	}
	if res.RowsAffected == 0 {
		return "", "", ErrCliAuthNotFound
	}
	return row.RedirectURI, code, nil
}

// ExchangeCliAuth 用 id 與核准時送到 CLI loopback 網址的驗證碼換 token:這時才發 CLI token(見 clitokens.go)給核准的人。
// 只能換一次(重放拿不到第二個)。還沒核准、已過期、已換過或驗證碼不對都回 ErrCliAuthNotFound。
func (s *Store) ExchangeCliAuth(ctx context.Context, id, code string) (string, error) {
	var token string
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row cliAuthSessionRow
		if err := tx.First(&row, "id = ? AND expires_at > ? AND approved = ? AND exchanged = ?", id, now(), true, false).Error; err != nil {
			return err
		}
		if code == "" || subtle.ConstantTimeCompare([]byte(row.CodeHash), []byte(hashCode(code))) != 1 {
			return gorm.ErrRecordNotFound
		}
		res := tx.Model(&cliAuthSessionRow{}).Where("id = ? AND exchanged = ?", id, false).Update("exchanged", true)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		// 順便清掉過期的 CLI token
		if err := tx.Where("expires_at < ?", now()).Delete(&cliTokenRow{}).Error; err != nil {
			return err
		}
		var err error
		token, err = createCliToken(tx, row.ApprovedBy, row.Name)
		return err
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", ErrCliAuthNotFound
	}
	return token, err
}
