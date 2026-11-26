// Package fixture 是寫在程式裡的測試假資料(主題、課程、單元、課與英文譯文),Go 測試、e2e 的 server(-seed)共用;
// live/ 是範例腳本。名稱與文案一律是假字,不是網站內容;id、課號、網址與腳本路徑、階段名稱(起步/零基礎/基礎)、
// 「開始第一課」、兒童課預覽的段落名稱(對應腳本裡的段落)是程式行為依賴的值。
// 每種行為(課的 open/draft/planned、存取方式、隱藏單元、沒有課程總覽頁、沒有課的單元、簡介影片、附屬檔)放一兩個代表就好,
// 測試需要新的情境時才改這裡。
package fixture

import "encoding/json"

type obj = map[string]any

type list = []string

type topic struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slogan      string `json:"slogan"`
	Path        string `json:"path,omitempty"`
	SEOTitle    string `json:"seoTitle,omitempty"`
	Description string `json:"description,omitempty"`
	Content     obj    `json:"content,omitempty"`
}

type course struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	TopicID     string `json:"topicId"`
	Access      string `json:"access"`
	Tier        string `json:"tier,omitempty"`
	Overview    *bool  `json:"overview,omitempty"`
	Summary     string `json:"summary"`
	About       list   `json:"about,omitempty"`
	SEOTitle    string `json:"seoTitle,omitempty"`
	Description string `json:"description,omitempty"`
	Art         string `json:"art,omitempty"`
	IntroScript string `json:"introScript,omitempty"`
	Units       []unit `json:"units"`
}

type unit struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Subtitle string   `json:"subtitle"`
	Label    string   `json:"label,omitempty"`
	Hidden   bool     `json:"hidden,omitempty"`
	Lessons  []lesson `json:"lessons"`
}

type lesson struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Summary string `json:"summary"`
	Status  string `json:"status"`
	Access  string `json:"access,omitempty"` // 空的照整門課
	Script  string `json:"script,omitempty"`
	Files   list   `json:"files,omitempty"`
	Minutes int    `json:"minutes,omitempty"`
}

// withTitles 補上每一課的課名「測試單課 <課程>/<課號>」與一句話。一句話刻意少於 20 字(SEO 描述太短時要接上課程名稱與課名)。
func withTitles(courses []course) []course {
	for _, c := range courses {
		for _, u := range c.Units {
			for i := range u.Lessons {
				l := &u.Lessons[i]
				l.Title = "測試單課 " + c.ID + "/" + l.ID
				l.Summary = "測試：" + c.ID + "/" + l.ID
			}
		}
	}
	return courses
}

// seoTopic 是有主題頁的主題:名稱「測試主題<n>」,標語、搜尋標題與描述照名稱組。
func seoTopic(id, n, path string, content obj) topic {
	name := "測試主題" + n
	return topic{ID: id, Name: name, Slogan: name + "的標語", Path: path, SEOTitle: name + "的搜尋標題", Description: name + "的描述。", Content: content}
}

func open(courseID, firstLesson string) obj {
	return obj{"label": "開始第一課", "path": "/courses/" + courseID + "/" + firstLesson}
}

var topics = []topic{
	seoTopic("software", "甲", "/topics/software", obj{
		"lede":  "測試主題甲的一句話說明",
		"learn": []obj{{"level": "起步", "text": "測試成果一"}, {"level": "基礎", "text": "測試成果二"}},
	}),
	seoTopic("launch", "乙", "/courses/launch", obj{
		"open": true, "start": open("launch", "0-1"),
		"pains": list{"測試痛點一", "測試痛點二"}, "learnTitle": "測試清單標題", "learn": list{"測試成果一", "測試成果二"},
	}),
	seoTopic("kids", "丙", "/courses/kids", obj{
		"open": true, "start": open("kids", "0-1"),
		"flow": list{"測試步驟一", "測試步驟二"}, "outcomes": list{"測試成果一", "測試成果二"},
		"preview": obj{"script": "kids/0.1.json", "intro": "測試預覽說明。", "sections": obj{
			"網頁有背面": obj{"note": "測試段落說明一。"},
			"換你試試看": obj{"note": "測試段落說明二。", "interactive": true},
			"找找看":   obj{"note": "測試段落說明三。", "interactive": true},
			"學會":    obj{"note": "測試段落說明四。"},
		}},
	}),
	seoTopic("web", "丁", "/courses/web", obj{
		"open": true, "start": open("web", "0-1"),
		"tag": "測試主題丁的標籤", "learn": list{"測試成果一", "測試成果二"},
	}),
	seoTopic("ai-apps", "戊", "/topics/ai-apps", obj{
		"flow": list{"測試步驟一", "測試步驟二"}, "outcomes": list{"測試成果一", "測試成果二"},
	}),
	// 規劃中的主題:沒有主題頁、搜尋標題與描述
	{ID: "monetize", Name: "測試主題己", Slogan: "測試主題己的標語", Content: obj{
		"flow": list{"測試步驟一", "測試步驟二"}, "outcomes": list{"測試成果一", "測試成果二"},
	}},
	{ID: "life-data", Name: "測試主題庚", Slogan: "測試主題庚的標語", Content: obj{
		"sample": obj{"caption": "測試示意", "before": list{"a.jpg"}, "after": list{"b/a.jpg"}}, "outcomes": list{"測試成果一", "測試成果二"},
	}},
	seoTopic("claude-code", "辛", "/courses/claude-code", obj{
		"icon": "terminal", "scenarios": list{"測試情境一", "測試情境二"},
	}),
}

var noOverview = false

var courses = withTitles([]course{
	{ID: "software", Title: "測試課一", TopicID: "software", Access: "login-free", Summary: "測試課一的簡介。", About: list{"測試課一的說明段落。"},
		SEOTitle: "測試課一的搜尋標題", Description: "測試課一的描述。", Art: "tools", Units: []unit{
			{ID: "tools", Title: "起步・測試單元甲", Label: "起步", Lessons: []lesson{
				{ID: "0.intro", Status: "open", Access: "free", Script: "l0/0.intro.json", Minutes: 10},
				{ID: "0.0", Status: "open", Access: "free", Script: "vibe-coding/4.2.json"},
				{ID: "0.1", Status: "open", Access: "free", Script: "l0/0.0-tools.json", Files: list{"l0/0.0-tools.en.json"}},
				{ID: "0.2", Status: "open", Access: "free", Script: "l0/0.1-project.json"},
				{ID: "0.3", Status: "open", Access: "free", Script: "l0/0.2-site.json"},
			}},
			{ID: "ai-tools", Title: "零基礎・測試單元乙", Label: "零基礎", Hidden: true, Lessons: []lesson{
				{ID: "1.0", Status: "open", Access: "free", Script: "l1/1.0-order.json", Files: list{"l1/1.0-opening.json"}},
				{ID: "3.3", Status: "planned"},
			}},
			{ID: "vibe-coding-basics", Title: "基礎・測試單元丙", Label: "基礎", Lessons: []lesson{
				{ID: "5.2", Status: "planned", Access: "free"},
			}},
		}},
	{ID: "ai-agent", Title: "測試課二", TopicID: "ai-apps", Access: "login-free", Tier: "advanced", Overview: &noOverview, Summary: "測試課二的簡介。", Art: "agent", Units: []unit{
		{ID: "0", Title: "測試單元", Subtitle: "測試副標。", Lessons: []lesson{
			{ID: "0.1", Status: "open", Access: "subscription", Script: "web/2.1.json"},
		}},
	}},
	{ID: "advanced", Title: "測試課三", TopicID: "ai-apps", Access: "login-free", Tier: "advanced", Summary: "測試課三的簡介。", Art: "advanced", Units: []unit{
		{ID: "1", Title: "測試單元一", Lessons: []lesson{}},
		{ID: "2", Title: "測試單元二", Lessons: []lesson{}},
	}},
	{ID: "web", Title: "測試課四", TopicID: "web", Access: "login-free", Summary: "測試課四的簡介。", About: list{"測試說明段落一。", "測試說明段落二。"},
		SEOTitle: "測試課四的搜尋標題", Description: "測試課四的描述。", Art: "tools", Units: []unit{
			{ID: "0", Title: "測試單元零", Subtitle: "測試單元零的副標", Lessons: []lesson{
				{ID: "0.1", Status: "open", Access: "free", Script: "web/0.1.json"},
				{ID: "0.2", Status: "open", Access: "free", Script: "web/0.2.json"},
			}},
			{ID: "1", Title: "測試單元一", Lessons: []lesson{
				{ID: "1.1", Status: "open", Access: "free", Script: "web/1.1.json"},
				{ID: "1.2", Status: "open", Access: "free", Script: "web/1.2.json"},
				{ID: "1.3", Status: "draft", Access: "free", Script: "web/1.3.json"},
			}},
			{ID: "4", Title: "測試單元四", Lessons: []lesson{
				{ID: "4.1", Status: "planned"},
			}},
		}},
	{ID: "launch", Title: "測試課五", TopicID: "launch", Access: "login-free", Summary: "測試課五的簡介。", About: list{"測試課五的說明段落。"},
		SEOTitle: "測試課五的搜尋標題", Description: "測試課五的描述。", Art: "build", Units: []unit{
			{ID: "0", Title: "測試單元零", Lessons: []lesson{
				{ID: "0.1", Status: "open", Access: "free", Script: "launch/0.1.json"},
			}},
			{ID: "1", Title: "測試單元一", Lessons: []lesson{
				{ID: "1.3", Status: "open", Script: "launch/1.3.json"},
			}},
			{ID: "2", Title: "測試單元二", Lessons: []lesson{
				{ID: "2.1", Status: "draft", Script: "launch/2.1.json"},
			}},
			{ID: "3", Title: "測試單元三", Lessons: []lesson{
				{ID: "3.1", Status: "planned"},
			}},
		}},
	{ID: "claude-code", Title: "測試課六", TopicID: "claude-code", Access: "free", Summary: "測試課六的簡介。",
		SEOTitle: "測試課六的搜尋標題", Description: "測試課六的描述。", Art: "chat", Units: []unit{
			{ID: "0", Title: "測試單元", Subtitle: "測試副標", Lessons: []lesson{
				{ID: "1", Status: "open", Script: "claude-code/fork.json", Minutes: 1},
				{ID: "2", Status: "open", Script: "claude-code/remote.json"},
				{ID: "3", Status: "planned"},
			}},
		}},
	{ID: "kids", Title: "測試課七", TopicID: "kids", Access: "login-free", Summary: "測試課七的簡介。",
		SEOTitle: "測試課七的搜尋標題", Description: "測試課七的描述。", IntroScript: "guide/kids.json", Units: []unit{
			{ID: "0", Title: "測試單元零", Lessons: []lesson{
				{ID: "0.1", Status: "open", Access: "free", Script: "kids/0.1.json", Files: list{"kids/0.1-explore.json"}},
			}},
			{ID: "1", Title: "測試單元一", Lessons: []lesson{
				{ID: "1.1", Status: "open", Access: "free", Script: "kids/1.1.json", Files: list{"kids/1.1-sort.json"}},
			}},
			{ID: "3", Title: "測試單元三", Lessons: []lesson{
				{ID: "3.1", Status: "open", Script: "kids/3.1.json", Files: list{"kids/3.1-say.json"}},
			}},
			{ID: "4", Title: "測試單元四", Lessons: []lesson{
				{ID: "4.1", Status: "planned"},
			}},
		}},
})

// enCourse 是一門課的英文假譯文:about 有幾段就給幾段,search 表示有沒有搜尋標題與描述。
func enCourse(title, id string, about int, search bool) obj {
	c := obj{"title": title, "summary": "Test summary: " + id + "."}
	var paras list
	for i := range about {
		paras = append(paras, "Test about "+string(rune('1'+i))+": "+id+".")
	}
	if paras != nil {
		c["about"] = paras
	}
	if search {
		c["seoTitle"], c["description"] = title+": test search title", "Test description: "+id+"."
	}
	return c
}

// 每門課的課程欄位都翻了,單元、課、主題只翻一部分(測逐欄退回中文);software/9.9 是不存在的課。
var i18nEN = obj{
	"courses": obj{
		"software":    enCourse("Test Course One", "software", 1, true),
		"ai-agent":    enCourse("Test AI Agent", "ai-agent", 0, false),
		"advanced":    enCourse("Test Advanced", "advanced", 0, false),
		"web":         enCourse("Test Course Four", "web", 2, true),
		"launch":      enCourse("Test Launch", "launch", 1, true),
		"claude-code": enCourse("Test Claude Code", "claude-code", 0, true),
		"kids":        enCourse("Test Kids Web", "kids", 0, true),
	},
	"units": obj{
		"software/tools": obj{"title": "Test Tools Unit", "label": "Starter"},
		"web/0":          obj{"title": "Test Web Basics", "subtitle": "Test web question"},
	},
	"lessons": obj{
		"software/0.1": obj{"title": "Test tool intro", "summary": "Test lesson summary: tools."},
		"web/0.1":      obj{"title": "Test web lesson"},
		"software/9.9": obj{"title": "No such lesson"},
	},
	"topics": obj{
		"software": obj{"name": "Test Software Topic", "slogan": "Test slogan", "seoTitle": "Test topic search title",
			"description": "Test topic description.", "fields": obj{"lede": "Test lede"}},
		"web":    obj{"name": "Test Web Topic", "slogan": "Test web slogan"},
		"launch": obj{"fields": obj{"learnTitle": "Test learn title", "startLabel": "Test start"}},
	},
	// 清單項目與預覽段落只翻一項(測逐項退回中文)
	"topicItems":    obj{"launch/pain-1": obj{"text": "Test pain"}},
	"topicSections": obj{"kids/找找看": "Test section note"},
}

// 給 store 的種子函式用的 JSON。
var (
	Topics  = mustJSON(topics)
	Courses = mustJSON(courses)
	I18nEN  = mustJSON(i18nEN)
)

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}
