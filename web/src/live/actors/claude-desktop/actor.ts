// 演員 claude-desktop:仿 Claude 桌面版(Code 分頁)。規格見 ../../README.md「演員」。
//
// 演員只負責「自己長什麼樣、每個動作畫成什麼樣子」;章節卡、聚光燈、鏡頭、滑鼠、旁白時間由舞台處理。
//
// props(登場設定,寫在腳本 cast 裡):
//   title、folder、branch(null 不顯示)、model、mode(auto|ask|plan|accept)、
//   sessions(側欄其他項目)、lang(介面語言,預設 zh-TW;文字檔在 lang/<語言>.json,加一個檔案就多一種語言)、
//   labels(個別覆寫介面文字)、cps({ user, say } 打字/回覆速度)、dark、noframe
//   側欄左下角的帳號固定是 evoleap(標誌與名稱),不用設定。
//
// 動作(腳本 steps 裡,鍵名就是動作種類):
//   { "user": "幫我…" }                         在輸入框打字後送出
//   { "thinking": true | "Thinking", "ms": 1500 } 對話最新內容下方的思考中狀態(跟著對話走,不固定在輸入框上方)
//   { "say": "回覆,支援 `程式碼` 與 **粗體**" }    逐字出現
//   { "tool": "Read", "arg": "…", "result": "…", "out": "…" }
//   { "edit": "檔名", "lines": [[行號, "+"|"-"|" ", "內容"], …] }
//   { "todos": [["內容", "pending"|"doing"|"done"], …] }
//   { "ask": "hello.txt", "q": "…", "where": "~/…", "preview": "…", "note": "…", "options": [...], "select": 1 }
//       沒有 select:提示停住,等下一個 choose
//   { "choose": 1, "hover": [2] }               (滑鼠)先停在 hover 的選項,再按下 choose 的選項
//   { "mode": "plan" }                          切換權限模式
//   多個 session(側欄項目是 title 加上 sessions;每個 session 有自己的對話、分支與權限模式):
//   { "newSession": "名稱", "branch": "…" }     (滑鼠)按新增 session,切過去
//   { "session": "名稱" }                       (滑鼠)點側欄切換 session
//   { "menu": "名稱" }                          (滑鼠)按該列的 ⋯ 打開選單,停住等下一個 fork
//   { "fork": "新名稱", "branch": "…" }         (滑鼠)按選單的 Fork:帶著對話開新的巢狀 session,切過去
//   { "state": "run"|"ok"|"wait"|"idle" }       設定 session 的狀態燈(送出 user 時自動變 run)
//   上面的 user、say、tool 等動作可以加 "in": "名稱":瞬間記到那個背景 session,不切畫面,不佔時間(pause 要自己寫 0)。
//   名稱對不上、沒開選單就 fork 時,載入就報錯並指出第幾步。
//
// 目標(給鏡頭、聚光燈、滑鼠用,腳本裡寫成「演員代號:目標」,例如 claude:ask):
//   composer、input、send、mode、model、head、sidebar、log、latest(對話最底下那一帶)、ask(最後一個確認提示)、
//   option:N(待選提示的第 N 個選項)、user(最後一則使用者訊息)、say、tool、edit、todos、
//   new(新增 session 按鈕)、sessions(側欄整份清單)、session:名稱(側欄那一列)、more:名稱(那一列的 ⋯)、menu(選單)、menuitem:項目(例如 menuitem:Fork)
import { kit } from '../../kit'
import { defineActor, type ActorEvent, type CommonStepFields, type CursorPlan, type Hotspot } from '../../types'
import './actor.css'
import LOGO_SVG from '../../../../public/favicon.svg?raw'

// ---------- 介面文字(lang/<語言>.json) ----------

/** 一種語言的介面文字;{name}、{title}、{option} 會換成實際的內容 */
export interface ClaudeUi {
  title: string
  labels: Labels
  tools: Record<string, string>
  done: string
  todos: string
  askQuestion: string
  /** 確認提示的預設選項;第 0 個是拒絕 */
  askOptions: string[]
  resolved: string
  forked: string
  switchTo: string
  menuOf: string
  input: string
}
const LANGS: Record<string, ClaudeUi> = Object.fromEntries(
  Object.entries(import.meta.glob('./lang/*.json', { eager: true, import: 'default' }) as Record<string, ClaudeUi>).map(([f, ui]) => [f.replace(/^.*\/|\.json$/g, ''), ui]),
)
export const CLAUDE_LANGS = Object.keys(LANGS)
function uiOf(lang: string | undefined): ClaudeUi {
  const ui = LANGS[lang ?? 'zh-TW']
  if (!ui) throw new Error(`claude-desktop 沒有「${lang}」的介面文字(有:${CLAUDE_LANGS.join('、')};要加就新增 lang/${lang}.json)`)
  return ui
}
const fill = (t: string, v: Record<string, string>): string => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)

// 側欄左下角的帳號頭像:evoleap 的標誌(favicon 的同一份 SVG;拿掉跟著系統深色模式換色的樣式,固定用墨綠黑)
const LOGO = LOGO_SVG.replace(/<style>.*?<\/style>/s, '').replace('<svg ', '<svg aria-hidden="true" style="color:#10231f" ')

// ---------- 型別 ----------

type Mode = 'auto' | 'ask' | 'plan' | 'accept'
type TodoState = 'pending' | 'doing' | 'done'
type DiffLine = [no: number | null, sign: '+' | '-' | ' ', text: string]
type SessionState = 'run' | 'ok' | 'wait' | 'idle'

/** 腳本 steps 裡的動作(鍵名就是動作種類) */
export type ClaudeStep = CommonStepFields & { in?: string } &
  (
    | { user: string }
    | { thinking: true | string }
    | { say: string }
    | { tool: string; arg?: string; result?: string; out?: string }
    | { edit: string; lines: DiffLine[] }
    | { todos: [text: string, state: TodoState][] }
    | { ask: string; q?: string; where?: string; preview?: string; note?: string; options?: string[]; select?: number }
    | { choose: number; hover?: number[] }
    | { mode: Mode }
    | { newSession: string; branch?: string | null }
    | { session: string }
    | { menu: string }
    | { fork: string; branch?: string | null }
    | { state: SessionState }
  )
type ClaudeKind = 'user' | 'thinking' | 'say' | 'tool' | 'edit' | 'todos' | 'ask' | 'choose' | 'mode' | 'newSession' | 'session' | 'menu' | 'fork' | 'state'
const KINDS: readonly ClaudeKind[] = ['user', 'thinking', 'say', 'tool', 'edit', 'todos', 'ask', 'choose', 'mode', 'newSession', 'session', 'menu', 'fork', 'state']
type StepOf<K extends ClaudeKind> = Extract<ClaudeStep, Record<K, unknown>>
type Ev<K extends ClaudeKind = ClaudeKind> = ActorEvent<ClaudeStep, K>

/** 目標名稱(給鏡頭、聚光燈、滑鼠用) */
export type ClaudeTarget =
  | 'composer' | 'input' | 'send' | 'mode' | 'model' | 'head' | 'sidebar' | 'log' | 'latest'
  | 'ask' | 'user' | 'say' | 'tool' | 'edit' | 'todos'
  | `option:${number}`
  | 'new' | 'menu' | 'sessions' | `session:${string}` | `more:${string}` | `menuitem:${string}`

interface Labels { new: string; recent: string; placeholder: string; thinking: string }
interface Cps { user: number; say: number }
export interface ClaudeProps {
  title?: string
  folder?: string
  /** null 不顯示 */
  branch?: string | null
  model?: string
  mode?: Mode
  sessions?: string[]
  /** 介面語言(lang/ 底下的檔名),預設 zh-TW */
  lang?: string
  labels?: Partial<Labels>
  cps?: Partial<Cps>
  dark?: boolean
  noframe?: boolean
}
interface Conf {
  title: string
  folder: string
  branch: string | null
  model: string
  mode: Mode
  sessions: string[]
  ui: ClaudeUi
  labels: Labels
  cps: Cps
  dark: boolean
  noframe: boolean
}

// ---------- 文字處理 ----------

const esc = kit.esc
const inline = (s: unknown): string => esc(s).replace(/`([^`]+)`/g, '<span class="code">$1</span>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
const paras = (s: unknown): string =>
  String(s)
    .split(/\n{2,}/)
    .map((p) => `<p>${inline(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
// 逐字顯示時不要把 `程式碼` 或 **粗體** 切在中間:先切字再補上缺的結尾記號
const cut = (s: string, n: number): string => {
  let out = [...s].slice(0, n).join('')
  if ((out.match(/`/g) || []).length % 2) out += '`'
  if ((out.match(/\*\*/g) || []).length % 2) out += '**'
  return out
}
const len = (x: unknown): number => [...String(x || '')].length

const DEFAULTS: Omit<Conf, 'ui' | 'labels' | 'title'> = {
  folder: '~/projects/demo',
  branch: 'main',
  model: 'Opus 5.5',
  mode: 'auto',
  sessions: [],
  cps: { user: 14, say: 45 },
  dark: false,
  noframe: false,
}
const MODES: Record<Mode, string> = { auto: 'Auto', ask: 'Ask permissions', plan: 'Plan mode', accept: 'Accept edits' }
const ICONS: Record<string, string> = { Read: '▤', Write: '✎', Edit: '✎', Bash: '›_', Grep: '⌕', Glob: '⌕', WebFetch: '◎', WebSearch: '◎' }
const askOptions = (s: StepOf<'ask'>, ui: ClaudeUi): string[] => s.options || ui.askOptions
const conf = (props: ClaudeProps): Conf => {
  const ui = uiOf(props.lang)
  return {
    ...DEFAULTS,
    title: ui.title,
    ...props,
    ui,
    branch: props.branch === undefined ? DEFAULTS.branch : props.branch,
    sessions: props.sessions ?? DEFAULTS.sessions,
    labels: { ...ui.labels, ...(props.labels || {}) },
    cps: { ...DEFAULTS.cps, ...(props.cps || {}) },
  }
}

// 選擇確認提示的時間表:先依序停在 hover 的選項(每個停 700ms),最後移到要選的選項按下
interface ChoosePlan {
  moves: { idx: number; at: number; arrive: number; target: `option:${number}` }[]
  clickAt: number
  dur: number
}
function choosePlan(s: StepOf<'choose'>): ChoosePlan {
  const targets = [...(s.hover || []), s.choose]
  const moves: ChoosePlan['moves'] = []
  let t = 300
  targets.forEach((idx, i) => {
    moves.push({ idx, at: t, arrive: t + 550, target: `option:${idx}` })
    t += 550 + (i === targets.length - 1 ? 250 : 700)
  })
  return { moves, clickAt: t, dur: t + 650 }
}

// 點側欄、選單的時間表:滑鼠移過去、停一下、按下,commit 時畫面才真的改變
const CLICK = { at: 300, arrive: 850, clickAt: 1050, commit: 1200, dur: 1500 }
const clickTarget = (kind: ClaudeKind, step: ClaudeStep): string | null => {
  switch (kind) {
    case 'newSession': return 'new'
    case 'session': return `session:${(step as StepOf<'session'>).session}`
    case 'menu': return `more:${(step as StepOf<'menu'>).menu}`
    case 'fork': return 'menuitem:Fork'
    default: return null
  }
}

// 側欄 ⋯ 選單的項目:[名稱, 右側提示];null 是分隔線
const MENU_ITEMS: ([label: string, hint: string] | null)[] = [
  ['Open in', '›'], ['Pin', 'P'], ['Mark as unread', 'U'], ['Rename', 'R'], ['Fork', 'F'], null,
  ['Move to section', '›'], null, ['Archive', 'A'], ['Delete', 'D'],
]

/** 載入時檢查 session 操作對不對得上(畫面仍由 render 重播 events 決定) */
interface Check {
  names: string[]
  menu: string | null
  active: string
  /** 等待選擇的確認提示有哪些選項 */
  asking: string[] | null
  /** 介面文字(互動熱點的標籤用) */
  ui: ClaudeUi
}

/** 一個確認提示在這一格的樣子 */
interface AskState {
  s: StepOf<'ask'>
  idx: number
  chosen: number | null
  hover: number
  press: boolean
  resolved: boolean
}

/** 一個 session 在這一格的內容 */
interface SessionLog {
  title: string
  parent: string | null
  branch: string | null
  mode: Mode
  state: SessionState
  blocks: (string | null)[]
  asks: AskState[]
  todos: StepOf<'todos'>['todos'] | null
  todosAt: number
  typed: string
  typing: boolean
  status: string
}
const emptyLog = (title: string, branch: string | null, mode: Mode, parent: string | null = null): SessionLog => ({
  title, parent, branch, mode, state: 'idle', blocks: [], asks: [], todos: null, todosAt: -1, typed: '', typing: false, status: '',
})

const actor = defineActor<ClaudeKind, ClaudeStep, ClaudeProps, Check, ClaudeTarget>({
  name: 'claude-desktop',
  kinds: KINDS,
  collapsible: { sidebar: 900, composer: 900, titlebar: 480, head: 480 },
  parts: {
    titlebar: '.cd-titlebar',
    tabs: '.cd-tabs',
    sidebar: '.cd-sidebar',
    newSession: '.cd-new',
    sessions: '.cd-sessions, .side-label',
    account: '.cd-me',
    head: '.cd-head',
    meta: '.cd-sessMeta',
    composer: '.cd-composer',
    folder: '.cd-folder',
    branch: '.cd-branch',
    mode: '.cd-mode',
    model: '.cd-model',
  },

  init(props) {
    const c = conf(props)
    return { names: [c.title, ...c.sessions], menu: null, active: c.title, asking: null, ui: c.ui }
  },

  apply(st, kind, step) {
    const need = (name: string): void => {
      if (!st.names.includes(name)) throw new Error(`沒有叫「${name}」的 session(目前有:${st.names.join('、')})`)
    }
    const fresh = (name: string): void => {
      if (st.names.includes(name)) throw new Error(`已經有叫「${name}」的 session`)
    }
    if (step.in) {
      need(step.in)
      if (clickTarget(kind, step)) throw new Error(`${kind} 是滑鼠操作,不能加 "in"`)
    }
    if (st.menu && kind !== 'fork') throw new Error(`「${st.menu}」的選單還開著,下一步要接 fork`)
    switch (kind) {
      case 'newSession': {
        const name = (step as StepOf<'newSession'>).newSession
        fresh(name)
        return { ...st, names: [...st.names, name], active: name }
      }
      case 'session':
        need((step as StepOf<'session'>).session)
        return { ...st, active: (step as StepOf<'session'>).session }
      case 'menu': {
        const name = (step as StepOf<'menu'>).menu
        need(name)
        return { ...st, menu: name }
      }
      case 'fork': {
        const name = (step as StepOf<'fork'>).fork
        if (!st.menu) throw new Error('fork 之前要先用 menu 打開選單')
        fresh(name)
        return { ...st, names: [...st.names, name], menu: null, active: name }
      }
      case 'ask':
        return (step as StepOf<'ask'>).select == null ? { ...st, asking: askOptions(step as StepOf<'ask'>, st.ui) } : st
      case 'choose':
        return { ...st, asking: null }
      default:
        return st
    }
  },

  hotspots(st) {
    const unique = (base: string): string => {
      let name = base
      for (let i = 2; st.names.includes(name); i++) name = `${base} ${i}`
      return name
    }
    // 選單開著時只有 Fork 接得上下一步
    if (st.menu) return [{ target: 'menuitem:Fork', label: 'Fork', step: { fork: unique(`${st.menu} (fork)`) } }]
    const spots: Hotspot<ClaudeStep>[] = [
      { target: 'new', label: st.ui.labels.new, step: { newSession: unique(st.ui.title) } },
      ...st.names.filter((n) => n !== st.active).map((n) => ({ target: `session:${n}`, label: fill(st.ui.switchTo, { name: n }), step: { session: n } })),
      ...st.names.map((n) => ({ target: `more:${n}`, label: fill(st.ui.menuOf, { name: n }), step: { menu: n }, glyph: '⋯' })),
    ]
    if (st.asking) return [...spots, ...st.asking.map((o, i) => ({ target: `option:${i}`, label: o, step: { choose: i } }))]
    return [...spots, { target: 'composer', label: st.ui.input, input: { placeholder: st.ui.labels.placeholder, step: (text: string) => ({ user: text }) } }]
  },

  duration(kind, step, props) {
    if (step.in) return 1
    if (clickTarget(kind, step)) return CLICK.dur
    const c = conf(props)
    switch (kind) {
      case 'state': return 1
      case 'user': return (len((step as StepOf<'user'>).user) / c.cps.user) * 1000 + 450
      case 'thinking': return 1500
      case 'say': return Math.max(300, (len((step as StepOf<'say'>).say) / c.cps.say) * 1000)
      case 'tool': return (step as StepOf<'tool'>).tool === 'Bash' ? 1400 : 700
      case 'edit': return 300 + (step as StepOf<'edit'>).lines.length * 110
      case 'todos': return 350
      case 'ask': return (step as StepOf<'ask'>).select == null ? 900 : 2400
      case 'choose': return choosePlan(step as StepOf<'choose'>).dur
      case 'mode': return 300
      default: return 1
    }
  },

  // 自動鏡頭:打字看輸入框、思考中看最新內容(思考狀態跟在最新文字下方)、確認提示看提示。
  // 回覆、工具、修改、待辦、choose、mode 沿用上一個鏡頭;不用整個對話區(log):範圍太大會拉回全景,輸入後又推近確認框,來回推拉
  autoFocus(kind, step) {
    if (step.in) return undefined
    if (kind === 'user') return 'composer'
    if (kind === 'thinking') return 'latest'
    if (kind === 'ask') return 'ask'
    return undefined
  },

  // 需要虛擬滑鼠的動作:回傳移動的時間表(時間相對於這個動作開始)
  cursor(kind, step): CursorPlan | null {
    const click = clickTarget(kind, step)
    if (click) return { moves: [{ at: CLICK.at, target: click }], clickAt: CLICK.clickAt }
    if (kind !== 'choose') return null
    const plan = choosePlan(step as StepOf<'choose'>)
    return { moves: plan.moves.map((m) => ({ at: m.at, target: m.target })), clickAt: plan.clickAt }
  },

  mount(root, props) {
    const c = conf(props)
    root.classList.add('A-claude-desktop')
    if (c.dark) root.classList.add('dark')
    if (c.noframe) root.classList.add('noframe')
    root.innerHTML = `
        <div class="cd-window">
          <div class="cd-titlebar">
            <span class="light red"></span><span class="light yellow"></span><span class="light green"></span>
            <div class="cd-tabs"><span>Chat</span><span>Cowork</span><span class="on">Code</span></div>
          </div>
          <div class="cd-body">
            <aside class="cd-sidebar">
              <div class="newbtn cd-new"><span class="plus">+</span><span>${esc(c.labels.new)}</span></div>
              <div class="side-label">${esc(c.labels.recent)}</div>
              <div class="cd-sessions"></div>
              <div class="cd-me"><span class="avatar">${LOGO}</span><span>evoleap</span></div>
            </aside>
            <main class="cd-main">
              <header class="cd-head">
                <div class="cd-sessTitle"></div>
                <div class="cd-sessMeta"></div>
              </header>
              <div class="cd-scroll"><div class="cd-log"><div class="cd-blocks"></div><div class="cd-status"></div><div class="cd-tail"></div></div></div>
              <div class="cd-composer">
                <div class="cd-input"><span class="cd-typed"></span><span class="cd-caret off"></span><span class="cd-placeholder"></span></div>
                <div class="cd-bar">
                  <span class="chip cd-folder">▣ ${esc(c.folder.split('/').pop())}</span>
                  <span class="chip cd-branch"${c.branch ? '' : ' hidden'}>⑂ ${esc(c.branch || '')}</span>
                  <span class="grow"></span>
                  <span class="chip cd-mode"></span>
                  <span class="chip cd-model">${esc(c.model)}</span>
                  <span class="cd-send">↑</span>
                </div>
              </div>
            </main>
          </div>
        </div>`
    const $ = (sel: string): HTMLElement => root.querySelector<HTMLElement>(sel)!
    const el = {
      log: $('.cd-log'),
      blocks: $('.cd-blocks'),
      tail: $('.cd-tail'),
      scroll: $('.cd-scroll'),
      status: $('.cd-status'),
      typed: $('.cd-typed'),
      caret: $('.cd-caret'),
      placeholder: $('.cd-placeholder'),
      send: $('.cd-send'),
      mode: $('.cd-mode'),
      sessions: $('.cd-sessions'),
      newBtn: $('.cd-new'),
      title: $('.cd-sessTitle'),
      meta: $('.cd-sessMeta'),
      branch: $('.cd-branch'),
    }

    // ---------- 各種區塊 ----------
    const userHtml = (text: string): string => `<div class="user">${inline(text).replace(/\n/g, '<br>')}</div>`
    const sayHtml = (text: string, streaming: boolean): string =>
      `<div class="say">${paras(text).replace(/<\/p>$/, streaming ? '<span class="stream"></span></p>' : '</p>')}</div>`
    function toolHtml(s: StepOf<'tool'>, p: number, ms: number): string {
      const done = p >= 1
      const state = done
        ? `<span class="state ok">${esc(s.result || c.ui.done)}</span>`
        : `<span class="state"><span class="spin" style="--r:${kit.spin(ms, 100).toFixed(1)}deg"></span></span>`
      const out = done && s.out ? `<div class="out">${esc(s.out)}</div>` : ''
      return `<div class="tool"><div class="row"><span class="icon">${esc(ICONS[s.tool] || '•')}</span><span class="verb">${esc(c.ui.tools[s.tool] || s.tool)}</span><span class="arg">${esc(s.arg || '')}</span>${state}</div>${out}</div>`
    }
    function editHtml(s: StepOf<'edit'>, p: number): string {
      const shown = Math.ceil(kit.clamp(p * 1.15) * s.lines.length)
      const plus = s.lines.filter((l) => l[1] === '+').length
      const minus = s.lines.filter((l) => l[1] === '-').length
      const rows = s.lines
        .slice(0, shown)
        .map(([no, sg, text]) => {
          const cls = sg === '+' ? 'add' : sg === '-' ? 'del' : ''
          return `<div class="ln ${cls}"><span class="no">${no ?? ''}</span><span class="sg">${sg === ' ' ? '' : esc(sg)}</span><span>${esc(text)}</span></div>`
        })
        .join('')
      return `<div class="card edit"><div class="card-head"><span class="icon">✎</span><span class="file">${esc(s.edit)}</span>${plus ? `<span class="plus-n">+${plus}</span>` : ''}${minus ? `<span class="minus-n">−${minus}</span>` : ''}</div><div class="diff">${rows}</div></div>`
    }
    const todosHtml = (items: StepOf<'todos'>['todos']): string =>
      `<div class="card todos-card"><div class="card-head"><span>${esc(c.ui.todos)}</span></div><div class="todos">${items.map(([text, st]) => `<div class="todo ${st}"><span class="box">${st === 'done' ? '✓' : ''}</span><span class="txt">${esc(text)}</span></div>`).join('')}</div></div>`
    function askHtml(s: StepOf<'ask'>, st: AskState): string {
      const options = askOptions(s, c.ui)
      if (st.resolved) {
        const chosen = st.chosen ?? 0
        // 選第 0 個,或選項文字含有這個語言的「拒絕」(例如自訂的「拒絕，先不要」)就是拒絕
        const deny = chosen === 0 || options[chosen].includes(c.ui.askOptions[0])
        return `<div class="resolved${deny ? ' deny' : ''}">${deny ? '✕' : '✓'} ${esc(fill(c.ui.resolved, { option: options[chosen] }))}<span class="code">${esc(s.ask)}</span></div>`
      }
      const opts = options
        .map((o, i) => {
          const cls = i === st.chosen ? ' sel' + (st.press ? ' press' : '') : i === st.hover ? ' hov' : ''
          return `<span class="opt${cls}" data-opt="${i}">${esc(o)}</span>`
        })
        .join('')
      return `<div class="card ask pending"><div class="q">${esc(s.q || c.ui.askQuestion)}</div>${s.where ? `<div class="where">▣ ${esc(s.where)}</div>` : ''}<div class="cmd">${esc(s.ask)}</div>${s.preview ? `<div class="preview">${esc(s.preview)}</div>` : ''}${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}<div class="opts">${opts}</div></div>`
    }

    function menuHtml(hoverItem: string): string {
      const rows = MENU_ITEMS.map((it) => {
        if (!it) return '<div class="sep"></div>'
        const [label, hint] = it
        const cls = `item${label === 'Delete' ? ' danger' : ''}${label === hoverItem ? ' hov' : ''}`
        return `<div class="${cls}" data-item="${esc(label)}"><span>${esc(label)}</span><span class="hint">${esc(hint)}</span></div>`
      })
      return `<div class="cd-menu">${rows.join('')}</div>`
    }

    let lastLog = ''
    return {
      render(frame, ms) {
        const events = frame.events as Ev[]
        const logs: SessionLog[] = [c.title, ...c.sessions].map((n) => emptyLog(n, c.branch, c.mode))
        const logOf = (name: string): SessionLog => logs.find((l) => l.title === name) as SessionLog
        let active = logs[0]
        let hoverRow = ''
        let hoverNew = false
        let menuOf = ''
        let menuHover = ''
        const star = `<span class="star" style="--r:${(ms * 0.25) % 360}deg">✻</span>`
        for (const ev of events) {
          const { kind, p, local } = ev
          const log = ev.step.in ? logOf(ev.step.in) : active
          const { blocks, asks } = log
          switch (kind) {
            case 'user': {
              const s = ev.step as StepOf<'user'>
              const chars = [...s.user]
              const n = Math.floor(kit.clamp(local / (ev.dur - 450)) * chars.length)
              if (p < 1) {
                log.typed = chars.slice(0, n).join('')
                log.typing = true
              } else {
                blocks.push(userHtml(s.user))
                log.state = 'run'
              }
              break
            }
            case 'thinking': {
              const s = ev.step as StepOf<'thinking'>
              if (p < 1) {
                const secs = Math.floor(local / 1000)
                log.status = `${star}<span>${esc(s.thinking === true ? c.labels.thinking : s.thinking)}…</span><span>${secs ? `${secs}s` : ''}</span>`
              }
              break
            }
            case 'say': {
              const s = ev.step as StepOf<'say'>
              blocks.push(sayHtml(cut(s.say, Math.ceil(p * len(s.say))), p < 1))
              break
            }
            case 'tool':
              blocks.push(toolHtml(ev.step as StepOf<'tool'>, p, ms))
              if (p < 1) log.status = `${star}<span>${esc(c.labels.thinking)}…</span>`
              break
            case 'edit':
              blocks.push(editHtml(ev.step as StepOf<'edit'>, p))
              if (p < 1) log.status = `${star}<span>${esc(c.labels.thinking)}…</span>`
              break
            case 'todos':
              // 同一份待辦清單會更新而不是重複出現:畫在第一次出現的位置,內容用最新的
              log.todos = (ev.step as StepOf<'todos'>).todos
              if (log.todosAt < 0) {
                log.todosAt = blocks.length
                blocks.push(null)
              }
              break
            case 'ask': {
              const s = ev.step as StepOf<'ask'>
              const st: AskState = { s, idx: blocks.length, chosen: null, hover: -1, press: false, resolved: false }
              if (s.select != null) {
                // 同一步裡自己選:前 55% 還沒選,接著選到要選的選項,最後 12% 是按下去的樣子
                if (p >= 1) {
                  st.resolved = true
                  st.chosen = s.select
                } else if (p >= 0.55) {
                  st.chosen = s.select
                  st.press = p > 0.88
                }
              }
              asks.push(st)
              blocks.push(null)
              break
            }
            case 'choose': {
              const s = ev.step as StepOf<'choose'>
              const a = asks.filter((x) => !x.resolved).at(-1)
              if (!a) break
              const plan = choosePlan(s)
              if (local >= plan.dur) {
                a.resolved = true
                a.chosen = s.choose
                break
              }
              const at = plan.moves.filter((m) => local >= m.arrive).at(-1)
              if (local >= plan.clickAt) {
                a.chosen = s.choose
                a.press = local < plan.clickAt + 220
              } else if (at) a.hover = at.idx
              break
            }
            case 'mode':
              log.mode = (ev.step as StepOf<'mode'>).mode
              break
            case 'state':
              log.state = (ev.step as StepOf<'state'>).state
              break
            case 'newSession': {
              const s = ev.step as StepOf<'newSession'>
              if (local < CLICK.commit) hoverNew = local >= CLICK.arrive
              else {
                active = emptyLog(s.newSession, s.branch === undefined ? c.branch : s.branch, c.mode)
                logs.unshift(active)
              }
              break
            }
            case 'session': {
              const s = ev.step as StepOf<'session'>
              if (local < CLICK.commit) hoverRow = local >= CLICK.arrive ? s.session : ''
              else active = logOf(s.session)
              break
            }
            case 'menu': {
              const s = ev.step as StepOf<'menu'>
              if (local >= CLICK.arrive && local < CLICK.clickAt) hoverRow = s.menu
              if (local >= CLICK.clickAt) menuOf = s.menu
              break
            }
            case 'fork': {
              const s = ev.step as StepOf<'fork'>
              if (local < CLICK.commit) {
                menuHover = local >= CLICK.arrive ? 'Fork' : ''
                break
              }
              // 帶著對話開新的 session:複製到這裡為止的內容,排在原本的 session 底下
              const from = logOf(menuOf)
              const child: SessionLog = {
                ...emptyLog(s.fork, s.branch === undefined ? from.branch : s.branch, from.mode, from.title),
                blocks: [...from.blocks, `<div class="forked">⑂ ${esc(fill(c.ui.forked, { title: from.title }))}</div>`],
                asks: from.asks.map((a) => ({ ...a })),
                todos: from.todos,
                todosAt: from.todosAt,
              }
              let at = logs.indexOf(from) + 1
              while (logs[at]?.parent === from.title) at++
              logs.splice(at, 0, child)
              active = child
              menuOf = ''
              menuHover = ''
              break
            }
          }
        }
        const { blocks, typed, typing, status, mode } = active
        for (const l of logs) {
          if (l.todosAt >= 0 && l.todos) l.blocks[l.todosAt] = todosHtml(l.todos)
          for (const a of l.asks) l.blocks[a.idx] = askHtml(a.s, a)
        }

        const html = blocks.join('')
        if (html !== lastLog) {
          el.blocks.innerHTML = html
          lastLog = html
        }
        kit.setIf(el.status, 'html', status)
        kit.setIf(el.typed, 'text', typed)
        kit.setIf(el.placeholder, 'text', typed ? '' : c.labels.placeholder)
        el.caret.className = `cd-caret${typing && kit.blink(ms) ? '' : ' off'}`
        el.send.className = `cd-send${typed ? ' on' : ''}`
        kit.setIf(el.mode, 'text', MODES[mode] || mode)
        el.mode.className = `chip cd-mode ${mode}`
        // 對話貼齊底部(像真的捲到最新)
        el.log.style.top = `${kit.stickBottom(el.scroll.clientHeight, el.log.scrollHeight)}px`
        // 最新內容帶:貼在對話內容的底部(內容不夠高就從頂端算起)
        el.tail.style.top = `${Math.max(0, el.log.scrollHeight - el.tail.offsetHeight)}px`

        kit.setIf(el.title, 'text', active.title)
        kit.setIf(el.meta, 'text', active.branch ? `${c.folder} · ${active.branch}` : c.folder)
        kit.setIf(el.branch, 'text', `⑂ ${active.branch || ''}`)
        el.branch.hidden = !active.branch
        el.newBtn.classList.toggle('hov', hoverNew)

        // 只有一個 session 的腳本:燈號照舊,跟著最後一個動作;有多個 session 時每個 session 自己記狀態
        const multi = events.some((e) => e.step.in || e.kind === 'state' || clickTarget(e.kind, e.step))
        const last = events.at(-1)
        const busy = last && ms < last.start + last.dur
        const single = !events.length ? '' : busy ? 'run' : 'ok'
        const pulse = (0.65 + 0.35 * Math.sin(ms / 260)).toFixed(2)
        kit.setIf(
          el.sessions,
          'html',
          logs
            .map((l, i) => {
              const dot = multi ? (l.state === 'idle' ? '' : l.state) : i === 0 ? single : ''
              const cls = `sess${l === active ? ' on' : ''}${l.title === hoverRow || l.title === menuOf ? ' hov' : ''}`
              const style = dot === 'run' && multi ? ` style="opacity:${pulse}"` : ''
              return `<div class="sess-row${l.parent ? ' nested' : ''}"><div class="${cls}" data-sess="${esc(l.title)}"><span class="dot ${dot}"${style}></span><span class="name">${esc(l.title)}</span><span class="more">⋯</span></div>${l.title === menuOf ? menuHtml(menuHover) : ''}</div>`
            })
            .join(''),
        )
      },

      target(name) {
        const lastOf = (sel: string): HTMLElement | null => [...root.querySelectorAll<HTMLElement>(sel)].at(-1) || null
        const opt = /^option:(\d+)$/.exec(name)
        if (opt) return lastOf('.cd-log .ask.pending')?.querySelector<HTMLElement>(`[data-opt="${opt[1]}"]`) || null
        const sess = /^(session|more):(.+)$/.exec(name)
        if (sess) {
          const row = [...root.querySelectorAll<HTMLElement>('[data-sess]')].find((x) => x.dataset.sess === sess[2])
          return sess[1] === 'more' ? row?.querySelector<HTMLElement>('.more') || null : row || null
        }
        const item = /^menuitem:(.+)$/.exec(name)
        if (item) return [...root.querySelectorAll<HTMLElement>('.cd-menu [data-item]')].find((x) => x.dataset.item === item[1]) || null
        switch (name as ClaudeTarget) {
          case 'new': return el.newBtn
          case 'sessions': return el.sessions
          case 'menu': return root.querySelector<HTMLElement>('.cd-menu')
          case 'composer': return $('.cd-composer')
          case 'input': return $('.cd-input')
          case 'send': return $('.cd-send')
          case 'mode': return $('.cd-mode')
          case 'model': return $('.cd-model')
          case 'head': return $('.cd-head')
          case 'sidebar': return $('.cd-sidebar')
          case 'log': return $('.cd-scroll')
          // 最新內容:對話最底下那一帶(最後一個區塊和思考狀態都在裡面)。範圍固定、水平置中,
          // 不會因為思考狀態消失或最後一則是靠右的訊息,鏡頭就左右跳動
          case 'latest': return $('.cd-tail')
          case 'ask': return lastOf('.cd-log .ask, .cd-log .resolved')
          case 'user': return lastOf('.cd-log .user')
          case 'say': return lastOf('.cd-log .say')
          case 'tool': return lastOf('.cd-log .tool')
          case 'edit': return lastOf('.cd-log .edit')
          case 'todos': return lastOf('.cd-log .todos-card')
        }
        return null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入:舞台、外殼、演員是掛上去就一直在跑的物件,不是 React 元件,
// 交給 LivePlayer 熱更新的話它的 effect 不會重跑,畫面仍是舊程式建出來的舊物件,看起來像沒有熱重載。
// 必須直接寫 import.meta.hot.accept(Vite 靠這段文字判斷模組會自己處理更新,包成函式它就認不得)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
