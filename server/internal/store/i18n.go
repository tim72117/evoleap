package store

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
)

// 課程資訊的多語系:課程、單元、課、主題的原表只存繁體中文的原文,譯文放在資料庫的 i18n_translations(見 i18n_db.go,一個欄位一列),
// 查詢時由資料庫組成一個語言包(LangPack)套到回應上;沒翻的欄位、沒翻的課照原文(中文)。目前只有英文(en)。
// i18n_en.json 是當初的英文初稿(已匯入正式站),部署與初始化不再讀它;譯文以資料庫為準,隨課程資訊一起備份(見 catalog.go)。
// 它還有兩個用途:靜態英文頁(web/src/seo/enPages.ts,建置時讀)與資料庫完全沒有這個語言的譯文時的退路(見 Store.LangPack)。

// 語言代碼;空字串與不認得的語言都當成原文。
const LangEN = "en"

// NormalizeLang 把 ?lang= 或 Accept-Language 的值整理成支援的語言代碼;不支援的回空字串(原文)。
func NormalizeLang(s string) string {
	if l := strings.ToLower(s); l == "en" || strings.HasPrefix(l, "en-") {
		return LangEN
	}
	return ""
}

type i18nCourse struct {
	Title       string   `json:"title"`
	Summary     string   `json:"summary"`
	About       []string `json:"about"`
	SEOTitle    string   `json:"seoTitle"`
	Description string   `json:"description"`
}

type i18nUnit struct {
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	Label    string `json:"label"`
}

type i18nLesson struct {
	Title   string `json:"title"`
	Summary string `json:"summary"`
}

type i18nTopic struct {
	Name        string                     `json:"name"`
	Slogan      string                     `json:"slogan"`
	SEOTitle    string                     `json:"seoTitle"`
	Description string                     `json:"description"`
	Content     map[string]json.RawMessage `json:"content"`
}

// LangPack 是一種語言的翻譯(由資料庫已發布的譯文組成,見 Store.LangPack)。units、lessons 的鍵是「課程id/單元id」「課程id/課id」。
// nil 的語言包代表原文,Localize 系列函式不改任何東西。
type LangPack struct {
	Courses map[string]i18nCourse `json:"courses"`
	Units   map[string]i18nUnit   `json:"units"`
	Lessons map[string]i18nLesson `json:"lessons"`
	Topics  map[string]i18nTopic  `json:"topics"`
}

// i18nENSeed 是英文的初稿種子(見檔頭說明)。
//
//go:embed i18n_en.json
var i18nENSeed []byte

// seedPacks 是內嵌的初稿種子解析後的語言包:匯入資料庫(importI18nSeed)與舊路徑比對用。
var seedPacks = map[string]*LangPack{}

func init() {
	b, err := parseI18n(i18nENSeed)
	if err != nil {
		panic(err)
	}
	seedPacks[LangEN] = b
}

func parseI18n(seed []byte) (*LangPack, error) {
	var b LangPack
	if err := json.Unmarshal(seed, &b); err != nil {
		return nil, fmt.Errorf("parse i18n: %w", err)
	}
	return &b, nil
}

func pick(dst *string, v string) {
	if v != "" {
		*dst = v
	}
}

// Localize 把課程地圖換成指定語言(原地修改);沒翻的欄位保留原文。
func (m *CourseMap) Localize(b *LangPack) {
	if b == nil {
		return
	}
	if c, ok := b.Courses[m.ID]; ok {
		pick(&m.Title, c.Title)
		pick(&m.Summary, c.Summary)
		pick(&m.SEOTitle, c.SEOTitle)
		pick(&m.Description, c.Description)
		if len(c.About) > 0 {
			// 段數取原文與譯文較多的;第 i 段有譯文用譯文,否則用原文第 i 段(都沒有的空段略過)
			n := max(len(m.About), len(c.About))
			about := make([]string, 0, n)
			for i := 0; i < n; i++ {
				switch {
				case i < len(c.About) && c.About[i] != "":
					about = append(about, c.About[i])
				case i < len(m.About):
					about = append(about, m.About[i])
				}
			}
			m.About = about
		}
	}
	if t, ok := b.Topics[m.TopicID]; ok {
		pick(&m.Topic, t.Name)
		pick(&m.TopicSlogan, t.Slogan)
	}
	for i := range m.Units {
		u := &m.Units[i]
		if tu, ok := b.Units[m.ID+"/"+u.ID]; ok {
			pick(&u.Title, tu.Title)
			pick(&u.Subtitle, tu.Subtitle)
			pick(&u.Label, tu.Label)
		}
		for j := range u.Lessons {
			l := &u.Lessons[j]
			if tl, ok := b.Lessons[m.ID+"/"+l.ID]; ok {
				pick(&l.Title, tl.Title)
				pick(&l.Summary, tl.Summary)
			}
		}
	}
}

// LocalizeCourses 把全部課程頁的課程清單換成指定語言。
func LocalizeCourses(cs []ListedCourse, b *LangPack) {
	if b == nil {
		return
	}
	for i := range cs {
		c := &cs[i]
		if t, ok := b.Courses[c.ID]; ok {
			pick(&c.Title, t.Title)
			pick(&c.Summary, t.Summary)
		}
		if t, ok := b.Topics[c.TopicID]; ok {
			pick(&c.Topic, t.Name)
			pick(&c.TopicSlogan, t.Slogan)
		}
	}
}

// LocalizeTopics 把主題清單換成指定語言;content 的頂層欄位逐一覆蓋(沒翻的保留原文)。
func LocalizeTopics(ts []Topic, b *LangPack) {
	if b == nil {
		return
	}
	for i := range ts {
		t := &ts[i]
		tt, ok := b.Topics[t.ID]
		if !ok {
			continue
		}
		pick(&t.Name, tt.Name)
		pick(&t.Slogan, tt.Slogan)
		pick(&t.SEOTitle, tt.SEOTitle)
		pick(&t.Description, tt.Description)
		if len(tt.Content) > 0 && len(t.Content) > 0 {
			var base map[string]json.RawMessage
			if json.Unmarshal(t.Content, &base) == nil {
				for k, v := range tt.Content {
					base[k] = v
				}
				if raw, err := json.Marshal(base); err == nil {
					t.Content = raw
				}
			}
		}
	}
}
