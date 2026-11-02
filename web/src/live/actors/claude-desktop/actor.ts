// 演員 claude-desktop:仿 Claude 桌面版(Code 分頁)。規格見 ../../README.md「演員」。
//
// 演員只負責「自己長什麼樣、每個動作畫成什麼樣子」;章節卡、聚光燈、鏡頭、滑鼠、旁白時間由舞台處理。
//
// props(登場設定,寫在腳本 cast 裡):
//   title、folder、branch(null 不顯示)、model、mode(auto|ask|plan|accept)、user(頭像字母)、
//   sessions(側欄其他項目)、labels(介面文字)、cps({ user, say } 打字/回覆速度)、dark、noframe
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
//
// 目標(給鏡頭、聚光燈、滑鼠用,腳本裡寫成「演員代號:目標」,例如 claude:ask):
//   composer、input、send、mode、model、head、sidebar、log、latest(對話最底下那一帶)、ask(最後一個確認提示)、
//   option:N(待選提示的第 N 個選項)、user(最後一則使用者訊息)、say、tool、edit、todos
import { kit } from '../../kit'
import { defineActor, type ActorEvent, type CommonStepFields, type CursorPlan } from '../../types'
import './actor.css'

// ---------- 型別 ----------

type Mode = 'auto' | 'ask' | 'plan' | 'accept'
type TodoState = 'pending' | 'doing' | 'done'
type DiffLine = [no: number | null, sign: '+' | '-' | ' ', text: string]

/** 腳本 steps 裡的動作(鍵名就是動作種類) */
export type ClaudeStep = CommonStepFields &
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
  )
type ClaudeKind = 'user' | 'thinking' | 'say' | 'tool' | 'edit' | 'todos' | 'ask' | 'choose' | 'mode'
const KINDS: readonly ClaudeKind[] = ['user', 'thinking', 'say', 'tool', 'edit', 'todos', 'ask', 'choose', 'mode']
type StepOf<K extends ClaudeKind> = Extract<ClaudeStep, Record<K, unknown>>
type Ev<K extends ClaudeKind = ClaudeKind> = ActorEvent<ClaudeStep, K>

/** 目標名稱(給鏡頭、聚光燈、滑鼠用) */
export type ClaudeTarget =
  | 'composer' | 'input' | 'send' | 'mode' | 'model' | 'head' | 'sidebar' | 'log' | 'latest'
  | 'ask' | 'user' | 'say' | 'tool' | 'edit' | 'todos'
  | `option:${number}`

interface Labels { new: string; recent: string; placeholder: string; thinking: string }
interface Cps { user: number; say: number }
export interface ClaudeProps {
  title?: string
  folder?: string
  /** null 不顯示 */
  branch?: string | null
  model?: string
  mode?: Mode
  /** 頭像字母 */
  user?: string
  sessions?: string[]
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
  user: string
  sessions: string[]
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

const DEFAULTS: Conf = {
  title: '新的 session',
  folder: '~/projects/demo',
  branch: 'main',
  model: 'Opus 5.5',
  mode: 'auto',
  user: 'T',
  sessions: [],
  labels: { new: '新增 session', recent: '最近', placeholder: '描述你要做的事…', thinking: '思考中' },
  cps: { user: 14, say: 45 },
  dark: false,
  noframe: false,
}
const MODES: Record<Mode, string> = { auto: 'Auto', ask: 'Ask permissions', plan: 'Plan mode', accept: 'Accept edits' }
const ICONS: Record<string, string> = { Read: '▤', Write: '✎', Edit: '✎', Bash: '›_', Grep: '⌕', Glob: '⌕', WebFetch: '◎', WebSearch: '◎' }
const TOOL_VERB: Record<string, string> = {
  Read: '讀取',
  Write: '寫入',
  Edit: '修改',
  Bash: '執行',
  Grep: '搜尋',
  Glob: '找檔案',
  WebFetch: '讀取網頁',
  WebSearch: '搜尋網路',
}
const askOptions = (s: StepOf<'ask'>): string[] => s.options || ['拒絕', '允許一次', '一律允許']
const conf = (props: ClaudeProps): Conf => ({
  ...DEFAULTS,
  ...props,
  branch: props.branch === undefined ? DEFAULTS.branch : props.branch,
  sessions: props.sessions ?? DEFAULTS.sessions,
  labels: { ...DEFAULTS.labels, ...(props.labels || {}) },
  cps: { ...DEFAULTS.cps, ...(props.cps || {}) },
})

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

/** 一個確認提示在這一格的樣子 */
interface AskState {
  s: StepOf<'ask'>
  idx: number
  chosen: number | null
  hover: number
  press: boolean
  resolved: boolean
}

const actor = defineActor<ClaudeKind, ClaudeStep, ClaudeProps, undefined, ClaudeTarget>({
  name: 'claude-desktop',
  kinds: KINDS,

  duration(kind, step, props) {
    const c = conf(props)
    switch (kind) {
      case 'user': return (len((step as StepOf<'user'>).user) / c.cps.user) * 1000 + 450
      case 'thinking': return 1500
      case 'say': return Math.max(300, (len((step as StepOf<'say'>).say) / c.cps.say) * 1000)
      case 'tool': return (step as StepOf<'tool'>).tool === 'Bash' ? 1400 : 700
      case 'edit': return 300 + (step as StepOf<'edit'>).lines.length * 110
      case 'todos': return 350
      case 'ask': return (step as StepOf<'ask'>).select == null ? 900 : 2400
      case 'choose': return choosePlan(step as StepOf<'choose'>).dur
      case 'mode': return 300
    }
  },

  // 自動鏡頭:打字看輸入框、思考中看最新內容(思考狀態跟在最新文字下方)、確認提示看提示。
  // 回覆、工具、修改、待辦、choose、mode 沿用上一個鏡頭;不用整個對話區(log):範圍太大會拉回全景,輸入後又推近確認框,來回推拉
  autoFocus(kind) {
    if (kind === 'user') return 'composer'
    if (kind === 'thinking') return 'latest'
    if (kind === 'ask') return 'ask'
    return undefined
  },

  // 需要虛擬滑鼠的動作:回傳移動的時間表(時間相對於這個動作開始)
  cursor(kind, step): CursorPlan | null {
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
              <div class="newbtn"><span class="plus">+</span><span>${esc(c.labels.new)}</span></div>
              <div class="side-label">${esc(c.labels.recent)}</div>
              <div class="cd-sessions"></div>
              <div class="cd-me"><span class="avatar">${esc(c.user)}</span><span>Max</span></div>
            </aside>
            <main class="cd-main">
              <header class="cd-head">
                <div class="cd-sessTitle">${esc(c.title)}</div>
                <div class="cd-sessMeta">${esc(c.branch ? `${c.folder} · ${c.branch}` : c.folder)}</div>
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
    }

    // ---------- 各種區塊 ----------
    const userHtml = (text: string): string => `<div class="user">${inline(text).replace(/\n/g, '<br>')}</div>`
    const sayHtml = (text: string, streaming: boolean): string =>
      `<div class="say">${paras(text).replace(/<\/p>$/, streaming ? '<span class="stream"></span></p>' : '</p>')}</div>`
    function toolHtml(s: StepOf<'tool'>, p: number, ms: number): string {
      const done = p >= 1
      const state = done
        ? `<span class="state ok">${esc(s.result || '完成')}</span>`
        : `<span class="state"><span class="spin" style="--r:${kit.spin(ms, 100).toFixed(1)}deg"></span></span>`
      const out = done && s.out ? `<div class="out">${esc(s.out)}</div>` : ''
      return `<div class="tool"><div class="row"><span class="icon">${esc(ICONS[s.tool] || '•')}</span><span class="verb">${esc(TOOL_VERB[s.tool] || s.tool)}</span><span class="arg">${esc(s.arg || '')}</span>${state}</div>${out}</div>`
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
      `<div class="card todos-card"><div class="card-head"><span>待辦清單</span></div><div class="todos">${items.map(([text, st]) => `<div class="todo ${st}"><span class="box">${st === 'done' ? '✓' : ''}</span><span class="txt">${esc(text)}</span></div>`).join('')}</div></div>`
    function askHtml(s: StepOf<'ask'>, st: AskState): string {
      const options = askOptions(s)
      if (st.resolved) {
        const chosen = st.chosen ?? 0
        const deny = chosen === 0 || /拒絕/.test(options[chosen])
        return `<div class="resolved${deny ? ' deny' : ''}">${deny ? '✕' : '✓'} 已${esc(options[chosen])}：<span class="code">${esc(s.ask)}</span></div>`
      }
      const opts = options
        .map((o, i) => {
          const cls = i === st.chosen ? ' sel' + (st.press ? ' press' : '') : i === st.hover ? ' hov' : ''
          return `<span class="opt${cls}" data-opt="${i}">${esc(o)}</span>`
        })
        .join('')
      return `<div class="card ask pending"><div class="q">${esc(s.q || '允許 Claude 執行這個指令?')}</div>${s.where ? `<div class="where">▣ ${esc(s.where)}</div>` : ''}<div class="cmd">${esc(s.ask)}</div>${s.preview ? `<div class="preview">${esc(s.preview)}</div>` : ''}${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}<div class="opts">${opts}</div></div>`
    }

    let lastLog = ''
    return {
      render(frame, ms) {
        const events = frame.events as Ev[]
        const blocks: (string | null)[] = []
        let typed = ''
        let typing = false
        let status = ''
        let mode: Mode = c.mode
        let todos: StepOf<'todos'>['todos'] | null = null
        let todosAt = -1
        const asks: AskState[] = []
        const star = `<span class="star" style="--r:${(ms * 0.25) % 360}deg">✻</span>`
        for (const ev of events) {
          const { kind, p, local } = ev
          switch (kind) {
            case 'user': {
              const s = ev.step as StepOf<'user'>
              const chars = [...s.user]
              const n = Math.floor(kit.clamp(local / (ev.dur - 450)) * chars.length)
              if (p < 1) {
                typed = chars.slice(0, n).join('')
                typing = true
              } else blocks.push(userHtml(s.user))
              break
            }
            case 'thinking': {
              const s = ev.step as StepOf<'thinking'>
              if (p < 1) {
                const secs = Math.floor(local / 1000)
                status = `${star}<span>${esc(s.thinking === true ? c.labels.thinking : s.thinking)}…</span><span>${secs ? `${secs}s` : ''}</span>`
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
              if (p < 1) status = `${star}<span>${esc(c.labels.thinking)}…</span>`
              break
            case 'edit':
              blocks.push(editHtml(ev.step as StepOf<'edit'>, p))
              if (p < 1) status = `${star}<span>${esc(c.labels.thinking)}…</span>`
              break
            case 'todos':
              // 同一份待辦清單會更新而不是重複出現:畫在第一次出現的位置,內容用最新的
              todos = (ev.step as StepOf<'todos'>).todos
              if (todosAt < 0) {
                todosAt = blocks.length
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
              mode = (ev.step as StepOf<'mode'>).mode
              break
          }
        }
        if (todosAt >= 0 && todos) blocks[todosAt] = todosHtml(todos)
        for (const a of asks) blocks[a.idx] = askHtml(a.s, a)

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

        const last = events.at(-1)
        const busy = last && ms < last.start + last.dur
        const dot = !events.length ? '' : busy ? 'run' : 'ok'
        kit.setIf(
          el.sessions,
          'html',
          [`<div class="sess on"><span class="dot ${dot}"></span><span class="name">${esc(c.title)}</span></div>`]
            .concat(c.sessions.map((n) => `<div class="sess"><span class="dot"></span><span class="name">${esc(n)}</span></div>`))
            .join(''),
        )
      },

      target(name) {
        const lastOf = (sel: string): HTMLElement | null => [...root.querySelectorAll<HTMLElement>(sel)].at(-1) || null
        const opt = /^option:(\d+)$/.exec(name)
        if (opt) return lastOf('.cd-log .ask.pending')?.querySelector<HTMLElement>(`[data-opt="${opt[1]}"]`) || null
        switch (name as ClaudeTarget) {
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
