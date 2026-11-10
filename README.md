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
      live/            即時教學畫面的腳本（JSON，例如 l0/0.0-tools.json；單課資料以 live 欄位指定）、旁白語音清單（*.voice.json）與章節音軌清單（*.mix.json）；不打包進前端，伺服器啟動時讀進資料庫，前端由 GET /api/scripts 取得（見「課程資料庫」）
    live/            即時教學畫面引擎（TypeScript）：舞台 stage.ts、播放器外殼 shell.ts、演員 actors/、鏡頭 camera.ts、動畫工具 kit.ts；規格見 src/live/README.md
    home/            首頁（主題，不放影片）/、主題頁（課程地圖）、展示頁 /showcase（兩支影片預覽，站內沒有連結）
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
cd server && go run ./cmd/server         # API：http://127.0.0.1:8190（未設 DATABASE_URL 時用本機 SQLite shuttle.db；啟動時自動讀 server/.env）
cd web && npm install && npm run dev     # 前端：http://localhost:5190（/api 轉發到 8190）
```

要用 Tailscale 上的其他裝置（例如手機）連開發環境：先啟動 Tailscale，前端改用 `npm run dev:tailscale`（只綁在這台的 Tailscale IP，不開放區網），再用 `http://<Tailscale IP 或 MagicDNS 名稱>:5190` 開啟。後端不用改，`/api` 由前端的 dev server 轉發。

環境變數見 `server/.env.example`（資料庫、JWT、Google 登入、管理員白名單）與 `web/.env.example`（GA4、產生旁白語音用的 `GEMINI_API_KEY`；金鑰寫在不進版控的 `web/.env.local`）。

## 管理後台

- 在研發基地的「會員」標籤 `/studio/members`（舊網址 `/admin` 轉到這裡），API 在 `/api/admin/*`：`me`、`overview`（會員數、訪客數、各課學習人數／看完人數／平均進度、訪客打開次數／人數／播放時間、每個訪客在首頁停留多久）、`users`（會員列表與進度概況）、`users/{id}/progress`（單一會員各課進度）。全部唯讀。`overview` 與 `users` 可加 `?range=30m|12h|1d|7d` 只算這段時間內的資料（沒有或不認得的值是全部；會員數改成這段時間內註冊的，會員列表只列這段時間內註冊或有播放的），後台頁面上方的篩選就是用這個。
- 管理員判定沿用 tripace：沒有獨立的管理員帳號，管理員就是「一般會員 + Email 在白名單內」。白名單是環境變數 `ADMIN_BOOTSTRAP_EMAIL`（可用逗號分隔多個，忽略大小寫），而且必須用 Google 登入（Email 經 Google 驗證）才算管理員，純密碼註冊的帳號不算（密碼註冊不驗證 Email 所有權，否則任何人都能搶註冊成管理員）；任何帳號第一次用 Google 登入綁定時，都會清掉原本的密碼，並讓綁定前發出的登入 cookie 失效，所以先用別人的 Email 註冊的人無法繼續登入（已經綁了另一個 Google 帳號的 Email 不會被別的 Google 帳號覆蓋，回 409）；未設定時沒有任何人是管理員（fail-closed）。每次請求都重新比對，移出白名單立即生效。
- 未登入回 401、已登入但不在白名單回 403；本機用 `-open-studio` 啟動時不檢查（和研發基地一起開放，Cloud Run 上拒絕啟動）。程式在 `server/internal/api/admin.go`、`server/internal/store/admin.go`、`web/src/admin/`。

## 課程資料庫

- 一門課 `courses`（存取方式 `access`：`free`／`login-free`／`subscription`，訂閱課程的最低方案 `tier`）→ 單元 `course_units` → 一堂課 `lessons`（`status`：`open`／`draft`／`planned`；`access` 空的就照這門課，只有例外才填，例如序章免費預覽；`script` 是課程頁要播的腳本、`files` 是這一課其他的腳本檔（子腳本、開場、試做）；`minutes` 是預估學習時間，0 代表還沒估）。草稿（`draft`）只有管理員看得到狀態與腳本，其他人看到的是規劃中。
- 網站上的 9 門課（AI 工具介紹、AI 工具入門、Vibe Coding 入門、AI Agent 整合應用、進階 AI Agent 應用、網頁怎麼運作、給孩子的網頁程式、從做好到上線、Claude Code 工作術）都在資料庫。資料以 `server/internal/store/courses_seed.json` 為準，寫入資料表的時機：正式環境是每次部署時執行一次的課程同步工作（Cloud Run Job `shuttle-course-sync`，執行 `server/cmd/sync`；image 是 Dockerfile 的 `course-sync` 目標，只有這支程式與腳本目錄，不建置前端；寫入失敗就不部署網站），Cloud Run 上的網站伺服器只讀；本機是後端每次啟動時寫入。有寫 `units` 的課程，單元與課整份換成種子的內容。程式在 `server/internal/store/courses.go`、`lessons.go`。
- 單元的 `subtitle` 是課程地圖上單元標題下的小字（兒童課是比喻，網頁怎麼運作是這個單元回答的問題）。
- 公開 API `GET /api/courses/{id}/map` 回傳課程地圖（不用登入，登入功能沒開也能讀，只有沒接資料庫時回 503）。讀它的頁面：
  - 主題的課程地圖：兒童課（`/topics/kids#map`）、網頁怎麼運作（`/topics/web#map`）、從做好到上線（`/topics/launch#map`），畫法共用 `web/src/home/CourseMapUnits.tsx`，讀到之前與讀不到時先用前端內建的同一份資料。
  - 這三個主題的單課頁：能不能上、播哪個腳本、要不要登入都照資料庫（`web/src/home/TopicLessonGate.tsx`）；有頁面的課（路由與 SEO）仍由前端的 `KIDS_OPEN_LESSONS`、`WEB_OPEN_LESSONS`、`LAUNCH_LESSON_PAGES` 決定。
  - AI 工具介紹、AI 工具入門的課程總覽（`/courses/tools`、`/courses/ai-tools`）：每一課的一句話、時間、開放與否、免費預覽。
- 還在前端的：課程與主題的介紹（`levels.ts`、`topics.ts`）、單課頁的內容（步驟、提示詞，`l0Lessons.ts` 等）、`/courses/...` 單課頁要不要登入（`catalog.ts` 的 `requiresLogin`）、規劃中課程的章節頁。課名、一句話、開放狀態、腳本、時間兩邊都有一份，`web/src/content/courseMap.test.ts` 檢查一致。
- 腳本檔：寫入課程資料時（`-live`，預設 `../web/src/content/live`，映像裡是 `/app/live`）把每一課的 `script`、`files` 與同名的 `.voice.json`、`.mix.json` 讀進 `lesson_files`（一個檔一列，記著屬於哪門課的哪一課），其餘的 `.json`（研發基地的 `lab/`、`promo/` 與草稿）讀進 `studio_files`；種子寫到的檔不存在、或兩課寫到同一個檔時寫入失敗（正式環境就是部署失敗）。程式在 `server/internal/store/lessonfiles.go`。
- `GET /api/scripts/{path}` 依所屬那一課把關：免費預覽誰都拿得到、登入後免費要登入（401）、訂閱課程等訂閱功能上線前不給（403）、草稿與規劃中的課只給管理員（其他人 404）；研發基地的檔只給管理員。`GET /api/scripts` 列出所有腳本路徑（只給管理員）。程式在 `server/internal/api/scripts.go`。本機開發時直接讀磁碟上最新的檔案（把關仍照資料庫），改既有的腳本不用重啟；本機新增檔案或改種子要重啟後端。沒接資料庫時照內嵌的種子直接讀檔，只有免登入的課拿得到。
- sitemap 只列已開放的課（`web/src/seo/build.ts` 在建置時讀種子）；草稿與規劃中的課頁面仍可收錄，只是不列入。

## 研發基地的權限

- `/studio`、`/materials`、`/docs` 與打包內容 `/assets/internal/*` 只有管理員能取得（判定條件同上），由 Go server 檢查（`server/cmd/server/static.go`）。未登入開頁面導向 `/login?next=…`；其他沒有權限的請求回 404。
- 內部內容由 `web/src/App.tsx` 延遲載入 `src/studio/StudioApp.tsx`，輸出到 `assets/internal/`。`vite.config.ts` 在 build 時檢查內部模組沒有混進公開檔案；公開頁面只能 import `src/studio/interactive/`，其他 `src/studio/` 底下的模組會讓 build 失敗。內部頁的 SEO 資料在 `src/seo/internalPages.ts`；研發基地的腳本（`lab/`、`promo/`）和課程腳本一樣由 `GET /api/scripts` 取得，只給管理員。
- dev server（5190）也會擋：向本機 Go server（8190）的 `/api/admin/me` 確認，未登入導向登入頁，其他沒有權限的情況顯示找不到頁面；Go server 沒開時一律擋下（`vite.config.ts` 的 `devStudioGate`）。本機要以管理員進入，Go server 要設定 `GOOGLE_OAUTH_CLIENT_ID` 與 `ADMIN_BOOTSTRAP_EMAIL`（寫在 `server/.env`，啟動時自動讀進來；已經在 shell 設定的值優先，`-env=` 不讀，E2E 就是這樣跑；Cloud Run 上不讀）；要略過檢查用 `DEV_OPEN_STUDIO=1 npm run dev`。`npm run record:live` 會帶本機 token（`node_modules/.cache/studio-dev-token`）通過，不用登入。直接跑 Go server 時，需要略過權限可加 `-open-studio`（Cloud Run 上會拒絕啟動）。
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

- 打 `v*` tag 觸發 `.github/workflows/deploy-cloudrun.yml`：先跑完整測試（`test.yml`），通過才 build、執行課程同步工作（寫入課程資料），再部署到 Cloud Run。
- 只改課程內容（`courses_seed.json` 或 `web/src/content/live/` 的腳本）不用打 tag：在 GitHub Actions 選 `dev` 分支手動執行 `sync-courses.yml`（或 `gh workflow run sync-courses.yml --ref dev`；只能從 `dev` 分支執行，其他分支會直接失敗），只跑和課程資料有關的測試（Go 測試、課程一致性測試），用 `dev` 分支 build 課程同步工作的小 image（`shuttle-course-sync:<commit>`），只執行課程同步工作，不部署網站。網站從資料庫讀課程地圖與腳本，課的開放狀態、腳本、時間馬上生效；新增課程頁（前端路由、SEO、課程內容）與程式的修改仍要打 tag 部署。兩個 workflow 共用 `.github/scripts/run-course-sync.sh`，也共用一個執行序，不會同時寫資料庫。
- GitHub repo secrets：`WIF_PROVIDER`、`WIF_SERVICE_ACCOUNT`（Workload Identity Federation，provider `github-provider-vibing` 只允許 `tim72117/evoleap`；repo 改名時要同步更新 provider 的 attribute condition 與 service account 的 workloadIdentityUser 綁定，否則部署會在驗證步驟失敗）；repo variable `GA_MEASUREMENT_ID`（選填，未設定不載入 GA）、`ADSENSE_CLIENT` 與 `ADSENSE_SLOT`（選填，兩個都設定才在課程頁放廣告；AdSense 後台的自動廣告要保持關閉）。
- 登入功能需要資料庫：Cloud Run 上沒有 `DATABASE_URL` 時伺服器自動停用登入，網站其他部分照常運作（課程只有免登入的課能播，課程地圖改用前端內建的資料）。
  - Cloud SQL：與 tripace 共用實例 `onagent-prod:asia-east1:onagent-db`，資料庫 `evoleap`、使用者 `evoleap_app`。實例上的 `shuttle`、`shuttle_app` 是 tripace 的正式資料，不可使用。
  - Secret Manager（專案 shuttle-045094509）：`EVOLEAP_DATABASE_URL`、`EVOLEAP_JWT_SECRET`、`EVOLEAP_GOOGLE_OAUTH_CLIENT_ID`、`EVOLEAP_ADMIN_BOOTSTRAP_EMAIL`，都要開放 Cloud Run 執行帳號讀取。deploy workflow 會引用這些機密，缺任何一個部署都會失敗。

## 測試

```bash
cd server && go test ./...     # Go：靜態頁面／SEO 路由、登入 API、播放進度 API
cd web && npm run check        # 型別檢查 → 單元測試（vitest）→ build → E2E（Playwright，對正式 build）
```

每次 push 都會在 GitHub Actions 跑同一套測試。
