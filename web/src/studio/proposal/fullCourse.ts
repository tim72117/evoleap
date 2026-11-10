// 全環節課程清單：做出一個網站服務從準備、規劃、開發、測試、上線、營運到行銷，每個環節都交給 AI 程式助手完成。
// 以 L2「Vibe Coding 入門」（content/l2Outline.ts）為底，再補上 DNS、GCP、金流、監控、行銷等完整環節；和現有課程重疊沒關係。
// 每個環節都是兩堂課：一堂基礎知識（know），一堂用 AI 完成這個項目（ai）；完成的方式不固定，見 Mode。
// 最後一個階段「讓 AI 順利工作」接續 AI 自動化情境清單（aiScenarios.ts）。這是選題用的大清單，還沒排進任何課程。頁面在 FullCoursePage.tsx。
// 清單內容是研發基地的資料檔 content/live/data/full-course.json（寫入課程資料時進資料庫，頁面用 ../studioData.ts 讀），這裡只留型別與編號、路徑的規則。

/**
 * 用 AI 完成的方式：
 * once 交代清楚後一次做完；rounds 要來回幾次（看結果、指出問題、再改）；
 * tool 先請 AI 做一個小工具或腳本來協助；manual AI 碰不到的頁面（網域商、雲端主控台、付款），請 AI 寫操作步驟、你照做並回報。
 */
export type Mode = 'once' | 'rounds' | 'tool' | 'manual'

export const MODE_LABEL: Record<Mode, string> = {
  once: '一次完成',
  rounds: '來回修正',
  tool: '自建工具',
  manual: '操作步驟',
}

export type FullLesson = {
  title: string
  /** 基礎知識課：要先懂的概念 */
  know: string
  /** 用 AI 完成課：怎麼讓 AI 做完這個項目 */
  ai: string
  mode: Mode[]
  /** 做完時手上會有什麼 */
  result: string
  /** 一定要自己來的部分（付款、密碼、身分驗證、法律責任等） */
  human?: string
  /** 對應 L2 現有的課號（例如 '4.1'） */
  from?: string
}

export type FullUnit = {
  title: string
  lessons: FullLesson[]
}

export type FullStage = {
  id: string
  title: string
  units: FullUnit[]
}

/** 全環節課程清單的資料檔(研發基地的資料,見 ../studioData.ts) */
export type FullCourseData = { stages: FullStage[] }

export type FullCourseKind = 'know' | 'ai'
export const KIND_LABEL: Record<FullCourseKind, string> = { know: '基礎知識', ai: '用 AI 完成' }

export type FullItem = { code: string; unit: number; unitTitle: string; stage: string; lesson: FullLesson }

/** 單元依環節連續編號（1、2、3…），環節編號為「單元.第幾項」，例如 17.2 */
export function fullItems(stages: FullStage[]): FullItem[] {
  let n = 0
  return stages.flatMap((s) =>
    s.units.flatMap((u) => {
      n += 1
      const unit = n
      return u.lessons.map((lesson, i) => ({ code: `${unit}.${i + 1}`, unit, unitTitle: u.title, stage: s.title, lesson }))
    }),
  )
}

/** 試做腳本的路徑（相對於 src/content/live/），例如 lab/full-course/17.2-ai.json */
export const fullScriptPath = (code: string, kind: FullCourseKind): string => `lab/full-course/${code}-${kind}.json`
/** 試做頁的路由(routes.tsx、seo/internalPages.ts 共用) */
export const FULL_TRIAL_ROUTE = '/studio/full-course/:item/:kind'
/** 試做頁網址，例如 /studio/full-course/17-2/ai */
export const fullTrialPath = (code: string, kind: FullCourseKind): string => `/studio/full-course/${code.replace('.', '-')}/${kind}`
