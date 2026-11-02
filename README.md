# Shuttle 課程網站

從零基礎開始的 AI 課程地圖（https://shuttle.tools），以及課程研發用的內部工作區。

## 專案結構

```
web/                 前端（React + Vite + TypeScript）
  src/
    content/         課程資料（唯一來源，公開頁、研發區、SEO 都從這裡讀）
      levels.ts        課程地圖的等級（L0–L4）、首頁文案
      catalog.ts       每門課的章節與網址（新增課程在這裡登記）
      l0Lessons.ts     L0 單課內容：目標 → 步驟 → 提示詞、影片切分
      l1Lessons.ts     L1 單課內容
      l2Outline.ts     L2 章節大綱（尚未寫到步驟）
      aiAgent.ts       L3 課程頁內容
      lessonTypes.ts   單課資料型別
      live/            即時教學畫面的腳本（JSON，例如 l0/0.0-tools.json；單課資料以 live 欄位指定）與旁白語音清單（*.voice.json）
    live/            即時教學畫面引擎（TypeScript）：舞台 stage.ts、播放器外殼 shell.ts、演員 actors/、鏡頭 camera.ts、動畫工具 kit.ts；規格見 src/live/README.md
    home/            首頁（課程地圖）/
    courses/         課程頁 /courses/*：總覽、上課頁（即時教學畫面或預覽大綱＋步驟）、規劃中章節頁
    auth/            登入頁 /login、使用者選單、登入狀態
    legal/           隱私權政策 /privacy、服務條款 /terms
    site/            共用版型、404、全站樣式、GA4、複製按鈕等
    seo/             每個網址的 SEO 資料（見下方「SEO」）
    studio/          課程研發工作區（內部頁，不列入搜尋）
      proposal/        課程提案 /proposal/*（依等級分章節；L0–L2 大綱與製作規劃在 basicsData.ts；即時教學畫面預覽 /proposal/visuals/preview）
      articles/        研究文章 /docs/*
      docs/            Markdown 文件頁 /docs/*（即時教學畫面規格、錄製工具說明）；文件列表在總覽頁 /proposal#docs
      materials/       工具總覽 /materials、封面設計與裁切工具 /materials/*
      recorder/        宣傳影片錄製工具：npm run record（JSON 分鏡腳本 → 1080p mp4）
  scripts/seo.mjs    build 後產生各頁 HTML、sitemap.xml、robots.txt
  scripts/voice.mjs  npm run voice：用 Gemini TTS 產生旁白語音，上傳到 GCS gs://shuttle-voice（見 src/live/README.md「旁白語音」）
server/              後端（Go）：/api/*（含登入）＋以 go:embed 提供前端
  cmd/server/          進入點、靜態檔與 SEO 頁面的伺服
  internal/api/        HTTP 端點
  internal/auth/       JWT、密碼雜湊、Google ID Token 驗證
  internal/store/      資料庫（正式 Cloud SQL Postgres，本機 SQLite）
Dockerfile           多階段建置：前端 build → Go 編譯 → distroless 映像
.github/workflows/   打 v* tag 時部署到 Cloud Run（shuttle-server，asia-east1）
```

## 本機開發

本機 port 用 5190／8190，避開其他專案常用的 5173–5179、8080–8082。

```bash
cd server && go run ./cmd/server         # API：http://127.0.0.1:8190（未設 DATABASE_URL 時用本機 SQLite shuttle.db）
cd web && npm install && npm run dev     # 前端：http://localhost:5190（/api 轉發到 8190）
```

環境變數見 `server/.env.example`（資料庫、JWT、Google 登入）與 `web/.env.example`（GA4、產生旁白語音用的 `GEMINI_API_KEY`；金鑰寫在不進版控的 `web/.env.local`）。

## SEO

- 唯一來源：`web/src/seo/pages.ts`。課程與章節從 `src/content/catalog.ts`、文章從 `src/studio/articles/registry.ts`／`src/studio/docs/registry.ts` 自動推導；新增其他頁面時在 `PAGES` 加一筆（漏了 build 會失敗並列出缺少的路由）。
- `npm run build` 最後一步 `node scripts/seo.mjs`：產生 `dist/<路由>/index.html`（title、description、canonical、og:*、twitter:*、JSON-LD）、`dist/404.html`、`sitemap.xml`、`robots.txt`。開發時 `/sitemap.xml`、`/robots.txt` 由 Vite 即時產生。
- 公開頁：`/`、`/courses/*`、`/privacy`、`/terms`。內部頁 `/docs*`、`/proposal*`、`/materials*` 與 `/login`：noindex（meta + `X-Robots-Tag`）、不列入 sitemap。
- Go server（`server/cmd/server/static.go`）：頁面回傳對應的 HTML（`Cache-Control: no-cache` + ETag），未知路由回 404 + `404.html`，結尾斜線 301 到不帶斜線的網址；`/assets/*` 一年 immutable 快取。
- 預設分享圖 `web/public/og-default.png`（1200×630），原始檔 `web/scripts/og-image.html`。

## 部署

```bash
git tag -a v0.1.0 -m "..." && git push origin v0.1.0
```

- 打 `v*` tag 觸發 `.github/workflows/deploy-cloudrun.yml`：先跑完整測試（`test.yml`），通過才 build 並部署到 Cloud Run。
- GitHub repo secrets：`WIF_PROVIDER`、`WIF_SERVICE_ACCOUNT`（Workload Identity Federation，provider `github-provider-vibing` 只允許 `tim72117/shuttle`；repo 改名時要同步更新 provider 的 attribute condition 與 service account 的 workloadIdentityUser 綁定，否則部署會在驗證步驟失敗）；repo variable `GA_MEASUREMENT_ID`（選填，未設定不載入 GA）。
- 登入功能目前停用：Cloud Run 上沒有 `DATABASE_URL` 時伺服器自動停用登入，網站其他部分照常運作。要啟用時：
  - Cloud SQL：與 tripace 共用實例 `onagent-prod:asia-east1:onagent-db`，建立資料庫 `shuttle`。
  - Secret Manager（專案 shuttle-045094509）：`SHUTTLE_DATABASE_URL`、`SHUTTLE_JWT_SECRET`、`SHUTTLE_GOOGLE_OAUTH_CLIENT_ID`。
  - 在 deploy workflow 加上 `--add-cloudsql-instances` 與 `--update-secrets`（參數寫在該步驟的註解裡）。

## 測試

```bash
cd server && go test ./...     # Go：靜態頁面／SEO 路由、登入 API
cd web && npm run check        # 型別檢查 → 單元測試（vitest）→ build → E2E（Playwright，對正式 build）
```

每次 push 都會在 GitHub Actions 跑同一套測試。
