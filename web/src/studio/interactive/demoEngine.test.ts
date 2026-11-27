import { describe, expect, it } from 'vitest'
import { ACTORS } from '../../live/actors'
import thenNow from '../../live/actors/then-now/actor'
import type { AnyActor, ScriptStep, StageScript } from '../../live/types'
import { actionsOf, checkDemo, locate, planDemo, screenOf, startOf, type DemoItem } from './demoEngine'
import { captionMs, checkDemoActions, demoSpeech, withDemoTimeline } from './demoTimeline'
import { momentsOf } from './scene'

const demo: DemoItem[] = [
  { id: 'a1', segment: 'then', section: 1, say: '開場', do: { handwrite: true, at: 8300 } },
  { id: 'a2', ms: 500 },
  { id: 'a3', section: 2, ms: 1000, do: { handwrite: true } },
  { id: 'b1', segment: 'frame', reset: false, ms: 1350, do: [{ turn: 'frame', ms: 1100 } as ScriptStep, { replay: 1, at: 1100 } as object as ScriptStep] },
  { id: 'b2', section: 1, ms: 2000, do: { handwrite: true } },
  { id: 'b3', section: [2, 3], say: '後來', ms: 3000, do: { handwrite: true, at: 500 } },
  { id: 'c1', segment: 'now', ms: 800, do: { turn: 'now' } as object as ScriptStep },
  { id: 'c2', section: 1, ms: 3000, do: { tell: '把按鈕變大', want: 'button' } as object as ScriptStep },
]
const script = { cast: { lab: { actor: 'then-now', props: { task: 'write' } } }, steps: [] } as unknown as StageScript
ACTORS['then-now'] = thenNow as unknown as AnyActor
const plan = planDemo(demo, () => 9000)

const lab = thenNow as unknown as AnyActor
const apply = (state: unknown, step: object) => lab.apply!(state as never, lab.kinds.find((k) => k in step) as never, step as never)
const stateOf = (steps: object[]) => steps.reduce<unknown>(apply, lab.init!({ task: 'write' } as never))

describe('示範時間線', () => {
  it('寫錯在載入時指出項目', () => {
    expect(checkDemo(demo, 'x')).toBe(demo)
    expect(() => checkDemo([], 'x')).toThrow('至少一項')
    expect(() => checkDemo([{ id: 'a' }], 'x')).toThrow('segment')
    expect(() => checkDemo([{ id: 'a', segment: 's' }, { id: 'a' }], 'x')).toThrow('重複')
    expect(() => checkDemo([{ id: 'a', segment: 's', says: '拼錯' }], 'x')).toThrow('says')
    expect(() => checkDemoActions(demo, script, 'lab', 'x')).not.toThrow()
    expect(() => checkDemoActions([{ id: 'k', segment: 's', do: { craft: true } as object as ScriptStep }], script, 'lab', 'x')).toThrow('項目「k」')
    // 重設的大段從頭算:「現在」要靠自己的 turn
    expect(() => checkDemoActions([...demo, { id: 'd', segment: 'late', do: { craft: true } as object as ScriptStep }], script, 'lab', 'x')).toThrow('項目「d」')
  })

  it('項目長度、定位、沒有語音時字幕依字數', () => {
    expect(plan.lengths.slice(0, 3)).toEqual([9000, 500, 1000])
    expect(locate(plan, 9200)).toEqual({ index: 1, offsetMs: 200 })
    expect(locate(plan, 1e9)).toEqual({ index: 7, offsetMs: 3000 })
    expect(captionMs('結果額滿的場次，還是能報名。')).toBeGreaterThan(captionMs('好。'))
  })

  it('併進主時間軸:互動點那一步拉成整條示範,旁白與字幕排在清單的位置', () => {
    const raw = { cast: {}, steps: [{ checkpoint: '題', id: 'fix', live: true, narration: '開場', pause: 900 }, { wait: 1 }] } as unknown as StageScript
    const timed = withDemoTimeline(raw, [{ id: 'fix', demo }], { 開場: 9000, 後來: 100 })
    const total = timed.plans.fix.total
    expect(timed.script.steps[0]).toEqual({ checkpoint: '題', id: 'fix', live: true, ms: total, pause: 0 })
    expect(raw.steps[0]).toHaveProperty('narration', '開場')
    const speech = demoSpeech(timed.plans.fix, 400, { 開場: 9000, 後來: 100 })
    expect(speech.narrations).toEqual([{ at: 400, text: '開場' }, { at: 400 + timed.plans.fix.starts[5], text: '後來' }])
    expect(speech.captions[1]).toMatchObject({ from: 400 + timed.plans.fix.starts[5], to: 500 + timed.plans.fix.starts[5] })
  })

  it('demo 沒寫 live 或 stage.focus 在載入時報錯', () => {
    const step = { checkpoint: '題', id: 'fix', options: [{ label: 'a', steps: [] }], demo }
    const of = (extra: object) => () => momentsOf({ cast: {}, steps: [{ ...step, ...extra }] } as unknown as StageScript)
    expect(of({ stage: { focus: 'lab:code' } })).toThrow('live')
    expect(of({ live: true })).toThrow('stage.focus')
    expect(of({ live: true, stage: { focus: 'lab:code' } })).not.toThrow()
  })

  it('隨機亂跳:畫面的演員狀態等於從清單直接算的', () => {
    let seed = 7
    const rand = (n: number) => (seed = (seed * 48271) % 2147483647) % n
    for (let i = 0; i < 3000; i++) {
      const segment = ['then', 'frame', 'now'][rand(3)]
      if (rand(4) === 0) {
        // 看別段:畫面停在那一段,和影片位置無關
        const view = { segment, offsetMs: rand(3000) }
        expect(startOf(plan, segment)).toBeGreaterThanOrEqual(0)
        expect(stateOf(screenOf(plan, 0, view).steps)).toMatchObject({ mode: segment })
        expect(screenOf(plan, rand(plan.total), view)).toEqual(screenOf(plan, 0, view))
        continue
      }
      const ms = rand(plan.total + 500) - 200
      const { index, offsetMs } = locate(plan, ms)
      // 直接算:從最近的重設點起,時間到了的動作依序做
      const now = plan.starts[index] + offsetMs
      const direct = demo.flatMap((item, k) => (k >= plan.resetAt[index] && k <= index ? actionsOf(item).filter((a) => plan.starts[k] + a.at <= now).map((a) => a.step) : []))
      expect(stateOf(screenOf(plan, ms).steps)).toEqual(stateOf(direct))
    }
  })
})
