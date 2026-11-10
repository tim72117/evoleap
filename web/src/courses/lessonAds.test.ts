import { describe, expect, it } from 'vitest'
import type { User } from '../auth/api'
import { COURSES } from '../content/catalog'
import { lessonAllowsAds, userSeesAds } from './lessonAds'

const software = COURSES.find((c) => c.slug === 'software')!
const lesson = (id: string) => software.lessons.find((l) => l.id === id)!
const user: User = { id: 'u1', email: 'a@example.com', name: 'A', createdAt: '2026-11-09T00:00:00Z' }

describe('lessonAllowsAds', () => {
  it('序章和第 0 課沒有廣告', () => {
    expect(lessonAllowsAds(software, lesson('0.intro'))).toBe(false)
    expect(lessonAllowsAds(software, lesson('0.0'))).toBe(false)
  })

  it('第 1 課之後可以放廣告', () => {
    expect(lessonAllowsAds(software, lesson('0.1'))).toBe(true)
    expect(lessonAllowsAds(software, lesson('0.2'))).toBe(true)
  })

  it('每門課的第一堂正課都沒有廣告;分階段的課是每個階段的第一堂正課', () => {
    for (const course of COURSES) {
      for (const lessons of course.stages ? course.stages.map((st) => st.lessons) : [course.lessons]) {
        const first = lessons.find((l) => !l.label)
        if (first) expect(lessonAllowsAds(course, first), `${course.slug} ${first.id}`).toBe(false)
      }
    }
  })

  it('零基礎階段:第一堂正課(1.0)沒有廣告,之後的課有;起步的序章與 0.0 沒有廣告不影響它', () => {
    expect(lessonAllowsAds(software, lesson('1.0'))).toBe(false)
    expect(lessonAllowsAds(software, lesson('1.1'))).toBe(true)
    expect(lessonAllowsAds(software, lesson('1.2'))).toBe(true)
  })

  it('每個階段除了序章與第一堂正課,其他課都可以放廣告', () => {
    for (const st of software.stages!) {
      const regular = st.lessons.filter((l) => !l.label)
      for (const l of regular.slice(1)) expect(lessonAllowsAds(software, l), l.id).toBe(true)
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
