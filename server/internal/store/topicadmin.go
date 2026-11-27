package store

// 主題與清單項目的新增、刪除、排序、修改(管理員 CLI:evoleap topic …)。

import (
	"context"
	"errors"
	"slices"
	"strings"

	"gorm.io/gorm"
)

// TopicItem 是主題的一個清單項目(只有管理端用)。
type TopicItem struct {
	ID    string `json:"id"`
	Kind  string `json:"kind"`
	Text  string `json:"text"`
	Level string `json:"level,omitempty"`
}

const maxTopicItemRunes = 2000

// AdminTopics 同 ListTopics,另外帶清單項目與它們的 id。
func (s *Store) AdminTopics(ctx context.Context) ([]Topic, error) {
	topics, err := s.ListTopics(ctx)
	if err != nil {
		return nil, err
	}
	for i := range topics {
		if topics[i].Sections, err = loadTopicPage(s.db.WithContext(ctx), topics[i].ID); err != nil {
			return nil, err
		}
		if p := topics[i].parts; p != nil {
			for _, it := range p.items {
				topics[i].Items = append(topics[i].Items, TopicItem{ID: it.ID, Kind: it.Kind, Text: it.Text, Level: it.Level})
			}
		}
	}
	return topics, nil
}

// CreateTopic 新增一個主題,排在最後;內容之後用 UpdateTopic 或 AddTopicItem 加。
func (s *Store) CreateTopic(ctx context.Context, user, id, name, slogan, path string) error {
	name, slogan, path = strings.TrimSpace(name), strings.TrimSpace(slogan), strings.TrimSpace(path)
	if !topicIDPattern.MatchString(id) || len(id) > 64 {
		return invalid("主題 id %q 不合規則(小寫英數與 -,最多 64 字)", id)
	}
	if _, err := validateTopic(name, slogan, path, "", "", nil); err != nil {
		return err
	}
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		if ok, err := exists(tx, &topicRow{}, "id = ?", id); err != nil {
			return err
		} else if ok {
			return invalid("主題 %s 已經存在", id)
		}
		var last int
		if err := tx.Model(&topicRow{}).Select("COALESCE(MAX(position), -1)").Scan(&last).Error; err != nil {
			return err
		}
		at := now()
		row := topicRow{ID: id, Position: last + 1, Name: name, Slogan: slogan, Path: path, Content: "{}", Structured: true,
			TopicFields: TopicFields{Status: topicStatusPlanned}, CreatedAt: at, UpdatedAt: at}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		return s.recordChange(tx, user, "topic.create", id, map[string]string{"name": name})
	})
}

// DeleteTopic 刪掉一個沒有課程的主題,連同它的項目、段落與譯文。
func (s *Store) DeleteTopic(ctx context.Context, user, id string) error {
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		if err := lockTopic(tx, id); err != nil {
			return err
		}
		if ok, err := exists(tx, &topicRow{}, "id = ?", id); err != nil {
			return err
		} else if !ok {
			return ErrTopicNotFound
		}
		if ok, err := exists(tx, &courseRow{}, "topic_id = ?", id); err != nil {
			return err
		} else if ok {
			return invalid("還有課程屬於這個主題,先改那些課程的 topicId")
		}
		if err := writeTopicParts(tx, user, id, topicParts{}); err != nil {
			return err
		}
		if err := deleteTopicPage(tx, id); err != nil {
			return err
		}
		if err := dropTranslations(tx, user, I18nTopic, id); err != nil {
			return err
		}
		if err := tx.Where("id = ?", id).Delete(&topicRow{}).Error; err != nil {
			return err
		}
		return s.recordChange(tx, user, "topic.delete", id, nil)
	})
}

// OrderTopics 依 ids 的順序排列主題;ids 要剛好是全部主題。
func (s *Store) OrderTopics(ctx context.Context, user string, ids []string) error {
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		var have []string
		if err := tx.Model(&topicRow{}).Pluck("id", &have).Error; err != nil {
			return err
		}
		if !samePermutation(have, ids) {
			return invalid("ids 要剛好是全部主題各一次")
		}
		for i, id := range ids {
			if err := tx.Model(&topicRow{}).Where("id = ?", id).UpdateColumn("position", i).Error; err != nil {
				return err
			}
		}
		return s.recordChange(tx, user, "topic.order", "topics", ids)
	})
}

func samePermutation(a, b []string) bool {
	x, y := slices.Clone(a), slices.Clone(b)
	slices.Sort(x)
	slices.Sort(y)
	return slices.Equal(x, y)
}

// itemTx 在交易裡改一個主題的清單:edit 拿到現在的內容就地修改。
func (s *Store) itemTx(ctx context.Context, user, topicID, action string, detail any, edit func(p *topicParts) error) error {
	return s.structureTx(ctx, func(tx *gorm.DB) error {
		if err := lockTopic(tx, topicID); err != nil {
			return err
		}
		ts, err := loadTopics(tx, topicID)
		if err != nil {
			return err
		}
		if len(ts) == 0 {
			return ErrTopicNotFound
		}
		p := ts[0].parts
		if p == nil {
			return invalid("主題 %s 還是舊格式,先用 topic set -content-file 整份寫一次", topicID)
		}
		if err := edit(p); err != nil {
			return err
		}
		// 每一種類內重新編號
		count := map[string]int{}
		for i := range p.items {
			p.items[i].Position = count[p.items[i].Kind]
			count[p.items[i].Kind]++
		}
		if len(p.content()) > maxTopicContentBytes {
			return invalid("content 超過 %dKB", maxTopicContentBytes>>10)
		}
		if err := writeTopicParts(tx, user, topicID, *p); err != nil {
			return err
		}
		if err := tx.Model(&topicRow{}).Where("id = ?", topicID).UpdateColumn("updated_at", now()).Error; err != nil {
			return err
		}
		return s.recordChange(tx, user, action, topicID, detail)
	})
}

func checkTopicItem(kind, text, level string) error {
	if !slices.Contains(topicItemKinds, kind) {
		return invalid("kind 要是 %s", strings.Join(topicItemKinds, "、"))
	}
	if text == "" || len([]rune(text)) > maxTopicItemRunes || len([]rune(level)) > 100 {
		return invalid("text 不能是空的、最多 %d 字;level 最多 100 字", maxTopicItemRunes)
	}
	if level != "" && kind != "learn" {
		return invalid("只有 learn 項目有 level")
	}
	return nil
}

// AddTopicItem 新增一個清單項目;at 是在同種類裡的位置(從 1 起算),0 代表排最後。回傳新項目的 id。
func (s *Store) AddTopicItem(ctx context.Context, user, topicID, kind, text, level string, at int) (string, error) {
	text, level = strings.TrimSpace(text), strings.TrimSpace(level)
	if err := checkTopicItem(kind, text, level); err != nil {
		return "", err
	}
	item := topicItemRow{TopicID: topicID, ID: newTopicItemID(kind), Kind: kind, Text: text, Level: level}
	err := s.itemTx(ctx, user, topicID, "topic.item.add", map[string]any{"id": item.ID, "kind": kind, "text": text}, func(p *topicParts) error {
		pos, n := len(p.items), 0
		for i, it := range p.items {
			if it.Kind == kind {
				if n++; n == at {
					pos = i
				}
			}
		}
		if at < 0 || at > n+1 {
			return invalid("at 要在 1 到 %d 之間", n+1)
		}
		p.items = slices.Insert(p.items, pos, item)
		return nil
	})
	return item.ID, err
}

func findItem(p *topicParts, id string) (int, error) {
	i := slices.IndexFunc(p.items, func(it topicItemRow) bool { return it.ID == id })
	if i < 0 {
		return 0, invalid("沒有這個項目 %q(用 evoleap topic show 看 items)", id)
	}
	return i, nil
}

// SetTopicItem 改一個項目的文字或 level(nil 代表不改);id 不變,所以原本的譯文會標成過時。
func (s *Store) SetTopicItem(ctx context.Context, user, topicID, itemID string, text, level *string) error {
	return s.itemTx(ctx, user, topicID, "topic.item.set", map[string]any{"id": itemID, "text": text, "level": level}, func(p *topicParts) error {
		i, err := findItem(p, itemID)
		if err != nil {
			return err
		}
		it := &p.items[i]
		if text != nil {
			it.Text = strings.TrimSpace(*text)
		}
		if level != nil {
			it.Level = strings.TrimSpace(*level)
		}
		return checkTopicItem(it.Kind, it.Text, it.Level)
	})
}

// DeleteTopicItem 刪掉一個項目與它的譯文。
func (s *Store) DeleteTopicItem(ctx context.Context, user, topicID, itemID string) error {
	return s.itemTx(ctx, user, topicID, "topic.item.delete", map[string]any{"id": itemID}, func(p *topicParts) error {
		i, err := findItem(p, itemID)
		if err != nil {
			return err
		}
		p.items = slices.Delete(p.items, i, i+1)
		return nil
	})
}

// OrderTopicItems 排一個種類的項目;ids 要剛好是該種類的全部項目。
func (s *Store) OrderTopicItems(ctx context.Context, user, topicID, kind string, ids []string) error {
	return s.itemTx(ctx, user, topicID, "topic.item.order", map[string]any{"kind": kind, "ids": ids}, func(p *topicParts) error {
		var have []string
		byID := map[string]topicItemRow{}
		for _, it := range p.items {
			if it.Kind == kind {
				have = append(have, it.ID)
				byID[it.ID] = it
			}
		}
		if len(have) == 0 || !samePermutation(have, ids) {
			return invalid("ids 要剛好是 %s 的全部項目各一次", kind)
		}
		n := 0
		for i := range p.items {
			if p.items[i].Kind == kind {
				p.items[i] = byID[ids[n]]
				n++
			}
		}
		return nil
	})
}

// topicStartsAt 回傳以這一課當「開始第一課」的主題 id;沒有回空字串。
func topicStartsAt(tx *gorm.DB, course, lesson string) (string, error) {
	var t topicRow
	err := tx.Select("id").Where("structured = ? AND start_course = ? AND start_lesson = ?", true, course, lesson).First(&t).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	return t.ID, err
}
