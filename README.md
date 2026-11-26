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
      live/            腳本用到的網頁素材（<課程>/site/<版本>/）；腳本 JSON 不在 repo，以線上資料庫為準（見「課程資料庫」）
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
  scripts/seo.mjs    build 後產生各頁 HTML（課程頁只留空位）、course-pages.json、sitemap-pages.json（可收錄的頁面清單）、robots.txt
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
- 網站上的 7 門課（做出自己的軟體〔課程 id `software`，起步、零基礎、基礎三個階段是它的三個單元〕、AI Agent 整合應用、進階 AI Agent 應用、網頁怎麼運作、給孩子的網頁程式、從做好到上線、Claude Code 工作術）都在資料庫。**主題、課程與腳本以資料庫為準**：部署與啟動都不寫課程資料；空資料庫由管理員執行 `node server/backup/gcs.mjs init`，從 GCS 備份手動初始化（見 `server/backup/README.md`）；課程、單元、課的新增、修改、刪除、排序用 `evoleap` CLI（`course create|set|delete|order|outline`、`unit add|set|delete`、`lesson add|set|delete`）。部署時執行一次同步工作（Cloud Run Job `shuttle-course-sync`，執行 `server/cmd/sync`；失敗就不部署網站），只建表、重算翻譯登記表（不寫腳本）；本機後端啟動時做同樣的事。repo 裡沒有課程種子檔；測試用手寫的小型資料 `server/internal/store/fixture/`（不是正式站內容的複本：每種行為放一兩課代表就好；e2e 以 `server -seed internal/store/fixture` 初始化，手造的範例腳本在 `fixture/live/`）。程式在 `server/internal/store/catalog.go`、`courses.go`、`lessons.go`。
- 主題（`topics` 表）：一門課屬於一個主題（`courses.topic_id`；`overview` 為假表示這門課沒有自己的總覽頁 `/courses/<id>`，例如 ai-agent）。主題有名稱、標語、主題頁網址（`path`）、搜尋標題與描述，以及放首頁卡片與主題頁內容的 JSON 欄位 `content`。公開 `GET /api/topics`、`GET /api/courses`（全部課程頁依它分組）；管理員 `evoleap topic list|show|set`、`evoleap course set -topic-id -overview`。目前沒有新增、刪除主題的指令。目前只有全部課程頁讀這兩支 API，首頁、主題頁、SEO 仍讀前端的 `topics.ts`。
- 單元的 `subtitle` 是課程地圖上單元標題下的小字（兒童課是比喻，網頁怎麼運作是這個單元回答的問題）。單元的 `label` 是簡短名稱（做出自己的軟體的階段：起步、零基礎、基礎，≤32 字，空的用 `title`）；`hidden` 為真代表先不公開：課程總覽、課程地圖、sitemap 不列這個單元，單元裡各課的網址仍打得開（noindex）。
- 課程資訊（課程總覽頁、課程列表要顯示的內容，前端讀這裡，不再自己寫一份；課程頁的搜尋標題、描述、先不公開的單元也由 server 請求時讀這裡，見下方「SEO」）存在 `courses`：`summary` 簡介（≤500 字）、`about` 說明段落（資料庫是一個文字欄位、段落以空行（兩個換行字元）隔開；種子與 API 是字串陣列，每段不能空、不能含空行）、`seoTitle` 搜尋結果標題（≤200）、`description` 搜尋結果描述（≤500）、`art` 插圖樣式（空的、`tools`、`chat`、`build`、`agent`、`advanced`）、`introScript` 課程簡介影片的腳本路徑（腳本路徑，`.json`，不能以 `lab/` 開頭、不能含 `..`、≤200；種子目前只有兒童課 `guide/kids.json`）。`GET /api/courses/{id}/map` 的課程多這幾個欄位（空的省略），單元多 `label`、`hidden`。簡介影片的檔屬於這門課（`lesson_files`，課號是空的），任何訪客都拿得到、狀態視為 open、免費，不受兒童模式的上課時段與進度把關；一個檔只能是一課的檔或簡介影片，不能兩者都是。
- 課程資訊的翻譯（課程、單元、課、主題；目前只有英文 `en`）存在資料庫的通用欄位表，**以資料庫為準**：原表（`courses`、`course_units`、`lessons`、`topics`）只存繁體中文原文，是唯一真實來源。`i18n_sources` 是可翻譯欄位的登記表（原文索引，主鍵 `kind, ref, path`，附原文雜湊；由課程同步工作與改課程資料的 CLI 動作一併重算，原文被刪時軟刪除 `removed_at`；副本不參與顯示，可重建）；`i18n_translations` 是譯文（一個欄位一列，主鍵 `kind, ref, path, lang`，`status` 為 `draft`／`reviewed`／`published`，只有 `published` 會顯示；`source_hash` 是翻譯當時的原文雜湊，和登記表現在的不同就是過時，仍顯示舊譯文）；`i18n_translation_history` 每次異動一筆；`i18n_languages` 是語言（`en` 公開、回退到原文）。公開 API 的 `?lang=en` 由後端用已發布的譯文組成語言包（記憶體快取 30 秒、本行程寫入時立即失效）。程式裡沒有內嵌的譯文，也沒有備援：資料庫沒有已發布的譯文就顯示中文。改翻譯用 `evoleap i18n set`，譯文隨課程資訊備份到 GCS、由 `gcs.mjs init` 寫回（不含修改歷史）；測試用的假譯文在 `server/internal/store/fixture/i18n_en.json`。程式在 `server/internal/store/i18n.go`、`i18n_db.go`。
- 英文網址：`/en/courses`（課程清單）的標題與描述寫在前端（`web/src/seo/enPages.ts`，build 時產生）。課程總覽 `/en/courses/<課程>` 的 `<title>`、描述與結構化資料由 server 請求時讀資料庫的譯文（`server/cmd/server/courseseo.go`；瀏覽器端換頁讀 `GET /api/seo/page` 拿同一份），規則和中文課程頁相同：資料庫讀不到回 503 + `Retry-After`、沒有這門課 404、程序內快取 1 分鐘、不拿舊資料頂替。**課名有已發布的英文譯文才算有英文版**；其他沒翻的欄位保留中文。沒有英文版的課，`/en/courses/<課程>` 回中文頁並 noindex，中文頁不放 hreflang，`/sitemap.xml` 不列它的英文網址（sitemap 的這份清單和已開放的課一樣快取 1 分鐘，查詢失敗沿用上一次的結果）。其他 `/en/...` 頁回中文頁並 noindex。改譯文最多約 1 分鐘生效，不用重新部署。
- 公開 API `GET /api/topics/views` 回傳每個主題的觀看次數（`{"views":{"web":23,…}}`，首頁主題卡片顯示、並依次數排序首頁與全部課程頁的主題）：底下「已開放」的課，訪客打開（不含爬蟲）加上會員有播放進度的課；草稿、規劃中的課不算。訪客紀錄只保存 180 天，所以這是最近約 180 天的數字，不是累積；快取 5 分鐘。
- 公開 API `GET /api/courses/{id}/map` 回傳課程地圖（不用登入，登入功能沒開也能讀，只有沒接資料庫時回 503）。讀它的頁面：
  - 課程總覽頁（`web/src/courses/CourseOverviewPage.tsx` + 清單元件 `web/src/courses/LessonGroup.tsx`）：做出自己的軟體（`/courses/software`）、網頁怎麼運作（`/courses/web`）、從做好到上線（`/courses/launch`）、給孩子的網頁程式（`/courses/kids`，兒童模式中改顯示家長排好的本週課程）、Claude Code 工作術（`/courses/claude-code`）共用；只有一條畫法，版面邏輯在 `web/src/courses/overviewModel.ts`（標題、簡介、說明段落「課程說明」、插圖、簡介影片「課程簡介」〔`introScript`〕、單元一組且每個單元有 `#stage-<單元 id>` 錨點、先不公開的單元不列；整門課都沒有課〔進階〕時單元列成規劃中的項目；一課有腳本且開放（管理員另有草稿）才連到 `/courses/<課程>/<課號>`，小數點換成 `-`，只有做出自己的軟體的起步階段去掉 `0.`）；網頁、上線、兒童、Claude Code 的單課路由在 `web/src/home/routes.tsx`（`/courses/web/:lesson` 等），舊的 `/topics/web`、`/topics/launch`、`/topics/kids`、`/topics/claude-code` 與 `/courses/ai-agent`（AI Agent 沒有自己的頁面，介紹在主題頁 `/topics/ai-apps`）會 301 轉過來。**課程資訊不做前端備援**：讀取中顯示佔位卡，讀不到顯示「無法讀取課程資訊」。
  - 所有單課頁（含做出自己的軟體）：能不能上、播哪個腳本、要不要登入都照資料庫，共用同一個把關 `web/src/courses/LessonGate.tsx`；單課路由是參數化的 `/courses/<課程>/:lesson`（`web/src/courses/LessonRoute.tsx`），哪些課有頁面看資料庫，用 CLI 新增課不用重新 build 或部署；地圖裡沒有的課號顯示找不到頁面。版型照課程：有手寫內容的課沿用（提示詞、互動點、給家長的話、Claude Code 情境文字），沒有的用該課程的通用版型，還沒開放的顯示規劃中／還沒開放。新增「課程」仍要改前端並部署。
  - 所有課程的課程總覽（`/courses/...`）：每一課的一句話、時間、開放與否、免費預覽；所有 `/courses/...` 單課頁要不要登入也照每一課的 `access`（資料庫裡沒有的課顯示規劃中）。
  - 首頁、課程列表（`/courses`）、軟體課程地圖頁等級卡片的「已開放」與課數；會員空間「課程」分頁與兒童模式的進度、這週的課。讀不到時這些地方不標開放狀態或顯示讀取失敗，不用前端資料頂替。
- 還在前端的：主題與等級的介紹（`levels.ts`、`topics.ts`，主題地圖頁、首頁用；課程總覽與課程列表的課名、簡介、插圖、階段名稱都讀資料庫）、單課頁的內容（步驟、提示詞，`l0Lessons.ts` 等）、規劃中課程的章節頁。`WEB_LESSON_PAGES`、`KIDS_LESSON_PAGES` 只放手寫內容（互動版面、給家長的話），不決定哪些課有頁面；開放與否一律看資料庫：單課存取、課程清單標示、`/sitemap.xml`、課程頁的標題、描述與結構化資料（`server/cmd/server/courseseo.go`）都是。
- 腳本檔：在資料庫，屬於某一課的在 `lesson_files`，研發基地的在 `studio_files`，**線上資料庫是唯一來源**：repo 裡沒有腳本 JSON，部署與啟動都不從目錄補腳本。改腳本用 `evoleap script get`／`script push`，清單與歸屬用 `evoleap script list [-owners]`。備份在 GCS，只有新站用 `node server/backup/gcs.mjs init` 復原。本機工具（`voice`、`mix`、`record:live`、canvas）透過 CLI 向 `https://evoleap.io` 取腳本（`--api` 換伺服器、`--dir` 讀本機草稿），見 `web/src/live/README.md`。程式在 `server/internal/store/lessonfiles.go`、`web/scripts/lib/liveScripts.mjs`。
- `GET /api/scripts/{path}` 依所屬那一課把關：免費預覽誰都拿得到、登入後免費要登入（401）、訂閱課程等訂閱功能上線前不給（403）、草稿與規劃中的課只給管理員（其他人 404）；研發基地的檔只給管理員。`GET /api/scripts` 列出所有腳本路徑（只給管理員）。程式在 `server/internal/api/scripts.go`。本機開發也只讀資料庫（本機資料庫要有內容：用 `gcs.mjs init` 初始化空資料庫，或 `script push`）。沒接資料庫時沒有種子備援：腳本回 503（選用的旁白、章節音軌清單回 `null`）。
- `/sitemap.xml` 由後端依資料庫每一課的狀態即時產生（`server/cmd/server/sitemap.go`；前端 build 只輸出可收錄的頁面清單 `dist/sitemap-pages.json`，該檔不對外提供），只列已開放的課，所以用 CLI 改了開放狀態後最多 1 分鐘（程序內快取）就會跟上；草稿與規劃中的課頁面仍可收錄，只是不列入。先不公開（`hidden`）單元裡的課就算開放也不列入。課程總覽頁結構化資料的課程連結同樣依資料庫（`courseseo.go`）。

## 課程 CLI（`evoleap`）

管理員改正式環境的課程資料用 `server/cmd/evoleap`（仿照 tripace 的 `tripace-cli`）：一律走 HTTP API，不直連資料庫，權限、規則檢查與修改紀錄都在伺服器。

- 安裝：`cd server && go install ./cmd/evoleap`（或 `go run ./cmd/evoleap …`）。全域旗標 `-api`，預設 `https://evoleap.io`；本機是 `-api http://localhost:8190`。
- 登入：`evoleap login`。CLI 在本機 127.0.0.1 開臨時伺服器、打開瀏覽器到核准頁 `/login/cli?id=…`，**只有管理員能按核准**（`ADMIN_BOOTSTRAP_EMAIL` 且用 Google 登入）；核准時伺服器產生一次性的驗證碼，只放在導回 CLI 本機網址的那個網址上；CLI 要用 id 加這個驗證碼才換得到 token（10 分鐘內有效、只能換一次；網址上從不帶 token，回呼網址只接受本機）。所以就算有人自己發起登入、把核准頁的連結寄給管理員騙他按核准，也拿不到 token。發起登入的端點依來源 IP 限流。CLI 的 token 不是網站登入的 JWT，而是存在資料庫的隨機字串（`evc_` 開頭，資料庫只存雜湊，`cli_tokens` 表），**有效期 7 天、可以撤銷**：每次呼叫都查資料庫，撤銷後立刻失效；使用者的登入全部失效時（例如綁定 Google）也跟著失效。`Authorization: Bearer` 只接受這種 token。本機依 `-api` 的主機分開存在使用者設定目錄的 `evoleap/`（權限 0600）。本機開發時前端在 5190：`evoleap -api http://localhost:8190 login -console http://localhost:5190`。
- 指令（「資源 動作」，輸出 JSON）：
  - `evoleap whoami`；`evoleap logout`（先在伺服器撤銷這個 token，再刪本機的）
  - `evoleap token list`、`evoleap token revoke -id ID`：列出、撤銷還有效的 CLI 登入（例如遺失的電腦）
  - `evoleap course list`、`evoleap course show -course ID`（做出自己的軟體的課程 id 是 `software`，例如 `evoleap course show -course software`、`evoleap lesson set -course software -lesson 0.1 …`；舊的 `tools`、`ai-tools`、`vibe-coding-basics` 部署後就不存在了）
  - `evoleap course set -course ID [-access free|login-free|subscription] [-title …] [-summary …] [-about 段落||段落] [-seo-title …] [-description …] [-art tools|chat|build|agent|advanced] [-intro-script 路徑]`：改一門課自己的存取方式、課名與課程資訊（`-about` 的段落用 `||` 分隔；課程資訊的選項給空字串就清掉；`-intro-script` 指到的檔要先用 `script push` 上傳，設定時改掛到這門課；沒寫 `access` 的課跟著這門課）
  - `evoleap lesson set -course ID -lesson ID [-status open|draft|planned] [-access free|login-free|subscription|inherit] [-minutes N] [-title …] [-summary …] [-script 路徑]`（`-script` 要先用 `script push` 上傳到這一課）
  - 課程結構的增刪排序：`course create|delete|order|outline`、`unit add|set|delete`、`lesson add|delete`（參數見 `evoleap` 不帶指令的說明）。開放中的課要先改成草稿或規劃中才能刪；刪掉的課，腳本移到研發基地。課號不能改名。
  - `evoleap i18n list [-lang en] [-kind K] [-ref ID] [-status S] [-stale] [-n 500]`、`i18n get -kind K -ref ID -path P [-lang en]`、`i18n set -kind K -ref ID -path P [-lang en] (-value 文字 | -value-file 檔案) [-status draft|reviewed|published] [-origin human|ai|import] [-model M] [-reason 原因]`、`i18n missing [-lang en] [-kind K]`：課程資訊的譯文（`set` 預設 `draft`、`human`，要 `-status published` 才會顯示在網站上，每次寫入記一筆異動紀錄；`missing` 列出登記表有、還沒翻或過時的欄位；API 是 `/api/admin/i18n*`，只有管理員）
  - `evoleap script get -path 路徑 [-out 檔案]`、`evoleap script push -file 檔案 [-path 路徑] [-course ID -lesson ID]`、`evoleap script list [-owners]`
  - `evoleap change list [-n 20]`：最近的修改紀錄（誰、什麼時候、改了什麼）
  - `evoleap schema check`：資料庫結構檢查（仿照 tripace 的 schema-check）：程式的資料表定義和資料庫實際的欄位、主鍵是否一致，有沒有遺留表（AutoMigrate 不會處理欄位改名、刪欄位、改主鍵，也不會刪表）；有問題時結束碼 1。研發基地的「會員」標籤也有同樣的檢查（`GET /api/admin/schema-check`）。
- 伺服器端：登入在 `server/internal/api/cliauth.go`、`store/cliauth.go`；改課程資料在 `api/coursesadmin.go`、`store/coursesadmin.go`（全部經 `requireAdmin`，每次修改記在 `course_changes`）；核准頁是 `web/src/auth/CliAuthPage.tsx`。

## 研發基地的權限

- `/studio`、`/materials`、`/docs` 與打包內容 `/assets/internal/*` 只有管理員能取得（判定條件同上），由 Go server 檢查（`server/cmd/server/static.go`）。未登入開頁面導向 `/login?next=…`；其他沒有權限的請求回 404。
- 內部內容由 `web/src/App.tsx` 延遲載入 `src/studio/StudioApp.tsx`，輸出到 `assets/internal/`。`vite.config.ts` 在 build 時檢查內部模組沒有混進公開檔案；公開頁面只能 import `src/studio/interactive/`，其他 `src/studio/` 底下的模組會讓 build 失敗。內部頁的 SEO 資料在 `src/seo/internalPages.ts`；研發基地的腳本（`lab/`、`promo/`）和課程腳本一樣由 `GET /api/scripts` 取得，只給管理員。
- dev server（5190）也會擋：向本機 Go server（8190）的 `/api/admin/me` 確認，未登入導向登入頁，其他沒有權限的情況顯示找不到頁面；Go server 沒開時一律擋下（`vite.config.ts` 的 `devStudioGate`）。本機要以管理員進入，Go server 要設定 `GOOGLE_OAUTH_CLIENT_ID` 與 `ADMIN_BOOTSTRAP_EMAIL`（寫在 `server/.env`，啟動時自動讀進來；已經在 shell 設定的值優先，`-env=` 不讀，E2E 就是這樣跑；Cloud Run 上不讀）；要略過檢查用 `DEV_OPEN_STUDIO=1 npm run dev`。`npm run record:live` 會帶本機 token（`node_modules/.cache/studio-dev-token`）通過，不用登入。直接跑 Go server 時，需要略過權限可加 `-open-studio`（Cloud Run 上會拒絕啟動）。
- E2E 開兩台 server：8198 加 `-open-studio` 測內部頁功能，8199 照正式設定測權限（`web/e2e/studio-access.spec.ts`）。管理員必須用 Google 登入，E2E 做不到，管理員可進入的部分由 Go 測試涵蓋。

## SEO

- 課程相關頁面（課程總覽、單課、規劃中章節；中文）：`<title>`、description、noindex、JSON-LD 在請求時讀資料庫組出來，組法只在 `server/cmd/server/courseseo.go`。build 只輸出固定網址清單與單課網址樣式 `dist/course-pages.json`（來源 `web/src/seo/coursePages.ts`）和留好空位的 HTML（單課頁一門課一份 `dist/lesson-shells/`），不含課程內容，也沒有備援：資料庫讀不到或沒接資料庫回 503 + `Retry-After`，資料庫沒有這門課或這一課回 404。每門課在程序內記 1 分鐘，過期後讀不到就回 503，不用舊資料。只用公開的課程地圖（草稿當成規劃中）。瀏覽器端換頁讀 `GET /api/seo/page?path=/courses/...` 拿同一份。規劃中章節（進階課）的章節名稱與簡介仍是前端的（`levels.ts`），課程名稱與麵包屑讀資料庫。本機 `go run`（內嵌的佔位 build）沒有清單，要加 `-dist ../web/dist` 才看得到。
- 英文版的課程總覽 `/en/courses/<課程>` 同樣在請求時讀資料庫（譯文），有沒有英文版也看資料庫，見上方「英文網址」。
- 其他頁面的唯一來源：`web/src/seo/pages.ts`（公開頁）、`web/src/seo/internalPages.ts`（內部頁）。文章從 `src/studio/articles/registry.ts`／`src/studio/docs/registry.ts` 自動推導；新增其他頁面時在 `PAGES` 加一筆（漏了 build 會失敗並列出缺少的路由）。
- `npm run build` 最後一步 `node scripts/seo.mjs`：產生 `dist/<路由>/index.html`（title、description、canonical、og:*、twitter:*、JSON-LD；課程相關頁面只留空位）、`dist/404.html`、`course-pages.json`、`sitemap-pages.json`（可收錄的頁面清單；單課頁只列哪些課要由 server 依資料庫展開）、`robots.txt`。`/sitemap.xml` 由 Go server 依資料庫每一課的狀態即時產生（只收錄已開放、且單元沒有先不公開的課，`server/cmd/server/sitemap.go`），開發時沒有；`/robots.txt` 開發時由 Vite 即時產生。
- 公開頁：`/`、`/topics/*`（做出自己的軟體、AI 互動軟體、兒童課）、`/courses`、`/courses/*`、`/privacy`、`/terms`、`/refund`。內部頁 `/docs*`、`/studio*`、`/materials*` 與 `/login`：noindex（meta + `X-Robots-Tag`）、不列入 sitemap。
- Go server（`server/cmd/server/static.go`）：頁面回傳對應的 HTML（`Cache-Control: no-cache` + ETag），未知路由回 404 + `404.html`，結尾斜線 301 到不帶斜線的網址；`/assets/*` 一年 immutable 快取。
- 預設分享圖 `web/public/og-default.png`（1200×630），原始檔 `web/scripts/og-image.html`。

## 部署

```bash
git tag -a v0.1.0 -m "..." && git push origin v0.1.0
```

- 打 `v*` tag 觸發 `.github/workflows/deploy-cloudrun.yml`：先跑完整測試（`test.yml`），通過才 build、執行課程同步工作（寫入課程資料），再部署到 Cloud Run。
- 只跑同步工作（建表、補腳本檔；不寫主題與課程）不用打 tag：在 GitHub Actions 選 `dev` 分支手動執行 `sync-courses.yml`（或 `gh workflow run sync-courses.yml --ref dev`；只能從 `dev` 分支執行，其他分支會直接失敗），用 `dev` 分支 build 課程同步工作的小 image（`shuttle-course-sync:<commit>`），只執行同步工作，不部署網站。課程結構與腳本內容以資料庫為準，用 `evoleap` CLI 改。新增課程頁（前端路由、SEO、課程內容）與程式的修改仍要打 tag 部署。兩個 workflow 共用 `.github/scripts/run-course-sync.sh`，也共用一個執行序，不會同時寫資料庫。
- GitHub repo secrets：`WIF_PROVIDER`、`WIF_SERVICE_ACCOUNT`（Workload Identity Federation，provider `github-provider-vibing` 只允許 `tim72117/evoleap`；repo 改名時要同步更新 provider 的 attribute condition 與 service account 的 workloadIdentityUser 綁定，否則部署會在驗證步驟失敗）；repo variable `GA_MEASUREMENT_ID`（選填，未設定不載入 GA）、`ADSENSE_CLIENT` 與 `ADSENSE_SLOT`（選填，兩個都設定才在課程頁放廣告；AdSense 後台的自動廣告要保持關閉）。
- 登入功能需要資料庫：Cloud Run 上沒有 `DATABASE_URL` 時伺服器自動停用登入，網站其他部分照常運作（課程只有免登入的課能播，課程地圖改用前端內建的資料）。
  - Cloud SQL：與 tripace 共用實例 `onagent-prod:asia-east1:onagent-db`，資料庫 `evoleap`、使用者 `evoleap_app`。實例上的 `shuttle`、`shuttle_app` 是 tripace 的正式資料，不可使用。
  - Secret Manager（專案 shuttle-045094509）：`EVOLEAP_DATABASE_URL`、`EVOLEAP_JWT_SECRET`、`EVOLEAP_GOOGLE_OAUTH_CLIENT_ID`、`EVOLEAP_ADMIN_BOOTSTRAP_EMAIL`，都要開放 Cloud Run 執行帳號讀取。deploy workflow 會引用這些機密，缺任何一個部署都會失敗。另有環境變數 `CLI_AUTH_REDIRECT_ALLOWLIST`（`/api/cli-auth/start` 除本機網址外接受的 https 回呼網址，逗號分隔、完整網址逐字比對，預設空）直接寫在 `deploy-cloudrun.yml` 的 `--update-env-vars`，目前有 omixor 的 `https://omixor.io/oauth/evoleap/callback` 與 `https://mac-mini.tail2ee365.ts.net/oauth/evoleap/callback`（多個用逗號，deploy 用 `^|^` 當變數分隔符）；要加新的回呼就改這一行。

## 測試

```bash
cd server && go test ./...     # Go：靜態頁面／SEO 路由、登入 API、播放進度 API
cd web && npm run check        # 型別檢查 → 單元測試（vitest）→ build → E2E（Playwright，對正式 build）
```

每次 push 都會在 GitHub Actions 跑同一套測試：Go 與前端檢查（`checks`）和 E2E 同時跑，E2E 切成 4 份（`e2e (1)`–`e2e (4)`）各用一台機器。
