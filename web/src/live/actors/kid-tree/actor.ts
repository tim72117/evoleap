// 演員 kid-tree:兒童網頁課 0.2「網頁是一棵樹」。左邊是卡通網頁,右邊是橫向的樹狀圖(根在左、往右長,同一層由上往下排,
// 順序和網頁畫面的上下一樣;盒子裡的節點往右縮一格)。瀏覽器照樹由上往下一個一個節點畫出網頁;節點換位置,網頁跟著重畫。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
// 孩子拖節點的互動在兒童版播放器(web/src/kids/KidsPlayer.tsx 的 interact.drag 與 kids/drag.ts),演員只負責畫與推算狀態。
//
// props(登場設定):
//   title    網址列上的網站名稱
//   nodes    網頁的樹,由上到下:[{ "id": "h1", "text": "小花的家" }, { "id": "card", "children": [{ "id": "img", "text": "🐱" }, …] }, …]
//            兒童版:id 是 h1、img、p、button(網頁上的東西)或 card(名片盒,可以裝東西);每個 id 只能出現一次
//            成人版(look: "clean"):另外寫 tag(h1、h2、p、img、button、a、li 或容器 div、section、main、ul、header、footer、nav、article),
//            id 自己取,例如 { "id": "buy", "tag": "button", "text": "加入購物車" };沒寫 tag 就當作 tag 和 id 一樣
//   look     樣式:kids(預設,兒童課的卡通樣式)或 clean(成人課:網頁像一般網站、樹上標出 <標籤>,顏色和 dom-tree 一致)
//   only     "tree":只顯示樹(不顯示左邊的網頁),例如放在真的瀏覽器旁邊當側欄;網頁照樣在狀態裡,只是不畫出來
//            "page":只顯示網頁(外框和瀏覽器演員一樣),例如靜態互動時網頁放中間、樹放在旁邊的側欄(stage.split)
//   drawn    一開始網頁畫好了沒,預設 false(空白網頁,用 draw 畫出來)
//   grown    一開始樹長好了沒,預設和 drawn 一樣(沒長好時樹只有樹根,用 grow 長出來)
//   goals    拖拉任務(選用):[{ "id": "img-top", "label": "把圖片拉到最上面", "first": "img" }]
//            條件寫一種:first(最上面是它)、before: [甲, 乙](甲畫在乙前面)、inside: [甲, 盒子](甲在盒子裡面,含更深層)、
//            parent: [甲, 盒子](甲直接在盒子底下;盒子寫 root 就是「移到最外層」)。
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
//   { "anatomy": "title" }                        (成人版)把節點拆開標示:開頭標籤、內容、結尾標籤;img 只有一個標籤;
//                                                 容器在它的子節點下面多一列結尾標籤(例如 </main>)。節點亮起來、其他變淡;"anatomy": false 收起
//   { "wrap": ["photo", "add"], "into": { "id": "card", "tag": "div" } }
//                                                 把同一層、相鄰的幾個節點(從第一個到最後一個)包進一個新的容器;容器淡入,其他節點滑到新位置
//   { "unwrap": "card" }                          拆掉容器:裡面的節點回到容器原本那一層
//   { "mark": "photo" }                           把節點標成亮起來(可以同時好幾個,其他節點不變淡);再做一次就取消。
//                                                 用在「網頁上點開了哪些東西」:點開幾個就亮幾個,收回哪個就暗哪個
//   { "fade": "card" }                            把節點標成「藏起來了」(虛線、變淡,容器連同裡面的節點);再做一次就恢復。
//                                                 網頁上的東西不跟著變(要藏網頁的話,由網頁自己處理,例如瀏覽器演員的 click)
//
// 目標:window、page、tree、goals、node:<id>(樹上的節點,含 node:root)、part:<id>(網頁上的東西)、slot:<parent>:<index>(拖放的位置)、
//      open:<id>(節點上的開頭標籤)、text:<id>(節點上的內容)、close:<id>(結尾標籤,anatomy 拆開時才看得到)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type Kind = 'grow' | 'draw' | 'put' | 'inspect' | 'check' | 'anatomy' | 'wrap' | 'unwrap' | 'fade' | 'mark'
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
  anatomy?: string | false
  wrap?: [string, string]
  into?: { id: string; tag: string }
  unwrap?: string
  fade?: string
  mark?: string
}
interface PropNode {
  id: string
  /** 標籤(成人版);沒寫就和 id 一樣 */
  tag?: string
  text?: string
  children?: PropNode[]
}
export interface Goal {
  id: string
  label: string
  first?: string
  before?: [string, string]
  inside?: [string, string]
  parent?: [string, string]
}
interface Props {
  look?: 'kids' | 'clean'
  /** "tree":只顯示樹;"page":只顯示網頁 */
  only?: 'tree' | 'page'
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
  /** 每個節點的標籤與網頁上的字(拖曳時的無障礙名稱用) */
  labels: Record<string, string>
  /** anatomy 拆開標示的節點 */
  anatomy: string | null
  /** wrap 包進來的新容器:id → 標籤 */
  boxes: Record<string, string>
  /** fade 標成藏起來的節點 */
  faded: string[]
  /** mark 標成亮起來的節點 */
  marked: string[]
}
type Target = 'window' | 'page' | 'tree' | 'goals' | `node:${string}` | `part:${string}` | `slot:${string}` | `open:${string}` | `text:${string}` | `close:${string}`

const KINDS: readonly Kind[] = ['grow', 'draw', 'put', 'inspect', 'check', 'anatomy', 'wrap', 'unwrap', 'fade', 'mark']

/** 每種節點:中文名稱、樹上的小圖示、顏色(和 0.1 的積木一致,web/src/kids/tags.ts) */
const KIND_OF: Record<string, { name: string; icon: string; color: string; shade: string; box?: true }> = {
  h1: { name: '標題', icon: '🔤', color: '#f6a03c', shade: '#9a4a00' },
  img: { name: '圖片', icon: '🖼️', color: '#4fb3e8', shade: '#155f8a' },
  p: { name: '文字', icon: '📝', color: '#5cc477', shade: '#23703a' },
  button: { name: '按鈕', icon: '👆', color: '#b48af0', shade: '#5b2a9e' },
  card: { name: '名片盒', icon: '📦', color: '#f2c94c', shade: '#8a6a00', box: true },
}
/** 成人版(look: clean)的標籤:種類決定顏色(和 dom-tree、網頁透視畫面一致:容器藍、文字綠、媒體橘、可以操作的紫) */
const CLEAN_KIND: Record<string, 'box' | 'text' | 'media' | 'action'> = {
  div: 'box', section: 'box', main: 'box', ul: 'box', header: 'box', footer: 'box', nav: 'box', article: 'box',
  h1: 'text', h2: 'text', p: 'text', li: 'text',
  img: 'media',
  button: 'action', a: 'action',
}
const CLEAN_COLOR: Record<string, [string, string]> = {
  box: ['#4f6bed', '#2f45b8'],
  text: ['#0f9d74', '#08654a'],
  media: ['#e07b39', '#9a4a12'],
  action: ['#a855f7', '#6b21a8'],
}
/** 這個標籤是不是容器(可以放東西):兒童版只有 card,成人版是 div、section 這些 */
const boxTag = (tag: string) => !!KIND_OF[tag]?.box || CLEAN_KIND[tag] === 'box'

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
/** 樹枝離這一層縮排起點多遠(設計像素 --px);每層縮排是 CSS 的 --indent */
const BRANCH = 34
/** 樹長出一個節點的時間 */
const GROW_MS = 450
const MOVE_MS = 900
const INSPECT_MS = 900
const CHECK_MS = 1200
const ANATOMY_MS = 700
const FADE_MS = 300
/** 會改變樹的結構、節點要滑到新位置的動作 */
const RESHAPE: readonly Kind[] = ['put', 'wrap', 'unwrap']
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
  if (g.parent) return parentOf(kids, g.parent[0]) === g.parent[1]
  return false
}

function nodesOf(props: Props) {
  const texts: Record<string, string> = {}
  const tags: Record<string, string> = {}
  const kids: Record<string, string[]> = { root: [] }
  const seen = new Set<string>()
  const clean = props.look === 'clean'
  const known = clean ? CLEAN_KIND : KIND_OF
  const add = (parent: string, list: PropNode[]) => {
    for (const n of list) {
      const tag = n.tag ?? n.id
      if (!known[tag]) throw new Error(`nodes:不認得的${clean ? '標籤' : '節點'}「${tag}」,目前只有 ${Object.keys(known).join('、')}`)
      if (n.id === 'root') throw new Error('nodes:root 是樹根,不能當作節點的 id')
      if (seen.has(n.id)) throw new Error(`nodes:「${n.id}」只能出現一次`)
      seen.add(n.id)
      tags[n.id] = tag
      kids[parent].push(n.id)
      if (boxTag(tag)) {
        kids[n.id] = []
        add(n.id, n.children ?? [])
      } else texts[n.id] = n.text ?? ''
    }
  }
  add('root', props.nodes ?? DEFAULT_NODES)
  return { texts, tags, kids }
}

function looks(st: TreeState, id: string): { on: number; dim: number; bad: number } {
  const base = looksOf(st, id)
  // mark 亮起來的節點:不管其他狀態都亮(可以同時好幾個)
  return (st.marked ?? []).includes(id) ? { ...base, on: 1, dim: 0 } : base
}
function looksOf(st: TreeState, id: string): { on: number; dim: number; bad: number } {
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
  fixedSize: true,

  init(props) {
    const { kids, tags, texts } = nodesOf(props)
    for (const g of props.goals ?? []) {
      const ids = [g.first, ...(g.before ?? []), ...(g.inside ?? []), ...(g.parent ?? [])].filter(Boolean) as string[]
      if (!ids.length) throw new Error(`goals:「${g.id}」要寫 first、before、inside 或 parent`)
      for (const id of ids) if (!tags[id] && !(id === 'root' && g.parent?.[1] === 'root')) throw new Error(`goals:「${g.id}」不認得「${id}」`)
    }
    const achieved = (props.goals ?? []).filter((g) => met(g, kids)).map((g) => g.id)
    const all = drawOrder(kids).length
    // 容器沒有自己的字:用裡面第一段文字(圖片以外)區分,例如「<div> 手沖 NT$ 150」
    const firstText = (id: string): string => {
      for (const k of kids[id] ?? []) {
        const t = kids[k] ? firstText(k) : tags[k] !== 'img' ? (texts[k] ?? '') : ''
        if (t) return t
      }
      return ''
    }
    const labels = Object.fromEntries(
      Object.keys(tags).map((id) => {
        if (props.look !== 'clean') return [id, KIND_OF[tags[id]]?.name ?? id]
        const t = kids[id] ? firstText(id) : (texts[id] ?? '')
        return [id, `<${tags[id]}>${t ? ` ${t}` : ''}`]
      }),
    )
    return { kids, drawn: props.drawn ? all : 0, grown: props.grown ?? !!props.drawn, focus: null, verdict: null, goals: props.goals ?? [], achieved, labels, anatomy: null, boxes: {}, faded: [], marked: [] }
  },

  apply(st0, kind, s) {
    // anatomy 以外的動作都收起拆開的標籤
    const st = kind === 'anatomy' ? st0 : { ...st0, anatomy: null }
    if (kind === 'grow') return { ...st, grown: true, focus: null, verdict: null }
    if (kind === 'mark') {
      const id = String(s.mark)
      if (!(id === 'root' || parentOf(st.kids, id))) throw new Error(`mark:樹上沒有「${id}」`)
      const marked = st.marked ?? []
      return { ...st, marked: marked.includes(id) ? marked.filter((x) => x !== id) : [...marked, id] }
    }
    if (kind === 'fade') {
      const id = String(s.fade)
      if (!parentOf(st.kids, id)) throw new Error(`fade:樹上沒有「${id}」`)
      const faded = st.faded ?? []
      return { ...st, faded: faded.includes(id) ? faded.filter((x) => x !== id) : [...faded, id] }
    }
    if (kind === 'anatomy') {
      if (s.anatomy === false) return { ...st, anatomy: null, focus: null, verdict: null }
      const id = String(s.anatomy)
      if (!parentOf(st.kids, id)) throw new Error(`anatomy:樹上沒有「${id}」`)
      return { ...st, anatomy: id, focus: id, verdict: null }
    }
    if (kind === 'wrap' || kind === 'unwrap') {
      if (!st.grown) throw new Error(`${kind}:先用 grow 把樹長出來`)
      const all = drawOrder(st.kids).length
      const done = (kids: Record<string, string[]>, extra: Partial<TreeState>): TreeState => {
        const n = drawOrder(kids).length
        // 網頁畫好了的話,新的樹也算畫好
        const drawn = st.drawn >= all ? n : Math.min(st.drawn, n)
        const achieved = [...st.achieved, ...st.goals.filter((g) => !st.achieved.includes(g.id) && met(g, kids)).map((g) => g.id)]
        return { ...st, ...extra, kids, drawn, focus: null, verdict: null, achieved }
      }
      if (kind === 'unwrap') {
        const id = String(s.unwrap)
        const p = parentOf(st.kids, id)
        if (!p || !st.kids[id]) throw new Error(`unwrap:「${id}」不是樹上的容器`)
        const { [id]: inner, ...rest } = st.kids
        rest[p] = rest[p].flatMap((x) => (x === id ? inner : [x]))
        const { [id]: _gone, ...boxes } = st.boxes
        void _gone
        const { [id]: _label, ...labels } = st.labels
        void _label
        return done(rest, { boxes, labels })
      }
      const [a, b] = s.wrap ?? []
      const into = s.into
      if (!a || !b || !into?.id || !into.tag) throw new Error('wrap 要寫兩個節點和新容器,例如 { "wrap": ["photo", "add"], "into": { "id": "card", "tag": "div" } }')
      if (!boxTag(into.tag)) throw new Error(`wrap:「${into.tag}」不是容器的標籤`)
      if (into.id === 'root' || st.kids[into.id] || parentOf(st.kids, into.id)) throw new Error(`wrap:「${into.id}」已經在樹上了,新容器要換一個 id`)
      const p = parentOf(st.kids, a)
      if (!p || p !== parentOf(st.kids, b)) throw new Error(`wrap:「${a}」和「${b}」要在同一層`)
      const list = st.kids[p]
      const i = list.indexOf(a)
      const j = list.indexOf(b)
      if (i > j) throw new Error(`wrap:「${a}」要在「${b}」前面`)
      const kids = { ...st.kids, [p]: [...list.slice(0, i), into.id, ...list.slice(j + 1)], [into.id]: list.slice(i, j + 1) }
      return done(kids, { boxes: { ...st.boxes, [into.id]: into.tag }, labels: { ...st.labels, [into.id]: `<${into.tag}>` } })
    }
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
    if (!st.kids[to]) throw new Error(`put:「${to}」不是可以放東西的地方(root 或盒子)`)
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
    if (kind === 'wrap' || kind === 'unwrap') return MOVE_MS
    if (kind === 'anatomy') return ANATOMY_MS
    if (kind === 'fade') return FADE_MS
    if (kind === 'mark') return INSPECT_MS
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
    const { texts, tags } = nodesOf(props)
    const goals = props.goals ?? []
    const clean = props.look === 'clean'
    if (props.look && props.look !== 'kids' && props.look !== 'clean') throw new Error('kid-tree 的 look 只能是 kids 或 clean')
    root.classList.add('A-kid-tree')
    root.dataset.look = clean ? 'clean' : 'kids'
    if (props.only && props.only !== 'tree' && props.only !== 'page') throw new Error('kid-tree 的 only 只能是 tree 或 page')
    if (props.only) root.dataset.only = props.only
    const tagCode = (tag: string) => `<code class="kt-tag">&lt;${kit.esc(tag)}&gt;</code>`
    /** 結尾標籤(anatomy 拆開時才顯示);img 沒有 */
    const closeCode = (tag: string) => `<code class="kt-tag kt-close">&lt;/${kit.esc(tag)}&gt;</code>`
    /** 節點的顏色:兒童版照積木的顏色,成人版照標籤的種類 */
    const colorOf = (id: string): [string, string] | null => {
      const tag = tags[id]
      if (!tag) return null
      if (clean) return CLEAN_COLOR[CLEAN_KIND[tag]]
      const k = KIND_OF[tag]
      return k ? [k.color, k.shade] : null
    }
    root.innerHTML = `
      <div class="kt-scene">
        <div class="kt-pane kt-page-pane">
          <div class="kt-bar"><span class="kt-lights"><i></i><i></i><i></i></span><span class="kt-url">${kit.esc(props.title ?? (clean ? 'index.html' : '我的網頁'))}</span></div>
          <div class="kt-page"></div>
        </div>
        <div class="kt-pane kt-tree-pane">
          <p class="kt-label">${clean ? 'DOM 樹' : '網頁的樹狀圖'}</p>
          <div class="kt-tree"></div>
          <span class="kt-walker" aria-hidden="true">${clean ? '<i class="kt-walker-dot"></i>' : '🖌️'}<em></em></span>
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
      const tag = tags[id]
      if (tag === 'h1') return `<span class="kt-h1">${t}</span>`
      if (tag === 'h2') return `<span class="kt-h2">${t}</span>`
      if (tag === 'img') return `<span class="kt-photo">${t}</span>`
      if (tag === 'p') return `<span class="kt-text">${t}</span>`
      if (tag === 'li') return `<span class="kt-text kt-li">${t}</span>`
      if (tag === 'a') return `<span class="kt-link">${t}</span>`
      return `<span class="kt-btn">${t}</span>`
    }
    // 容器的名牌:兒童版寫中文名稱(名片盒),成人版寫標籤
    const boxLabel = (id: string) => (clean ? tagCode(tags[id]) : KIND_OF[tags[id]].name)
    const pageHtml = (kids: Record<string, string[]>, p = 'root'): string =>
      (kids[p] ?? [])
        .map((id) =>
          kids[id]
            ? `<div class="kt-part kt-box" data-id="${id}" data-tag="${kit.esc(tags[id])}"><span class="kt-box-label">${boxLabel(id)}</span>${pageHtml(kids, id)}</div>`
            : `<div class="kt-part" data-id="${id}" data-tag="${kit.esc(tags[id])}">${partHtml(id)}</div>`,
        )
        .join('')
    /** 樹上的節點:小字標出種類(說對名字),主體放網頁上實際的字或圖;盒子與樹根放圖示 */
    const chip = (id: string) => {
      if (id === 'root') {
        return clean
          ? `<span class="kt-node kt-node-root" data-id="root">${tagCode('body')}</span>`
          : `<span class="kt-node kt-node-root" data-id="root"><span class="kt-icon">🌳</span><span class="kt-val">網頁</span></span>`
      }
      const tag = tags[id]
      const raw = texts[id] ?? ''
      const short = kit.esc([...raw].length > 9 ? [...raw].slice(0, 8).join('') + '…' : raw)
      if (clean) {
        // 成人版:一行寫完,<標籤> 加上網頁上的字(容器只有標籤)
        const val = boxTag(tag) ? '' : tag === 'img' ? `<span class="kt-pic">${kit.esc(raw)}</span>` : `<span class="kt-val" data-kind="${kit.esc(tag)}">${short}</span>`
        const close = boxTag(tag) || tag === 'img' ? '' : closeCode(tag)
        return `<span class="kt-node" data-id="${id}">${tagCode(tag)}${val}${close}</span>`
      }
      const k = KIND_OF[tag]
      const val = k.box ? `<span class="kt-icon">${k.icon}</span>` : tag === 'img' ? `<span class="kt-pic">${kit.esc(raw)}</span>` : `<span class="kt-val" data-kind="${tag}">${short}</span>`
      return `<span class="kt-node" data-id="${id}"><small class="kt-kind">${k.name}</small>${val}</span>`
    }
    // 樹:一個節點一列,深度越深越往右;每個容器的每個位置有一條放置用的細縫(slot)。
    // 樹枝每一列自己畫:經過這一列的直線(上面的層還有後面的兄弟)、自己的轉角(├ 或 └)、盒子往下一層的起頭。
    // 每一段樹枝都標 data-to:它通往哪一個節點。長樹時這個節點長出來,通往它的那幾段才由上往下畫出來(見 render)
    const X = (level: number) => `calc(${level - 1} * var(--indent) + ${BRANCH} * var(--px))`
    const vline = (level: number, to: string, top = '0', bottom = '0') => `<i class="kt-v" data-to="${to}" style="left:${X(level)};top:${top};bottom:${bottom}"></i>`
    const treeHtml = (kids: Record<string, string[]>): string => {
      const first = kids.root?.[0]
      const rows: string[] = [`<div class="kt-row" data-depth="0">${first ? vline(1, first, '50%') : ''}${chip('root')}</div>`]
      // cont[level]:那一層的直線要往下延伸到哪一個兄弟(null = 那一層後面沒有兄弟了)
      const passingOf = (cont: (string | null)[], upto: number) => cont.slice(1, upto).map((to, k) => (to ? vline(k + 1, to) : '')).join('')
      const walk = (p: string, depth: number, cont: (string | null)[]) => {
        const list = kids[p] ?? []
        const passing = (upto: number) => passingOf(cont, upto)
        list.forEach((id, i) => {
          const next = list[i + 1] ?? null
          // 放置的縫:經過的直線,加上這一層通往這個節點的直線
          rows.push(`<div class="kt-slot" data-slot="${p}:${i}" style="--depth:${depth}">${passing(depth)}${vline(depth, id)}<b class="kt-slot-mark"></b></div>`)
          const firstKid = kids[id]?.[0]
          const childStart = firstKid ? vline(depth + 1, firstKid, '50%') : ''
          const elbow = `<i class="kt-elbow" data-to="${id}" style="left:${X(depth)};width:calc(var(--indent) - ${BRANCH} * var(--px))"></i>${next ? vline(depth, next, '50%') : ''}`
          rows.push(`<div class="kt-row" data-depth="${depth}" style="--depth:${depth}">${passing(depth)}${elbow}${childStart}${chip(id)}</div>`)
          if (kids[id]) {
            const inner = [...cont.slice(0, depth), next]
            walk(id, depth + 1, inner)
            // 容器的結尾標籤:子節點下面、和開頭標籤對齊的一列(anatomy 拆開時才顯示)
            if (clean) rows.push(`<div class="kt-row kt-close-row" data-close="${id}" style="--depth:${depth}">${passingOf(inner, depth + 1)}<span class="kt-node kt-node-close" data-close="${id}">${closeCode(tags[id])}</span></div>`)
          }
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
        const c = colorOf(el.dataset.id!)
        if (!c) continue
        el.style.setProperty('--c', c[0])
        el.style.setProperty('--d', c[1])
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

        // wrap 包進來的新容器:標籤登記進來,畫樹與網頁時才認得
        Object.assign(tags, from.boxes, to.boxes)
        // 樹與網頁的結構:移動進行到一半才換成新的樹(換的時候移動的那個彈一下)
        const moving = !!ev && RESHAPE.includes(ev.kind as Kind)
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
              kit.css(el, { clipPath: f < 1 || h <= 0 ? `inset(0 calc(100% - 24 * var(--px)) ${cut} 0)` : `inset(0 calc((100% - 24 * var(--px)) * ${(1 - h).toFixed(3)}) 0 0)` })
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
            kit.css(walker, { opacity: '1', left: `calc(${((left - pane.left) / k).toFixed(1)}px - 60 * var(--px))`, top: `calc(${((r.top - pane.top + r.height / 2) / k).toFixed(1)}px - 26 * var(--px))` })
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
            const movedId = ev.kind === 'put' ? (ev.step as Step).put : undefined
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

        // wrap:新容器(樹上的節點與網頁上的框)淡入
        if (ev?.kind === 'wrap') {
          const id = (ev.step as Step).into?.id ?? ''
          const a = kit.ease.inOutCubic(kit.progress(ev.local, 0, MOVE_MS)).toFixed(3)
          for (const el of [nodeEl(id), partEl(id)]) if (el) kit.css(el, { opacity: a })
        }

        // anatomy:拆開的節點顯示結尾標籤(容器是子節點下面那一列),淡入淡出
        const anatomyOf = (st: TreeState) => st.anatomy
        const ap = ev?.kind === 'anatomy' ? kit.ease.inOutCubic(kit.progress(ev.local, 0, ANATOMY_MS)) : 1
        for (const el of treeEl.querySelectorAll<HTMLElement>('.kt-node[data-id] .kt-close, .kt-close-row')) {
          const id = el.classList.contains('kt-close-row') ? el.dataset.close! : (el.closest<HTMLElement>('.kt-node')?.dataset.id ?? '')
          const a = kit.lerp(anatomyOf(from) === id ? 1 : 0, anatomyOf(to) === id ? 1 : 0, ap)
          kit.css(el, { display: a > 0 ? (el.classList.contains('kt-close-row') ? 'block' : 'inline-block') : 'none', opacity: a.toFixed(3) })
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

        // fade:藏起來的節點(容器連同裡面的節點)畫成虛線、變淡;這一步進行中淡入淡出
        const fadedOf = (st: TreeState) => (id: string) => (st.faded ?? []).some((f) => f === id || within(st.kids, id, f))
        const f0 = fadedOf(from)
        const f1 = fadedOf(to)
        const fp = ev?.kind === 'fade' ? kit.ease.inOutCubic(kit.progress(ev.local, 0, FADE_MS)) : 1
        for (const id of order) {
          const node = nodeEl(id)
          if (!node) continue
          const a = kit.lerp(f0(id) ? 1 : 0, f1(id) ? 1 : 0, fp)
          if (a > 0) node.dataset.faded = '1'
          else delete node.dataset.faded
          node.style.setProperty('--faded', a.toFixed(3))
        }

        // 任務:完成的打勾
        if (goalsEl) for (const li of goalsEl.querySelectorAll<HTMLElement>('li')) li.dataset.done = to.achieved.includes(li.dataset.goal!) ? '1' : '0'
      },

      target(name) {
        if (name === 'window') return root
        if (name === 'page') return pagePane
        if (name === 'tree') return treePane
        if (name === 'goals') return goalsEl
        const m = /^(node|part|slot|open|text|close):(.+)$/.exec(name)
        if (!m) return null
        if (m[1] === 'node') return nodeEl(m[2])
        if (m[1] === 'open') return nodeEl(m[2])?.querySelector<HTMLElement>('.kt-tag') ?? null
        if (m[1] === 'text') return nodeEl(m[2])?.querySelector<HTMLElement>('.kt-val, .kt-pic') ?? null
        if (m[1] === 'close') return treeEl.querySelector<HTMLElement>(`.kt-node-close[data-close="${m[2]}"]`) ?? nodeEl(m[2])?.querySelector<HTMLElement>('.kt-close') ?? null
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
