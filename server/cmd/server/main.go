// Command server 啟動 Shuttle 教學網站的 HTTP 服務(API + 內嵌前端)。
package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/tim72117/evoleap/internal/api"
	"github.com/tim72117/evoleap/internal/auth"
	"github.com/tim72117/evoleap/internal/store"
)

// authRateLimitPerIP 是正式環境每個來源 IP 每分鐘可嘗試登入、註冊的次數。
const authRateLimitPerIP = 30

func main() {
	// 預設只綁 127.0.0.1:本機開發不對外部網路開放,Windows 防火牆不會跳出詢問框。
	// 雲端(Cloud Run)需要監聽所有介面時,由下方 PORT 環境變數覆寫。
	addr := flag.String("addr", "127.0.0.1:8190", "HTTP 監聽位址(本機預設 8190,避開其他專案常用的 8080-8082)")
	dbPath := flag.String("db", "shuttle.db", "DATABASE_URL 未設定時使用的本機 SQLite 檔案")
	distDir := flag.String("dist", "", "從磁碟目錄提供前端 build(例如 ../web/dist);留空使用內嵌的 build")
	flag.Parse()

	// PORT 由平台注入(Cloud Run 預設 8080),覆寫監聽位址。
	if p := os.Getenv("PORT"); p != "" {
		*addr = ":" + p
	}

	// 資料庫決定登入功能是否啟用:
	//   - 有 DATABASE_URL:用它(正式環境為 Cloud SQL Postgres,postgresql://…?host=/cloudsql/…)。
	//   - Cloud Run 上沒設定:不開資料庫,登入功能停用,網站其他部分照常運作
	//     (Cloud Run 的檔案系統不保存資料,不能退回 SQLite)。
	//   - 本機沒設定:退回 SQLite 檔案(-db)。
	onCloudRun := os.Getenv("K_SERVICE") != ""
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" && !onCloudRun {
		dsn = *dbPath
	}
	cfg := api.Config{
		GoogleClientID: os.Getenv("GOOGLE_OAUTH_CLIENT_ID"),
		SecureCookie:   onCloudRun,
		AdminEmails:    os.Getenv("ADMIN_BOOTSTRAP_EMAIL"),
	}
	if dsn == "" {
		log.Print("未設定 DATABASE_URL:登入功能停用")
	} else {
		st, err := store.Open(dsn)
		if err != nil {
			log.Fatal(err)
		}
		// 正式環境必須設定 JWT_SECRET,不能用開發預設值。
		secret := auth.ResolveSecretFromEnv()
		if onCloudRun && secret == auth.DefaultDevJWTSecret {
			log.Fatal("已設定 DATABASE_URL 但 JWT_SECRET 未設定")
		}
		cfg.Store = st
		cfg.Signer = auth.NewSigner(secret, 30*24*time.Hour)
	}
	if onCloudRun {
		cfg.AuthRateLimit = authRateLimitPerIP
	}
	apiServer := api.New(cfg)

	mux := http.NewServeMux()
	mux.Handle("/api/", apiServer.Routes())
	mux.Handle("/", staticHandler(*distDir))

	log.Printf("listening on %s", *addr)
	if err := http.ListenAndServe(*addr, mux); err != nil {
		log.Fatal(err)
	}
}
