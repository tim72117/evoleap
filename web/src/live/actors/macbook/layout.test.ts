import { describe, expect, it } from 'vitest'
import { applyMb, buildKeys, keyForChar, keyLevels, KEY_SPECS, KB_W, lidAngleAt, strokesOf, typeDuration, type MbState } from './layout'

const st: MbState = { opened: false, awake: false, angle: 105, pitch: 15, yaw: 0 }

describe('鍵盤配置', () => {
  it('每一列寬度都是 15 鍵距,按鍵不重疊也不超出', () => {
    const keys = buildKeys()
    for (const k of keys) {
      expect(k.x).toBeGreaterThanOrEqual(0)
      expect(k.x + k.w).toBeLessThanOrEqual(KB_W + 1e-9)
    }
    for (const y of new Set(keys.map((k) => k.y))) {
      const row = keys.filter((k) => k.y === y).sort((a, b) => a.x - b.x)
      for (let i = 1; i < row.length; i++) expect(row[i].x).toBeGreaterThanOrEqual(row[i - 1].x + row[i - 1].w - 1e-9)
    }
    expect(new Set(KEY_SPECS.map((k) => k.id)).size).toBe(KEY_SPECS.length)
  })
  it('字元對應按鍵', () => {
    expect(keyForChar('a')).toBe('a')
    expect(keyForChar('A')).toBe('a')
    expect(keyForChar('!')).toBe('1')
    expect(keyForChar(' ')).toBe(' ')
    expect(keyForChar('你')).toBeNull()
  })
})

describe('打字', () => {
  it('同一段文字永遠同一串按鍵與時間', () => {
    expect(strokesOf({ type: 'hello 你好' })).toEqual(strokesOf({ type: 'hello 你好' }))
    expect(strokesOf({ keys: 12 })).toEqual(strokesOf({ keys: 12 }))
  })
  it('英數字按對應的鍵,時間遞增', () => {
    const s = strokesOf({ type: 'hi you' })
    expect(s.map((x) => x.key).slice(0, 2)).toEqual(['h', 'i'])
    expect(s).toHaveLength(6)
    for (let i = 1; i < s.length; i++) expect(s[i].at).toBeGreaterThan(s[i - 1].at)
    expect(typeDuration({ type: 'hi you' })).toBeGreaterThan(s[5].at)
  })
  it('keyLevels:按下時有下沉,之後只剩餘光', () => {
    const s = strokesOf({ type: 'a' })
    expect(keyLevels(s, s[0].at + 40).get('a')!.press).toBeGreaterThan(0.5)
    const later = keyLevels(s, s[0].at + 300).get('a')
    expect(later?.press ?? 0).toBe(0)
    expect(later?.glow ?? 0).toBeGreaterThan(0)
    expect(keyLevels(s, s[0].at + 900).size).toBe(0)
  })
})

describe('狀態推算', () => {
  it('open → wake → type → close', () => {
    let s = applyMb(st, 'open', { angle: 110 })
    expect(s.opened && s.angle === 110).toBe(true)
    s = applyMb(s, 'wake', {})
    s = applyMb(s, 'type', { type: 'x' })
    s = applyMb(s, 'close', {})
    expect(s.opened || s.awake).toBe(false)
  })
  it('操作對不上狀態會丟錯', () => {
    expect(() => applyMb(st, 'wake', {})).toThrow()
    expect(() => applyMb(st, 'type', { type: 'x' })).toThrow()
    expect(() => applyMb(st, 'close', {})).toThrow()
    expect(() => applyMb(st, 'open', { angle: 200 })).toThrow()
    const o = applyMb(st, 'open', {})
    expect(() => applyMb(o, 'open', {})).toThrow()
    expect(() => applyMb(o, 'sleep', {})).toThrow()
    expect(() => applyMb(o, 'tilt', { tilt: { pitch: 99 } })).toThrow()
  })
  it('tilt 只改有給的值', () => {
    const s = applyMb(st, 'tilt', { tilt: { yaw: -20 } })
    expect(s.pitch).toBe(15)
    expect(s.yaw).toBe(-20)
  })
})

describe('開蓋角度', () => {
  it('兩端精確、中間單調', () => {
    expect(lidAngleAt(0, 105, 0)).toBe(0)
    expect(lidAngleAt(0, 105, 1)).toBe(105)
    expect(lidAngleAt(0, 105, 0.3)).toBeLessThan(lidAngleAt(0, 105, 0.6))
  })
})
