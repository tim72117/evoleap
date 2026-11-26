// 主題頁(課程地圖)裡資料庫沒有欄位的手寫文案:開頭的大標、等級卡的簡述與重點、先備條件、插圖樣式。
// 等級名稱、課名、課程簡介、單元、每一課的一句話、先不公開、開放與否一律讀資料庫(courseMap.ts);主題名稱與標語讀 topics.ts 的 useTopics。

export type CourseStatus = 'available' | 'planned'

/** 'free' = 免費;'login-free' = 登入後免費;'subscription' = 訂閱客戶才能存取;'tbd' = 尚未決定(不顯示價格標籤) */
export type CourseAccess = 'free' | 'login-free' | 'subscription' | 'tbd'

/** 圖卡插圖樣式(對應 LevelArt.tsx 內的 SVG 插圖) */
export type CourseArt = 'tools' | 'chat' | 'build' | 'agent' | 'advanced'

/** 階段在課程頁上的位置:課程頁每個單元的 id */
export const stageAnchor = (id: string): string => `stage-${id}`

export const ACCESS_LABEL: Record<CourseAccess, string | null> = {
  free: '免費',
  // 2026-11-07 起每門課都是「序章免登入、第 0 課登入後免費、其餘訂閱」,整門課不再標「登入後免費」「訂閱專屬」
  // (哪些單課頁要登入照資料庫每一課的 access;單課的標示在課程總覽頁)
  'login-free': null,
  subscription: null,
  tbd: null,
}

/** 「做出自己的軟體」課程地圖頁的大標(說明段落讀資料庫:software 課程的 about) */
export const MAP_INTRO = {
  kicker: '零基礎也能開始',
  titleLines: ['不會寫程式，', '也能打造自己的軟體'],
}

/** 主題「打造 AI 互動軟體」的課程地圖頁開頭 */
export const AI_APPS_INTRO = {
  kicker: '不只是對話',
  titleLines: ['打造會動手做事的', 'AI 互動軟體'],
  pitch: '使用者打字提問，AI 自己判斷要用哪個工具：查資料、跑分析、畫出圖表。從寫出第一個工具開始，一路做到穩定上線。',
}

export type LevelCopy = {
  art: CourseArt
  /** 簡述:一兩句話的課程說明(「做出自己的軟體」的階段是單元,資料庫的單元沒有簡述欄位) */
  summary?: string
  /** 卡片上的重點(4–6 項);有寫就列重點,沒寫就列資料庫裡這個階段的每一課 */
  topics?: string[]
  /** 建議的先備條件 */
  prerequisite?: string
}

/** 「做出自己的軟體」各階段(key 是資料庫的單元 id);資料庫新增的單元沒有這裡的文案也照列 */
export const STAGE_COPY: Record<string, LevelCopy> = {
  tools: {
    art: 'tools',
    summary: '不用先學寫程式，第一堂課就讓 AI 在你的電腦上建好專案、做出一頁式網站。學會把想要的畫面說清楚，一步步調整到你滿意。',
    prerequisite: '會用電腦開資料夾、用瀏覽器上網即可；需要一台可以安裝軟體的電腦',
  },
  'ai-tools': {
    art: 'chat',
    summary: '跟著一家小店做預約系統的真實案例，用 AI 把一段口語描述變成清楚的需求清單和工作項目。下次接到新需求，套用範本幾分鐘就能整理好。',
    topics: [
      '做一張訂購單，學會哪些資料要在送出前檢查',
      '把老闆的一段話整理成需求清單，分出必要與加分項目',
      '找出沒說清楚的地方，寫出對方容易回答的問題',
      '拆成有驗收條件、可以直接開工的工作項目',
      '做成「需求 → 工作項目」範本，重複的事交給 AI',
    ],
    prerequisite: '不需要任何程式背景；建議先完成「AI 工具介紹」',
  },
  'vibe-coding-basics': {
    art: 'build',
    summary: '建好自己的開發環境，和 AI 程式助手一起做出網站並部署上線。再補上真實產品需要的版本管理、SEO、登入與自動化測試，做出能長期維護的作品。',
    topics: [
      '準備開發環境：編輯器、終端機與 Git',
      '和 AI 一起寫程式、除錯，把網站部署上線',
      '上線必備：SEO、流量分析與登入功能',
      '用自動化測試，確保 AI 不會改壞既有功能',
    ],
    prerequisite: '會使用 AI 工具，願意開始動手寫程式',
  },
}

/** 主題「打造 AI 互動軟體」的兩門課(由淺入深);課名、簡介、插圖讀資料庫 */
export const AI_APP_COURSES: {
  id: string
  levelLabel: string
  /** 課程頁連結;中階課沒有自己的頁面,介紹在主題頁的單元那一段(home/AiAgentIntro) */
  link: string
  /** 卡片重點;沒寫就列資料庫的單元名稱 */
  topics?: string[]
  prerequisite: string
}[] = [
  {
    id: 'ai-agent',
    levelLabel: '中階',
    link: '/topics/ai-apps#units',
    topics: [
      '看懂 Agent 運作：開發者定義工具、LLM 呼叫工具',
      '寫出第一個工具：名稱、描述與參數 Schema',
      '設計讓 LLM 準確理解、正確呼叫的工具',
      '期末專案：打字就能用的資料分析介面',
    ],
    prerequisite: '熟悉 JavaScript / TypeScript 與基礎 Web 前端開發，會使用終端機與 Git',
  },
  {
    id: 'advanced',
    levelLabel: '進階',
    link: '/courses/advanced',
    prerequisite: '完成中階課程或具備同等經驗',
  },
]
