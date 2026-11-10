import { describe, expect, it } from 'vitest'
import { DAYS, MAX_PER_WEEK, slotLabel, sortSlots, TIMES, toggleSlot, type Slot } from './schedule'

const s = (day: number, time: Slot['time']): Slot => ({ day, time })

describe('兒童課排課', () => {
  it('一週七天、每天同一組時段', () => {
    expect(DAYS).toHaveLength(7)
    expect(TIMES.length).toBeGreaterThan(0)
    expect(MAX_PER_WEEK).toBe(3)
  })

  it('點時段排入,再點一次取消', () => {
    const one = toggleSlot([], s(1, '16:00'))
    expect(one).toEqual([s(1, '16:00')])
    expect(toggleSlot(one, s(1, '16:00'))).toEqual([])
  })

  it('最多 3 堂,排滿後再點新的時段不會加入;取消一堂後可以再排', () => {
    let picked: Slot[] = []
    for (const x of [s(0, '16:00'), s(2, '16:00'), s(5, '10:00')]) picked = toggleSlot(picked, x)
    expect(picked).toHaveLength(3)
    expect(toggleSlot(picked, s(6, '09:00'))).toEqual(picked)
    picked = toggleSlot(picked, s(2, '16:00'))
    expect(toggleSlot(picked, s(6, '09:00'))).toHaveLength(3)
  })

  it('依一週的順序排列:週一在前,同一天早的在前', () => {
    expect(sortSlots([s(5, '10:00'), s(1, '19:00'), s(1, '09:00')]).map(slotLabel)).toEqual(['週二 09:00', '週二 19:00', '週六 10:00'])
    expect(toggleSlot([s(4, '18:00')], s(0, '20:00')).map(slotLabel)).toEqual(['週一 20:00', '週五 18:00'])
  })
})
