// 演員 kid-web:兒童網頁課的「積木網頁」。正面是一頁卡通網頁,背面是一塊一塊印著標籤名字的大積木。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
// 試做:只用現有的舞台與互動層能做到的部分,需要擴充的地方記在 studio/proposal/kidsWeb.ts 的 KIDS_LIVE_GAPS。
//
// props(登場設定):
//   title    網址列上的網站名稱,例如「小花的家」
//   blocks   網頁的積木,由上到下:[{ "tag": "h1", "text": "小花的家" }, …]
//            tag 是 h1、img、p、button 其中之一,一種標籤只能有一塊(目標用標籤名字指定);img 的 text 放一個 emoji
//   view     一開始看哪一面:front(預設)、back、split(左邊網頁、右邊積木)
//
// 動作:
//   { "flip": "back" }                      翻面:front、back、split(約 1.4 秒)
//   { "inspect": "h1" }                     網頁上的東西和它的積木一起亮起來,其他變暗;"inspect": false 全部恢復
//                                           看過的積木會在右下角集一顆星(狀態的 seen)
//   { "inspect": "h1", "tap": "part" }      示範操作:虛擬滑鼠移過去點一下(part 點網頁上的東西、block 點積木),點下去才亮;示範不算集星星
//   { "check": "img", "answer": "button" }  回答「這是哪一塊積木」:孩子選了 check,正確答案是 answer;
//                                           答對變綠、網頁上對應的東西亮起來,答錯那塊變紅、搖一搖
//
// 目標:window、page(網頁正面)、stack(積木堆)、part:<標籤>(網頁上的東西)、block:<標籤>(積木)、stars
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type KidKind = 'flip' | 'inspect' | 'check'
type Face = 'front' | 'back' | 'split'
type Tag = 'h1' | 'img' | 'p' | 'button'
type KidStep = CommonStepFields & { flip?: Face; inspect?: Tag | false; tap?: 'part' | 'block'; check?: Tag; answer?: Tag }
interface KidBlock {
  tag: Tag
  text: string
}
interface KidProps {
  title?: string
  blocks?: KidBlock[]
  view?: Face
}
interface KidState {
  view: Face
  focus: Tag | null
  /** 最近一次回答:選了哪塊、對不對 */
  verdict: { tag: Tag; right: boolean } | null
  seen: Tag[]
}
type KidTarget = 'window' | 'page' | 'stack' | 'stars' | `part:${string}` | `block:${string}`

const KINDS: readonly KidKind[] = ['flip', 'inspect', 'check']
const FACES: readonly Face[] = ['front', 'back', 'split']

/** 每種標籤的積木:中文名稱與顏色(和 studio/kids/blocks.ts 的試做頁一致) */
const TAGS: Record<Tag, { name: string; say: string; does: string; color: string; shade: string }> = {
  h1: { name: '大標題', say: '念作「H 一」', does: '畫出最大的標題', color: '#f6a03c', shade: '#9a4a00' },
  img: { name: '圖片', say: '念作「image」', does: '放上一張圖片', color: '#4fb3e8', shade: '#155f8a' },
  p: { name: '一段文字', say: '念作「P」', does: '寫出一段文字', color: '#5cc477', shade: '#23703a' },
  button: { name: '按鈕', say: '念作「button」', does: '變成一個可以按的按鈕', color: '#b48af0', shade: '#5b2a9e' },
}
const isTag = (x: unknown): x is Tag => typeof x === 'string' && x in TAGS

const FLIP_MS = 1400
const INSPECT_MS = 900
const CHECK_MS = 1200
/** 示範點擊:滑鼠 150ms 出發、移動 550ms,到了就點(舞台的虛擬滑鼠固定這樣移動,見 README 2A.5 已知限制) */
const TAP_AT = 750

/** 兩片(網頁、積木堆)在各個面的位置:left 與寬度是 %,轉角是 rotateY 的度數 */
const LAYOUT: Record<Face, { page: { x: number; r: number }; stack: { x: number; r: number }; w: number }> = {
  front: { page: { x: 25, r: 0 }, stack: { x: 25, r: -180 }, w: 50 },
  back: { page: { x: 25, r: 180 }, stack: { x: 25, r: 0 }, w: 50 },
  split: { page: { x: 2, r: 0 }, stack: { x: 52, r: 0 }, w: 46 },
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
  return `<span class="kw-studs"><i></i><i></i></span><span class="kw-tag">&lt;${b.tag}&gt;<small>${def.name}</small></span><span class="kw-content">${kit.esc(b.text)}</span>`
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
      const narration = `這是 <${b.tag}> 積木，${def.say}，它會${def.does}。`
      return [
        { target: `part:${b.tag}`, label: `網頁上的${def.name}`, step: { inspect: b.tag, narration } },
        { target: `block:${b.tag}`, label: `<${b.tag}> 積木`, step: { inspect: b.tag, narration } },
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
    return { view, focus: null, verdict: null, seen: [] }
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
    if (!isTag(s.check) || !isTag(s.answer)) throw new Error('check 和 answer 都要寫標籤名字,例如 { "check": "img", "answer": "button" }')
    const right = s.check === s.answer
    return { ...st, focus: right ? s.check : null, verdict: { tag: s.check, right } }
  },

  duration(kind, step) {
    if (kind === 'inspect') return (step.tap ? TAP_AT : 0) + INSPECT_MS
    return kind === 'flip' ? FLIP_MS : CHECK_MS
  },

  cursor(kind, step) {
    if (kind !== 'inspect' || !step.tap || !isTag(step.inspect)) return null
    return { moves: [{ at: 150, target: `${step.tap}:${step.inspect}` }], clickAt: TAP_AT }
  },

  mount(root, props) {
    const blocks = blocksOf(props)
    root.classList.add('A-kid-web')
    root.innerHTML = `
      <div class="kw-scene">
        <div class="kw-pane kw-page-pane">
          <div class="kw-bar"><span class="kw-lights"><i></i><i></i><i></i></span><span class="kw-url">${kit.esc(props.title ?? '我的網頁')}</span></div>
          <div class="kw-page">${blocks.map((b) => `<div class="kw-part" data-tag="${b.tag}">${partHtml(b)}</div>`).join('')}</div>
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
        const a = LAYOUT[from.view]
        const b = LAYOUT[to.view]
        const w = kit.lerp(a.w, b.w, p)
        const place = (el: HTMLElement, x0: { x: number; r: number }, x1: { x: number; r: number }) =>
          kit.css(el, { left: `${kit.lerp(x0.x, x1.x, p).toFixed(2)}%`, width: `${w.toFixed(2)}%`, transform: `rotateY(${kit.lerp(x0.r, x1.r, p).toFixed(1)}deg)` })
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

        // 集星星:看過幾塊積木
        const seen = to.seen
        kit.setIf(stars, 'html', seen.length ? `${blocks.map((b) => `<span data-on="${seen.includes(b.tag) ? 1 : 0}">${seen.includes(b.tag) ? '⭐' : '☆'}</span>`).join('')}<em>找到 ${seen.length} / ${blocks.length} 塊</em>` : '')
      },

      target(name) {
        if (name === 'window') return root
        if (name === 'page') return pagePane
        if (name === 'stack') return stackPane
        if (name === 'stars') return stars
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
