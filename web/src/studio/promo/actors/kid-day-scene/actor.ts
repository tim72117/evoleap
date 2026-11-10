// 演員 kid-day-scene:小管家宣傳片的「場景」(研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 場景＝同一個世界的背景與前景:前景是 kid-life(痛點三格)與 kid-hub(小管家 App)兩層,都以 bare 掛上(不畫自己的背景),
// 動作照舊轉給它們;背景是一組一直存在的柔焦光斑,依「場景狀態」自動變化(規則表 RULES),只換顏色、亮度、速度、抖動,
// 狀態在哪一步改變,就從那一步開始的時間過場過去,所以痛點段落接到 App 時背景是連續的,不再硬切。
// 場景沒有自己的狀態,只從兩位演員的狀態推算;一次性效果(抖動、閃光)看事件的時間算,也不放進狀態。
// 所以拖曳、倒轉到任何時間點畫面都一樣(SPEC 第 1 節)。place 用 "full"。
//
// props:{ "life": kid-life 的 props, "hub": kid-hub 的 props }(都選用;bare 由場景自己加上)
//
// 動作:kid-life 的 strip、all、parent、collapse,加上 kid-hub 的 ask、build、spread、deposit、timer、tick、habit
//   (兩邊沒有同名動作;欄位與效果見兩位演員的 actor.ts 開頭)
//
// 前景交接:hub 還沒開始時只看到 life;第一個 hub 動作(ask 或 build)開始時,life 層用 500ms 淡出、hub 層淡入。
// 一次性效果:all 開始時背景輕微抖動(1.2 秒內衰減);deposit 讓存款剛好達到 goal 時,硬幣落進存錢罐的那一刻背景閃一下暖白光(400ms)。
//
// 狀態:{ life, hub }(兩位演員各自的狀態)
//
// 目標:window、bg(背景),其他轉給前景演員:現在的動作屬於誰就先問誰;名字都對不上(或沒有進行中的動作)時,先試 hub、再試 life。
//   life 有 strip:1–3、parent、turn;hub 有 phone、strip:1–3、habit(兩邊的 strip 都在共用錨點的同一個位置)
import { kit } from '../../../../live/kit'
import { defineActor, type ActorEvent, type ActorView, type CommonStepFields } from '../../../../live/types'
import { DESIGN, FOCUS } from '../../anchors'
import hub, { type HubProps, type HubState, type HubStep } from '../kid-hub/actor'
import life, { type KidLifeProps, type KidLifeState, type KidLifeStep } from '../kid-life/actor'
import './actor.css'

// ---------- 型別 ----------
type LifeKind = (typeof life.kinds)[number]
type HubKind = (typeof hub.kinds)[number]
type Kind = LifeKind | HubKind
const KINDS: readonly Kind[] = [...life.kinds, ...hub.kinds]
export type DayStep = KidLifeStep & HubStep & CommonStepFields
export interface DayProps {
  life?: KidLifeProps
  hub?: HubProps
}
export interface DayState {
  life: KidLifeState
  hub: HubState
}
type Target = 'window' | 'bg' | 'strip:1' | 'strip:2' | 'strip:3' | 'parent' | 'turn' | 'phone' | 'habit'

const isLife = (k: string): k is LifeKind => (life.kinds as readonly string[]).includes(k)
const isHub = (k: string): k is HubKind => (hub.kinds as readonly string[]).includes(k)

/** 這一格的動作種類(show/hide 帶著動作時也算;交給演員的事件清單裡這種格子的 kind 是 'props',frame.view.ev 則是 'show'/'hide') */
export const kindOf = (e: { kind: string; step: object }): Kind | null =>
  (KINDS as readonly string[]).includes(e.kind) ? (e.kind as Kind) : e.kind === 'show' || e.kind === 'hide' || e.kind === 'props' ? (KINDS.find((k) => k in e.step) ?? null) : null

function apply(st: DayState, kind: Kind, s: DayStep): DayState {
  if (isLife(kind)) return { ...st, life: life.apply!(st.life, kind, s) }
  return { ...st, hub: hub.apply!(st.hub, kind, s) }
}

// ---------- 規則:狀態 → 背景的樣子 ----------
export interface DayLook {
  /** 緊張(偏紅、偏亂):0–1 */
  tension: number
  /** 只剩中央的光:0–1 */
  focus: number
  /** 冷轉暖:深藍 0、暖米色 1 */
  warmth: number
  /** 最亮:0–1 */
  glow: number
  /** 光斑速度的倍數 */
  speed: number
}

/**
 * 場景規則:狀態 → 背景的樣子。寫腳本的人看這張表就知道哪些事不用自己同步。
 * ms 是過場長度:狀態在某一步改變時,從那一步開始的時間起,用這麼久過場過去(inOutCubic)。
 */
export const RULES: { look: keyof DayLook; ms: number; when: string; of: (st: DayState) => number }[] = [
  {
    look: 'tension',
    ms: 450,
    when: '亮的痛點格越多越緊張(偏紅、光斑抖得越亂):一格亮(strip)0.35、媽媽出來(parent)0.8、三格全亮(all)1;收成一點(collapse)之後 0',
    of: ({ life: l }) => (l.collapsed ? 0 : l.parent ? 0.8 : l.lit === 'all' ? 1 : l.lit ? 0.35 : 0),
  },
  {
    look: 'focus',
    ms: 1000,
    when: '收成一點(collapse)之後只剩中央的光:四周壓暗、光斑退去,聚焦點留一團柔光;小管家開始(ask 或 build)後回到 0',
    of: (st) => (st.life.collapsed && st.hub.layout === 'none' ? 1 : 0),
  },
  {
    look: 'warmth',
    ms: 1400,
    when: '冷轉暖:痛點段落是深藍(0);請 AI 做 App(ask)時轉成黎明的過渡色(0.5);做好(build)之後是暖米色(1)',
    of: ({ hub: h }) => (h.built ? 1 : h.layout === 'ask' ? 0.5 : 0),
  },
  {
    look: 'glow',
    ms: 900,
    when: '今日行程全部勾完(tick)→ 背景變亮 0.6;習慣打卡(habit)→ 最亮 1',
    of: ({ hub: h }) => (h.layout === 'habit' ? 1 : h.ticked.length === h.todo.length ? 0.6 : 0),
  },
  {
    look: 'speed',
    ms: 400,
    when: '三格全亮(all)時光斑加快 1.8 倍(混亂感);媽媽出來、換格或收合後回到 1',
    of: ({ life: l }) => (l.lit === 'all' && !l.parent && !l.collapsed ? 1.8 : 1),
  },
]

/** 一段過場:從 at 起用 ms 從 from 變到 to */
type Seg = { from: number; to: number; at: number; ms: number }
const segAt = (s: Seg, t: number): number => kit.lerp(s.from, s.to, kit.ease.inOutCubic(kit.progress(t - s.at, 0, s.ms)))
/** inOutCubic 在 [0, x] 的積分 */
const easeArea = (x: number): number => (x < 0.5 ? x ** 4 : x + (2 - 2 * x) ** 4 / 16 - 0.5)

/** 已經開始的動作(依時間排列) */
const startedBy = (events: readonly ActorEvent[], ms: number): ActorEvent[] => events.filter((e) => e.start <= ms)

/**
 * 每條規則的過場段落:從起始狀態依序套用已經開始的動作,值一改變就從那個動作開始的時間開一段新的過場;
 * 上一段過場還沒走完又改變時,新的一段從當時的值接著變,不會跳。
 */
function tracksOf(init: DayState, events: readonly ActorEvent[]): Seg[][] {
  let st = init
  const tracks: Seg[][] = RULES.map((r) => [{ from: r.of(st), to: r.of(st), at: 0, ms: r.ms }])
  for (const e of events) {
    const k = kindOf(e)
    if (!k) continue
    st = apply(st, k, e.step as DayStep)
    RULES.forEach((r, i) => {
      const v = r.of(st)
      const last = tracks[i][tracks[i].length - 1]
      if (v === last.to) return
      tracks[i].push({ from: segAt(last, e.start), to: v, at: e.start, ms: r.ms })
    })
  }
  return tracks
}

/** 依規則算出 ms 時背景的樣子 */
export function lookAt(init: DayState, events: readonly ActorEvent[], ms: number): DayLook {
  const tracks = tracksOf(init, startedBy(events, ms))
  const look = {} as DayLook
  RULES.forEach((r, i) => (look[r.look] = segAt(tracks[i][tracks[i].length - 1], ms)))
  return look
}

/** 光斑的「時鐘」:速度的積分(加快時光斑跑得比較快,速度變回來時位置也不會跳) */
function clockOf(track: Seg[], ms: number): number {
  let sum = 0
  track.forEach((s, i) => {
    const a = Math.max(0, s.at)
    const b = Math.min(ms, i + 1 < track.length ? track[i + 1].at : Infinity)
    if (b <= a) return
    const d = b - a
    const run = s.ms > 0 ? Math.min(d, s.ms) : 0
    sum += s.from * d + (s.to - s.from) * ((s.ms > 0 ? s.ms * easeArea(run / s.ms) : 0) + (d - run))
  })
  return sum
}

// ---------- 前景交接與一次性效果(看事件的時間) ----------
export const HANDOFF_MS = 500
export const SHAKE_MS = 1200
export const FLASH_MS = 400
/** deposit 的硬幣落進存錢罐的時間點(kid-hub 的 deposit 自然長度 1100ms 裡的 480ms,和彩帶同時) */
const COIN_AT = 480

/** 前景兩層的不透明度:第一個 hub 動作開始時 life 淡出、hub 淡入 */
export function handoffAt(events: readonly ActorEvent[], ms: number): { life: number; hub: number; at: number | null } {
  const first = startedBy(events, ms).find((e) => {
    const k = kindOf(e)
    return k != null && isHub(k)
  })
  if (!first) return { life: 1, hub: 0, at: null }
  const p = kit.ease.inOutCubic(kit.progress(ms - first.start, 0, HANDOFF_MS))
  return { life: 1 - p, hub: p, at: first.start }
}

/** all 開始時背景的抖動幅度(設計 px):最後一次 all 開始後 1.2 秒內衰減到 0 */
export function shakeAt(events: readonly ActorEvent[], ms: number): number {
  let at: number | null = null
  for (const e of startedBy(events, ms)) if (kindOf(e) === 'all') at = e.start
  if (at == null) return 0
  const q = kit.progress(ms - at, 0, SHAKE_MS)
  return q >= 1 ? 0 : 16 * (1 - q) ** 2
}

/** 剛好達到 goal 的那一筆 deposit,硬幣落下的時間點(沒有就 null) */
export function flashTime(events: readonly ActorEvent[], saved0: number, goal: number): number | null {
  let acc = saved0
  for (const e of events) {
    if (kindOf(e) !== 'deposit') continue
    const before = acc
    acc += Number((e.step as HubStep).deposit) || 0
    if (before < goal && acc >= goal) return e.start + (COIN_AT * e.dur) / hub.duration('deposit', {}, {}, undefined)
  }
  return null
}

/** 閃光的不透明度:很快亮起、再慢慢退掉 */
export function flashAt(events: readonly ActorEvent[], saved0: number, goal: number, ms: number): number {
  const at = flashTime(startedBy(events, ms), saved0, goal)
  if (at == null) return 0
  const q = kit.progress(ms - at, 0, FLASH_MS)
  if (q <= 0 || q >= 1) return 0
  return 0.85 * (q < 0.25 ? q / 0.25 : 1 - (q - 0.25) / 0.75)
}

// ---------- 背景:畫出來的樣子(純函式,render 只負責套上) ----------
type RGB = [number, number, number]
const hex = (c: string): RGB => {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mixRGB = (a: RGB, b: RGB, p: number): RGB => [0, 1, 2].map((i) => kit.lerp(a[i], b[i], kit.clamp(p))) as RGB
const rgb = (c: RGB, a = 1): string => `rgba(${c.map((v) => Math.round(v)).join(',')},${a.toFixed(3)})`

/** 底色的三個色標:深藍(kid-life)→ 黎明 → 暖米色(kid-hub 的 #fff6e9 → #ffe3c2) */
const COLD = ['#14213d', '#1a2b4c', '#1d3557'].map(hex)
const DAWN = ['#8f8bb8', '#e3bcc0', '#ffd9bc'].map(hex)
const WARM = ['#fff6e9', '#ffeedb', '#ffe3c2'].map(hex)
const baseAt = (w: number): RGB[] => (w <= 0.5 ? COLD.map((c, i) => mixRGB(c, DAWN[i], w * 2)) : DAWN.map((c, i) => mixRGB(c, WARM[i], (w - 0.5) * 2)))

/** 光斑的顏色(中心、外圈):冷藍、緊張的紅、暖光 */
const SPOT_BLUE: [RGB, RGB] = [[140, 180, 255], [110, 150, 240]]
const SPOT_RED: [RGB, RGB] = [[255, 120, 130], [255, 90, 110]]
const SPOT_WARM: [RGB, RGB] = [[255, 250, 236], [255, 214, 170]]

const SPOT_COUNT = 16
/** 每個光斑固定的參數(kit.rand 固定種子):位置 %、大小(設計 px)、亮度、閃爍週期、相位、變紅的門檻 */
const SPOTS = Array.from({ length: SPOT_COUNT }, (_, j) => {
  const r = kit.rand(`kd-spot-${j}`)
  return { x: r() * 100, y: r() * 100, size: 70 + r() * 190, a: 0.25 + r() * 0.35, period: 2600 + r() * 3000, ph: r() * 4000, red: j % 5 === 2 ? 0.05 : 0.35 + r() * 0.9 }
})

export interface SpotPaint {
  /** 位置(根元素的 %) */
  x: number
  y: number
  /** 直徑(設計 px) */
  size: number
  opacity: number
  core: string
  rim: string
}
export interface Backdrop {
  look: DayLook
  /** 底色漸層的三個色標 */
  base: string[]
  spots: SpotPaint[]
  /** 四角紅光、四周壓暗、聚焦柔光、整體變亮、閃光的不透明度 */
  tension: number
  vignette: number
  dim: number
  focusLight: number
  glow: number
  flash: number
  /** 抖動的位移(設計 px) */
  dx: number
  dy: number
}

/** ms 時背景的樣子:只由起始狀態、事件與 ms 決定 */
export function backdropAt(init: DayState, events: readonly ActorEvent[], ms: number, goal: number): Backdrop {
  const evs = startedBy(events, ms)
  const tracks = tracksOf(init, evs)
  const look = {} as DayLook
  RULES.forEach((r, i) => (look[r.look] = segAt(tracks[i][tracks[i].length - 1], ms)))
  const { tension, focus, warmth, glow } = look
  const tau = clockOf(tracks[RULES.findIndex((r) => r.look === 'speed')], ms)

  const spots = SPOTS.map((b, j): SpotPaint => {
    const drift = 1 + 0.6 * tension
    const x = b.x + kit.noise(tau / 6500 + j * 1.7, j + 1) * 7 * drift + kit.noise(tau / 240 + j * 0.9, j + 77) * 1.4 * tension
    const y = b.y + kit.noise(tau / 8000 + j * 2.3, j + 41) * 6 * drift + kit.noise(tau / 260 + j * 1.3, j + 99) * 1.2 * tension
    const red = kit.clamp((tension - b.red) / 0.25)
    const cold: [RGB, RGB] = [mixRGB(SPOT_BLUE[0], SPOT_RED[0], red), mixRGB(SPOT_BLUE[1], SPOT_RED[1], red)]
    const core = mixRGB(cold[0], SPOT_WARM[0], warmth)
    const rim = mixRGB(cold[1], SPOT_WARM[1], warmth)
    const ca = kit.lerp(kit.lerp(0.55, 0.45, red), 0.85, warmth)
    const ra = kit.lerp(kit.lerp(0.18, 0.14, red), 0.32, warmth)
    const op = b.a * (0.55 + 0.45 * kit.pulse(tau + b.ph, b.period)) * (1 + 0.25 * tension) * (1 - 0.85 * focus) * (1 + 0.8 * glow)
    return {
      x,
      y,
      size: b.size * (1 + 1.4 * warmth) * (1 + 0.15 * glow),
      opacity: kit.clamp(op),
      core: rgb(core, ca),
      rim: rgb(rim, ra),
    }
  })

  const shake = shakeAt(evs, ms)
  return {
    look,
    base: baseAt(warmth).map((c) => rgb(c)),
    spots,
    tension: kit.clamp((0.25 + 0.75 * tension) * (1 - focus) * (1 - warmth) * (0.85 + 0.15 * kit.pulse(ms, 2600))),
    vignette: kit.clamp(1 - warmth),
    dim: 0.85 * focus,
    focusLight: focus * (0.9 + 0.1 * kit.pulse(ms, 3200)),
    glow: 0.55 * glow * (0.92 + 0.08 * kit.pulse(ms, 2800)),
    flash: flashAt(evs, init.hub.saved, goal, ms),
    dx: shake ? kit.noise(ms / 38, 3) * shake : 0,
    dy: shake ? kit.noise(ms / 43, 5) * shake * 0.8 : 0,
  }
}

// ---------- 演員 ----------
const f = (n: number, d = 3): string => n.toFixed(d)

const actor = defineActor<Kind, DayStep, DayProps, DayState, Target>({
  name: 'kid-day-scene',
  kinds: KINDS,

  init(props) {
    if (props.life != null && typeof props.life !== 'object') throw new Error('life 要是 kid-life 的 props(物件)')
    if (props.hub != null && typeof props.hub !== 'object') throw new Error('hub 要是 kid-hub 的 props(物件)')
    return { life: life.init!(props.life ?? {}), hub: hub.init!(props.hub ?? {}) }
  },
  apply,
  duration(kind, step, props, prev) {
    return isLife(kind) ? life.duration(kind, step, props.life ?? {}, prev?.life) : hub.duration(kind, step, props.hub ?? {}, prev?.hub)
  },

  mount(root, props) {
    root.classList.add('A-kid-day-scene')
    root.innerHTML =
      `<div class="kd-bg"><div class="kd-base"></div>` +
      `<div class="kd-spots">${SPOTS.map(() => '<i></i>').join('')}</div>` +
      `<div class="kd-tension"></div><div class="kd-vignette"></div><div class="kd-dim"></div>` +
      `<div class="kd-focus"></div><div class="kd-glow"></div><div class="kd-flash"></div></div>` +
      `<div class="kd-layer kd-life"><div class="kd-actor"></div></div>` +
      `<div class="kd-layer kd-hub"><div class="kd-actor"></div></div>`
    const $ = (s: string): HTMLElement => root.querySelector<HTMLElement>(s)!
    const bg = $('.kd-bg')
    const base = $('.kd-base')
    const spotEls = [...root.querySelectorAll<HTMLElement>('.kd-spots i')]
    const tensionEl = $('.kd-tension')
    const vignette = $('.kd-vignette')
    const dim = $('.kd-dim')
    const focusEl = $('.kd-focus')
    const glowEl = $('.kd-glow')
    const flashEl = $('.kd-flash')
    const lifeLayer = $('.kd-life')
    const hubLayer = $('.kd-hub')
    const fgLife = life.mount(lifeLayer.querySelector<HTMLElement>('.kd-actor')!, { ...(props.life ?? {}), bare: true })
    const fgHub = hub.mount(hubLayer.querySelector<HTMLElement>('.kd-actor')!, { ...(props.hub ?? {}), bare: true })
    const init = actor.init!(props)
    const goal = props.hub?.goal ?? 2000

    // 版面:1080×1920 的設計座標依根元素大小等比例縮放、置中(和 kid-life 同一套,大小改變時才重算)
    let sizeKey = ''
    let sc = 1
    const setSize = (w: number, h: number): void => {
      if (!(w > 0 && h > 0)) return
      const key = `${w}x${h}`
      if (key === sizeKey) return
      sizeKey = key
      sc = Math.min(w / DESIGN.w, h / DESIGN.h)
      const ox = (w - DESIGN.w * sc) / 2
      const oy = (h - DESIGN.h * sc) / 2
      root.style.setProperty('--s', sc.toFixed(5))
      root.style.setProperty('--fx', `${(ox + FOCUS.x * sc).toFixed(2)}px`)
      root.style.setProperty('--fy', `${(oy + FOCUS.y * sc).toFixed(2)}px`)
    }
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(([e]) => {
        if (!root.isConnected) return ro.disconnect()
        setSize(e.contentRect.width, e.contentRect.height)
      })
      ro.observe(root)
    }

    /** 給前景演員的畫面資料:只有屬於它的動作 */
    const subFrame = <St>(events: ActorEvent[], view: ActorView<DayState>, pick: (s: DayState) => St, mine: (k: string) => boolean) => ({
      events: events.filter((e) => {
        const k = kindOf(e)
        return k != null && mine(k)
      }),
      view: {
        state: pick(view.state),
        prev: pick(view.prev),
        ev: view.ev && ((k) => k != null && mine(k))(kindOf(view.ev)) ? view.ev : null,
      },
    })

    return {
      render(frame, ms) {
        if (!sizeKey) setSize(root.offsetWidth, root.offsetHeight)
        const view = frame.view
        if (!view) return
        const events = frame.events

        // ---- 背景 ----
        const b = backdropAt(init, events, ms, goal)
        kit.css(bg, { transform: `translate(${f(b.dx * sc, 2)}px, ${f(b.dy * sc, 2)}px)` })
        kit.css(base, { background: `linear-gradient(170deg, ${b.base[0]} 0%, ${b.base[1]} 50%, ${b.base[2]} 100%)` })
        spotEls.forEach((el, j) => {
          const s = b.spots[j]
          const d = `calc(${f(s.size, 1)}px * var(--s))`
          kit.css(el, {
            left: `${f(s.x, 2)}%`,
            top: `${f(s.y, 2)}%`,
            width: d,
            height: d,
            opacity: f(s.opacity),
            background: `radial-gradient(circle, ${s.core} 0%, ${s.rim} 45%, rgba(0,0,0,0) 70%)`,
          })
        })
        kit.css(tensionEl, { opacity: f(b.tension) })
        kit.css(vignette, { opacity: f(b.vignette) })
        kit.css(dim, { opacity: f(b.dim) })
        kit.css(focusEl, { opacity: f(b.focusLight) })
        kit.css(glowEl, { opacity: f(b.glow) })
        kit.css(flashEl, { opacity: f(b.flash), visibility: b.flash > 0 ? 'visible' : 'hidden' })

        // ---- 前景:兩位演員照舊演,第一個 hub 動作開始時交接 ----
        const h = handoffAt(events, ms)
        kit.css(lifeLayer, { opacity: f(h.life), visibility: h.life > 0 ? 'visible' : 'hidden' })
        kit.css(hubLayer, { opacity: f(h.hub), visibility: h.hub > 0 ? 'visible' : 'hidden' })
        // 看不見的那一層也照畫:目標(鏡頭、聚光燈用)的位置要一直是對的
        fgLife.render(subFrame(events, view, (s) => s.life, isLife), ms)
        fgHub.render(subFrame(events, view, (s) => s.hub, isHub), ms)
      },

      target(name, view) {
        if (name === 'window') return root
        if (name === 'bg') return bg
        const lifeView = view ? { state: view.state.life, prev: view.prev.life, ev: null } : null
        const hubView = view ? { state: view.state.hub, prev: view.prev.hub, ev: null } : null
        // 現在的動作屬於誰就先問誰;名字都對不上時,先試 hub、再試 life
        const k = view?.ev ? kindOf(view.ev) : null
        const askLife = (): HTMLElement | null => fgLife.target(name, lifeView)
        const askHub = (): HTMLElement | null => fgHub.target(name, hubView)
        if (k && isLife(k)) return askLife() ?? askHub()
        return askHub() ?? askLife()
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
