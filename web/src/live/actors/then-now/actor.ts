// 演員 then-now:「以前自己寫程式」對「現在說一句話」的動手體驗(序章 B 版的開場互動)。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)、「互動腳本」(2A.7)。
//
// 畫面:左邊是工作區,右邊是瀏覽器預覽。
//   以前:四行 HTML,第 3 行的 class="order 少了結尾的引號,按鈕和地址從畫面上消失。
//         學員一行一行檢查(look),找到之後從幾個符號裡挑一個補上(mend),補對才會好。
//   現在:工作區換成對 AI 說話的輸入框,說一句話(tell),AI 當場做出來(craft)。
//   對照:最後把兩邊的字數、要顧的符號、步驟數並排(tally)。
//
// props(登場設定):
//   shop   店名(預設「小森烘焙」)
//   task   「以前」玩什麼:fix(預設,麵包店網頁,找出少掉的引號)、
//          write(工作坊報名系統,自己一段一段寫,看網頁長出來;不找錯。範例在 sample.ts)
//   asks   「現在」可以說的一句話:[{ text, want }],want 是 button(把按鈕變大)、sale(今日特價)、menu(菜單)、hours(營業時間);
//          還沒說之前,這幾句會列在輸入框上方(目標 ask:N,從 0 起算),互動點的選項疊在上面
//
// 動作:
//   { "handwrite": true }      (task 是 write)打出下一段;{ "handwrite": "all" } 把剩下的一次寫完
//   { "look": 2 }              檢查第 2 行(1–4);沒寫錯的行標成「沒問題」,第 3 行會找到少掉的引號
//   { "mend": "\"" }           在找到的地方補一個符號:"(對)、>、/、;(都不對,畫面還是壞的);要先 look 找到才行
//   { "replay": 3 }            (task 是 write)回到目前這一邊的第 3 個階段重新演(下方進度點了就是它)
//   { "turn": "frame" }        (task 是 write)換到中間的「後來:對話式 AI」(chatEra.ts);handwrite 寫的是目前這個時代的程式
//   { "turn": "now" }          換到「現在」或換回 "then";兩邊隨時可以切換,各自的進度保留;已經在那一邊就不變
//   { "tell": "…", "want": "menu" }   對 AI 說一句話(逐字打出);want 是這句話要的東西,沒寫時用 asks 裡同一句的 want
//   { "craft": true }          AI 動手:讀懂、寫程式、檢查,預覽上長出成品;要先 tell
//   { "tally": true }          把「以前」和「現在」並排對照;要先 craft
//
// 目標:window、code、preview、note、meter、line:N、keys、key:quote|gt|slash|semi、next(修好後的「繼續」)、
//       prompt、ask:N、said、result、tally、tab:then、tab:now(上方的兩個分頁)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'
import { chatFrame } from './chatEra'
import { chatArea, chatPart, share, type Area } from './focus'
import { handMs } from './handEdit'
import { CHUNKS, chunkText, chunksOf, codeHtml, fixHtml, framePreview, previewHtml, thenPreview, spent, symbolCount, testsHtml, timeText, writtenChars, writtenLines, type Era, type SignupWant, type TestFix, type TestItem, type TestRun } from './sample'

export type Want = 'button' | 'sale' | 'menu' | 'hours' | SignupWant
type Kind = 'handwrite' | 'replay' | 'look' | 'mend' | 'turn' | 'tell' | 'craft' | 'tally'
export type ThenNowStep = CommonStepFields & { /** 手寫示範的打字速度(每秒幾字)與段落停頓(毫秒) */ cps?: number; pause?: number; handwrite?: boolean | 'all'; replay?: number; look?: number; mend?: string; turn?: string; tell?: string; want?: string; craft?: boolean; tally?: boolean }
export interface ThenNowProps {
  shop?: string
  task?: 'fix' | 'write'
  asks?: { text: string; want: Want }[]
  /** true:自動示範依 以前 → 後來 → 現在 接著演,換分頁從那一邊的開頭演起 */
  tour?: boolean
}
type Tone = 'hint' | 'ok' | 'bad' | 'good'
export interface ThenNowState {
  mode: 'then' | 'frame' | 'now'
  /** task 是 write:對話式 AI 時代做到第幾段(0–3) */
  framed: number
  task: 'fix' | 'write'
  /** task 是 write:寫了幾段(0–4) */
  written: number
  /** 登場設定的 asks(tell 沒寫 want 時用來查) */
  asks: { text: string; want: Want }[]
  /** 檢查過、沒寫錯的行(依檢查的順序,不重複) */
  looked: number[]
  found: boolean
  /** 補過但不對的符號(不重複) */
  tried: string[]
  fixed: boolean
  /** 「以前」那一段總共做了幾個動作(每次檢查、每次補符號都算) */
  moves: number
  note: { tone: Tone; text: string }
  told: string | null
  want: Want | null
  made: boolean
  tallied: boolean
}
type Target = 'window' | 'code' | 'preview' | 'note' | 'meter' | 'keys' | 'next' | 'prompt' | 'said' | 'result' | 'tally' | `line:${number}` | `key:${string}` | `ask:${number}` | 'write' | `stage:${number}` | `tab:${'then' | 'now'}`

const KINDS: readonly Kind[] = ['handwrite', 'replay', 'look', 'mend', 'turn', 'tell', 'craft', 'tally']
const WANTS: readonly Want[] = ['button', 'sale', 'menu', 'hours', 'full', 'search', 'chart', 'export']
/** 寫錯的那一行,以及少掉的符號 */
export const BUG_LINE = 3
export const RIGHT = '"'
/** 可以補的符號:名稱(目標 key:名稱) → 符號 */
export const KEYS: Record<string, string> = { gt: '>', quote: '"', slash: '/', semi: ';' }

type Seg = [cls: 't' | 'a' | 'p' | 's' | 'x', text: string]
/** 四行程式(修好的樣子);壞掉時第 3 行從引號開始、連同第 4 行都被當成字串 */
const codeOf = (shop: string): Seg[][] => [
  [['t', '<h1>'], ['x', shop], ['t', '</h1>']],
  [['t', '<p>'], ['x', '每天早上七點出爐'], ['t', '</p>']],
  [['t', '<button '], ['a', 'class'], ['p', '='], ['s', '"order"'], ['t', '>'], ['x', '訂購麵包'], ['t', '</button>']],
  [['t', '<p>'], ['x', '地址：森林路 12 號'], ['t', '</p>']],
]
const plain = (line: Seg[]): string => line.map((s) => s[1]).join('')
/** 四行程式的字數,以及其中要顧的符號(< > / = ")有幾個:對照表用 */
export function codeStats(shop: string): { chars: number; symbols: number } {
  const text = codeOf(shop).map(plain).join('')
  return { chars: kit.graphemes(text).length, symbols: [...text].filter((c) => '<>/="'.includes(c)).length }
}

const LOOK_OK: Record<number, string> = {
  1: '第 1 行沒問題：<h1> 有開頭，也有結尾。',
  2: '第 2 行沒問題：<p> 有開頭，也有結尾。',
  4: '第 4 行本身沒寫錯。它會不見，是被前面的某一行害的。',
}
const NOTE_START = '按鈕和地址不見了。點一行程式，檢查是哪裡寫錯。'
const NOTE_FOUND = '找到了：class="order 的引號只有開頭，沒有結尾。要補上哪個符號？'
const NOTE_FIXED = '補上一個 " ，按鈕和地址都回來了。'
const NOTE_NOW = '這次不用寫程式。選一句話，告訴 AI 你想要什麼。'
const NOTE_MADE = '做好了。AI 動手，你只說了一句話。'
const NOTE_WRITE = '以前要自己把程式一個字一個字打出來。'
const NOTE_SAY = '現在交給 AI Agent：說清楚要什麼就好。'
/** 自己寫版的「現在」:AI Agent 做的三件事(和 AI_STEPS 一一對應) */
const AGENT_STEPS = ['讀程式', '改程式', '測試修錯']
/** AI Agent 自己跑測試:第一次抓到一項失敗,自己修好再跑一次全過 */
const AGENT_RUN = (fixed: boolean): TestRun => ({
  how: fixed ? 'AI Agent：修好了，重跑一次' : 'AI Agent：自己在畫面上探索、亂點亂填',
  each: fixed ? 350 : 650,
  items: [
    { name: '點每一張場次卡片', ok: true, at: 'list' },
    { name: '空白就按送出，有擋下來', ok: true, at: 'submit' },
    { name: '填資料送出，名單新增一人', ok: true, at: 'people' },
    { name: '選額滿的場次再送出', ok: fixed, why: '居然還送得出去', at: 'card:1' },
  ],
  summary: fixed ? '4 passed。找到的錯它自己修好了。' : '3 passed、1 failed。',
})
/** AI Agent 測試的時間點(毫秒,從 craft 開始):第一次跑、修正、再跑;ticks 是三件事打勾的時間 */
const AGENT_T = { run1: 1600, fix: 4500, run2: 7600, ticks: [500, 1400, 9200], total: 9800 }
/** 畫面上正在測哪裡:游標移到 at,state 是移動中、通過、失敗 */
type Probe = { at: string; state: 'move' | 'pass' | 'fail'; part: number; /** agent:發光的游標,掛名牌;script:自動腳本,沒有游標只框住目標 */ who?: 'agent' | 'script' }
/** 跑一輪測試、從開始過了 t 毫秒時的游標;跑完停在失敗的地方(全過就收掉) */
function probeOf(run: TestRun, t: number): Probe | null {
  if (t < 0) return null
  const failed = run.items.findIndex((x: TestItem) => !x.ok)
  const last = run.stopOnFail && failed >= 0 ? failed : run.items.length - 1
  const i = Math.floor(t / run.each)
  // 不開畫面的測試(沒有 at)網頁上沒有東西可框
  if (i > last) return failed >= 0 && run.items[failed].at ? { at: run.items[failed].at, state: 'fail', part: 1 } : null
  const part = (t - i * run.each) / run.each
  const at = run.items[i].at
  return at ? { at, state: part < 0.6 ? 'move' : run.items[i].ok ? 'pass' : 'fail', part } : null
}
function agentProbe(t: number): Probe | null {
  const again = t >= AGENT_T.run2
  const probe = probeOf(AGENT_RUN(again), t - (again ? AGENT_T.run2 : AGENT_T.run1))
  return probe && { ...probe, who: 'agent' }
}
// 像對話紀錄一樣往下累積:第一輪(有失敗)留著,接著是修正的訊息,再接重跑的結果
function agentTestsHtml(t: number): string {
  if (t < AGENT_T.run1) return ''
  const round = (fixed: boolean, since: number): string => {
    const run = AGENT_RUN(fixed)
    return `<div class="tn-testing tn-agent">${testsHtml(run, Math.floor(since / run.each))}</div>`
  }
  const again = t >= AGENT_T.run2
  const first = round(false, again ? Infinity : t - AGENT_T.run1)
  // 修正中:一行字,前面的圖示閃動(依時間算);改完留在紀錄裡
  const blink = (0.35 + 0.65 * Math.abs(Math.cos((t / 600) * Math.PI))).toFixed(2)
  const icon = `<svg class="tn-ai-icon" viewBox="0 0 24 21" aria-hidden="true" style="opacity:${blink}"><path d="M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5l6.3-2.2z"/></svg>`
  const fixing = t >= AGENT_T.fix ? `<p class="tn-fixing${again ? ' done' : ''}">${again ? '✓ 修正完成' : `${icon}修正中…`}</p>` : ''
  return `${first}${fixing}${again ? round(true, t - AGENT_T.run2) : ''}`
}
/** Agent 的對話紀錄:每一步做到時才出現,後面接它自己的輸出(第三步是測試、修正、重跑) */
const AGENT_OUTPUT = ['看了 signup.html：場次清單、報名表單、送出的處理。', '場次清單加上「額滿」判斷。']
function agentLog(ticks: number, testing: number): string {
  return AGENT_STEPS.map((name, i) => {
    if (i > ticks) return ''
    const done = i < ticks
    const output = i < 2 ? (done ? `<p class="tn-out">${AGENT_OUTPUT[i]}</p>` : '') : agentTestsHtml(testing)
    return `<div class="tn-log" data-on="${done ? 1 : 0}"><p class="tn-logstep"><span class="tn-flag">${done ? CHECK : ''}</span>${name}</p>${output}</div>`
  }).join('')
}
const aiSteps = (task: 'fix' | 'write'): readonly string[] => (task === 'write' ? AGENT_STEPS : AI_STEPS)
const noteWritten = (n: number): ThenNowState['note'] =>
  n === 0 ? { tone: 'hint', text: NOTE_WRITE } : n >= CHUNKS.length ? { tone: 'bad', text: '測試有一項沒過，要自己回頭找、自己改。' } : { tone: 'ok', text: `完成「${CHUNKS[n - 1].name}」。下一步：${CHUNKS[n].name}。` }
const STEPS_WRITE = ['寫', '打開看', '手動點一遍']
const STEPS_AGENT = ['說', '看測試結果']
const AI_STEPS = ['讀懂你要什麼', '動手寫程式', '打開來檢查一遍']
const STEPS_THEN = ['寫', '存檔', '打開看', '找錯', '修改', '再看一次']
const STEPS_NOW = ['說', '看']

const yes = (v: unknown, name: string): void => {
  if (v !== true) throw new Error(`${name} 要寫 true`)
}

export function init(props: ThenNowProps): ThenNowState {
  for (const a of props.asks ?? []) {
    if (!a?.text || !WANTS.includes(a.want)) throw new Error(`asks 的每一項要寫 text 與 want(${WANTS.join('、')})`)
  }
  const task = props.task ?? 'fix'
  return { mode: 'then', task, written: 0, framed: 0, asks: props.asks ?? [], looked: [], found: false, tried: [], fixed: false, moves: 0, note: { tone: 'hint', text: task === 'write' ? NOTE_WRITE : NOTE_START }, told: null, want: null, made: false, tallied: false }
}

/** 換到某一邊時要顯示的訊息:照那一邊目前做到哪裡 */
/** 目前這個時代寫了幾段 */
const countOf = (st: ThenNowState): number => (st.mode === 'frame' ? st.framed : st.written)
const NOTE_FRAME = '後來有了對話式 AI：用說的，它回你程式。搬程式還是靠你的手。'
const noteFramed = (n: number): ThenNowState['note'] =>
  n === 0 ? { tone: 'hint', text: NOTE_FRAME } : n >= chunksOf('frame').length ? { tone: 'bad', text: '做出來了。可是每改一次，都要自己再搬一趟。' } : { tone: 'ok', text: `完成「${chunksOf('frame')[n - 1].name}」。下一步：${chunksOf('frame')[n].name}。` }

function noteOf(st: ThenNowState, mode: ThenNowState['mode']): ThenNowState['note'] {
  if (mode === 'frame') return noteFramed(st.framed)
  if (mode === 'then') {
    if (st.task === 'write') return noteWritten(st.written)
    if (st.fixed) return { tone: 'good', text: NOTE_FIXED }
    return st.found ? { tone: 'ok', text: NOTE_FOUND } : { tone: 'hint', text: NOTE_START }
  }
  if (st.made) return { tone: 'good', text: NOTE_MADE }
  return { tone: 'hint', text: st.told ? '說完了，就這一句。' : st.task === 'write' ? NOTE_SAY : NOTE_NOW }
}

export function apply(st: ThenNowState, kind: Kind, s: ThenNowStep): ThenNowState {
  switch (kind) {
    case 'handwrite': {
      if (s.handwrite !== true && s.handwrite !== 'all') throw new Error('handwrite 要寫 true 或 "all"')
      if (st.task !== 'write') throw new Error('handwrite:這位演員的 task 不是 write')
      if (st.mode === 'now') throw new Error('handwrite:已經換到「現在」')
      const total = chunksOf(eraOf(st.mode)).length
      const written = s.handwrite === 'all' ? total : Math.min(total, countOf(st) + 1)
      if (written === countOf(st)) return st
      if (st.mode === 'frame') return { ...st, framed: written, moves: st.moves + 1, note: noteFramed(written) }
      return { ...st, written, fixed: written === total, moves: st.moves + 1, note: noteWritten(written) }
    }
    case 'replay': {
      const k = s.replay
      if (st.task !== 'write') throw new Error('replay:這位演員的 task 不是 write')
      if (typeof k !== 'number' || !Number.isInteger(k) || k < 1 || k > (st.mode === 'now' ? AGENT_STEPS.length + 1 : chunksOf(eraOf(st.mode)).length)) throw new Error('replay 要寫目前這一邊有的第幾個階段')
      if (st.mode === 'now') {
        const ask = st.asks[0]
        if (!ask) return st
        const next: ThenNowState = k === 1 ? { ...st, told: null, want: null, made: false } : { ...st, told: ask.text, want: ask.want, made: false }
        return { ...next, note: noteOf(next, 'now') }
      }
      if (st.mode === 'frame') return { ...st, framed: k - 1, note: noteFramed(k - 1) }
      return { ...st, written: k - 1, fixed: false, note: noteWritten(k - 1) }
    }
    case 'look': {
      const n = s.look
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 4) throw new Error('look 要寫第幾行(1 到 4)')
      if (st.mode !== 'then') throw new Error('look:已經換到「現在」,沒有程式碼可以檢查')
      // 修好之後再點:不算動作,畫面不變
      if (st.fixed) return st
      if (n === BUG_LINE) return { ...st, found: true, moves: st.moves + 1, note: { tone: 'ok', text: NOTE_FOUND } }
      return { ...st, looked: st.looked.includes(n) ? st.looked : [...st.looked, n], moves: st.moves + 1, note: { tone: 'hint', text: LOOK_OK[n] } }
    }
    case 'mend': {
      const c = s.mend
      if (typeof c !== 'string' || !Object.values(KEYS).includes(c)) throw new Error(`mend 要寫補上的符號(${Object.values(KEYS).join(' ')})`)
      if (st.mode !== 'then') throw new Error('mend:已經換到「現在」')
      if (!st.found) throw new Error('mend:還不知道哪裡少了符號,先 look 找到那一行')
      if (st.fixed) throw new Error('mend:已經修好了')
      if (c === RIGHT) return { ...st, fixed: true, moves: st.moves + 1, note: { tone: 'good', text: NOTE_FIXED } }
      return { ...st, tried: st.tried.includes(c) ? st.tried : [...st.tried, c], moves: st.moves + 1, note: { tone: 'bad', text: `補上 ${c} 還是壞的。再想想：引號要一前一後，成對出現。` } }
    }
    case 'turn': {
      if (s.turn !== 'now' && s.turn !== 'then' && !(s.turn === 'frame' && st.task === 'write')) throw new Error('turn 要寫 "now" 或 "then"(task 是 write 時還有 "frame")')
      if (st.mode === s.turn) return st
      return { ...st, mode: s.turn, note: noteOf(st, s.turn) }
    }
    case 'tell': {
      if (typeof s.tell !== 'string' || !s.tell.trim()) throw new Error('tell 要寫對 AI 說的一句話')
      if (st.mode !== 'now') throw new Error('tell:還在「以前」,先 turn')
      if (st.told) throw new Error('tell:已經說過了')
      const want = (s.want ?? st.asks.find((a) => a.text === s.tell)?.want) as Want | undefined
      if (!want || !WANTS.includes(want)) throw new Error(`tell 要寫 want(${WANTS.join('、')}),或用 asks 裡的句子`)
      return { ...st, told: s.tell.trim(), want, note: { tone: 'hint', text: '說完了，就這一句。' } }
    }
    case 'craft':
      yes(s.craft, 'craft')
      if (!st.told) throw new Error('craft:還沒說要做什麼,先 tell')
      if (st.made) throw new Error('craft:已經做好了')
      return { ...st, made: true, note: { tone: 'good', text: NOTE_MADE } }
    case 'tally':
      yes(s.tally, 'tally')
      if (!st.made) throw new Error('tally:「現在」還沒做完,先 craft')
      if (st.tallied) throw new Error('tally:已經在對照了')
      return { ...st, tallied: true }
  }
}

/** 各動作的長度與畫面切換的時間點(毫秒)。tell:打完字停 pressAt 按下送出,再到 sendAt 變成送出的泡泡 */
const T = { writeLead: 150, writeTail: 900, writeAll: 600, writeMax: 1100, replay: 250, look: 900, lookAt: 320, mend: 1500, mendAt: 520, turn: 1100, turnAt: 450, tellLead: 300, pressAt: 350, sendAt: 600, tellTail: 1000, craft: 3400, craftTicks: [500, 1400, 2500], craftShow: 1400, tally: 1400 }
/** 自動示範(寫程式、跑測試、AI Agent 做事)放慢幾倍:原速看不清楚在做什麼 */
const SLOW = 1.6
const isDemo = (kind: Kind | undefined, task: unknown): boolean => kind === 'handwrite' || (kind === 'craft' && task === 'write')
/** 打字速度(每秒幾個字):慢到看得出是一個字一個字打 */
const CPS = 11
/** 自己寫程式的打字速度(一段很長,打快一點) */
const CODE_CPS = 90
/** 測試失敗後:停一下看錯誤、改程式、停一下,再重跑 */
const FIX_T = { hold: 900, type: 1800, rest: 600 }
const fixStart = (run: TestRun): number => run.items.length * run.each + FIX_T.hold
const rerunStart = (run: TestRun): number => fixStart(run) + FIX_T.type + FIX_T.rest
const testLength = (run: TestRun): number => (run.fix ? rerunStart(run) + run.items.length * run.each : run.items.length * run.each)
/** 重跑:每一項都通過 */
const passed = (run: TestRun, fix: TestFix): TestRun => ({ ...run, how: '改好了，重跑一次', items: run.items.map((x) => ({ ...x, ok: true })), summary: fix.done })
/** 測試開始後 t 毫秒的畫面:跑測試 → (有失敗要改的)改程式 → 重跑 */
function testStage(run: TestRun, t: number): { fixing: boolean; html: string } {
  const fix = run.fix
  if (fix && t >= rerunStart(run)) return { fixing: false, html: testsHtml(passed(run, fix), Math.floor((t - rerunStart(run)) / run.each)) }
  if (fix && t >= fixStart(run)) {
    const total = kit.graphemes(fix.add.join('\n')).length
    return { fixing: true, html: fixHtml(fix, Math.floor(total * kit.progress(t, fixStart(run), FIX_T.type))) }
  }
  return { fixing: false, html: testsHtml(run, Math.floor(t / run.each)) }
}
const writeTyping = (era: Era, n: number, step?: ThenNowStep): number => {
  const chunk = chunksOf(era)[n - 1]
  const run = chunk?.tests
  // 手寫那一段:長度照打字速度與段落停頓算(畫面裡的刻度,播放時再乘 SLOW)
  if (era === 'then' && n === 1) return handMs(chunk.lines, step?.cps, step?.pause) / SLOW
  if (chunk?.edits) return chunk.ms!
  // 程式再長也很快帶過;測試那一段一項一項跑
  return run ? testLength(run) : Math.min(chunksOf(era)[n - 1]?.ms ?? T.writeMax, kit.typeDuration(chunkText(era, n), CODE_CPS))
}
const eraOf = (mode: ThenNowState['mode']): Era => (mode === 'frame' ? 'frame' : 'then')
const span = (cls: string, text: string): string => `<span class="tn-${cls}">${kit.esc(text)}</span>`
/** 一行程式的 HTML;壞掉時第 3 行從引號起、第 4 行整行都是字串色。mark 是正在補上去的符號 */
function lineHtml(code: Seg[][], n: number, fixed: boolean, mark: string): string {
  const line = code[n - 1]
  if (fixed || n < BUG_LINE) return line.map(([c, t]) => span(c, t)).join('')
  if (n > BUG_LINE) return span('s', plain(line))
  const cut = line.findIndex(([c]) => c === 's')
  const head = line.slice(0, cut).map(([c, t]) => span(c, t)).join('')
  const str = line[cut][1].slice(0, -1)
  return `${head}${span('s', str)}<span class="tn-slot">${mark}</span>${span('s', line.slice(cut + 1).map((s) => s[1]).join(''))}`
}

const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

function pageHtml(shop: string, st: ThenNowState, fresh: boolean): string {
  const big = st.made && st.want === 'button'
  const rest = st.fixed
    ? `<div class="tn-btn${big ? ' big' : ''}${big && fresh ? ' tn-new' : ''}">訂購麵包</div>${
        st.made && st.want === 'sale' ? `<div class="tn-sale${fresh ? ' tn-new' : ''}"><b>今日特價</b>可頌第二個半價</div>` : ''
      }${
        st.made && st.want === 'menu'
          ? `<ul class="tn-menu${fresh ? ' tn-new' : ''}">${[
              ['鄉村麵包', 120],
              ['可頌', 65],
              ['肉桂捲', 80],
            ]
              .map(([name, price]) => `<li><span>${name}</span><span class="tn-num">$${price}</span></li>`)
              .join('')}</ul>`
          : ''
      }${st.made && st.want === 'hours' ? `<div class="tn-hours${fresh ? ' tn-new' : ''}"><b>營業時間</b><span class="tn-num">每天 7:00–18:00</span></div>` : ''}<p class="tn-addr">地址：森林路 12 號</p>`
    : ''
  return `<p class="tn-title">${kit.esc(shop)}</p><p class="tn-tag">每天早上七點出爐</p>${rest}`
}

function tallyHtml(shop: string, st: ThenNowState): string {
  const write = st.task === 'write'
  const { chars, symbols } = write ? { chars: writtenChars('then', CHUNKS.length), symbols: symbolCount('then') } : codeStats(shop)
  const said = kit.graphemes(st.told ?? '').length
  const time = (era: 'then' | 'frame' | 'now'): [string, string, string] => ['花的時間', timeText(spent(era, 9)), '']
  const flow = (steps: string[]): string => steps.map((s) => `<i>${s}</i>`).join('')
  const col = (cls: string, title: string, rows: [string, string, string][], steps: string[]): string =>
    `<section class="tn-col ${cls}"><h3>${title}</h3>${rows.map(([label, num, unit]) => `<div class="tn-row"><span>${label}</span><strong><b class="tn-num">${num}</b>${unit}</strong></div>`).join('')}<div class="tn-row tn-flow"><span>步驟</span><strong><b class="tn-num">${steps.length}</b> 步</strong><div class="tn-steps">${flow(steps)}</div></div></section>`
  return (
    col('then', '以前 · 自己寫程式', [write ? time('then') : ['你要打的字', String(chars), ' 個字'], ['要顧的符號', String(symbols), write ? ' 個，都要自己打' : ' 個，錯 1 個就壞']], write ? STEPS_WRITE : STEPS_THEN) +
    (write && st.framed === chunksOf('frame').length
      ? col('then', '後來 · 對話式 AI', [time('frame'), ['手動來回', '2', ' 趟，AI 只幫你翻譯']], ['問', '複製', '貼上', '存檔', '打開看', '貼回去'])
      : '') +
    col('now', write ? '現在 · AI Agent' : '現在 · 說一句話', [write ? time('now') : ['你要打的字', String(said), ' 個字'], ['要顧的符號', '0', ' 個']], write ? STEPS_AGENT : STEPS_NOW)
  )
}

const actor = defineActor<Kind, ThenNowStep, ThenNowProps, ThenNowState, Target>({
  name: 'then-now',
  page: true,
  kinds: KINDS,

  init,
  apply,

  duration(kind, step, _props, prev) {
    if (kind === 'replay') return T.replay
    if (kind === 'craft' && prev?.task === 'write') return AGENT_T.total * SLOW
    if (kind === 'handwrite') return step.handwrite === 'all' ? T.writeAll * SLOW : SLOW * (T.writeLead + writeTyping(eraOf(prev?.mode ?? 'then'), Math.min(chunksOf(eraOf(prev?.mode ?? 'then')).length, (prev ? countOf(prev) : 0) + 1), step) + T.writeTail)
    if (kind === 'tell') return T.tellLead + kit.typeDuration(step.tell ?? '', CPS) + T.tellTail
    return T[kind]
  },
  autoFocus() {
    return false
  },

  mount(root, props) {
    const shop = props.shop ?? '小森烘焙'
    const asks = props.asks ?? []
    const code = codeOf(shop)
    // 減少動態效果:只留淡入淡出,不位移、不縮放
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    root.classList.add('A-then-now')
    root.innerHTML = `<div class="tn-frame">
      <header class="tn-head"><div class="tn-tabs"><span class="tn-tab" data-m="then" data-t="tab:then">以前 · 自己寫程式</span><span class="tn-tab" data-m="now" data-t="tab:now">現在 · 說一句話</span></div><div class="tn-meter"></div></header>
      <div class="tn-body">
        <section class="tn-work"></section>
        <section class="tn-view"><div class="tn-bar"><i></i><i></i><i></i><span>${kit.esc(shop)}</span></div><div class="tn-page"></div></section>
      </div>
      <footer class="tn-foot" hidden><ol class="tn-progress" aria-label="工作進度"></ol></footer>
      <div class="tn-tally"></div>
    </div>`
    const q = <E extends HTMLElement = HTMLElement>(sel: string): E | null => root.querySelector<E>(sel)
    const frame = q('.tn-frame')!
    const body = q('.tn-body')!
    const isTall = kit.tallWatch(root)
    const work = q('.tn-work')!
    const page = q('.tn-page')!
    const meter = q('.tn-meter')!
    const tally = q('.tn-tally')!
    // 畫面測試的框與游標:疊在右邊網頁上(不放進會重畫的網頁內容裡)
    const view_ = q('.tn-view')!
    const probeBox = document.createElement('div')
    probeBox.className = 'tn-probe'
    probeBox.hidden = true
    probeBox.innerHTML = '<span class="tn-pointer"><i class="tn-ring"></i><i class="tn-arrow"></i><em>Agent</em></span><span class="tn-verdict"></span>'
    view_.appendChild(probeBox)
    // 用 offset 量在預覽框裡的位置(舞台整張縮放時也正確;不含捲動)
    const offsetIn = (el: HTMLElement): { x: number; y: number } => {
      let x = 0
      let y = 0
      for (let e: HTMLElement | null = el; e && e !== view_; e = e.offsetParent as HTMLElement | null) {
        x += e.offsetLeft
        y += e.offsetTop
      }
      return { x, y }
    }
    const showProbe = (probe: Probe | null): void => {
      const el = probe ? view_.querySelector<HTMLElement>(probe.at === 'bar' ? '.tn-bar' : `[data-v="${probe.at}"]`) : null
      // 手機上網頁比預覽框高:捲到正在測的地方(沒在測就停在最上面)
      const inPage = !!el && page.contains(el)
      // 放得下就置中,比預覽框還高就對齊它的上緣
      page.scrollTop = inPage ? Math.max(0, offsetIn(el!).y - offsetIn(page).y - Math.max(0, page.clientHeight - el!.offsetHeight) / 2) : 0
      probeBox.hidden = !el
      if (!el || !probe) return
      const { x, y: top } = offsetIn(el)
      // 網頁裡的目標:框跟著捲動,超出預覽框的部分裁掉
      const area = offsetIn(page).y
      const y = inPage ? Math.max(area, top - page.scrollTop) : top
      const height = inPage ? Math.max(0, Math.min(area + page.clientHeight, top - page.scrollTop + el.offsetHeight) - y) : el.offsetHeight
      Object.assign(probeBox.style, { left: `${x}px`, top: `${y}px`, width: `${el.offsetWidth}px`, height: `${height}px` })
      probeBox.dataset.s = probe.state
      probeBox.dataset.who = probe.who ?? 'you'
      probeBox.querySelector('.tn-verdict')!.textContent = probe.state === 'fail' ? '✗' : probe.state === 'pass' ? '✓' : ''
      // 游標從框外滑進來,到了點一下
      const p = kit.ease.outCubic(Math.min(1, probe.part / 0.5))
      const pointer = probeBox.querySelector<HTMLElement>('.tn-pointer')!
      pointer.style.transform = `translate(${((1 - p) * 60).toFixed(1)}px, ${((1 - p) * 40).toFixed(1)}px) scale(${probe.part > 0.5 && probe.part < 0.65 ? 0.8 : 1})`
      // 點下去的光圈:依時間算(不用 CSS 動畫)
      const ripple = Math.min(1, Math.max(0, (probe.part - 0.5) / 0.4))
      const ring = probeBox.querySelector<HTMLElement>('.tn-ring')!
      ring.style.transform = `scale(${(0.4 + ripple * 1.8).toFixed(2)})`
      ring.style.opacity = ripple > 0 && ripple < 1 ? (1 - ripple).toFixed(2) : '0'
    }
    const pressable = !!root.closest('[data-pressable]')
    const foot = q('.tn-foot')!
    frame.dataset.task = props.task ?? 'fix'
    if (props.task === 'write') {
      const tab = document.createElement('span')
      tab.className = 'tn-tab'
      tab.dataset.m = 'frame'
      tab.dataset.t = 'tab:frame'
      tab.textContent = '後來 · 對話式 AI'
      q('.tn-tab[data-m="now"]')!.before(tab)
      q('.tn-tab[data-m="now"]')!.textContent = '現在 · AI Agent'
    }
    const progress = q('.tn-progress')!
    // 自己寫(task: write):行數、時間和工作進度放在下面,上緣只留分頁
    if (props.task === 'write') {
      foot.hidden = false
      foot.appendChild(meter)
      // 靜態互動:分頁和「繼續看」改成舞台左側的浮空按鈕(controls),身上不再放
      if (pressable) q('.tn-head')!.hidden = true
    }

    const thenHtml = (st: ThenNowState, mark: string, markBad: boolean): string => {
      const lines = code
        .map((_, i) => {
          const n = i + 1
          const state = st.fixed ? (n === BUG_LINE ? 'fixed' : '') : n === BUG_LINE && st.found ? 'found' : st.looked.includes(n) ? 'ok' : ''
          const slot = n === BUG_LINE && mark ? `<b class="tn-mark${markBad ? ' bad' : ''}">${kit.esc(mark)}</b>` : ''
          return `<${pressable && !st.fixed ? 'button type="button"' : 'div'} class="tn-line" data-t="line:${n}" data-s="${state}"><span class="tn-no tn-num">${n}</span><code>${lineHtml(code, n, st.fixed, slot)}</code><span class="tn-flag">${state === 'ok' || state === 'fixed' ? CHECK : ''}</span></${pressable && !st.fixed ? 'button' : 'div'}>`
        })
        .join('')
      const keys =
        st.found && !st.fixed
          ? `<div class="tn-keys" data-t="keys"><span class="tn-keys-label">補上</span>${Object.entries(KEYS)
              .map(([name, c]) => `<${tag} class="tn-key${st.tried.includes(c) ? ' tried' : ''}" data-t="key:${name}" aria-label="補上 ${kit.esc(c)}">${kit.esc(c)}</${end}>`)
              .join('')}</div>`
          : ''
      const next = st.fixed ? `<${tag} class="tn-next" data-t="next">修好了，繼續<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.500 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></${end}>` : ''
      // 訊息在上、可以按的東西緊接在程式碼下面:畫面下緣會被播放器的控制列蓋住,不放重要的東西
      return `<div class="tn-file">index.html</div><p class="tn-note" data-t="note" data-tone="${st.note.tone}">${kit.esc(st.note.text)}</p><div class="tn-code" data-t="code">${lines}</div>${keys || next ? `<div class="tn-acts">${keys}${next}</div>` : ''}`
    }

    /** 自己寫:寫好的幾段,加上正在打的那一段(自動示範,沒有按鈕) */
    const writeHtml = (st: ThenNowState, typing: { chunk: number; chars: number; cps?: number; pause?: number } | null, elapsed: number): string => {
      const era = eraOf(st.mode)
      if (era === 'frame' && st.mode === 'frame') {
        // 還沒開始:第一段的第 0 毫秒
        const now = chunksOf(era)[(typing ? typing.chunk : countOf(st)) - 1]
        const chat = now ? chatFrame(now.chat!, typing ? elapsed : now.ms!) : chatFrame(1, 0)
        return `<p class="tn-note" data-t="note" data-tone="${st.note.tone}">${kit.esc(st.note.text)}</p><div class="tn-code tn-chatera" data-t="code">${chat.html}</div>`
      }
      const run = chunksOf(era)[(typing ? typing.chunk : countOf(st)) - 1]?.tests
      const stage = run ? testStage(run, typing ? elapsed : testLength(run)) : null
      const file = stage?.fixing ? `修改 ${run!.fix!.file}` : run ? '測試' : 'signup.html'
      const body = stage ? stage.html : codeHtml(era, countOf(st), typing)
      return `<div class="tn-file">${file}</div><p class="tn-note" data-t="note" data-tone="${st.note.tone}">${kit.esc(st.note.text)}</p><div class="tn-code ${run ? 'tn-testing' : 'tn-source'}" data-t="code">${body}</div>`
    }

    const nowHtml = (st: ThenNowState, typed: string, ticks: number, working: boolean, compose: { caret: boolean; pressed: boolean } | null, testing: number): string => {
      // 自己寫版是 AI Agent 的聊天畫面:對話在上、輸入框固定在最下面
      if (st.task === 'write') {
        const sent = !compose && st.told !== null
        const history = sent
          ? `<div class="tn-said" data-t="said">${kit.esc(typed)}</div>${st.made || working ? agentLog(ticks, st.made ? testing : 0) : ''}`
          : ''
        const input = compose ? `${kit.esc(typed)}<i class="tn-caret" style="opacity:${compose.caret ? 1 : 0}"></i>` : '<span class="tn-placeholder">跟 AI Agent 說你要什麼…</span>'
        const note = compose ? { tone: 'hint', text: '打好這一句，按送出。' } : st.note
        return `<div class="tn-file">對 AI Agent 說</div><p class="tn-note" data-t="note" data-tone="${note.tone}">${kit.esc(note.text)}</p><div class="tn-prompt" data-t="prompt"><div class="tn-chat">${history}</div><div class="tn-compose"><div class="tn-input"${compose ? ' data-t="said"' : ''}>${input}</div><span class="tn-send${compose?.pressed ? ' pressed' : ''}">送出</span></div></div>`
      }
      // 打字中:輸入框裡一個字一個字出現,打完按下送出
      if (compose) {
        return `<div class="tn-file">對 AI 說</div><p class="tn-note" data-t="note" data-tone="hint">打好這一句，按送出。</p><div class="tn-prompt" data-t="prompt"><div class="tn-compose"><div class="tn-input" data-t="said">${kit.esc(typed)}<i class="tn-caret" style="opacity:${compose.caret ? 1 : 0}"></i></div><span class="tn-send${compose.pressed ? ' pressed' : ''}">送出</span></div></div>`
      }
      const list =
        st.told === null
          ? `<div class="tn-asks">${asks.map((a, i) => `<${tag} class="tn-ask" data-t="ask:${i}">${kit.esc(a.text)}</${end}>`).join('')}</div>`
          : `<div class="tn-said" data-t="said">${kit.esc(typed)}</div>${
              st.made || working
                ? `<ol class="tn-ai" data-t="result">${aiSteps(st.task).map((s, i) => `<li data-on="${i < ticks ? 1 : 0}"><span class="tn-flag">${i < ticks ? CHECK : ''}</span>${s}</li>`).join('')}</ol>`
                : ''
            }`
      return `<div class="tn-file">對 AI 說</div><p class="tn-note" data-t="note" data-tone="${st.note.tone}">${kit.esc(st.note.text)}</p><div class="tn-prompt" data-t="prompt">${list}</div>`
    }

    // 自己處理點擊(靜態互動,外層標 data-pressable):可以點的畫成按鈕;影片裡維持一般元素
    const tag = pressable ? 'button type="button"' : 'span'
    const end = pressable ? 'button' : 'span'
    if (pressable) {
      for (const el of root.querySelectorAll<HTMLElement>('.tn-tab')) {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = el.className
        b.dataset.m = el.dataset.m
        b.dataset.t = el.dataset.t
        b.textContent = el.textContent
        el.replaceWith(b)
      }
    }
    /** 畫面目前的狀態,點擊時依它決定做什麼 */
    let latest: ThenNowState | null = null

    return {
      press(name) {
        const st = latest
        if (!st) return null
        const [what, arg] = name.split(':')
        // tour:換分頁就從那一邊的第一階段重新演起
        if (what === 'tab') return arg === st.mode ? null : props.tour && st.task === 'write' ? [{ turn: arg }, { replay: 1 }] : [{ turn: arg }]
        if (what === 'stage') return st.task === 'write' ? [{ replay: Number(arg) }] : null
        if (st.task === 'write' && st.mode !== 'now') return null
        if (st.mode === 'then') {
          if (st.fixed) return null
          if (what === 'line') return [{ look: Number(arg) }]
          if (what === 'key' && st.found && KEYS[arg]) return [{ mend: KEYS[arg] }]
          return null
        }
        const ask = what === 'ask' && st.task !== 'write' ? asks[Number(arg)] : undefined
        return ask && !st.told ? [{ tell: ask.text }, { craft: true }] : null
      },

      controls() {
        const st = latest
        if (!st || st.task !== 'write') return null
        return [
          { name: 'tab:then', label: '以前', sub: '自己寫', group: 'mode', on: st.mode === 'then' },
          { name: 'tab:frame', label: '後來', sub: '對話式 AI', group: 'mode', on: st.mode === 'frame' },
          { name: 'tab:now', label: '現在', sub: 'AI Agent', group: 'mode', on: st.mode === 'now' },
          { name: 'next', label: '繼續看', primary: true },
        ]
      },

      // 自己寫版是自動示範:學員只選「以前」或「現在」,選到的那一邊自己演下去
      auto() {
        const st = latest
        if (!st || st.task !== 'write') return null
        if (st.mode !== 'now') {
          if (countOf(st) < chunksOf(eraOf(st.mode)).length) return [{ handwrite: true }]
          return props.tour ? [{ turn: st.mode === 'then' ? 'frame' : 'now' }, { replay: 1 }] : null
        }
        if (st.made) return null
        const ask = asks[0]
        return st.told ? [{ craft: true }] : ask ? [{ tell: ask.text }, { craft: true }] : null
      },

      render(f) {
        const view = f.view
        if (!view) return
        latest = view.state
        const ev = view.ev && KINDS.includes(view.ev.kind as Kind) ? view.ev : null
        const kind = ev?.kind as Kind | undefined
        const step = (ev?.step ?? {}) as ThenNowStep
        // 畫面裡的時間照原速的刻度算:預設放慢(SLOW)、腳本用 ms 指定長短,都只是把這個刻度拉長或壓短
        const base = ev && kind ? actor.duration(kind, step, props, view.prev) / (isDemo(kind, view.state.task) ? SLOW : 1) : 0
        const local = ev?.dur ? ev.local * (base / ev.dur) : 0
        // 動作前半還是原本的畫面,過了切換點才換成結果
        const flipAt = kind === 'look' ? T.lookAt : kind === 'mend' ? T.mendAt : kind === 'turn' ? T.turnAt : 0
        const st = ev && local < flipAt ? view.prev : view.state
        const final = view.state

        frame.dataset.mode = st.mode
        frame.dataset.fixed = st.fixed || st.mode === 'now' ? '1' : '0'

        // 工作區
        let html: string
        // 正在打哪一段:打完才算寫好
        const era = eraOf(view.prev.mode)
        const chunk = Math.min(chunksOf(era).length, countOf(view.prev) + 1)
        const busy = kind === 'handwrite' && step.handwrite === true && local < T.writeLead + writeTyping(era, chunk, step)
        if (st.mode !== 'now' && st.task === 'write') {
          const all = busy ? kit.graphemes(chunkText(era, chunk)).length : 0
          const chars = busy ? Math.floor(all * kit.progress(local, T.writeLead, writeTyping(era, chunk, step))) : 0
          html = writeHtml(busy ? view.prev : st, busy ? { chunk, chars, cps: step.cps, pause: step.pause } : null, Math.max(0, local - T.writeLead))
        } else if (st.mode === 'then') {
          // 正在補的符號:先出現在缺口,補錯的變色後拿掉
          const wrong = kind === 'mend' && step.mend !== RIGHT
          const mark = kind === 'mend' && !st.fixed && (!wrong || local < 1150) ? String(step.mend) : ''
          html = thenHtml(st, mark, wrong && local >= T.mendAt)
        } else {
          const typing = kind === 'tell' ? kit.typewriter(final.told ?? '', local, { start: T.tellLead, cps: CPS }).text : null
          const typed = typing ?? st.told ?? ''
          const typedAt = T.tellLead + kit.typeDuration(final.told ?? '', CPS)
          // 游標:打字時常亮,打完閃
          const compose = kind === 'tell' && local < typedAt + T.sendAt ? { caret: local < typedAt || Math.floor((local - typedAt) / 250) % 2 === 0, pressed: local >= typedAt + T.pressAt } : null
          const tickAt = st.task === 'write' ? AGENT_T.ticks : T.craftTicks
          const ticks = kind === 'craft' ? tickAt.filter((t) => local >= t).length : st.made ? AI_STEPS.length : 0
          // craft 進行中:訊息列等做完才換
          const shown = kind === 'craft' && local < tickAt[2] ? { ...st, note: view.prev.note } : st
          html = nowHtml(shown, typed, ticks, kind === 'craft', compose, kind === 'craft' ? local : Infinity)
        }
        kit.setIf(work, 'html', html)
        // 直式版面:現在主要在看的那一區放大(橫式不變)
        if (st.task === 'write' && isTall()) {
          /** 某一邊做完 n 個階段、停著時看哪裡 */
          const rest = (mode: ThenNowState['mode'], s: ThenNowState): Area =>
            mode === 'now' ? (s.made ? 'view' : 'work') : mode === 'frame' ? (s.framed >= 2 ? 'view' : 'work') : s.written >= CHUNKS.length ? 'view' : 'work'
          let zoom = rest(st.mode, busy ? view.prev : st) === 'view' ? 1 : 0
          let editor = st.mode === 'frame' && countOf(st) >= 2 ? 1 : 0
          const before = rest(view.prev.mode, view.prev) === 'view'
          if (busy) {
            const t = Math.max(0, local - T.writeLead)
            const run = chunksOf(era)[chunk - 1]
            if (run.chat) {
              zoom = share((x) => chatArea(run.chat!, x) === 'view', t, before)
              editor = share((x) => chatPart(run.chat!, x) === 'editor', t, chunk > 2)
            } else {
              // 以前:打程式、單元測試看工作區;人工測試(在網頁上點)看預覽
              zoom = share(() => !!run.tests?.items.some((x) => x.at), local, before)
            }
          } else if (kind === 'craft') zoom = share((x) => !!agentProbe(x) || x >= AGENT_T.total - 300, local, false)
          else if (kind === 'turn' && view.prev.mode !== final.mode) {
            const p = kit.ease.inOutCubic(kit.progress(local, 0, T.turn))
            zoom = kit.lerp(before ? 1 : 0, rest(final.mode, final) === 'view' ? 1 : 0, p)
          }
          const top = kit.lerp(0.28, 0.66, zoom)
          body.style.gridTemplateRows = `minmax(0, ${top.toFixed(3)}fr) minmax(0, ${(1 - top).toFixed(3)}fr)`
          const talkBox = work.querySelector<HTMLElement>('.tn-cwin')
          const edBox = work.querySelector<HTMLElement>('.tn-ced')
          if (talkBox && edBox) {
            talkBox.style.flexGrow = kit.lerp(3.2, 0.8, editor).toFixed(3)
            edBox.style.flexGrow = kit.lerp(1, 3.4, editor).toFixed(3)
          }
        } else body.style.gridTemplateRows = ''
        // 對話式 AI:聊天停在最新的訊息;示範進行中的網頁開了沒、正在點哪裡
        const talk = work.querySelector<HTMLElement>('.tn-cchat')
        if (talk) {
          // 平常停在最新的訊息;正在複製那段程式時,讓它的檔名列(複製鈕)露出來
          const copying = talk.querySelector('.tn-cblock .tn-mouse, .tn-cblock pre.sel')?.closest<HTMLElement>('.tn-cblock')
          const top = (el: HTMLElement): number => {
            let y = 0
            for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) y += e.offsetTop
            return y
          }
          talk.scrollTop = copying ? Math.max(0, top(copying) - top(talk) - 8) : talk.scrollHeight
        }
        // 編輯器:修正後捲到改的那一行,其他時候從頭看
        const code = work.querySelector<HTMLElement>('.tn-ced pre')
        if (code) {
          const mark = code.querySelector<HTMLElement>('mark')
          code.scrollTop = mark ? Math.max(0, mark.offsetTop - code.clientHeight / 2) : 0
        }
        const chat = busy && st.mode === 'frame' ? chatFrame(chunksOf('frame')[chunk - 1].chat!, Math.max(0, local - T.writeLead)) : null
        // 程式越寫越長:程式區停在最新的那一行(打完重畫也一樣)
        if (st.task === 'write' && st.mode !== 'now') {
          const src = work.querySelector<HTMLElement>('.tn-source')
          // 回頭改前面的行時,捲到正在改的那一行
          const editing = src?.querySelector<HTMLElement>('.tn-editing')
          const first = src?.querySelector<HTMLElement>('.tn-src')
          if (src) src.scrollTop = editing && first ? Math.max(0, editing.offsetTop - first.offsetTop - src.clientHeight / 2) : src.scrollHeight
        }

        // 自己寫的測試清單:捲到正在跑的那一項,跑完捲到最下面的總結
        if (st.task === 'write' && st.mode !== 'now') {
          const box = work.querySelector<HTMLElement>('.tn-testing:not(.tn-agent)')
          if (box) {
            const active = [...box.querySelectorAll<HTMLElement>('.tn-run li')].filter((li) => li.dataset.s && li.dataset.s !== 'wait').at(-1)
            const done = box.querySelector('.tn-sum, .tn-fixing')
            // 用 offset 算(舞台整張縮放時也正確),直接指定位置:跳到任何時間點畫出來都一樣
            const top = (el: HTMLElement): number => {
              let y = 0
              for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) y += e.offsetTop
              return y
            }
            if (done || !active) box.scrollTop = done ? box.scrollHeight : 0
            else box.scrollTop = Math.max(0, top(active) - top(box) + active.offsetHeight - box.clientHeight + 8)
          }
        }

        // 測試清單長出來時捲到最新的那一項
        if (st.task === 'write' && st.mode === 'now') {
          const box = work.querySelector<HTMLElement>('.tn-chat')
          if (box) box.scrollTop = box.scrollHeight
        }

        // 畫面測試:游標現在在哪裡
        let probe: Probe | null = null
        if (st.task === 'write' && st.mode !== 'now') {
          const testing = busy ? chunksOf(era)[chunk - 1]?.tests : chunksOf(eraOf(st.mode))[countOf(st) - 1]?.tests
          if (testing) probe = probeOf(testing, busy ? local - T.writeLead : testLength(testing))
          if (chat) probe = chat.probe
        } else if (st.task === 'write' && st.made && kind === 'craft') probe = agentProbe(local)
        showProbe(probe)

        // 檢查中的那一行:掃過去的底色
        if (kind === 'look') {
          const el = work.querySelector<HTMLElement>(`[data-t="line:${step.look}"]`)
          if (el) el.style.setProperty('--scan', (1 - kit.progress(local, 0, T.look)).toFixed(3))
        }
        // 換到「現在」:工作區淡出再淡入
        const fade = kind === 'turn' && view.prev.mode !== final.mode ? (local < T.turnAt ? 1 - kit.progress(local, 0, T.turnAt) : kit.progress(local, T.turnAt, T.turn - T.turnAt - 150)) : 1
        kit.setIf(work, 'opacity', fade.toFixed(3))

        // 預覽:craft 做到一半才長出新的東西
        const building = kind === 'craft' && local < T.craftShow
        const pageState = building ? { ...final, made: false } : kind === 'craft' ? final : busy ? { ...view.prev, mode: st.mode } : st
        const fresh = kind === 'craft' && !building
        // 「現在」一律從完整的網頁做起(不管程式修了沒);「以前」看不到 AI 做的東西
        const side = building ? st.mode : pageState.mode
        kit.setIf(
          page,
          'html',
          pageState.task === 'write'
            ? previewHtml(side === 'now' ? 4 : side === 'frame' ? (chat?.opened ? 4 : framePreview(pageState.framed)) : thenPreview(pageState.written), side === 'now' && pageState.made ? (pageState.want as SignupWant) : null, fresh)
            : pageHtml(shop, side === 'now' ? { ...pageState, fixed: true } : { ...pageState, made: false }, fresh),
        )
        const grown = page.querySelector<HTMLElement>('.tn-new')
        if (grown) {
          const p = kit.ease.outCubic(kit.progress(local, T.craftShow, 700))
          kit.css(grown, { opacity: p.toFixed(3), transform: calm ? 'none' : `translateY(${((1 - p) * 0.6).toFixed(3)}em)` })
          grown.style.setProperty('--glow', (1 - kit.progress(local, T.craftShow + 500, 900)).toFixed(3))
        }
        // 剛修好:按鈕和地址淡入
        if (kind === 'mend' && final.fixed && st.fixed) {
          const p = kit.progress(local, T.mendAt, 600)
          for (const el of page.querySelectorAll<HTMLElement>('.tn-btn, .tn-addr')) el.style.opacity = p.toFixed(3)
        }

        // 右上角的計數
        const checked = st.looked.length + (st.found ? 1 : 0)
        const symbols = st.tried.length + (st.fixed ? 1 : 0)
        if (st.task !== 'write') {
          kit.setIf(
            meter,
            'html',
            st.mode === 'then'
              ? `<span>檢查 <b class="tn-num">${checked}</b> 行</span><span>試 <b class="tn-num">${symbols}</b> 個符號</span>`
              : `<span>說 <b class="tn-num">${st.told ? 1 : 0}</b> 句話</span><span>寫 <b class="tn-num">0</b> 行程式</span>`,
          )
        }

        // 工作進度:「以前」是四段程式,「現在」是 AI 的三件事;done 做完、now 正在做或下一件
        if (st.task === 'write') {
          const names = st.mode !== 'now' ? chunksOf(eraOf(st.mode)).map((c) => c.name) : ['說需求', ...AGENT_STEPS]
          const aiDone = kind === 'craft' ? (st.task === 'write' ? AGENT_T.ticks : T.craftTicks).filter((t) => local >= t).length : final.made ? AI_STEPS.length : 0
          // 打字中、還沒按送出:第一階段還在進行
          const saying = kind === 'tell' && local < T.tellLead + kit.typeDuration(final.told ?? '', CPS) + T.sendAt
          const done = st.mode !== 'now' ? countOf(busy ? view.prev : final) : st.told && !saying ? 1 + aiDone : 0
          kit.setIf(progress, 'html', names.map((name, i) => `<li data-s="${i < done ? 'done' : i === done ? 'now' : ''}"><${tag} class="tn-step" data-t="stage:${i + 1}"><span class="tn-dot">${i < done ? CHECK : i + 1}</span>${name}<span class="tn-doing">進行中</span></${end}></li>`).join(''))
          // 正在跑的那一階段:標出來,底色依時間填滿
          const current = progress.querySelector<HTMLElement>('li[data-s="now"]')
          if (current) {
            const typingStage = st.mode !== 'now' && busy
            const sending = st.mode === 'now' && (kind === 'tell' || kind === 'craft')
            const part = typingStage ? kit.progress(local, T.writeLead, writeTyping(era, chunk, step)) : kind === 'tell' ? kit.progress(local, 0, view.ev?.dur ?? 1) : kind === 'craft' ? kit.progress(local, 0, AGENT_T.total) : 0
            // 剛點了這一階段(replay)就先亮起來,不等示範開始打
            current.dataset.run = typingStage || sending || kind === 'replay' ? '1' : '0'
            current.style.setProperty('--p', part.toFixed(3))
          }
          // 右下角:寫了幾行(或說了幾句)和累計花的時間;進行中的階段跟著進度一起累加
          const era_ = st.mode === 'now' ? 'now' : eraOf(st.mode)
          const running = current?.dataset.run === '1' ? Number(current.style.getPropertyValue('--p')) : 0
          const first = st.mode === 'now' ? `<span>說 <b class="tn-num">${st.told && !saying ? 1 : 0}</b> 句話</span>` : st.mode === 'frame' ? `<span>手動來回 <b class="tn-num">${Math.max(0, countOf(busy ? view.prev : st) - 1)}</b> 趟</span>` : `<span>寫了 <b class="tn-num">${writtenLines('then', countOf(busy ? view.prev : st))}</b> 行</span>`
          kit.setIf(meter, 'html', `${first}<span>用了 <b class="tn-num">${timeText(spent(era_, done, running))}</b></span>`)
        }

        // 對照表
        const showTally = final.tallied
        kit.setIf(tally, 'html', showTally ? tallyHtml(shop, final) : '')
        const tp = kind === 'tally' ? kit.ease.outCubic(kit.progress(local, 0, 500)) : showTally ? 1 : 0
        kit.css(tally, { opacity: tp.toFixed(3), visibility: tp > 0 ? 'visible' : 'hidden' })
        if (showTally) {
          ;[...tally.querySelectorAll<HTMLElement>('.tn-col')].forEach((el, i) => {
            const p = kind === 'tally' ? kit.ease.outCubic(kit.progress(local, 200 + i * 350, 500)) : 1
            kit.css(el, { opacity: p.toFixed(3), transform: calm ? 'none' : `translateY(${((1 - p) * 0.8).toFixed(3)}em)` })
          })
        }
      },

      target(name) {
        if (name === 'window') return frame
        if (name === 'preview') return q('.tn-view')
        if (name === 'meter') return meter
        if (name === 'tally') return tally.childElementCount ? tally : null
        return q(`[data-t="${name}"]`)
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
