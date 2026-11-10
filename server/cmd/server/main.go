// Command server 啟動 Shuttle 教學網站的 HTTP 服務(API + 內嵌前端)。
package main

import (
	"context"
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
	openStudio := flag.Bool("open-studio", false, "不檢查內部頁(研發基地)與管理後台的權限,只給本機與 E2E 測試用;Cloud Run 上會拒絕啟動")
	liveDir := flag.String("live", "../web/src/content/live", "課程腳本檔的目錄(web/src/content/live);本機啟動時把 courses_seed.json 寫到的檔案讀進資料庫,沒接資料庫時直接從這裡讀")
	envFile := flag.String("env", ".env", "本機開發時從這個檔案補上還沒設定的環境變數(Google 登入、管理員等);空字串不讀。Cloud Run 上不讀")
	flag.Parse()

	// 本機:先讀 .env,下面的 os.Getenv 才拿得到(不用每次手動 source);E2E 傳 -env= 不讀,和 CI 一樣
	if *envFile != "" && os.Getenv("K_SERVICE") == "" {
		n, err := loadDotEnv(*envFile)
		if err != nil {
			log.Fatalf("讀取 %s 失敗:%v", *envFile, err)
		}
		if n > 0 {
			log.Printf("從 %s 載入 %d 個環境變數", *envFile, n)
		}
	}

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
	if onCloudRun && *openStudio {
		log.Fatal("正式環境不能使用 -open-studio")
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" && !onCloudRun {
		dsn = *dbPath
	}
	cfg := api.Config{
		GoogleClientID: os.Getenv("GOOGLE_OAUTH_CLIENT_ID"),
		SecureCookie:   onCloudRun,
		AdminEmails:    os.Getenv("ADMIN_BOOTSTRAP_EMAIL"),
		// -open-studio 時管理後台也不檢查權限(研發基地與 /admin 一起開放,只給本機開發用)
		OpenAdmin:  *openStudio,
		ScriptsDir: *liveDir,
	}
	if !onCloudRun {
		cfg.LiveDir = *liveDir
	}
	if dsn == "" {
		log.Print("未設定 DATABASE_URL:登入功能停用")
	} else {
		// Cloud Run 上只讀:課程資料由部署時的同步工作補進去(cmd/sync)。本機每次啟動補一次種子新加的課程、單元、課與腳本檔;
		// 已經有的不會被種子蓋掉(資料庫為準),要整份換成種子的內容就刪掉 shuttle.db 再啟動
		var st *store.Store
		var err error
		if onCloudRun {
			st, err = store.Connect(dsn)
		} else {
			st, err = store.Open(dsn)
			if err == nil {
				err = st.SyncLessonFiles(context.Background(), *liveDir)
			}
		}
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
	access := accessFunc(apiServer.InternalAccess)
	if *openStudio {
		access = openAccess
	}
	mux.Handle("/", staticHandler(*distDir, access))

	log.Printf("listening on %s", *addr)
	if err := http.ListenAndServe(*addr, mux); err != nil {
		log.Fatal(err)
	}
}
