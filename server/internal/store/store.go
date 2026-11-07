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

// Open 依 dsn 開啟資料庫並同步 schema:postgres:// 或 postgresql:// 開頭用 Postgres,其他視為 SQLite 檔案路徑。
func Open(dsn string) (*Store, error) {
	db, err := gorm.Open(dialector(dsn), &gorm.Config{
		Logger:         logger.Default.LogMode(logger.Silent),
		TranslateError: true,
	})
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	if err := db.AutoMigrate(&userRow{}, &progressRow{}, &guestViewRow{}, &courseRow{}, &unitRow{}, &lessonRow{}); err != nil {
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
	s := &Store{db: db}
	// 課程的存取方式以 courses_seed.json 為準,每次啟動同步進 courses 表
	if err := s.SeedCourses(context.Background()); err != nil {
		return nil, fmt.Errorf("seed courses: %w", err)
	}
	return s, nil
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
