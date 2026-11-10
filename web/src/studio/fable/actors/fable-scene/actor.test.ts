import { describe, expect, it } from 'vitest'
import type { ActorEvent, StageScript } from '../../../../live/types'
import lesson from '../../../../content/live/lab/fable/0.1-scene.json'
import demo from '../../../../content/live/lab/scenes/fable-scene.json'
import actor, { lookAt, type SceneState, type SceneStep } from './actor'

const STAGE = ['card', 'callout', 'show', 'hide', 'move', 'checkpoint', 'wait', 'parts']

/** 照舞台載入的方式:從 init 開始依序 apply 每個動作 */
function run(script: StageScript): SceneState {
  const id = Object.keys(script.cast).find((k) => script.cast[k].actor === 'fable-scene')!
  let st = actor.init!(script.cast[id].props ?? {})
  script.steps.forEach((raw, i) => {
    const s = raw as Record<string, unknown>
    if (STAGE.some((k) => k in s)) return
    const kind = actor.kinds.find((k) => k in s)
    if (!kind) throw new Error(`第 ${i + 1} 步沒有動作`)
    st = actor.apply!(st, kind, s as SceneStep)
  })
  return st
}

const ev = (kind: string, step: Record<string, unknown>, start: number): ActorEvent => ({ kind, step, start, dur: 1000, local: 0, p: 0 })

describe('fable-scene', () => {
  it('場景版腳本與示範腳本都演得完;腳本裡不再有 mood', () => {
    for (const s of [lesson, demo]) {
      const st = run(s as unknown as StageScript)
      expect(st.world.deployed).toBe(true)
      expect(st.sky).toBe('dawn')
      expect(JSON.stringify(s)).not.toContain('"mood"')
    }
  })

  it('背景依狀態自動變化,從狀態改變的那一步開始過場', () => {
    const init = actor.init!({})
    const events = [ev('deploy', { deploy: true }, 1000), ev('power', { power: false }, 10000)]
    expect(lookAt(init, events.slice(0, 1), 900).streams).toBe(0) // 還沒上線
    expect(lookAt(init, events.slice(0, 1), 1000 + 800).streams).toBeGreaterThan(0) // 過場中
    expect(lookAt(init, events.slice(0, 1), 9000).streams).toBe(1) // 上線且伺服器開著:光纖亮
    expect(lookAt(init, events, 20000)).toMatchObject({ streams: 0.12, city: 0.7 }) // 伺服器關機
  })

  it('上一段過場還沒走完又改變時,從當時的值接著過場', () => {
    const init = actor.init!({})
    const events = [ev('deploy', { deploy: true }, 0), ev('power', { power: false }, 800)]
    const mid = lookAt(init, events.slice(0, 1), 800).streams
    expect(lookAt(init, events, 800).streams).toBeCloseTo(mid)
  })

  it('出場時帶的動作也算(舞台交給演員的 kind 是 props)', () => {
    const init = actor.init!({})
    // 出場順便上線、順便天亮:背景要和舞台算的狀態一致
    expect(lookAt(init, [ev('props', { show: 'world', deploy: true }, 0)], 9000).streams).toBe(1)
    expect(lookAt(init, [ev('props', { show: 'world', sky: 'dawn' }, 0)], 9000).dawn).toBe(1)
    // 出場順便 boot,下一步 open 不會因為漏算 boot 而報錯
    expect(() => lookAt(init, [ev('props', { show: 'world', boot: true }, 0), ev('open', { open: true }, 1000)], 3000)).not.toThrow()
    expect(lookAt(init, [ev('props', { show: 'world' }, 0)], 9000)).toMatchObject({ streams: 0, dawn: 0 })
  })

  it('天亮只由導演指令決定', () => {
    const init = actor.init!({})
    expect(lookAt(init, [ev('crowd', { crowd: true }, 0)], 9000).dawn).toBe(0)
    expect(lookAt(init, [ev('sky', { sky: 'dawn' }, 0)], 9000).dawn).toBe(1)
    expect(() => actor.apply!(init, 'sky', { sky: 'night' })).toThrow()
  })
})
