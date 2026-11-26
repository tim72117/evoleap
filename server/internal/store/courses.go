package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// courseRow 記錄每門課的存取方式,Access 為 subscription 代表要訂閱才能看。
// 資料以資料庫為準,用 evoleap CLI 修改;空資料庫手動初始化(見 catalog.go)。課程地圖 API 回傳它,腳本檔(GET /api/scripts)依它與每一課的 access 把關;
// 訂閱檢查還沒做(訂閱課程的腳本只給管理員)。前端 /courses/... 的單課頁要不要登入仍看 content/catalog.ts,content/courseMap.test.ts 檢查兩邊一致。
type courseRow struct {
	ID     string `gorm:"primaryKey;size:64"`
	Title  string `gorm:"size:200;not null"`
	Access string `gorm:"size:16;not null"`
	// Tier 是訂閱課程需要的最低方案(例如 basic、advanced);其他課程是空的。
	Tier string `gorm:"size:32"`
	// 課程資訊(課程總覽頁顯示的內容,前端不再自己寫一份):
	// Summary 是課程簡介(標題下的一兩句話);About 是課程說明,段落之間用空行隔開;
	// SEOTitle、Description 是搜尋結果的標題與描述(空的就用課程名稱與簡介);Art 是插圖樣式(見 validCourseArt),空的用預設。
	Summary     string `gorm:"size:500"`
	About       string `gorm:"type:text"`
	SEOTitle    string `gorm:"size:200"`
	Description string `gorm:"size:500"`
	Art         string `gorm:"size:16"`
	// IntroScript 是課程簡介影片的腳本(web/src/content/live/ 底下的路徑,空的沒有簡介影片):檔案屬於這門課(lesson_files,課號是空的),
	// 任何訪客都拿得到(狀態視為 open、access free),不受兒童模式的時段與進度把關
	IntroScript string `gorm:"size:200"`
	// TopicID 是這門課所屬主題(topics 表的 id,見 topics.go;全部課程頁依它分組,空的不列在全部課程);
	// Overview 是這門課有沒有自己的課程總覽頁 /courses/<id>(預設有;沒有的課,例如 ai-agent,從主題頁進去);
	// Position 是課程的排序(小的在前),用 evoleap course order 改
	TopicID   string `gorm:"size:64;index"`
	Overview  bool   `gorm:"default:true"`
	Position  int
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (courseRow) TableName() string { return "courses" }

// Access 是課程的存取方式。
type Access string

const (
	AccessFree         Access = "free"
	AccessLoginFree    Access = "login-free"
	AccessSubscription Access = "subscription"
)

// ErrCourseNotFound 是查不到課程時回傳的錯誤。
var ErrCourseNotFound = errors.New("course not found")

// CourseAccess 回傳課程的存取方式(之後的訂閱檢查用,目前還沒有呼叫的地方),以及訂閱課程需要的最低方案(其他課程是空字串)。
func (s *Store) CourseAccess(ctx context.Context, id string) (Access, string, error) {
	var r courseRow
	err := s.db.WithContext(ctx).First(&r, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", "", ErrCourseNotFound
	}
	if err != nil {
		return "", "", err
	}
	return Access(r.Access), r.Tier, nil
}

// courseSeedRow 是課程資訊裡的一門課(匯出、初始化與測試資料共用的格式)。
type courseSeedRow struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Access string `json:"access"`
	Tier   string `json:"tier,omitempty"`
	// 課程資訊(見 courseRow):簡介、說明段落、搜尋結果的標題與描述、插圖樣式
	Summary     string   `json:"summary,omitempty"`
	About       []string `json:"about,omitempty"`
	SEOTitle    string   `json:"seoTitle,omitempty"`
	Description string   `json:"description,omitempty"`
	Art         string   `json:"art,omitempty"`
	IntroScript string   `json:"introScript,omitempty"`
	// 所屬主題與有沒有課程總覽頁(見 courseRow;Overview 沒寫就是有);排序(position)由種子陣列的順序決定
	TopicID  string `json:"topicId,omitempty"`
	Overview *bool  `json:"overview,omitempty"`
	// Units 是這門課的單元與每一堂課(見 lessons.go);沒寫(不是空陣列)就不動這門課的單元、課與腳本檔
	Units []unitSeed `json:"units,omitempty"`
}

// Seed 寫入給定的主題(格式同固定測試資料 fixture.Topics)與英文譯文(格式同 fixture.I18nEN,nil 表示沒有);課程、單元與課只在資料庫沒有任何課程時寫入。只給測試用(storetest、固定資料)。
// 課程結構以資料庫為準:之後用 evoleap CLI 新增、修改、刪除、排序(見 coursesadmin.go、structure.go),同步不會蓋掉。
func (s *Store) Seed(ctx context.Context, topicsJSON, coursesJSON, i18nEN []byte) error {
	seeds, err := parseCourseSeed(coursesJSON)
	if err != nil {
		return err
	}
	topics, err := parseTopicSeed(topicsJSON)
	if err != nil {
		return err
	}
	var warnings []string
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) (err error) {
		warnings, err = seedTopicsAndCourses(tx, topics, seeds)
		if err != nil {
			return err
		}
		return syncI18nSeeded(tx, topicsJSON, coursesJSON, i18nEN)
	}); err != nil {
		return err
	}
	s.i18n.clear()
	for _, w := range warnings {
		log.Printf("警告:%s", w)
	}
	return nil
}

// seedTopicsAndCourses 在呼叫端的交易裡先同步主題、再同步課程(課程要引用已存在的主題),最後刪掉種子沒有的主題(還有課程引用的保留並回傳警告)。
func seedTopicsAndCourses(tx *gorm.DB, topics []topicSeedRow, seeds []courseSeedRow) ([]string, error) {
	if err := seedTopics(tx, topics); err != nil {
		return nil, err
	}
	if empty, err := noCourses(tx); err != nil {
		return nil, err
	} else if empty {
		if err := seedCourses(tx, seeds); err != nil {
			return nil, fmt.Errorf("seed courses: %w", err)
		}
	}
	if _, err := structureTopics(tx, nil); err != nil {
		return nil, err
	}
	return pruneTopics(tx, topics)
}

// noCourses 回報資料庫是不是還沒有任何課程(種子只在這時寫入)。
func noCourses(tx *gorm.DB) (bool, error) {
	var n int64
	err := tx.Model(&courseRow{}).Count(&n).Error
	return n == 0, err
}

func parseCourseSeed(seed []byte) ([]courseSeedRow, error) {
	var seeds []courseSeedRow
	if err := json.Unmarshal(seed, &seeds); err != nil {
		return nil, fmt.Errorf("parse course seed: %w", err)
	}
	return seeds, nil
}

// seedCourses 在呼叫端的交易裡寫入課程、單元與課(InitCatalog、Seed 共用)。
func seedCourses(tx *gorm.DB, seeds []courseSeedRow) error {
	if len(seeds) == 0 {
		return nil
	}
	at := now()
	rows := make([]courseRow, len(seeds))
	topicPaths, err := topicPathsOf(tx)
	if err != nil {
		return err
	}
	for i, c := range seeds {
		if err := validateCourseInfo(c.Art, c.Summary, c.Description, c.SEOTitle, c.IntroScript, c.About); err != nil {
			return fmt.Errorf("課程 %s:%w", c.ID, err)
		}
		if err := checkCourseTopic(topicPaths, c.TopicID); err != nil {
			return fmt.Errorf("課程 %s:%w", c.ID, err)
		}
		rows[i] = courseRow{ID: c.ID, Title: c.Title, Access: c.Access, Tier: c.Tier, Summary: c.Summary, About: joinAbout(c.About), SEOTitle: c.SEOTitle, Description: c.Description, Art: c.Art, IntroScript: c.IntroScript, TopicID: c.TopicID, Overview: c.Overview == nil || *c.Overview, Position: i, CreatedAt: at, UpdatedAt: at}
	}
	err = tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "access", "tier", "summary", "about", "seo_title", "description", "art", "intro_script", "topic_id", "overview", "position", "updated_at"}),
	}).Create(&rows).Error
	if err != nil {
		return err
	}
	// overview 欄位有預設值 true,GORM 新增時會把 false(零值)當成沒給而寫成 true,所以沒有課程總覽頁的課要另外設成 false
	var noOverview []string
	for _, c := range seeds {
		if c.Overview != nil && !*c.Overview {
			noOverview = append(noOverview, c.ID)
		}
	}
	if len(noOverview) > 0 {
		if err := tx.Model(&courseRow{}).Where("id IN ?", noOverview).Update("overview", false).Error; err != nil {
			return err
		}
	}
	for _, c := range seeds {
		if c.Units == nil {
			continue
		}
		if err := upsertUnits(tx, c.ID, c.Units); err != nil {
			return fmt.Errorf("sync units of %s: %w", c.ID, err)
		}
	}
	return nil
}

// validCourseArt 是課程插圖樣式(web/src/content/levels.ts 的 CourseArt,對應 home/LevelArt.tsx);空的用預設。
var validCourseArt = map[string]bool{"": true, "tools": true, "chat": true, "build": true, "agent": true, "advanced": true}

// validateCourseInfo 檢查課程資訊的欄位:種子(seedCourses)與 CLI(UpdateCourse)共用。
func validateCourseInfo(art, summary, description, seoTitle, introScript string, about []string) error {
	if !validCourseArt[art] {
		return invalid("不認得的 art %q(tools、chat、build、agent、advanced 或留空)", art)
	}
	if len([]rune(summary)) > 500 || len([]rune(description)) > 500 {
		return invalid("summary、description 最多 500 字")
	}
	if len([]rune(seoTitle)) > 200 {
		return invalid("seoTitle 最多 200 字")
	}
	if introScript != "" && (len([]rune(introScript)) > 200 || strings.HasPrefix(introScript, "lab/") || strings.Contains(introScript, "..") || !strings.HasSuffix(introScript, ".json")) {
		return invalid("introScript 要是 live/ 底下的 .json 路徑,不能以 lab/ 開頭、不能含 ..,最多 200 字")
	}
	for _, p := range about {
		if strings.TrimSpace(p) == "" || strings.Contains(p, "\n\n") {
			return invalid("about 的每一段不能是空的,也不能含空行(空行是段落的分隔)")
		}
	}
	return nil
}

// validateCourseTopicID 檢查課程所屬的主題存在(種子與 CLI 共用)而且有 path;空的代表不屬於任何主題(不列在全部課程)。
func validateCourseTopicID(tx *gorm.DB, topicID string) error {
	if topicID == "" {
		return nil
	}
	paths, err := topicPathsOf(tx)
	if err != nil {
		return err
	}
	return checkCourseTopic(paths, topicID)
}

// topicPathsOf 一次讀出所有主題的 id 與 path(id → path),給 checkCourseTopic 比對。
func topicPathsOf(tx *gorm.DB) (map[string]string, error) {
	var rows []topicRow
	if err := tx.Select("id", "path").Find(&rows).Error; err != nil {
		return nil, err
	}
	m := make(map[string]string, len(rows))
	for _, r := range rows {
		m[r.ID] = r.Path
	}
	return m, nil
}

// checkCourseTopic 是 validateCourseTopicID 的判斷,主題資料由呼叫端先讀好。
func checkCourseTopic(paths map[string]string, topicID string) error {
	if topicID == "" {
		return nil
	}
	path, ok := paths[topicID]
	if !ok {
		return invalid("找不到主題 %q(topicId 要是 topics 表裡的主題 id,見 evoleap topic list)", topicID)
	}
	if path == "" {
		return invalid("主題 %q 還沒有 path(主題頁網址),不能有課程屬於它", topicID)
	}
	return nil
}

// joinAbout、splitAbout 在說明段落(陣列)與資料庫的一個文字欄位(空行分隔)之間轉換。
func joinAbout(paras []string) string { return strings.Join(paras, "\n\n") }

func splitAbout(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return strings.Split(s, "\n\n")
}

// ListedCourse 是全部課程頁列的一門課(GET /api/courses)。Topic、TopicSlogan、TopicPath 是它所屬主題(topics 表)的名稱、一句話與主題頁網址;
// Overview 只在這門課沒有自己的課程總覽頁時輸出(false)。
type ListedCourse struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Summary     string `json:"summary,omitempty"`
	Access      Access `json:"access"`
	Art         string `json:"art,omitempty"`
	TopicID     string `json:"topicId"`
	Topic       string `json:"topic"`
	TopicSlogan string `json:"topicSlogan,omitempty"`
	TopicPath   string `json:"topicPath"`
	Overview    *bool  `json:"overview,omitempty"`
}

// ListCourses 回傳公開的課程清單,依 position 排序(同順位依 id);單元全部先不公開(hidden)的課不列。
// 沒有單元的課照列(還沒排單元不算「全部不公開」)。沒有主題的課(topicId 空的或找不到主題)不列。
func (s *Store) ListCourses(ctx context.Context) ([]ListedCourse, error) {
	var rows []courseRow
	if err := s.db.WithContext(ctx).Order("position, id").Find(&rows).Error; err != nil {
		return nil, err
	}
	var topics []topicRow
	if err := s.db.WithContext(ctx).Find(&topics).Error; err != nil {
		return nil, err
	}
	topicByID := make(map[string]topicRow, len(topics))
	for _, t := range topics {
		topicByID[t.ID] = t
	}
	var units []unitRow
	if err := s.db.WithContext(ctx).Select("course_id", "hidden").Find(&units).Error; err != nil {
		return nil, err
	}
	total, hidden := map[string]int{}, map[string]int{}
	for _, u := range units {
		total[u.CourseID]++
		if u.Hidden {
			hidden[u.CourseID]++
		}
	}
	out := make([]ListedCourse, 0, len(rows))
	for _, c := range rows {
		// 沒有主題的課(種子沒有、資料庫裡遺留或手動加的)不列在全部課程;有主題才是「要列出的課」
		t, ok := topicByID[c.TopicID]
		if !ok {
			continue
		}
		if total[c.ID] > 0 && hidden[c.ID] == total[c.ID] {
			continue
		}
		lc := ListedCourse{ID: c.ID, Title: c.Title, Summary: c.Summary, Access: Access(c.Access), Art: c.Art, TopicID: t.ID, Topic: t.Name, TopicSlogan: t.Slogan, TopicPath: t.Path}
		if !c.Overview {
			f := false
			lc.Overview = &f
		}
		out = append(out, lc)
	}
	return out, nil
}
