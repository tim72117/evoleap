// 「AI Agent 整合應用」(中階課)的介紹內容,顯示在「打造 AI 互動軟體」主題頁(/topics/ai-apps,home/AiAgentIntro.tsx);中階課沒有自己的頁面,/courses/ai-agent 轉到主題頁。
// 這裡只放資料庫沒有欄位的外觀文案;課名、單元名稱與單元目標讀資料庫(ai-agent 的課程地圖)。全部取自 repo 內既有資料,不要在這裡新增未確認的事實
// (價格、日期、講師介紹、評價等):
// - 標題、描述、適合對象、學習成果、背景知識:課程目標文章(src/studio/articles/pages/CourseGoalsPage.tsx)
//   (同 web/src/studio/proposal/FieldsPage.tsx)
// - 單元的核心概念與實作:web/src/studio/proposal/StructurePage.tsx(只列「保留」的單元與期末專案)
// - 教學方式:研究報告文章(src/studio/articles/pages/ResearchReportPage.tsx)的製作建議清單

/** 主題頁結構化資料裡這門課的介紹(比資料庫的課程簡介長,是另一段文字) */
export const AI_AGENT_PITCH =
  '跟著真實開源專案，打造一個用自然語言操作的 AI 助理：讓使用者打字問問題，Agent 自動判讀問題、跑分析、繪製合適的統計圖表，做出一個能上線的整合應用。'

export const OUTCOMES: { title: string; body: string }[] = [
  {
    title: '自然語言介面',
    body: '把一個操作畫面改造成「打字就能用」的自然語言介面，讓 AI 自動理解使用者的問題、選對工具並執行。',
  },
  {
    title: '工具 Schema 設計',
    body: '設計一個 LLM 可呼叫的工具介面，寫出 LLM 能準確理解、正確呼叫的參數 Schema。',
  },
  {
    title: '完成上線的期末專案',
    body: '獨立完成一個涵蓋多種工具類型、並已上線的完整 AI Agent 整合應用。',
  },
  {
    title: '可遷移的設計邏輯',
    body: '掌握工具呼叫的共通設計邏輯，能直接用來快速打造自然語言驅動的介面，不被單一工具綁住。',
  },
]

export const AUDIENCE_FIT: string[] = [
  '具備 JavaScript/TypeScript 基礎、想把 LLM 工具呼叫（tool calling）整合進自己產品的前端或全端工程師',
  '想了解 AI Agent 如何「真正動手做事」而不只是聊天機器人的開發者',
  '需要在工作中評估或導入 AI Agent 整合方案的技術主管',
  '想徹底搞懂工具呼叫的底層原理，學完後能快速為自己的產品打造自然語言驅動介面的學員',
]

export const AUDIENCE_NOT_FIT: string[] = [
  '完全沒有 Web 開發經驗、不熟悉 JavaScript 基礎語法的初學者',
  '想學習 LLM 模型訓練或底層原理的學員（本課程專注在應用整合層，不涉及模型訓練）',
]

export const PREREQUISITES: string[] = [
  '熟悉 JavaScript / TypeScript 基本語法與基礎 Web 前端開發（DOM、fetch/WebSocket、npm 套件管理）',
  '會使用終端機與 Git 進行基本版本控制操作',
  '不需要具備機器學習或 LLM 模型訓練相關背景知識',
]

/** 單元卡片資料庫沒有的欄位,key 是資料庫的單元 id */
export const UNIT_COPY: Record<string, { /** 顯示用編號;沒寫用單元 id */ num?: string; concepts: string; practice: string; planned?: boolean }> = {
  '0': { concepts: 'App 與工具的關係、控制台導覽、命令列工具安裝。', practice: '註冊帳號，跑過一個既有 App，看懂它的結構。' },
  '1': { concepts: '參數 Schema、YAML／JSON 兩種定義格式。', practice: '建立一個「填表單」工具，在測試環境裡實際呼叫看看。' },
  capstone: { num: '★', concepts: '綜合運用前面單元的工具設計與呼叫流程。', practice: '驗收清單規劃中。', planned: true },
}

export const TEACHING: { title: string; body: string }[] = [
  {
    title: '短片切段',
    body: '每支影片控制在 6–9 分鐘、一次只講一個想法，依專案的自然斷點（一個工具定義、一條呼叫鏈路）切分。',
  },
  {
    title: '每單元先做出成果',
    body: '每個單元一開始就安排一次小而完整、看得到結果的動手練習，例如成功呼叫一個工具並看到回應。',
  },
  {
    title: '先講 why，再講 how',
    body: '程式碼演示先說明這段要解決什麼問題，再聚焦 1–3 行核心邏輯，執行看結果，最後提醒常見踩坑點。',
  },
  {
    title: '預先寫好、分段重現',
    body: '不做冗長的即時除錯直播；以準備好的最終版程式碼為地圖，分段打字重現關鍵變更，節奏清楚好跟上。',
  },
  {
    title: 'Vibe Coding 實作',
    body: '課程採 Vibe Coding 方式實作，使用 Claude Code 以 AI 輔助寫程式，把介面實際做出來。',
  },
  {
    title: '看得清楚的畫面',
    body: '1080p 16:9 錄製，編輯器與瀏覽器／終端機並排，大字體、高對比主題。',
  },
]
