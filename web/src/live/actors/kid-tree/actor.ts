// 演員 kid-tree:兒童網頁課 0.2「網頁是一棵樹」。左邊是卡通網頁,右邊是橫向的樹狀圖(根在左、往右長,同一層由上往下排,
// 順序和網頁畫面的上下一樣;盒子裡的節點往右縮一格)。瀏覽器照樹由上往下一個一個節點畫出網頁;節點換位置,網頁跟著重畫。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
// 孩子拖節點的互動在兒童版播放器(web/src/kids/KidsPlayer.tsx 的 interact.drag 與 kids/drag.ts),演員只負責畫與推算狀態。
//
// props(登場設定):
//   title    網址列上的網站名稱
//   nodes    網頁的樹,由上到下:[{ "id": "h1", "text": "小花的家" }, { "id": "card", "children": [{ "id": "img", "text": "🐱" }, …] }, …]
//            id 是 h1、img、p、button(網頁上的東西)或 card(名片盒,可以裝東西);每個 id 只能出現一次
//   drawn    一開始網頁畫好了沒,預設 false(空白網頁,用 draw 畫出來)
//   grown    一開始樹長好了沒,預設和 drawn 一樣(沒長好時樹只有樹根,用 grow 長出來)
//   goals    拖拉任務(選用):[{ "id": "img-top", "label": "把圖片拉到最上面", "first": "img" }]
//            條件寫一種:first(最上面是它)、before: [甲, 乙](甲畫在乙前面)、inside: [甲, 盒子](甲在盒子裡面)。
//            完成過的任務記在狀態的 achieved(給子腳本的 until 判斷),網頁右下角列出任務與勾勾
//
// 動作:
//   { "grow": true }                              瀏覽器把積木排成一棵樹:節點由上往下一個一個長出來(樹根一直都在)
//   (draw 時樹還沒長好的話,樹和網頁一起長:樹每長出一個節點,網頁就畫出那一塊)
//   { "draw": "img" }                             分段畫:從上次畫到的地方接著畫,畫到 img 這個節點為止(含 img)
//   { "draw": true }                              瀏覽器照樹畫網頁:小畫家從樹根出發,由上往下一個一個節點走,網頁一塊一塊畫出來
//   { "put": "img", "parent": "root", "index": 0 }  把節點移到 parent(root 或 card)底下的第 index 個位置(從 0 算,以移走之後的順序為準);
//                                                 網頁照新的樹重畫。加 "tap": true 用虛擬滑鼠示範拖過去
//   { "inspect": "card" }                         樹上的節點和網頁上的東西一起亮起來;"inspect": false 恢復。加 "tap": true 示範點節點
//   { "check": "h1", "answer": "h1" }             回答「是哪一個節點」:答對變綠,答錯變紅搖一搖
//
// 目標:window、page、tree、goals、node:<id>(樹上的節點,含 node:root)、part:<id>(網頁上的東西)、slot:<parent>:<index>(拖放的位置)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type Kind = 'grow' | 'draw' | 'put' | 'inspect' | 'check'
type Step = CommonStepFields & {
  grow?: boolean
  draw?: boolean | string
  put?: string
  parent?: string
  index?: number
  inspect?: string | false
  check?: string
  answer?: string
  tap?: boolean
}
interface PropNode {
  id: string
  text?: string
  children?: PropNode[]
}
export interface Goal {
  id: string
  label: string
  first?: string
  before?: [string, string]
  inside?: [string, string]
}
interface Props {
  title?: string
  nodes?: PropNode[]
  drawn?: boolean
  grown?: boolean
  goals?: Goal[]
}
export interface TreeState {
  /** 每個容器(root 與 card)底下依序的節點 */
  kids: Record<string, string[]>
  /** 照樹的順序已經畫了幾個節點(0 = 空白網頁) */
  drawn: number
  /** 樹長好了沒(沒長好時只有樹根) */
  grown: boolean
  focus: string | null
  verdict: { id: string; right: boolean } | null
  /** 拖拉任務(props 的 goals,放進狀態才能在 put 時判斷) */
  goals: Goal[]
  /** 完成過的任務 id(完成過就算,之後拖亂了也不扣) */
  achieved: string[]
}
type Target = 'window' | 'page' | 'tree' | 'goals' | `node:${string}` | `part:${string}` | `slot:${string}`

const KINDS: readonly Kind[] = ['grow', 'draw', 'put', 'inspect', 'check']

/** 每種節點:中文名稱、樹上的小圖示、顏色(和 0.1 的積木一致,web/src/kids/tags.ts) */
const KIND_OF: Record<string, { name: string; icon: string; color: string; shade: string; box?: true }> = {
  h1: { name: '標題', icon: '🔤', color: '#f6a03c', shade: '#9a4a00' },
  img: { name: '圖片', icon: '🖼️', color: '#4fb3e8', shade: '#155f8a' },
  p: { name: '文字', icon: '📝', color: '#5cc477', shade: '#23703a' },
  button: { name: '按鈕', icon: '👆', color: '#b48af0', shade: '#5b2a9e' },
  card: { name: '名片盒', icon: '📦', color: '#f2c94c', shade: '#8a6a00', box: true },
}
const isBox = (id: string) => id === 'root' || !!KIND_OF[id]?.box

const DEFAULT_NODES: PropNode[] = [
  { id: 'h1', text: '小花的家' },
  {
    id: 'card',
    children: [
      { id: 'img', text: '🐱' },
      { id: 'p', text: '小花是一隻愛睡午覺的橘貓。' },
    ],
  },
  { id: 'button', text: '摸摸小花' },
]

/** 分段畫時每個節點的時間:前一半樹上長出節點,後一半網頁畫出那一塊(慢一點才看得出對應) */
const STEP_MS = 1600
/** 樹每往右一層縮排多少 px */
const INDENT = 110
/** 樹長出一個節點的時間 */
const GROW_MS = 450
const MOVE_MS = 900
const INSPECT_MS = 900
const CHECK_MS = 1200
/** 示範拖拉:滑鼠先到節點、再到放的位置(舞台的虛擬滑鼠每段固定 550ms) */
const TAP_MOVE = 1500
const TAP_AT = 750

/** 照樹由上往下的順序(瀏覽器畫的順序) */
export function drawOrder(kids: Record<string, string[]>): string[] {
  const out: string[] = []
  const walk = (p: string) => {
    for (const id of kids[p] ?? []) {
      out.push(id)
      if (kids[id]) walk(id)
    }
  }
  walk('root')
  return out
}
const parentOf = (kids: Record<string, string[]>, id: string) => Object.keys(kids).find((p) => kids[p].includes(id))
/** put 的 parent、index(移走之後的位置)在移動前的樹上是哪一條縫 */
function slotOf(kids: Record<string, string[]>, id: string, parent: string, index: number): string {
  const from = parentOf(kids, id)
  const at = from ? kids[from].indexOf(id) : -1
  return `slot:${parent}:${from === parent && index >= at ? index + 1 : index}`
}
/** id 是不是在 box 裡面(含更深層) */
function within(kids: Record<string, string[]>, id: string, box: string): boolean {
  for (let p = parentOf(kids, id); p; p = parentOf(kids, p)) if (p === box) return true
  return false
}

function met(g: Goal, kids: Record<string, string[]>): boolean {
  const order = drawOrder(kids)
  if (g.first) return order[0] === g.first
  if (g.before) return order.indexOf(g.before[0]) >= 0 && order.indexOf(g.before[0]) < order.indexOf(g.before[1])
  if (g.inside) return within(kids, g.inside[0], g.inside[1])
  return false
}

function nodesOf(props: Props) {
  const texts: Record<string, string> = {}
  const kids: Record<string, string[]> = { root: [] }
  const seen = new Set<string>()
  const add = (parent: string, list: PropNode[]) => {
    for (const n of list) {
      if (!KIND_OF[n.id]) throw new Error(`nodes:不認得的節點「${n.id}」,目前只有 ${Object.keys(KIND_OF).join('、')}`)
      if (seen.has(n.id)) throw new Error(`nodes:「${n.id}」只能出現一次`)
      seen.add(n.id)
      kids[parent].push(n.id)
      if (isBox(n.id)) {
        kids[n.id] = []
        add(n.id, n.children ?? [])
      } else texts[n.id] = n.text ?? ''
    }
  }
  add('root', props.nodes ?? DEFAULT_NODES)
  return { texts, kids }
}

function looks(st: TreeState, id: string): { on: number; dim: number; bad: number } {
  const v = st.verdict
  if (v) {
    if (v.id === id) return v.right ? { on: 1, dim: 0, bad: 0 } : { on: 0, dim: 0, bad: 1 }
    return { on: 0, dim: v.right ? 1 : 0, bad: 0 }
  }
  if (st.focus === null) return { on: 0, dim: 0, bad: 0 }
  return st.focus === id || within(st.kids, id, st.focus) ? { on: 1, dim: 0, bad: 0 } : { on: 0, dim: 1, bad: 0 }
}

const structureKey = (kids: Record<string, string[]>) => JSON.stringify(kids)

const actor = defineActor<Kind, Step, Props, TreeState, Target>({
  name: 'kid-tree',
  kinds: KINDS,
  parts: { goals: '.kt-goals' },

  init(props) {
    const { kids } = nodesOf(props)
    for (const g of props.goals ?? []) {
      const ids = [g.first, ...(g.before ?? []), ...(g.inside ?? [])].filter(Boolean) as string[]
      if (!ids.length) throw new Error(`goals:「${g.id}」要寫 first、before 或 inside`)
      for (const id of ids) if (!KIND_OF[id]) throw new Error(`goals:「${g.id}」不認得「${id}」`)
    }
    const achieved = (props.goals ?? []).filter((g) => met(g, kids)).map((g) => g.id)
    const all = drawOrder(kids).length
    return { kids, drawn: props.drawn ? all : 0, grown: props.grown ?? !!props.drawn, focus: null, verdict: null, goals: props.goals ?? [], achieved }
  },

  apply(st, kind, s) {
    if (kind === 'grow') return { ...st, grown: true, focus: null, verdict: null }
    if (kind === 'draw') {
      const order = drawOrder(st.kids)
      const upto = s.draw === true || s.draw === undefined ? order.length : order.indexOf(String(s.draw)) + 1
      if (upto <= 0) throw new Error(`draw:樹上沒有「${String(s.draw)}」`)
      if (upto <= st.drawn) throw new Error(`draw:「${String(s.draw)}」已經畫過了`)
      return { ...st, drawn: upto, grown: st.grown || upto === order.length, focus: null, verdict: null }
    }
    if (kind === 'inspect') {
      if (s.inspect === false) return { ...st, focus: null, verdict: null }
      if (typeof s.inspect !== 'string' || !(s.inspect === 'root' || parentOf(st.kids, s.inspect))) throw new Error(`inspect:樹上沒有「${String(s.inspect)}」`)
      return { ...st, focus: s.inspect, verdict: null }
    }
    if (kind === 'check') {
      if (!s.check || !s.answer) throw new Error('check 和 answer 都要寫節點,例如 { "check": "h1", "answer": "h1" }')
      const right = s.check === s.answer
      return { ...st, focus: right ? s.check : null, verdict: { id: s.check, right } }
    }
    // put
    const id = s.put ?? ''
    const from = parentOf(st.kids, id)
    if (!from) throw new Error(`put:樹上沒有「${id}」`)
    const to = s.parent ?? 'root'
    if (!isBox(to) || !st.kids[to]) throw new Error(`put:「${to}」不是可以放東西的地方(root 或盒子)`)
    if (to === id || within(st.kids, to, id)) throw new Error(`put:不能把「${id}」放進它自己裡面`)
    const kids = Object.fromEntries(Object.entries(st.kids).map(([p, list]) => [p, list.filter((x) => x !== id)]))
    const index = Math.max(0, Math.min(kids[to].length, s.index ?? kids[to].length))
    kids[to] = [...kids[to].slice(0, index), id, ...kids[to].slice(index)]
    const achieved = [...st.achieved, ...st.goals.filter((g) => !st.achieved.includes(g.id) && met(g, kids)).map((g) => g.id)]
    return { ...st, kids, focus: null, verdict: null, achieved }
  },

  duration(kind, step, props, prev) {
    if (kind === 'grow') return 400 + nodesCount(props) * GROW_MS
    if (kind === 'draw') {
      // 要畫幾個節點:分段畫(draw 寫節點)時只算這一段,用 prev 狀態推算
      const order = prev ? drawOrder(prev.kids) : []
      const from = prev?.drawn ?? 0
      const upto = typeof step.draw === 'string' && prev ? order.indexOf(step.draw) + 1 : nodesCount(props)
      return 600 + Math.max(1, upto - from) * STEP_MS
    }
    if (kind === 'put') return (step.tap ? TAP_MOVE : 0) + MOVE_MS
    if (kind === 'inspect') return (step.tap ? TAP_AT : 0) + INSPECT_MS
    return CHECK_MS
  },

  cursor(kind, step, prev) {
    if (!step.tap) return null
    if (kind === 'inspect' && typeof step.inspect === 'string') return { moves: [{ at: 150, target: `node:${step.inspect}` }], clickAt: TAP_AT }
    if (kind === 'put' && step.put) {
      return {
        moves: [
          { at: 150, target: `node:${step.put}` },
          { at: 850, target: prev ? slotOf(prev.kids, step.put, step.parent ?? 'root', step.index ?? 0) : `slot:${step.parent ?? 'root'}:${step.index ?? 0}` },
        ],
        clickAt: TAP_MOVE,
      }
    }
    return null
  },

  mount(root, props) {
    const { texts } = nodesOf(props)
    const goals = props.goals ?? []
    root.classList.add('A-kid-tree')
    root.innerHTML = `
      <div class="kt-scene">
        <div class="kt-pane kt-page-pane">
          <div class="kt-bar"><span class="kt-lights"><i></i><i></i><i></i></span><span class="kt-url">${kit.esc(props.title ?? '我的網頁')}</span></div>
          <div class="kt-page"></div>
        </div>
        <div class="kt-pane kt-tree-pane">
          <p class="kt-label">網頁的樹狀圖</p>
          <div class="kt-tree"></div>
          <span class="kt-walker" aria-hidden="true">🖌️<em></em></span>
          ${goals.length ? `<ul class="kt-goals">${goals.map((g) => `<li data-goal="${kit.esc(g.id)}"><b></b>${kit.esc(g.label)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>`
    const pageEl = root.querySelector<HTMLElement>('.kt-page')!
    const pagePane = root.querySelector<HTMLElement>('.kt-page-pane')!
    const treeEl = root.querySelector<HTMLElement>('.kt-tree')!
    const treePane = root.querySelector<HTMLElement>('.kt-tree-pane')!
    const walker = root.querySelector<HTMLElement>('.kt-walker')!
    const walkerTag = walker.querySelector<HTMLElement>('em')!
    const goalsEl = root.querySelector<HTMLElement>('.kt-goals')

    const partHtml = (id: string): string => {
      const t = kit.esc(texts[id] ?? '')
      if (id === 'h1') return `<span class="kt-h1">${t}</span>`
      if (id === 'img') return `<span class="kt-photo">${t}</span>`
      if (id === 'p') return `<span class="kt-text">${t}</span>`
      return `<span class="kt-btn">${t}</span>`
    }
    const pageHtml = (kids: Record<string, string[]>, p = 'root'): string =>
      (kids[p] ?? [])
        .map((id) =>
          isBox(id)
            ? `<div class="kt-part kt-box" data-id="${id}"><span class="kt-box-label">${KIND_OF[id].name}</span>${pageHtml(kids, id)}</div>`
            : `<div class="kt-part" data-id="${id}">${partHtml(id)}</div>`,
        )
        .join('')
    /** 樹上的節點:小字標出種類(說對名字),主體放網頁上實際的字或圖;盒子與樹根放圖示 */
    const chip = (id: string) => {
      if (id === 'root') return `<span class="kt-node kt-node-root" data-id="root"><span class="kt-icon">🌳</span><span class="kt-val">網頁</span></span>`
      const k = KIND_OF[id]
      const raw = texts[id] ?? ''
      const val = k.box ? `<span class="kt-icon">${k.icon}</span>` : id === 'img' ? `<span class="kt-pic">${kit.esc(raw)}</span>` : `<span class="kt-val" data-kind="${id}">${kit.esc([...raw].length > 9 ? [...raw].slice(0, 8).join('') + '…' : raw)}</span>`
      return `<span class="kt-node" data-id="${id}"><small class="kt-kind">${k.name}</small>${val}</span>`
    }
    // 樹:一個節點一列,深度越深越往右;每個容器的每個位置有一條放置用的細縫(slot)。
    // 樹枝每一列自己畫:經過這一列的直線(上面的層還有後面的兄弟)、自己的轉角(├ 或 └)、盒子往下一層的起頭。
    // 每一段樹枝都標 data-to:它通往哪一個節點。長樹時這個節點長出來,通往它的那幾段才由上往下畫出來(見 render)
    const X = (level: number) => (level - 1) * INDENT + 34
    const vline = (level: number, to: string, top = '0', bottom = '0') => `<i class="kt-v" data-to="${to}" style="left:${X(level)}px;top:${top};bottom:${bottom}"></i>`
    const treeHtml = (kids: Record<string, string[]>): string => {
      const first = kids.root?.[0]
      const rows: string[] = [`<div class="kt-row" data-depth="0">${first ? vline(1, first, '50%') : ''}${chip('root')}</div>`]
      // cont[level]:那一層的直線要往下延伸到哪一個兄弟(null = 那一層後面沒有兄弟了)
      const walk = (p: string, depth: number, cont: (string | null)[]) => {
        const list = kids[p] ?? []
        const passing = (upto: number) => cont.slice(1, upto).map((to, k) => (to ? vline(k + 1, to) : '')).join('')
        list.forEach((id, i) => {
          const next = list[i + 1] ?? null
          // 放置的縫:經過的直線,加上這一層通往這個節點的直線
          rows.push(`<div class="kt-slot" data-slot="${p}:${i}" style="--depth:${depth}">${passing(depth)}${vline(depth, id)}<b class="kt-slot-mark"></b></div>`)
          const firstKid = kids[id]?.[0]
          const childStart = firstKid ? vline(depth + 1, firstKid, '50%') : ''
          const elbow = `<i class="kt-elbow" data-to="${id}" style="left:${X(depth)}px;width:${INDENT - 34}px"></i>${next ? vline(depth, next, '50%') : ''}`
          rows.push(`<div class="kt-row" data-depth="${depth}" style="--depth:${depth}">${passing(depth)}${elbow}${childStart}${chip(id)}</div>`)
          if (kids[id]) walk(id, depth + 1, [...cont.slice(0, depth), next])
        })
        rows.push(`<div class="kt-slot" data-slot="${p}:${list.length}" style="--depth:${depth}">${passing(depth)}<b class="kt-slot-mark"></b></div>`)
      }
      walk('root', 1, [null])
      return rows.join('')
    }

    type Spots = { page: Record<string, { x: number; y: number }>; tree: Record<string, { x: number; y: number }> }
    const layouts = new Map<string, Spots>()
    const layoutOf = (kids: Record<string, string[]>): Spots => {
      const key = structureKey(kids)
      const hit = layouts.get(key)
      if (hit) return hit
      const spots: Spots = { page: {}, tree: {} }
      const measure = (src: HTMLElement, html: string, sel: string, out: Record<string, { x: number; y: number }>) => {
        const copy = src.cloneNode(false) as HTMLElement
        copy.innerHTML = html
        Object.assign(copy.style, { position: 'absolute', left: `${src.offsetLeft}px`, top: `${src.offsetTop}px`, width: `${src.offsetWidth}px`, visibility: 'hidden', pointerEvents: 'none' })
        src.parentElement!.appendChild(copy)
        const box = copy.getBoundingClientRect()
        const k = box.width / (copy.offsetWidth || 1) || 1
        for (const el of copy.querySelectorAll<HTMLElement>(sel)) {
          const r = el.getBoundingClientRect()
          out[el.dataset.id!] = { x: (r.left - box.left) / k, y: (r.top - box.top) / k }
        }
        copy.remove()
      }
      measure(pageEl, pageHtml(kids), '.kt-part', spots.page)
      measure(treeEl, treeHtml(kids), '.kt-node', spots.tree)
      layouts.set(key, spots)
      return spots
    }

    let builtKey = ''
    const build = (kids: Record<string, string[]>) => {
      const key = structureKey(kids)
      if (key === builtKey) return
      builtKey = key
      pageEl.innerHTML = pageHtml(kids)
      treeEl.innerHTML = treeHtml(kids)
      for (const el of root.querySelectorAll<HTMLElement>('[data-id]')) {
        const k = KIND_OF[el.dataset.id!]
        if (!k) continue
        el.style.setProperty('--c', k.color)
        el.style.setProperty('--d', k.shade)
      }
    }
    const nodeEl = (id: string) => treeEl.querySelector<HTMLElement>(`.kt-node[data-id="${id}"]`)
    const partEl = (id: string) => pageEl.querySelector<HTMLElement>(`.kt-part[data-id="${id}"]`)

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = view.ev && KINDS.includes(view.ev.kind as Kind) ? view.ev : null
        const from = view.prev
        const to = view.ev?.kind === 'hide' ? view.prev : view.state
        const tap = !!(ev?.step as Step | undefined)?.tap
        const lead = ev?.kind === 'put' && tap ? TAP_MOVE : ev?.kind === 'inspect' && tap ? TAP_AT : 0
        const p = ev ? kit.ease.inOutCubic(kit.progress(ev.local, lead, ev.dur - lead)) : 1

        // 樹與網頁的結構:移動進行到一半才換成新的樹(換的時候移動的那個彈一下)
        const moving = ev?.kind === 'put'
        const shown = moving && tap && ev!.local < TAP_MOVE ? from : to
        build(shown.kids)
        const order = drawOrder(shown.kids)

        // 畫網頁:還沒畫是空白;畫的過程中照樹的順序一塊一塊出現,小畫家走到哪個節點
        const drawing = ev?.kind === 'draw' ? ev : null
        const steps = order.length
        const walked = drawing ? Math.min(to.drawn, from.drawn + Math.max(0, drawing.local - 300) / STEP_MS) : to.drawn
        order.forEach((id, i) => {
          const el = partEl(id)
          if (!el) return
          // 樹沒長好時,這個節點的前一半時間在長樹,後一半才畫到網頁上
          // (看的是畫之前樹長好了沒:最後一段畫完時 to.grown 才變 true,那一段還是要先長樹再畫)
          const a = from.grown ? kit.clamp(walked - i, 0, 1) : kit.clamp((walked - i) * 2 - 1, 0, 1)
          // 彈出來:從小放大、稍微超過再回到原大小(0.6 → 1.12 → 1),前段跟著淡入;名片盒也一樣
          const s = a < 0.6 ? kit.lerp(0.6, 1.12, kit.ease.outCubic(a / 0.6)) : kit.lerp(1.12, 1, kit.ease.inOutCubic((a - 0.6) / 0.4))
          kit.css(el, { opacity: kit.clamp(a / 0.4, 0, 1).toFixed(3), scale: s.toFixed(3) })
        })
        // 長樹:沒長好時只有樹根;grow 進行中節點由上往下一個一個長出來
        const growing = ev?.kind === 'grow' ? ev : null
        // draw 時樹和網頁一起長:樹每長出一個節點,瀏覽器就畫出那一塊(和小畫家同一個進度)
        const grownCount = growing ? (growing.local - 200) / GROW_MS : to.grown && !drawing ? steps : from.grown ? steps : walked
        /** 第 i 個節點長出來的進度(0~1);畫的時候是這個節點的前一半時間 */
        const gp = (i: number) => (drawing && !from.grown ? kit.clamp((grownCount - i) * 2, 0, 1) : kit.clamp(grownCount - i, 0, 1))
        // 一個節點長出來分三段:直線從上一個點往下畫到這一列的中間 → 轉角往右畫進節點 → 節點出現
        const V_END = 0.45
        const H_END = 0.7
        const chipScale: Record<string, number> = {}
        order.forEach((id, i) => {
          const node = nodeEl(id)
          if (!node) return
          const c = kit.clamp((gp(i) - H_END) / (1 - H_END), 0, 1)
          chipScale[id] = 0.6 + 0.4 * c
          kit.css(node, { opacity: c.toFixed(3), scale: chipScale[id].toFixed(3) })
        })
        // 樹枝:通往同一個節點的幾段(上一個點往下的直線、經過的直線、縫裡的直線、轉角)照畫面由上往下接成一條,
        // 依長度分配進度,用 clip-path 一段一段露出來;還沒長的節點,通往它的樹枝完全不出現
        const index = new Map(order.map((id, i) => [id, i]))
        const lines = new Map<string, HTMLElement[]>()
        for (const el of treeEl.querySelectorAll<HTMLElement>('.kt-v, .kt-elbow')) {
          const to = el.dataset.to!
          if (!lines.has(to)) lines.set(to, [])
          lines.get(to)!.push(el)
        }
        for (const [to, els] of lines) {
          const g = gp(index.get(to) ?? 0)
          const v = kit.clamp(g / V_END, 0, 1)
          const h = kit.clamp((g - V_END) / (H_END - V_END), 0, 1)
          if (h >= 1) {
            for (const el of els) kit.css(el, { clipPath: '' })
            continue
          }
          if (v <= 0) {
            for (const el of els) kit.css(el, { clipPath: 'inset(0 0 100% 0)' })
            continue
          }
          // 量每一段的高度(版面上的高度,不受舞台縮放影響);轉角只算它直的那一段(列的上半)
          const hs = els.map((el) => el.offsetHeight)
          const reach = v * hs.reduce((a, b) => a + b, 0)
          let acc = 0
          els.forEach((el, k) => {
            const f = hs[k] ? kit.clamp((reach - acc) / hs[k], 0, 1) : 1
            acc += hs[k]
            const cut = `${((1 - f) * 100).toFixed(2)}%`
            if (el.classList.contains('kt-elbow')) {
              // 轉角:先露出左邊直的一段(含圓角),直的畫完才往右畫
              kit.css(el, { clipPath: f < 1 || h <= 0 ? `inset(0 calc(100% - 24px) ${cut} 0)` : `inset(0 calc((100% - 24px) * ${(1 - h).toFixed(3)}) 0 0)` })
            } else kit.css(el, { clipPath: f >= 1 ? '' : `inset(0 0 ${cut} 0)` })
          })
        }

        if (drawing && walked < to.drawn) {
          const c = Math.max(0, Math.floor(walked))
          const target = nodeEl(order[c])
          // 和上一個畫的節點比:更深一層是「下一層(裡面)」,一樣深是「同一層」,比較淺是回到上一層
          const depth = (id: string) => {
            let d = 0
            for (let p = parentOf(shown.kids, id); p && p !== 'root'; p = parentOf(shown.kids, p)) d++
            return d
          }
          const rel = c === 0 ? '→ 樹根長出第一層' : depth(order[c]) > depth(order[c - 1]) ? '→ 下一層（裡面）' : depth(order[c]) === depth(order[c - 1]) ? '↓ 同一層，往下' : '↩ 回到上一層，往下'
          kit.setIf(walkerTag, 'text', rel)
          walker.dataset.rel = depth(order[c]) > (c === 0 ? -1 : depth(order[c - 1])) ? 'down' : 'same'
          if (target) {
            // 小畫家站在節點左邊:位置用畫面上量到的距離,換回樹狀圖這一格的座標(舞台有縮放)
            const pane = treePane.getBoundingClientRect()
            const k = pane.width / (treePane.offsetWidth || 1) || 1
            const r = target.getBoundingClientRect()
            // 節點還在長(縮小著)時,換回原本大小的左緣,小畫家才不會跟著跳
            const s = chipScale[order[c]] ?? 1
            const left = r.left + r.width / 2 - r.width / s / 2
            kit.css(walker, { opacity: '1', left: `${((left - pane.left) / k - 60).toFixed(1)}px`, top: `${((r.top - pane.top + r.height / 2) / k - 26).toFixed(1)}px` })
          }
        } else kit.css(walker, { opacity: '0' })

        // 亮暗與答錯搖一搖(樹上的節點和網頁上的東西一起)
        const shakeP = ev?.kind === 'check' && to.verdict && !to.verdict.right ? ev.p : 1
        const pop = moving ? Math.sin(Math.min(1, Math.max(0, (p - 0.5) * 2)) * Math.PI) : 0
        for (const id of ['root', ...order]) {
          const l0 = looks(from, id)
          const l1 = looks(to, id)
          const on = kit.lerp(l0.on, l1.on, p)
          const dim = kit.lerp(l0.dim, l1.dim, p)
          const bad = kit.lerp(l0.bad, l1.bad, p)
          const shake = l1.bad && shakeP < 1 ? Math.sin(shakeP * Math.PI * 6) * (1 - shakeP) * 0.5 : 0
          const grow = moving && (ev!.step as Step).put === id ? pop * 0.12 : 0
          for (const el of [nodeEl(id), id === 'root' ? null : partEl(id)]) {
            if (!el) continue
            el.style.setProperty('--on', on.toFixed(3))
            el.style.setProperty('--dim', dim.toFixed(3))
            el.style.setProperty('--bad', bad.toFixed(3))
            kit.css(el, { translate: `${shake.toFixed(3)}em 0`, transform: `scale(${(1 + grow).toFixed(3)})` })
          }
        }

        // 移動之後的滑動(FLIP):換成新的樹之後,MOVE_MS 內從舊的位置滑到新的位置。
        // 被拖的那個節點在樹上已經在放下去的地方(示範時被拖過去、孩子拖的時候放在那裡),樹上的它不滑
        if (moving && ev && !(tap && ev.local < TAP_MOVE)) {
          const q = kit.ease.inOutCubic(kit.progress(ev.local, tap ? TAP_MOVE : 0, MOVE_MS))
          if (q < 1) {
            const A = layoutOf(from.kids)
            const B = layoutOf(to.kids)
            const movedId = (ev.step as Step).put
            const delta = (m: Spots['page'], n: Spots['page'], id: string) => (m[id] && n[id] ? { x: m[id].x - n[id].x, y: m[id].y - n[id].y } : { x: 0, y: 0 })
            for (const id of order) {
              const part = partEl(id)
              if (part) {
                const d = delta(A.page, B.page, id)
                const box = parentOf(to.kids, id)
                const up = box && box !== 'root' ? delta(A.page, B.page, box) : { x: 0, y: 0 }
                kit.css(part, { translate: `${((d.x - up.x) * (1 - q)).toFixed(1)}px ${((d.y - up.y) * (1 - q)).toFixed(1)}px` })
              }
              const node = nodeEl(id)
              if (node && id !== movedId) {
                const d = delta(A.tree, B.tree, id)
                kit.css(node, { translate: `${(d.x * (1 - q)).toFixed(1)}px ${(d.y * (1 - q)).toFixed(1)}px` })
              }
            }
          }
        }

        // 示範拖拉:節點被抬起來、跟著滑鼠移到放置的縫(位置用畫面上量到的距離,換回演員自己的座標)
        if (moving && tap && ev && ev.local < TAP_MOVE) {
          const s = ev.step as Step
          const node = nodeEl(s.put ?? '')
          const slotName = slotOf(from.kids, s.put!, s.parent ?? 'root', s.index ?? 0).slice('slot:'.length)
          const slot = node && treeEl.querySelector<HTMLElement>(`.kt-slot[data-slot="${slotName}"] .kt-slot-mark`)
          if (node && slot) {
            const k = treeEl.getBoundingClientRect().width / (treeEl.offsetWidth || 1) || 1
            const a = node.getBoundingClientRect()
            const b = slot.getBoundingClientRect()
            const dp = kit.ease.inOutCubic(kit.progress(ev.local, TAP_AT - 100, TAP_MOVE - TAP_AT + 100))
            const dx = ((b.left - a.left) / k) * dp
            const dy = ((b.top + b.height / 2 - (a.top + a.height / 2)) / k) * dp
            kit.css(node, { translate: `${dx.toFixed(1)}px ${dy.toFixed(1)}px`, transform: `scale(${(1 + 0.1 * Math.min(1, dp * 4)).toFixed(3)})`, zIndex: '3' })
            node.dataset.lifted = '1'
          }
        } else for (const el of treeEl.querySelectorAll<HTMLElement>('[data-lifted]')) {
          delete el.dataset.lifted
          kit.css(el, { zIndex: '' })
        }

        // 任務:完成的打勾
        if (goalsEl) for (const li of goalsEl.querySelectorAll<HTMLElement>('li')) li.dataset.done = to.achieved.includes(li.dataset.goal!) ? '1' : '0'
      },

      target(name) {
        if (name === 'window') return root
        if (name === 'page') return pagePane
        if (name === 'tree') return treePane
        if (name === 'goals') return goalsEl
        const m = /^(node|part|slot):(.+)$/.exec(name)
        if (!m) return null
        if (m[1] === 'node') return nodeEl(m[2])
        if (m[1] === 'part') return partEl(m[2])
        return treeEl.querySelector<HTMLElement>(`.kt-slot[data-slot="${m[2]}"] .kt-slot-mark`)
      },
    }
  },
})

/** 節點數(畫網頁的長度用) */
function nodesCount(props: Props): number {
  return drawOrder(nodesOf(props).kids).length
}

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
