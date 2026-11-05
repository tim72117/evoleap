import { describe, expect, it } from 'vitest'
import { accessLabel, ALL_LEVELS, planTierOf } from './levels'

describe('課程標籤', () => {
  it('訂閱課程標出需要的方案,其他課程照存取方式', () => {
    const label = (id: string) => accessLabel(ALL_LEVELS.find((level) => level.id === id)!)
    // 2026-11-07 起整門課不標「登入後免費」(ACCESS_LABEL 是 null),單課的標示在課程總覽頁
    expect(label('tools')).toBeNull()
    expect(label('ai-tools')).toBeNull()
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
