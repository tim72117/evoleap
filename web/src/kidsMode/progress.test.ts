import { describe, expect, it } from 'vitest'
import { KIDS_RELEASED_LESSONS } from '../content/kidsCourse'
import { isLockedLesson, kidsProgressOf } from './progress'

describe('兒童模式的進度鎖', () => {
  const [first, second, third] = KIDS_RELEASED_LESSONS

  it('還沒看任何一課:只有第一課打得開', () => {
    const p = kidsProgressOf(new Set(), KIDS_RELEASED_LESSONS)
    expect(p.next).toBe(first)
    expect([first, second, third].map((id) => isLockedLesson(p, id))).toEqual([false, true, true])
  })

  it('看完的與接下來要上的那一課打得開,之後的鎖住', () => {
    const p = kidsProgressOf(new Set([first]), KIDS_RELEASED_LESSONS)
    expect(p.next).toBe(second)
    expect([first, second, third].map((id) => isLockedLesson(p, id))).toEqual([false, false, true])
  })

  it('全部看完:都打得開', () => {
    const p = kidsProgressOf(new Set(KIDS_RELEASED_LESSONS), KIDS_RELEASED_LESSONS)
    expect(p.next).toBeNull()
    expect(KIDS_RELEASED_LESSONS.some((id) => isLockedLesson(p, id))).toBe(false)
  })
})
