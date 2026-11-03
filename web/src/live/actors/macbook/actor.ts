// 演員 macbook:擬真的筆記型電腦(鋁金屬機身、鉸鏈、極窄邊框與瀏海的螢幕、多排鍵盤、觸控板、喇叭孔),宣傳影片用。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
// 純 HTML/CSS 加 CSS 3D(沒有圖檔、沒有 CSS animation/transition);所有動態都由 render(t) 算,可以任意拖曳、倒轉、逐格截圖。
// 純計算(鍵盤配置、按鍵時間表、狀態推算、開蓋角度)在 ./layout.ts,有單元測試。畫面上不出現任何商標文字或圖樣。
//
// 畫面大小:依 place 的 w、h 等比例縮放(寬高比 1240:1120,放不下時以較小的邊為準,置中);h 可省略。
//
// props(登場設定,只描述起始狀態):
//   opened     一開始是否開蓋(預設 false:闔上)
//   awake      一開始螢幕是否亮著(預設等於 opened)
//   angle      開蓋角度,度(90–135,預設 105,配合預設 pitch 15,螢幕正對鏡頭、是標準矩形)
//   pitch      俯視角,度(0–70,預設 15);yaw 水平旋轉,度(-60–60,預設 0)
//   finish     silver(預設,銀色)| space-gray(太空灰)
//   wallpaper  桌布色系:dawn(預設,粉紫到暖橘)| ocean | graphite | meadow | dusk
//   dock       Dock 的 App 圖示數量(0–10,預設 7)
//   clock      選單列右邊的時間文字(預設「週三 9:41」)
//
// 動作:
//   { "open": true, "angle": 110 }           開蓋(約 1.7 秒,緩入緩出);angle 可省略(預設 105)。已經開著會報錯
//   { "close": true }                        闔上(同時熄螢幕)。已經闔上會報錯
//   { "wake": true }                         螢幕亮起(桌面從黑色淡入、鍵盤上有螢幕反光);要先開蓋
//   { "sleep": true }                        螢幕熄滅(黑色玻璃與反光)
//   { "type": "你好 hello" }                 在鍵盤上依序打字:英數字照鍵位按下去,其他字(中文…)按固定亂數選的字母鍵;
//                                            按鍵下沉、鍵帽淡淡亮起。可加 "cps": 每秒幾下(預設 7);要先開蓋
//   { "type": true, "keys": 24 }             不指定文字,只按 24 下(位置由固定亂數決定,同一個數字永遠一樣)
//   { "tilt": { "pitch": 28, "yaw": -15 } }  慢慢改變俯視角與水平旋轉(約 2.4 秒,可用 ms 調整;兩個都選填),給運鏡用
//   鏡頭的推近、平移用舞台的 focus(目標見下),不要另外發明;疊在螢幕上的演員不會跟著機身旋轉,
//   所以要放別的演員在螢幕上時,tilt 只做回到 pitch 15、yaw 0 的動作,或先 hide 疊上去的演員。
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window(整台)、screen(螢幕發亮的區域,16:10)、keyboard、trackpad、lid(整片上蓋)、key:<鍵>(例如 key:a、key:return)
//   目標量的是「目前畫面上投影後的外框」,所以鏡頭推近螢幕時,螢幕會置中放大。
import { kit } from '../../kit'
import { defineActor, type ActorEvent, type CommonStepFields } from '../../types'
import { applyMb, DEFAULT_ANGLE, durationOf, keyLevels, KEY_SPECS, lidAngleAt, lidOf, openness, strokesOf, type MbKind, type MbState, type MbStep, type Stroke } from './layout'
import './actor.css'

type MacbookStep = CommonStepFields & MbStep
type Finish = 'silver' | 'space-gray'
type Wallpaper = 'dawn' | 'ocean' | 'graphite' | 'meadow' | 'dusk'
interface MacbookProps {
  opened?: boolean
  awake?: boolean
  angle?: number
  pitch?: number
  yaw?: number
  finish?: Finish
  wallpaper?: Wallpaper
  dock?: number
  clock?: string
}
type MacbookTarget = 'window' | 'screen' | 'keyboard' | 'trackpad' | 'lid' | `key:${string}`

const KINDS: readonly MbKind[] = ['open', 'close', 'wake', 'sleep', 'type', 'tilt']
const FINISHES: readonly Finish[] = ['silver', 'space-gray']
const WALLPAPERS: readonly Wallpaper[] = ['dawn', 'ocean', 'graphite', 'meadow', 'dusk']

// ---------- 設計座標(單位 = 設計寬度 1240 的 1/1240;全部用 --k 換算成實際大小) ----------
const U = (n: number): string => `calc(var(--k) * ${+n.toFixed(3)})`
const W = 1000 // 機身寬
const LID_H = 673 // 上蓋高
const CLOSED_SHIFT = 335 // 闔上時整台往上移多少,讓機身置中
const KB = { x: 102.5, y: 44, pitch: 53, gap: 3.6 }
const TP = { x: 265, y: 372, w: 470, h: 268 }

const DOCK_ICONS: { bg: string; glyph: string }[] = [
  { bg: 'linear-gradient(160deg,#8fb8ff,#4a74e8)', glyph: '<rect x="5" y="5" width="6" height="6" rx="1.5"/><rect x="13" y="5" width="6" height="6" rx="1.5"/><rect x="5" y="13" width="6" height="6" rx="1.5"/><rect x="13" y="13" width="6" height="6" rx="1.5"/>' },
  { bg: 'linear-gradient(160deg,#7be08f,#2fae55)', glyph: '<path d="M5 7.5a3.5 3.5 0 0 1 3.5-3.5h7A3.5 3.5 0 0 1 19 7.5v5a3.5 3.5 0 0 1-3.5 3.5H11l-4 3.5V16h-.5A1.5 1.5 0 0 1 5 14.5z"/>' },
  { bg: 'linear-gradient(160deg,#ffffff,#e6e8ee)', glyph: '' },
  { bg: 'linear-gradient(160deg,#ffd37a,#f29a2e)', glyph: '<path d="M5 6.5h14v11H5z" opacity=".0"/><rect x="5" y="6" width="14" height="12" rx="2"/><path d="M5.5 8l6.5 5 6.5-5" fill="none" stroke="#f29a2e" stroke-width="1.4"/>' },
  { bg: 'linear-gradient(160deg,#ffe98a,#f2c22e)', glyph: '<rect x="6" y="5" width="12" height="14" rx="1.8"/><path d="M8.5 9h7M8.5 12h7M8.5 15h4.5" stroke="#d6a313" stroke-width="1.3" stroke-linecap="round"/>' },
  { bg: 'linear-gradient(160deg,#ff9bb4,#e8416f)', glyph: '<path d="M10 16.5V7l8-1.8v9.3"/><circle cx="8" cy="16.8" r="2.2"/><circle cx="16" cy="14.8" r="2.2"/>' },
  { bg: 'linear-gradient(160deg,#c2a6ff,#7a52e0)', glyph: '<circle cx="12" cy="12" r="3.2"/><path d="M12 4.2v3M12 16.8v3M4.2 12h3M16.8 12h3M6.5 6.5l2.1 2.1M15.4 15.4l2.1 2.1M17.5 6.5l-2.1 2.1M8.6 15.4l-2.1 2.1" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>' },
  { bg: 'linear-gradient(160deg,#9fe3ee,#2aa7c0)', glyph: '<path d="M4.5 8.5a1.8 1.8 0 0 1 1.8-1.8h3.6l1.7 1.9h6.1a1.8 1.8 0 0 1 1.8 1.8v6.6a1.8 1.8 0 0 1-1.8 1.8H6.3a1.8 1.8 0 0 1-1.8-1.8z"/>' },
  { bg: 'linear-gradient(160deg,#5b606c,#2a2d35)', glyph: '<path d="M6.5 8.5l4 3.5-4 3.5M12.5 16h5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' },
  { bg: 'linear-gradient(160deg,#ffb48a,#ee6a3a)', glyph: '<circle cx="12" cy="12" r="6.2" fill="none" stroke="#fff" stroke-width="1.7"/><circle cx="12" cy="12" r="2.2"/>' },
]
/** 第三個圖示是「行事曆」:白底、上方紅條與日期數字(用文字畫,不是圖) */
const CALENDAR_ICON = 2

function dockHtml(count: number): string {
  const n = Math.max(0, Math.min(DOCK_ICONS.length, Math.round(count)))
  const icons = DOCK_ICONS.slice(0, n)
    .map((ic, i) => {
      const inner =
        i === CALENDAR_ICON
          ? `<div class="mb-cal"><b>四</b><i>12</i></div>`
          : `<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">${ic.glyph}</svg>`
      return `<div class="mb-app" style="background:${ic.bg}">${inner}${i === 0 || i === 3 ? '<u></u>' : ''}</div>`
    })
    .join('')
  return n ? `${icons}` : ''
}

const MENU_ITEMS = ['檔案', '編輯', '顯示', '前往', '視窗', '說明']

function desktopHtml(clock: string, dock: number): string {
  const wifi = `<svg viewBox="0 0 16 12" aria-hidden="true"><path d="M1.2 4.2a9.5 9.5 0 0 1 13.6 0M3.7 6.9a6 6 0 0 1 8.6 0M6.2 9.5a2.5 2.5 0 0 1 3.6 0" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11" r="1" fill="#fff"/></svg>`
  const battery = `<svg viewBox="0 0 26 12" aria-hidden="true"><rect x=".7" y=".7" width="21.6" height="10.6" rx="3" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/><rect x="2.3" y="2.3" width="15" height="7.4" rx="1.6" fill="#fff"/><path d="M23.8 4v4" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/></svg>`
  const search = `<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="4.2" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M9.2 9.2L12.6 12.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`
  const ctrl = `<svg viewBox="0 0 16 12" aria-hidden="true"><rect x="1" y="1.2" width="14" height="3.6" rx="1.8" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="4.4" cy="3" r="1.2" fill="#fff"/><rect x="1" y="7.2" width="14" height="3.6" rx="1.8" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="11.6" cy="9" r="1.2" fill="#fff"/></svg>`
  return (
    `<div class="mb-desk">` +
    `<svg class="mb-waves" viewBox="0 0 970 630" preserveAspectRatio="none" aria-hidden="true">` +
    `<path d="M0 430 C180 360 320 470 520 410 C700 356 820 300 970 350 L970 630 L0 630 Z" fill="#fff" fill-opacity=".10"/>` +
    `<path d="M0 500 C200 450 360 540 560 490 C740 446 860 430 970 470 L970 630 L0 630 Z" fill="#fff" fill-opacity=".10"/>` +
    `<path d="M0 0 L970 0 L970 190 C760 140 520 230 300 170 C170 135 70 150 0 190 Z" fill="#000" fill-opacity=".07"/>` +
    `</svg>` +
    `<div class="mb-disk"><i></i><span>資料</span></div>` +
    `<div class="mb-menubar"><div class="mb-menu-l"><svg class="mb-glyph" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="#fff" stroke-width="1.7"/><circle cx="6" cy="6" r="1.3" fill="#fff"/></svg><b>桌面</b>${MENU_ITEMS.map((m) => `<span>${m}</span>`).join('')}</div>` +
    `<div class="mb-menu-r"><i class="mb-ic mb-ic-bat">${battery}</i><i class="mb-ic mb-ic-wifi">${wifi}</i><i class="mb-ic mb-ic-s">${search}</i><i class="mb-ic mb-ic-c">${ctrl}</i><span class="mb-clock"></span></div></div>` +
    `<div class="mb-dock">${dockHtml(dock)}</div>` +
    `</div>`
  ).replace('<span class="mb-clock"></span>', `<span class="mb-clock">${kit.esc(clock)}</span>`)
}

/** 鍵盤:每個鍵一個 div(淡淡的符號 + 亮起的疊層) */
function keysHtml(): string {
  return KEY_SPECS.map((k) => {
    const cls = ['mb-key', k.id.length > 1 ? 'mb-mod' : '', k.h < 1 ? 'mb-short' : ''].filter(Boolean).join(' ')
    const lab = k.label ? `<span>${kit.esc(k.label)}</span>` : ''
    const style =
      `left:${U(k.x * KB.pitch + KB.gap / 2)};top:${U(k.y * KB.pitch + KB.gap / 2)};` +
      `width:${U(k.w * KB.pitch - KB.gap)};height:${U(k.h * KB.pitch - KB.gap)}`
    return `<div class="${cls}" data-key="${kit.esc(k.id)}" style="${style}">${lab}<i></i></div>`
  }).join('')
}

const kindOf = (ev: ActorEvent): MbKind | null =>
  (KINDS as readonly string[]).includes(ev.kind) ? (ev.kind as MbKind) : (KINDS.find((k) => k in ev.step) ?? null)

const actor = defineActor<MbKind, MacbookStep, MacbookProps, MbState, MacbookTarget>({
  name: 'macbook',
  kinds: KINDS,

  duration(kind, step) {
    return durationOf(kind, step)
  },

  autoFocus(kind) {
    if (kind === 'wake') return 'screen'
    if (kind === 'type') return 'keyboard'
    if (kind === 'close') return false
    return undefined
  },

  init(props) {
    if (props.finish !== undefined && !FINISHES.includes(props.finish)) throw new Error(`macbook 的 finish 只能是 ${FINISHES.join('、')}`)
    if (props.wallpaper !== undefined && !WALLPAPERS.includes(props.wallpaper)) throw new Error(`macbook 的 wallpaper 只能是 ${WALLPAPERS.join('、')}`)
    if (props.dock !== undefined && !(props.dock >= 0 && props.dock <= DOCK_ICONS.length)) throw new Error(`macbook 的 dock 要在 0–${DOCK_ICONS.length} 之間`)
    const opened = props.opened === true
    const base: MbState = { opened, awake: props.awake ?? opened, angle: DEFAULT_ANGLE, pitch: 15, yaw: 0 }
    if (props.angle !== undefined) {
      if (!(props.angle >= 90 && props.angle <= 135)) throw new Error('macbook 的 angle 要在 90–135 度之間')
      base.angle = props.angle
    }
    if (props.awake && !opened) throw new Error('macbook:闔上的時候螢幕不能是亮的(awake 要搭配 opened)')
    if (props.pitch !== undefined) {
      if (!(props.pitch >= 0 && props.pitch <= 70)) throw new Error('macbook 的 pitch 要在 0–70 度之間')
      base.pitch = props.pitch
    }
    if (props.yaw !== undefined) {
      if (!(props.yaw >= -60 && props.yaw <= 60)) throw new Error('macbook 的 yaw 要在 -60–60 度之間')
      base.yaw = props.yaw
    }
    return base
  },

  apply(st, kind, step) {
    return applyMb(st, kind, step)
  },

  mount(root, props) {
    const finish = props.finish ?? 'silver'
    const wallpaper = props.wallpaper ?? 'dawn'
    root.classList.add('A-macbook', `fin-${finish}`, `wp-${wallpaper}`)
    const keyBox = (x: number, y: number, w: number, h: number): string => `left:${U(x)};top:${U(y)};width:${U(w)};height:${U(h)}`
    root.innerHTML =
      `<div class="mb-box"><div class="mb-persp"><div class="mb-rig">` +
      // 地面陰影
      `<div class="mb-ground"></div><div class="mb-contact"></div>` +
      // 底座:上面(鍵盤區)、前緣、兩側
      `<div class="mb-deck">` +
      `<div class="mb-hingeband"></div>` +
      `<div class="mb-spk" style="${keyBox(26, 40, 66, 300)}"></div><div class="mb-spk" style="${keyBox(908, 40, 66, 300)}"></div>` +
      `<div class="mb-kbwell" style="${keyBox(KB.x - 8, KB.y - 8, 15 * KB.pitch + 16, (0.66 + 5) * KB.pitch + 16)}"></div>` +
      `<div class="mb-kb" style="${keyBox(KB.x, KB.y, 15 * KB.pitch, (0.66 + 5) * KB.pitch)}">${keysHtml()}</div>` +
      `<div class="mb-tp" style="${keyBox(TP.x, TP.y, TP.w, TP.h)}"></div>` +
      `<div class="mb-glow"></div>` +
      `</div>` +
      `<div class="mb-front"><div class="mb-scoop"></div></div>` +
      `<div class="mb-side mb-side-l"></div><div class="mb-side mb-side-r"></div>` +
      // 上蓋
      `<div class="mb-lid">` +
      `<div class="mb-lidface"><div class="mb-screen">${desktopHtml(props.clock ?? '週三 9:41', props.dock ?? 7)}` +
      `<div class="mb-black"></div><div class="mb-dark"></div><div class="mb-glare"></div>` +
      `<div class="mb-notch"><i class="mb-cam"></i></div></div></div>` +
      `<div class="mb-lidback"><div class="mb-sheen"></div></div>` +
      `<div class="mb-edge mb-edge-l"></div><div class="mb-edge mb-edge-r"></div><div class="mb-edge mb-edge-t"></div>` +
      `</div>` +
      `</div></div><div class="mb-proxies"></div></div>`

    const $ = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!
    const box = $('.mb-box')
    const rig = $('.mb-rig')
    const lid = $('.mb-lid')
    const lidface = $('.mb-lidface')
    const screen = $('.mb-screen')
    const sheen = $('.mb-sheen')
    const glow = $('.mb-glow')
    const black = $('.mb-black')
    const dark = $('.mb-dark')
    const glare = $('.mb-glare')
    const kb = $('.mb-kb')
    const tp = $('.mb-tp')
    const deck = $('.mb-deck')
    const front = $('.mb-front')
    const proxies = $('.mb-proxies')
    const keyEls = new Map<string, { key: HTMLElement; lit: HTMLElement }>()
    for (const el of root.querySelectorAll<HTMLElement>('.mb-key')) keyEls.set(el.dataset.key!, { key: el, lit: el.querySelector<HTMLElement>('i')! })
    // 固定的幾何:不隨時間變
    kit.css(lidface, { width: U(W), height: U(LID_H) })

    // 打字的按鍵時間表:同一個動作只算一次(只由步驟內容決定,是純函式的結果)
    const strokeCache = new WeakMap<object, Stroke[]>()
    const strokesFor = (step: object): Stroke[] => {
      let s = strokeCache.get(step)
      if (!s) strokeCache.set(step, (s = strokesOf(step)))
      return s
    }

    return {
      render(frame) {
        const v = frame.view
        if (!v || !v.state) return
        const { prev, ev } = v
        let { state } = v
        const k = ev ? kindOf(ev) : null
        // show/hide 沒帶動作:畫面不變;hide 時舞台清掉了狀態,退場過程中仍畫退場前的樣子
        if (ev && !k && ev.kind === 'hide') state = prev
        const p = ev && k ? ev.p : 1

        const lidAngle = k === 'open' || k === 'close' ? lidAngleAt(lidOf(prev), lidOf(state), p) : lidOf(state)
        // 螢幕亮度:闔上時很快熄掉
        let wake = state.awake ? 1 : 0
        if (k === 'wake' || k === 'sleep') wake = kit.lerp(prev.awake ? 1 : 0, state.awake ? 1 : 0, kit.ease.inOutQuad(p))
        else if (k === 'close') wake = kit.lerp(prev.awake ? 1 : 0, 0, kit.ease.outQuad(kit.progress(p, 0, 0.45)))
        let { pitch, yaw } = state
        if (k === 'tilt') {
          const e = kit.ease.inOutCubic(p)
          pitch = kit.lerp(prev.pitch, state.pitch, e)
          yaw = kit.lerp(prev.yaw, state.yaw, e)
        }

        // 機身:俯視、旋轉、闔上時移到中央
        const open = openness(lidAngle)
        const shift = -(1 - kit.ease.inOutQuad(open)) * CLOSED_SHIFT
        kit.setIf(rig, 'transform', `translateY(${U(shift)}) rotateX(${(-pitch).toFixed(3)}deg) rotateY(${yaw.toFixed(3)}deg)`)
        // 上蓋:90 度 = 直立;閉合時貼在底座上(微微抬起避免和鍵盤區重疊閃爍)
        kit.setIf(lid, 'transform', `rotateX(${(lidAngle - 90).toFixed(3)}deg) translateZ(${U(-0.8)})`)
        // 外殼的反光帶隨開蓋角度掃過
        kit.setIf(sheen, 'transform', `translateY(${U(kit.lerp(LID_H * 0.9, -LID_H * 0.5, kit.clamp(lidAngle / 120)))})`)

        // 螢幕:黑色遮罩、熄屏時的玻璃反光;鍵盤上的螢幕反光
        kit.setIf(black, 'opacity', (1 - wake).toFixed(3))
        kit.setIf(dark, 'opacity', (1 - wake).toFixed(3))
        kit.setIf(glare, 'opacity', (0.55 + 0.45 * wake).toFixed(3))
        kit.setIf(glow, 'opacity', (wake * open).toFixed(3))

        // 打字:按鍵下沉與淡淡亮起
        const levels = k === 'type' && ev ? keyLevels(strokesFor(ev.step), ev.local) : null
        for (const [id, els] of keyEls) {
          const lv = levels?.get(id)
          const press = lv?.press ?? 0
          const lit = lv?.glow ?? 0
          kit.setIf(els.key, 'transform', press > 0 ? `translateY(${U(1.6 * press)}) scale(${(1 - 0.045 * press).toFixed(4)})` : 'none')
          kit.setIf(els.lit, 'opacity', Math.max(lit, press * 0.9).toFixed(3))
        }
      },

      target(name) {
        if (!name) return null
        let els: HTMLElement[]
        if (name === 'screen') els = [screen]
        else if (name === 'lid') els = [lid]
        else if (name === 'keyboard') els = [kb]
        else if (name === 'trackpad') els = [tp]
        else if (name === 'window') els = [lid, deck, front]
        else if (name.startsWith('key:')) {
          const found = keyEls.get(name.slice(4))
          if (!found) return null
          els = [found.key]
        } else return null
        // 舞台量位置是用 offsetLeft/offsetTop 累加(不受縮放與 3D 影響),所以在盒子上放看不見的替身:
        // 位置與大小依元素「投影後實際的外框」換算成盒子座標(未縮放),鏡頭、聚光燈、滑鼠才對得準。
        const br = box.getBoundingClientRect()
        if (!box.offsetWidth || !br.width) return null
        const s = br.width / box.offsetWidth
        let x0 = Infinity
        let y0 = Infinity
        let x1 = -Infinity
        let y1 = -Infinity
        for (const el of els) {
          const r = el.getBoundingClientRect()
          x0 = Math.min(x0, r.left)
          y0 = Math.min(y0, r.top)
          x1 = Math.max(x1, r.right)
          y1 = Math.max(y1, r.bottom)
        }
        let proxy = [...proxies.children].find((c) => (c as HTMLElement).dataset.name === name) as HTMLElement | undefined
        if (!proxy) {
          proxy = document.createElement('div')
          proxy.className = 'mb-proxy'
          proxy.dataset.name = name
          proxies.appendChild(proxy)
        }
        kit.css(proxy, {
          left: `${((x0 - br.left) / s).toFixed(1)}px`,
          top: `${((y0 - br.top) / s).toFixed(1)}px`,
          width: `${((x1 - x0) / s).toFixed(1)}px`,
          height: `${((y1 - y0) / s).toFixed(1)}px`,
        })
        return proxy
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
