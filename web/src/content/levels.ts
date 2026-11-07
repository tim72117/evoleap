// 課程地圖的資料。由上往下 = 由淺入深。LEVELS 是主題「做出自己的軟體」，AI_APP_LEVELS 是主題「打造 AI 互動軟體」（見 topics.ts）。
// 規劃中('planned')的課程只放暫定名稱、簡述與暫定的課程內容主題;不要在這裡寫未確認的事實
// (價格、日期、堂數、講師、評價等)。要新增 / 調整等級,直接編輯 LEVELS 陣列即可。
import { AI_AGENT_COURSE_PATH, COURSE } from './aiAgent'

export type CourseStatus = 'available' | 'planned'

/** 'free' = 免費;'login-free' = 登入後免費;'subscription' = 訂閱客戶才能存取;'tbd' = 尚未決定(不顯示價格標籤) */
export type CourseAccess = 'free' | 'login-free' | 'subscription' | 'tbd'

/** 圖卡插圖樣式(對應 HomePage.tsx 內的 SVG 插圖) */
export type CourseArt = 'tools' | 'chat' | 'build' | 'agent' | 'advanced'

export type CourseLevel = {
  /** 用於錨點(#level-<id>)與 React key */
  id: string
  /** 等級名稱,例如「零基礎」「中階」 */
  levelLabel: string
  title: string
  /** 簡述:一兩句話的課程說明 */
  summary: string
  /** 課程內容主題(4–6 項),還沒有對應單課時用;首頁以兩欄短句呈現 */
  topics?: string[]
  /** 已寫成單課的等級:依課列出(首頁以單欄編號清單呈現,連到各課,並依實際開放的課顯示標籤)。
   *  id 對應 l0Lessons.ts 等單課資料;text 是一行能放下的一句話 */
  lessons?: { id: string; text: string }[]
  /** 'available' = 已有課程內容;'planned' = 規劃中(顯示「規劃中」標籤) */
  status: CourseStatus
  access: CourseAccess
  art: CourseArt
  /** 課程頁連結(站內路徑);沒有就不顯示按鈕 */
  link?: string
  /** 建議的先備條件 */
  prerequisite?: string
}

export const ACCESS_LABEL: Record<CourseAccess, string | null> = {
  free: '免費',
  // 2026-11-07 起每門課都是「序章免登入、第 0 課登入後免費、其餘訂閱」,整門課不再標「登入後免費」「訂閱專屬」
  // (access 仍決定哪些單課頁要登入,見 catalog.ts 的 requiresLogin;單課的標示在課程總覽頁)
  'login-free': null,
  subscription: null,
  tbd: null,
}

/** 主題「做出自己的軟體」的一句話說明:首頁卡片、課程地圖頁、搜尋描述共用 */
export const SOFTWARE_LEDE = '線上互動課程，學習透過對話，打造真的能上線的軟體'

export const MAP_INTRO = {
  kicker: '零基礎也能開始',
  titleLines: ['不會寫程式，', '也能打造自己的軟體'],
  pitch: `${SOFTWARE_LEDE}。從第一次用 AI 開始，一步步學會做出自己的工具、串起自動化工作流程，把每天重複的瑣事交給電腦，把時間留給真正重要的工作。從免費的入門課出發，找到適合你的起點。`,
}

export const LEVELS: CourseLevel[] = [
  {
    id: 'tools',
    levelLabel: '起步',
    title: 'AI 工具介紹：讓 AI 在你的電腦上做出第一個網站',
    summary: '不用先學寫程式，第一堂課就讓 AI 在你的電腦上建好專案、做出一頁式網站。學會把想要的畫面說清楚，一步步調整到你滿意。',
    lessons: [
      { id: '0.intro', text: '為什麼不用學寫程式，也能做出軟體' },
      { id: '0.0', text: '安裝會操作檔案的 AI 工具，學會安全地允許與拒絕' },
      { id: '0.1', text: '認識專案與工作目錄，讓 AI 幫你建立、搬移檔案' },
      { id: '0.2', text: '一段話描述，做出一頁式網站，再精確調整到滿意' },
    ],
    status: 'planned',
    access: 'login-free',
    art: 'tools',
    link: '/courses/tools',
    prerequisite: '會用電腦開資料夾、用瀏覽器上網即可；需要一台可以安裝軟體的電腦',
  },
  {
    id: 'ai-tools',
    levelLabel: '零基礎',
    title: 'AI 工具入門：用 AI 把點子整理成可以開工的需求',
    summary: '跟著一家小店做預約系統的真實案例，用 AI 把一段口語描述變成清楚的需求清單和工作項目。下次接到新需求，套用範本幾分鐘就能整理好。',
    topics: [
      '做一張訂購單，學會哪些資料要在送出前檢查',
      '把老闆的一段話整理成需求清單，分出必要與加分項目',
      '找出沒說清楚的地方，寫出對方容易回答的問題',
      '拆成有驗收條件、可以直接開工的工作項目',
      '做成「需求 → 工作項目」範本，重複的事交給 AI',
    ],
    status: 'planned',
    access: 'login-free',
    art: 'chat',
    link: '/courses/ai-tools',
    prerequisite: '不需要任何程式背景；建議先完成「AI 工具介紹」',
  },
  {
    id: 'vibe-coding-basics',
    levelLabel: '基礎',
    title: 'Vibe Coding 入門：用 AI 做出你的第一個小工具',
    summary: '建好自己的開發環境，和 AI 程式助手一起做出網站並部署上線。再補上真實產品需要的版本管理、SEO、登入與自動化測試，做出能長期維護的作品。',
    topics: [
      '準備開發環境：編輯器、終端機與 Git',
      '和 AI 一起寫程式、除錯，把網站部署上線',
      '上線必備：SEO、流量分析與登入功能',
      '用自動化測試，確保 AI 不會改壞既有功能',
    ],
    status: 'planned',
    access: 'subscription',
    art: 'build',
    link: '/courses/vibe-coding',
    prerequisite: '會使用 AI 工具，願意開始動手寫程式',
  },
]

/** 主題「打造 AI 互動軟體」的課程地圖頁開頭 */
export const AI_APPS_INTRO = {
  kicker: '不只是對話',
  titleLines: ['打造會動手做事的', 'AI 互動軟體'],
  pitch: '使用者打字提問，AI 自己判斷要用哪個工具：查資料、跑分析、畫出圖表。從寫出第一個工具開始，一路做到穩定上線。',
}

/** 主題「打造 AI 互動軟體」的課程,由淺入深 */
export const AI_APP_LEVELS: CourseLevel[] = [
  {
    id: 'ai-agent',
    levelLabel: '中階',
    title: COURSE.fullTitle,
    summary: '跟著真實開源專案，做出用自然語言操作的 AI 助理：使用者打字提問，Agent 自動判讀、跑分析、畫出合適的圖表。',
    // 取自課程頁既有的單元與學習成果(src/content/aiAgent.ts)
    topics: [
      '看懂 Agent 運作：開發者定義工具、LLM 呼叫工具',
      '寫出第一個工具：名稱、描述與參數 Schema',
      '設計讓 LLM 準確理解、正確呼叫的工具',
      '期末專案：打字就能用的資料分析介面',
    ],
    status: 'planned',
    access: 'tbd',
    art: 'agent',
    link: AI_AGENT_COURSE_PATH,
    prerequisite: '熟悉 JavaScript / TypeScript 與基礎 Web 前端開發，會使用終端機與 Git',
  },
  {
    id: 'advanced',
    levelLabel: '進階',
    title: '進階 AI Agent 應用',
    summary: '讓 Agent 從能用變成可靠：串接多個工具完成複雜任務，管好權限與安全，評估回應品質，穩定上線運作。',
    topics: [
      '串接多個工具與步驟的 Agent 流程',
      '權限與安全：讓 Agent 安全地動手做事',
      '測試與評估 Agent 的回應品質',
      '上線、監控與維運',
    ],
    status: 'planned',
    access: 'tbd',
    art: 'advanced',
    link: '/courses/advanced',
    prerequisite: '完成中階課程或具備同等經驗',
  },
]

/** 所有主題的課程(課程目錄、資料檢查用) */
export const ALL_LEVELS: CourseLevel[] = [...LEVELS, ...AI_APP_LEVELS]
