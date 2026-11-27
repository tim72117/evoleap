import { describe, expect, it } from 'vitest'
import actor, { halfWidthOf, layersOf, type Print3dState } from './actor'

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
