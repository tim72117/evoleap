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
}

// Open 依 dsn 開啟資料庫、同步 schema,並把 courses_seed.json 的課程寫進資料表(本機開發與測試用)。
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
	return &Store{db: db}, nil
}

// SyncCourses 把 courses_seed.json 的課程、單元、課,以及每一課的腳本檔(dir 是 web/src/content/live)寫進資料庫:沒有的新增,已經有的更新成種子的內容(現階段以種子為準)。
func (s *Store) SyncCourses(ctx context.Context, dir string) error {
	if err := s.SeedCourses(ctx); err != nil {
		return fmt.Errorf("seed courses: %w", err)
	}
	return s.SyncLessonFiles(ctx, dir)
}

// DB 回傳資料庫連線,給自己管理資料表的套件(packages/subscription)使用。
func (s *Store) DB() *gorm.DB { return s.db }

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
