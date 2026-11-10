import { describe, expect, it } from 'vitest'
import { dateLabel, parentWeek, planWeek, taipeiNow } from './plan'
import type { Slot } from './schedule'

const slots: Slot[] = [
  { day: 5, time: '10:00' },
  { day: 1, time: '16:00' },
  { day: 3, time: '19:00' },
]
const lessons = ['0.1', '0.2', '0.3']

describe('兒童模式的這週的課', () => {
  it('台灣時間的星期與時間', () => {
    // 2026-11-10 是週二;UTC 08:30 是台灣 16:30
    expect(taipeiNow(new Date('2026-11-10T08:30:00Z'))).toEqual({ day: 1, time: '16:30' })
  })

  it('只替最近的一次排課:正在上的時段上第一個沒看完的課,之後的時段不先排', () => {
    const plan = planWeek(slots, { day: 1, time: '16:30' }, 60, lessons, new Set(['0.1']))
    expect(plan.map((p) => [p.slot.day, p.state, p.lessonId])).toEqual([
      [1, 'now', '0.2'],
      [3, 'later', null],
      [5, 'later', null],
    ])
  })

  it('最近一次的課看完了就換下一課;全部看完是 null', () => {
    const now = { day: 1, time: '16:30' }
    expect(planWeek(slots, now, 60, lessons, new Set(['0.1', '0.2']))[0].lessonId).toBe('0.3')
    expect(planWeek(slots, now, 60, lessons, new Set(lessons))[0].lessonId).toBeNull()
  })

  it('時段外:第一個還沒到的是下一堂,之前的是本週已過', () => {
    const plan = planWeek(slots, { day: 2, time: '09:00' }, 60, lessons, new Set())
    expect(plan.map((p) => p.state)).toEqual(['done', 'next', 'later'])
    expect(plan.map((p) => p.lessonId)).toEqual([null, '0.1', null])
  })

  it('時段結束的那一分鐘算已過', () => {
    expect(planWeek([{ day: 1, time: '16:00' }, { day: 3, time: '16:00' }], { day: 1, time: '17:00' }, 60, lessons, new Set())[0].state).toBe('done')
  })

  it('這週的時段都過了:改排下週的,第一堂是下一堂', () => {
    const plan = planWeek(slots, { day: 6, time: '23:30' }, 60, lessons, new Set(['0.1']))
    expect(plan.map((p) => [p.state, p.lessonId, p.nextWeek])).toEqual([
      ['next', '0.2', true],
      ['later', null, true],
      ['later', null, true],
    ])
  })
})

describe('家長課表的這週的課', () => {
  // 2026-11-11(週三)台灣 10:00
  const now = new Date('2026-11-11T02:00:00Z')
  const week: Slot[] = [
    { day: 1, time: '16:00' },
    { day: 2, time: '16:00' },
    { day: 5, time: '10:00' },
  ]

  it('每一次上課的實際日期;上完的課記在看完時落在的那一次', () => {
    const rows = parentWeek(week, 30, now, lessons, [{ lessonId: '0.1', at: new Date('2026-11-10T08:10:00Z') }])
    expect(rows.map((r) => dateLabel(r.start) + r.slot.time)).toEqual(['11/10（二）16:00', '11/11（三）16:00', '11/14（六）10:00'])
    expect(rows.map((r) => [r.state, r.lessonId, r.finished])).toEqual([
      ['done', null, ['0.1']],
      ['next', '0.2', []],
      ['later', null, []],
    ])
  })

  it('不在任何一次上課時間內看完的課不記在課表上', () => {
    const rows = parentWeek(week, 30, now, lessons, [{ lessonId: '0.1', at: new Date('2026-11-10T09:00:00Z') }])
    expect(rows.flatMap((r) => r.finished)).toEqual([])
    expect(rows[1].lessonId).toBe('0.2')
  })

  it('這週的都過了:這週的照樣列出,後面接下週的第一堂', () => {
    // 2026-11-15(週日)台灣 23:30
    const rows = parentWeek(week, 30, new Date('2026-11-15T15:30:00Z'), lessons, [{ lessonId: '0.1', at: new Date('2026-11-10T08:10:00Z') }])
    expect(rows.map((r) => [dateLabel(r.start) + r.slot.time, r.state, r.lessonId])).toEqual([
      ['11/10（二）16:00', 'done', null],
      ['11/11（三）16:00', 'done', null],
      ['11/14（六）10:00', 'done', null],
      ['11/17（二）16:00', 'next', '0.2'],
    ])
    expect(rows[0].finished).toEqual(['0.1'])
  })
})
