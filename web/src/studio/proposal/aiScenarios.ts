// AI 自動化情境清單：開發、偵錯、部署、營運、行銷過程中，原本繁雜或困難、可以交給 AI 自動處理的情境。
// 還沒排進任何課程；之後決定主題時，從這裡挑情境組合成單元。頁面在 AiScenariosPage.tsx。
// 清單內容是研發基地的資料檔 content/live/data/ai-scenarios.json（寫入課程資料時進資料庫），這裡只留型別。

export type AiScenario = {
  title: string
  /** 原本難在哪 */
  hard: string
  /** AI 接手做什麼 */
  ai: string
  /** 做這個網站時實際遇過的情境（可以直接當教材），沒有就不填 */
  ours?: string
}

export type ScenarioStage = {
  id: string
  title: string
  scenarios: AiScenario[]
}

export type ScenarioTheme = { title: string; why: string; picks: string[] }

/** AI 情境清單的資料檔(研發基地的資料,見 ../studioData.ts):stages 是各階段的情境,themes 是可以先組的主題(只是建議,還沒決定) */
export type AiScenariosData = { stages: ScenarioStage[]; themes: ScenarioTheme[] }
