import { describe, expect, it } from 'vitest'
import { SCENARIO_STAGES, SCENARIO_THEMES } from './aiScenarios'

describe('AI 自動化情境清單', () => {
  const titles = SCENARIO_STAGES.flatMap((s) => s.scenarios.map((x) => x.title))

  it('情境名稱不重複', () => {
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('建議主題挑的情境都在清單裡', () => {
    for (const t of SCENARIO_THEMES) for (const p of t.picks) expect(titles).toContain(p)
  })
})
