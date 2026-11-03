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
      live/            即時教學畫面的腳本（JSON，例如 l0/0.0-tools.json；單課資料以 live 欄位指定）、旁白語音清單（*.voice.json）與章節音軌清單（*.mix.json）
    live/            即時教學畫面引擎（TypeScript）：舞台 stage.ts、播放器外殼 shell.ts、演員 actors/、鏡頭 camera.ts、動畫工具 kit.ts；規格見 src/live/README.md
    home/            首頁（主題）、主題頁（課程地圖）/
    courses/         課程頁 /courses/*：總覽、上課頁（即時教學畫面或預覽大綱＋步驟）、規劃中章節頁；播放進度（只有登入的會員才記）
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
  scripts/mix.mjs    npm run mix：把連續的旁白依時間軸合成章節音軌（手機播放不斷續），--publish 上傳到 gs://shuttle-voice/mix/
server/              後端（Go）：/api/*（含登入與播放進度）＋以 go:embed 提供前端
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

要用 Tailscale 上的其他裝置（例如手機）連開發環境：先啟動 Tailscale，前端改用 `npm run dev:tailscale`（只綁在這台的 Tailscale IP，不開放區網），再用 `http://<Tailscale IP 或 MagicDNS 名稱>:5190` 開啟。後端不用改，`/api` 由前端的 dev server 轉發。

環境變數見 `server/.env.example`（資料庫、JWT、Google 登入、管理員白名單）與 `web/.env.example`（GA4、產生旁白語音用的 `GEMINI_API_KEY`；金鑰寫在不進版控的 `web/.env.local`）。

## 管理後台

- 網址 `/admin`（noindex），API 在 `/api/admin/*`：`me`、`overview`（會員數、各課學習人數／看完人數／平均進度）、`users`（會員列表與進度概況）、`users/{id}/progress`（單一會員各課進度）。全部唯讀。
- 管理員判定沿用 tripace：沒有獨立的管理員帳號，管理員就是「一般會員 + Email 在白名單內」。白名單是環境變數 `ADMIN_BOOTSTRAP_EMAIL`（可用逗號分隔多個，忽略大小寫），而且必須用 Google 登入（Email 經 Google 驗證）才算管理員，純密碼註冊的帳號不算（密碼註冊不驗證 Email 所有權，否則任何人都能搶註冊成管理員）；若白名單的 Email 先前被人以密碼註冊，管理員第一次用 Google 登入時會綁定到同一個帳號並清掉那組密碼（一般會員綁定 Google 不會清密碼；已經綁了另一個 Google 帳號的 Email 不會被別的 Google 帳號覆蓋，回 409）。已知限制：搶註冊的人在綁定之前就拿到的登入 cookie（30 天有效）不會失效，所以部署後台前，先確認白名單的 Email 已經自己註冊並用 Google 登入過；未設定時沒有任何人是管理員（fail-closed）。每次請求都重新比對，移出白名單立即生效。
- 未登入回 401、已登入但不在白名單回 403。程式在 `server/internal/api/admin.go`、`server/internal/store/admin.go`、`web/src/admin/`。

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
cd server && go test ./...     # Go：靜態頁面／SEO 路由、登入 API、播放進度 API
cd web && npm run check        # 型別檢查 → 單元測試（vitest）→ build → E2E（Playwright，對正式 build）
```

每次 push 都會在 GitHub Actions 跑同一套測試。
