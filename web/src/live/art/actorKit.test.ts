import { describe, expect, it } from 'vitest'
import { flag, frameClock, makeKindIn, yes } from './actorKit'
import type { ActorView } from '../types'

const KINDS = ['a', 'b'] as const
const kindIn = makeKindIn(KINDS)

describe('actorKit', () => {
  it('kindIn:自己的種類原樣回傳,show/hide/props 看步驟的欄位,其餘是 null', () => {
    expect(kindIn('a', {})).toBe('a')
    expect(kindIn('show', { b: true })).toBe('b')
    expect(kindIn('hide', { a: true, b: true })).toBe('a')
    expect(kindIn('props', {})).toBeNull()
    expect(kindIn('card', { a: true })).toBeNull()
  })
  it('flag / yes 的檢查', () => {
    expect(flag(false, 'x')).toBe(false)
    expect(() => flag('y', 'x')).toThrow('x 要寫 true 或 false')
    expect(() => yes(false, 'x')).toThrow('x 要寫 true')
    expect(() => yes(true, 'x')).not.toThrow()
  })
  it('frameClock:依自然長度換成動作內的 ms,hide 時用 prev', () => {
    const view = { state: 's', prev: 'p', ev: { kind: 'a', step: {}, local: 500, dur: 2000, p: 0.25 } } as unknown as ActorView<string>
    const c = frameClock(view, kindIn, () => 1000)
    expect(c.kind).toBe('a')
    expect(c.l).toBe(250)
    expect(c.dur).toBe(1000)
    expect(c.st).toBe('s')
    expect(c.P(0, 500)).toBeCloseTo(0.5)
    expect(c.is('a')).toBe(true)
    const hide = frameClock({ ...view, ev: { ...view.ev!, kind: 'hide', step: { b: true } } }, kindIn, () => 1000)
    expect(hide.kind).toBe('b')
    expect(hide.st).toBe('p')
    const idle = frameClock({ state: 's', prev: 'p', ev: null }, kindIn, () => 1000)
    expect(idle.kind).toBeNull()
    expect(idle.l).toBe(0)
    expect(idle.dur).toBe(1)
  })
})
