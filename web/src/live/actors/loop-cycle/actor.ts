// 演員 loop-cycle:一圈接一圈的循環圖(例如聊天式 AI 的「複製 → 貼上 → 存檔 → 打開 → 貼回去問」)。
// 節點排成一個圓,箭頭順時針連起來;演到哪一步哪個節點亮起,走完一圈再從頭,中間顯示第幾趟。
//
// props:
//   items   節點:[{ icon, label }],icon 是 copy、paste、save、open、ask
//   center  圓心下方的一句話
// 動作:
//   { "cycle": true }          開始繞圈(長度預設走兩圈;用 ms 改)
// 目標:window、ring、item:N(從 0 起算)、center
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type Icon = 'copy' | 'paste' | 'save' | 'open' | 'ask'
export type LoopStep = CommonStepFields & { cycle?: boolean }
export interface LoopProps {
  items: { icon: Icon; label: string }[]
  center?: string
}
type Target = 'window' | 'ring' | 'center' | `item:${number}`

/** 每個節點停多久(毫秒) */
const EACH = 1100

const ICONS: Record<Icon, string> = {
  copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 16V5a1 1 0 0 1 1-1h9"/>',
  paste: '<path d="M9 5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M12 10v6m-3-3 3 3 3-3"/>',
  save: '<path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  open: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M6 7h.01M9 7h.01"/>',
  ask: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M10 9a2 2 0 1 1 3 1.700c-.700.500-1 .800-1 1.500M12 14h.01"/>',
}

/** 圓上第 i 個節點的位置(百分比;第一個在最上面,順時針) */
const at = (i: number, n: number, r: number): { x: number; y: number } => {
  const a = ((i / n) * 360 - 90) * (Math.PI / 180)
  return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) }
}

const actor = defineActor<'cycle', LoopStep, LoopProps, undefined, Target>({
  name: 'loop-cycle',
  kinds: ['cycle'],

  duration(_kind, _step, props) {
    return (props.items?.length ?? 5) * EACH * 2
  },
  autoFocus() {
    return false
  },

  mount(root, props) {
    const items = props.items ?? []
    const n = items.length
    const R = 38
    // 兩個節點之間的弧形箭頭
    const arcs = items
      .map((_, i) => {
        const gap = (360 / n) * 0.27
        const from = (i / n) * 360 - 90 + gap
        const to = ((i + 1) / n) * 360 - 90 - gap
        const p = (deg: number): string => `${(50 + R * Math.cos((deg * Math.PI) / 180)).toFixed(2)} ${(50 + R * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`
        return `<path class="lc-arc" data-i="${i}" d="M${p(from)} A${R} ${R} 0 0 1 ${p(to)}" marker-end="url(#lc-head)"/>`
      })
      .join('')
    root.classList.add('A-loop-cycle')
    root.innerHTML = `<div class="lc-box"><div class="lc-ring" data-t="ring">
      <svg viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="lc-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>${arcs}</svg>
      ${items
        .map((it, i) => {
          const p = at(i, n, R)
          return `<div class="lc-item" data-t="item:${i}" style="left:${p.x.toFixed(2)}%;top:${p.y.toFixed(2)}%"><span class="lc-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[it.icon] ?? ''}</svg></span><b>${kit.esc(it.label)}</b></div>`
        })
        .join('')}
      <div class="lc-center" data-t="center"><strong></strong><span>${kit.esc(props.center ?? '')}</span></div>
    </div></div>`
    const q = (sel: string): HTMLElement | null => root.querySelector<HTMLElement>(sel)
    const nodes = [...root.querySelectorAll<HTMLElement>('.lc-item')]
    const paths = [...root.querySelectorAll<SVGPathElement>('.lc-arc')]
    const round = q('.lc-center strong')!

    return {
      render(f) {
        const ev = f.events.at(-1)
        const local = ev ? Math.max(0, ev.local) : -1
        const step = local < 0 ? -1 : Math.floor(local / EACH)
        const now = step < 0 ? -1 : step % n
        nodes.forEach((el, i) => {
          el.dataset.s = i === now ? 'now' : step >= 0 && (i < now || step >= n) ? 'done' : ''
          // 輪到的節點跳一下
          const pop = i === now ? Math.sin(Math.PI * Math.min(1, (local % EACH) / 360)) : 0
          el.style.setProperty('--pop', (1 + pop * 0.12).toFixed(3))
        })
        paths.forEach((el, i) => el.setAttribute('data-on', i === now && local % EACH > EACH * 0.5 ? '1' : '0'))
        kit.setIf(round, 'text', step < 0 ? '一趟' : `第 ${Math.floor(step / n) + 1} 趟`)
      },

      target(name) {
        if (name === 'window') return q('.lc-box')
        if (name === 'ring') return q('.lc-ring')
        if (name === 'center') return q('.lc-center')
        return q(`[data-t="${name}"]`)
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
