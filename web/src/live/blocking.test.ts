import { describe, expect, it } from 'vitest'
import { BLOCK_MS, blockingAt, blockingFor, blockPreroll, checkBlocking, initialOrder, planBlocking, markOf, scheduleBlocking, type BlockStep } from './blocking'

const act = (actor: string, extra: Partial<BlockStep> = {}): BlockStep => ({ actor, acts: true, ...extra })
const stage = (extra: Partial<BlockStep> = {}): BlockStep => ({ actor: null, acts: false, ...extra })

describe('markOf(站位)', () => {
  it('depth(縱深構圖):前景在最上層、清楚;後景較小、變暗、失焦,從上緣露出', () => {
    const f = markOf('depth', 0)
    const b = markOf('depth', 1)
    expect(f.z).toBeGreaterThan(b.z)
    expect(f.s).toBeGreaterThan(b.s)
    expect(f.blur).toBe(0)
    expect(b.blur).toBeGreaterThan(0)
    expect(b.bright).toBeLessThan(1)
    // 直式:後景的上緣比前景高(露出一截),兩者都水平置中
    expect(b.ty).toBeLessThan(f.ty)
    expect(f.tx).toBeCloseTo((1 - f.s) / 2)
    expect(b.tx).toBeCloseTo((1 - b.s) / 2)
  })
  it('depth 橫式:後景從左側露出', () => {
    expect(markOf('depth', 1, 'landscape').tx).toBeLessThan(markOf('depth', 0, 'landscape').tx)
  })
  it('pip:後景是疊在前景上的小畫面,不超出外框', () => {
    const f = markOf('pip', 0)
    const b = markOf('pip', 1)
    expect(f.s).toBe(1)
    expect(b.z).toBeGreaterThan(f.z)
    expect(b.s).toBeLessThan(0.5)
    expect(b.tx + b.s).toBeLessThanOrEqual(1)
    expect(b.ty + b.s).toBeLessThanOrEqual(1)
  })
  it('single(單人鏡頭):只看得到前景', () => {
    expect(markOf('single', 0).opacity).toBe(1)
    expect(markOf('single', 1).opacity).toBe(0)
  })
})

describe('checkBlocking', () => {
  it('演員要在演員表裡、至少兩位、構圖要認得', () => {
    expect(() => checkBlocking({ cast: ['a', 'b'] }, ['a', 'b'])).not.toThrow()
    expect(() => checkBlocking({ cast: ['a'] }, ['a'])).toThrow(/至少/)
    expect(() => checkBlocking({ cast: ['a', 'x'] }, ['a', 'b'])).toThrow(/x/)
    expect(() => checkBlocking({ cast: ['a', 'b'], shot: 'ots' as never }, ['a', 'b'])).toThrow(/shot/)
  })
})

describe('planBlocking', () => {
  const spec = { cast: ['claude', 'browser'] }
  it('auto:誰的動作誰到前景;已經在前景就不換', () => {
    const plan = planBlocking(spec, [act('claude'), act('browser'), act('browser'), act('claude')])
    expect(plan).toEqual([
      { step: 1, order: ['browser', 'claude'], shot: 'depth', cut: false },
      { step: 3, order: ['claude', 'browser'], shot: 'depth', cut: false },
    ])
  })
  it('舞台自己的動作不換前景;不在調度裡的演員也不換', () => {
    expect(planBlocking(spec, [stage(), act('finder')])).toEqual([])
  })
  it('foreground、shot、transition 手動指定;auto: false 時只聽 front', () => {
    const plan = planBlocking({ ...spec, auto: false }, [act('browser'), stage({ foreground: 'browser', transition: 'cut' }), stage({ shot: 'pip' })])
    expect(plan).toEqual([
      { step: 1, order: ['browser', 'claude'], shot: 'depth', cut: true },
      { step: 2, order: ['browser', 'claude'], shot: 'pip', cut: false },
    ])
  })
  it('寫錯時指出第幾步', () => {
    expect(() => planBlocking(spec, [stage(), stage({ foreground: 'nobody' })])).toThrow(expect.objectContaining({ step: 1 }))
    expect(() => planBlocking(spec, [stage({ shot: 'zoom' })])).toThrow(expect.objectContaining({ step: 0 }))
  })
})

describe('blockingAt', () => {
  const spec = { cast: ['a', 'b'] }
  const plan = planBlocking(spec, [act('a'), act('b')])
  const pre = blockPreroll(plan)
  const keys = scheduleBlocking(spec, plan, () => 5000, pre)
  it('輪替在步驟開始前開始、步驟開始時到位', () => {
    expect(keys[1].at).toBe(5000 - BLOCK_MS)
    expect(blockingAt(keys, 1000).a).toEqual(markOf('depth', 0))
    expect(blockingAt(keys, 5000).b).toEqual(markOf('depth', 0))
    expect(blockingAt(keys, 5000).a).toEqual(markOf('depth', 1))
  })
  it('過程中是兩個姿勢之間;上下層在一半時交換', () => {
    const early = blockingAt(keys, 5000 - BLOCK_MS + 100)
    const late = blockingAt(keys, 5000 - 100)
    expect(early.b.s).toBeGreaterThan(markOf('depth', 1).s)
    expect(early.b.s).toBeLessThan(markOf('depth', 0).s)
    expect(early.b.z).toBe(markOf('depth', 1).z)
    expect(late.b.z).toBe(markOf('depth', 0).z)
  })
  it('純函式:同一個時間點得到同一組姿勢,往回拖也一樣', () => {
    const t = 5000 - 300
    const x = blockingAt(keys, t)
    blockingAt(keys, 9000)
    expect(blockingAt(keys, t)).toEqual(x)
  })
  it('cut 立即換好,不預留時間', () => {
    const p = planBlocking(spec, [act('b', { transition: 'cut' })])
    const k = scheduleBlocking(spec, p, () => 3000, blockPreroll(p))
    expect(blockPreroll(p).size).toBe(0)
    expect(blockingAt(k, 2999).a).toEqual(markOf('depth', 0))
    expect(blockingAt(k, 3000).b).toEqual(markOf('depth', 0))
  })
})

describe('出場退場與方向', () => {
  const spec = { cast: ['a', 'b', 'c', 'd'] }
  it('退場的排到最後;前後順序只在看得到的演員之間算', () => {
    expect(initialOrder(spec, ['a', 'b'])).toEqual(['c', 'd', 'a', 'b'])
    const plan = planBlocking(spec, [stage({ hide: 'c' }), stage({ hide: 'd' }), { actor: 'a', acts: true, show: 'a' }, { actor: 'b', acts: true, show: 'b' }], ['a', 'b'])
    // 前兩段場景的演員退場後,新場景的 a、b 是第 1、2 層,不會被藏起來的演員擋在後面
    expect(plan.at(-1)!.order.slice(0, 2)).toEqual(['b', 'a'])
  })
  it('依方向取設定;沒寫的方向不調度', () => {
    expect(blockingFor({ cast: ['a', 'b'] }, 'landscape')).toEqual({ cast: ['a', 'b'] })
    expect(blockingFor({ portrait: { cast: ['a', 'b'] } }, 'portrait')).toEqual({ cast: ['a', 'b'] })
    expect(blockingFor({ portrait: { cast: ['a', 'b'] } }, 'landscape')).toBeNull()
    expect(blockingFor(undefined, 'portrait')).toBeNull()
  })
})

describe('連續輪替', () => {
  it('上一次輪替還沒走完就開始下一次:從當下的站位接著走,不會跳', () => {
    const spec = { cast: ['a', 'b'] }
    // b 在 1000 開始換到前景,只過了 300ms(還沒走完)a 又被叫回前景
    const cues = [
      { at: 0, order: ['a', 'b'], shot: 'depth' as const, cut: true },
      { at: 1000, order: ['b', 'a'], shot: 'depth' as const, cut: false },
      { at: 1300, order: ['a', 'b'], shot: 'depth' as const, cut: false },
    ]
    const before = blockingAt(cues, 1299)
    const after = blockingAt(cues, 1301)
    for (const id of spec.cast) expect(Math.abs(after[id].s - before[id].s)).toBeLessThan(0.01)
    // 走完後回到 a 在前景
    expect(blockingAt(cues, 1300 + BLOCK_MS).a).toEqual(markOf('depth', 0))
  })
})
