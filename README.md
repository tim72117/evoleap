# Shuttle 課程網站

從零基礎開始的 AI 課程地圖（https://evoleap.io），以及研發基地用的內部工作區。

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
    courses/         全部課程 /courses、課程頁 /courses/*：總覽、上課頁（即時教學畫面或預覽大綱＋步驟）、規劃中章節頁；播放進度（只有登入的會員才記）
    auth/            登入頁 /login、使用者選單、登入狀態
    admin/           管理後台元件，放在研發基地的「會員」標籤 /studio/members（/admin 轉到這裡；只有白名單內的管理員，本機 -open-studio 不檢查；會員、播放進度與訪客上課紀錄，唯讀）
    legal/           隱私權政策 /privacy、服務條款 /terms、退款政策 /refund
    site/            共用版型、404、全站樣式、GA4、複製按鈕等
    seo/             每個網址的 SEO 資料（見下方「SEO」）
    studio/          研發基地（內部頁，限管理員，不列入搜尋）
      proposal/        課程提案 /studio/*（依等級分章節；L0–L2 大綱與製作規劃在 basicsData.ts；各課的即時教學畫面直接在研發基地頁播放）
      articles/        研究文章 /docs/*
      docs/            Markdown 文件頁 /docs/*（即時教學畫面規格、錄製工具說明）；文件列表在總覽頁 /studio#docs
      materials/       工具總覽 /materials、宣傳影片 /materials/promo（即時教學畫面播放與逐格輸出掛鉤）、封面設計與裁切工具 /materials/*
      recorder/        宣傳影片錄製工具（舊版 v1 分鏡腳本）：npm run record（JSON 分鏡腳本 → 1080p mp4）
  scripts/seo.mjs    build 後產生各頁 HTML、sitemap.xml、robots.txt
  scripts/voice.mjs  npm run voice：用 Gemini TTS 產生旁白語音，上傳到 GCS gs://shuttle-voice（見 src/live/README.md「旁白語音」）
  scripts/record-live.mjs  npm run record:live -- promo/xxx.json：把即時教學畫面的宣傳影片腳本（src/content/live/promo/）逐格錄成 1080p mp4 與 .srt，有旁白語音時混入音軌，輸出到 recordings/promo/（--from/--to 毫秒只錄一段）
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

- 在研發基地的「會員」標籤 `/studio/members`（舊網址 `/admin` 轉到這裡），API 在 `/api/admin/*`：`me`、`overview`（會員數、訪客數、各課學習人數／看完人數／平均進度、訪客打開次數／人數／播放時間）、`users`（會員列表與進度概況）、`users/{id}/progress`（單一會員各課進度）。全部唯讀。
- 管理員判定沿用 tripace：沒有獨立的管理員帳號，管理員就是「一般會員 + Email 在白名單內」。白名單是環境變數 `ADMIN_BOOTSTRAP_EMAIL`（可用逗號分隔多個，忽略大小寫），而且必須用 Google 登入（Email 經 Google 驗證）才算管理員，純密碼註冊的帳號不算（密碼註冊不驗證 Email 所有權，否則任何人都能搶註冊成管理員）；任何帳號第一次用 Google 登入綁定時，都會清掉原本的密碼，並讓綁定前發出的登入 cookie 失效，所以先用別人的 Email 註冊的人無法繼續登入（已經綁了另一個 Google 帳號的 Email 不會被別的 Google 帳號覆蓋，回 409）；未設定時沒有任何人是管理員（fail-closed）。每次請求都重新比對，移出白名單立即生效。
- 未登入回 401、已登入但不在白名單回 403；本機用 `-open-studio` 啟動時不檢查（和研發基地一起開放，Cloud Run 上拒絕啟動）。程式在 `server/internal/api/admin.go`、`server/internal/store/admin.go`、`web/src/admin/`。

## 研發基地的權限

- `/studio`、`/materials`、`/docs` 與打包內容 `/assets/internal/*` 只有管理員能取得（判定條件同上），由 Go server 檢查（`server/cmd/server/static.go`）。未登入開頁面導向 `/login?next=…`；其他沒有權限的請求回 404。
- 內部內容由 `web/src/App.tsx` 延遲載入 `src/studio/StudioApp.tsx`，輸出到 `assets/internal/`。`vite.config.ts` 在 build 時檢查內部模組沒有混進公開檔案；公開頁面只能 import `src/studio/interactive/`，其他 `src/studio/` 底下的模組會讓 build 失敗。內部頁的 SEO 資料在 `src/seo/internalPages.ts`，`lab/`、`promo/` 腳本由 StudioApp 註冊。
- dev server（5190）也會擋：向本機 Go server（8190）的 `/api/admin/me` 確認，未登入導向登入頁，其他沒有權限的情況顯示找不到頁面；Go server 沒開時一律擋下（`vite.config.ts` 的 `devStudioGate`）。本機要以管理員進入，Go server 要設定 `GOOGLE_OAUTH_CLIENT_ID` 與 `ADMIN_BOOTSTRAP_EMAIL`；要略過檢查用 `DEV_OPEN_STUDIO=1 npm run dev`。`npm run record:live` 會帶本機 token（`node_modules/.cache/studio-dev-token`）通過，不用登入。直接跑 Go server 時，需要略過權限可加 `-open-studio`（Cloud Run 上會拒絕啟動）。
- E2E 開兩台 server：8198 加 `-open-studio` 測內部頁功能，8199 照正式設定測權限（`web/e2e/studio-access.spec.ts`）。管理員必須用 Google 登入，E2E 做不到，管理員可進入的部分由 Go 測試涵蓋。

## SEO

- 唯一來源：`web/src/seo/pages.ts`（公開頁）、`web/src/seo/internalPages.ts`（內部頁）。課程與章節從 `src/content/catalog.ts`、文章從 `src/studio/articles/registry.ts`／`src/studio/docs/registry.ts` 自動推導；新增其他頁面時在 `PAGES` 加一筆（漏了 build 會失敗並列出缺少的路由）。
- `npm run build` 最後一步 `node scripts/seo.mjs`：產生 `dist/<路由>/index.html`（title、description、canonical、og:*、twitter:*、JSON-LD）、`dist/404.html`、`sitemap.xml`、`robots.txt`。開發時 `/sitemap.xml`、`/robots.txt` 由 Vite 即時產生。
- 公開頁：`/`、`/topics/*`、`/courses`、`/courses/*`、`/privacy`、`/terms`、`/refund`。內部頁 `/docs*`、`/studio*`、`/materials*` 與 `/login`：noindex（meta + `X-Robots-Tag`）、不列入 sitemap。
- Go server（`server/cmd/server/static.go`）：頁面回傳對應的 HTML（`Cache-Control: no-cache` + ETag），未知路由回 404 + `404.html`，結尾斜線 301 到不帶斜線的網址；`/assets/*` 一年 immutable 快取。
- 預設分享圖 `web/public/og-default.png`（1200×630），原始檔 `web/scripts/og-image.html`。

## 部署

```bash
git tag -a v0.1.0 -m "..." && git push origin v0.1.0
```

- 打 `v*` tag 觸發 `.github/workflows/deploy-cloudrun.yml`：先跑完整測試（`test.yml`），通過才 build 並部署到 Cloud Run。
- GitHub repo secrets：`WIF_PROVIDER`、`WIF_SERVICE_ACCOUNT`（Workload Identity Federation，provider `github-provider-vibing` 只允許 `tim72117/evoleap`；repo 改名時要同步更新 provider 的 attribute condition 與 service account 的 workloadIdentityUser 綁定，否則部署會在驗證步驟失敗）；repo variable `GA_MEASUREMENT_ID`（選填，未設定不載入 GA）。
- 登入功能需要資料庫：Cloud Run 上沒有 `DATABASE_URL` 時伺服器自動停用登入，網站其他部分照常運作。
  - Cloud SQL：與 tripace 共用實例 `onagent-prod:asia-east1:onagent-db`，資料庫 `evoleap`、使用者 `evoleap_app`。實例上的 `shuttle`、`shuttle_app` 是 tripace 的正式資料，不可使用。
  - Secret Manager（專案 shuttle-045094509）：`EVOLEAP_DATABASE_URL`、`EVOLEAP_JWT_SECRET`、`EVOLEAP_GOOGLE_OAUTH_CLIENT_ID`、`EVOLEAP_ADMIN_BOOTSTRAP_EMAIL`，都要開放 Cloud Run 執行帳號讀取。deploy workflow 會引用這些機密，缺任何一個部署都會失敗。

## 測試

```bash
cd server && go test ./...     # Go：靜態頁面／SEO 路由、登入 API、播放進度 API
cd web && npm run check        # 型別檢查 → 單元測試（vitest）→ build → E2E（Playwright，對正式 build）
```

每次 push 都會在 GitHub Actions 跑同一套測試。
