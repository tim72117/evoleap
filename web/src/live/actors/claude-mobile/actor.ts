// 演員 claude-mobile:仿 Claude 手機版(Code 分頁、遠端控制中的 session)。規格見 ../../README.md「演員」。
// 畫面是一支手機:上方狀態列、session 標題與連線的電腦、對話、底部輸入框。
//
// props(登場設定):
//   title     session 名稱(預設「Claude Code」)
//   device    這個 session 正在哪台電腦上跑(標題下方的連線提示,預設「辦公室電腦」)
//   dark      深色(預設 true,和桌面版演員一致)
//   time      狀態列的時間(預設 18:30)
//   labels    個別覆寫介面文字:allow(允許)、deny(拒絕)、placeholder、connected(已連線)、thinking
//   cps       打字/回覆速度({ user, say })
//
// 動作:
//   { "user": "再跑一次測試" }                       在輸入框打字後送出
//   { "thinking": true, "ms": 1200 }                 對話最底下的思考中狀態
//   { "say": "回覆,支援 `程式碼` 與 **粗體**" }       Claude 的回覆,逐字出現
//   { "tool": "Bash", "arg": "npm test", "result": "12 通過 · 1 失敗" }   一行工具活動
//   { "ask": "要允許我執行這個指令嗎？", "cmd": "npm run fix" }          跳出需要允許的操作,停住等 allow
//   { "allow": true }                                (觸控)手指點「允許」(false 是「拒絕」)
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window、header、device、ask(最後一個提示)、allow、deny、composer、latest、user、say、tool
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type MobileKind = 'user' | 'thinking' | 'say' | 'tool' | 'ask' | 'allow'
type MobileStep = CommonStepFields & {
  user?: string
  thinking?: true | string
  say?: string
  tool?: string
  arg?: string
  result?: string
  ask?: string
  cmd?: string
  allow?: boolean
}
const KINDS: readonly MobileKind[] = ['user', 'thinking', 'say', 'tool', 'ask', 'allow']

interface Labels { allow: string; deny: string; placeholder: string; connected: string; thinking: string }
interface Cps { user: number; say: number }
interface MobileProps {
  title?: string
  device?: string
  dark?: boolean
  time?: string
  labels?: Partial<Labels>
  cps?: Partial<Cps>
}
const LABELS: Labels = { allow: '允許', deny: '拒絕', placeholder: '回覆 Claude…', connected: '已連線', thinking: '思考中' }
const CPS: Cps = { user: 16, say: 40 }

type Block =
  | { t: 'user'; text: string }
  | { t: 'say'; text: string }
  | { t: 'tool'; name: string; arg: string; result: string }
  | { t: 'ask'; q: string; cmd: string; chosen: 'allow' | 'deny' | null }
interface MobileState { blocks: Block[] }
type MobileTarget = 'window' | 'header' | 'device' | 'ask' | 'allow' | 'deny' | 'composer' | 'latest' | 'user' | 'say' | 'tool'

/** 手指點下去的時間表:移過去、停一下、點下,commit 時畫面才真的改變 */
const TAP = { at: 250, arrive: 800, clickAt: 1000, commit: 1150, dur: 1500 }

const esc = kit.esc
const inline = (s: unknown): string => esc(s).replace(/`([^`]+)`/g, '<span class="code">$1</span>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
const cut = (s: string, n: number): string => {
  let out = [...s].slice(0, n).join('')
  if ((out.match(/`/g) || []).length % 2) out += '`'
  if ((out.match(/\*\*/g) || []).length % 2) out += '**'
  return out
}
const len = (x: unknown): number => [...String(x || '')].length

/** 最後一個還沒按的 ask 的位置(沒有就是 -1) */
const lastPending = (blocks: Block[]): number => {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (b.t === 'ask' && b.chosen === null) return i
  }
  return -1
}

const actor = defineActor<MobileKind, MobileStep, MobileProps, MobileState, MobileTarget>({
  name: 'claude-mobile',
  kinds: KINDS,
  parts: { status: '.cm-status', header: '.cm-head', composer: '.cm-composer' },

  init() {
    return { blocks: [] }
  },

  apply(st, kind, s) {
    const need = (v: unknown, name: string): void => {
      if (typeof v !== 'string' || !v) throw new Error(`${name} 要寫文字`)
    }
    switch (kind) {
      case 'user':
        need(s.user, 'user')
        return { blocks: [...st.blocks, { t: 'user', text: s.user! }] }
      case 'say':
        need(s.say, 'say')
        return { blocks: [...st.blocks, { t: 'say', text: s.say! }] }
      case 'tool':
        need(s.tool, 'tool')
        return { blocks: [...st.blocks, { t: 'tool', name: s.tool!, arg: s.arg ?? '', result: s.result ?? '' }] }
      case 'ask':
        need(s.ask, 'ask')
        need(s.cmd, 'ask 的 cmd')
        return { blocks: [...st.blocks, { t: 'ask', q: s.ask!, cmd: s.cmd!, chosen: null }] }
      case 'allow': {
        const i = lastPending(st.blocks)
        if (i < 0) throw new Error('allow 之前要先有 ask(沒有等待允許的操作)')
        const blocks = st.blocks.map((b, k) => (k === i && b.t === 'ask' ? { ...b, chosen: s.allow === false ? ('deny' as const) : ('allow' as const) } : b))
        return { blocks }
      }
      default:
        return st
    }
  },

  hotspots(st) {
    const pending = st.blocks.some((b) => b.t === 'ask' && b.chosen === null)
    if (pending) return [{ target: 'allow', label: LABELS.allow, step: { allow: true } }, { target: 'deny', label: LABELS.deny, step: { allow: false } }]
    return [{ target: 'composer', label: LABELS.placeholder, input: { placeholder: LABELS.placeholder, step: (text: string) => ({ user: text }) } }]
  },

  duration(kind, s, props) {
    const cps = { ...CPS, ...(props.cps || {}) }
    switch (kind) {
      case 'user': return (len(s.user) / cps.user) * 1000 + 500
      case 'thinking': return typeof s.ms === 'number' ? s.ms : 1200
      case 'say': return Math.max(400, (len(s.say) / cps.say) * 1000)
      case 'tool': return 900
      case 'ask': return 800
      case 'allow': return TAP.dur
      default: return 1
    }
  },

  autoFocus(kind) {
    if (kind === 'user') return 'composer'
    if (kind === 'ask' || kind === 'allow') return 'ask'
    return undefined
  },

  cursor(kind, s) {
    if (kind !== 'allow') return null
    return { moves: [{ at: TAP.at, target: s.allow === false ? 'deny' : 'allow' }], clickAt: TAP.clickAt }
  },

  mount(root, props) {
    const labels = { ...LABELS, ...(props.labels || {}) }
    const cps = { ...CPS, ...(props.cps || {}) }
    root.classList.add('A-claude-mobile')
    if (props.dark !== false) root.classList.add('dark')
    const SIGNAL = '<svg viewBox="0 0 18 12" width="1.5em" height="1em"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>'
    const WIFI = '<svg viewBox="0 0 16 12" width="1.4em" height="1em"><path d="M8 11.2 5.9 9a3 3 0 0 1 4.2 0L8 11.2zM3.4 6.5a6.4 6.4 0 0 1 9.2 0l-1.3 1.3a4.6 4.6 0 0 0-6.6 0L3.4 6.5zM.9 4A9.9 9.9 0 0 1 15.1 4l-1.3 1.3a8.1 8.1 0 0 0-11.6 0L.9 4z"/></svg>'
    const BATTERY = '<svg viewBox="0 0 27 12" width="2.2em" height="1em"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="19" height="8" rx="2.2"/><path d="M24 4v4c.9-.3 1.5-1.2 1.5-2S24.900 4.300 24 4z" opacity=".5"/></svg>'
    root.innerHTML = `
      <div class="cm-body">
        <i class="cm-btn-side a"></i><i class="cm-btn-side b"></i><i class="cm-btn-side c"></i><i class="cm-btn-side d"></i>
        <div class="cm-phone">
          <div class="cm-island"></div>
          <div class="cm-status"><span class="cm-time">${esc(props.time || '18:30')}</span><span class="cm-icons">${SIGNAL}${WIFI}${BATTERY}</span></div>
          <div class="cm-head">
            <span class="cm-back">‹</span>
            <div class="cm-titles"><div class="cm-title">${esc(props.title || 'Claude Code')}</div><div class="cm-device"><i class="cm-dot"></i>${esc(labels.connected)} · ${esc(props.device || '辦公室電腦')}</div></div>
          </div>
          <div class="cm-scroll"><div class="cm-log"></div></div>
          <div class="cm-composer"><span class="cm-typed"></span><span class="cm-caret off"></span><span class="cm-placeholder">${esc(labels.placeholder)}</span><span class="cm-send">↑</span></div>
          <div class="cm-home"></div>
        </div>
      </div>`
    const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => root.querySelector<T>(sel)!
    const log = $('.cm-log')
    const scroll = $('.cm-scroll')
    const typed = $('.cm-typed')
    const caret = $('.cm-caret')
    const placeholder = $('.cm-placeholder')
    const send = $('.cm-send')

    const blockHtml = (b: Block, opts: { text?: string; hover?: 'allow' | 'deny' | ''; press?: boolean; chosen?: 'allow' | 'deny' | null }): string => {
      switch (b.t) {
        case 'user':
          return `<div class="cm-user">${inline(b.text)}</div>`
        case 'say':
          return `<div class="cm-say">${inline(opts.text ?? b.text).replace(/\n/g, '<br>')}</div>`
        case 'tool':
          return `<div class="cm-tool"><span class="cm-tic">›_</span><span class="cm-tname">${esc(b.name)}</span><span class="cm-targ">${esc(b.arg)}</span>${b.result ? `<span class="cm-tres">${esc(b.result)}</span>` : ''}</div>`
        case 'ask': {
          const chosen = opts.chosen ?? b.chosen
          const btn = (k: 'allow' | 'deny', text: string): string => {
            const cls = ['cm-btn', k, chosen === k ? 'picked' : '', chosen && chosen !== k ? 'dim' : '', opts.hover === k ? 'hov' : '', opts.hover === k && opts.press ? 'press' : ''].filter(Boolean).join(' ')
            return `<span class="${cls}" data-btn="${k}">${esc(text)}</span>`
          }
          return `<div class="cm-ask${chosen ? ' done' : ''}"><div class="cm-q">${inline(b.q)}</div><div class="cm-cmd">${esc(b.cmd)}</div><div class="cm-btns">${btn('deny', labels.deny)}${btn('allow', labels.allow)}</div></div>`
        }
      }
    }

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = view.ev && KINDS.includes(view.ev.kind as MobileKind) ? view.ev : null
        let blocks = view.state.blocks
        let composer = ''
        let typing = false
        let status = ''
        const lastIdx = blocks.length - 1
        const opts: Record<number, { text?: string; hover?: 'allow' | 'deny' | ''; press?: boolean; chosen?: 'allow' | 'deny' | null }> = {}

        if (ev) {
          const s = ev.step as MobileStep
          switch (ev.kind as MobileKind) {
            case 'user': {
              const typeMs = (len(s.user) / cps.user) * 1000
              if (ev.local < typeMs) {
                composer = [...(s.user || '')].slice(0, Math.ceil((ev.local / typeMs) * len(s.user))).join('')
                typing = true
                blocks = blocks.slice(0, lastIdx)
              }
              break
            }
            case 'say':
              opts[lastIdx] = { text: cut(s.say || '', Math.ceil(ev.p * len(s.say))) }
              break
            case 'thinking':
              status = `<span class="cm-star" style="--r:${((ev.local * 0.25) % 360).toFixed(0)}deg">✻</span><span>${esc(typeof s.thinking === 'string' ? s.thinking : labels.thinking)}…</span>`
              break
            case 'allow': {
              const which: 'allow' | 'deny' = s.allow === false ? 'deny' : 'allow'
              if (ev.local < TAP.commit) opts[Math.max(lastPending(view.prev.blocks), 0)] = { chosen: null, hover: ev.local >= TAP.arrive ? which : '', press: ev.local >= TAP.clickAt }
              break
            }
          }
        }
        const html = blocks.map((b, i) => blockHtml(b, opts[i] ?? {})).join('')
        kit.setIf(log, 'html', html + (status ? `<div class="cm-status-line">${status}</div>` : ''))
        kit.setIf(typed, 'text', composer)
        kit.setIf(placeholder, 'text', composer ? '' : labels.placeholder)
        caret.className = `cm-caret${typing && kit.blink(ev?.local ?? 0) ? '' : ' off'}`
        send.className = `cm-send${composer ? ' on' : ''}`
        // 新的區塊從下面彈出;對話貼齊底部
        const row = log.lastElementChild as HTMLElement | null
        if (row && ev && (ev.kind === 'user' || ev.kind === 'tool' || ev.kind === 'ask') && !composer) kit.css(row, kit.enter(kit.progress(ev.local, 0, 320), { dist: '0.7em', scale: 0.97 }))
        else if (row) kit.css(row, { opacity: '1', transform: 'none' })
        log.style.top = `${kit.stickBottom(scroll.clientHeight, log.scrollHeight)}px`
      },

      target(name) {
        const lastOf = (sel: string): HTMLElement | null => [...root.querySelectorAll<HTMLElement>(sel)].at(-1) || null
        switch (name as MobileTarget) {
          case 'window': return $('.cm-body')
          case 'header': return $('.cm-head')
          case 'device': return $('.cm-device')
          case 'ask': return lastOf('.cm-ask')
          case 'allow': return lastOf('.cm-btn.allow')
          case 'deny': return lastOf('.cm-btn.deny')
          case 'composer': return $('.cm-composer')
          case 'latest': return log.lastElementChild as HTMLElement | null
          case 'user': return lastOf('.cm-user')
          case 'say': return lastOf('.cm-say')
          case 'tool': return lastOf('.cm-tool')
        }
        return null
      },
    }
  },
})



export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
