import { describe, expect, it } from 'vitest'
import { FREE_LEVELS, pricingHref, safeNext, SUBSCRIPTION_LEVELS } from './plans'

describe('safeNext', () => {
  it('只接受站內路徑', () => {
    expect(safeNext('/courses/software/4-1')).toBe('/courses/software/4-1')
    expect(safeNext('/courses/software/4-1?t=3')).toBe('/courses/software/4-1?t=3')
  })

  it('其他一律回傳 null', () => {
    for (const bad of [null, undefined, '', 'courses', '//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)']) {
      expect(safeNext(bad), String(bad)).toBeNull()
    }
  })
})

describe('pricingHref', () => {
  it('帶上編碼過的 next;不安全或沒帶就只有方案頁', () => {
    expect(pricingHref('/courses/software/4-1?t=3')).toBe('/pricing?next=%2Fcourses%2Fsoftware%2F4-1%3Ft%3D3')
    expect(pricingHref()).toBe('/pricing')
    expect(pricingHref('//evil.com')).toBe('/pricing')
  })
})

describe('課程分組', () => {
  it('免費與訂閱課程不重複,也不列尚未決定的課程', () => {
    const ids = [...FREE_LEVELS, ...SUBSCRIPTION_LEVELS].map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...FREE_LEVELS, ...SUBSCRIPTION_LEVELS].some((l) => l.access === 'tbd')).toBe(false)
    expect(SUBSCRIPTION_LEVELS.map((l) => l.id)).toContain('vibe-coding-basics')
  })
})
