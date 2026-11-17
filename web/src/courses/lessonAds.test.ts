import { describe, expect, it } from 'vitest'
import type { User } from '../auth/api'
import { COURSES } from '../content/catalog'
import { lessonAllowsAds, userSeesAds } from './lessonAds'

const tools = COURSES.find((c) => c.slug === 'tools')!
const lesson = (id: string) => tools.lessons.find((l) => l.id === id)!
const user: User = { id: 'u1', email: 'a@example.com', name: 'A', createdAt: '2026-11-09T00:00:00Z' }

describe('lessonAllowsAds', () => {
  // 第 0 課(0.0,準備工具)2026-11-17 上架後是第一堂正課
  it('序章和第一堂正課(第 0 課)沒有廣告', () => {
    expect(lessonAllowsAds(tools, lesson('0.intro'))).toBe(false)
    expect(lessonAllowsAds(tools, lesson('0.0'))).toBe(false)
  })

  it('第 1 課之後可以放廣告', () => {
    expect(lessonAllowsAds(tools, lesson('0.1'))).toBe(true)
    expect(lessonAllowsAds(tools, lesson('0.2'))).toBe(true)
    expect(lessonAllowsAds(tools, lesson('0.3'))).toBe(true)
  })

  it('每門課的第一堂正課(草稿不算)都沒有廣告', () => {
    for (const course of COURSES) {
      const first = course.lessons.find((l) => !l.label && !l.draft)
      if (first) expect(lessonAllowsAds(course, first)).toBe(false)
    }
  })
})

describe('userSeesAds', () => {
  it('只有登入、沒訂閱的一般使用者看廣告', () => {
    expect(userSeesAds(user)).toBe(true)
    expect(userSeesAds(null)).toBe(false)
    expect(userSeesAds({ ...user, subscribed: true })).toBe(false)
    expect(userSeesAds({ ...user, isAdmin: true })).toBe(false)
  })
})
