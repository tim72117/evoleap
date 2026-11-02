# Changelog

格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)；版號採語意化版本（0.x 階段：不相容變更升 minor）。

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
