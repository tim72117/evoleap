import { describe, expect, it } from 'vitest'
import actor, { canvasRatio, halfWidthOf, layersOf, type Print3dState } from './actor'

const start = (props = {}) => actor.init!(props) as Print3dState
const run = (st: Print3dState, kind: 'print' | 'slice' | 'peek', step: object) => actor.apply!(st, kind, step as never)

describe('print3d-layers', () => {
  it('層數 = 高 ÷ 層高,除不盡就報錯', () => {
    expect(layersOf(30, 5)).toBe(6)
    expect(layersOf(30, 0.2)).toBe(150)
    expect(() => layersOf(30, 4)).toThrow()
    expect(() => layersOf(30, 0)).toThrow()
  })

  it('疊到最後一層才算試過這個層高', () => {
    let st = run(start(), 'print', { print: 2 })
    expect(st.tried).toEqual([])
    st = run(st, 'print', { print: 'all' })
    expect([st.count, st.tried]).toEqual([6, [5]])
    st = run(st, 'slice', { slice: 1 })
    expect([st.layer, st.count, st.tried]).toEqual([1, 0, [5]])
    st = run(run(st, 'print', { print: 'all' }), 'slice', { slice: 1 })
    expect(run(st, 'print', { print: 'all' }).tried).toEqual([5, 1])
  })

  it('不能往回印,也不能拿還沒疊好的層', () => {
    const st = run(start(), 'print', { print: 3 })
    expect(() => run(st, 'print', { print: 2 })).toThrow()
    expect(() => run(st, 'print', { print: 7 })).toThrow()
    expect(() => run(st, 'peek', { peek: 4 })).toThrow()
    expect(run(st, 'peek', { peek: 3 }).peek).toBe(3)
    expect(run(run(st, 'peek', { peek: 3 }), 'peek', { peek: false }).peek).toBeNull()
  })

  it('圓頂越上面的層越小', () => {
    const widths = [0, 1, 2, 3, 4, 5].map((i) => halfWidthOf('dome', 30, 5, i))
    expect([...widths].sort((a, b) => b - a)).toEqual(widths)
  })
})

describe('print3d-layers 視角', () => {
  it('turn、tilt 在目前視角上加減,俯角超出範圍報錯', () => {
    const turned = run(start(), 'turn' as never, { turn: -60 }) as Print3dState
    expect([turned.yaw, turned.pitch]).toEqual([-26, 28])
    expect((run(turned, 'tilt' as never, { tilt: 10 }) as Print3dState).pitch).toBe(38)
    // 可以轉整圈
    expect((run(start(), 'turn' as never, { turn: 360 }) as Print3dState).yaw).toBe(394)
    expect(() => run(start(), 'turn' as never, { turn: 'x' })).toThrow()
    expect(() => start({ pitch: 0 })).toThrow()
  })
})

describe('print3d-layers 畫布大小', () => {
  it('跟著實際顯示的大小;舞台 1:1(錄影)時不變,上限 2', () => {
    expect(canvasRatio(1, 1)).toBe(1)
    expect(canvasRatio(3, 0.2)).toBeCloseTo(0.6)
    expect(canvasRatio(2, 2)).toBe(2)
    expect(canvasRatio(2, 0)).toBe(2)
  })
})
