import { describe, expect, it } from 'vitest'
import type { StageScript } from '../../../../live/types'
import demo from '../../../../content/live/lab/actors/kid-hub.json'
import actor, { type HubState, type HubStep } from './actor'

const STAGE = ['card', 'callout', 'show', 'hide', 'move', 'checkpoint', 'wait', 'parts']

/** 照舞台載入的方式:從 init 開始,依序 apply 演員的每個動作 */
function run(script: StageScript): HubState {
  let st = actor.init!(script.cast.hub.props ?? {})
  script.steps.forEach((raw, i) => {
    const s = raw as Record<string, unknown>
    if (STAGE.some((k) => k in s)) return
    const kind = actor.kinds.find((k) => k in s)
    if (!kind) return
    try {
      st = actor.apply!(st, kind, s as HubStep)
    } catch (e) {
      throw new Error(`第 ${i + 1} 步:${e instanceof Error ? e.message : e}`)
    }
  })
  return st
}

describe('kid-hub', () => {
  it('示範腳本演得完', () => {
    const st = run(demo as unknown as StageScript)
    expect(st).toMatchObject({ layout: 'habit', saved: 2000, timerDone: true, streak: 7 })
    expect(st.ticked).toHaveLength(3)
  })

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
