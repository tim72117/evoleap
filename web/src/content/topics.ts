// 首頁的主題。一個主題是一組不同目標的課程:「做出自己的軟體」(levels.ts 的 LEVELS)與「打造 AI 互動軟體」(AI_APP_LEVELS)各有課程地圖頁。
// 規劃中的主題只放暫定的名稱、標語與預計做出的成果;不要寫未確認的事實(價格、日期、收入、學員數等)。
import { AI_APP_LEVELS } from './levels'

export const HOME_INTRO = {
  title: '把 AI 用在你真正想做的事',
  pitch: '選一個主題，跟著實際操作，做出看得見的成果。',
  description: '把 AI 用在你真正想做的事：選一個主題，跟著實際操作，從免費的入門課開始，做出看得見的成果。',
}

export const SOFTWARE_TOPIC = {
  name: '做出自己的軟體',
  slogan: '不會寫程式，也能打造自己的軟體',
  /** 課程地圖所在的頁面 */
  path: '/topics/software',
  /** 搜尋結果的標題與描述:寫學員會搜尋的說法,不要寫未確認的事實 */
  seoTitle: '不會寫程式也能做軟體：零基礎 AI 開發課程地圖',
  description: '零基礎也能開始：用 AI 工具做出網站與日常小工具，再學會串接自動化流程。免費從入門課開始，一步步做出自己的軟體。',
}

/** 主題「打造 AI 互動軟體」：中階、進階兩門課（levels.ts 的 AI_APP_LEVELS），都還在規劃中 */
export const AI_APPS_TOPIC = {
  name: '打造 AI 互動軟體',
  slogan: '不只是對話，讓 AI 查資料、跑分析、畫出圖表',
  path: '/topics/ai-apps',
  seoTitle: 'AI 互動軟體開發課程：讓 AI 查資料、跑分析、畫圖表',
  description: '學會打造會動手做事的 AI 軟體：寫出工具、讓 AI 自己判斷要呼叫哪一個，做成打字提問就能用的介面，並穩定上線。課程規劃中。',
}

/** 課程所在的主題(依課程頁路徑判斷):麵包屑、「課程地圖」連結用 */
export function topicOfCourse(coursePath: string): { name: string; path: string } {
  return AI_APP_LEVELS.some((l) => l.link === coursePath) ? AI_APPS_TOPIC : SOFTWARE_TOPIC
}

export type PlannedTopic = {
  name: string
  slogan: string
  /** 已有課程地圖頁的主題：首頁卡片連到這裡 */
  path?: string
  /** 預計會做出的成果 */
  outcomes: string[]
  /** 過程的步驟(沒有 sample 時顯示) */
  flow?: string[]
  /** 整理前後的示意 */
  sample?: { caption: string; before: string[]; after: string[] }
}

export const PLANNED_TOPICS: PlannedTopic[] = [
  {
    ...AI_APPS_TOPIC,
    flow: ['寫出工具', '讓 AI 呼叫工具', '做成互動介面'],
    outcomes: ['打字提問就能用的資料分析介面', '能查資料、畫圖表的 AI 助理', '可以穩定上線的 AI 功能'],
  },
  {
    name: 'AI 變現術',
    slogan: '把你會的事，變成有人願意付錢的服務',
    flow: ['找出專長', '做成小工具', '寫出第一份報價'],
    outcomes: ['一個能收費的小工具', '一份數位商品', '一份接案報價單'],
  },
  {
    name: '生活資料處理',
    slogan: '帳單、照片、表格，交給 AI 整理',
    sample: {
      caption: '示意：把散落的檔案整理好',
      before: ['IMG_2031.jpg', '帳單(1).pdf', '新增資料夾 (3)'],
      after: ['照片/2026-07/海邊-01.jpg', '帳單/2026-07-電費.pdf', '支出/2026-07.xlsx'],
    },
    outcomes: ['每月支出表', '依日期分類好的照片資料夾', '合併好、沒有重複的表格'],
  },
]
