// 演員 notes:桌上的便條紙,用來演出「用手抄訂單」:一張張疊上去,其中一張滑落(漏單)。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定):
//   label   桌面角落的標示,例如「今日訂單」;省略則不顯示
//
// 動作:
//   { "jot": "客人甲 生日蛋糕 明天" }   寫一張新便條,疊在最上面(逐字寫出)
//   { "lose": "客人丙" }               文字含這段字的便條滑出桌面、掉到地上
//
// 目標:window、note:N(第 N 張,1 起算)、note:last、floor(掉落的便條)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type NotesKind = 'jot' | 'lose'
type NotesStep = CommonStepFields & { jot?: string; lose?: string }
interface NotesProps {
  label?: string
}
interface Note {
  text: string
  lost: boolean
}
interface NotesState {
  notes: Note[]
}
type NotesTarget = 'window' | 'floor' | `note:${string}`

const KINDS: readonly NotesKind[] = ['jot', 'lose']
const CPS = 12
const FALL = 1300

/** 每張便條的固定擺放(依序號,不用亂數):左右交錯往下排,位置(em,相對桌面上緣中央)與角度 */
const slot = (i: number) => ({ x: (i % 2 ? 3.2 : -3.2) + (((i * 37) % 5) - 2) * 0.3, y: i * 4.6, r: ((i * 53) % 9) - 4 })
/** 掉到地上的位置:桌面下方 */
const FLOOR = { dx: 4, y: 20.5, r: 50 }

const actor = defineActor<NotesKind, NotesStep, NotesProps, NotesState, NotesTarget>({
  name: 'notes',
  kinds: KINDS,
  parts: { label: '.nt-label' },

  hotspots() {
    return [{ target: 'window', label: '寫一張便條', input: { placeholder: '便條內容', step: (text: string) => ({ jot: text }) } }]
  },

  init() {
    return { notes: [] }
  },

  apply(st, kind, s) {
    if (kind === 'jot') {
      if (typeof s.jot !== 'string' || !s.jot) throw new Error('jot 要寫便條上的字')
      return { notes: [...st.notes, { text: s.jot, lost: false }] }
    }
    const i = st.notes.findIndex((n) => !n.lost && typeof s.lose === 'string' && n.text.includes(s.lose))
    if (i < 0) throw new Error(`lose:找不到含「${s.lose}」的便條`)
    return { notes: st.notes.map((n, k) => (k === i ? { ...n, lost: true } : n)) }
  },

  duration(kind, step) {
    return kind === 'jot' ? 350 + kit.typeDuration(step.jot ?? '', CPS) + 600 : FALL + 400
  },

  mount(root, props) {
    root.classList.add('A-notes')
    root.innerHTML = `<div class="nt-desk">${props.label ? `<span class="nt-label">${kit.esc(props.label)}</span>` : ''}</div><div class="nt-stack"></div>`
    const stack = root.querySelector<HTMLElement>('.nt-stack')!

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = view.ev && KINDS.includes(view.ev.kind as NotesKind) ? view.ev : null
        const notes = view.ev?.kind === 'hide' ? view.prev.notes : view.state.notes
        // 進行中的 lose:prev 還在桌上、state 已掉落的那一張
        const falling = ev?.kind === 'lose' ? view.state.notes.findIndex((n, i) => n.lost && !view.prev.notes[i].lost) : -1
        kit.setIf(stack, 'html', notes.map((n, i) => `<div class="nt-note" data-i="${i + 1}" data-lost="${n.lost && i !== falling ? 1 : 0}"><span class="nt-text"></span></div>`).join(''))
        const els = [...stack.children] as HTMLElement[]
        els.forEach((el, i) => {
          const n = notes[i]
          const pos = slot(i)
          const t = el.querySelector<HTMLElement>('.nt-text')!
          const isNew = ev?.kind === 'jot' && i === notes.length - 1
          kit.setIf(t, 'text', isNew ? kit.typewriter(n.text, ev.local, { start: 350, cps: CPS }).text : n.text)
          // 位置用 left/top(聚光燈、鏡頭量得到),transform 只放旋轉與縮放
          let x = pos.x
          let y = pos.y
          let r = pos.r
          let scale = 1
          let op = 1
          if (isNew) {
            scale = kit.lerp(0.6, 1, kit.ease.outBack(kit.progress(ev.local, 0, 350)))
            op = kit.progress(ev.local, 0, 200)
          }
          if (i === falling && ev) {
            // 先往旁邊滑,再掉到桌面下方,邊掉邊轉
            const slide = kit.ease.inOutCubic(kit.progress(ev.local, 0, 500))
            const drop = kit.ease.inCubic(kit.progress(ev.local, 400, FALL - 400))
            x = pos.x + slide * FLOOR.dx
            y = kit.lerp(pos.y, FLOOR.y, drop)
            r = pos.r + slide * 10 + drop * (FLOOR.r - 10)
          } else if (n.lost) {
            x = pos.x + FLOOR.dx
            y = FLOOR.y
            r = pos.r + FLOOR.r
            op = 0.9
          }
          kit.css(el, { left: `${(x - 5.5).toFixed(2)}em`, top: `${y.toFixed(2)}em`, transform: `rotate(${r.toFixed(1)}deg) scale(${scale.toFixed(3)})`, opacity: op.toFixed(3) })
        })
      },

      target(name) {
        if (name === 'window') return root.querySelector<HTMLElement>('.nt-desk')
        const els = [...stack.children] as HTMLElement[]
        if (name === 'floor') return els.find((el) => el.dataset.lost === '1') ?? null
        const m = /^note:(\d+|last)$/.exec(name)
        if (!m) return null
        return (m[1] === 'last' ? els[els.length - 1] : els[Number(m[1]) - 1]) ?? null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
