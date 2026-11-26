// sync 是部署時的同步工作:建表,重算翻譯登記表。
// 不寫新的主題、課程、單元、課與腳本(以資料庫為準;連線時只把舊格式的主題內容拆進新欄位);新站只用備份復原:空資料庫手動初始化(node server/backup/gcs.mjs init)。
//
// 正式環境:每次部署(deploy-cloudrun.yml)與從 dev 分支手動同步(sync-courses.yml)時,
// 以 Cloud Run Job(shuttle-course-sync)執行一次;映像是 Dockerfile 的 course-sync 目標,只有這支程式。
// Cloud Run 上的網站伺服器只讀,不寫課程資料。
//
// 本機:go run ./cmd/sync(預設寫進 shuttle.db,和 cmd/server 相同);本機的網站伺服器啟動時也會寫,通常不用另外跑。
package main

import (
	"context"
	"flag"
	"log"
	"os"

	"github.com/tim72117/evoleap/internal/store"
)

func main() {
	dbPath := flag.String("db", "shuttle.db", "DATABASE_URL 未設定時寫入的本機 SQLite 檔案")
	flag.Parse()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Cloud Run Job 上一定要有資料庫機密,不能寫進容器裡的暫存檔還顯示成功
		if os.Getenv("CLOUD_RUN_JOB") != "" {
			log.Fatal("寫入課程資料需要 DATABASE_URL")
		}
		dsn = *dbPath
	}
	st, err := store.Connect(dsn)
	if err != nil {
		log.Fatal(err)
	}
	if err := st.SyncCourses(context.Background()); err != nil {
		log.Fatal(err)
	}
	log.Print("資料庫結構與翻譯登記表已同步")
}
