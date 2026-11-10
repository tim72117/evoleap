import { describe, expect, it } from 'vitest'
import { simulatedKidsMode } from './KidsModeContext'

describe('模擬的兒童模式', () => {
  it('模擬的孩子正在上課:這個整點開始、60 分鐘,後天 16:00 還有一堂', () => {
    // 2026-11-10(週二)台灣 16:25
    const m = simulatedKidsMode(new Date('2026-11-10T08:25:00Z'))
    if (!m.active) throw new Error('要是兒童模式')
    expect(m.child.name).toBe('模擬兒童')
    expect(m.schedule.open).toBe(true)
    expect(m.schedule.current).toEqual({ day: 1, time: '16:00' })
    expect(m.schedule.endsAt).toBe('2026-11-10T09:00:00.000Z')
    expect(m.child.slots).toEqual([
      { day: 1, time: '16:00' },
      { day: 3, time: '16:00' },
    ])
  })
})
