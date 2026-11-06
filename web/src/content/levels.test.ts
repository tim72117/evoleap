import { describe, expect, it } from 'vitest'
import { accessLabel, ALL_LEVELS, planTierOf } from './levels'

describe('課程標籤', () => {
  it('訂閱課程標出需要的方案,其他課程照存取方式', () => {
    const label = (id: string) => accessLabel(ALL_LEVELS.find((level) => level.id === id)!)
    expect(label('tools')).toBe('免費')
    expect(label('ai-tools')).toBe('登入後免費')
    expect(label('vibe-coding-basics')).toBe('基礎方案')
    expect(label('ai-agent')).toBe('進階方案')
    expect(label('advanced')).toBe('進階方案')
  })

  it('每門訂閱課程都在 courses_seed.json 寫了方案', () => {
    for (const level of ALL_LEVELS.filter((l) => l.access === 'subscription')) {
      expect(planTierOf(level.id), level.id).toBeDefined()
    }
  })
})
