import { describe, expect, it } from 'vitest'
import actor, { BUG_LINE, KEYS, RIGHT, apply, codeStats, init, type ThenNowState, type ThenNowStep } from './actor'

const ASKS = [
  { text: '加一份菜單', want: 'menu' as const },
  { text: '把按鈕變大', want: 'button' as const },
]

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
    // 兩邊隨時可以切換,各自的進度保留;已經在那一邊就不變
    const peek = run(start(), [{ look: 1 }, { turn: 'now' }])
    expect(peek.mode).toBe('now')
    expect(run(peek, [{ turn: 'now' }])).toBe(peek)
    expect(run(peek, [{ turn: 'then' }])).toMatchObject({ mode: 'then', looked: [1], fixed: false })
    expect(() => run(start(), [{ turn: 'later' }])).toThrow(/turn/)
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

describe('then-now:以前自己寫(task: write)', () => {
  const blank = (): ThenNowState => init({ task: 'write' })
  it('一段一段寫,最後一段是測試,寫完才算好;也可以一次寫完;兩邊可以來回切', () => {
    const one = run(blank(), [{ handwrite: true }])
    expect(one).toMatchObject({ written: 1, fixed: false })
    expect(run(one, [{ handwrite: true }, { handwrite: true }, { handwrite: true }, { handwrite: true }])).toMatchObject({ written: 3, fixed: true })
    expect(run(one, [{ handwrite: 'all' }])).toMatchObject({ written: 3, fixed: true })
    expect(run(one, [{ turn: 'now' }, { turn: 'then' }])).toMatchObject({ mode: 'then', written: 1 })
    expect(() => run(start(), [{ handwrite: true }])).toThrow(/task/)
  })
})

describe('then-now:中間的對話式 AI 時代', () => {
  it('中間時代自己一份進度;只有 task 是 write 才有', () => {
    const st = run(init({ task: 'write' }), [{ handwrite: true }, { turn: 'frame' }, { handwrite: true }, { handwrite: true }])
    expect(st).toMatchObject({ mode: 'frame', written: 1, framed: 2 })
    expect(run(st, [{ turn: 'then' }, { handwrite: true }])).toMatchObject({ written: 2, framed: 2 })
    expect(() => run(start(), [{ turn: 'frame' }])).toThrow(/turn/)
  })
})

describe('then-now:點下方進度回到那個階段', () => {
  it('寫程式的時代退回到第 k 段之前;AI Agent 退回重新說或重新做', () => {
    const st = run(init({ task: 'write', asks: [{ text: '額滿', want: 'full' }] }), [{ handwrite: 'all' }])
    expect(run(st, [{ replay: 2 }])).toMatchObject({ written: 1, fixed: false })
    const done = run(st, [{ turn: 'now' }, { tell: '額滿' }, { craft: true }])
    expect(run(done, [{ replay: 1 }])).toMatchObject({ told: null, made: false })
    expect(run(done, [{ replay: 3 }])).toMatchObject({ told: '額滿', made: false })
    expect(() => run(st, [{ replay: 9 }])).toThrow(/replay/)
  })
})
