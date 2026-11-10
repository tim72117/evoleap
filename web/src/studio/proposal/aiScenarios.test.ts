import { describe, expect, it } from 'vitest'
import data from '../../content/live/data/ai-scenarios.json'
import type { AiScenariosData } from './aiScenarios'

// 清單是研發基地的資料檔(content/live/data/ai-scenarios.json),測試直接讀檔
const { stages: SCENARIO_STAGES, themes: SCENARIO_THEMES } = data as AiScenariosData

describe('AI 自動化情境清單', () => {
  const titles = SCENARIO_STAGES.flatMap((s) => s.scenarios.map((x) => x.title))

  it('情境名稱不重複', () => {
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('建議主題挑的情境都在清單裡', () => {
    for (const t of SCENARIO_THEMES) for (const p of t.picks) expect(titles).toContain(p)
  })
})
