import { describe, expect, it } from 'vitest'
import { audioTime, talking, LEAD, keysAt, orbPos, skyColors } from './actor'

describe('read-along 對齊錄音', () => {
  it('畫面裡的錄音時間 = at + (local − 旁白延遲)', () => {
    expect(audioTime({ at: 9.5 }, LEAD)).toBe(9.5)
    expect(audioTime({ at: 9.5 }, LEAD + 480)).toBeCloseTo(9.98)
  })
  it('小熊只在有聲音的區間張嘴', () => {
    const speech: [number, number][] = [[1, 2]]
    expect(talking(0.5, speech, [])).toBe(false)
    expect([1.0, 1.15, 1.3, 1.45].some((t) => talking(t, speech, []))).toBe(true)
  })
})

describe('read-along 天空', () => {
  const sky: [number, number][] = [[0, 0], [10, 0], [12, 1]]
  it('時間點之間平順過渡,前後維持不變', () => {
    expect(keysAt(sky, -1)).toBe(0)
    expect(keysAt(sky, 11)).toBeCloseTo(0.5)
    expect(keysAt(sky, 99)).toBe(1)
    expect(keysAt(undefined, 3)).toBe(0)
  })
  it('白天太陽在高處、月亮在地平線下;夜晚相反', () => {
    const day = orbPos(0, 0, false)
    const night = orbPos(1, 0, false)
    expect(day.sun[1]).toBeLessThan(0.5)
    expect(day.moon[1]).toBeGreaterThan(1.3)
    expect(night.sun[1]).toBeGreaterThan(1.3)
    expect(night.moon[1]).toBeLessThan(0.5)
    expect(night.sun[0]).toBeGreaterThan(day.sun[0])
  })
  it('月亮探頭時移到太陽旁邊,不重疊', () => {
    const a = orbPos(0, 1, false)
    expect(a.moon[1]).toBeLessThan(0.5)
    expect(Math.abs(a.moon[0] - a.sun[0])).toBeGreaterThan(0.12)
    const b = orbPos(0, 1, true)
    expect(Math.abs(b.moon[0] - b.sun[0])).toBeGreaterThan(0.3)
  })
  it('顏色由白天的藍、黃昏的橘到夜晚的深藍', () => {
    expect(skyColors(0).top).toBe('rgb(110,193,240)')
    expect(skyColors(0.5).bottom).toBe('rgb(255,178,122)')
    expect(skyColors(1).top).toBe('rgb(20,27,69)')
  })
})
