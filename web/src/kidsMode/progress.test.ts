import { describe, expect, it } from 'vitest'
import { isLockedLesson, kidsProgressOf } from './progress'

// 進度鎖只看傳入的課號清單(執行時是資料庫課程地圖裡開放的課)
const SAMPLE_OPEN_LESSONS = ['0.1', '0.2', '0.3', '1.1']

describe('兒童模式的進度鎖', () => {
  const [first, second, third] = SAMPLE_OPEN_LESSONS

  it('還沒看任何一課:只有第一課打得開', () => {
    const p = kidsProgressOf(new Set(), SAMPLE_OPEN_LESSONS)
    expect(p.next).toBe(first)
    expect([first, second, third].map((id) => isLockedLesson(p, id))).toEqual([false, true, true])
  })

  it('看完的與接下來要上的那一課打得開,之後的鎖住', () => {
    const p = kidsProgressOf(new Set([first]), SAMPLE_OPEN_LESSONS)
    expect(p.next).toBe(second)
    expect([first, second, third].map((id) => isLockedLesson(p, id))).toEqual([false, false, true])
  })

  it('全部看完:都打得開', () => {
    const p = kidsProgressOf(new Set(SAMPLE_OPEN_LESSONS), SAMPLE_OPEN_LESSONS)
    expect(p.next).toBeNull()
    expect(SAMPLE_OPEN_LESSONS.some((id) => isLockedLesson(p, id))).toBe(false)
  })
})
