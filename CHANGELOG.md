# Changelog

格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)；版號採語意化版本（0.x 階段：不相容變更升 minor）。

## [0.9.1] - 2026-11-04

網站網域從 `shuttle.tools` 改為 `evoleap.io`。

### 變更

- **網域改為 `evoleap.io`**：`SITE_ORIGIN`（canonical、og:url、sitemap、robots 的 Sitemap）、頁面描述、隱私權政策與服務條款的網站名稱、`e2e/support.ts` 的 `ORIGIN`、og 圖的 HTML 範本、宣傳片結尾卡與旁白、README。Cloud Run `shuttle-server` 新增 `evoleap.io` 的 domain mapping；`shuttle.tools` 的對應保留，兩個網域暫時都指向同一個服務（尚未加 301 轉址）。

### 已知限制與部署前後要做

- `public/og-default.png` 仍是舊圖（寫著 shuttle.tools），尚未重新輸出，社群分享預覽會顯示舊網域。
- Google 登入：OAuth 用戶端的「已授權的 JavaScript 來源」要加上 `https://evoleap.io`。
- Cookie 依網域，在舊網域登入的會員換到新網域要重新登入（帳號與進度不受影響）。
- 舊網域尚未轉址到新網域，搜尋引擎可能視為重複內容；Search Console 要另外加新網域。
- 宣傳片結尾旁白文字已改，錄製前要重跑 `npm run voice`。
- Google Ads 最終網址（活動目前暫停）尚未更換。

## [0.9.0] - 2026-11-04

第 2 課改成互動版、新增宣傳影片框架與擬真筆電演員、舞台支援直式（9:16）與手機底部抽屜側欄。

### 新增

- **第 2 課互動版**（`studio/interactive/l0-0.2.ts`，登記在 `INTERACTIVE_LESSONS`）：「響應式設計」互動點，學員選手機／平板／桌面，瀏覽器演員依裝置寬度重新排版並說明，選項最後還原成桌面寬度。
- **宣傳影片框架**：`/materials/promo`（`PromoPage`，內部頁、noindex）播放 `content/live/promo/` 的腳本，提供 `window.__promo.renderAt(ms)` 逐格掛鉤；`npm run record:live -- promo/xxx.json [--aspect portrait] [--from/--to 毫秒]` 逐格截圖，ffmpeg 合成 1080p mp4（有旁白語音時混入音軌）與 `.srt`。附 `0.promo-intro.json`（約 50 秒骨架）與 `portrait-demo.json`。
- **`macbook` 演員**（`live/actors/macbook/`）：純 CSS 3D 的擬真筆電，動作 `open`／`close`／`wake`／`sleep`／`type`／`tilt`，目標 `screen`／`keyboard`／`trackpad`／`lid`／`window`／`key:x`；示範腳本 `content/live/lab/macbook-demo.json`。
- **直式舞台（原型）**：`createStage(root, { aspect: 'portrait' })` 為 1080×1920；`place` 與 `move.to` 可寫成 `{ landscape, portrait }`，語意名稱（left／right／center／window／full）在直式自動換算（`live/place.ts`）；鏡頭安全線依方向決定（橫式 68%、直式 84%）；橫式輸出與原本逐像素相同。`live/README.md` 新增「直式舞台(原型)」與逐演員觀察表。
- **直式互動課程頁**：任何互動課程加 `?aspect=portrait`（`studio/interactive/portrait.ts`）。視窗 ≤820px 時側欄變成底部抽屜（收合把手、展開 55dvh；播到互動點自動展開並只顯示提問，回答後收合）；工具列新增「橫/直」切換鈕。序章 `0.intro.json` 補了直式位置。
- 手機版播放條放在畫面最底部（`InteractiveScenePage.module.css`）。

### 變更

- 首頁預覽、課程頁的測試與文件配合第 2 課互動版調整（`e2e/live-lesson.spec.ts` 改測章節按鈕，`e2e/auth.spec.ts` 的 next 登入測試改用 `/courses/ai-tools/3-3`）。
- `ActorPush` 新增 `aspect`、`inDrawer`。

### 已知限制

- 直式只有序章有專屬位置；第 0、1、2 課沿用橫式位置，版面不佳（0.0 的 claude 視窗幾乎空白）。各演員在直式槽的問題記在 `live/README.md` 觀察表，演員層級的直式樣態尚未做。
- 手機直式時演員縮到約 0.36 倍，字偏小。
- 直式互動頁的 e2e（`portrait-drawer.spec.ts`）已寫但發版前尚未執行；也未跑完整 build 與全部 e2e。
- 第 2 課只有前 10 句旁白有語音（共 46 句），尚無章節音軌。
- 宣傳影片腳本為骨架，長度與用的示範網站（v3 顯示 NT$ 價格）待定。

## [0.8.0] - 2026-11-04

序章改成互動課程並有完整旁白、課程研發頁直接播放各課的即時教學畫面（移除內部預覽頁）、新增管理後台。

### 新增

- **管理後台** `/admin`（noindex）與唯讀 API `/api/admin/*`（`me`、`overview`、`users`、`users/{id}/progress`）：會員列表、各課學習人數／看完人數／平均進度。管理員 = 一般會員 + Email 在環境變數 `ADMIN_BOOTSTRAP_EMAIL` 的白名單內（沿用 tripace），而且必須用 Google 登入（Email 經驗證）。未設定白名單時沒有任何人是管理員。
- **序章互動版**（`/courses/tools/intro`）：兩份腳本合併成 `l0/0.intro.json`，三個「選一選、想一想」的互動點（`studio/interactive/l0-intro.ts`），每個都有「先看示範」。序章 43 句旁白全部產生語音（約 263 秒）並合成章節音軌（`0.intro.mix.json`）。
- **課程研發頁直接播放即時教學畫面**（`LiveVideoPreview`）：各課「影片切分」的影片、序章步驟 1 的試做畫面都有播放器（有旁白語音，不記播放進度）；`drafts` 新增選用的 `step`，試做畫面放在對應步驟底下。`LivePlayer` 新增 `saveProgress`。
- `npm run dev:tailscale`：只綁在這台的 Tailscale IP，讓手機連開發環境；`vite.config.ts` 新增 `DEV_HOST`、`allowedHosts: ['.ts.net']`。

### 變更

- **移除內部預覽頁** `/proposal/visuals/preview`（及 `window.__livePreview` 逐時間點截圖的做法）：播放已搬到課程研發頁。相關連結、導覽、SEO 與 e2e 登記一併移除，`live/README.md` 2.6 改寫。
- **首頁主打課程不含序章**：序章有了即時教學畫面後，主打仍是第 0 課。
- **Google 登入綁定既有帳號**：只對管理員白名單的 Email 清掉既有密碼（可能是別人搶先密碼註冊的），一般會員不清；Email 已綁另一個 Google 帳號時不覆蓋，回 409（`ErrGoogleConflict`）。`UpsertGoogleUser` 新增 `clearPassword` 參數。
- **`mix.mjs` 量測音檔長度改為解碼後數樣本**：舊方法（ffmpeg 進度列的 time=）每個音檔平均少算約 5 毫秒，長章節會累積成幾百毫秒。序章用新方法；已發布的 0.0、0.1 章節音軌用舊方法做的，章節尾端最多晚約 60 毫秒，尚未重做。

### 修正

- 後台「平均進度」把不知道總長（durationMs 為 0）的紀錄算進分母，會低估。
- `e2e/support.ts` 的內部頁前綴漏了 `/admin`。

### 已知限制

- 管理權限依附在 30 天的無狀態登入 cookie：搶註冊者在管理員綁定 Google 之前拿到的 cookie 不會失效，綁定後仍會通過管理員檢查。部署後台前，先確認白名單的 Email 已經自己註冊並用 Google 登入過（見 README「管理後台」）。

## [0.7.0] - 2026-11-03

旁白改用「章節音軌」播放:把連續的旁白合成一個音檔,手機上整章只用一個 `<audio>`,不再每句換一次音檔。

### 新增

- **章節音軌**（`web/scripts/mix.mjs`、`npm run mix`）：用 Playwright 在 Chrome 裡跑舞台排時間，取得每段旁白的開始時間與練習點，以練習點切章節，用 ffmpeg 依時間把旁白接成一個 mp3（間隔補靜音）；`--publish` 上傳到 `gs://shuttle-voice/mix/` 並寫出 `<名稱>.mix.json`。L0 第 0、1 課已合成並上傳。
- **旁白計畫**（`web/src/live/mixPlan.ts`）：`planNarration`、`narrationClips`、`rangeAt`。把目前時間軸的旁白對到章節音軌，連續的旁白併成一段範圍；互動分支新寫的旁白（沒有語音）只有字幕，回到主線的旁白接著用章節音軌。章節音軌對不上（旁白文字、語音檔或間隔改了）時自動退回逐句播放。
- `scripts.ts` 新增 `loadMix`，`ScriptVoice` 新增 `files`；`Clip` 新增選用的 `from`（音檔裡的起點）。

### 變更

- `LivePlayer`、`InteractiveScenePage` 改用 `narrationClips` 組旁白，沒有章節音軌的課程行為不變。

### 修正

- 先前 0.6.1、0.6.2 修的是手機上旁白斷斷續續（音檔當主時鐘、預載預設關閉）；這版讓整章只換一次音檔，從根本上減少換檔造成的卡頓。實機（iOS）效果仍待實測。

## [0.6.2] - 2026-11-03

修正 0.6.1 部署失敗。

### 修正

- **旁白音檔預載預設關閉**（`web/src/live/narration.ts`）：0.6.1 的 Blob 預載會 `fetch` 存放音檔的 GCS bucket，而 bucket 沒有設 CORS，每段音檔都被瀏覽器擋下並在主控台報錯，導致 CI 的「開啟無錯誤」與課程頁 e2e 失敗、部署中止（線上使用者也會看到這些錯誤與多餘的請求）。現在需在 bucket 設好 CORS 後，以建置變數 `VITE_VOICE_BLOB=1` 開啟（見 `web/.env.example`）；關閉時仍直接用網址播放，音檔當主時鐘的修正不受影響。

## [0.6.1] - 2026-11-03

修正手機播放旁白時音訊斷斷續續。

### 修正

- **旁白音訊斷斷續續**（`web/src/live/narration.ts`、`shell.ts`）：原本時間軸自己走，音檔落後超過 0.35 秒就強制 seek；手機上載入慢、seek 本身比 0.35 秒慢，會一直重複跳轉，聽起來是播一下被切掉再播。現在播旁白時以音檔的 `currentTime` 為主時鐘（`narration.clock()`），音檔卡住時時間軸與字幕跟著停，並移除偏差校正；時間軸不會往回走。
- 旁白音檔預先抓成 Blob 放在記憶體（目前段落往後 3 段，其餘釋放，失敗 5 秒後重試），抓不到時退回直接用網址。注意：存放音檔的 GCS bucket 目前沒有 CORS，線上 `fetch` 會被擋，預載暫時不會生效，只有主時鐘的部分有效。

## [0.6.0] - 2026-11-03

首頁改為多主題；L0 第 0、1 課改成互動課程：整個視窗都是舞台，學員直接操作演員，回答會變成時間軸的一部分。

### 新增

- **互動課程**（`web/src/studio/interactive/`、`web/src/courses/InteractiveLessonPage.tsx`）：浮動的膠囊播放條、右側的課程章節與步驟（含提示詞複製、上一課下一課、登入入口）。播到互動點會暫停，舞台推近目標，學員在 Claude 的輸入框選指令、按它的允許或拒絕；沒回答就演原本的示範。用課程原本的腳本與語音，選項分支的新旁白目前只有字幕。規格見 `web/src/live/README.md` 2A.6。
- **互動場景試做頁**（`/proposal/interactive`、`/proposal/interactive/l0-claude`、`/proposal/interactive/l0-claude-stage`）。
- **多主題首頁**：首頁先列主題，「做出自己的軟體」可直接播放第 0 課並展示成品；主題頁 `/topics/software`、`/topics/ai-apps`。舊的 `/#map`、`/#level-*` 會導到主題頁。
- **序章** `/courses/tools/intro` 與 `lessonLabel`（有 `label` 的課顯示「序章」，其他顯示「第 N 課」）。
- **主題頁的 SEO**：各自的標題、描述與課程清單（JSON-LD `ItemList`）；sitemap 加上首頁與主題頁的優先度；課程與單課的麵包屑掛在所屬主題底下。
- **課程編排工具**（`/materials/course-map`）：拖曳段落與課程，經開發伺服器即時存成 `course-map.json`。
- 課程研發頁的各課知識點；L1「生活小工具」與構想區、各課開場腳本與預覽；L2 單元 14「寫出好維護的程式」的大綱。
- 演員 `chat`、`person`、`notes`、`editor`。
- `mountShell` 新增 `layout: "capsule"`、`toolbar`、`onStop`；`Stage` 新增 `element(ref)`；`LivePlayer` 新增 `poster`；`kit` 新增 `splitCaption`；`npm run voice` 新增 `--limit`；L0 第 2 課前 10 段旁白語音。

### 變更

- **`/courses/tools/0`、`/courses/tools/1` 改為互動版**，不再使用一般課程頁（由 `web/src/courses/routes.tsx` 的 `INTERACTIVE_LESSONS` 決定）。
- **字幕改成單行**：每條最多約 24 個字，優先在標點斷開，所有課程都套用。
- 課程地圖連結改到 `/topics/software#map`；頁尾移除 `shuttle.tools` 文字。

### 修正

- 序章在課程地圖與 SEO 顯示成「第 intro 課」。
- 文件頁的 README 工作副本為 CRLF 換行時，頁面出現兩個 `h1`。

### 已知問題

- 互動課程在手機直向時，提問文字與選項太小，難以作答。
- 互動課程的播放進度只存時間、不存回答，且和首頁預覽共用同一份紀錄，回來時位置可能對不上內容。
- 第 0、1 課的互動版還沒有本課目標、各步驟的文字說明與完成檢核。

## [0.5.0] - 2026-11-03

L0 第 2 課上線（一頁式網站）、新增瀏覽器演員；登入後才記住播放進度；課程研發頁改版（頁籤、文件區、CSS Module）；L3 改為規劃中。

### 不相容變更

- **`mountShell` 的 `resumeKey` 選項移除**（`web/src/live/shell.ts`），改成 `progress: { load, save }`：外殼只管「何時讀、何時存」，存在哪裡由外層決定；不傳就完全不記。用法見 `web/src/live/README.md`。
- **訪客不再記住播放進度**：以前存在瀏覽器 `localStorage`（`vp:t:*`），現在訪客不存，舊的紀錄會在課程頁載入時清掉；登入的會員改存到伺服器。

### 新增

- **L0 第 2 課**「提出需求：做出一頁式網站並精確調整」的即時教學畫面（`0.2-site.json`，約 6 分鐘、9 步、46 段旁白）與參考成品（`web/src/content/live/l0/site/` 的 `v1`–`v7`、`over`）。旁白語音尚未產生，先以字幕播放。
- **`browser` 演員**（`web/src/live/actors/browser/`）：仿瀏覽器視窗顯示網頁，動作有 `site`、`width`、`scroll`、`go`、`click`、`reload`；網頁放在 Shadow DOM，寬度由腳本指定（自行判斷 `@media` 的寬度條件），所以仍是時間的純函式，可拖曳、倒轉。
- **會員播放進度**：後端新增 `progress` 資料表與 `GET`／`PUT /api/progress`（未登入一律 401、位置不得大於總長）；前端登入後從上次看到的地方接著看，每 10 秒與暫停、離開頁面時存檔；訪客在課程頁看到「登入後會記住你看到哪裡」的提示。隱私權政策已同步說明。
- 課程研發：「會員空間」構想頁（`/proposal/member`）、兩層頁籤（一級：總覽／課程／構想／文件／工具；二級：各等級或各構想）、文件列表改成卡片。

### 變更

- **L3（AI Agent）改為規劃中**：課程地圖與課程目錄的狀態由已上架改為 `planned`；首頁主視覺的次要按鈕改連到第一個已有課程可看的等級。
- **課程研發頁全部改用 CSS Module**（`proposal.css`、`docs.css` → `*.module.css`），亮暗色畫面逐像素比對沒有變化；暗色模式的強調色按鈕與選中頁籤改用深色字（原本白字對比只有 2.1:1）。
- **Markdown 文件頁（`/docs/live`、`/docs/recorder`）與研究文章共用同一個版型**（麵包屑、標題與摘要、自動目錄、上下篇）；文件的標題與摘要併入文章登記表（新分類「工具與規格」）。
- `npm run voice`：中途失敗時，尚未處理的已快取段落也會保留在清單中。
- 旁白費用評估頁：0.2 由推估改為實測（1,237 字），整套約 US$7.3。
- L3 與 Hahow 脫鉤：提案頁、錄影工具、封面工具移除 Hahow 的連結與說明字樣。

### 修正

- 旁白：換段時舊音檔沒停而疊音；解鎖播放權限時蓋掉使用者剛按的靜音。
- 進度：已看完的課重新開啟又離開時，進度被寫成 0。
- E2E：`lesson.spec.ts` 原本針對 0.2（有多支未上架影片），0.2 上線後改用 `/courses/ai-tools/3-3`。

### 移除

- 未追蹤的舊錄影殘檔 `tools/video/mock/claude-code/`（終端機版模擬介面；其錄影工具已在 0.2.0 併入 studio）。

## [0.4.0] - 2026-11-03

即時教學畫面引擎整個改寫成 TypeScript，演員有了介面約束；鏡頭改成不閃動、先到位再演；L0 第 0、1 課的旁白語音全部產生。

### 新增

- **L0 旁白語音**：第 0 課 25 段、第 1 課 26 段全部產生並上傳 GCS（`0.0-tools.voice.json`、`0.1-project.voice.json`）。
- **鏡頭規劃**（`web/src/live/camera.ts`）：演員只說「要看哪裡」，由規劃器排出鏡頭點，姿態連續銜接，快速切換不會跳動；輸入、思考中、確認框一定看得到；舊的鏡頭點還沒停夠時，下一個會延後（最多 0.6 秒）。
- 演員在鏡頭到位後才開始演（鏡頭點前先預留 0.9 秒移動時間）。
- 研究文章「文字轉語音工具現況」（`/docs/research/tts-landscape`）。

### 變更

- **（不相容）引擎由 JS 改為 TypeScript**：`web/src/live/` 的 `kit.js`、`stage.js`、`shell.js`、`actors/*.js` 與各 `.d.ts` 移除，改為 `kit.ts`、`stage.ts`、`shell.ts`、`narration.ts`、`camera.ts`、`types.ts`、`actors/*.ts`。演員改用 `defineActor` 宣告，必須符合 `Actor` 介面（`name`、`kinds`、`duration`、`mount`，可選 `init`／`apply`／`cursor`／`autoFocus`／`cues`）；腳本步驟依演員區分型別。新增演員的寫法見 `web/src/live/README.md`。
- 開發時引擎程式一改就整頁重新載入（熱重載）。
- Claude 桌面版演員：「思考中」跟在最新內容之後，鏡頭跟著最新內容，不再因狀態列出現／消失而跳動。
- 範例資料夾名稱改為單一英文單字（`bakery`、`practice`），旁白才能正確發音；受影響的旁白已重新產生。
- `npm run voice`：每產生一段就寫入清單（中途失敗可接續）、顯示進度條。

### 修正

- 旁白：換段時舊音檔沒停而疊音；解鎖播放權限時蓋掉使用者剛按的靜音。
- `npm run voice`：中途失敗時清單會缺少尚未處理的已快取段落。
- README、課程研發頁中過時的 `.js` 檔名引用。

### 移除

- 未追蹤的舊錄影殘檔 `tools/video/mock/claude-code/`（終端機版模擬介面；其錄影工具已在 0.2.0 併入 studio）。

## [0.3.0] - 2026-11-02

即時教學畫面加上旁白語音：用 Gemini TTS 分段產生，放在 GCS，播放時跟著畫面同步；課程研發新增兩篇研究文章。

### 新增

- **旁白語音**
  - `npm run voice`（`web/scripts/voice.mjs`）：每段旁白送 Gemini TTS（`gemini-3.8-flash-tts`，聲音 Sulafat），轉成 MP3 上傳到 GCS `gs://shuttle-voice`（公開讀取、永久快取）；腳本旁的 `*.voice.json` 記錄每段的音檔與長度。旁白沒改就不重新產生；`--max-sec` 只產生開頭、`--sample` 試聽多種聲音。金鑰放 `web/.env.local`，只在本機用。
  - 播放器外殼新增分段旁白（`clips`）：跟著外殼時鐘同步拖曳、倍速、暫停與練習點；先載入下一段；按播放的當下取得播放權限（iOS）；有語音時顯示靜音按鈕。
  - 舞台用語音實際長度排時間，字幕在語音長度內依字數分配；讀不到語音時照常播放、只顯示字幕。
  - L0 第 0 課開頭 3 段旁白（試聽用）。
- 研究文章：「參考案例：video-shotcraft」（`/docs/research/video-shotcraft`，原在即時教學影像頁）、「旁白語音的費用評估」（`/docs/research/voice-cost`）。
- 課程研發：L0、L1 大綱的製作規劃與總覽頁「即時教學影像」卡片加上構想頁、預覽頁與參考案例的連結。

### 變更

- L0 第 0 課開場旁白與章節卡改成新的順序（認識 → 安裝登入 → 練習資料夾 → 第一個檔案）。
- 隱私權政策：說明旁白音檔放在 Google Cloud Storage（臺灣），播放時瀏覽器會向 storage.googleapis.com 下載。
- README：部署驗證改為 `tim72117/shuttle`，並寫明 repo 改名時要同步更新的 GCP 設定。

## [0.2.0] - 2026-11-02

課程影片改用「即時教學畫面」：不錄製影片，由腳本在課程頁即時畫出教學畫面；L0 第 0、1 課上線。

### 新增

- **即時教學畫面**（`web/src/live/`）：播放器外殼（章節、字幕、倍速、練習點自動暫停、全螢幕與手機橫放）、舞台（時間表、旁白、聚光燈、鏡頭、虛擬滑鼠）、演員 Claude 桌面版與 Finder。畫面是時間的純函式，可任意拖曳；規格見 `web/src/live/README.md`（站內 `/docs/live`）。
  - 演員一律用「操作式動作」（例如 Finder 的 `open`、`mkdir`、`rename`、`delete`、`select`／`drag`／`drop`），狀態由舞台以 `init`／`apply` 推算；腳本有錯時載入就報錯並指出第幾步。
  - 課程頁直接掛載（不用 iframe）；腳本在 `web/src/content/live/`，播到那裡就展開右側對應的步驟。
- **L0 第 0 課**（工具介紹）與**第 1 課**（專案與工作目錄）的即時教學畫面，各一支約 5 分鐘。
- 內部頁：工具總覽 `/materials`、即時教學畫面預覽 `/proposal/visuals/preview`、研究頁「用 MCP 連入課程」`/proposal/mcp`、「即時教學影像」`/proposal/visuals`；文件 `/docs/live`、`/docs/recorder`。
- 首頁 L0 卡片改為依課編號的清單，連到各課，並依實際開放的課顯示「第 0、1 課已開放」。
- 測試：即時教學畫面的 E2E（`e2e/live-lesson.spec.ts`）、腳本與課程資料一致性、kit 單元測試。
- Cloud Run 最大執行個體數設為 2（`deploy-cloudrun.yml`）。

### 變更

- **L0 課程設計**：第 0 課順序改為認識 → 安裝並登入（權限模式設為每次詢問）→ 建立練習資料夾 → 在練習資料夾第一次動手；第 0、1 課各合併成一支影片；0.1 依實測修正提示詞（基本檔案寫明 `index.html` 和 `styles.css`）與注意事項。
- 課程研發：製作方式改為「全部用即時教學畫面，不錄製」；各課製作狀態、L0 大綱橫幅依實際進度顯示；總覽頁內容改用清單呈現，文件列表併入總覽頁（`/proposal#docs`）。
- 尚未製作的影片顯示「預覽大綱」（原「模擬播放」）。
- 宣傳影片錄製工具移到 `web/src/studio/recorder/`（在 `web/` 執行 `npm run record`，輸出到不進版控的 `web/recordings/`）。
- 隱私權政策與服務條款：拿掉 YouTube 相關內容，資料存放地點改用白話描述；拿掉文末重複的相關文件連結。

### 移除

- YouTube 影片播放器與 `youtubeId` 欄位（課程影片只用即時教學畫面）。
- 募資影片腳本、分鏡文件與提案頁 `/proposal/ai-agent/video`；`tools/` 目錄（錄製工具已移入 `web/src/studio/recorder/`）。
- 文件列表頁 `/docs`（改在總覽頁 `/proposal#docs`；`/docs/*` 文件與文章網址不變）。
- 網站頁面上的「Hahow」字樣。

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
