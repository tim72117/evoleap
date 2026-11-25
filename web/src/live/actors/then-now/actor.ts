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
//   asks   「現在」可以說的一句話:[{ text, want }],want 是 button(把按鈕變大)、sale(今日特價)、menu(菜單)、hours(營業時間);
//          還沒說之前,這幾句會列在輸入框上方(目標 ask:N,從 0 起算),互動點的選項疊在上面
//
// 動作:
//   { "look": 2 }              檢查第 2 行(1–4);沒寫錯的行標成「沒問題」,第 3 行會找到少掉的引號
//   { "mend": "\"" }           在找到的地方補一個符號:"(對)、>、/、;(都不對,畫面還是壞的);要先 look 找到才行
//   { "turn": "now" }          從「以前」換到「現在」;要先修好
//   { "tell": "…", "want": "menu" }   對 AI 說一句話(逐字打出);want 是這句話要的東西,沒寫時用 asks 裡同一句的 want
//   { "craft": true }          AI 動手:讀懂、寫程式、檢查,預覽上長出成品;要先 tell
//   { "tally": true }          把「以前」和「現在」並排對照;要先 craft
//
// 目標:window、code、preview、note、meter、line:N、keys、key:quote|gt|slash|semi、next(修好後的「繼續」)、
//       prompt、ask:N、said、result、tally
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

export type Want = 'button' | 'sale' | 'menu' | 'hours'
type Kind = 'look' | 'mend' | 'turn' | 'tell' | 'craft' | 'tally'
export type ThenNowStep = CommonStepFields & { look?: number; mend?: string; turn?: string; tell?: string; want?: string; craft?: boolean; tally?: boolean }
export interface ThenNowProps {
  shop?: string
  asks?: { text: string; want: Want }[]
}
type Tone = 'hint' | 'ok' | 'bad' | 'good'
export interface ThenNowState {
  mode: 'then' | 'now'
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
type Target = 'window' | 'code' | 'preview' | 'note' | 'meter' | 'keys' | 'next' | 'prompt' | 'said' | 'result' | 'tally' | `line:${number}` | `key:${string}` | `ask:${number}`

const KINDS: readonly Kind[] = ['look', 'mend', 'turn', 'tell', 'craft', 'tally']
const WANTS: readonly Want[] = ['button', 'sale', 'menu', 'hours']
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
  return { mode: 'then', asks: props.asks ?? [], looked: [], found: false, tried: [], fixed: false, moves: 0, note: { tone: 'hint', text: NOTE_START }, told: null, want: null, made: false, tallied: false }
}

export function apply(st: ThenNowState, kind: Kind, s: ThenNowStep): ThenNowState {
  switch (kind) {
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
    case 'turn':
      if (s.turn !== 'now') throw new Error('turn 要寫 "now"')
      if (st.mode === 'now') throw new Error('turn:已經在「現在」了')
      if (!st.fixed) throw new Error('turn:程式還沒修好,先 look、mend')
      return { ...st, mode: 'now', note: { tone: 'hint', text: NOTE_NOW } }
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

/** 各動作的長度與畫面切換的時間點(毫秒) */
const T = { look: 900, lookAt: 320, mend: 1500, mendAt: 520, turn: 1100, turnAt: 450, tellLead: 300, tellTail: 600, craft: 3400, craftTicks: [500, 1400, 2500], craftShow: 1400, tally: 1400 }
const CPS = 16

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
  return `<h1>${kit.esc(shop)}</h1><p class="tn-tag">每天早上七點出爐</p>${rest}`
}

function tallyHtml(shop: string, st: ThenNowState): string {
  const { chars, symbols } = codeStats(shop)
  const said = kit.graphemes(st.told ?? '').length
  const flow = (steps: string[]): string => steps.map((s) => `<i>${s}</i>`).join('')
  const col = (cls: string, title: string, rows: [string, string, string][], steps: string[]): string =>
    `<section class="tn-col ${cls}"><h3>${title}</h3>${rows.map(([label, num, unit]) => `<div class="tn-row"><span>${label}</span><strong><b class="tn-num">${num}</b>${unit}</strong></div>`).join('')}<div class="tn-row tn-flow"><span>步驟</span><strong><b class="tn-num">${steps.length}</b> 步</strong><div class="tn-steps">${flow(steps)}</div></div></section>`
  return (
    col('then', '以前 · 自己寫程式', [['你要打的字', String(chars), ' 個字'], ['要顧的符號', String(symbols), ' 個，錯 1 個就壞']], STEPS_THEN) +
    col('now', '現在 · 說一句話', [['你要打的字', String(said), ' 個字'], ['要顧的符號', '0', ' 個']], STEPS_NOW)
  )
}

const actor = defineActor<Kind, ThenNowStep, ThenNowProps, ThenNowState, Target>({
  name: 'then-now',
  kinds: KINDS,

  init,
  apply,

  duration(kind, step) {
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
      <header class="tn-head"><div class="tn-tabs"><span class="tn-tab" data-m="then">以前 · 自己寫程式</span><span class="tn-tab" data-m="now">現在 · 說一句話</span></div><div class="tn-meter"></div></header>
      <div class="tn-body">
        <section class="tn-work"></section>
        <section class="tn-view"><div class="tn-bar"><i></i><i></i><i></i><span>${kit.esc(shop)}</span></div><div class="tn-page"></div></section>
      </div>
      <div class="tn-tally"></div>
    </div>`
    const q = <E extends HTMLElement = HTMLElement>(sel: string): E | null => root.querySelector<E>(sel)
    const frame = q('.tn-frame')!
    const work = q('.tn-work')!
    const page = q('.tn-page')!
    const meter = q('.tn-meter')!
    const tally = q('.tn-tally')!

    const thenHtml = (st: ThenNowState, mark: string, markBad: boolean): string => {
      const lines = code
        .map((_, i) => {
          const n = i + 1
          const state = st.fixed ? (n === BUG_LINE ? 'fixed' : '') : n === BUG_LINE && st.found ? 'found' : st.looked.includes(n) ? 'ok' : ''
          const slot = n === BUG_LINE && mark ? `<b class="tn-mark${markBad ? ' bad' : ''}">${kit.esc(mark)}</b>` : ''
          return `<div class="tn-line" data-t="line:${n}" data-s="${state}"><span class="tn-no tn-num">${n}</span><code>${lineHtml(code, n, st.fixed, slot)}</code><span class="tn-flag">${state === 'ok' || state === 'fixed' ? CHECK : ''}</span></div>`
        })
        .join('')
      const keys =
        st.found && !st.fixed
          ? `<div class="tn-keys" data-t="keys"><span class="tn-keys-label">補上</span>${Object.entries(KEYS)
              .map(([name, c]) => `<span class="tn-key${st.tried.includes(c) ? ' tried' : ''}" data-t="key:${name}">${kit.esc(c)}</span>`)
              .join('')}</div>`
          : ''
      const next = st.fixed ? `<span class="tn-next" data-t="next">修好了，繼續<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.500 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` : ''
      // 訊息在上、可以按的東西緊接在程式碼下面:畫面下緣會被播放器的控制列蓋住,不放重要的東西
      return `<div class="tn-file">index.html</div><p class="tn-note" data-t="note" data-tone="${st.note.tone}">${kit.esc(st.note.text)}</p><div class="tn-code" data-t="code">${lines}</div>${keys || next ? `<div class="tn-acts">${keys}${next}</div>` : ''}`
    }

    const nowHtml = (st: ThenNowState, typed: string, ticks: number, working: boolean): string => {
      const list =
        st.told === null
          ? `<div class="tn-asks">${asks.map((a, i) => `<span class="tn-ask" data-t="ask:${i}">${kit.esc(a.text)}</span>`).join('')}</div>`
          : `<div class="tn-said" data-t="said">${kit.esc(typed)}</div>${
              st.made || working
                ? `<ol class="tn-ai" data-t="result">${AI_STEPS.map((s, i) => `<li data-on="${i < ticks ? 1 : 0}"><span class="tn-flag">${i < ticks ? CHECK : ''}</span>${s}</li>`).join('')}</ol>`
                : ''
            }`
      return `<div class="tn-file">對 AI 說</div><p class="tn-note" data-t="note" data-tone="${st.note.tone}">${kit.esc(st.note.text)}</p><div class="tn-prompt" data-t="prompt">${list}</div>`
    }

    return {
      render(f) {
        const view = f.view
        if (!view) return
        const ev = view.ev && KINDS.includes(view.ev.kind as Kind) ? view.ev : null
        const kind = ev?.kind as Kind | undefined
        const local = ev?.local ?? 0
        const step = (ev?.step ?? {}) as ThenNowStep
        // 動作前半還是原本的畫面,過了切換點才換成結果
        const flipAt = kind === 'look' ? T.lookAt : kind === 'mend' ? T.mendAt : kind === 'turn' ? T.turnAt : 0
        const st = ev && local < flipAt ? view.prev : view.state
        const final = view.state

        frame.dataset.mode = st.mode
        frame.dataset.fixed = st.fixed ? '1' : '0'

        // 工作區
        let html: string
        if (st.mode === 'then') {
          // 正在補的符號:先出現在缺口,補錯的變色後拿掉
          const wrong = kind === 'mend' && step.mend !== RIGHT
          const mark = kind === 'mend' && !st.fixed && (!wrong || local < 1150) ? String(step.mend) : ''
          html = thenHtml(st, mark, wrong && local >= T.mendAt)
        } else {
          const typed = kind === 'tell' ? kit.typewriter(final.told ?? '', local, { start: T.tellLead, cps: CPS }).text : (st.told ?? '')
          const ticks = kind === 'craft' ? T.craftTicks.filter((t) => local >= t).length : st.made ? AI_STEPS.length : 0
          // craft 進行中:訊息列等做完才換
          const shown = kind === 'craft' && local < T.craftTicks[2] ? { ...st, note: view.prev.note } : st
          html = nowHtml(shown, typed, ticks, kind === 'craft')
        }
        kit.setIf(work, 'html', html)

        // 檢查中的那一行:掃過去的底色
        if (kind === 'look') {
          const el = work.querySelector<HTMLElement>(`[data-t="line:${step.look}"]`)
          if (el) el.style.setProperty('--scan', (1 - kit.progress(local, 0, T.look)).toFixed(3))
        }
        // 換到「現在」:工作區淡出再淡入
        const fade = kind === 'turn' ? (local < T.turnAt ? 1 - kit.progress(local, 0, T.turnAt) : kit.progress(local, T.turnAt, T.turn - T.turnAt - 150)) : 1
        kit.setIf(work, 'opacity', fade.toFixed(3))

        // 預覽:craft 做到一半才長出新的東西
        const building = kind === 'craft' && local < T.craftShow
        const pageState = building ? { ...final, made: false } : kind === 'craft' ? final : st
        const fresh = kind === 'craft' && !building
        kit.setIf(page, 'html', pageHtml(shop, pageState, fresh))
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
        kit.setIf(
          meter,
          'html',
          st.mode === 'then'
            ? `<span>檢查 <b class="tn-num">${checked}</b> 行</span><span>試 <b class="tn-num">${symbols}</b> 個符號</span>`
            : `<span>說 <b class="tn-num">${st.told ? 1 : 0}</b> 句話</span><span>寫 <b class="tn-num">0</b> 行程式</span>`,
        )

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
