# Changelog

格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)；版號採語意化版本（0.x 階段：不相容變更升 minor）。

## [0.1.0] - 2026-10-30

第一個可部署版本：把原本的課程提案靜態頁與 Markdown 文件，改成 React 前端 + Go 後端的課程網站（shuttle.tools）。

### 新增

- **課程網站**（`web/`，React + Vite + TypeScript）
  - 首頁課程地圖：L0 起步 → L1 零基礎 → L2 基礎 → L3 中階 → L4 進階，每級一張圖卡（簡述、課程內容、存取方式）。
  - 課程頁 `/courses/*`：每門課的總覽、上課頁、規劃中章節頁；課程資料集中在 `web/src/content/`。
  - 上課頁：影片與操作步驟同一畫面；影片播到哪一步就展開哪一步，提示詞可一鍵複製；←／→ 切換步驟。尚未上傳 YouTube 影片的課以模擬播放器呈現。
  - 登入：Email＋密碼與 Google 登入（HttpOnly cookie）、登入頁 `/login`、使用者選單。伺服器沒有設定資料庫時自動停用。
  - 隱私權政策 `/privacy`、服務條款 `/terms`（營運者名稱、聯絡信箱、管轄法院待填）。
  - GA4（設定 `VITE_GA_MEASUREMENT_ID` 才載入；內部頁不送 page view）。
  - 課程研發工作區 `web/src/studio/`：課程提案 `/proposal/*`（依等級分章節，L0／L1 單課內容、L2 大綱含單元 9–13）、研究文章 `/docs/*`、封面工具 `/materials/*`。
- **SEO**：每個網址各自的 title、description、canonical、Open Graph、JSON-LD，build 時預先產生各頁 HTML、`sitemap.xml`、`robots.txt`；內部頁 noindex（meta 與 `X-Robots-Tag`）且不列入 sitemap。
- **後端**（`server/`，Go）：以 go:embed 提供前端 build（各頁 HTML、真正的 404、結尾斜線 301、資產長期快取）；`/api/*` 登入 API；資料庫正式環境 Cloud SQL Postgres、本機 SQLite；`-dist` 參數可直接提供磁碟上的 build。
- **測試**：Go 單元測試、vitest 單元測試（課程資料、網址、SEO 規則）、Playwright E2E（對正式 build 逐頁檢查 SEO、導覽、上課頁、登入流程）；`npm run check` 一次跑完。
- **CI/CD**：`.github/workflows/test.yml` 每次 push 跑完整測試；`deploy-cloudrun.yml` 打 `v*` tag 時先跑測試，通過才部署到 Cloud Run（`shuttle-server`，asia-east1）。
- `tools/video/`：募資影片錄製工具（由原本根目錄的 `video/` 搬入）。

### 移除

- 原本的靜態頁 `proposal/*.html`、`materials/*.html` 與根目錄的 Markdown 文件（內容已改寫為 `web/` 內的頁面）。
- 未使用的素材圖檔（`materials/*.png`）。
