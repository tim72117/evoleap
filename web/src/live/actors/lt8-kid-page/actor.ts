// 演員 lt8-kid-page:兒童網頁課單元 1「HTML:用積木蓋網頁」的內容積木網頁(試做,第二批第 8 組)。
// 左邊是卡通網頁(可以有好幾頁,用連結切換),右邊是側欄:「網頁的積木」(每塊積木印中文名字,和網頁一起變)或「網站地圖」(頁和連結)。
// 積木有:大標題、小標題、段落、清單、編號清單、圖片(含替代文字)、連結,還有「擠在一起、還沒分好的字」。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。畫面只由時間決定,CSS 不用 animation/transition。
//
// props(登場設定,只描述起始狀態):
//   title   網址列上的網站名稱(只有一頁時用;多頁時每頁寫自己的 title)
//   items   只有一頁時的積木,由上到下(等於 pages: { "home": { "items": [...] } })
//   pages   多頁:{ "home": { "title": "小花的家", "items": [...] }, "album": { … } };start 是一開始在哪一頁(預設第一頁)
//   pool    還沒放上網頁的積木(側欄上方的「積木盒」),用 add 放到目前這一頁的最下面
//   tools   側欄上方可以選的積木種類(pick 選、use 套到網頁上的字),例如 ["h1", "h2", "p"]
//   cards   側欄上方可以選的說明卡(替代文字):[{ "id": "eat", "text": "小花在吃小魚乾" }];pick 選卡、use 套到圖片
//   side    側欄:stack(預設,網頁的積木)、map(網站地圖)、none(不要側欄)
//   labels  一開始就在網頁上的每塊東西掛名牌(積木名字),預設 false
//   broken  一開始圖片就載不出來,預設 false
//
// 積木(items、pool 的每一項;id 全部不能重複):
//   { "id": "c1", "kind": "raw", "text": "小花的一天", "want": "h1" }
//        還沒分好的字:相鄰的 raw 擠成一團小字;want 是正確的積木(use 判斷對錯)
//   { "id": "t", "kind": "h1", "text": "…" }   大標題;h2 小標題;p 段落
//   { "id": "likes", "kind": "ul", "items": ["小魚乾", "紙箱"], "loose": true, "lead": "小花喜歡" }
//        清單(ol 是編號清單)。loose:一開始是一長串句子(lead + 項目用「、」連起來),用 pull 一項一項拉成清單;
//        ordered: true 要照 items 的順序拉(拉錯會搖一搖、不會拉出來);mix 是句子裡項目的排列,例如 [2, 0, 3, 1]
//   { "id": "photo", "kind": "img", "pic": "🐱📦", "alt": "小花在紙箱裡睡午覺", "want": "box" }
//        圖片:pic 是畫面(emoji);alt 是替代文字;want 是正確的說明卡 id
//   { "id": "link", "kind": "a", "text": "看小花的相簿", "to": "album" }   連結,to 是要去的頁
//
// 動作(寫錯的 id 載入就報錯並指出第幾步;孩子會重複點的動作重複做不會報錯):
//   { "turn": "c1", "into": "h1" }        把一塊換成另一種積木(raw、h1、h2、p;清單在 ul、ol 之間換);會跳一下
//   { "pull": "likes", "entry": 1 }       把一長串裡的第 1 項(從 0 算)拉出來排進清單;"entry": "all" 把剩下的照順序全部拉出來
//   { "swap": "feed", "a": 0, "b": 1 }    清單裡第 a 個和第 b 個位置對調
//   { "add": "name" }                     把積木盒裡的一塊放到目前這一頁的最下面
//   { "pick": "h2" }                      選側欄上方的一塊積木或一張說明卡(選中的亮起來)
//   { "use": "c4" }                       把選好的積木或說明卡套到網頁上的這一塊:對了打勾,錯了變紅搖一搖;還沒選就提示先選。
//                                         用對的就鎖住(再點不會變),記在狀態的 right
//   { "write": "photo", "text": "…" }     逐字寫上新的字(圖片寫的是替代文字;空字串清掉)
//   { "follow": "link" }                  點連結,跑到它的 to 那一頁(網址列跟著換);去過的頁記在狀態的 visited
//   { "labels": true }                    網頁上每塊東西掛上積木名牌(false 拿下)
//   { "broken": true }                    圖片載不出來:只剩虛線框和替代文字(沒有替代文字就只有問號);false 恢復
//   { "readout": true }                   「念給看不到的人聽」:網頁下方出現電腦照順序念出來的字(false 關掉)
//   { "inspect": "c1" }                   這一塊和側欄的積木一起亮起來、其他變暗;false 恢復
//   { "mark": "part:likes", "ok": false } 答題的對錯:目標變綠(ok 預設 true)或變紅搖一搖;"mark": false 清掉
//   turn、pull、add、pick、use、follow 加 "tap": true:先用虛擬滑鼠點一下(示範)
//   狀態的 done:孩子做成的事(turn:id、pull:id:n、add:id、use:id、go:頁),不重複,給子腳本的 until 數
//
// 目標:window、page(網頁內容)、side(側欄)、tools(積木盒)、readout、
//      part:<id>(網頁上的一塊)、entry:<id>:<n>(清單或一長串裡的第 n 項)、block:<id>(側欄的積木)、
//      tool:<種類或說明卡 id>、pool:<id>(積木盒裡還沒放的)、node:<頁>(網站地圖上的頁)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type Kind = 'turn' | 'pull' | 'swap' | 'add' | 'pick' | 'use' | 'write' | 'follow' | 'labels' | 'broken' | 'readout' | 'inspect' | 'mark'
type BlockKind = 'raw' | 'h1' | 'h2' | 'p' | 'ul' | 'ol' | 'img' | 'a'
type Step = CommonStepFields & {
  turn?: string
  into?: BlockKind
  pull?: string
  entry?: number | 'all'
  swap?: string
  a?: number
  b?: number
  add?: string
  pick?: string
  use?: string
  write?: string
  text?: string
  follow?: string
  labels?: boolean
  broken?: boolean
  readout?: boolean
  inspect?: string | false
  mark?: string | false
  ok?: boolean
  tap?: boolean
}
interface Item {
  id: string
  kind: BlockKind
  text?: string
  items?: string[]
  lead?: string
  loose?: boolean
  ordered?: boolean
  mix?: number[]
  pic?: string
  alt?: string
  to?: string
  want?: string
}
interface Page {
  title?: string
  items: Item[]
}
interface Card {
  id: string
  text: string
}
interface Props {
  title?: string
  items?: Item[]
  pages?: Record<string, Page>
  start?: string
  pool?: Item[]
  tools?: string[]
  cards?: Card[]
  side?: 'stack' | 'map' | 'none'
  labels?: boolean
  broken?: boolean
}
/** apply 用得到的固定資料(apply 拿不到 props,init 時放進狀態) */
interface Fixed {
  want?: string
  ordered?: boolean
  n?: number
  to?: string
}
interface State {
  page: string
  /** 每一頁由上到下的積木 id */
  order: Record<string, string[]>
  /** 積木盒裡還沒放的 */
  pool: string[]
  kinds: Record<string, BlockKind>
  /** 改過的字(圖片是替代文字) */
  texts: Record<string, string>
  /** 清單排出來的順序(項目的 index);loose 的清單一開始是空的 */
  seq: Record<string, number[]>
  fixed: Record<string, Fixed>
  cards: Record<string, string>
  tool: string | null
  labels: boolean
  broken: boolean
  readout: boolean
  focus: string | null
  mark: { key: string; ok: boolean } | null
  /** 提示(還沒選積木就點了網頁之類) */
  nag: string | null
  done: string[]
  right: string[]
  visited: string[]
}

const KINDS: readonly Kind[] = ['turn', 'pull', 'swap', 'add', 'pick', 'use', 'write', 'follow', 'labels', 'broken', 'readout', 'inspect', 'mark']
const BLOCK_KINDS: readonly BlockKind[] = ['raw', 'h1', 'h2', 'p', 'ul', 'ol', 'img', 'a']
const TEXT_KINDS: readonly BlockKind[] = ['raw', 'h1', 'h2', 'p']

/** 每種積木:中文名字、圖示、顏色(標題、圖片、段落和序章的積木同色) */
const NAMES: Record<BlockKind, { name: string; icon: string; color: string; shade: string }> = {
  raw: { name: '還沒分好', icon: '🌀', color: '#d9d2c7', shade: '#6b6156' },
  h1: { name: '大標題', icon: '🔤', color: '#f6a03c', shade: '#9a4a00' },
  h2: { name: '小標題', icon: '🔡', color: '#f7c548', shade: '#7a5d00' },
  p: { name: '段落', icon: '📝', color: '#5cc477', shade: '#23703a' },
  ul: { name: '清單', icon: '📋', color: '#ff9fb7', shade: '#a3274a' },
  ol: { name: '編號清單', icon: '🔢', color: '#f78fd0', shade: '#8f1f6e' },
  img: { name: '圖片', icon: '🖼️', color: '#4fb3e8', shade: '#155f8a' },
  a: { name: '連結', icon: '🔗', color: '#8f9bff', shade: '#323fa8' },
}
const isList = (k: BlockKind | undefined) => k === 'ul' || k === 'ol'
const isBlockKind = (x: unknown): x is BlockKind => typeof x === 'string' && (BLOCK_KINDS as readonly string[]).includes(x)

const TAP_AT = 750
const MS: Record<Kind, number> = { turn: 900, pull: 700, swap: 900, add: 800, pick: 450, use: 900, write: 400, follow: 1400, labels: 700, broken: 900, readout: 900, inspect: 800, mark: 900 }
const TYPE_CPS = 10
const TAPPABLE: readonly Kind[] = ['turn', 'pull', 'add', 'pick', 'use', 'follow']

function pagesOf(props: Props): Record<string, Page> {
  if (props.pages) return props.pages
  return { home: { title: props.title, items: props.items ?? [] } }
}
/** 所有積木(各頁與積木盒):id → 設定 */
function catalog(props: Props): Map<string, Item> {
  const all = new Map<string, Item>()
  const list = [...Object.values(pagesOf(props)).flatMap((p) => p.items ?? []), ...(props.pool ?? [])]
  for (const it of list) {
    if (!it.id) throw new Error('lt8-kid-page:每塊積木都要有 id')
    if (all.has(it.id)) throw new Error(`lt8-kid-page:積木「${it.id}」重複了`)
    if (!isBlockKind(it.kind)) throw new Error(`lt8-kid-page:積木「${it.id}」的 kind「${String(it.kind)}」不認得,只有 ${BLOCK_KINDS.join('、')}`)
    if (isList(it.kind) && !it.items?.length) throw new Error(`lt8-kid-page:清單「${it.id}」要寫 items`)
    if (it.mix && (it.mix.length !== it.items?.length || [...it.mix].sort((a, b) => a - b).some((x, i) => x !== i))) throw new Error(`lt8-kid-page:清單「${it.id}」的 mix 要把每一項的編號都排一次`)
    all.set(it.id, it)
  }
  return all
}
const CATALOGS = new WeakMap<Props, Map<string, Item>>()
const cat = (props: Props) => {
  let c = CATALOGS.get(props)
  if (!c) CATALOGS.set(props, (c = catalog(props)))
  return c
}

const addOnce = (list: string[], x: string) => (list.includes(x) ? list : [...list, x])

/** 某一塊目前顯示的字(圖片是替代文字) */
const textOf = (st: State, it: Item) => st.texts[it.id] ?? (it.kind === 'img' ? (it.alt ?? '') : (it.text ?? ''))

/** pull:把一長串裡的項目拉進清單(ordered 時要照順序) */
function pull(st: State, id: string, entry: Step['entry']): State {
  const f = st.fixed[id] ?? {}
  const n = f.n ?? 0
  const seq = st.seq[id] ?? []
  if (entry === 'all') {
    const rest = Array.from({ length: n }, (_, i) => i).filter((i) => !seq.includes(i))
    return { ...st, seq: { ...st.seq, [id]: [...seq, ...rest] }, done: rest.reduce((d, i) => addOnce(d, `pull:${id}:${i}`), st.done) }
  }
  if (typeof entry !== 'number' || entry < 0 || entry >= n) throw new Error(`pull:「${id}」沒有第 ${String(entry)} 項`)
  if (seq.includes(entry)) return st
  if (f.ordered && entry !== seq.length) return { ...st, mark: { key: `entry:${id}:${entry}`, ok: false }, nag: '還不是這一步' }
  return { ...st, seq: { ...st.seq, [id]: [...seq, entry] }, done: addOnce(st.done, `pull:${id}:${entry}`), mark: f.ordered ? { key: `entry:${id}:${entry}`, ok: true } : null }
}

/** 念給看不到的人聽:照網頁由上到下念出來 */
function readText(st: State, c: Map<string, Item>): string {
  return (st.order[st.page] ?? [])
    .map((id) => {
      const it = c.get(id)!
      const k = st.kinds[id]
      const t = shownText(st, it)
      if (k === 'raw') return t
      if (k === 'img') return t ? `圖片，${t}` : '圖片'
      if (isList(k)) return `${NAMES[k].name}，${(st.seq[id] ?? []).map((i) => it.items![i]).join('、')}`
      return `${NAMES[k].name}，${t}`
    })
    .filter(Boolean)
    .join('。')
}
/** 圖片套上說明卡時,texts 存的是 @card:<id>;換成卡片上的字 */
const shownText = (st: State, it: Item) => {
  const t = textOf(st, it)
  return t.startsWith('@card:') ? (st.cards[t.slice(6)] ?? '') : t
}

const actor = defineActor<Kind, Step, Props, State, string>({
  name: 'lt8-kid-page',
  kinds: KINDS,
  fixedSize: true,

  init(props) {
    const pages = pagesOf(props)
    const ids = Object.keys(pages)
    if (!ids.length) throw new Error('lt8-kid-page:要寫 items 或 pages')
    const c = cat(props)
    const start = props.start ?? ids[0]
    if (!pages[start]) throw new Error(`lt8-kid-page:start「${start}」不是 pages 裡的頁`)
    if (props.side && !['stack', 'map', 'none'].includes(props.side)) throw new Error('lt8-kid-page:side 只能是 stack、map、none')
    for (const t of props.tools ?? []) if (!isBlockKind(t)) throw new Error(`lt8-kid-page:tools 裡的「${t}」不是積木種類`)
    const kinds: Record<string, BlockKind> = {}
    const seq: Record<string, number[]> = {}
    const fixed: Record<string, Fixed> = {}
    for (const it of c.values()) {
      if (it.kind === 'a' && it.to && !pages[it.to]) throw new Error(`lt8-kid-page:連結「${it.id}」的 to「${it.to}」不是 pages 裡的頁`)
      kinds[it.id] = it.kind
      if (isList(it.kind)) seq[it.id] = it.loose ? [] : it.items!.map((_, i) => i)
      fixed[it.id] = { want: it.want, ordered: it.ordered, n: it.items?.length, to: it.to }
    }
    return {
      page: start,
      order: Object.fromEntries(ids.map((p) => [p, (pages[p].items ?? []).map((x) => x.id)])),
      pool: (props.pool ?? []).map((x) => x.id),
      kinds,
      texts: {},
      seq,
      fixed,
      cards: Object.fromEntries((props.cards ?? []).map((x) => [x.id, x.text])),
      tool: null,
      labels: !!props.labels,
      broken: !!props.broken,
      readout: false,
      focus: null,
      mark: null,
      nag: null,
      done: [],
      right: [],
      visited: [start],
    }
  },

  apply(st0, kind, s) {
    // 對錯的標記與提示只留到下一個動作
    const st: State = kind === 'mark' ? st0 : { ...st0, mark: null, nag: null }
    const need = (id: unknown, what: string): string => {
      if (typeof id !== 'string' || !(id in st.kinds)) throw new Error(`${what}:沒有「${String(id)}」這塊積木`)
      return id
    }
    if (kind === 'turn') {
      const id = need(s.turn, 'turn')
      const from = st.kinds[id]
      if (!isBlockKind(s.into)) throw new Error('turn 要寫 into')
      const ok = isList(from) ? isList(s.into) : TEXT_KINDS.includes(from) && TEXT_KINDS.includes(s.into)
      if (!ok) throw new Error(`turn:「${id}」不能換成 ${s.into}(字只能在 raw、h1、h2、p 之間換,清單在 ul、ol 之間換)`)
      return { ...st, kinds: { ...st.kinds, [id]: s.into }, done: from === 'raw' ? addOnce(st.done, `turn:${id}`) : st.done }
    }
    if (kind === 'pull') {
      const id = need(s.pull, 'pull')
      if (!isList(st.kinds[id])) throw new Error(`pull:「${id}」不是清單`)
      return pull(st, id, s.entry)
    }
    if (kind === 'swap') {
      const id = need(s.swap, 'swap')
      const seq = [...(st.seq[id] ?? [])]
      const a = s.a ?? -1
      const b = s.b ?? -1
      if (!(a >= 0 && a < seq.length && b >= 0 && b < seq.length)) throw new Error(`swap:「${id}」沒有第 ${a} 或第 ${b} 個位置`)
      ;[seq[a], seq[b]] = [seq[b], seq[a]]
      return { ...st, seq: { ...st.seq, [id]: seq } }
    }
    if (kind === 'add') {
      const id = need(s.add, 'add')
      if (!st.pool.includes(id)) {
        if (Object.values(st.order).some((l) => l.includes(id))) return st
        throw new Error(`add:「${id}」不在積木盒裡`)
      }
      return { ...st, pool: st.pool.filter((x) => x !== id), order: { ...st.order, [st.page]: [...st.order[st.page], id] }, done: addOnce(st.done, `add:${id}`) }
    }
    if (kind === 'pick') {
      if (typeof s.pick !== 'string' || !(isBlockKind(s.pick) || s.pick in st.cards)) throw new Error(`pick:「${String(s.pick)}」不是積木種類,也不是說明卡`)
      return { ...st, tool: s.pick }
    }
    if (kind === 'use') {
      const id = need(s.use, 'use')
      const key = `part:${id}`
      if (st.right.includes(id)) return { ...st, mark: { key, ok: true } }
      const tool = st.tool
      if (!tool) return { ...st, nag: '先在上面選一塊' }
      const k = st.kinds[id]
      const want = st.fixed[id]?.want
      let next: State
      if (isBlockKind(tool)) {
        if (!TEXT_KINDS.includes(k)) return { ...st, nag: '這一塊不能換' }
        next = { ...st, kinds: { ...st.kinds, [id]: tool } }
      } else {
        if (k !== 'img') return { ...st, nag: '說明卡要放在圖片上' }
        next = { ...st, texts: { ...st.texts, [id]: `@card:${tool}` } }
      }
      const right = !want || want === tool
      return right
        ? { ...next, mark: { key, ok: true }, right: addOnce(st.right, id), done: addOnce(st.done, `use:${id}`) }
        : { ...next, mark: { key, ok: false }, nag: '再換一塊試試看' }
    }
    if (kind === 'write') {
      const id = need(s.write, 'write')
      if (typeof s.text !== 'string') throw new Error('write 要寫 text')
      return { ...st, texts: { ...st.texts, [id]: s.text } }
    }
    if (kind === 'follow') {
      const id = need(s.follow, 'follow')
      const to = st.fixed[id]?.to
      if (st.kinds[id] !== 'a' || !to) throw new Error(`follow:「${id}」不是有 to 的連結`)
      if (!(st.order[st.page] ?? []).includes(id)) throw new Error(`follow:現在這一頁沒有「${id}」這個連結`)
      return { ...st, page: to, focus: null, visited: addOnce(st.visited, to), done: addOnce(st.done, `go:${to}`) }
    }
    if (kind === 'labels') return { ...st, labels: s.labels !== false }
    if (kind === 'broken') return { ...st, broken: s.broken !== false }
    if (kind === 'readout') return { ...st, readout: s.readout !== false }
    if (kind === 'inspect') {
      if (s.inspect === false) return { ...st, focus: null }
      return { ...st, focus: need(s.inspect, 'inspect') }
    }
    // mark
    if (s.mark === false) return { ...st, mark: null }
    if (typeof s.mark !== 'string') throw new Error('mark 要寫目標(例如 part:likes)或 false')
    return { ...st, mark: { key: s.mark, ok: s.ok !== false } }
  },

  duration(kind, step) {
    const tap = step.tap && TAPPABLE.includes(kind) ? TAP_AT : 0
    if (kind === 'write') return tap + kit.typeDuration(step.text ?? '', TYPE_CPS) + MS.write
    return tap + MS[kind]
  },

  cursor(kind, step) {
    if (!step.tap || !TAPPABLE.includes(kind)) return null
    let target: string | null = null
    if (kind === 'pick') target = `tool:${step.pick}`
    else if (kind === 'add') target = `pool:${step.add}`
    else if (kind === 'pull') target = typeof step.entry === 'number' ? `entry:${step.pull}:${step.entry}` : `part:${step.pull}`
    else target = `part:${step.turn ?? step.use ?? step.follow}`
    return { moves: [{ at: 150, target }], clickAt: TAP_AT }
  },

  mount(root, props) {
    const c = cat(props)
    const pages = pagesOf(props)
    const side = props.side ?? 'stack'
    const tools = props.tools ?? []
    const cards = props.cards ?? []
    root.classList.add('A-lt8-kid-page')
    root.dataset.side = side
    root.innerHTML = `
      <div class="kp-scene">
        <div class="kp-win">
          <div class="kp-bar"><span class="kp-lights"><i></i><i></i><i></i></span><span class="kp-url"></span></div>
          <div class="kp-page"></div>
          <div class="kp-readout"><b>🔊 電腦念給看不到的人聽</b><span></span></div>
        </div>
        ${side === 'none' ? '' : `<div class="kp-side"><div class="kp-tools"></div><p class="kp-side-label">${side === 'map' ? '網站地圖' : '網頁的積木'}</p><div class="kp-side-body"></div></div>`}
      </div>
      <div class="kp-nag"></div>`
    const win = root.querySelector<HTMLElement>('.kp-win')!
    const url = root.querySelector<HTMLElement>('.kp-url')!
    const pageEl = root.querySelector<HTMLElement>('.kp-page')!
    const readout = root.querySelector<HTMLElement>('.kp-readout')!
    const readoutText = readout.querySelector<HTMLElement>('span')!
    const sideEl = root.querySelector<HTMLElement>('.kp-side')
    const toolsEl = root.querySelector<HTMLElement>('.kp-tools')
    const sideBody = root.querySelector<HTMLElement>('.kp-side-body')
    const nag = root.querySelector<HTMLElement>('.kp-nag')!
    const isTall = kit.tallWatch(root)

    const tagHtml = (k: BlockKind) => `<em class="kp-name" style="--d:${NAMES[k].shade}">${NAMES[k].name}</em>`
    const style = (k: BlockKind) => `--c:${NAMES[k].color};--d:${NAMES[k].shade}`

    /** 網頁上的一塊 */
    const partHtml = (st: State, id: string): string => {
      const it = c.get(id)!
      const k = st.kinds[id]
      const tx = kit.esc(shownText(st, it))
      let body: string
      if (k === 'h1') body = `<span class="kp-h1">${tx}</span>`
      else if (k === 'h2') body = `<span class="kp-h2">${tx}</span>`
      else if (k === 'p') body = `<span class="kp-p">${tx}</span>`
      else if (k === 'a') body = `<span class="kp-a">${tx}</span>`
      else if (k === 'img') {
        body = st.broken
          ? `<span class="kp-img kp-broken"><i>🖼️✖</i><span>${tx || '？'}</span></span>`
          : `<span class="kp-img"><span class="kp-pic">${kit.esc(it.pic ?? '🖼️')}</span></span>`
      } else {
        // 清單:已經排好的項目一行一行,還沒拉出來的(loose)留在一長串句子裡
        const seq = st.seq[id] ?? []
        const rest = (it.mix ?? it.items!.map((_, i) => i)).filter((i) => !seq.includes(i))
        const sentence = it.loose && rest.length
          ? `<span class="kp-run">${kit.esc(it.lead ?? '')}${rest.map((i, j) => `<b class="kp-chip" data-entry="${id}:${i}">${kit.esc(it.items![i])}</b>${j < rest.length - 1 ? '、' : '。'}`).join('')}</span>`
          : ''
        const list = seq.length
          ? `<span class="kp-list" data-kind="${k}">${it.loose && it.lead && !rest.length ? `<span class="kp-lead">${kit.esc(it.lead)}：</span>` : ''}${seq.map((i, n) => `<span class="kp-li" data-entry="${id}:${i}"><i>${k === 'ol' ? `${n + 1}.` : '●'}</i>${kit.esc(it.items![i])}</span>`).join('')}</span>`
          : ''
        body = sentence + list
      }
      return `<div class="kp-part" data-id="${id}" data-kind="${k}" style="${style(k)}">${body}${k === 'raw' ? '' : tagHtml(k)}<b class="kp-badge"></b></div>`
    }
    /** 整頁:相鄰的 raw 擠成一團 */
    const pageHtml = (st: State, page: string): string => {
      const out: string[] = []
      let run: string[] = []
      const flush = () => {
        if (run.length) out.push(`<div class="kp-raw">${run.join('')}</div>`)
        run = []
      }
      for (const id of st.order[page] ?? []) {
        if (st.kinds[id] === 'raw') {
          run.push(`<span class="kp-part kp-chunk" data-id="${id}" data-kind="raw" style="${style('raw')}">${kit.esc(shownText(st, c.get(id)!))}<b class="kp-badge"></b></span>`)
          continue
        }
        flush()
        out.push(partHtml(st, id))
      }
      flush()
      return out.join('') || '<p class="kp-empty">（空白的網頁，從積木盒放積木上來）</p>'
    }
    const toolsHtml = (st: State): string => {
      const pool = st.pool.map((id) => {
        const it = c.get(id)!
        return `<span class="kp-tool kp-poolitem" data-pool="${id}" style="${style(it.kind)}"><small>${NAMES[it.kind].icon}</small>${NAMES[it.kind].name}<span>${kit.esc(it.kind === 'img' ? (it.pic ?? '') : isList(it.kind) ? `${it.items!.length} 個項目` : (it.text ?? ''))}</span></span>`
      })
      const ks = tools.map((k) => `<span class="kp-tool" data-tool="${k}" data-on="${st.tool === k ? 1 : 0}" style="${style(k as BlockKind)}"><small>${NAMES[k as BlockKind].icon}</small>${NAMES[k as BlockKind].name}</span>`)
      const cs = cards.map((x) => `<span class="kp-tool kp-card" data-tool="${x.id}" data-on="${st.tool === x.id ? 1 : 0}">💬 ${kit.esc(x.text)}</span>`)
      const all = [...pool, ...ks, ...cs]
      if (!all.length) return ''
      const title = pool.length ? '積木盒（點一下放上網頁）' : cards.length ? '說明卡（先選一張）' : '積木盒（先選一塊）'
      return `<p class="kp-tools-label">${title}</p><div class="kp-tools-row">${all.join('')}</div>`
    }
    const stackHtml = (st: State): string => {
      const rows: string[] = []
      let raw = 0
      for (const id of st.order[st.page] ?? []) {
        const it = c.get(id)!
        const k = st.kinds[id]
        if (k === 'raw') {
          raw++
          continue
        }
        if (raw) rows.push(`<div class="kp-block" data-kind="raw" style="${style('raw')}"><span class="kp-block-tag"><small>${NAMES.raw.icon}</small>${NAMES.raw.name}</span><span class="kp-block-val">${raw} 句擠在一起</span></div>`)
        raw = 0
        const val = k === 'img' ? `${kit.esc(it.pic ?? '')} ${shownText(st, it) ? `<small>說明：${kit.esc(shownText(st, it))}</small>` : '<small>（沒有說明）</small>'}` : isList(k) ? `${(st.seq[id] ?? []).length} 個項目` : kit.esc(shownText(st, it))
        rows.push(`<div class="kp-block" data-block="${id}" data-kind="${k}" style="${style(k)}"><span class="kp-block-tag"><small>${NAMES[k].icon}</small>${NAMES[k].name}</span><span class="kp-block-val">${val}</span></div>`)
      }
      if (raw) rows.push(`<div class="kp-block" data-kind="raw" style="${style('raw')}"><span class="kp-block-tag"><small>${NAMES.raw.icon}</small>${NAMES.raw.name}</span><span class="kp-block-val">${raw} 句擠在一起</span></div>`)
      return rows.join('') || '<p class="kp-empty">還沒有積木</p>'
    }
    /** 網站地圖:第一頁在上面,其他頁排在下面一列,連結畫成線 */
    const mapHtml = (st: State): string => {
      const ids = Object.keys(pages)
      const pos: Record<string, [number, number]> = {}
      ids.forEach((p, i) => {
        pos[p] = i === 0 ? [50, 22] : [ids.length === 2 ? 50 : 18 + ((i - 1) * 64) / Math.max(1, ids.length - 2), 74]
      })
      const lines = new Set<string>()
      for (const p of ids) for (const id of st.order[p] ?? []) {
        const to = st.fixed[id]?.to
        if (st.kinds[id] === 'a' && to) lines.add([p, to].sort().join('>'))
      }
      const svg = [...lines]
        .map((k) => {
          const [a, b] = k.split('>')
          return `<line x1="${pos[a][0]}" y1="${pos[a][1]}" x2="${pos[b][0]}" y2="${pos[b][1]}"/>`
        })
        .join('')
      const nodes = ids
        .map((p) => `<span class="kp-node" data-node="${p}" data-here="${st.page === p ? 1 : 0}" data-seen="${st.visited.includes(p) ? 1 : 0}" style="left:${pos[p][0]}%;top:${pos[p][1]}%">${st.page === p ? '<em>你在這裡</em>' : ''}${st.visited.includes(p) ? '⭐ ' : ''}${kit.esc(pages[p].title ?? p)}</span>`)
        .join('')
      return `<div class="kp-map"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${svg}</svg>${nodes}</div>`
    }

    /** 這一格畫面裡要跳一下的東西(CSS 選擇器) */
    const popSel = (kind: Kind, s: Step, st: State): string | null => {
      if (kind === 'turn' || kind === 'add' || kind === 'use' || kind === 'write') return `[data-id="${s.turn ?? s.add ?? s.use ?? s.write}"]`
      if (kind === 'pull') {
        const seq = st.seq[s.pull ?? ''] ?? []
        const i = s.entry === 'all' ? null : s.entry
        return i === null ? `[data-id="${s.pull}"] .kp-li` : seq.includes(i ?? -1) ? `[data-entry="${s.pull}:${i}"]` : null
      }
      if (kind === 'swap') return `[data-id="${s.swap}"] .kp-li`
      if (kind === 'pick') return `[data-tool="${s.pick}"]`
      return null
    }
    const markEl = (key: string): HTMLElement | null => find(key)
    function find(name: string): HTMLElement | null {
      if (name === 'window') return root
      if (name === 'page') return win
      if (name === 'side') return sideEl
      if (name === 'tools') return toolsEl
      if (name === 'readout') return readout
      const i = name.indexOf(':')
      const kind = name.slice(0, i)
      const id = name.slice(i + 1)
      const q = (sel: string) => root.querySelector<HTMLElement>(sel)
      if (kind === 'part') return q(`.kp-page [data-id="${id}"]`)
      if (kind === 'entry') return q(`.kp-page [data-entry="${id}"]`)
      if (kind === 'block') return q(`.kp-side [data-block="${id}"]`)
      if (kind === 'tool') return q(`.kp-side [data-tool="${id}"]`)
      if (kind === 'pool') return q(`.kp-side [data-pool="${id}"]`)
      if (kind === 'node') return q(`.kp-side [data-node="${id}"]`)
      return null
    }

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = view.ev && KINDS.includes(view.ev.kind as Kind) ? view.ev : null
        const kind = ev?.kind as Kind | undefined
        const s = (ev?.step ?? {}) as Step
        const from = view.prev
        const to = view.ev?.kind === 'hide' ? view.prev : view.state
        const tap = ev && s.tap && kind && TAPPABLE.includes(kind) ? TAP_AT : 0
        const p = ev ? kit.ease.inOutCubic(kit.progress(ev.local, tap, Math.max(1, ev.dur - tap))) : 1
        root.dataset.tall = isTall() ? '1' : '0'

        // 換頁:前一半舊的那頁淡出,後一半新的那頁淡入
        const going = kind === 'follow' && from.page !== to.page
        let shown = going && p < 0.5 ? from : ev && p <= 0 ? from : to
        // 逐字寫:寫到一半的字
        if (kind === 'write' && ev && s.write) {
          const text = kit.typewriter(s.text ?? '', ev.local, { start: 200, cps: TYPE_CPS }).text
          shown = { ...shown, texts: { ...shown.texts, [s.write]: text } }
        }
        const page = shown.page
        kit.setIf(url, 'text', pages[page]?.title ?? props.title ?? '我的網頁')
        kit.setIf(pageEl, 'html', pageHtml(shown, page))
        kit.css(pageEl, { opacity: going ? Math.abs(p - 0.5) * 2 + '' : '1' })
        if (toolsEl) kit.setIf(toolsEl, 'html', toolsHtml(shown))
        if (sideBody) kit.setIf(sideBody, 'html', side === 'map' ? mapHtml(shown) : stackHtml(shown))

        // 每一格先把上一格設過的效果清掉(元素沒有重建時會留著),畫面才只由時間決定
        for (const el of root.querySelectorAll<HTMLElement>('.kp-part, .kp-chip, .kp-li, .kp-tool, .kp-block, .kp-node')) {
          for (const v of ['--pop', '--good', '--bad']) el.style.setProperty(v, '0')
          el.style.translate = ''
        }
        for (const b of root.querySelectorAll<HTMLElement>('.kp-badge')) {
          b.textContent = ''
          b.style.opacity = '0'
        }

        // 跳一下:剛變出來的東西從小變大、發亮
        const pop = ev && kind && p < 1 ? popSel(kind, s, to) : null
        const popP = Math.sin(Math.min(1, p) * Math.PI)
        if (pop) for (const el of root.querySelectorAll<HTMLElement>(pop)) el.style.setProperty('--pop', popP.toFixed(3))

        // 亮暗(inspect):這一塊和側欄的積木亮,其他變暗
        const f0 = from.focus
        const f1 = to.focus
        const fp = kind === 'inspect' ? p : 1
        for (const el of root.querySelectorAll<HTMLElement>('.kp-page .kp-part, .kp-side .kp-block')) {
          const id = el.dataset.id ?? el.dataset.block ?? ''
          const lit = (f: string | null) => (f === null ? 0 : f === id ? 1 : 0)
          const dim = (f: string | null) => (f === null ? 0 : f === id ? 0 : 1)
          el.style.setProperty('--on', kit.lerp(lit(f0), lit(f1), fp).toFixed(3))
          el.style.setProperty('--dim', kit.lerp(dim(f0), dim(f1), fp).toFixed(3))
        }

        // 對錯:變綠或變紅搖一搖,旁邊的小徽章寫勾勾或「再試試看」
        if (to.mark) {
          const el = markEl(to.mark.key)
          const mp = kind === 'mark' || kind === 'use' || kind === 'pull' ? p : 1
          if (el) {
            el.style.setProperty(to.mark.ok ? '--good' : '--bad', mp.toFixed(3))
            const shake = !to.mark.ok && mp < 1 ? Math.sin(mp * Math.PI * 6) * (1 - mp) * 0.5 : 0
            el.style.translate = `${shake.toFixed(3)}em 0`
            const badge = el.querySelector<HTMLElement>(':scope > .kp-badge')
            if (badge) {
              badge.textContent = to.mark.ok ? '✓' : '✗'
              badge.dataset.ok = to.mark.ok ? '1' : '0'
              badge.style.opacity = mp.toFixed(3)
            }
          }
        }
        // 用對過的:一直掛著小勾勾
        for (const id of to.right) {
          const b = root.querySelector<HTMLElement>(`.kp-page [data-id="${id}"] > .kp-badge`)
          if (b && !(to.mark && to.mark.key === `part:${id}`)) {
            b.textContent = '✓'
            b.style.opacity = '1'
            b.dataset.ok = '1'
          }
        }

        // 名牌、念出來、提示
        const lp = kind === 'labels' ? p : 1
        root.style.setProperty('--x', kit.lerp(from.labels ? 1 : 0, to.labels ? 1 : 0, lp).toFixed(3))
        const rp = kind === 'readout' ? p : 1
        const ro = kit.lerp(from.readout ? 1 : 0, to.readout ? 1 : 0, rp)
        kit.setIf(readoutText, 'text', readText(to.readout ? to : from, c))
        kit.css(readout, { opacity: ro.toFixed(3), transform: `translateY(${((1 - ro) * 30).toFixed(1)}px)` })
        kit.setIf(nag, 'text', to.nag ?? '')
        kit.css(nag, { opacity: to.nag ? (ev ? Math.min(1, p * 3) : 1).toFixed(3) : '0' })
      },

      target(name) {
        return find(name)
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
