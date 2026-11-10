import { describe, expect, it } from 'vitest'
import type { ActorEvent, StageScript } from '../../../../live/types'
import demo from '../../../../content/live/lab/scenes/kid-day-scene.json'
import actor, { backdropAt, flashTime, HANDOFF_MS, handoffAt, kindOf, lookAt, RULES, shakeAt, type DayProps, type DayState, type DayStep } from './actor'

const STAGE = ['card', 'callout', 'show', 'hide', 'move', 'checkpoint', 'wait', 'parts']
const script = demo as unknown as StageScript
const props = script.cast.day.props as DayProps

/** 照舞台載入的方式:從 init 開始依序 apply 每個動作 */
function run(s: StageScript): DayState {
  let st = actor.init!(props)
  s.steps.forEach((raw, i) => {
    const step = raw as Record<string, unknown>
    if (STAGE.some((k) => k in step)) return
    const kind = actor.kinds.find((k) => k in step)
    if (!kind) throw new Error(`第 ${i + 1} 步沒有動作`)
    st = actor.apply!(st, kind, step as DayStep)
  })
  return st
}

/** 簡化的時間表:動作一個接一個(長度用 ms 或自然長度),給純函式測試用 */
function timeline(s: StageScript): ActorEvent[] {
  let t = 400
  let st = actor.init!(props)
  const out: ActorEvent[] = []
  for (const raw of s.steps) {
    const step = raw as Record<string, unknown>
    const kind = actor.kinds.find((k) => k in step)
    if (!kind || STAGE.some((k) => k in step)) continue
    const dur = typeof step.ms === 'number' ? step.ms : actor.duration(kind, step as DayStep, props, st)
    out.push({ kind, step, start: t, dur, local: 0, p: 0 })
    st = actor.apply!(st, kind, step as DayStep)
    t += dur
  }
  return out
}

const ev = (kind: string, step: Record<string, unknown>, start: number, dur = 1000): ActorEvent => ({ kind, step, start, dur, local: 0, p: 0 })
const init = actor.init!(props)
/** 痛點段落演完(收成一點)的事件 */
const pain = [ev('strip', { strip: 2 }, 0), ev('all', { all: true }, 1000), ev('parent', { parent: '吵' }, 3000), ev('collapse', { collapse: '轉折' }, 5000, 1800)]

describe('kid-day-scene', () => {
  it('展示腳本演得完;動作種類是兩位演員的聯集', () => {
    const st = run(script)
    expect(st.life.collapsed).toBe(true)
    expect(st.hub).toMatchObject({ layout: 'habit', saved: 1500, streak: 7 }) // 1300 + 200,沒有達到 goal 2000
    expect(actor.kinds).toEqual(expect.arrayContaining(['strip', 'all', 'parent', 'collapse', 'ask', 'build', 'spread', 'deposit', 'timer', 'tick', 'habit']))
    expect(new Set(actor.kinds).size).toBe(actor.kinds.length)
    expect(kindOf({ kind: 'show', step: { deposit: 200 } })).toBe('deposit')
    // 舞台交給演員的事件清單裡,show/hide 帶著動作的格子 kind 是 'props'(stage.ts),也要認得
    expect(kindOf({ kind: 'props', step: { show: 'day', deposit: 200 } })).toBe('deposit')
    expect(kindOf({ kind: 'props', step: { show: 'day' } })).toBeNull()
  })

  it('規則表每條都有 look、ms、when、of', () => {
    expect(RULES.map((r) => r.look)).toEqual(['tension', 'focus', 'warmth', 'glow', 'speed'])
    for (const r of RULES) expect(r.ms > 0 && r.when.length > 10 && typeof r.of(init) === 'number').toBe(true)
  })

  it('tension:亮的痛點格越多越高,收成一點後歸零;從狀態改變的那一步開始過場', () => {
    expect(lookAt(init, [], 0).tension).toBe(0.35) // props.lit 1:一開始就亮著一格
    expect(lookAt(init, pain, 999).tension).toBe(0.35)
    expect(lookAt(init, pain, 1000).tension).toBe(0.35) // all 剛開始
    expect(lookAt(init, pain, 1200).tension).toBeGreaterThan(0.35) // 過場中
    expect(lookAt(init, pain, 2000).tension).toBe(1)
    expect(lookAt(init, pain, 4000).tension).toBe(0.8) // parent
    expect(lookAt(init, pain, 9000).tension).toBe(0) // collapse
  })

  it('focus 在 collapse 之後是 1,hub 開始後回到 0;warmth:ask 0.5、build 之後 1', () => {
    expect(lookAt(init, pain, 9000)).toMatchObject({ focus: 1, warmth: 0 })
    const ask = [...pain, ev('ask', { ask: '做小管家' }, 10000, 2600)]
    expect(lookAt(init, ask, 10000).focus).toBe(1)
    expect(lookAt(init, ask, 20000)).toMatchObject({ focus: 0, warmth: 0.5 })
    const build = [...ask, ev('build', { build: true }, 12600, 2200)]
    expect(lookAt(init, build, 20000).warmth).toBe(1)
  })

  it('glow:todo 全部勾完 0.6、habit 1;speed:all 的時候 1.8 倍', () => {
    const base = [ev('build', { build: true }, 0), ev('spread', { spread: true }, 1000)]
    const ticks = ['帶水壺', '美術用品', '聯絡簿簽名'].map((t, i) => ev('tick', { tick: t }, 2000 + i * 500, 400))
    expect(lookAt(init, [...base, ...ticks.slice(0, 2)], 9000).glow).toBe(0)
    expect(lookAt(init, [...base, ...ticks], 9000).glow).toBe(0.6)
    expect(lookAt(init, [...base, ...ticks, ev('habit', { habit: 7 }, 5000)], 9000).glow).toBe(1)
    expect(lookAt(init, pain.slice(0, 2), 2000).speed).toBe(1.8)
    expect(lookAt(init, pain, 4000).speed).toBe(1)
  })

  it('過場還沒走完又改變時,從當時的值接著變', () => {
    // all 在 1000 開始(tension 0.35 → 1,450ms),1200 時 parent 又改成 0.8
    const events = [ev('all', { all: true }, 1000), ev('parent', { parent: '吵' }, 1200)]
    const mid = lookAt(init, events.slice(0, 1), 1200).tension
    expect(mid).toBeGreaterThan(0.35)
    expect(mid).toBeLessThan(1)
    expect(lookAt(init, events, 1200).tension).toBeCloseTo(mid)
    expect(lookAt(init, events, 1201).tension).toBeCloseTo(mid, 2)
  })

  it('同一個時間點正序、亂序算出來的背景都一樣', () => {
    const events = timeline(script)
    const end = events[events.length - 1].start + 3000
    const times = Array.from({ length: 40 }, (_, i) => Math.round((end * i) / 39))
    const goal = props.hub!.goal!
    const forward = times.map((t) => backdropAt(init, events, t, goal))
    const order = [...times.keys()].sort((a, b) => ((a * 17) % 40) - ((b * 17) % 40))
    const shuffled: unknown[] = []
    for (const i of order) shuffled[i] = backdropAt(init, events, times[i], goal)
    expect(shuffled).toEqual(forward)
    // 事件列表裡還沒開始的動作不影響畫面
    const at = events[3].start + 100
    expect(backdropAt(init, events, at, goal)).toEqual(backdropAt(init, events.slice(0, 4), at, goal))
  })

  it('前景交接在第一個 hub 動作的時間點開始,500ms 走完', () => {
    const events = timeline(script)
    const first = events.find((e) => e.kind === 'ask')!
    expect(handoffAt(events, first.start - 1)).toMatchObject({ life: 1, hub: 0, at: null })
    expect(handoffAt(events, first.start)).toMatchObject({ life: 1, hub: 0, at: first.start })
    const mid = handoffAt(events, first.start + HANDOFF_MS / 2)
    expect(mid.life).toBeCloseTo(0.5)
    expect(mid.hub).toBeCloseTo(0.5)
    expect(handoffAt(events, first.start + HANDOFF_MS)).toMatchObject({ life: 0, hub: 1 })
    // 沒有 ask 時從 build 開始交接
    expect(handoffAt([...pain, ev('build', { build: true }, 8000)], 8000).at).toBe(8000)
  })

  it('一次性效果:all 開始時抖動、1.2 秒內衰減;存款剛好達標時閃一下', () => {
    expect(shakeAt(pain, 999)).toBe(0)
    expect(shakeAt(pain, 1000)).toBeGreaterThan(0)
    expect(shakeAt(pain, 1600)).toBeLessThan(shakeAt(pain, 1000))
    expect(shakeAt(pain, 2200)).toBe(0)
    const deps = [ev('deposit', { deposit: 300 }, 0, 1100), ev('deposit', { deposit: 400 }, 2000, 1100), ev('deposit', { deposit: 100 }, 4000, 1100)]
    expect(flashTime(deps, 1300, 2000)).toBe(2000 + 480) // 第二筆讓 1600 → 2000
    expect(flashTime(deps.slice(0, 1), 1300, 2000)).toBeNull()
    const b = (t: number) => backdropAt(init, [ev('build', { build: true }, 0), ev('spread', { spread: true }, 100), ev('deposit', { deposit: 700 }, 1000, 1000)], t, 2000).flash
    // ms 1000 的 deposit:硬幣在 1000 + 480 × 1000/1100 ≈ 1436 落下
    expect(b(1430)).toBe(0)
    expect(b(1500)).toBeGreaterThan(0)
    expect(b(1437 + 400)).toBe(0)
  })

  it('props 寫錯時報錯', () => {
    expect(() => actor.init!({ life: { lit: 5 } })).toThrow()
    expect(() => actor.init!({ hub: { todo: [] } })).toThrow()
    expect(() => actor.init!({ life: { bare: 'yes' as unknown as boolean } })).toThrow(/bare/)
  })
})
