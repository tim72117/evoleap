package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
)

// 兒童模式(粗略版):家長在會員空間設定兒童(暱稱、每週上課時段,最多 3 堂),在自己的裝置開啟兒童模式讓孩子上課。
// 兒童模式下只看得到兒童課,而且只有在家長排入的時段才打得開(伺服器照台灣時間判斷,見 ScheduleAt)。
// 每次上課多久由家長設定(Child.Minutes,5–MaxMinutes 分鐘,預設 MaxMinutes):時段從開始時間起開放這麼久。
// 還沒決定、先用預設值的:時區固定台灣;離開兒童模式不用家長確認。
// 構想與待決定事項見研發基地 /studio/kids-family(web/src/studio/proposal/KidsFamilyPage.tsx)。

// Avatars 是孩子可以選的頭像(emoji);新增孩子時依序給還沒用過的(前端 kidsMode/avatars 同一份)
var Avatars = []string{"🐱", "🐶", "🐰", "🦊", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🐧", "🦄", "🐻", "🐹", "🐳", "🦖"}

func validAvatar(a string) bool {
	for _, x := range Avatars {
		if x == a {
			return true
		}
	}
	return false
}

// MaxSlots 是每個孩子每週最多排幾堂
const MaxSlots = 3

// MaxChildren 是一個家長帳號最多幾個孩子
const MaxChildren = 5

// MaxMinutes 是每次上課最長幾分鐘(家長設定的上限,也是預設值)
const MaxMinutes = 60

// MinMinutes 是每次上課最短幾分鐘(一課約 5–8 分鐘)
const MinMinutes = 5

// KidsZone 是判斷上課時段用的時區(粗略版固定台灣)
var KidsZone = time.FixedZone("Asia/Taipei", 8*60*60)

// ErrInvalidChild 是兒童資料不合規則(400)
var ErrInvalidChild = errors.New("兒童資料不合規則")

// Slot 是每週的一個上課時段:Day 0 是週一 … 6 是週日,Time 是開始時間 "HH:MM"
type Slot struct {
	Day  int    `json:"day"`
	Time string `json:"time"`
}

// Child 是家長帳號底下的一個孩子。
type Child struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Avatar 是頭像(Avatars 裡的一個 emoji)
	Avatar string `json:"avatar"`
	Slots  []Slot `json:"slots"`
	// Minutes 是每次上課多久:時段從開始時間起開放幾分鐘
	Minutes   int       `json:"minutes"`
	CreatedAt time.Time `json:"createdAt"`
}

type childRow struct {
	ID     string `gorm:"primaryKey;size:32"`
	UserID string `gorm:"size:32;not null;index"`
	Name   string `gorm:"size:80;not null"`
	Avatar string `gorm:"size:16;not null;default:''"`
	// Slots 是 []Slot 的 JSON
	Slots     string    `gorm:"type:text;not null"`
	Minutes   int       `gorm:"not null;default:60"`
	CreatedAt time.Time `gorm:"not null"`
}

func (childRow) TableName() string { return "children" }

func (r childRow) toChild() Child {
	c := Child{ID: r.ID, Name: r.Name, Avatar: r.Avatar, CreatedAt: r.CreatedAt, Slots: []Slot{}, Minutes: r.Minutes}
	if !validAvatar(c.Avatar) {
		c.Avatar = Avatars[0]
	}
	if c.Minutes < MinMinutes || c.Minutes > MaxMinutes {
		c.Minutes = MaxMinutes
	}
	_ = json.Unmarshal([]byte(r.Slots), &c.Slots)
	return c
}

func invalidChild(format string, a ...any) error {
	return fmt.Errorf("%w:%s", ErrInvalidChild, fmt.Sprintf(format, a...))
}

func checkChildName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > 20 {
		return "", invalidChild("暱稱要 1 到 20 個字")
	}
	return name, nil
}

// checkSlots 檢查時段:最多 MaxSlots 個、星期 0–6、時間 HH:MM、不重複;回傳依一週順序排好的時段。
func checkSlots(slots []Slot) ([]Slot, error) {
	if len(slots) > MaxSlots {
		return nil, invalidChild("每週最多排 %d 堂", MaxSlots)
	}
	seen := map[Slot]bool{}
	out := make([]Slot, 0, len(slots))
	for _, s := range slots {
		if s.Day < 0 || s.Day > 6 {
			return nil, invalidChild("星期要是 0(週一)到 6(週日)")
		}
		if _, err := time.Parse("15:04", s.Time); err != nil || len(s.Time) != 5 {
			return nil, invalidChild("時間要寫成 HH:MM,例如 16:00")
		}
		if seen[s] {
			return nil, invalidChild("時段重複了")
		}
		seen[s] = true
		out = append(out, s)
	}
	sortSlots(out)
	return out, nil
}

func sortSlots(s []Slot) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && (s[j].Day < s[j-1].Day || s[j].Day == s[j-1].Day && s[j].Time < s[j-1].Time); j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}

// Children 回傳家長的孩子(先建立的在前)。
func (s *Store) Children(ctx context.Context, userID string) ([]Child, error) {
	var rows []childRow
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at, id").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Child, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.toChild())
	}
	return out, nil
}

// ChildOf 回傳家長的某個孩子;不是這位家長的或不存在都回 ErrNotFound。
func (s *Store) ChildOf(ctx context.Context, userID, id string) (Child, error) {
	var r childRow
	err := s.db.WithContext(ctx).First(&r, "id = ? AND user_id = ?", id, userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Child{}, ErrNotFound
	}
	if err != nil {
		return Child{}, err
	}
	return r.toChild(), nil
}

// CreateChild 新增一個孩子(還沒有時段)。
func (s *Store) CreateChild(ctx context.Context, userID, name string) (Child, error) {
	name, err := checkChildName(name)
	if err != nil {
		return Child{}, err
	}
	var n int64
	if err := s.db.WithContext(ctx).Model(&childRow{}).Where("user_id = ?", userID).Count(&n).Error; err != nil {
		return Child{}, err
	}
	if n >= MaxChildren {
		return Child{}, invalidChild("最多 %d 個孩子", MaxChildren)
	}
	// 頭像:依序給這位家長還沒用過的
	var used []string
	if err := s.db.WithContext(ctx).Model(&childRow{}).Where("user_id = ?", userID).Pluck("avatar", &used).Error; err != nil {
		return Child{}, err
	}
	avatar := Avatars[int(n)%len(Avatars)]
	for _, a := range Avatars {
		taken := false
		for _, u := range used {
			taken = taken || u == a
		}
		if !taken {
			avatar = a
			break
		}
	}
	r := childRow{ID: newID(), UserID: userID, Name: name, Avatar: avatar, Slots: "[]", Minutes: MaxMinutes, CreatedAt: now()}
	if err := s.db.WithContext(ctx).Create(&r).Error; err != nil {
		return Child{}, err
	}
	return r.toChild(), nil
}

// ChildPatch 是要改的欄位(nil 的不改)。
type ChildPatch struct {
	Name    *string `json:"name"`
	Slots   *[]Slot `json:"slots"`
	Minutes *int    `json:"minutes"`
	Avatar  *string `json:"avatar"`
}

// UpdateChild 改孩子的暱稱或時段。
func (s *Store) UpdateChild(ctx context.Context, userID, id string, p ChildPatch) (Child, error) {
	updates := map[string]any{}
	if p.Name != nil {
		name, err := checkChildName(*p.Name)
		if err != nil {
			return Child{}, err
		}
		updates["name"] = name
	}
	if p.Slots != nil {
		slots, err := checkSlots(*p.Slots)
		if err != nil {
			return Child{}, err
		}
		b, _ := json.Marshal(slots)
		updates["slots"] = string(b)
	}
	if p.Minutes != nil {
		m := *p.Minutes
		if m < MinMinutes || m > MaxMinutes || m%5 != 0 {
			return Child{}, invalidChild("每次上課要是 %d 到 %d 分鐘(以 5 分鐘為單位)", MinMinutes, MaxMinutes)
		}
		updates["minutes"] = m
	}
	if p.Avatar != nil {
		if !validAvatar(*p.Avatar) {
			return Child{}, invalidChild("頭像要從清單裡選")
		}
		updates["avatar"] = *p.Avatar
	}
	if len(updates) == 0 {
		return Child{}, invalidChild("沒有要改的欄位")
	}
	res := s.db.WithContext(ctx).Model(&childRow{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates)
	if res.Error != nil {
		return Child{}, res.Error
	}
	if res.RowsAffected == 0 {
		return Child{}, ErrNotFound
	}
	return s.ChildOf(ctx, userID, id)
}

// DeleteChild 刪掉一個孩子,連同他的播放進度與上課紀錄;不存在回 ErrNotFound。
func (s *Store) DeleteChild(ctx context.Context, userID, id string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Where("id = ? AND user_id = ?", id, userID).Delete(&childRow{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrNotFound
		}
		return deleteChildRecords(tx, id)
	})
}

// Schedule 是某個時間點的上課狀態。
type Schedule struct {
	// Open:現在是不是上課時段
	Open bool `json:"open"`
	// Current:正在進行的時段與結束時間(Open 時才有)
	Current *Slot      `json:"current,omitempty"`
	EndsAt  *time.Time `json:"endsAt,omitempty"`
	// Next:下一個時段開始的時間(沒有排任何時段時是 nil)
	Next   *Slot      `json:"next,omitempty"`
	NextAt *time.Time `json:"nextAt,omitempty"`
}

// ScheduleAt 算出 t 時的上課狀態:t 落在某個時段的 [開始, 開始+minutes) 之間就是可以上課。
func ScheduleAt(slots []Slot, minutes int, t time.Time) Schedule {
	t = t.In(KidsZone)
	// 這週一 00:00
	weekday := (int(t.Weekday()) + 6) % 7
	monday := time.Date(t.Year(), t.Month(), t.Day()-weekday, 0, 0, 0, 0, KidsZone)
	var out Schedule
	// 上週到下週,找正在進行的與下一個(跨週時也找得到)
	for week := -1; week <= 1; week++ {
		for _, s := range slots {
			hm, err := time.Parse("15:04", s.Time)
			if err != nil {
				continue
			}
			start := monday.AddDate(0, 0, week*7+s.Day).Add(time.Duration(hm.Hour())*time.Hour + time.Duration(hm.Minute())*time.Minute)
			end := start.Add(time.Duration(minutes) * time.Minute)
			slot := s
			if !t.Before(start) && t.Before(end) && out.Current == nil {
				out.Open, out.Current, out.EndsAt = true, &slot, &end
			}
			if start.After(t) && (out.NextAt == nil || start.Before(*out.NextAt)) {
				out.Next, out.NextAt = &slot, &start
			}
		}
	}
	return out
}

// SlotLabel 是時段給人看的寫法,例如「週二 16:00」
func SlotLabel(s Slot) string {
	days := []string{"週一", "週二", "週三", "週四", "週五", "週六", "週日"}
	if s.Day < 0 || s.Day > 6 {
		return s.Time
	}
	return days[s.Day] + " " + s.Time
}
