// 演員 dom-tree:網頁的元素結構圖(成人課用,網頁怎麼運作 1.1 起)。容器元素畫成一個方框,上緣是開頭標籤、
// 下緣是結尾標籤,包住的子元素排在方框裡、左邊一條樹幹連起來;沒有子元素的元素一行寫完:開頭標籤、內容、結尾標籤。
// 用來演「元素包著元素」與「標籤把內容包起來」,不用文字編輯器。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定):
//   nodes   元素的樹,由上到下:[{ "id": "body", "tag": "body", "children": [{ "id": "title", "tag": "h1", "text": "小森咖啡" }, …] }]
//           tag 是標籤名稱;text 是內容(沒有 children 時才寫);"void": true 表示只有一個標籤、不能包東西(例如 img)。
//           id 不能重複,給動作與目標用。
//   grown   一開始就全部長好(預設 false:只看得到第一個元素,用 grow 長出來)
//   look    樣式:clean(預設,成人課:白底、細框、等寬字的標籤)或 kids(兒童課:粗黑框、鮮豔色塊、圓角,和 kid-web、kid-tree 同一套)
//
// 動作:
//   { "grow": true }                              由上往下一個一個長出元素,長到全部
//   { "grow": "price" }                           長到 price 這個元素為止(含)
//   { "focus": "main" }                           這個元素(容器連同它包住的全部)亮起來,其他變淡;"focus": false 恢復
//   { "anatomy": "title" }                        把這個元素拆開標示:開頭標籤、內容、結尾標籤(void 元素標「沒有結尾標籤」);"anatomy": false 收起
//   { "wrap": ["photo", "add"], "into": { "id": "card", "tag": "div" } }
//                                                 把同一層、相鄰的幾個元素(從第一個到最後一個)包進一個新的容器;容器的方框淡入
//   { "unwrap": "card" }                          拆掉容器:裡面的元素回到容器原本那一層,方框淡出
//
// 目標:window、tree、node:<id>(整個元素,容器含方框)、open:<id>(開頭標籤)、text:<id>(內容)、close:<id>(結尾標籤)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

export interface DomNode {
  id: string
  tag: string
  text?: string
  void?: boolean
  children?: DomNode[]
}
interface Props {
  nodes?: DomNode[]
  grown?: boolean
  look?: 'clean' | 'kids'
}
interface State {
  tree: DomNode[]
  /** 已經長出來的元素數(由上往下的順序) */
  shown: number
  focus: string | null
  anatomy: string | null
}
type Kind = 'grow' | 'focus' | 'anatomy' | 'wrap' | 'unwrap'
type Step = CommonStepFields & {
  grow?: true | string
  focus?: string | false
  anatomy?: string | false
  wrap?: string[]
  into?: { id: string; tag: string }
  unwrap?: string
}
type Target = 'window' | 'tree' | `node:${string}` | `open:${string}` | `text:${string}` | `close:${string}`

const KINDS: readonly Kind[] = ['grow', 'focus', 'anatomy', 'wrap', 'unwrap']
const GROW_MS = 420 // 每長出一個元素
const FOCUS_MS = 500
const ANATOMY_MS = 900
const WRAP_MS = 900

/** 元素的種類決定顏色:容器、文字、媒體、可以操作的 */
const KIND_OF: Record<string, 'box' | 'text' | 'media' | 'action'> = {
  html: 'box', body: 'box', main: 'box', header: 'box', footer: 'box', nav: 'box', section: 'box', article: 'box', div: 'box', ul: 'box', ol: 'box', form: 'box',
  h1: 'text', h2: 'text', h3: 'text', p: 'text', span: 'text', li: 'text', strong: 'text', label: 'text',
  img: 'media', video: 'media', audio: 'media', iframe: 'media',
  button: 'action', a: 'action', input: 'action', select: 'action', textarea: 'action',
}

/** 由上往下的順序(先自己、再子元素),以及每個元素最後一個子孫的位置(容器的結尾標籤在它之後出現) */
function flatten(nodes: DomNode[]): { order: DomNode[]; lastOf: Map<string, number> } {
  const order: DomNode[] = []
  const lastOf = new Map<string, number>()
  const walk = (list: DomNode[]) => {
    for (const n of list) {
      order.push(n)
      if (n.children?.length) walk(n.children)
      lastOf.set(n.id, order.length - 1)
    }
  }
  walk(nodes)
  return { order, lastOf }
}

function check(nodes: unknown): DomNode[] {
  if (!Array.isArray(nodes) || !nodes.length) throw new Error('dom-tree 的 props.nodes 要列出元素')
  const ids = new Set<string>()
  const walk = (list: DomNode[]) => {
    for (const n of list) {
      if (!n || typeof n.id !== 'string' || typeof n.tag !== 'string' || !n.id || !n.tag) throw new Error('dom-tree:每個元素都要有 id 與 tag')
      if (ids.has(n.id)) throw new Error(`dom-tree:id「${n.id}」重複了`)
      ids.add(n.id)
      if (n.void && (n.children?.length || n.text)) throw new Error(`dom-tree:「${n.id}」是 void 元素,不能有內容或子元素`)
      if (n.children?.length && n.text) throw new Error(`dom-tree:「${n.id}」有子元素時不寫 text`)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes as DomNode[])
  return nodes as DomNode[]
}

/** 找到 id 所在的那一層(陣列)與位置 */
function locate(list: DomNode[], id: string): { list: DomNode[]; index: number } | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { list, index: i }
    const inner = list[i].children ? locate(list[i].children!, id) : null
    if (inner) return inner
  }
  return null
}
const clone = (nodes: DomNode[]): DomNode[] => JSON.parse(JSON.stringify(nodes)) as DomNode[]

function wrapped(tree: DomNode[], ids: string[], into: { id: string; tag: string }): DomNode[] {
  const next = clone(tree)
  const first = locate(next, ids[0])
  const last = locate(next, ids[ids.length - 1])
  if (!first || !last) throw new Error(`wrap:找不到元素「${!first ? ids[0] : ids[ids.length - 1]}」`)
  if (first.list !== last.list || last.index < first.index) throw new Error('wrap:要包的元素必須在同一層,第一個寫在前面')
  const kids = first.list.splice(first.index, last.index - first.index + 1, { id: into.id, tag: into.tag, children: [] })
  first.list[first.index].children = kids
  return next
}

function unwrapped(tree: DomNode[], id: string): DomNode[] {
  const next = clone(tree)
  const at = locate(next, id)
  if (!at) throw new Error(`unwrap:找不到元素「${id}」`)
  const box = at.list[at.index]
  if (!box.children?.length) throw new Error(`unwrap:「${id}」沒有包住任何元素`)
  at.list.splice(at.index, 1, ...box.children)
  return next
}

/** 結構的指紋:元素與它們的層次改變時才重建畫面 */
const shapeOf = (nodes: DomNode[]): string => nodes.map((n) => `${n.id}${n.children ? `(${shapeOf(n.children)})` : ''}`).join(',')

const actor = defineActor<Kind, Step, Props, State, Target>({
  name: 'dom-tree',
  kinds: KINDS,

  init(props) {
    const tree = clone(check(props.nodes))
    return { tree, shown: props.grown ? flatten(tree).order.length : 1, focus: null, anatomy: null }
  },

  apply(st, kind, s) {
    const { order } = flatten(st.tree)
    const has = (id: unknown) => typeof id === 'string' && order.some((n) => n.id === id)
    switch (kind) {
      case 'grow': {
        if (s.grow === true) return { ...st, shown: order.length }
        if (!has(s.grow)) throw new Error(`grow:找不到元素「${String(s.grow)}」`)
        return { ...st, shown: Math.max(st.shown, order.findIndex((n) => n.id === s.grow) + 1) }
      }
      case 'focus': {
        if (s.focus === false) return { ...st, focus: null }
        if (!has(s.focus)) throw new Error(`focus:找不到元素「${String(s.focus)}」`)
        return { ...st, focus: s.focus as string }
      }
      case 'anatomy': {
        if (s.anatomy === false) return { ...st, anatomy: null }
        const n = order.find((x) => x.id === s.anatomy)
        if (!n) throw new Error(`anatomy:找不到元素「${String(s.anatomy)}」`)
        if (n.children?.length) throw new Error(`anatomy:「${n.id}」是容器,拆開標示只用在沒有子元素的元素`)
        return { ...st, anatomy: n.id }
      }
      case 'wrap': {
        if (!Array.isArray(s.wrap) || !s.wrap.length || !s.into?.id || !s.into?.tag) throw new Error('wrap 要寫要包的元素(陣列)與 into: { id, tag }')
        if (has(s.into.id)) throw new Error(`wrap:id「${s.into.id}」已經有了`)
        if (st.shown < order.length) throw new Error('wrap:要先把元素都長出來(grow)')
        const tree = wrapped(st.tree, s.wrap, s.into)
        return { ...st, tree, shown: flatten(tree).order.length, focus: null, anatomy: null }
      }
      case 'unwrap': {
        if (typeof s.unwrap !== 'string') throw new Error('unwrap 要寫容器的 id')
        if (st.shown < order.length) throw new Error('unwrap:要先把元素都長出來(grow)')
        const tree = unwrapped(st.tree, s.unwrap)
        return { ...st, tree, shown: flatten(tree).order.length, focus: null, anatomy: null }
      }
    }
    throw new Error(`dom-tree 不會「${kind}」`)
  },

  duration(kind, step, _props, prev) {
    if (kind === 'focus') return FOCUS_MS
    if (kind === 'anatomy') return ANATOMY_MS
    if (kind === 'wrap' || kind === 'unwrap') return WRAP_MS
    const order = prev ? flatten(prev.tree).order : []
    const from = prev?.shown ?? 1
    const to = step.grow === true ? order.length : order.findIndex((n) => n.id === step.grow) + 1
    return Math.max(1, to - from) * GROW_MS + 200
  },

  autoFocus(kind, step) {
    if (kind === 'focus' && typeof step.focus === 'string') return `node:${step.focus}`
    if (kind === 'anatomy' && typeof step.anatomy === 'string') return `node:${step.anatomy}`
    if (kind === 'wrap' && step.into?.id) return `node:${step.into.id}`
    return 'tree'
  },

  mount(root, props) {
    check(props.nodes)
    if (props.look && props.look !== 'clean' && props.look !== 'kids') throw new Error('dom-tree 的 look 只能是 clean 或 kids')
    root.classList.add('A-dom-tree')
    root.dataset.look = props.look ?? 'clean'
    root.innerHTML = `<div class="dt-tree"></div>`
    const tree = root.querySelector<HTMLElement>('.dt-tree')!
    const esc = kit.esc
    const html = (list: DomNode[]): string =>
      list
        .map((n) => {
          const kind = KIND_OF[n.tag] ?? 'text'
          const open = `<code class="dt-tag dt-open">&lt;${esc(n.tag)}&gt;</code>`
          const close = `<code class="dt-tag dt-close">&lt;/${esc(n.tag)}&gt;</code>`
          if (n.children) {
            return `<div class="dt-node dt-box" data-id="${esc(n.id)}" data-kind="${kind}">
              <div class="dt-head">${open}</div>
              <div class="dt-kids">${html(n.children)}</div>
              <div class="dt-foot">${close}</div>
            </div>`
          }
          // 拆開標示的說明(dt-cap)放在每個部分的正下方
          const part = (inner: string, cap: string, extra = '') => `<span class="dt-part">${inner}<span class="dt-cap${extra}">${cap}</span></span>`
          const line = n.void
            ? part(open, '只有一個標籤') + `<span class="dt-part dt-void-note"><span class="dt-cap dt-cap-void">沒有結尾標籤，不能包東西</span></span>`
            : part(open, '開頭標籤') + part(`<span class="dt-text">${esc(n.text ?? '')}</span>`, '內容', ' dt-cap-text') + part(close, '結尾標籤')
          return `<div class="dt-node dt-leaf" data-id="${esc(n.id)}" data-kind="${kind}"${n.void ? ' data-void="true"' : ''}>
            <div class="dt-line">${line}</div>
          </div>`
        })
        .join('')

    // 目前畫的是哪一個結構;結構改變(wrap、unwrap)時整棵重建
    let shape = ''
    let order: DomNode[] = []
    let lastOf = new Map<string, number>()
    const el = new Map<string, HTMLElement>()
    function build(nodes: DomNode[]): void {
      const s = shapeOf(nodes)
      if (s === shape) return
      shape = s
      ;({ order, lastOf } = flatten(nodes))
      tree.innerHTML = html(nodes)
      el.clear()
      for (const n of order) el.set(n.id, tree.querySelector<HTMLElement>(`.dt-node[data-id="${CSS.escape(n.id)}"]`)!)
    }
    const attr = (node: HTMLElement, name: string, on: boolean) => {
      if (on) node.setAttribute(name, 'true')
      else node.removeAttribute(name)
    }

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = view.ev && KINDS.includes(view.ev.kind as Kind) ? view.ev : null
        const st = view.ev?.kind === 'hide' ? view.prev : view.state
        const from = view.prev
        const p = ev ? kit.ease.inOutCubic(kit.progress(ev.local, 0, ev.kind === 'focus' ? FOCUS_MS : WRAP_MS)) : 1

        // 拆容器的過程中先畫拆之前的樣子(方框淡出),拆完才換成新的結構
        const unwrapping = ev?.kind === 'unwrap' && p < 1
        build(unwrapping ? from.tree : st.tree)
        const boxFade = ev?.kind === 'wrap' ? { id: (ev.step as Step).into?.id, o: p } : unwrapping ? { id: (ev!.step as Step).unwrap, o: 1 - p } : null

        // 長出來:長到第幾個(含小數,最新的那個淡入);容器的結尾標籤在最後一個子孫出現後才出現
        let shown = st.shown
        if (ev?.kind === 'grow') shown = Math.min(st.shown, from.shown + Math.max(0, ev.local - 100) / GROW_MS)
        order.forEach((n, i) => {
          const node = el.get(n.id)!
          const o = kit.clamp(shown - i)
          kit.setIf(node, 'display', o > 0 ? '' : 'none')
          const head = node.querySelector<HTMLElement>(':scope > .dt-head, :scope > .dt-line')
          if (head) kit.css(head, { opacity: o.toFixed(3), transform: `translateX(calc(${((1 - o) * -16).toFixed(1)} * var(--px)))` })
          const foot = node.querySelector<HTMLElement>(':scope > .dt-foot')
          if (foot) kit.setIf(foot, 'opacity', kit.clamp(shown - lastOf.get(n.id)! - 0.4).toFixed(3))
          // 包進/拆開的容器:只有方框、開頭與結尾標籤淡入淡出,裡面的元素一直看得到
          if (boxFade && boxFade.id === n.id) {
            const o = boxFade.o.toFixed(3)
            if (head) kit.setIf(head, 'opacity', o)
            if (foot) kit.setIf(foot, 'opacity', o)
            node.style.setProperty('--box', o)
          } else {
            node.style.removeProperty('--box')
          }
        })

        // 聚焦:選到的元素(含它包住的)亮,其他淡
        const focus = st.focus
        attr(root, 'data-focusing', !!focus || (ev?.kind === 'focus' && !!from.focus))
        for (const n of order) attr(el.get(n.id)!, 'data-focus', focus === n.id || (!focus && ev?.kind === 'focus' && from.focus === n.id))
        // 只有 focus 這一步會漸變;聚焦中的其他動作(grow、anatomy)維持淡的樣子
        const fp = ev?.kind === 'focus' ? p : 1
        const dim = focus ? 1 - 0.65 * fp : ev?.kind === 'focus' && from.focus ? 0.35 + 0.65 * fp : 1
        tree.style.setProperty('--dim', dim.toFixed(3))

        // 拆開標示:開頭標籤、內容、結尾標籤依序出現說明
        for (const n of order) {
          const node = el.get(n.id)!
          const on = st.anatomy === n.id
          attr(node, 'data-anatomy', on)
          if (!on) continue
          const t = ev?.kind === 'anatomy' ? ev.local : Infinity
          node.querySelectorAll<HTMLElement>('.dt-cap').forEach((cap, i) => kit.setIf(cap, 'opacity', kit.progress(t, 150 + i * 220, 260).toFixed(3)))
        }
      },

      target(name) {
        if (name === 'window') return root
        if (name === 'tree') return tree
        const m = /^(node|open|text|close):(.+)$/.exec(name)
        if (!m) return null
        const node = el.get(m[2])
        if (!node) return null
        if (m[1] === 'node') return node
        const own = node.querySelector<HTMLElement>(':scope > .dt-head, :scope > .dt-line')
        if (m[1] === 'open') return own?.querySelector<HTMLElement>('.dt-open') ?? null
        if (m[1] === 'text') return own?.querySelector<HTMLElement>('.dt-text') ?? null
        return node.querySelector<HTMLElement>(':scope > .dt-foot .dt-close, :scope > .dt-line .dt-close')
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
