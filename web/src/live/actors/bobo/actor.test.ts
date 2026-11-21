import { describe, expect, it } from 'vitest'
import actor, { apply, initState, lookOf, naturalDuration, KINDS, type BoboState, type BoboStep, type Kind } from './actor'

const s0 = initState({})
const run = (steps: [Kind, BoboStep][], s: BoboState = s0) => steps.reduce((st, [k, step]) => apply(st, k, step), s)

describe('bobo 動作要對得上狀態', () => {
  it('場景限制', () => {
    expect(() => apply(s0, 'eat', { eat: true })).toThrow(/home/)
    expect(() => apply(s0, 'wash', { wash: 'water' })).toThrow(/bath/)
    expect(() => apply(s0, 'sleep', { sleep: true })).toThrow(/bed/)
    expect(() => apply(s0, 'go', { go: 'park' })).toThrow(/已經在/)
    expect(() => apply(s0, 'go', { go: 'moon' as never })).toThrow(/go 只能是/)
  })
  it('洗澡的順序:脫衣 → 淋濕 → 肥皂 → 沖水 → 擦乾', () => {
    const bath = run([['play', { play: 'puddle' }], ['go', { go: 'bath' }]])
    expect(() => apply(bath, 'wash', { wash: 'water' })).toThrow(/undress/)
    const naked = apply(bath, 'undress', { undress: true })
    expect(naked.laundry).toBe(true)
    expect(() => apply(naked, 'wash', { wash: 'soap' })).toThrow(/water/)
    expect(() => apply(naked, 'wash', { wash: 'rinse' })).toThrow(/soap/)
    const clean = run([['wash', { wash: 'water' }], ['wash', { wash: 'soap' }], ['wash', { wash: 'rinse' }]], naked)
    expect(clean.dirt).toBe(0)
    expect(() => apply(clean, 'dress', { dress: 'pajamas' })).toThrow(/擦乾/)
    const dry = apply(clean, 'wash', { wash: 'dry' })
    expect(dry.fluffy).toBe(true)
    expect(apply(dry, 'dress', { dress: 'pajamas' }).clothes).toBe('pajamas')
  })
  it('刷四個地方再漱口,牙齒才乾淨', () => {
    let s = run([['go', { go: 'home' }], ['eat', { eat: true }], ['go', { go: 'bath' }]])
    expect(s.teeth).toBe(1)
    expect(() => apply(s, 'brush', { brush: 'rinse' })).toThrow(/先刷牙/)
    for (const b of ['top', 'bottom', 'inside'] as const) s = apply(s, 'brush', { brush: b })
    expect(s.teeth).toBeCloseTo(0.25)
    s = apply(s, 'brush', { brush: 'chew' })
    expect(apply(s, 'brush', { brush: 'rinse' }).teeth).toBe(0)
  })
  it('沒洗澡就睡,床單會沾到沙;下床才能拍掉', () => {
    const s = run([['play', { play: 'sand' }], ['go', { go: 'bed' }], ['sleep', { sleep: true }]])
    expect(s.sheetSand).toBe(true)
    expect(() => apply(s, 'tidy', { tidy: true })).toThrow(/下了床/)
    expect(() => apply(s, 'go', { go: 'bath' })).toThrow(/getup/)
    expect(run([['getup', { getup: true }], ['tidy', { tidy: true }]], s).sheetSand).toBe(false)
  })
  it('say 要有台詞,mood 要是已知的', () => {
    expect(() => apply(s0, 'say', {})).toThrow(/台詞/)
    expect(() => apply(s0, 'say', { say: '嗨', mood: 'angry' as never })).toThrow(/mood/)
  })
})

describe('bobo 畫面是時間的純函式', () => {
  const steps: [Kind, BoboStep][] = [
    ['play', { play: 'puddle' }], ['play', { play: 'sand' }], ['play', { play: 'roll' }], ['say', { say: '好好玩', mood: 'laugh' }],
    ['go', { go: 'home' }], ['eat', { eat: true }], ['go', { go: 'bed' }], ['sleep', { sleep: true }], ['toss', { toss: 'itch' }], ['toss', { toss: 'teeth' }],
    ['getup', { getup: true }], ['tidy', { tidy: true }], ['go', { go: 'bath' }], ['mirror', { mirror: true }], ['undress', { undress: true }],
    ['wash', { wash: 'water' }], ['wash', { wash: 'soap' }], ['wash', { wash: 'rinse' }], ['wash', { wash: 'dry' }],
    ['brush', { brush: 'top' }], ['brush', { brush: 'rinse' }], ['dress', { dress: 'pajamas' }],
  ]
  let prev = s0
  for (const [k, step] of steps) {
    const st = apply(prev, k, step)
    const p = prev
    it(`${k} ${JSON.stringify(step)}:同一時間同一畫面,沒有 NaN`, () => {
      const d = naturalDuration(k, step)
      for (let l = 0; l <= d; l += d / 25) {
        const a = lookOf(p, st, k, step, l, 5000 + l)
        expect(JSON.stringify(a)).toBe(JSON.stringify(lookOf(p, st, k, step, l, 5000 + l)))
        expect(JSON.stringify(a)).not.toMatch(/NaN|Infinity|undefined/)
      }
    })
    prev = st
  }
  it('每個動作都有長度', () => {
    for (const k of KINDS) expect(naturalDuration(k, { play: 'puddle', wash: 'water', brush: 'top', say: '嗨' })).toBeGreaterThan(0)
    expect(actor.kinds).toEqual(KINDS)
  })
})
