// Package store 是資料存取層:正式環境用 Postgres(Cloud SQL),本機開發退回 SQLite 檔案。
package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/glebarez/sqlite" // 純 Go SQLite driver,免 CGO
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrAlreadyExists = errors.New("already exists")
	// ErrGoogleConflict:這個 Email 的帳號已經綁了另一個 Google 帳號,不能被覆蓋
	ErrGoogleConflict = errors.New("email already linked to another google account")
	// ErrGoogleEmailUnverified:Google 沒有回傳已驗證的 Email,不能用來建立或綁定帳號
	ErrGoogleEmailUnverified = errors.New("google account email not verified")
)

// maxOpenConns 是每個行程對 Postgres 的連線上限。
const maxOpenConns = 3

type Store struct {
	db *gorm.DB
	// i18n 是各語言語言包的記憶體快取(見 LangPack)
	i18n i18nCache
}

// Open 依 dsn 開啟資料庫、同步 schema,並把 courses_seed.json 的課程、單元與課寫進資料表(測試用,不含腳本檔;本機的後端用 Connect 加 SyncCourses)。
// postgres:// 或 postgresql:// 開頭用 Postgres,其他視為 SQLite 檔案路徑。
func Open(dsn string) (*Store, error) {
	s, err := Connect(dsn)
	if err != nil {
		return nil, err
	}
	if err := s.SeedCourses(context.Background()); err != nil {
		return nil, fmt.Errorf("seed courses: %w", err)
	}
	return s, nil
}

// Connect 開啟資料庫並同步 schema,不寫課程資料。Cloud Run 上的網站伺服器用:課程資料由部署時的同步工作
// (Cloud Run Job 執行 cmd/sync,見 SyncCourses)寫入一次,免得每台伺服器啟動都重寫、多台同時啟動互相衝突。
func Connect(dsn string) (*Store, error) {
	db, err := gorm.Open(dialector(dsn), &gorm.Config{
		Logger:         logger.Default.LogMode(logger.Silent),
		TranslateError: true,
	})
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	if err := db.AutoMigrate(models()...); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	if isPostgres(dsn) {
		sqlDB, err := db.DB()
		if err != nil {
			return nil, fmt.Errorf("db handle: %w", err)
		}
		// 與其他服務共用小型 Cloud SQL 實例,連線上限很低,每個 Cloud Run 實例只用少量連線。
		sqlDB.SetMaxOpenConns(maxOpenConns)
		sqlDB.SetMaxIdleConns(maxOpenConns)
		sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	}
	// 預設語言(zh-TW、en)只補缺,幾列而已,所以網站伺服器連線時也補,不用等同步工作
	if err := ensureI18nLanguages(db); err != nil {
		return nil, fmt.Errorf("seed i18n languages: %w", err)
	}
	return &Store{db: db}, nil
}

// SyncCourses 把 topics_seed.json 的主題、courses_seed.json 的課程、單元、課(見 SeedCourses),以及每一課的腳本檔(dir 是 web/src/content/live,見 SyncLessonFiles)
// 在同一個交易裡寫進資料庫:課程結構與腳本檔屬於哪一課以種子為準(種子拿掉的課會被刪),腳本內容以資料庫為準。中途失敗整批不寫。
// 回傳的警告(例如種子已經沒有、但還有種子以外的課程引用的主題,保留不刪)不影響同步結果,由呼叫端印出。
func (s *Store) SyncCourses(ctx context.Context, dir string) ([]string, error) {
	return s.syncSeeds(ctx, topicSeed, courseSeed, dir)
}

// syncCoursesJSON 是 SyncCourses 的實作,種子由參數給(測試用)。
func (s *Store) syncCoursesJSON(ctx context.Context, seed []byte, dir string) error {
	_, err := s.syncSeeds(ctx, topicSeed, seed, dir)
	return err
}

// syncSeeds 把主題種子與課程種子由參數給(測試用)寫進資料庫。
func (s *Store) syncSeeds(ctx context.Context, topicSeedJSON, seed []byte, dir string) ([]string, error) {
	seeds, err := parseCourseSeed(seed)
	if err != nil {
		return nil, err
	}
	topics, err := parseTopicSeed(topicSeedJSON)
	if err != nil {
		return nil, err
	}
	files, err := readLessonFiles(seeds, dir)
	if err != nil {
		return nil, err
	}
	var warnings []string
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		warnings = nil
		// 主題先於課程(課程引用主題),種子沒有的主題在課程之後刪(見 pruneTopics)
		if err := seedTopics(tx, topics); err != nil {
			return err
		}
		if err := seedCourses(tx, seeds); err != nil {
			return fmt.Errorf("seed courses: %w", err)
		}
		if err := syncLessonFiles(tx, seeds, files); err != nil {
			return err
		}
		// 腳本檔都改掛到合併後的課程之後,才清掉舊課程(順序不能反)
		if err := deleteRetiredCourses(tx, retiredIn(seeds)); err != nil {
			return err
		}
		w, err := pruneTopics(tx, topics)
		if err != nil {
			return err
		}
		warnings = w
		// 原表都寫完才重算翻譯的登記表,並把初稿種子補進資料庫(只補缺,見 syncI18n)
		return syncI18n(tx)
	})
	if err != nil {
		return nil, err
	}
	s.i18n.clear()
	return warnings, nil
}

func isPostgres(dsn string) bool {
	return strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://")
}

func dialector(dsn string) gorm.Dialector {
	if isPostgres(dsn) {
		return postgres.Open(dsn)
	}
	return sqlite.Open(dsn)
}

// Ping 確認資料庫連線,供健康檢查使用。
func (s *Store) Ping(ctx context.Context) error {
	sqlDB, err := s.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.PingContext(ctx)
}

func now() time.Time { return time.Now().UTC() }

// Close 關閉資料庫連線。
func (s *Store) Close() error {
	sqlDB, err := s.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
