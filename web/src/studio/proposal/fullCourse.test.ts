import { describe, expect, it } from 'vitest'
import { L2_MODULES } from '../../content/l2Outline'
import data from '../../content/live/data/full-course.json'
import type { FullCourseData } from './fullCourse'

// 清單是研發基地的資料檔(content/live/data/full-course.json),測試直接讀檔
const FULL_STAGES = (data as FullCourseData).stages

describe('全環節課程清單', () => {
  const lessons = FULL_STAGES.flatMap((s) => s.units.flatMap((u) => u.lessons))

  it('課名不重複', () => {
    const titles = lessons.map((l) => l.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('每個環節都有基礎知識與用 AI 完成的方式', () => {
    for (const l of lessons) {
      expect(l.know, l.title).not.toBe('')
      expect(l.ai, l.title).not.toBe('')
      expect(l.mode.length, l.title).toBeGreaterThan(0)
    }
  })

  it('標的 L2 課號都存在', () => {
    const l2 = new Set<string>(L2_MODULES.flatMap((m) => m.lessons.map((_, i) => `${m.num}.${i + 1}`)))
    for (const l of lessons.filter((x) => x.from)) {
      expect(l2.has(l.from!), l.from).toBe(true)
    }
  })
})
