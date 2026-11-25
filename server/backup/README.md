# 腳本備份(GCS)

資料庫(`lesson_files`、`studio_files`,含 `.voice.json`、`.mix.json`)的內容每次備份一份到 `gs://evoleap-backup`(專案 `shuttle-045094509`,asia-east1,開物件版本控制、舊版本 30 天後刪)。
GCS 只是備份副本,資料庫與網站讀取方式不變。`gcs-manifest.json` 是專案裡的路徑對照表。

## 產生方式

`powershell -File backup/export.ps1 -Cli <evoleap.exe>`(在 `server/` 底下;CLI 要先 `evoleap login`,線上要已部署 `GET /api/admin/script-export`)。
流程:`evoleap backup export` 唯讀匯出 → 只上傳內容有變的檔(沒變不重傳,不產生新版本)→ 更新 `gcs-manifest.json` → 上傳 `manifest/<時間戳>.json` 與 `manifest/latest.json`。
可選參數:`-Prefix`(物件前綴,預設空=正式;測試用 `_test/<時間戳>/`,manifest 也跟著前綴走)、`-ManifestPath`(對照表輸出位置)、`-Api`(傳給 evoleap 的 -api,測試用本機後端)。gcloud 每次呼叫很慢,所以有變的檔會先放暫存目錄、每個來源一次 `cp -r` 上傳。腳本檔要有 UTF-8 BOM(Windows PowerShell 5.1 才不會把中文讀壞)。
所有 gcloud 指令都明確帶 `--project=shuttle-045094509`。對照表依來源、路徑排序;`exportedAt` 是該檔內容上次變更並上傳的時間,所以內容沒變時對照表沒有 diff。

## 物件路徑

- `scripts/lesson/<路徑>`:`lesson_files`(屬於某一課)
- `scripts/studio/<路徑>`:`studio_files`(研發基地)
- `manifest/<時間戳>.json`、`manifest/latest.json`

路徑含 `/` 照原樣,同一路徑每次覆蓋,歷史交給 bucket 版本控制。

## 取回單檔

```
gcloud storage cp --project=shuttle-045094509 gs://evoleap-backup/scripts/lesson/l0/0.0-tools.json ./
# 指定舊版本(generation 見 gcloud storage ls -a)
gcloud storage cp --project=shuttle-045094509 "gs://evoleap-backup/scripts/lesson/l0/0.0-tools.json#<generation>" ./
```

還原回資料庫用 `evoleap script push`(不在這個流程內)。
