// 演員 kid-hub:宣傳片「孩子的一天，交給小管家」的小管家 App(研發基地試作,不進公開 bundle;登記在 ../../registerActors.ts)。
// 爸媽請 AI 做出的 App:手機上一塊塊組起來,再把三個功能展開成三格大卡,和 kid-life 的三格痛點同一組位置(鏡像回呼),最後習慣打卡收尾。
// 文字都是真的 DOM;所有動畫由 render 依時間算出(SPEC 第 1 節),不用 CSS animation/transition、計時器、Math.random。
//
// place 用 "full"。版面以直式 1080×1920 設計;橫式(1920×1080)時整個設計盒等比例縮小、放在畫面中央一欄,背景照樣鋪滿。
// 版面避開 Facebook Reels 的遮蔽區,內容都在安全區內。三格、安全區、中線都從共用錨點 ../../anchors 取
// (STRIPS、SAFE、MID_X、DESIGN;與 kid-life 同一組),只改那裡兩位演員就一起移動。
// 卡片內容照 1000×460 排版、縮放 0.87 放進格子。背景照樣鋪滿整個畫面。
//
// props(都選用):
//   name    App 名稱;預設 "小宇的小管家"(「X的…」會拿 X 當問候的名字)
//   goal    存錢目標(元);預設 2000
//   saved   一開始已存的金額(元);預設 1300
//   todo    今日行程清單;預設 ["帶水壺", "美術用品", "聯絡簿簽名"](1–5 項)
//   fund    存錢目標的名稱;預設 "腳踏車基金"
//   bare    true 時不畫自己的背景(暖色漸層、柔光、浮塵),根元素透明,只畫前景(場景 kid-day-scene 用)
//
// 動作(操作式;對不上狀態時載入就報錯;每一步都可以寫 ms,整段動畫依比例放慢或加快):
//   { "ask": "幫我做孩子的小管家…" }   (選用,放在 build 之前)畫面中央偏上一個大輸入框,文字逐字打出,
//                         按下送出鈕後輸入框縮小往上飄走,出現「AI 正在動手做…」加閃光粒子,停到 build 開始。預設 2600ms
//   { "build": true }     畫面中央一支手機,App 一塊塊組起來:骨架閃一下 → 標題浮現 → 四張功能磚
//                         (存錢 🐷、3C 時間 ⏱️、今日行程 🎒、習慣打卡 🔥)依序彈入、帶閃光。預設 2200ms(只能做一次)
//   { "spread": true }    手機淡出,前三張功能磚飛到三格、展開成大卡(存錢、3C 時間、今日行程)。預設 1000ms(要先 build)
//   { "deposit": 200 }    第 1 格亮(其他格變暗):硬幣落進存錢罐,金額跳動上升,進度條長到新值,
//                         標籤「腳踏車基金 75%」;剛好達標時噴彩帶、出現「達標！」。預設 1100ms(要先 spread)
//   { "timer": 30 }       第 2 格亮:圓環從 30:00 加速倒數到 0,顏色由橘轉綠,出現「時間到，休息一下 🌿」,
//                         平板自動上鎖變暗。預設 1400ms(要先 spread)
//   { "tick": "帶水壺" }   第 3 格亮:清單那一項打勾(勾勾畫出)、文字變淡劃線;全部勾完出現「準備好了！」。
//                         預設 600ms(要先 spread;項目要在 todo 裡、還沒勾過)
//   { "habit": 7 }        三格收起,換成習慣打卡大卡:一週日曆一格格蓋章、火焰數字跳到 7、「連續 7 天 🔥」、
//                         彩帶噴發、旁邊孩子開心的臉。預設 2600ms(要先 build;天數 1–7、不能比目前少)
//
// 狀態:layout(none → ask → phone → strips → habit)、built、saved、timer(最後一次倒數的分鐘)、timerDone、
//       ticked(已勾的項目)、streak(連續打卡天數)、lit(目前亮的格子 1–3,null 是都亮)
//
// 目標:window、phone、strip:1、strip:2、strip:3、habit
import { kit } from '../../../../live/kit'
import { defineActor, type ActorEvent, type CommonStepFields } from '../../../../live/types'
import { DESIGN, MID_X, SAFE, STRIP_RADIUS, STRIPS as STRIP_BOXES } from '../../anchors'
import './actor.css'

// ---------- 型別 ----------
export interface HubProps {
  name?: string
  goal?: number
  saved?: number
  todo?: string[]
  fund?: string
  /** 不畫自己的背景,只畫前景(場景用) */
  bare?: boolean
}
const KINDS = ['ask', 'build', 'spread', 'deposit', 'timer', 'tick', 'habit'] as const
type Kind = (typeof KINDS)[number]
export type HubStep = CommonStepFields & {
  ask?: string
  build?: true
  spread?: true
  deposit?: number
  timer?: number
  tick?: string
  habit?: number
}
type Target = 'window' | 'phone' | 'strip:1' | 'strip:2' | 'strip:3' | 'habit'
type Layout = 'none' | 'ask' | 'phone' | 'strips' | 'habit'
type Lit = 1 | 2 | 3 | null
export interface HubState {
  layout: Layout
  built: boolean
  saved: number
  timer: number | null
  timerDone: boolean
  ticked: string[]
  streak: number
  lit: Lit
  /** 今日行程清單(來自 props,tick 用來檢查) */
  todo: string[]
  temp: Record<string, never>
}

// ---------- 預設長度(毫秒);動畫內部的時間點都以預設長度為準,腳本寫 ms 時依比例縮放 ----------
const D: Record<Kind, number> = { ask: 2600, build: 2200, spread: 1000, deposit: 1100, timer: 1400, tick: 600, habit: 2600 }

const DEF = { name: '小宇的小管家', goal: 2000, saved: 1300, todo: ['帶水壺', '美術用品', '聯絡簿簽名'], fund: '腳踏車基金' }
const propsOf = (p: HubProps) => ({
  name: p.name ?? DEF.name,
  goal: p.goal ?? DEF.goal,
  saved: p.saved ?? DEF.saved,
  todo: p.todo ?? DEF.todo,
  fund: p.fund ?? DEF.fund,
})

// ---------- 狀態 ----------
function apply(st: HubState, kind: Kind, s: HubStep): HubState {
  const needStrips = (what: string): void => {
    if (!st.built) throw new Error(`${what}:小管家還沒做好,先 build`)
    if (st.layout !== 'strips') throw new Error(`${what}:要先 spread 把功能展開成三格(目前是 ${st.layout === 'habit' ? '習慣打卡卡片' : st.layout === 'phone' ? '手機畫面' : '還沒做好'})`)
  }
  switch (kind) {
    case 'ask':
      if (typeof s.ask !== 'string' || !s.ask.trim()) throw new Error('ask 要寫想請 AI 做的事(字串)')
      if (st.built) throw new Error('ask:小管家已經做好了,ask 要放在 build 之前')
      return { ...st, layout: 'ask', lit: null }
    case 'build':
      if (s.build !== true) throw new Error('build 要寫 true')
      if (st.built) throw new Error('build:小管家已經做好了')
      return { ...st, built: true, layout: 'phone', lit: null }
    case 'spread':
      if (s.spread !== true) throw new Error('spread 要寫 true')
      if (!st.built) throw new Error('spread:小管家還沒做好,先 build')
      if (st.layout !== 'phone') throw new Error('spread:要在手機畫面時才能展開(已經展開過了)')
      return { ...st, layout: 'strips', lit: null }
    case 'deposit': {
      const n = s.deposit
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) throw new Error('deposit 要寫正數的金額,例如 200')
      needStrips('deposit')
      return { ...st, saved: st.saved + n, lit: 1 }
    }
    case 'timer': {
      const n = s.timer
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 180) throw new Error('timer 要寫 1–180 的分鐘數,例如 30')
      needStrips('timer')
      return { ...st, timer: n, timerDone: true, lit: 2 }
    }
    case 'tick': {
      if (typeof s.tick !== 'string' || !s.tick) throw new Error('tick 要寫清單裡的項目名稱')
      needStrips('tick')
      if (!st.todo.includes(s.tick)) throw new Error(`tick:清單裡沒有「${s.tick}」(有:${st.todo.join('、')})`)
      if (st.ticked.includes(s.tick)) throw new Error(`tick:「${s.tick}」已經勾過了`)
      return { ...st, ticked: [...st.ticked, s.tick], lit: 3 }
    }
    case 'habit': {
      const n = s.habit
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 7) throw new Error('habit 要寫 1–7 的天數')
      if (!st.built) throw new Error('habit:小管家還沒做好,先 build')
      if (n < st.streak) throw new Error(`habit:已經連續 ${st.streak} 天了,不能變少`)
      return { ...st, streak: n, layout: 'habit', lit: null }
    }
  }
}

const kindIn = (kind: string, step: object): Kind | null =>
  (KINDS as readonly string[]).includes(kind) ? (kind as Kind) : kind === 'show' || kind === 'hide' || kind === 'props' ? (KINDS.find((k) => k in step) ?? null) : null

// ---------- 版面(直式設計座標) ----------
type R = { x: number; y: number; w: number; h: number }
const STRIPS: readonly R[] = STRIP_BOXES
/** 手機內部照 620×1240 排版,整支縮放 PS 倍顯示在 PHONE_AT(以中線置中、寬 610、y 270–1490) */
const PHONE: R = { x: 0, y: 0, w: 620, h: 1240 }
const PS = 610 / 620
const PHONE_AT: R = { x: MID_X - 610 / 2, y: 270, w: 610, h: 1220 }
const BEZEL = 22
/** 功能磚在手機螢幕裡的位置(相對螢幕) */
const TILE_REL: R[] = [
  { x: 36, y: 300, w: 240, h: 250 },
  { x: 300, y: 300, w: 240, h: 250 },
  { x: 36, y: 574, w: 240, h: 250 },
  { x: 300, y: 574, w: 240, h: 250 },
]
const TILE_ABS: R[] = TILE_REL.map((r) => ({ x: PHONE_AT.x + (BEZEL + r.x) * PS, y: PHONE_AT.y + (BEZEL + r.y) * PS, w: r.w * PS, h: r.h * PS }))
const ASK: R = { x: SAFE.x, y: 300, w: SAFE.w, h: 500 }
/** 習慣打卡卡片照 1000×1380 排版,縮放 HS 倍(寬剛好是安全區寬)放在安全區左上 */
const HS = SAFE.w / 1000
const HABIT: R = { x: SAFE.x, y: SAFE.y, w: 1000 * HS, h: 1380 * HS }

const C = { save: '#ff8a5b', screen: '#3fb68b', plan: '#4f7cff', habit: '#ff5d73', orange: '#ff9f43' }
const FEATURES = [
  { emoji: '🐷', label: '存錢', color: C.save },
  { emoji: '⏱️', label: '3C 時間', color: C.screen },
  { emoji: '🎒', label: '今日行程', color: C.plan },
  { emoji: '🔥', label: '習慣打卡', color: C.habit },
]
const DAYS = ['一', '二', '三', '四', '五', '六', '日']
const CONFETTI_COLORS = ['#ff5d73', '#ff8a5b', '#ffc93c', '#3fb68b', '#4f7cff', '#b07cff', '#ffffff']

// ---------- 小工具 ----------
const P = kit.progress
const E = kit.ease
const lerp = kit.lerp
const f = (n: number, d = 3): string => n.toFixed(d)
function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a: string, b: string, p: number): string {
  const x = hex(a)
  const y = hex(b)
  return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], kit.clamp(p)))).join(',')})`
}
const lerpRect = (a: R, b: R, p: number): R => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) })
const place = (el: HTMLElement, r: R): void =>
  kit.css(el, { left: `${f(r.x, 2)}px`, top: `${f(r.y, 2)}px`, width: `${f(r.w, 2)}px`, height: `${f(r.h, 2)}px` })
/** 彈性彈入:0 → 1,中途超過一點再回來 */
const pop = (t: number, start: number, dur: number): number => E.outBack(P(t, start, dur))
const money = (n: number): string => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const mmss = (sec: number): string => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/** 彩帶:預先建好的小紙片,依時間算拋物線位置(固定種子) */
type Piece = { el: HTMLElement; vx: number; vy: number; spin: number; rot: number; delay: number; sway: number }
function makeConfetti(layer: HTMLElement, count: number, seed: number, cone: [number, number], speed: [number, number]): Piece[] {
  const r = kit.rand(seed)
  const pieces: Piece[] = []
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i')
    const w = 12 + r() * 12
    const round = r() < 0.25
    el.style.width = `${f(w, 1)}px`
    el.style.height = `${f(round ? w : w * 0.5, 1)}px`
    el.style.background = CONFETTI_COLORS[Math.floor(r() * CONFETTI_COLORS.length)]
    if (round) el.style.borderRadius = '50%'
    layer.appendChild(el)
    const ang = lerp(cone[0], cone[1], r()) * (Math.PI / 180)
    const sp = lerp(speed[0], speed[1], r())
    pieces.push({ el, vx: Math.cos(ang) * sp, vy: -Math.sin(ang) * sp, spin: lerp(-0.9, 0.9, r()), rot: r() * 360, delay: r() * 120, sway: r() * 6 })
  }
  return pieces
}
/** t:從噴發開始的毫秒;x、y:噴發點 */
function drawConfetti(pieces: Piece[], t: number, x: number, y: number, life = 2400): void {
  const g = 0.0016
  for (const p of pieces) {
    const tt = t - p.delay
    if (tt <= 0 || tt > life) {
      kit.setIf(p.el, 'opacity', '0')
      continue
    }
    // 空氣阻力:速度隨時間衰減,看起來像紙片飄落
    const k = 1 - Math.exp(-tt / 650)
    const px = x + p.vx * 650 * k + Math.sin(tt / 180 + p.sway) * 10
    const py = y + p.vy * 650 * k + 0.5 * g * tt * tt * 0.55
    const o = 1 - P(tt, life * 0.7, life * 0.3)
    kit.css(p.el, { opacity: f(o), transform: `translate(${f(px, 1)}px, ${f(py, 1)}px) rotate(${f(p.rot + p.spin * tt, 1)}deg) rotateX(${f(tt * 0.5, 1)}deg)` })
  }
}

// ---------- 插圖(SVG) ----------
const PIGGY = `<svg viewBox="0 0 320 300" aria-hidden="true">
<ellipse cx="160" cy="276" rx="110" ry="14" fill="rgba(160,90,60,.16)"/>
<path d="M62 150c-26-6-34 18-20 26" fill="none" stroke="#ff9fb2" stroke-width="10" stroke-linecap="round"/>
<rect x="88" y="214" width="34" height="56" rx="14" fill="#ff9fb2"/><rect x="196" y="214" width="34" height="56" rx="14" fill="#ff9fb2"/>
<ellipse cx="160" cy="170" rx="118" ry="96" fill="#ffb8c6"/>
<path d="M188 92l26-42 14 50z" fill="#ff9fb2"/>
<ellipse cx="124" cy="140" rx="54" ry="30" fill="rgba(255,255,255,.35)"/>
<ellipse cx="270" cy="182" rx="34" ry="28" fill="#ff9fb2"/><circle cx="260" cy="180" r="6" fill="#d9677f"/><circle cx="280" cy="180" r="6" fill="#d9677f"/>
<circle cx="226" cy="150" r="10" fill="#4a2a33"/><circle cx="229" cy="146" r="3.5" fill="#fff"/>
<ellipse cx="214" cy="196" rx="16" ry="9" fill="#ff8fa8" opacity=".7"/>
<rect x="128" y="80" width="78" height="14" rx="7" fill="#c75a75"/>
</svg>`
const TABLET = `<svg viewBox="0 0 170 230" aria-hidden="true">
<rect x="4" y="4" width="162" height="222" rx="26" fill="#2f3542"/>
<rect class="kh-tab-screen" x="16" y="18" width="138" height="186" rx="12" fill="#7fb8ff"/>
<g class="kh-tab-apps"><rect x="32" y="40" width="40" height="40" rx="10" fill="#ffd166"/><rect x="98" y="40" width="40" height="40" rx="10" fill="#ff6b8b"/>
<rect x="32" y="102" width="40" height="40" rx="10" fill="#8ce99a"/><rect x="98" y="102" width="40" height="40" rx="10" fill="#b197fc"/></g>
<circle cx="85" cy="216" r="5" fill="#57606f"/>
</svg>`
const LOCK = `<svg viewBox="0 0 80 96" aria-hidden="true"><path d="M20 42V30a20 20 0 0140 0v12" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><rect x="8" y="40" width="64" height="50" rx="14" fill="#fff"/><circle cx="40" cy="62" r="7" fill="#3fb68b"/><rect x="37" y="64" width="6" height="14" rx="3" fill="#3fb68b"/></svg>`
const CHECK = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="kh-chk-bg" cx="32" cy="32" r="28"/><path class="kh-chk-path" d="M18 33 L28 43 L47 22" pathLength="1"/></svg>`
const FLAME = `<svg viewBox="0 0 260 300" aria-hidden="true"><defs>
<linearGradient id="khFlameA" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5d73"/><stop offset=".6" stop-color="#ff8a5b"/><stop offset="1" stop-color="#ffc93c"/></linearGradient>
<linearGradient id="khFlameB" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#fff1a8"/></linearGradient></defs>
<path class="kh-flame-out" d="M130 10c20 50 86 86 86 168a86 86 0 01-172 0c0-50 30-74 44-110 8 26 22 38 34 42-8-36 0-70 8-100z" fill="url(#khFlameA)"/>
<path class="kh-flame-in" d="M132 120c10 30 52 52 52 98a52 52 0 01-104 0c0-30 18-44 26-64 6 16 14 22 20 24-4-22 2-40 6-58z" fill="url(#khFlameB)" opacity=".85"/>
</svg>`
const KID = `<svg viewBox="0 0 340 340" aria-hidden="true">
<circle cx="170" cy="182" r="128" fill="#ffd9b8"/>
<path d="M44 168c-6-86 58-128 126-128s138 44 126 126c-24-30-56-44-86-46 6 14 4 26-4 34-14-24-44-38-86-36-30 2-58 18-76 50z" fill="#4a3428"/>
<ellipse cx="44" cy="190" rx="16" ry="22" fill="#ffc9a0"/><ellipse cx="296" cy="190" rx="16" ry="22" fill="#ffc9a0"/>
<path class="kh-eye" d="M104 178q22-26 44 0" fill="none" stroke="#3a2a22" stroke-width="10" stroke-linecap="round"/>
<path class="kh-eye" d="M192 178q22-26 44 0" fill="none" stroke="#3a2a22" stroke-width="10" stroke-linecap="round"/>
<ellipse cx="98" cy="222" rx="24" ry="14" fill="#ff9aa8" opacity=".75"/><ellipse cx="242" cy="222" rx="24" ry="14" fill="#ff9aa8" opacity=".75"/>
<path d="M124 220q46 70 92 0z" fill="#9c3446"/><path d="M144 248q26 20 52 0q-26-14-52 0z" fill="#ff7c8f"/>
<path d="M124 220h92" stroke="#9c3446" stroke-width="6" stroke-linecap="round"/>
</svg>`
const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0l2.8 9.2L24 12l-9.2 2.8L12 24l-2.8-9.2L0 12l9.2-2.8z"/></svg>`

// ---------- 演員 ----------
const actor = defineActor<Kind, HubStep, HubProps, HubState, Target>({
  name: 'kid-hub',
  kinds: KINDS,

  init(props) {
    const p = propsOf(props)
    if (typeof p.name !== 'string' || !p.name) throw new Error('name 要是字串')
    if (!(typeof p.goal === 'number' && p.goal > 0)) throw new Error('goal 要是正數')
    if (!(typeof p.saved === 'number' && p.saved >= 0)) throw new Error('saved 要是 0 以上的數字')
    if (!Array.isArray(p.todo) || p.todo.length < 1 || p.todo.length > 5 || p.todo.some((x) => typeof x !== 'string' || !x)) throw new Error('todo 要是 1–5 個字串')
    if (new Set(p.todo).size !== p.todo.length) throw new Error('todo 的項目不能重複')
    if (props.bare != null && typeof props.bare !== 'boolean') throw new Error('bare 要寫 true 或 false')
    return { layout: 'none', built: false, saved: p.saved, timer: null, timerDone: false, ticked: [], streak: 0, lit: null, todo: [...p.todo], temp: {} }
  },
  apply,
  duration(kind) {
    return D[kind]
  },

  mount(root, props) {
    const p = propsOf(props)
    const kidName = /^(.+?)的/.exec(p.name)?.[1]
    const bare = props.bare === true
    root.classList.add('A-kid-hub')

    const tileHtml = FEATURES.map(
      (ft, i) =>
        `<div class="kh-tile" data-i="${i}" style="--c:${ft.color};left:${TILE_REL[i].x}px;top:${TILE_REL[i].y}px;width:${TILE_REL[i].w}px;height:${TILE_REL[i].h}px">` +
        `<span class="kh-tile-emoji">${ft.emoji}</span><b>${ft.label}</b><span class="kh-glint"></span>` +
        `<span class="kh-sparks">${Array.from({ length: 5 }, () => `<i>${STAR}</i>`).join('')}</span></div>`,
    ).join('')
    const skelHtml =
      `<i style="left:36px;top:96px;width:260px;height:34px"></i><i style="left:36px;top:150px;width:380px;height:60px"></i>` +
      TILE_REL.map((r) => `<i style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;border-radius:40px"></i>`).join('') +
      `<i style="left:36px;top:860px;width:504px;height:190px;border-radius:36px"></i>`
    const titleSize = Math.min(56, Math.floor(480 / Math.max(1, kit.graphemes(p.name).length)))

    const todoHtml = p.todo
      .map((t) => `<div class="kh-todo"><span class="kh-chk">${CHECK}</span><span class="kh-todo-text">${kit.esc(t)}<i class="kh-strike"></i></span></div>`)
      .join('')

    const stripHtml = [0, 1, 2]
      .map((i) => {
        const ft = FEATURES[i]
        let body = ''
        if (i === 0)
          body =
            `<div class="kh-pig">${PIGGY}<div class="kh-coin">$</div><div class="kh-plus"></div></div>` +
            `<div class="kh-s-head"><span>${ft.emoji} ${ft.label}</span><small class="kh-goal">目標 ${money(p.goal)} 元</small></div>` +
            `<div class="kh-amount"><b class="kh-amount-num"></b><span>元</span></div>` +
            `<div class="kh-bar"><i class="kh-bar-fill"><s class="kh-bar-shine"></s></i></div>` +
            `<div class="kh-bar-label"></div>` +
            `<div class="kh-badge kh-goal-badge">達標！🎉</div><div class="kh-confetti kh-save-confetti"></div>`
        else if (i === 1)
          body =
            `<div class="kh-ring"><svg viewBox="0 0 360 360" aria-hidden="true"><circle class="kh-ring-track" cx="180" cy="180" r="150"/>` +
            `<circle class="kh-ring-arc" cx="180" cy="180" r="150" pathLength="1"/></svg><div class="kh-ring-time"></div><div class="kh-ring-sub">今天的 3C 時間</div></div>` +
            `<div class="kh-s-head kh-s-head-2"><span>${ft.emoji} ${ft.label}</span></div>` +
            `<div class="kh-timer-status"></div>` +
            `<div class="kh-rest">時間到，<br>休息一下 🌿</div>` +
            `<div class="kh-tablet">${TABLET}<div class="kh-lock">${LOCK}</div></div>` +
            `<div class="kh-leaves">${Array.from({ length: 6 }, () => '<i>🍃</i>').join('')}</div>`
        else
          body =
            `<div class="kh-s-head"><span>${ft.emoji} ${ft.label}</span><small class="kh-todo-count"></small></div>` +
            `<div class="kh-todos" style="--n:${p.todo.length}">${todoHtml}</div>` +
            `<div class="kh-bag">🎒</div>` +
            `<div class="kh-badge kh-ready">準備好了！</div><div class="kh-sparks kh-ready-sparks">${Array.from({ length: 8 }, () => `<i>${STAR}</i>`).join('')}</div>`
        return (
          `<div class="kh-strip" data-i="${i}" style="--c:${ft.color}"><div class="kh-tint"></div><div class="kh-accent"></div>` +
          `<div class="kh-mini"><span class="kh-tile-emoji">${ft.emoji}</span><b>${ft.label}</b></div>` +
          `<div class="kh-full kh-full-${i + 1}">${body}</div></div>`
        )
      })
      .join('')

    const habitHtml =
      `<div class="kh-habit" style="--c:${C.habit}">` +
      `<div class="kh-h-head">🔥 習慣打卡<small>每天睡前讀 10 分鐘書</small></div>` +
      `<div class="kh-flame">${FLAME}<b class="kh-flame-num"></b></div>` +
      `<div class="kh-kid">${KID}<div class="kh-kid-stars">${Array.from({ length: 4 }, () => `<i>${STAR}</i>`).join('')}</div></div>` +
      `<div class="kh-streak"></div>` +
      `<div class="kh-week">${DAYS.map((d) => `<div class="kh-day"><span>${d}</span><div class="kh-slot"><div class="kh-stamp">🔥</div><div class="kh-stamp-ring"></div></div></div>`).join('')}</div>` +
      `<div class="kh-h-foot">每天一點點，越來越棒</div>` +
      `</div>`

    root.innerHTML =
      (bare
        ? ''
        : `<div class="kh-bg"><div class="kh-glow"></div><div class="kh-glow"></div><div class="kh-glow"></div><div class="kh-glow"></div>` +
          `<div class="kh-motes">${Array.from({ length: 18 }, () => '<i></i>').join('')}</div></div>`) +
      `<div class="kh-box" style="width:${DESIGN.w}px;height:${DESIGN.h}px">` +
      `<div class="kh-phone-at" style="left:${PHONE_AT.x}px;top:${PHONE_AT.y}px;transform:scale(${PS})">` +
      `<div class="kh-phone" style="left:0;top:0;width:${PHONE.w}px;height:${PHONE.h}px"><div class="kh-screen">` +
      `<div class="kh-status"><span>7:30</span><i class="kh-notch"></i><span>●●● 🔋</span></div>` +
      `<div class="kh-skel">${skelHtml}<span class="kh-skel-shine"></span></div>` +
      `<div class="kh-hello">${kidName ? `早安，${kit.esc(kidName)} ☀️` : '早安 ☀️'}</div>` +
      `<div class="kh-title" style="font-size:${titleSize}px">${kit.graphemes(p.name).map((c) => `<span>${kit.esc(c)}</span>`).join('')}</div>` +
      tileHtml +
      `<div class="kh-today"><b>今天的小目標</b><div class="kh-today-dots"><i></i><i></i><i></i></div><span>一起完成吧！</span></div>` +
      `<div class="kh-nav"><i></i><i></i><i></i><i></i></div>` +
      `</div><div class="kh-phone-glow"></div></div></div>` +
      // 開場:請 AI 做 App 的輸入框
      `<div class="kh-ask" style="left:${ASK.x}px;top:${ASK.y}px;width:${ASK.w}px;min-height:${ASK.h}px">` +
      `<div class="kh-ask-label">✨ 告訴 AI 你想做什麼</div><div class="kh-ask-text"><span class="kh-ask-typed"></span><i class="kh-caret"></i></div>` +
      `<div class="kh-send"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 36V13M13 23l11-11 11 11" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>` +
      `<div class="kh-working" style="left:${SAFE.x}px;width:${SAFE.w}px"><div class="kh-working-text">AI 正在動手做<span class="kh-working-dots"></span></div>` +
      `<div class="kh-working-sparks">${Array.from({ length: 14 }, () => `<i>${STAR}</i>`).join('')}</div></div>` +
      `<div class="kh-strips">${stripHtml}</div>` +
      `<div class="kh-habit-at" style="left:${HABIT.x}px;top:${HABIT.y}px;transform:scale(${HS})">` + habitHtml + `</div>` +
      `<div class="kh-confetti kh-big-confetti"></div>` +
      `</div>` +
      // 目標的替身:量位置用(設計盒有縮放,offset 量不到縮放後的位置)
      `<div class="kh-proxy" data-t="phone"></div><div class="kh-proxy" data-t="strip:1"></div><div class="kh-proxy" data-t="strip:2"></div>` +
      `<div class="kh-proxy" data-t="strip:3"></div><div class="kh-proxy" data-t="habit"></div>`

    const $ = <El extends Element = HTMLElement>(s: string, r: ParentNode = root): El => r.querySelector<El>(s)!
    const $$ = <El extends Element = HTMLElement>(s: string, r: ParentNode = root): El[] => [...r.querySelectorAll<El>(s)]
    const box = $('.kh-box')
    const glows = $$('.kh-glow')
    const motes = $$('.kh-motes i')
    const phone = $('.kh-phone')
    const askBox = $('.kh-ask')
    const askTyped = $('.kh-ask-typed')
    const caret = $('.kh-caret')
    const send = $('.kh-send')
    const working = $('.kh-working')
    const workingText = $('.kh-working-text')
    const workingDots = $('.kh-working-dots')
    const workingSparks = $$('.kh-working-sparks i')
    const phoneGlow = $('.kh-phone-glow')
    const skel = $('.kh-skel')
    const skelShine = $('.kh-skel-shine')
    const hello = $('.kh-hello')
    const titleChars = $$('.kh-title span')
    const tiles = $$('.kh-tile')
    const today = $('.kh-today')
    const todayDots = $$('.kh-today-dots i')
    const nav = $('.kh-nav')
    const strips = $$('.kh-strip')
    const stripsWrap = $('.kh-strips')
    const s1 = $('.kh-full-1')
    const s2 = $('.kh-full-2')
    const s3 = $('.kh-full-3')
    const pig = $('.kh-pig svg', s1)
    const coin = $('.kh-coin', s1)
    const plus = $('.kh-plus', s1)
    const amount = $('.kh-amount-num', s1)
    const amountWrap = $('.kh-amount', s1)
    const barFill = $('.kh-bar-fill', s1)
    const barShine = $('.kh-bar-shine', s1)
    const barLabel = $('.kh-bar-label', s1)
    const goalBadge = $('.kh-goal-badge', s1)
    const goalText = $('.kh-goal', s1)
    const saveConfetti = makeConfetti($('.kh-save-confetti', s1), 36, 11, [35, 145], [0.35, 0.8])
    const ringArc = $<SVGCircleElement>('.kh-ring-arc', s2)
    const ring = $('.kh-ring', s2)
    const ringTime = $('.kh-ring-time', s2)
    const timerStatus = $('.kh-timer-status', s2)
    const rest = $('.kh-rest', s2)
    const tablet = $('.kh-tablet', s2)
    const tabScreen = $<SVGRectElement>('.kh-tab-screen', s2)
    const tabApps = $<SVGGElement>('.kh-tab-apps', s2)
    const lock = $('.kh-lock', s2)
    const leaves = $$('.kh-leaves i', s2)
    const todos = $$('.kh-todo', s3)
    const todoCount = $('.kh-todo-count', s3)
    const bag = $('.kh-bag', s3)
    const ready = $('.kh-ready', s3)
    const readySparks = $$('.kh-ready-sparks i', s3)
    const habit = $('.kh-habit')
    const flame = $('.kh-flame')
    const flameNum = $('.kh-flame-num')
    const flameOut = $<SVGPathElement>('.kh-flame-out')
    const kid = $('.kh-kid')
    const kidStars = $$('.kh-kid-stars i')
    const streakText = $('.kh-streak')
    const days = $$('.kh-day')
    const hHead = $('.kh-h-head')
    const hFoot = $('.kh-h-foot')
    const bigConfetti = [
      ...makeConfetti($('.kh-big-confetti'), 50, 21, [55, 85], [1.1, 1.9]),
      ...makeConfetti($('.kh-big-confetti'), 50, 22, [95, 125], [1.1, 1.9]),
    ]
    const half = bigConfetti.length / 2
    const proxies = Object.fromEntries($$('.kh-proxy').map((el) => [el.dataset.t!, el])) as Record<string, HTMLElement>

    // 演員根元素的大小:大小改變時才重算,不在每一格量版面
    let size: { w: number; h: number } | null = null
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(([e]) => {
        if (!root.isConnected) return ro.disconnect()
        const { width, height } = e.contentRect
        if (width > 0 && height > 0) size = { w: width, h: height }
      })
      ro.observe(root)
    }
    const sizeNow = (): { w: number; h: number } => {
      if (!size && root.offsetWidth > 0) size = { w: root.offsetWidth, h: root.offsetHeight }
      return size ?? { w: DESIGN.w, h: DESIGN.h }
    }

    // ---------- 背景:暖色漸層 + 緩慢飄動的柔光 + 浮塵 ----------
    function renderBg(ms: number, W: number, H: number): void {
      const base: [number, number, number][] = [
        [0.2, 0.15, 0.9],
        [0.85, 0.35, 0.75],
        [0.3, 0.7, 1],
        [0.75, 0.9, 0.8],
      ]
      glows.forEach((g, i) => {
        const [bx, by, sc] = base[i]
        const x = (bx + kit.noise(ms / 5200 + i * 3.1, 3 + i) * 0.12) * W
        const y = (by + kit.noise(ms / 6100 + i * 1.7, 9 + i) * 0.1) * H
        const s = sc * (1 + 0.12 * Math.sin(ms / 2600 + i))
        kit.css(g, { transform: `translate(${f(x, 1)}px, ${f(y, 1)}px) translate(-50%, -50%) scale(${f(s)})` })
      })
      const r = kit.rand(5)
      motes.forEach((m) => {
        const x0 = r() * W
        const speed = 0.012 + r() * 0.02
        const y = H - ((r() * H + ms * speed) % (H + 40))
        const x = x0 + Math.sin(ms / 1900 + x0) * 18
        const o = 0.25 + 0.45 * kit.pulse(ms + x0 * 7, 2600 + x0)
        kit.css(m, { transform: `translate(${f(x, 1)}px, ${f(y, 1)}px)`, opacity: f(o) })
      })
    }

    // ---------- 開場:請 AI 做 App ----------
    const ASK_T = { type0: 250, type1: 1500, press: 1640, fly: 1860, flyDur: 420, work: 2040 }
    function renderAsk(st: HubState, prev: HubState, kind: Kind | null, step: HubStep | null, t: number, ms: number): void {
      const going = kind === 'ask'
      // 輸入框:只在 ask 演出中看得到(演完已經飄走)
      kit.setIf(askBox, 'display', going ? 'block' : 'none')
      if (going && step) {
        const g = kit.graphemes(String(step.ask ?? ''))
        const n = Math.round(g.length * E.inOutQuad(P(t, ASK_T.type0, ASK_T.type1 - ASK_T.type0)))
        kit.setIf(askTyped, 'text', g.slice(0, n).join(''))
        kit.css(caret, { opacity: t < ASK_T.press && (n < g.length || kit.blink(t, 700)) ? '1' : '0' })
        const sp = kit.spring(t, { stiffness: 200, damping: 18 })
        const fly = E.inCubic(P(t, ASK_T.fly, ASK_T.flyDur))
        kit.css(askBox, {
          opacity: f(P(t, 0, 220) * (1 - fly)),
          transform: `translateY(${f((1 - sp) * 60 - fly * 520, 1)}px) scale(${f(lerp(0.94, 1, sp) * lerp(1, 0.35, fly), 4)})`,
        })
        // 送出鈕:打完字亮起,按下壓扁再回彈
        const ready = P(t, ASK_T.type1 - 100, 200)
        const down = t >= ASK_T.press && t < ASK_T.press + 90 ? P(t, ASK_T.press, 90) : 0
        const back = t >= ASK_T.press + 90 ? 1 - kit.spring(t - ASK_T.press - 90, { stiffness: 420, damping: 12 }) : 0
        kit.css(send, { background: mix('#d9cfc6', '#ff8a5b', ready), transform: `scale(${f(down > 0 ? 1 - 0.2 * down : 1 - 0.2 * back, 4)})` })
      }
      // 「AI 正在動手做…」:送出後出現,停在畫面上直到 build 開始時淡出
      let wo = 0
      let wt = Infinity
      if (going) {
        wo = P(t, ASK_T.work, 300)
        wt = t - ASK_T.work
      } else if (st.layout === 'ask') wo = 1
      else if (kind === 'build' && prev.layout === 'ask') wo = 1 - P(t, 0, 320)
      kit.setIf(working, 'display', wo > 0 ? 'block' : 'none')
      if (wo <= 0) return
      const wp = Number.isFinite(wt) ? pop(wt, 0, 380) : 1
      kit.css(workingText, { opacity: f(kit.clamp(wo)), transform: `scale(${f(lerp(0.7, 1, wp), 3)})` })
      kit.setIf(workingDots, 'text', kit.dots(ms, 320))
      const sr = kit.rand(123)
      workingSparks.forEach((sEl, i) => {
        const a = sr() * Math.PI * 2
        const rad = 230 + sr() * 160
        const ph = sr() * 1600
        const delay = sr() * 120
        // 先往外爆開,之後繞著文字慢慢轉、一閃一閃
        const burst = Number.isFinite(wt) ? E.outCubic(P(wt, delay, 500)) : 1
        const ang = a + ms / (1800 + i * 90)
        const tw = kit.pulse(ms + ph, 900 + i * 40)
        kit.css(sEl, {
          opacity: f(wo * (0.3 + 0.7 * tw) * Math.min(1, burst * 2)),
          transform: `translate(${f(Math.cos(ang) * rad * burst, 1)}px, ${f(Math.sin(ang) * rad * 0.42 * burst, 1)}px) scale(${f(0.5 + 0.8 * tw, 3)}) rotate(${f(((ms + ph) / 8) % 360, 1)}deg)`,
        })
      })
    }

    // ---------- 手機 ----------
    function renderPhone(st: HubState, prev: HubState, kind: Kind | null, t: number, ms: number): void {
      let alpha = st.layout === 'phone' ? 1 : 0
      let scale = 1
      let lift = 0
      const bt = kind === 'build' ? t : Infinity
      if (kind === 'build') {
        const sp = kit.spring(t, { stiffness: 190, damping: 17 })
        alpha = P(t, 0, 260)
        scale = lerp(0.86, 1, sp)
        lift = (1 - sp) * 80
      } else if (kind === 'spread') {
        alpha = 1 - E.inCubic(P(t, 80, 420))
        scale = lerp(1, 0.94, E.outCubic(P(t, 0, 500)))
      } else if (kind === 'habit' && prev.layout === 'phone') {
        alpha = 1 - P(t, 0, 400)
        scale = lerp(1, 0.92, P(t, 0, 400))
      }
      kit.setIf(phone, 'display', alpha > 0 ? '' : 'none')
      if (alpha <= 0) return
      kit.css(phone, { opacity: f(alpha), transform: `translateY(${f(lift, 1)}px) scale(${f(scale, 4)})` })

      // 骨架閃一下
      const sk = Number.isFinite(bt) ? Math.min(P(bt, 80, 120), 1 - P(bt, 430, 180)) * (0.75 + 0.25 * Math.sin(bt / 60)) : 0
      kit.css(skel, { opacity: f(sk) })
      kit.css(skelShine, { transform: `translateX(${f(lerp(-120, 120, P(bt, 80, 480)), 1)}%)` })
      // 標題逐字浮現
      kit.css(hello, kit.enter(P(bt, 300, 350), { dist: '0.6em' }))
      titleChars.forEach((el, i) => kit.css(el, kit.blurIn(P(bt, 360 + i * 45, 340))))
      // 功能磚依序彈入、閃光
      tiles.forEach((el, i) => {
        if (kind === 'spread' && i < 3) {
          kit.setIf(el, 'opacity', '0')
          return
        }
        const st0 = 520 + i * 150
        const pp = pop(bt, st0, 420)
        const o = P(bt, st0, 160)
        kit.css(el, { opacity: f(o), transform: `translateY(${f((1 - pp) * 60, 1)}px) scale(${f(lerp(0.5, 1, pp), 4)})` })
        const g = P(bt, st0 + 220, 480)
        kit.css(el.querySelector<HTMLElement>('.kh-glint')!, { opacity: g > 0 && g < 1 ? '1' : '0', backgroundPosition: `${f(lerp(130, -30, E.inOutCubic(g)), 1)}% 0` })
        const sparks = [...el.querySelectorAll<HTMLElement>('.kh-sparks i')]
        const sr = kit.rand(40 + i)
        sparks.forEach((sEl) => {
          const a = sr() * Math.PI * 2
          const dist = 70 + sr() * 70
          const q = P(bt, st0 + 160 + sr() * 120, 480)
          const e = E.outCubic(q)
          kit.css(sEl, {
            opacity: f(q > 0 && q < 1 ? Math.sin(q * Math.PI) : 0),
            transform: `translate(${f(Math.cos(a) * dist * e, 1)}px, ${f(Math.sin(a) * dist * e, 1)}px) scale(${f(0.4 + 0.8 * Math.sin(q * Math.PI))}) rotate(${f(q * 90, 1)}deg)`,
          })
        })
      })
      kit.css(today, kit.enter(P(bt, 1250, 350), { dist: '1em' }))
      todayDots.forEach((d, i) => kit.setIf(d, 'transform', `scale(${f(pop(bt, 1380 + i * 80, 300), 3)})`))
      kit.css(nav, { opacity: f(P(bt, 1200, 300)) })
      // 做好時整支手機亮一下
      const done = P(bt, 1700, 400)
      kit.css(phoneGlow, { opacity: f(done > 0 && done < 1 ? Math.sin(done * Math.PI) * 0.9 : st.layout === 'phone' && kind !== 'spread' ? 0.25 + 0.15 * kit.pulse(ms, 2400) : 0) })
    }

    // ---------- 三格 ----------
    const dimOf = (i: number, lit: Lit): number => (lit == null ? 0 : lit === i + 1 ? 0 : 1)
    function renderStrips(st: HubState, prev: HubState, kind: Kind | null, step: HubStep | null, t: number, ms: number, events: ActorEvent[]): void {
      const collapsing = kind === 'habit' && prev.layout === 'strips'
      const show = st.layout === 'strips' || collapsing
      kit.setIf(stripsWrap, 'display', show ? '' : 'none')
      if (!show) return
      const litKinds: Kind[] = ['deposit', 'timer', 'tick']
      const w = kind && litKinds.includes(kind) ? E.outCubic(P(t, 0, Math.min(300, D[kind] * 0.5))) : 1

      strips.forEach((el, i) => {
        const tint = el.querySelector<HTMLElement>('.kh-tint')!
        const mini = el.querySelector<HTMLElement>('.kh-mini')!
        const full = el.querySelector<HTMLElement>('.kh-full')!
        let r = STRIPS[i]
        let fullO = 1
        let miniO = 0
        let tintO = 0
        let radius = STRIP_RADIUS
        let miniScale = 1
        let o = 1
        let sc = 1
        if (kind === 'spread') {
          const q = P(t, 60 + i * 90, 700)
          const e = E.outBack(q)
          r = lerpRect(TILE_ABS[i], STRIPS[i], e)
          radius = lerp(40, STRIP_RADIUS, q)
          // 飛行中一直看得到圖示與標題(跟著卡片放大);快到位時才換成大卡內容
          miniO = 1 - P(t, 60 + i * 90 + 520, 140)
          fullO = E.outCubic(P(t, 60 + i * 90 + 540, 160))
          tintO = 1 - P(t, 60 + i * 90 + 480, 220)
          miniScale = lerp(PS, 1.5, E.outCubic(q))
        } else if (collapsing) {
          const q = E.inCubic(P(t, i * 70, 420))
          o = 1 - q
          sc = lerp(1, 0.86, q)
        }
        place(el, r)
        kit.css(el, { borderRadius: `${f(radius, 1)}px` })
        kit.css(tint, { opacity: f(tintO) })
        kit.css(mini, { opacity: f(miniO), display: miniO > 0 ? '' : 'none', transform: `scale(${f(miniScale, 4)})` })
        // 大卡的內容照 1000×470 排,飛行中跟著卡片寬度縮放
        kit.css(full, { opacity: f(fullO), display: fullO > 0 ? '' : 'none', transform: `scale(${f(r.w / 1000, 4)})` })
        // 亮暗:亮的那格微微放大、帶強調色光暈;其他格變暗約 45%
        const dim = lerp(dimOf(i, prev.lit), dimOf(i, st.lit), w)
        const litNow = lerp(prev.lit === i + 1 ? 1 : 0, st.lit === i + 1 ? 1 : 0, w)
        const breathe = litNow * (0.6 + 0.4 * kit.pulse(ms, 1800))
        kit.css(el, {
          // 退後:白卡底色不變,只降低透明度與飽和、稍微縮小
          opacity: f(o * (1 - 0.45 * dim)),
          transform: `scale(${f(sc * (1 + 0.018 * litNow) * (1 - 0.03 * dim), 4)})`,
          filter: dim > 0.001 ? `saturate(${f(1 - 0.4 * dim)})` : 'none',
          boxShadow: `0 18px 44px rgba(170, 100, 40, ${f(0.14 + 0.08 * litNow)}), 0 0 0 ${f(5 * litNow, 2)}px ${FEATURES[i].color}${Math.round(breathe * 120).toString(16).padStart(2, '0')}`,
          zIndex: litNow > 0.5 ? '2' : '1',
        })
      })

      renderSave(st, prev, kind === 'deposit' ? t : Infinity, ms, events)
      renderTimer(st, kind === 'timer' ? step : null, kind === 'timer' ? t : Infinity)
      renderTodo(st, prev, kind === 'tick' ? step : null, kind === 'tick' ? t : Infinity, ms)
    }

    function renderSave(st: HubState, prev: HubState, t: number, ms: number, events: ActorEvent[]): void {
      const going = Number.isFinite(t)
      const from = going ? prev.saved : st.saved
      const shown = lerp(from, st.saved, E.outCubic(P(t, 420, 600)))
      kit.setIf(amount, 'text', money(shown))
      // 數字滾動時微微跳一下
      const bump = going ? Math.sin(P(t, 420, 600) * Math.PI) : 0
      kit.css(amountWrap, { transform: `translateY(${f(-bump * 8, 1)}px) scale(${f(1 + bump * 0.06, 4)})` })
      const pct = Math.min(100, (shown / p.goal) * 100)
      kit.css(barFill, { width: `${f(pct, 2)}%` })
      kit.setIf(barLabel, 'text', `${p.fund} ${Math.floor(pct)}%`)
      const sh = P(t, 650, 450)
      kit.css(barShine, { opacity: sh > 0 && sh < 1 ? '1' : '0', transform: `translateX(${f(lerp(-100, 220, sh), 1)}%)` })
      // 硬幣落下 → 存錢罐被壓一下再彈回
      const fall = P(t, 80, 340)
      kit.css(coin, {
        opacity: going && fall > 0 && P(t, 420, 80) < 1 ? f(1 - P(t, 400, 60)) : '0',
        transform: `translate(${f(-50, 0)}%, ${f(lerp(-150, 0, E.inQuad(fall)), 1)}px) rotateY(${f(fall * 540, 1)}deg)`,
      })
      const sq = going ? 1 - kit.spring(Math.max(0, t - 420), { stiffness: 380, damping: 11 }) : 0
      const hit = going && t >= 420 ? sq : 0
      kit.css(pig, { transform: `scale(${f(1 + hit * 0.08, 4)}, ${f(1 - hit * 0.1, 4)})` })
      const pl = P(t, 440, 620)
      kit.setIf(plus, 'text', going ? `+${money(st.saved - prev.saved)}` : '')
      kit.css(plus, { opacity: f(pl > 0 && pl < 1 ? Math.min(1, pl * 4) * (1 - P(pl, 0.7, 0.3)) : 0), transform: `translateY(${f(-E.outCubic(pl) * 90, 1)}px) scale(${f(lerp(0.6, 1.1, E.outBack(Math.min(1, pl * 2))), 3)})` })
      // 達標:找出讓金額跨過目標的那一筆存款,從那時起噴彩帶(動作結束後彩帶照樣落完)
      const reached = st.saved >= p.goal
      let celebrate = -1
      let acc = p.saved
      for (const ev of events) {
        if (ev.kind !== 'deposit') continue
        const before = acc
        acc += Number((ev.step as HubStep).deposit) || 0
        if (before < p.goal && acc >= p.goal) celebrate = (ev.local * D.deposit) / ev.dur
      }
      const ct = celebrate >= 0 ? celebrate - 480 : -1
      const bp = reached ? (celebrate >= 0 ? pop(ct, 0, 450) : 1) : 0
      kit.css(goalBadge, { opacity: f(kit.clamp(bp)), transform: `rotate(-4deg) scale(${f(bp, 3)})` })
      kit.css(goalText, { opacity: f(1 - kit.clamp(bp)) })
      drawConfetti(saveConfetti, ct, 210, 170)
      void ms
    }

    function renderTimer(st: HubState, step: HubStep | null, t: number): void {
      const going = step != null
      const minutes = going ? (step.timer as number) : (st.timer ?? 30)
      const done = going ? t >= 1100 : st.timerDone
      // 倒數加速:快轉感(進度用 inCubic,越後面越快)
      const q = going ? P(t, 120, 980) : done ? 1 : 0
      const r = 1 - E.inCubic(q)
      kit.setIf(ringTime, 'text', mmss(Math.ceil(r * minutes * 60)))
      const col = mix(C.orange, C.screen, E.inOutCubic(q))
      const fin = going ? E.outCubic(P(t, 1100, 300)) : done ? 1 : 0
      kit.css(ringArc, { strokeDashoffset: f(fin > 0 ? 1 - fin : 1 - r, 4), stroke: col })
      kit.css(ringTime, { color: col })
      const wob = going ? Math.sin(P(t, 120, 980) * 30) * (q > 0.6 && q < 1 ? 2 : 0) : 0
      kit.css(ring, { transform: `rotate(${f(wob, 2)}deg) scale(${f(1 + 0.05 * Math.sin(P(t, 1080, 300) * Math.PI), 4)})` })
      kit.setIf(timerStatus, 'text', done ? '自動上鎖了' : q > 0 ? '快轉中…' : `每天 ${minutes} 分鐘`)
      const rp = going ? pop(t, 1080, 320) : done ? 1 : 0
      kit.css(rest, { opacity: f(kit.clamp(rp * 1.4)), transform: `translateY(${f((1 - rp) * 30, 1)}px) scale(${f(lerp(0.7, 1, rp), 3)})` })
      kit.css(timerStatus, { opacity: f(1 - 0.6 * kit.clamp(rp)) })
      // 平板上鎖變暗
      const lk = going ? P(t, 1050, 300) : done ? 1 : 0
      kit.css(tabScreen as unknown as HTMLElement, { fill: mix('#7fb8ff', '#3b4252', lk) })
      kit.css(tabApps as unknown as HTMLElement, { opacity: f(1 - lk * 0.85) })
      kit.css(tablet, { filter: `saturate(${f(1 - lk * 0.6)})`, transform: `rotate(${f(lerp(6, 0, lk), 2)}deg) translateX(${f(kit.shake(t, 1050, 300, 10), 1)}px)` })
      const lp = going ? pop(t, 1120, 280) : done ? 1 : 0
      kit.css(lock, { opacity: f(kit.clamp(lp)), transform: `translate(-50%, -50%) scale(${f(lp, 3)})` })
      // 休息時飄過幾片葉子
      const lr = kit.rand(77)
      leaves.forEach((lf) => {
        const d = lr() * 160
        const lq = going ? P(t, 1080 + d, 900) : 0
        const x = lerp(-20, 260, lq) + lr() * 60
        const y = lerp(0, 90, lq) + Math.sin(lq * 6 + lr() * 6) * 16 + lr() * 40
        kit.css(lf, { opacity: f(lq > 0 && lq < 1 ? Math.sin(lq * Math.PI) : 0), transform: `translate(${f(x, 1)}px, ${f(y, 1)}px) rotate(${f(lq * 160, 1)}deg)` })
      })
    }

    function renderTodo(st: HubState, prev: HubState, step: HubStep | null, t: number, ms: number): void {
      const going = step != null
      const n = p.todo.length
      todos.forEach((row, i) => {
        const item = p.todo[i]
        const now = going && item === step.tick
        const on = st.ticked.includes(item)
        const tt = now ? t : on ? Infinity : -Infinity
        const bg = row.querySelector<SVGCircleElement>('.kh-chk-bg')!
        const path = row.querySelector<SVGPathElement>('.kh-chk-path')!
        const chk = row.querySelector<HTMLElement>('.kh-chk')!
        const text = row.querySelector<HTMLElement>('.kh-todo-text')!
        const strike = row.querySelector<HTMLElement>('.kh-strike')!
        const fill = P(tt, 0, 160)
        kit.css(bg as unknown as HTMLElement, { fill: mix('#ffffff', C.plan, fill), stroke: mix('#c9d4ff', C.plan, fill) })
        kit.css(path as unknown as HTMLElement, kit.drawPath(E.outCubic(P(tt, 90, 240)), 1))
        kit.css(chk, { transform: `scale(${f(now ? 1 + 0.25 * Math.sin(P(t, 0, 320) * Math.PI) : 1, 3)})` })
        kit.css(strike, { transform: `scaleX(${f(E.inOutCubic(P(tt, 220, 260)), 4)})` })
        kit.css(text, { opacity: f(1 - 0.55 * P(tt, 220, 260)) })
        kit.css(row, { background: now ? `rgba(79, 124, 255, ${f(0.1 * Math.sin(P(t, 0, 560) * Math.PI))})` : 'transparent' })
      })
      const count = going ? prev.ticked.length + (t >= 160 ? 1 : 0) : st.ticked.length
      kit.setIf(todoCount, 'text', `${count} / ${n}`)
      const allNow = st.ticked.length === n
      const allPrev = prev.ticked.length === n
      const fresh = going && allNow && !allPrev
      const rp = allNow ? (fresh ? pop(t, 330, 270) : 1) : 0
      kit.css(ready, { opacity: f(kit.clamp(rp * 1.5)), transform: `rotate(-4deg) scale(${f(rp, 3)})` })
      // 背包:每勾一項跳一下;準備好時輕輕晃
      const hop = going ? Math.sin(P(t, 120, 380) * Math.PI) : 0
      kit.css(bag, { transform: `translateY(${f(-hop * 30, 1)}px) rotate(${f(allNow ? Math.sin(ms / 420) * 4 : hop * -8, 2)}deg)` })
      const sr = kit.rand(91)
      readySparks.forEach((sEl) => {
        const a = sr() * Math.PI * 2
        const dist = 90 + sr() * 80
        const q = fresh ? P(t, 330 + sr() * 80, 270) : 0
        const e = E.outCubic(q)
        kit.css(sEl, { opacity: f(q > 0 && q < 1 ? Math.sin(q * Math.PI) : 0), transform: `translate(${f(Math.cos(a) * dist * e, 1)}px, ${f(Math.sin(a) * dist * e, 1)}px) scale(${f(0.5 + Math.sin(q * Math.PI), 3)})` })
      })
    }

    // ---------- 習慣打卡 ----------
    function renderHabit(st: HubState, prev: HubState, kind: Kind | null, t: number, ms: number, events: ActorEvent[]): void {
      const going = kind === 'habit'
      const show = st.layout === 'habit'
      kit.setIf(habit, 'display', show ? '' : 'none')
      // 彩帶:最後一次 habit 開始後算,動作結束後照樣落完
      let ct = -1
      for (const ev of events) if (ev.kind === 'habit') ct = (ev.local * D.habit) / ev.dur - 1900
      drawConfetti(bigConfetti.slice(0, half), show ? ct : -1, 100, 1460, 2600)
      drawConfetti(bigConfetti.slice(half), show ? ct : -1, 910, 1460, 2600)
      if (!show) return
      const tt = going ? t : Infinity
      const from = going ? prev.streak : st.streak
      const sp = going ? kit.spring(Math.max(0, t - 280), { stiffness: 170, damping: 15 }) : 1
      kit.css(habit, { opacity: f(going ? P(t, 280, 220) : 1), transform: `translateY(${f((1 - sp) * 120, 1)}px) scale(${f(lerp(0.85, 1, sp), 4)})` })
      kit.css(hHead, kit.enter(P(tt, 450, 350), { dist: '0.6em' }))
      kit.css(hFoot, kit.enter(P(tt, 2150, 400), { dist: '0.6em' }))
      // 一週日曆一格格蓋章(新蓋的才有動畫)
      const n = st.streak
      let landed = from
      days.forEach((d, i) => {
        const stamp = d.querySelector<HTMLElement>('.kh-stamp')!
        const ringEl = d.querySelector<HTMLElement>('.kh-stamp-ring')!
        const slot = d.querySelector<HTMLElement>('.kh-slot')!
        const has = i < n
        const fresh = going && has && i >= from
        const s0 = 700 + (i - from) * 175
        const q = fresh ? P(t, s0, 220) : has ? 1 : 0
        if (fresh && t >= s0 + 200) landed = Math.max(landed, i + 1)
        const e = fresh ? E.outBack(q) : q
        kit.css(stamp, { opacity: f(Math.min(1, q * 3)), transform: `scale(${f(lerp(2.2, 1, e), 3)}) rotate(${f(lerp(-30, -8, e), 1)}deg)` })
        const rq = fresh ? P(t, s0 + 180, 380) : 0
        kit.css(ringEl, { opacity: f(rq > 0 && rq < 1 ? 1 - rq : 0), transform: `scale(${f(lerp(0.8, 1.7, E.outCubic(rq)), 3)})` })
        const jolt = fresh ? Math.sin(P(t, s0 + 180, 200) * Math.PI) : 0
        kit.css(slot, { transform: `translateY(${f(jolt * 8, 1)}px)`, background: has && q >= 1 ? '#ffe6ea' : '#fff4f5' })
        kit.css(d, kit.enter(P(tt, 450 + i * 40, 300), { dist: '0.8em' }))
      })
      if (!going) landed = n
      // 火焰數字:跟著蓋章一格格跳上去
      const numT = going ? t - (700 + (landed - from - 1) * 175 + 200) : Infinity
      const np = going && landed > from ? pop(numT, 0, 260) : 1
      kit.setIf(flameNum, 'text', String(Math.max(going ? Math.max(1, landed) : n, 1)))
      kit.css(flameNum, { transform: `translate(-50%, -50%) scale(${f(lerp(1.5, 1, np), 3)})` })
      const fl = 1 + kit.noise(ms / 160, 4) * 0.03
      const grow = going ? lerp(0.6, 1 + 0.08 * (landed / 7), E.outBack(P(t, 400, 500))) : 1.08
      kit.css(flame, { opacity: f(going ? P(t, 400, 250) : 1), transform: `scale(${f(grow * (going && landed > from ? lerp(1.12, 1, P(numT, 0, 260)) : 1), 4)})` })
      kit.css(flameOut as unknown as HTMLElement, { transform: `scale(${f(1 / fl, 4)}, ${f(fl, 4)})` })
      // 「連續 7 天 🔥」
      const stp = going ? pop(t, 1900, 420) : 1
      kit.setIf(streakText, 'text', `連續 ${n} 天 🔥`)
      kit.css(streakText, { opacity: f(kit.clamp(stp * 1.5)), transform: `scale(${f(lerp(0.4, 1, stp), 3)})` })
      // 孩子開心的臉:先彈進來,蓋完章時跳一下
      const kp = going ? pop(t, 520, 500) : 1
      const cheer = going ? Math.sin(P(t, 1900, 500) * Math.PI) : 0
      const nod = Math.sin(ms / 520) * 2.5
      kit.css(kid, { opacity: f(kit.clamp(kp * 2)), transform: `translateY(${f(-cheer * 40 + (1 - kp) * 60, 1)}px) rotate(${f(nod + cheer * 6, 2)}deg) scale(${f(lerp(0.5, 1, kp), 3)})` })
      const kr = kit.rand(55)
      kidStars.forEach((sEl, i) => {
        const ph = kr() * 3000
        const q = going ? P(t, 1950 + i * 90, 600) : 1
        kit.css(sEl, { opacity: f(q * (0.4 + 0.6 * kit.pulse(ms + ph, 1400))), transform: `scale(${f(0.6 + 0.5 * kit.pulse(ms + ph, 1400), 3)}) rotate(${f(((ms + ph) / 20) % 360, 1)}deg)` })
      })
    }

    return {
      render({ events, view }, ms) {
        const { w: W, h: H } = sizeNow()
        const k = Math.min(W / DESIGN.w, H / DESIGN.h)
        const bx = (W - DESIGN.w * k) / 2
        const by = (H - DESIGN.h * k) / 2
        kit.css(box, { transform: `translate(${f(bx, 2)}px, ${f(by, 2)}px) scale(${f(k, 5)})` })
        if (!bare) renderBg(ms, W, H)
        if (!view) return
        const st = view.state
        const prev = view.prev
        const ev = view.ev
        const kind = ev ? kindIn(ev.kind, ev.step) : null
        const t = ev && kind ? ev.p * D[kind] : Infinity
        const step = ev && kind ? (ev.step as HubStep) : null
        const evs = (events as ActorEvent[]).filter((e) => (KINDS as readonly string[]).includes(e.kind))
        renderAsk(st, prev, kind, step, t, ms)
        renderPhone(st, prev, kind, t, ms)
        renderStrips(st, prev, kind, step, t, ms, evs)
        renderHabit(st, prev, kind, t, ms, evs)
        // 目標替身:設計座標換算成演員根元素裡的位置
        const at = (el: HTMLElement, r: R): void => place(el, { x: bx + r.x * k, y: by + r.y * k, w: r.w * k, h: r.h * k })
        at(proxies.phone, PHONE_AT)
        STRIPS.forEach((r, i) => at(proxies[`strip:${i + 1}`], r))
        at(proxies.habit, HABIT)
      },
      target(name) {
        if (name === 'window') return root
        return proxies[name] ?? null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 live/actors/index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
