import { describe, expect, it } from 'vitest'
import actor, { BUG_ROW, CODE_ROWS, codeLines, dollyOf, durationOf, keyed, restBody, type ManualState, type ManualStep } from './actor'

const steps = (st: ManualState, list: ManualStep[]): ManualState => list.reduce((s, x) => actor.apply!(s, actor.kinds.find((k) => k in x)!, x), st)

describe('manual-office', () => {

  it('順序不對時報錯', () => {
    const st = actor.init!({})
    expect(() => actor.apply!(st, 'run', { run: true })).toThrow(/write/)
    expect(() => actor.apply!(st, 'write', { write: 0 })).toThrow(/行數/)
    expect(() => actor.apply!(st, 'call', { call: true })).toThrow(/write/)
    expect(() => actor.apply!(st, 'enter', { enter: true })).toThrow(/call/)
    const w = steps(st, [{ write: true }])
    expect(() => actor.apply!(w, 'write', { write: true })).toThrow(/打過/)
    expect(() => actor.apply!(w, 'hunt', { hunt: true })).toThrow(/run/)
    expect(() => actor.apply!(w, 'patch', { patch: true })).toThrow(/hunt/)
    const r = steps(w, [{ run: true }])
    expect(() => actor.apply!(r, 'enter', { enter: true })).toThrow(/call/)
    const h = steps(r, [{ hunt: true }])
    expect(() => actor.apply!(h, 'hunt', { hunt: true })).toThrow(/patch/)
    const p = steps(h, [{ patch: true }])
    expect(() => actor.apply!(p, 'hunt', { hunt: true })).toThrow(/run/)
    const all = steps(p, [{ run: true }, { hunt: true }, { patch: true }, { run: true }, { hunt: true }, { patch: true }, { run: true }])
    expect(all.fixes).toBe(3)
    expect(() => actor.apply!(all, 'hunt', { hunt: true })).toThrow(/沒有東西/)
    const e = steps(r, [{ call: true }, { enter: true }])
    expect(() => actor.apply!(e, 'run', { run: true })).toThrow(/已經來了/)
    expect(() => actor.apply!(e, 'handoff', { handoff: '  ' })).toThrow(/字串/)
    expect(() => actor.apply!(r, 'handoff', { handoff: true })).toThrow(/enter/)
  })

  it('程式碼:每改一次只動 BUG_ROW 那一行,最後沒有 bug', () => {
    expect(codeLines('x', 0)).toHaveLength(CODE_ROWS)
    for (let f = 0; f < 3; f++) {
      const before = codeLines('x', f)
      const after = codeLines('x', f + 1)
      const diff = before.map((_, i) => i).filter((i) => before[i] !== after[i])
      expect(diff).toEqual([BUG_ROW[f]])
    }
  })

  it('hotspots 依狀態給下一步,走得到結尾', () => {
    let st = actor.init!({})
    const seen: string[] = []
    for (let i = 0; i < 30 && !(st.entered && st.say); i++) {
      const spots = actor.hotspots!(st, {})
      expect(spots.length).toBeGreaterThan(0)
      const slump = spots.find((s) => s.step && 'slump' in s.step)
      const pick = slump && st.fixes >= 2 ? slump : spots[0]
      seen.push(Object.keys(pick.step!)[0])
      st = steps(st, [pick.step!])
    }
    expect(seen).toEqual(['write', 'run', 'hunt', 'patch', 'run', 'hunt', 'patch', 'run', 'slump', 'call', 'enter', 'handoff'])
    expect(actor.hotspots!(st, {})).toEqual([])
  })

  it('時間、鏡頭、姿勢', () => {
    const st = actor.init!({})
    expect(dollyOf(st).z).toBe(1)
    expect(dollyOf({ ...st, written: true }).z).toBeGreaterThan(1)
    expect(dollyOf({ ...st, entered: true }).z).toBe(1)
    expect(durationOf('write', { write: 5 })).toBeLessThan(durationOf('write', { write: true }))
    expect(restBody({ ...st, entered: true }).lean).toBe(0)
    expect(keyed(50, [[0, 0], [100, 10]])).toBeCloseTo(5, 6)
    expect(keyed(-5, [[0, 3], [100, 10]])).toBe(3)
    expect(keyed(500, [[0, 3], [100, 10]])).toBe(10)
  })
})
