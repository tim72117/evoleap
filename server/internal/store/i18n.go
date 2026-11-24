package store

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
)

// 課程資訊的多語系:資料庫與種子(courses_seed.json、topics_seed.json)是繁體中文的原文,
// 其他語言放在 i18n_<語言>.json,依 id 覆蓋要翻的欄位;沒翻的欄位、沒翻的課照原文(中文)。
// 目前只有英文(en)。翻譯檔只在部署時隨程式更新,和種子一樣以檔案為準。

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

// i18nBundle 是一種語言的翻譯。units、lessons 的鍵是「課程id/單元id」「課程id/課id」。
type i18nBundle struct {
	Courses map[string]i18nCourse `json:"courses"`
	Units   map[string]i18nUnit   `json:"units"`
	Lessons map[string]i18nLesson `json:"lessons"`
	Topics  map[string]i18nTopic  `json:"topics"`
}

//go:embed i18n_en.json
var i18nENSeed []byte

var bundles = map[string]*i18nBundle{}

func init() {
	b, err := parseI18n(i18nENSeed)
	if err != nil {
		panic(err)
	}
	bundles[LangEN] = b
}

func parseI18n(seed []byte) (*i18nBundle, error) {
	var b i18nBundle
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
func (m *CourseMap) Localize(lang string) {
	b := bundles[lang]
	if b == nil {
		return
	}
	if c, ok := b.Courses[m.ID]; ok {
		pick(&m.Title, c.Title)
		pick(&m.Summary, c.Summary)
		pick(&m.SEOTitle, c.SEOTitle)
		pick(&m.Description, c.Description)
		if len(c.About) > 0 {
			m.About = c.About
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
func LocalizeCourses(cs []ListedCourse, lang string) {
	b := bundles[lang]
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
func LocalizeTopics(ts []Topic, lang string) {
	b := bundles[lang]
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
