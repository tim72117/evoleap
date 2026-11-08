// L2「Vibe Coding 入門」的章節大綱（尚未寫到步驟與提示詞）。
// 公開課程頁（規劃中章節）與課程提案頁共用這份資料；內容寫完後改成 CourseLesson 放進 lessons。

export type OutlineLesson = {
  title: string
  /** 預估學習時間（含影片與實作），例如「約 30 分」 */
  length: string
  /** 這一課結束時能做到的事 */
  objective: string
  /** 實作成果：學員手上會有什麼 */
  result: string
}

export type OutlineModule = {
  num: string
  title: string
  /** 預估總時數 */
  length: string
  /** 為什麼要學這個單元（先講 why；研發基地用） */
  why: string
  lessons: OutlineLesson[]
}

export const L2_MODULES: OutlineModule[] = [
  {
    num: '4',
    title: 'AI 程式助手：安裝與第一次使用',
    length: '約 2 小時',
    why: '這是 Vibe Coding 的核心工具，所以放在最前面：先裝好它、理解它能讀寫你的檔案與執行指令，之後學終端機、安裝工具、看不懂錯誤訊息時，都可以請它陪著做；第一個請它代裝的工具就是 Node.js。',
    lessons: [
      {
        title: 'AI 程式助手的三種形式',
        length: '約 25 分',
        objective: '分辨聊天視窗、編輯器內建補全與對話（例如 GitHub Copilot）、終端機代理（例如 Claude Code）的差異與適用情境。',
        result: '依自己的需求與帳號狀況選定課程主力工具（見「等你決定」）。',
      },
      {
        title: '安裝、登入與權限',
        length: '約 30 分',
        objective: '依官方說明安裝並登入選定的助手（這時還沒學終端機，優先用安裝程式或桌面 App 的版本），理解它讀檔、改檔、執行指令前的確認機制。',
        result: '請助手在家目錄建立 projects 資料夾作為整門課的工作區，並回答它的一次權限確認。',
      },
      {
        title: '請 AI 程式助手安裝 Node.js',
        length: '約 30 分',
        objective: '說明 Node.js 讓 JavaScript 在瀏覽器外執行、npm 負責安裝套件；請 AI 程式助手依你的作業系統，用官方的方式安裝 LTS 版本：每個安裝指令先看懂確認提示再允許，需要輸入電腦密碼的步驟自己來，最後請它執行 node -v 與 npm -v 驗證。',
        result: '終端機印出 node 與 npm 的版本；請助手在 projects 裡建立 hello 資料夾與 hello.js，執行 node hello.js 看到輸出。',
      },
      {
        title: '第一次和 AI 一起改程式',
        length: '約 30 分',
        objective: '描述需求 → 看助手改了哪些檔案、哪幾行 → 接受或要求修改；看不懂的步驟或訊息，請它用白話解釋。',
        result: '請助手在 hello 資料夾建立 hello.html，在瀏覽器打開後再請它改一處文字。',
      },
    ],
  },
  {
    num: '5',
    title: '開發者的電腦基本功',
    length: '約 1.5 小時',
    why: '之後每個工具都靠檔案路徑與終端機操作；先把這層打穩，安裝時出錯才看得懂，也看得懂 AI 程式助手替你執行了哪些指令。',
    lessons: [
      {
        title: '檔案、資料夾與路徑',
        length: '約 25 分',
        objective: '顯示副檔名與隱藏檔，分辨絕對路徑與相對路徑，知道專案資料夾為什麼不要放在雲端同步資料夾或含空白的路徑。',
        result: '寫出單元 4 建立的 projects 資料夾的絕對路徑，以及從家目錄出發的相對路徑。',
      },
      {
        title: '終端機入門（Windows 與 macOS）',
        length: '約 30 分',
        objective: '打開終端機（Windows：Windows Terminal／PowerShell；macOS：終端機／zsh），使用 pwd、ls、cd、mkdir 移動與建立資料夾。',
        result: '只用指令進入 projects 裡的 hello 資料夾、列出檔案，並建立一個新資料夾；看不懂的輸出請 AI 程式助手解釋。',
      },
      {
        title: '指令從哪來：PATH 與環境變數',
        length: '約 25 分',
        objective: '理解輸入指令時系統如何在 PATH 中尋找程式，這是「找不到指令」最常見的原因。',
        result: '印出自己的 PATH，並用 where（Windows）／which（macOS）找到一個指令的位置。',
      },
    ],
  },
  {
    num: '6',
    title: '安裝並設定開發環境',
    length: '約 1.5 小時',
    why: '一次裝好、逐項驗證，後面的課才不會卡在環境問題。每個工具都先說它負責什麼，再安裝；安裝卡住時，把畫面上的訊息交給單元 4 裝好的 AI 程式助手判斷。',
    lessons: [
      {
        title: 'VS Code：編輯器與內建終端機',
        length: '約 25 分',
        objective: '安裝 VS Code（可選裝繁體中文語言套件），用「開啟資料夾」打開專案，使用內建終端機。',
        result: '在 VS Code 開啟 hello 資料夾，建立第一個檔案並存檔。',
      },
      {
        title: 'Git 與 GitHub：程式的存檔點',
        length: '約 35 分',
        objective: '安裝 Git、設定 user.name 與 user.email、註冊 GitHub 帳號，理解 commit 與 push 的差別；請 AI 程式助手改完檔案後先看差異（diff）再 commit，改壞時退回上一個版本。',
        result: '建立第一個 GitHub repository，從本機 push 上去；請助手修改 hello.js，看過差異後 commit，再故意退回上一個版本。',
      },
      {
        title: '瀏覽器開發者工具入門',
        length: '約 25 分',
        objective: '使用 Elements 檢視網頁結構、Console 看錯誤訊息與執行 JavaScript、Network 看請求。',
        result: '在任一網頁用 Console 改掉標題文字，並找到一則錯誤或警告訊息。',
      },
    ],
  },
  {
    num: '7',
    title: '第一個專案：個人介紹頁上線',
    length: '約 2 小時',
    why: '把前面所有工具串成一條完整流程：想法 → 程式 → 本機預覽 → 版本控制 → 公開網址。',
    lessons: [
      {
        title: '用 AI 做出個人介紹頁',
        length: '約 35 分',
        objective: '用自然語言描述頁面需求，請助手產生 HTML、CSS 與少量 JavaScript，並在本機瀏覽器預覽。',
        result: '本機打開一個有自己名字、簡介與一個互動按鈕的頁面。',
      },
      {
        title: '讀懂 AI 產生的程式碼',
        length: '約 30 分',
        objective: '認得 HTML 結構、CSS 選擇器與 JavaScript 事件處理，能指出「要改哪裡」再請 AI 修改。',
        result: '自己動手改一處文字與一個顏色，再請 AI 加一個新區塊。',
      },
      {
        title: '部署到 GitHub Pages',
        length: '約 30 分',
        objective: '把專案 push 到 GitHub，開啟 GitHub Pages，理解「改程式 → push → 網站更新」的流程。',
        result: '得到一個可以分享給朋友的公開網址。',
      },
    ],
  },
  {
    num: '8',
    title: '疑難排解與環境總檢查',
    length: '約 1 小時',
    why: '安裝出錯是常態；會讀錯誤訊息、會描述問題，比記住所有解法更重要。',
    lessons: [
      {
        title: '常見安裝錯誤：PATH、權限、Proxy',
        length: '約 30 分',
        objective: '辨識「找不到指令」（PATH 或終端機沒重開）、權限錯誤（不用 sudo 硬裝、PowerShell 執行原則）、公司網路 Proxy 擋下載等狀況。',
        result: '依錯誤訊息對照表，排除一個刻意製造的問題（例如關掉終端機前後的 PATH 差異）。',
      },
      {
        title: '向 AI 與社群求助的方法',
        length: '約 20 分',
        objective: '完整複製錯誤訊息、附上作業系統與執行的指令，請 AI 協助判斷，並自行查證建議的修正。',
        result: '寫出一則包含環境、指令、完整錯誤訊息的求助描述。',
      },
      {
        title: '環境總檢查與下一步',
        length: '約 20 分',
        objective: '逐項跑過環境檢查表，確認接下來的版本管理、上線與 AI Agent 整合應用課需要的工具都能正常使用。',
        result: '環境檢查表全部通過，並附上個人頁網址。',
      },
    ],
  },
  // 單元 9–13 取自本專案實作紀錄：這個課程網站本身就是用 AI 程式助手（Claude Code）做出來的，
  // 過程中實際做過的版本管理、目錄整理、SEO、登入功能與自動化測試，整理成學員在自己的專案上跟著做的單元。
  {
    num: '9',
    title: '用 Git 管理版本',
    length: '約 2 小時',
    why: '本專案實作紀錄：做這個網站時，每一步都靠 commit 存檔、看 diff 確認 AI 改了什麼，檢查 .gitignore 確保 .env、本機資料庫、build 產物與 node_modules 沒進版控，並用 v* 標籤觸發部署。6.2 只教到 commit、push 與退回一次；這個單元補齊日常會用到的版本管理，讓學員敢讓 AI 大幅修改，也為單元 10 的大規模搬檔做好存檔點。',
    lessons: [
      {
        title: '先看再存：status、diff 與 commit 訊息',
        length: '約 25 分',
        objective: '每次 AI 改完，先用 git status 與 git diff 看改了哪些檔案、哪幾行，再請 AI 依變更寫出「做了什麼、為什麼」的 commit 訊息；一個 commit 只放一件事。',
        result: '自己的網站專案多了 3 個以上訊息清楚的 commit，用 git log 一眼看得出每次改了什麼。',
      },
      {
        title: '哪些檔案絕不能 commit：.gitignore',
        length: '約 30 分',
        objective: '請 AI 檢查專案的 .gitignore，說明為什麼存放密碼與金鑰的 .env、本機資料庫、build 產物與 node_modules 不能進版控，並用 git status 確認它們沒有被追蹤；知道機密一旦 push 出去就要立刻更換，只從紀錄中刪除不夠。',
        result: '一份每段都有註解的 .gitignore，與一份 commit 前的檢查清單。',
      },
      {
        title: '改壞了怎麼救：還原與撤銷',
        length: '約 30 分',
        objective: '用 git restore 放棄還沒 commit 的修改、用 git revert 撤銷某一次 commit；請 AI 執行前先說明會影響哪些檔案，不隨意使用會改寫紀錄的指令（例如 reset --hard、強制 push）。',
        result: '故意請 AI 改壞一個區塊，再分別用 restore 與 revert 把網站救回來。',
      },
      {
        title: '分支、Pull Request 與版本標籤',
        length: '約 35 分',
        objective: '開一個分支試做新功能，在 GitHub 用 Pull Request 檢視差異後合併回主分支；替上線的版本打標籤（例如 v0.1.0），並請 AI 設定只在推送標籤時才部署的 GitHub Actions。',
        result: '新區塊透過 Pull Request 合併；推送 v0.1.0 標籤後，網站自動更新到這個版本。',
      },
    ],
  },
  {
    num: '10',
    title: '整理專案結構',
    length: '約 1 小時 45 分',
    why: '本專案實作紀錄：網站做到一半，資料、頁面與內部工具混在一起；請 AI 檢視目錄樹、提出整理方案，把課程資料、公開頁面與內部工具分開，搬檔時同步改寫 import，再用型別檢查、build 與逐頁點擊驗證，最後更新 README。專案越大越需要這一步：結構清楚，AI 才找得到、改得對該改的檔案。',
    lessons: [
      {
        title: '為什麼結構會影響 AI 的表現',
        length: '約 25 分',
        objective: '理解資料夾與檔名就是給 AI 的地圖：資料、頁面和工具混在一起時，AI 容易改錯檔或只改一半；請 AI 列出目前的目錄樹，說明每個資料夾放什麼。',
        result: '一份專案目錄樹與每個資料夾的用途說明，並標出放錯位置或用途不清的檔案。',
      },
      {
        title: '請 AI 提出整理方案',
        length: '約 25 分',
        objective: '用簡短的提示詞請 AI 提出新結構（內容資料、頁面、內部工具分開），先只看方案、不動檔案，逐項確認或修改後再執行；開始搬之前先 commit。',
        result: '一份確認過的搬移清單（舊路徑 → 新路徑），以及搬移前的存檔點。',
      },
      {
        title: '搬檔並更新所有引用',
        length: '約 30 分',
        objective: '請 AI 依清單搬移檔案，同步改寫 import 與連結路徑；用 git status 確認搬移被記為改名（renamed），用型別檢查、build 與瀏覽器 Console 找出漏改的路徑。',
        result: '檔案搬到新位置，build 成功，Console 沒有找不到檔案的錯誤。',
      },
      {
        title: '逐頁驗證並更新 README',
        length: '約 25 分',
        objective: '逐頁點過網站（或請 AI 用瀏覽器自動化工具截圖每一頁）確認沒有壞掉，再請 AI 依新結構更新 README 的目錄說明，讓文件和程式一致。',
        result: '更新過的 README（含目錄樹與各資料夾用途），整理完成的變更 commit 收尾。',
      },
    ],
  },
  {
    num: '11',
    title: '網站上線必備：SEO 與流量分析',
    length: '約 2 小時',
    why: '本專案實作紀錄：網站上線前補齊每頁的 title、description、canonical 與 Open Graph 分享圖，產生 sitemap.xml 與 robots.txt，內部頁設 noindex，不存在的網址回傳真正的 404，加上 JSON-LD 結構化資料，並接上 GA4、更新隱私權政策。網址公開後，要讓搜尋引擎與分享預覽正確顯示，也要知道有沒有人來看。',
    lessons: [
      {
        title: '每一頁的標題、描述與分享預覽',
        length: '約 30 分',
        objective: '請 AI 替每一頁加上獨立的 title、description、canonical 網址與 Open Graph 標籤（含 1200×630 的分享圖），再用 curl 或瀏覽器的「檢視原始碼」確認內容正確。',
        result: '每一頁都有自己的標題、描述與分享圖。',
      },
      {
        title: '讓搜尋引擎找對頁面：sitemap、robots.txt 與 404',
        length: '約 30 分',
        objective: '請 AI 產生 sitemap.xml 與 robots.txt、替不公開的頁面加上 noindex、讓不存在的網址回傳真正的 404 狀態碼，並用 curl -I 檢查；把 sitemap 提交到 Google Search Console。',
        result: '網站有 sitemap.xml 與 robots.txt，內部頁不會被收錄，打錯的網址顯示 404 頁面並回傳 404。',
      },
      {
        title: '結構化資料（JSON-LD）',
        length: '約 25 分',
        objective: '請 AI 為首頁與主要頁面加上 JSON-LD 結構化資料（例如網站、課程），並用 Google 的複合式搜尋結果測試檢查有沒有錯誤。',
        result: '主要頁面附有 JSON-LD，測試工具檢查沒有錯誤。',
      },
      {
        title: 'GA4 流量分析與隱私權政策',
        length: '約 30 分',
        objective: '建立 GA4 資源，請 AI 用環境變數設定評估 ID 並在每次換頁時記錄瀏覽，用即時報表確認收得到資料；同步更新隱私權政策，說明使用的分析工具與 cookie。',
        result: 'GA4 即時報表看得到自己的造訪，隱私權政策寫明分析工具與 cookie 的用途。',
      },
    ],
  },
  {
    num: '12',
    title: '加入登入功能（進階）',
    length: '約 2 小時 20 分',
    why: '本專案實作紀錄：本站已用 AI 程式助手加入 Email＋密碼與 Google 登入（Go 後端、密碼雜湊、HttpOnly session cookie、本機 SQLite／正式環境 Cloud SQL Postgres、機密放 Secret Manager、登入流程的自動化測試、隱私權政策與服務條款）。這是 L2 最重的單元：需要後端、資料庫與雲端設定，已超出靜態網站；是否留在 L2 或移到 L3 見「待決定」。教學重點放在安全要求要說清楚、交給 AI 實作後要能驗證，而不是自己寫出每一行。',
    lessons: [
      {
        title: '登入在做什麼：密碼雜湊與 session',
        length: '約 30 分',
        objective: '請 AI 畫出登入流程（註冊 → 儲存使用者 → 登入 → 發出 session cookie → 之後的請求帶著 cookie），理解密碼為什麼只能存雜湊、session 為什麼要放在前端 JavaScript 讀不到的 HttpOnly cookie。',
        result: '一張登入流程圖，與一份要交給 AI 的安全要求清單。',
      },
      {
        title: 'Email 與密碼登入：後端與資料庫',
        length: '約 40 分',
        objective: '請 AI 依安全要求建立註冊、登入、登出 API 與使用者資料表（本機用 SQLite、正式環境用雲端 Postgres），金鑰與資料庫連線放在環境變數，.env 不進版控；登入後只能讀到自己的資料。',
        result: '在本機完成註冊、登入、登出，資料庫裡存的是密碼雜湊而不是密碼本身。',
      },
      {
        title: '用 Google 帳號登入',
        length: '約 35 分',
        objective: '在 Google Cloud Console 建立 OAuth 用戶端 ID 並設定允許的網址，請 AI 在後端驗證 Google 回傳的 ID Token 後再建立 session。',
        result: '用自己的 Google 帳號登入成功，頁面上顯示登入中的帳號。',
      },
      {
        title: '測試、上線與法律頁',
        length: '約 35 分',
        objective: '請 AI 為登入流程寫自動化測試（密碼錯誤、cookie 有 HttpOnly、未登入不能讀取個人資料）；上線時把機密放進雲端的機密管理服務（例如 Google Cloud Secret Manager），並更新隱私權政策與服務條款，說明收集哪些資料與用途。',
        result: '測試全部通過，正式網址可以登入，隱私權政策列出收集的資料與用途。',
      },
    ],
  },
  {
    num: '13',
    title: '用自動化測試防止 AI 改壞功能',
    length: '約 2 小時',
    why: '本專案實作紀錄：這個網站一路交給 AI 程式助手修改，一次改很多檔案時，「改 A 壞 B」很難靠肉眼逐頁檢查發現。因此加上了三層測試：Go 單元測試（go test）檢查後端與登入 API、Vitest 單元測試檢查課程資料與網址規則、Playwright 對正式版 build 跑端對端測試（sitemap 裡每個網址都回傳 200 且 SEO 標籤正確、上課頁的互動、登入流程、不存在的網址回 404），再用 GitHub Actions 在每次 push 時全部跑一遍；工作習慣是「每次改完先請 AI 跑測試，測試失敗就停下來修」。教學重點是學員說得出「什麼絕不能壞」、看得懂測試結果，測試程式交給 AI 寫。編號接在 12 之後（公開章節網址依編號產生），實際學習順序見「待決定」；12.4 的登入測試沿用本單元的做法。',
    lessons: [
      {
        title: '為什麼需要測試：AI 改 A 壞 B',
        length: '約 25 分',
        objective: '理解 AI 修改一處時可能讓別處壞掉，而且自己不一定會發現；測試就是把「這個功能要能用」寫成電腦能自動檢查的規則。分辨單元測試（檢查一小段程式或資料）與端對端測試（用瀏覽器操作整個網站）。',
        result: '一份自己網站「絕不能壞」的清單（例如每一頁都打得開、按鈕有反應、連結不會 404），作為之後寫測試的依據。',
      },
      {
        title: '讓 AI 寫第一個測試：先看它失敗，再看它通過',
        length: '約 30 分',
        objective: '請 AI 安裝單元測試工具（例如 Vitest），針對清單中的一項寫測試並用 npm test 執行；故意改壞程式確認測試會失敗、還原後再通過，知道從不失敗的測試證明不了什麼；測試失敗時要 AI 修程式，不准為了通過而改掉測試。',
        result: 'npm test 跑出第一個通過的測試，以及一次被測試抓到的錯誤。',
      },
      {
        title: '端對端測試：讓瀏覽器自動點過每一頁',
        length: '約 35 分',
        objective: '請 AI 用 Playwright 對 build 後的網站寫端對端測試：逐一打開每個網址，檢查回傳 200、標題正確、主要按鈕可以操作、打錯的網址顯示 404 頁面；看懂測試失敗時的錯誤訊息與截圖。',
        result: '一組一個指令就能跑完、自動點過全站的端對端測試。',
      },
      {
        title: '每次修改都自動跑：CI 與「改完先跑測試」',
        length: '約 30 分',
        objective: '請 AI 設定 GitHub Actions，在每次 push 與 Pull Request 時自動跑全部測試，並在 GitHub 上看懂通過或失敗的標記；養成習慣：每次請 AI 修改後先要它跑測試，測試失敗就先停下來修好，不 commit、不部署，並把這條規則寫進給 AI 看的專案說明。',
        result: 'GitHub 上每次 push 都有測試結果標記，專案說明寫明「改完先跑測試、失敗就先修」。',
      },
    ],
  },
  {
    num: '14',
    title: '寫出好維護的程式：改一個功能不會壞別的',
    length: '約 2 小時',
    why: '本專案實作紀錄：測試能抓到改壞的地方，但程式本身牽連太廣時，每次修改還是很容易出錯。這個網站的課程資料只放一份，路由、SEO 與研發基地頁都由它產生；教學畫面引擎改成 TypeScript 後，新增元件沒照介面寫就過不了型別檢查。單元 10 整理既有的檔案位置、單元 13 檢查有沒有改壞，這個單元教的是一開始就把程式寫得好改。',
    lessons: [
      {
        title: '為什麼改一處會壞別處：先看影響範圍',
        length: '約 25 分',
        objective: '認識最常見的兩個原因：同一件事寫在很多地方，以及一個檔案負責太多事；動手前先請 AI 列出這次修改會影響哪些檔案與功能，只看分析、不改程式。',
        result: '一份修改前的影響範圍清單，並標出自己專案中最容易牽一髮動全身的地方。',
      },
      {
        title: '同一件事只放一個地方',
        length: '約 30 分',
        objective: '請 AI 找出重複的文字、資料與畫面區塊，收斂成一份資料或一個共用元件，其他地方都從這裡取用；分辨值得共用的重複，與只是剛好長得像、之後會各自改變的程式。',
        result: '一項重複內容（例如導覽選單）改成只有一個來源，改一處就全站更新。',
      },
      {
        title: '把功能切開：一個檔案一件事',
        length: '約 35 分',
        objective: '請 AI 把過大的檔案拆成各司其職的小檔案，例如資料、計算邏輯與畫面分開；用函式參數與 TypeScript 型別約定各部分怎麼互動，故意改掉一個欄位名稱，看型別檢查指出所有要跟著改的地方。',
        result: '一個拆開後行為不變的功能（測試與 build 都通過），以及一次被型別檢查抓到的漏改。',
      },
      {
        title: '小步修改，把規則寫給 AI',
        length: '約 30 分',
        objective: '建立修改流程：一次只做一件事、先看方案再動手、看 diff 確認沒有多改、跑測試後才 commit；把專案的結構與慣例寫進給 AI 看的專案說明，讓 AI 每次都依同樣的方式修改，並用一個新功能走完整個流程。',
        result: '更新過的專案說明（結構、慣例、修改流程），以及一個小步完成、每個 commit 都能獨立理解的新功能。',
      },
    ],
  },
]
