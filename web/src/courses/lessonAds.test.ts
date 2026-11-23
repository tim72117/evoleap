import { describe, expect, it } from 'vitest'
import type { User } from '../auth/api'
import type { CourseMap } from '../content/courseMap'
import { SEED_COURSES, seedCourse } from '../content/courseSeed'
import { lessonAllowsAds, userSeesAds } from './lessonAds'

// 起步階段(tools)的課是「做出自己的軟體」這門課的最前面幾課(課程結構來自種子)
// 執行期的課程地圖(API)和種子同形;這裡用種子當地圖
const mapOf = (id: string): CourseMap => seedCourse(id) as unknown as CourseMap
const tools = mapOf('software')
const lesson = (id: string) => ({ id })
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
    for (const course of SEED_COURSES) {
      const first = course.units.flatMap((u) => u.lessons).find((l) => l.id !== '0.intro' && l.status === 'open')
      if (first) expect(lessonAllowsAds(mapOf(course.id), first)).toBe(false)
    }
  })
})

describe('資料來源是 API 的課程地圖(CLI 改狀態立即生效)', () => {
  const unit = (statuses: ('open' | 'draft' | 'planned')[]) =>
    ({ units: [{ id: 'u', lessons: statuses.map((status, i) => ({ id: `1.${i}`, status })) }] }) as unknown as CourseMap
  it('第一堂正課是第一個 open 的課;草稿與規劃中不算', () => {
    const m = unit(['draft', 'open', 'open'])
    expect(lessonAllowsAds(m, lesson('1.1'))).toBe(false)
    expect(lessonAllowsAds(m, lesson('1.2'))).toBe(true)
    // 管理員把 1.0 開放後,第一堂正課換成 1.0
    expect(lessonAllowsAds(unit(['open', 'open', 'open']), lesson('1.1'))).toBe(true)
  })
  it('地圖還沒讀到不放廣告', () => {
    expect(lessonAllowsAds(undefined, lesson('0.3'))).toBe(false)
  })
})

describe('分階段的課', () => {
  it('只有整門課的第一堂正課(起步 0.0)沒有廣告,零基礎階段的第一課可以放廣告', () => {
    expect(lessonAllowsAds(tools, lesson('1.0'))).toBe(true)
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
