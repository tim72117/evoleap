// 演員 kid-web:兒童網頁課的「積木網頁」。正面是一頁卡通網頁,背面是一塊一塊印著中文名字(標題、圖片、文字、按鈕)的大積木。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
// 試做:只用現有的舞台與互動層能做到的部分,需要擴充的地方記在 studio/proposal/kidsWeb.ts 的 KIDS_LIVE_GAPS。
//
// props(登場設定):
//   title    網址列上的網站名稱,例如「小花的家」
//   blocks   網頁的積木,由上到下:[{ "tag": "h1", "text": "小花的家" }, …]
//            tag 是 h1、img、p、button 其中之一,一種標籤只能有一塊(目標用標籤名字指定);img 的 text 放一個 emoji
//   view     一開始看哪一面:front(預設)、back、split(左邊網頁、右邊積木)
//   xray     一開始就戴著 X 光眼鏡(網頁上每個東西旁邊標出它的積木名字),預設 false
//
// 動作:
//   { "flip": "back" }                      翻面:front、back、split(約 1.4 秒)
//   { "inspect": "h1" }                     網頁上的東西和它的積木一起亮起來,其他變暗;"inspect": false 全部恢復
//                                           看過的積木會在右下角集一顆星(狀態的 seen)
//   { "inspect": "h1", "tap": "part" }      示範操作:虛擬滑鼠移過去點一下(part 點網頁上的東西、block 點積木),點下去才亮;示範不算集星星
//   { "check": "img", "answer": "button" }  回答「這是哪一塊積木」:孩子選了 check,正確答案是 answer;
//                                           答對變綠、網頁上對應的東西亮起來,答錯那塊變紅、搖一搖
//   { "xray": true }                        戴上(false 拿下)X 光眼鏡:不用翻面,網頁上每個東西旁邊出現它的積木名字
//   { "edit": "h1", "text": "阿明的家" }    在自己的電腦上改網頁的字(h1、p、button):網頁和背面的積木一起換成新的字,逐字打出來;
//                                           加 "tap": true 先用虛擬滑鼠點一下那個東西(示範)
//   { "reload": true }                      按瀏覽器的重新整理:改過的字全部變回原本的樣子(props 的 blocks);加 "tap": true 示範點重新整理鈕。
//                                           狀態的 undone:改過字之後按了幾次重新整理(給子腳本的 until 判斷「改完並重新整理過」)
//
// 目標:window、page(網頁正面)、stack(積木堆)、part:<標籤>(網頁上的東西)、block:<標籤>(積木)、stars、reload(重新整理鈕)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type KidKind = 'flip' | 'inspect' | 'check' | 'xray' | 'edit' | 'reload'
type Face = 'front' | 'back' | 'split'
type Tag = 'h1' | 'img' | 'p' | 'button'
type KidStep = CommonStepFields & {
  flip?: Face
  inspect?: Tag | false
  tap?: 'part' | 'block' | true
  check?: Tag
  answer?: Tag
  xray?: boolean
  edit?: Tag
  text?: string
  reload?: boolean
}
interface KidBlock {
  tag: Tag
  text: string
}
interface KidProps {
  title?: string
  blocks?: KidBlock[]
  view?: Face
  xray?: boolean
}
interface KidState {
  view: Face
  focus: Tag | null
  /** 最近一次回答:選了哪塊、對不對 */
  verdict: { tag: Tag; right: boolean } | null
  seen: Tag[]
  xray: boolean
  /** 網頁上改過的字(沒改過的照 props 的 blocks) */
  texts: Partial<Record<Tag, string>>
  /** 上次重新整理之後改過字的積木 */
  edited: Tag[]
  /** 改過字之後按了幾次重新整理 */
  undone: number
}
type KidTarget = 'window' | 'page' | 'stack' | 'stars' | 'reload' | `part:${string}` | `block:${string}`

const KINDS: readonly KidKind[] = ['flip', 'inspect', 'check', 'xray', 'edit', 'reload']
/** 可以改字的標籤(圖片不能改字) */
const EDITABLE: readonly Tag[] = ['h1', 'p', 'button']
const FACES: readonly Face[] = ['front', 'back', 'split']

/** 每種標籤的積木:中文名稱與顏色(和 studio/kids/blocks.ts 的試做頁一致) */
// 兒童課不教語法:積木上印的是中文名字(標題、圖片、文字、按鈕),不出現 <h1> 這類標籤名稱
const TAGS: Record<Tag, { name: string; icon: string; does: string; color: string; shade: string }> = {
  h1: { name: '標題', icon: '🔤', does: '畫出最大的那行字', color: '#f6a03c', shade: '#9a4a00' },
  img: { name: '圖片', icon: '🖼️', does: '放上一張圖片', color: '#4fb3e8', shade: '#155f8a' },
  p: { name: '文字', icon: '📝', does: '寫出一段文字', color: '#5cc477', shade: '#23703a' },
  button: { name: '按鈕', icon: '👆', does: '變成一個可以按的按鈕', color: '#b48af0', shade: '#5b2a9e' },
}
const isTag = (x: unknown): x is Tag => typeof x === 'string' && x in TAGS

const FLIP_MS = 1400
const INSPECT_MS = 900
const CHECK_MS = 1200
const XRAY_MS = 900
const RELOAD_MS = 1500
/** 改字時一秒打幾個字 */
const TYPE_CPS = 8
/** 示範點擊:滑鼠 150ms 出發、移動 550ms,到了就點(舞台的虛擬滑鼠固定這樣移動,見 README 2A.5 已知限制) */
const TAP_AT = 750

/** 兩片(網頁、積木堆)在各個面的位置:left、top 與寬度是 %,轉角是 rotateY 的度數,s 是縮放(以上緣中間為原點) */
type Spot = { x: number; y?: number; r: number; s?: number }
type Layout = Record<Face, { page: Spot; stack: Spot; w: number }>
const LAYOUT: Layout = {
  front: { page: { x: 25, r: 0 }, stack: { x: 25, r: -180 }, w: 50 },
  back: { page: { x: 25, r: 180 }, stack: { x: 25, r: 0 }, w: 50 },
  split: { page: { x: 2, r: 0 }, stack: { x: 52, r: 0 }, w: 46 },
}
/** 直的外框(直式舞台):兩片加寬,分開時改成上下排(網頁在上、積木在下),兩片都縮小一點才放得下 */
const LAYOUT_TALL: Layout = {
  front: { page: { x: 10, r: 0 }, stack: { x: 10, r: -180 }, w: 80 },
  back: { page: { x: 10, r: 180 }, stack: { x: 10, r: 0 }, w: 80 },
  split: { page: { x: 4, y: 0, r: 0, s: 0.86 }, stack: { x: 4, y: 47, r: 0, s: 0.86 }, w: 92 },
}

const DEFAULT_BLOCKS: KidBlock[] = [
  { tag: 'h1', text: '小花的家' },
  { tag: 'img', text: '🐱' },
  { tag: 'p', text: '小花是一隻愛睡午覺的橘貓。' },
  { tag: 'button', text: '摸摸小花' },
]

const blocksOf = (props: KidProps): KidBlock[] => props.blocks ?? DEFAULT_BLOCKS

function partHtml(b: KidBlock): string {
  const t = kit.esc(b.text)
  if (b.tag === 'h1') return `<span class="kw-h1">${t}</span>`
  if (b.tag === 'img') return `<span class="kw-photo">${t}</span>`
  if (b.tag === 'p') return `<span class="kw-text">${t}</span>`
  return `<span class="kw-btn">${t}</span>`
}

function blockHtml(b: KidBlock): string {
  const def = TAGS[b.tag]
  return `<span class="kw-studs"><i></i><i></i></span><span class="kw-tag"><small>${def.icon}</small>${def.name}</span><span class="kw-content">${kit.esc(b.text)}</span>`
}

/** 某個狀態下,每塊東西的亮暗:on 1 = 亮起來、dim 1 = 變暗、bad 1 = 答錯 */
function looks(st: KidState, tag: Tag): { on: number; dim: number; bad: number } {
  const v = st.verdict
  if (v) {
    if (v.tag === tag) return v.right ? { on: 1, dim: 0, bad: 0 } : { on: 0, dim: 0, bad: 1 }
    return { on: 0, dim: v.right ? 1 : 0, bad: 0 }
  }
  if (st.focus === null) return { on: 0, dim: 0, bad: 0 }
  return st.focus === tag ? { on: 1, dim: 0, bad: 0 } : { on: 0, dim: 1, bad: 0 }
}

const actor = defineActor<KidKind, KidStep, KidProps, KidState, KidTarget>({
  name: 'kid-web',
  kinds: KINDS,
  parts: { stars: '.kw-stars' },

  hotspots(st, props) {
    // 互動層(靜態展示、兒童版殼層的自由互動)用:分開看兩面時,網頁上的東西和積木都可以點,點了念出這塊積木在做什麼
    if (st.view !== 'split') return [{ target: 'window', label: '把網頁翻開', step: { flip: 'split' } }]
    // 點了念什麼由腳本決定時,子腳本寫 interact.spots(見 kids/KidsPlayer.tsx);這裡是沒寫 spots 時的預設說法
    return blocksOf(props).flatMap((b) => {
      const def = TAGS[b.tag]
      const narration = `這是${def.name}積木，它會${def.does}。`
      return [
        { target: `part:${b.tag}`, label: `網頁上的${def.name}`, step: { inspect: b.tag, narration } },
        { target: `block:${b.tag}`, label: `${def.name}積木`, step: { inspect: b.tag, narration } },
      ]
    })
  },

  init(props) {
    const blocks = blocksOf(props)
    if (!Array.isArray(blocks) || !blocks.length) throw new Error('blocks 要列出網頁的積木')
    const tags = new Set<Tag>()
    for (const b of blocks) {
      if (!isTag(b.tag)) throw new Error(`blocks:不認得的標籤「${String(b.tag)}」,目前只有 ${Object.keys(TAGS).join('、')}`)
      if (tags.has(b.tag)) throw new Error(`blocks:<${b.tag}> 只能有一塊`)
      tags.add(b.tag)
    }
    const view = props.view ?? 'front'
    if (!FACES.includes(view)) throw new Error(`view 要是 ${FACES.join('、')}`)
    return { view, focus: null, verdict: null, seen: [], xray: !!props.xray, texts: {}, edited: [], undone: 0 }
  },

  apply(st, kind, s) {
    if (kind === 'flip') {
      if (!s.flip || !FACES.includes(s.flip)) throw new Error(`flip 要是 ${FACES.join('、')}`)
      if (s.flip === st.view) throw new Error(`flip:已經是 ${s.flip} 這一面`)
      return { ...st, view: s.flip, focus: null, verdict: null }
    }
    if (kind === 'inspect') {
      if (s.inspect === false) return { ...st, focus: null, verdict: null }
      if (!isTag(s.inspect)) throw new Error(`inspect:不認得的標籤「${String(s.inspect)}」`)
      if (s.tap && s.tap !== 'part' && s.tap !== 'block') throw new Error('tap 要是 part(點網頁上的東西)或 block(點積木)')
      if (s.tap === 'part' && st.view === 'back') throw new Error('tap:背面看不到網頁,先 flip 到 front 或 split')
      // 示範點擊(tap)不算孩子找到的
      const seen = s.tap || st.seen.includes(s.inspect) ? st.seen : [...st.seen, s.inspect]
      return { ...st, focus: s.inspect, verdict: null, seen }
    }
    if (kind === 'xray') return { ...st, xray: s.xray !== false }
    if (kind === 'edit') {
      if (!isTag(s.edit) || !EDITABLE.includes(s.edit)) throw new Error(`edit:只能改 ${EDITABLE.join('、')} 的字`)
      if (typeof s.text !== 'string' || !s.text) throw new Error('edit 要寫新的字(text)')
      if (st.view === 'back') throw new Error('edit:背面看不到網頁,先 flip 到 front 或 split')
      const edited = st.edited.includes(s.edit) ? st.edited : [...st.edited, s.edit]
      return { ...st, focus: null, verdict: null, texts: { ...st.texts, [s.edit]: s.text }, edited }
    }
    if (kind === 'reload') return { ...st, focus: null, verdict: null, texts: {}, edited: [], undone: st.undone + (st.edited.length ? 1 : 0) }
    if (!isTag(s.check) || !isTag(s.answer)) throw new Error('check 和 answer 都要寫標籤名字,例如 { "check": "img", "answer": "button" }')
    const right = s.check === s.answer
    return { ...st, focus: right ? s.check : null, verdict: { tag: s.check, right } }
  },

  duration(kind, step) {
    const tap = step.tap ? TAP_AT : 0
    if (kind === 'inspect') return tap + INSPECT_MS
    if (kind === 'edit') return tap + kit.typeDuration(step.text ?? '', TYPE_CPS) + 600
    if (kind === 'reload') return tap + RELOAD_MS
    if (kind === 'xray') return XRAY_MS
    return kind === 'flip' ? FLIP_MS : CHECK_MS
  },

  cursor(kind, step) {
    if (!step.tap) return null
    if (kind === 'inspect' && isTag(step.inspect)) return { moves: [{ at: 150, target: `${step.tap === 'block' ? 'block' : 'part'}:${step.inspect}` }], clickAt: TAP_AT }
    if (kind === 'edit' && isTag(step.edit)) return { moves: [{ at: 150, target: `part:${step.edit}` }], clickAt: TAP_AT }
    if (kind === 'reload') return { moves: [{ at: 150, target: 'reload' }], clickAt: TAP_AT }
    return null
  },

  mount(root, props) {
    const blocks = blocksOf(props)
    root.classList.add('A-kid-web')
    root.innerHTML = `
      <div class="kw-scene">
        <div class="kw-pane kw-page-pane">
          <div class="kw-bar"><span class="kw-lights"><i></i><i></i><i></i></span><span class="kw-reload">↻</span><span class="kw-url">${kit.esc(props.title ?? '我的網頁')}</span></div>
          <div class="kw-page">${blocks.map((b) => `<div class="kw-part" data-tag="${b.tag}">${partHtml(b)}<em class="kw-xtag">${TAGS[b.tag].name}</em></div>`).join('')}</div>
        </div>
        <div class="kw-pane kw-stack-pane">
          <p class="kw-back-label">網頁的背面</p>
          <div class="kw-stack">${blocks.map((b) => `<div class="kw-block" data-tag="${b.tag}">${blockHtml(b)}</div>`).join('')}</div>
        </div>
      </div>
      <div class="kw-stars"></div>`
    const pagePane = root.querySelector<HTMLElement>('.kw-page-pane')!
    const stackPane = root.querySelector<HTMLElement>('.kw-stack-pane')!
    const stars = root.querySelector<HTMLElement>('.kw-stars')!
    const reloadBtn = root.querySelector<HTMLElement>('.kw-reload')!
    const pageBody = root.querySelector<HTMLElement>('.kw-page')!
    // 外框比寬還高(直式舞台)時用上下排的版面;外框大小改變才重算(kit.tallWatch)
    const isTall = kit.tallWatch(root)
    /** 網頁上與積木上放字的地方(改字時換這裡) */
    const partText = new Map(blocks.map((b) => [b.tag, root.querySelector<HTMLElement>(`.kw-part[data-tag="${b.tag}"] > span`)!]))
    const blockText = new Map(blocks.map((b) => [b.tag, root.querySelector<HTMLElement>(`.kw-block[data-tag="${b.tag}"] .kw-content`)!]))
    const original = new Map(blocks.map((b) => [b.tag, b.text]))
    const parts = new Map(blocks.map((b) => [b.tag, root.querySelector<HTMLElement>(`.kw-part[data-tag="${b.tag}"]`)!]))
    const bricks = new Map(blocks.map((b) => [b.tag, root.querySelector<HTMLElement>(`.kw-block[data-tag="${b.tag}"]`)!]))
    for (const b of blocks) {
      const def = TAGS[b.tag]
      for (const el of [parts.get(b.tag)!, bricks.get(b.tag)!]) {
        el.style.setProperty('--c', def.color)
        el.style.setProperty('--d', def.shade)
      }
    }

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = view.ev && KINDS.includes(view.ev.kind as KidKind) ? view.ev : null
        const from = view.prev
        // 退場淡出時維持退場前的樣子
        const to = view.ev?.kind === 'hide' ? view.prev : view.state
        // 示範點擊時,點下去才開始亮
        const tapped = ev?.kind === 'inspect' && (ev.step as KidStep).tap
        const p = ev ? kit.ease.inOutCubic(tapped ? kit.progress(ev.local, TAP_AT, INSPECT_MS) : ev.p) : 1

        // 翻面與分開:兩片的位置、轉角、寬度在兩個面之間內插
        const table = isTall() ? LAYOUT_TALL : LAYOUT
        const a = table[from.view]
        const b = table[to.view]
        const w = kit.lerp(a.w, b.w, p)
        const place = (el: HTMLElement, x0: Spot, x1: Spot) =>
          kit.css(el, {
            left: `${kit.lerp(x0.x, x1.x, p).toFixed(2)}%`,
            top: `${kit.lerp(x0.y ?? 0, x1.y ?? 0, p).toFixed(2)}%`,
            width: `${w.toFixed(2)}%`,
            transform: `rotateY(${kit.lerp(x0.r, x1.r, p).toFixed(1)}deg) scale(${kit.lerp(x0.s ?? 1, x1.s ?? 1, p).toFixed(4)})`,
            transformOrigin: '50% 0',
          })
        place(pagePane, a.page, b.page)
        place(stackPane, a.stack, b.stack)

        // 亮暗:從前一個狀態內插到這一個;答錯的積木搖一搖
        const shakeP = ev?.kind === 'check' && to.verdict && !to.verdict.right ? ev.p : 1
        for (const blk of blocks) {
          const l0 = looks(from, blk.tag)
          const l1 = looks(to, blk.tag)
          const on = kit.lerp(l0.on, l1.on, p)
          const dim = kit.lerp(l0.dim, l1.dim, p)
          const bad = kit.lerp(l0.bad, l1.bad, p)
          const shake = l1.bad && shakeP < 1 ? Math.sin(shakeP * Math.PI * 6) * (1 - shakeP) * 0.5 : 0
          for (const el of [parts.get(blk.tag)!, bricks.get(blk.tag)!]) {
            // 自訂屬性要用 setProperty(kit.css 寫的是 style 的一般屬性)
            el.style.setProperty('--on', on.toFixed(3))
            el.style.setProperty('--dim', dim.toFixed(3))
            el.style.setProperty('--bad', bad.toFixed(3))
            kit.css(el, { translate: `${shake.toFixed(3)}em 0` })
          }
        }

        // 改字:網頁和積木上的字一起換;改字的動作進行中逐字打出新的字(示範點擊時點下去才開始打)
        const typing = ev?.kind === 'edit' ? (ev.step as KidStep) : null
        // 重新整理:進度過一半才變回原本的字,網頁在中間閃一下,重新整理鈕轉一圈
        const reloading = ev?.kind === 'reload' ? ev : null
        const reloadStart = reloading && (reloading.step as KidStep).tap ? TAP_AT : 0
        const rp = reloading ? kit.progress(reloading.local, reloadStart, RELOAD_MS) : 1
        const shown = reloading && rp < 0.5 ? from : to
        for (const blk of blocks) {
          let text = shown.texts[blk.tag] ?? original.get(blk.tag)!
          if (typing && typing.edit === blk.tag && ev) {
            const start = typing.tap ? TAP_AT : 0
            text = ev.local < start ? (from.texts[blk.tag] ?? original.get(blk.tag)!) : kit.typewriter(text, ev.local, { start, cps: TYPE_CPS }).text
          }
          kit.setIf(partText.get(blk.tag)!, 'text', text)
          kit.setIf(blockText.get(blk.tag)!, 'text', text)
        }
        kit.css(pageBody, { opacity: reloading ? (0.25 + 0.75 * Math.abs(rp - 0.5) * 2).toFixed(3) : '1' })
        kit.css(reloadBtn, { transform: `rotate(${reloading ? Math.round(rp * 360) : 0}deg)` })

        // X 光眼鏡:網頁上每個東西旁邊的積木名字淡入淡出
        const xp = ev?.kind === 'xray' ? kit.ease.inOutCubic(ev.p) : 1
        const xray = kit.lerp(from.xray ? 1 : 0, to.xray ? 1 : 0, xp)
        root.style.setProperty('--x', xray.toFixed(3))

        // 集星星:看過幾塊積木
        const seen = to.seen
        kit.setIf(stars, 'html', seen.length ? `${blocks.map((b) => `<span data-on="${seen.includes(b.tag) ? 1 : 0}">${seen.includes(b.tag) ? '⭐' : '☆'}</span>`).join('')}<em>找到 ${seen.length} / ${blocks.length} 塊</em>` : '')
      },

      target(name) {
        if (name === 'window') return root
        if (name === 'page') return pagePane
        if (name === 'stack') return stackPane
        if (name === 'stars') return stars
        if (name === 'reload') return reloadBtn
        const m = /^(part|block):(\w+)$/.exec(name)
        if (!m || !isTag(m[2])) return null
        return (m[1] === 'part' ? parts : bricks).get(m[2]) ?? null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
