import { describe, expect, it } from 'vitest'
import actor from './actor'


describe('kid-hub', () => {

  it('操作對不上狀態時報錯', () => {
    const st = actor.init!({})
    expect(() => actor.apply!(st, 'deposit', { deposit: 200 })).toThrow(/build/)
    const built = actor.apply!(st, 'build', { build: true })
    expect(() => actor.apply!(built, 'build', { build: true })).toThrow()
    expect(() => actor.apply!(built, 'timer', { timer: 30 })).toThrow(/spread/)
    const strips = actor.apply!(built, 'spread', { spread: true })
    expect(() => actor.apply!(strips, 'tick', { tick: '不存在' })).toThrow(/不存在/)
    const once = actor.apply!(strips, 'tick', { tick: '帶水壺' })
    expect(() => actor.apply!(once, 'tick', { tick: '帶水壺' })).toThrow(/勾過/)
    expect(() => actor.apply!(strips, 'habit', { habit: 9 })).toThrow()
    expect(() => actor.init!({ todo: [] })).toThrow()
    // ask 只能在 build 之前;build 前不一定要有 ask
    const asked = actor.apply!(st, 'ask', { ask: '幫我做小管家' })
    expect(actor.apply!(asked, 'build', { build: true }).layout).toBe('phone')
    expect(() => actor.apply!(built, 'ask', { ask: '再做一次' })).toThrow(/build 之前/)
    expect(() => actor.apply!(st, 'ask', { ask: '' })).toThrow()
  })
})
