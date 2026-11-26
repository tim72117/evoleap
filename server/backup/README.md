# 腳本備份(GCS)

資料庫(`lesson_files`、`studio_files`,含 `.voice.json`、`.mix.json`)的內容每次備份一份到 `gs://evoleap-backup`(專案 `shuttle-045094509`,asia-east1,開物件版本控制、舊版本 30 天後刪)。
GCS 只是備份副本,資料庫與網站讀取方式不變。`gcs-manifest.json` 是專案裡的路徑對照表。

## 產生方式

在專案根目錄(Mac、Linux、CI;不支援 Windows;需要 Node 與已登入的 gcloud):

```
node server/backup/gcs.mjs export
```

前提:evoleap 已用管理員登入(`evoleap login`),線上已部署 `GET /api/admin/script-export` 與 `GET /api/admin/catalog-export`。沒給 `--cli <evoleap 執行檔>` 時用 `go run ./cmd/evoleap`。
流程:`evoleap backup export` 唯讀匯出 → 只上傳內容有變的檔(沒變不重傳,不產生新版本)→ 更新 `gcs-manifest.json` → 上傳 `manifest/<時間戳>.json` 與 `manifest/latest.json`。
可選參數:`--prefix`(物件前綴,預設空=正式;測試用 `_test/<時間戳>/`,對照表要另用 `--manifest` 指定)、`--api`(傳給 evoleap 的 -api,測試用本機後端)、`--cli`。gcloud 每次呼叫很慢,所以有變的檔會先放暫存目錄、每個來源一次 `cp -r` 上傳。
所有 gcloud 指令都明確帶 `--project=shuttle-045094509`。對照表依來源、路徑排序;`exportedAt` 是該檔內容上次變更並上傳的時間,所以內容沒變時對照表沒有 diff。

## 物件路徑

- `scripts/lesson/<路徑>`:`lesson_files`(屬於某一課)
- `scripts/studio/<路徑>`:`studio_files`(研發基地)
- `manifest/<時間戳>.json`、`manifest/latest.json`

路徑含 `/` 照原樣,同一路徑每次覆蓋,歷史交給 bucket 版本控制。

## 手動初始化空資料庫

部署與啟動不會自動寫入課程資料。空資料庫要由管理員執行(先 `evoleap login`;本機後端加 `--api http://127.0.0.1:8190`):

```
node server/backup/gcs.mjs init
```

讀 `catalog/latest.json`(主題、課程、單元、課;`export` 時一併上傳)與 `manifest/latest.json` 列的腳本,經 `POST /api/admin/init` 寫入。資料庫已有課程時拒絕。

課程資訊包含英文譯文(不含修改歷史)。

## 整批還原

```
node server/backup/gcs.mjs restore
```

照 `gcs-manifest.json` 的版本號下載、核對 sha256,寫到 `web/recordings/live-restore/`(不進版控,`--out` 可換目錄)。線上資料庫是腳本的唯一來源;新站復原用上面的 `init`。
本機已有且內容不同的檔不覆蓋(列出清單、結束碼 2),要覆蓋加 `--force`。同一路徑在 lesson 與 studio 各有一份時以 lesson 為準。

## 取回單檔

```
gcloud storage cp --project=shuttle-045094509 gs://evoleap-backup/scripts/lesson/l0/0.0-tools.json ./
# 指定舊版本(generation 見 gcloud storage ls -a)
gcloud storage cp --project=shuttle-045094509 "gs://evoleap-backup/scripts/lesson/l0/0.0-tools.json#<generation>" ./
```

取回的檔要寫回既有站台時用 `evoleap script push -file … -path …`(不在這個流程內)。
