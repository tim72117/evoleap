import { beforeAll, describe, expect, it } from 'vitest'
import lesson from '../../../content/live/lab/l0/intro-b.json'
import original from '../../../content/live/l0/0.intro.json'
import demo from '../../../content/live/lab/actors/then-now.json'
import { ACTORS } from '../index'
import { ensureActors } from '../lazy'
import { withTeacher } from '../../teacher'
import type { StageScript } from '../../types'
import { expandAnswers, momentsOf, staticScript, type Answers, type Moment } from '../../../studio/interactive/scene'
import actor, { BUG_LINE, KEYS, RIGHT, apply, codeStats, init, type ThenNowState, type ThenNowStep } from './actor'

type Step = Record<string, unknown>
const script = lesson as unknown as StageScript
const STAGE_KINDS = ['card', 'callout', 'show', 'hide', 'move', 'checkpoint', 'wait', 'parts']
const ASKS = [
  { text: '加一份菜單', want: 'menu' as const },
  { text: '把按鈕變大', want: 'button' as const },
]

beforeAll(() => ensureActors([...Object.values(withTeacher(script).cast), ...Object.values(demo.cast)].map((c) => c.actor)))

const start = (): ThenNowState => init({ asks: ASKS })
const run = (st: ThenNowState, steps: ThenNowStep[]): ThenNowState => steps.reduce((s, x) => apply(s, actor.kinds.find((k) => k in x)!, x), st)
const fixed = (): ThenNowState => run(start(), [{ look: BUG_LINE }, { mend: RIGHT }])

describe('then-now:以前自己寫程式', () => {
  it('檢查沒寫錯的行:標成沒問題,每次都算一個動作,同一行不重複記', () => {
    const st = run(start(), [{ look: 1 }, { look: 4 }, { look: 1 }])
    expect(st).toMatchObject({ looked: [1, 4], found: false, fixed: false, moves: 3 })
    expect(st.note.text).toContain('第 1 行沒問題')
  })

  it('找到寫錯的那一行之後才能補符號;補錯還是壞的,補對才修好', () => {
    expect(() => run(start(), [{ mend: RIGHT }])).toThrow(/先 look/)
    let st = run(start(), [{ look: BUG_LINE }])
    expect(st).toMatchObject({ found: true, fixed: false })
    st = run(st, [{ mend: '>' }, { mend: '>' }, { mend: '/' }])
    expect(st).toMatchObject({ tried: ['>', '/'], fixed: false, moves: 4 })
    expect(st.note.tone).toBe('bad')
    st = run(st, [{ mend: RIGHT }])
    expect(st).toMatchObject({ fixed: true, moves: 5 })
    expect(st.note.tone).toBe('good')
    expect(() => run(st, [{ mend: RIGHT }])).toThrow(/已經修好/)
  })

  it('修好之後再點程式碼:不算動作,狀態不變(學員亂點也不會壞)', () => {
    const st = fixed()
    expect(run(st, [{ look: 1 }, { look: BUG_LINE }])).toBe(st)
  })

  it('寫錯的參數會報錯', () => {
    expect(() => run(start(), [{ look: 5 }])).toThrow(/1 到 4/)
    expect(() => run(run(start(), [{ look: BUG_LINE }]), [{ mend: 'x' }])).toThrow(/符號/)
    expect(() => init({ asks: [{ text: '', want: 'menu' }] })).toThrow(/asks/)
  })

  it('可以補的符號裡只有一個是對的', () => {
    expect(Object.values(KEYS).filter((c) => c === RIGHT)).toHaveLength(1)
    expect(Object.keys(KEYS).length).toBeGreaterThanOrEqual(3)
  })
})

describe('then-now:現在說一句話', () => {
  it('要先修好才能換到現在;說一句話、AI 做出來、再對照', () => {
    expect(() => run(start(), [{ turn: 'now' }])).toThrow(/還沒修好/)
    let st = run(fixed(), [{ turn: 'now' }])
    expect(st.mode).toBe('now')
    expect(() => run(st, [{ look: 1 }])).toThrow(/現在/)
    expect(() => run(st, [{ craft: true }])).toThrow(/先 tell/)
    st = run(st, [{ tell: '加一份菜單' }])
    expect(st).toMatchObject({ told: '加一份菜單', want: 'menu', made: false })
    expect(() => run(st, [{ tally: true }])).toThrow(/先 craft/)
    st = run(st, [{ craft: true }, { tally: true }])
    expect(st).toMatchObject({ made: true, tallied: true })
  })

  it('不在 asks 裡的句子要自己寫 want', () => {
    const st = run(fixed(), [{ turn: 'now' }])
    expect(() => run(st, [{ tell: '做一個計算機' }])).toThrow(/want/)
    expect(run(st, [{ tell: '加上營業時間', want: 'hours' }]).want).toBe('hours')
  })

  it('對照表的數字是照那四行程式算的', () => {
    const { chars, symbols } = codeStats('小森烘焙')
    expect(chars).toBe(81)
    expect(symbols).toBe(23)
  })
})

/** 每個互動點回答每個選項或略過的所有組合(加上都沒回答) */
function answerSets(s: StageScript): Answers[] {
  let sets: Answers[] = [{}]
  for (const m of momentsOf(s)) {
    const choices: Answers[string][] = [...m.options.map((_, option) => ({ option })), { skipped: true as const }]
    sets = sets.flatMap((a) => [a, ...choices.map((c) => ({ ...a, [m.id]: c }))])
  }
  return sets
}

/** 照順序把每一步交給演員的 init/apply 推算(沒有真的載入舞台),回傳各演員最後的狀態 */
function replay(s: StageScript, answers: Answers = {}): Record<string, unknown> {
  const cast = Object.entries(s.cast).map(([id, c]) => ({ id, def: ACTORS[c.actor], state: ACTORS[c.actor].init?.(c.props ?? {}) }))
  for (const [n, raw] of expandAnswers(s, answers).steps.entries()) {
    const step = raw as Step
    const named = (step.show ?? step.hide) as string | undefined
    const owners = cast.filter((c) => c.def.kinds.some((k) => k in step) && (!step.on || step.on === c.id) && (!named || named === c.id))
    if (!owners.length) {
      expect(STAGE_KINDS.some((k) => k in step), JSON.stringify(step).slice(0, 120)).toBe(true)
      continue
    }
    expect(owners.length, `要寫 on:${JSON.stringify(step).slice(0, 120)}`).toBe(1)
    const o = owners[0]
    try {
      if (o.def.apply) o.state = o.def.apply(o.state, o.def.kinds.find((k) => k in step)!, step)
    } catch (e) {
      throw new Error(`第 ${n + 1} 步 ${JSON.stringify(step).slice(0, 80)}:${e instanceof Error ? e.message : e}`)
    }
  }
  return Object.fromEntries(cast.map((c) => [c.id, c.state]))
}

describe('序章 B 版的腳本(lab/l0/intro-b.json)', () => {
  const full = withTeacher(script)
  const moments = momentsOf(full)
  const byId = (id: string): Moment => moments.find((m) => m.id === id)!

  it('兩個互動點:先修好「以前」,再對 AI 說一句話;每一種回答(含看示範、都不回答)都演得完', () => {
    expect(moments.map((m) => m.id)).toEqual(['fix', 'ask'])
    const sets = answerSets(full)
    expect(sets.length).toBe(18)
    for (const answers of sets) {
      const lab = replay(full, answers).lab as ThenNowState
      expect(lab).toMatchObject({ mode: 'now', fixed: true, made: true, tallied: true })
    }
  })

  it('「以前」的互動:每個觸發點都對得到演員的動作,照「找到 → 補對」點完,畫面上才有「繼續」', () => {
    const fix = byId('fix')
    const spots = fix.interact!.spots
    expect(spots.map((s) => s.target)).toEqual(['lab:line:1', 'lab:line:2', 'lab:line:3', 'lab:line:4', ...Object.keys(KEYS).map((k) => `lab:key:${k}`)])
    // 互動開始時的狀態 = 主腳本演到互動點(靜態舞台載入的腳本)
    const before = replay(staticScript(full, {}, 'fix', 'lab', actor.kinds)).lab as ThenNowState
    expect(before).toMatchObject({ mode: 'then', found: false, fixed: false, moves: 0 })
    // 學員亂點一輪再修好:先檢查每一行,再把每個符號都試一次(對的放最後)
    const lines = spots.filter((s) => s.target.includes(':line:')).flatMap((s) => s.steps)
    const keys = spots.filter((s) => s.target.includes(':key:')).flatMap((s) => s.steps) as ThenNowStep[]
    const order = [...keys.filter((k) => k.mend !== RIGHT), ...keys.filter((k) => k.mend === RIGHT)]
    const after = run(before, [...(lines as ThenNowStep[]), ...order])
    expect(after).toMatchObject({ looked: [1, 2, 4], tried: ['>', '/', ';'], fixed: true, moves: 8 })
    // 「繼續」只有一個選項,疊在修好才出現的按鈕上;它的步驟要把主腳本也修好(互動中的操作不帶回主腳本)
    expect(fix.options).toHaveLength(1)
    expect(fix.options[0].target).toBe('lab:next')
    expect(run(before, fix.options[0].steps as ThenNowStep[]).fixed).toBe(true)
  })

  it('「現在」的選項就是演員列出來的那幾句話,每一句做出來的東西都不一樣', () => {
    const ask = byId('ask')
    const asks = (script.cast.lab.props as { asks: { text: string; want: string }[] }).asks
    expect(ask.options.map((o) => o.label)).toEqual(asks.map((a) => a.text))
    expect(ask.options.map((o) => o.target)).toEqual(asks.map((_, i) => `lab:ask:${i}`))
    expect(new Set(asks.map((a) => a.want)).size).toBe(asks.length)
    const wants = ask.options.map((_, option) => (replay(full, { ask: { option } }).lab as ThenNowState).want)
    expect(wants).toEqual(asks.map((a) => a.want))
  })

  it('開場互動之後接回原本的序章:從「寫程式其實是在翻譯」起,章節與課程步驟都一樣', () => {
    const chaptersFrom = (s: { steps: Step[] }): unknown[] => {
      const steps = s.steps
      const from = steps.findIndex((x) => typeof x.card === 'string' && x.card.startsWith('寫程式，其實是在'))
      expect(from).toBeGreaterThan(0)
      return steps.slice(from).flatMap((x) => (x.chapter ? [[x.chapter, x.lessonStep]] : []))
    }
    expect(chaptersFrom(lesson as { steps: Step[] })).toEqual(chaptersFrom(original as { steps: Step[] }))
    const steps = [...new Set((lesson.steps as Step[]).map((x) => x.lessonStep).filter((n) => typeof n === 'number'))]
    expect(steps).toEqual([1, 2, 3, 4, 5])
  })

  it('對外的文字不用 L0–L4 的代號,老師不說「大家好」', () => {
    const text = JSON.stringify(full.steps)
    expect(text).not.toMatch(/L[0-4]\b/)
    expect(text).not.toContain('大家好')
  })
})

describe('then-now 的演員展示腳本', () => {
  it('推算得過去', () => {
    const st = replay(demo as unknown as StageScript).lab as ThenNowState
    expect(st).toMatchObject({ tried: ['>'], fixed: true, want: 'menu', tallied: true })
  })
})
