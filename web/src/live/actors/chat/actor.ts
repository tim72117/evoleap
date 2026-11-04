// 演員 chat:通用的手機聊天畫面(不仿任何品牌的介面與配色),用來演出客人傳來的訊息。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定,只描述起始狀態):
//   title   聊天室名稱,例如「小森烘焙」
//
// 動作:
//   { "receive": "我要訂一個生日蛋糕,明天拿", "from": "客人甲" }   收到一則訊息:先顯示「輸入中」,再彈出泡泡
//   { "reply": "好的,幫您記下來" }                                店家回覆(靠右)
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window、msg:N(第 N 則,1 起算)、msg:last
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type ChatKind = 'receive' | 'reply'
type ChatStep = CommonStepFields & { receive?: string; from?: string; reply?: string }
interface ChatProps {
  title?: string
}
interface Msg {
  text: string
  from: string | null
}
interface ChatState {
  msgs: Msg[]
}
type ChatTarget = 'window' | `msg:${string}`

const KINDS: readonly ChatKind[] = ['receive', 'reply']
/** 收到訊息時「輸入中」顯示多久,之後泡泡彈出 */
const TYPING = 650
const POP = 420

/** 頭像:名字的最後一個字(客人甲 → 甲、店員B → B),顏色由名字決定 */
const initialOf = (name: string): string => kit.graphemes(name).slice(-1)[0] ?? '?'
const hueOf = (name: string): number => [...name].reduce((h, c) => (h * 31 + c.codePointAt(0)!) % 360, 7)

const actor = defineActor<ChatKind, ChatStep, ChatProps, ChatState, ChatTarget>({
  name: 'chat',
  kinds: KINDS,
  parts: { bar: '.ch-bar', back: '.ch-back', avatar: '.ch-avatar' },

  hotspots() {
    return [{ target: 'window', label: '回覆訊息', input: { placeholder: '打一句回覆', step: (text: string) => ({ reply: text }) } }]
  },

  init() {
    return { msgs: [] }
  },

  apply(st, kind, s) {
    if (kind === 'receive') {
      if (typeof s.receive !== 'string' || !s.receive) throw new Error('receive 要寫訊息文字')
      if (typeof s.from !== 'string' || !s.from) throw new Error('receive 要寫 from(誰傳的)')
      return { msgs: [...st.msgs, { text: s.receive, from: s.from }] }
    }
    if (typeof s.reply !== 'string' || !s.reply) throw new Error('reply 要寫訊息文字')
    return { msgs: [...st.msgs, { text: s.reply, from: null }] }
  },

  duration(kind) {
    return kind === 'receive' ? TYPING + POP + 900 : POP + 900
  },

  mount(root, props) {
    root.classList.add('A-chat')
    root.innerHTML = `<div class="ch-phone"><div class="ch-bar"><span class="ch-back">‹</span><span class="ch-title"></span></div><div class="ch-log"></div></div>`
    kit.setIf(root.querySelector<HTMLElement>('.ch-title')!, 'text', props.title || '聊天')
    const log = root.querySelector<HTMLElement>('.ch-log')!

    const rowHtml = (m: Msg, i: number, typing: boolean): string => {
      const mine = m.from === null
      const avatar = mine ? '' : `<span class="ch-avatar" style="--h:${hueOf(m.from!)}">${kit.esc(initialOf(m.from!))}</span>`
      const name = mine ? '' : `<span class="ch-name">${kit.esc(m.from)}</span>`
      const body = typing ? `<span class="ch-typing">輸入中</span>` : kit.esc(m.text)
      return `<div class="ch-row${mine ? ' mine' : ''}" data-i="${i + 1}">${avatar}<div class="ch-col">${name}<div class="ch-bubble">${body}</div></div></div>`
    }

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = view.ev && KINDS.includes(view.ev.kind as ChatKind) ? view.ev : null
        const msgs = view.ev?.kind === 'hide' ? view.prev.msgs : view.state.msgs
        const last = msgs.length - 1
        const typing = ev?.kind === 'receive' && ev.local < TYPING
        kit.setIf(log, 'html', msgs.map((m, i) => rowHtml(m, i, typing && i === last)).join(''))
        const row = log.lastElementChild as HTMLElement | null
        if (!row) return
        if (ev) {
          const p = typing ? kit.progress(ev.local, 0, 200) : kit.progress(ev.local, ev.kind === 'receive' ? TYPING : 0, POP)
          kit.css(row, kit.enter(p, { dist: '0.8em', scale: typing ? 1 : 0.92 }))
          if (typing) kit.setIf(row.querySelector<HTMLElement>('.ch-typing')!, 'text', `輸入中${kit.dots(ev.local)}`)
        } else kit.css(row, { opacity: '1', transform: 'none' })
      },

      target(name) {
        if (name === 'window') return root.querySelector<HTMLElement>('.ch-phone')
        const m = /^msg:(\d+|last)$/.exec(name)
        if (!m) return null
        const rows = [...log.querySelectorAll<HTMLElement>('.ch-row')]
        const row = m[1] === 'last' ? rows[rows.length - 1] : rows[Number(m[1]) - 1]
        return row?.querySelector<HTMLElement>('.ch-bubble') ?? null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
