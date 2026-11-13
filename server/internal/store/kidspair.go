package store

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 配對:已經有自己帳號的孩子,讓家長併成「兒童」分頁裡的一個孩子(規則 2026-11-13 決定):
//   1. 孩子登入自己的帳號,產生一組 6 位數配對碼(PairCodeTTL 內有效、只能用一次、重新產生會讓舊的失效);
//   2. 家長在「兒童」分頁輸入配對碼,選「新增一個孩子」或「接到既有的孩子」;
//   3. 配對成功:孩子的帳號記在 children.account_user_id;孩子帳號原本的兒童課進度併進孩子的進度(取看得比較遠的);
//      之後孩子用自己的帳號登入,一律是兒童模式(只有兒童課、只在家長排的時段、照進度一課一課,不能離開),進度與上課紀錄記在這個孩子底下。
// 一個帳號只能配對一個孩子;已經有自己孩子的帳號(家長)不能當成孩子的帳號。家長可以解除配對(孩子檔案與進度留著)。

// PairCodeTTL 是配對碼的有效時間
const PairCodeTTL = 10 * time.Minute

const pairCodeDigits = 6

// ErrPairCode 是配對碼不存在、已經過期或用過了(訊息不區分,免得被拿來試碼)
var ErrPairCode = errors.New("配對碼不對或已經過期")

// ErrInvalidPair 是不能配對(400)
var ErrInvalidPair = errors.New("不能配對")

func invalidPair(format string, a ...any) error {
	return fmt.Errorf("%w:%s", ErrInvalidPair, fmt.Sprintf(format, a...))
}

type pairCodeRow struct {
	Code      string    `gorm:"primaryKey;size:8"`
	UserID    string    `gorm:"size:32;not null;uniqueIndex"`
	ExpiresAt time.Time `gorm:"not null"`
}

func (pairCodeRow) TableName() string { return "pair_codes" }

func randomPairCode() (string, error) {
	max := new(big.Int).Exp(big.NewInt(10), big.NewInt(pairCodeDigits), nil)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%0*d", pairCodeDigits, n.Int64()), nil
}

// CreatePairCode 替孩子的帳號產生配對碼(這個帳號原本的碼作廢)。已經有自己孩子的帳號、已經配對過的帳號不能產生。
func (s *Store) CreatePairCode(ctx context.Context, userID string) (code string, expiresAt time.Time, err error) {
	db := s.db.WithContext(ctx)
	var kids int64
	if err := db.Model(&childRow{}).Where("user_id = ?", userID).Count(&kids).Error; err != nil {
		return "", time.Time{}, err
	}
	if kids > 0 {
		return "", time.Time{}, invalidPair("這個帳號已經有自己的孩子，不能當成小朋友的帳號")
	}
	if _, err := s.ChildByAccount(ctx, userID); err == nil {
		return "", time.Time{}, invalidPair("這個帳號已經和家長配對了")
	} else if !errors.Is(err, ErrNotFound) {
		return "", time.Time{}, err
	}
	expiresAt = now().Add(PairCodeTTL)
	for try := 0; try < 8; try++ {
		code, err = randomPairCode()
		if err != nil {
			return "", time.Time{}, err
		}
		err = db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Where("user_id = ? OR expires_at < ?", userID, now()).Delete(&pairCodeRow{}).Error; err != nil {
				return err
			}
			return tx.Create(&pairCodeRow{Code: code, UserID: userID, ExpiresAt: expiresAt}).Error
		})
		if err == nil {
			return code, expiresAt, nil
		}
		// 碰到別人正在用的同一組碼:換一組再試(其他錯誤不重試)
		if !errors.Is(err, gorm.ErrDuplicatedKey) {
			return "", time.Time{}, err
		}
	}
	return "", time.Time{}, err
}

// ChildByAccount 回傳配對了這個帳號的孩子(孩子本人登入時用);沒有回 ErrNotFound。
func (s *Store) ChildByAccount(ctx context.Context, accountUserID string) (Child, error) {
	var r childRow
	err := s.db.WithContext(ctx).First(&r, "account_user_id = ?", accountUserID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Child{}, ErrNotFound
	}
	if err != nil {
		return Child{}, err
	}
	return r.toChild(), nil
}

// PairChild 用配對碼把孩子的帳號配對給家長。childID 是空字串就新增一個孩子(暱稱先用孩子帳號的名稱),
// 否則接到家長這個既有的孩子(原本的時段與進度都留著)。孩子帳號原本的兒童課進度併進孩子的進度。
func (s *Store) PairChild(ctx context.Context, parentID, code, childID string) (Child, error) {
	code = strings.TrimSpace(code)
	var out Child
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var pc pairCodeRow
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&pc, "code = ?", code).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPairCode
			}
			return err
		}
		if !pc.ExpiresAt.After(now()) {
			tx.Delete(&pc)
			return ErrPairCode
		}
		account := pc.UserID
		if account == parentID {
			return invalidPair("不能配對自己的帳號")
		}
		var acct userRow
		if err := tx.First(&acct, "id = ?", account).Error; err != nil {
			return ErrPairCode
		}
		var kids int64
		if err := tx.Model(&childRow{}).Where("user_id = ?", account).Count(&kids).Error; err != nil {
			return err
		}
		if kids > 0 {
			return invalidPair("這個帳號已經有自己的孩子，不能當成小朋友的帳號")
		}
		var paired int64
		if err := tx.Model(&childRow{}).Where("account_user_id = ?", account).Count(&paired).Error; err != nil {
			return err
		}
		if paired > 0 {
			return invalidPair("這個帳號已經和家長配對了")
		}

		var row childRow
		if childID != "" {
			if err := tx.First(&row, "id = ? AND user_id = ?", childID, parentID).Error; err != nil {
				return notFound(err)
			}
			if row.AccountUserID != nil && *row.AccountUserID != "" {
				return invalidPair("這個孩子已經配對了帳號，請先解除配對")
			}
		} else {
			var n int64
			if err := tx.Model(&childRow{}).Where("user_id = ?", parentID).Count(&n).Error; err != nil {
				return err
			}
			if n >= MaxChildren {
				return invalidChild("最多 %d 個孩子", MaxChildren)
			}
			avatar, err := nextAvatar(tx, parentID, int(n))
			if err != nil {
				return err
			}
			row = childRow{ID: newID(), UserID: parentID, Name: pairedChildName(acct.Name), Avatar: avatar, Slots: "[]", Minutes: MaxMinutes, CreatedAt: now()}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&childRow{}).Where("id = ?", row.ID).Update("account_user_id", account).Error; err != nil {
			return err
		}
		row.AccountUserID = &account
		if err := mergeAccountProgress(tx, row.ID, account); err != nil {
			return err
		}
		if err := tx.Delete(&pairCodeRow{}, "code = ?", code).Error; err != nil {
			return err
		}
		out = row.toChild()
		out.AccountLabel = accountLabel(acct.Name, acct.Email)
		return nil
	})
	return out, err
}

// UnpairChild 解除配對:孩子檔案、時段與進度都留著,孩子的帳號回到一般帳號。
func (s *Store) UnpairChild(ctx context.Context, parentID, childID string) error {
	res := s.db.WithContext(ctx).Model(&childRow{}).Where("id = ? AND user_id = ? AND account_user_id IS NOT NULL", childID, parentID).Update("account_user_id", nil)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// mergeAccountProgress 把孩子帳號原本的兒童課進度(課號 kids:…)併進孩子的進度:同一課取看得比較遠的;
// 帳號那邊已經看完、孩子這邊還沒看完的課,補一筆上課紀錄(看完的時間用帳號進度最後更新的時間)。
func mergeAccountProgress(tx *gorm.DB, childID, accountID string) error {
	var rows []progressRow
	if err := tx.Where("user_id = ? AND lesson LIKE ?", accountID, "kids:%").Find(&rows).Error; err != nil {
		return err
	}
	for _, r := range rows {
		var prev childProgressRow
		err := tx.First(&prev, "child_id = ? AND lesson = ?", childID, r.Lesson).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		exists := err == nil
		if exists && prev.PositionMs >= r.PositionMs {
			continue
		}
		row := childProgressRow{ChildID: childID, Lesson: r.Lesson, PositionMs: r.PositionMs, DurationMs: r.DurationMs, UpdatedAt: r.UpdatedAt}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "child_id"}, {Name: "lesson"}},
			DoUpdates: clause.AssignmentColumns([]string{"position_ms", "duration_ms", "updated_at"}),
		}).Create(&row).Error; err != nil {
			return err
		}
		if finished(r.PositionMs, r.DurationMs) && !(exists && finished(prev.PositionMs, prev.DurationMs)) {
			if err := tx.Create(&childLessonRow{ID: newID(), ChildID: childID, Lesson: r.Lesson, FinishedAt: r.UpdatedAt}).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

// pairedChildName 是新增配對的孩子時用的暱稱:帳號名稱(最多 20 個字),沒有名稱時用「小朋友」。
func pairedChildName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "小朋友"
	}
	if utf8.RuneCountInString(name) > 20 {
		return string([]rune(name)[:20])
	}
	return name
}

// accountLabel 是配對的帳號給家長看的名稱:有名稱用名稱,否則遮住一部分的 Email(a***@example.com)。
func accountLabel(name, email string) string {
	if n := strings.TrimSpace(name); n != "" {
		return n
	}
	local, domain, ok := strings.Cut(email, "@")
	if !ok || local == "" {
		return "已配對的帳號"
	}
	return string([]rune(local)[:1]) + "***@" + domain
}

// withAccountLabels 替已配對的孩子補上帳號名稱(一次查完)。
func (s *Store) withAccountLabels(ctx context.Context, children []Child) ([]Child, error) {
	var ids []string
	for _, c := range children {
		if c.Paired {
			ids = append(ids, c.AccountUserID)
		}
	}
	if len(ids) == 0 {
		return children, nil
	}
	var users []userRow
	if err := s.db.WithContext(ctx).Select("id", "name", "email").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	labels := map[string]string{}
	for _, u := range users {
		labels[u.ID] = accountLabel(u.Name, u.Email)
	}
	for i, c := range children {
		if c.Paired {
			children[i].AccountLabel = labels[c.AccountUserID]
			if children[i].AccountLabel == "" {
				children[i].AccountLabel = "已配對的帳號"
			}
		}
	}
	return children, nil
}
