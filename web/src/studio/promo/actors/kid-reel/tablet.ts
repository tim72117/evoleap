// kid-reel 的背景、開場標題、平板機身、亮點標籤、亮點清單(書桌鏡頭在 desk.ts)。
// 版面是 1080×1920 的設計座標(layout.ts);課程演員是另外的演員,疊在 SCREEN 上(腳本的 place),所以平板停好之後
// 機身不能再動(不然對不齊):待機的「活」感來自鋁框上的反光、背景光斑與漂浮積木,不搖動機身。
// 所有動畫由 render 依時間算出(SPEC 第 1 節):沒有 CSS transition/animation、沒有 Math.random(散景位置用 kit.rand 固定種子)。
import { kit } from '../../../../live/kit'
import type { ReelFrame, ReelState, Target } from './actor'
import { BEZEL, CHIP, SAFE, SCREEN, TABLET } from './layout'
import './tablet.css'

const { clamp, lerp, ease, esc } = kit
const P = (local: number, start: number, dur: number): number => kit.progress(local, start, dur)

// ---------- 背景:光斑、散景、漂浮積木 ----------
/** 大光斑:位置(設計座標)、大小、顏色、漂移週期 */
const BLOBS = [
  { x: 180, y: 300, r: 520, c: '255, 196, 140', px: 9000, py: 11000, a: 70 },
  { x: 920, y: 520, r: 460, c: '255, 160, 170', px: 12000, py: 8000, a: 60 },
  { x: 120, y: 1260, r: 560, c: '170, 214, 255', px: 10000, py: 13000, a: 80 },
  { x: 980, y: 1500, r: 520, c: '200, 180, 255', px: 14000, py: 9500, a: 70 },
  { x: 560, y: 980, r: 420, c: '255, 228, 150', px: 11000, py: 12500, a: 90 },
]
const rnd = kit.rand('kid-reel-bokeh')
const BOKEH = Array.from({ length: 18 }, (_, i) => ({
  x: 40 + rnd() * 1000,
  y: 120 + rnd() * 1700,
  r: 10 + rnd() * 34,
  a: 0.25 + rnd() * 0.4,
  sp: 0.6 + rnd() * 0.8,
  ph: rnd() * Math.PI * 2,
  c: ['255,255,255', '255,214,160', '255,190,200', '190,225,255'][i % 4],
}))
/** 漂浮的玩具積木(背景,開場時比較靠近、比較清楚) */
const TOYS = [
  { x: 96, y: 330, s: 92, rot: -14, c: 'orange', icon: 'lines' },
  { x: 880, y: 300, s: 78, rot: 12, c: 'teal', icon: 'pic' },
  { x: 60, y: 1540, s: 84, rot: 10, c: 'purple', icon: 'pill' },
  { x: 890, y: 1600, s: 96, rot: -8, c: 'pink', icon: 'star' },
  { x: 950, y: 1080, s: 60, rot: 20, c: 'yellow', icon: 'lines' },
  { x: 30, y: 900, s: 64, rot: -22, c: 'sky', icon: 'pic' },
]
const ICON: Record<string, string> = {
  lines: '<i class="ln"></i><i class="ln s"></i><i class="ln"></i>',
  pic: '<svg viewBox="0 0 40 30"><circle cx="29" cy="9" r="4.5"/><path d="M2 28 14 13l8 9 5-5 11 11Z"/></svg>',
  pill: '<b class="pl"></b>',
  star: '<svg viewBox="0 0 40 40"><path d="M20 3l5 11 12 1.5-9 8 2.6 12L20 30l-10.6 5.5L12 23.5l-9-8L15 14Z"/></svg>',
}
const toyHtml = (c: string, icon: string): string => `<div class="kr-toy-face kr-c-${c}">${ICON[icon]}</div>`

// ---------- 平板螢幕的「首頁」:沒有課程演員疊上來時看到的畫面(換場的空檔、滑進來的時候) ----------
const UNITS = [
  { t: '用積木蓋網頁', c: 'orange', icon: 'lines' },
  { t: '幫網頁換衣服', c: 'pink', icon: 'star' },
  { t: '讓網頁動起來', c: 'teal', icon: 'pill' },
  { t: '請 AI 幫忙做', c: 'purple', icon: 'pic' },
]
const HOME =
  `<div class="kr-home">` +
  `<div class="kr-home-bar"><span class="kr-home-logo"><i></i></span><b>給孩子的網頁程式</b></div>` +
  `<div class="kr-home-hero"><small>今天要玩什麼？</small><h3>選一課開始</h3></div>` +
  `<div class="kr-home-grid">${UNITS.map((u) => `<div class="kr-home-card">${toyHtml(u.c, u.icon)}<span>${esc(u.t)}</span></div>`).join('')}</div>` +
  `</div>`

/** 開場標題拆成兩行(六個字以內一行) */
function headlineLines(text: string): string[][] {
  const lines = text.split('\n').map((l) => kit.graphemes(l))
  if (lines.length > 1) return lines
  const g = lines[0]
  if (g.length <= 6) return [g]
  const cut = Math.ceil(g.length * 0.62)
  return [g.slice(0, cut), g.slice(cut)]
}

const CHECK_LEN = 40
const RING_LEN = 2 * Math.PI * 30

export function mountTablet(root: HTMLElement): { render(f: ReelFrame): void; target(name: Target): HTMLElement | null } {
  const px = (n: number): string => `${n}px`
  root.innerHTML =
    `<div class="kr-bg">` +
    `<div class="kr-bg-base"></div>` +
    BLOBS.map(() => '<i class="kr-blob"></i>').join('') +
    `<div class="kr-bg-grid"></div>` +
    BOKEH.map(() => '<i class="kr-bokeh"></i>').join('') +
    TOYS.map((t) => `<div class="kr-toy">${toyHtml(t.c, t.icon)}</div>`).join('') +
    `<div class="kr-bg-vignette"></div>` +
    `</div>` +
    // 開場
    `<div class="kr-op" style="left:${px(SAFE.x)};top:${px(SAFE.y)};width:${px(SAFE.w)};height:${px(SAFE.h)}">` +
    `<div class="kr-op-kicker"><span class="kr-op-dot"></span><span class="kr-op-kicker-text"></span></div>` +
    `<h1 class="kr-op-title"></h1>` +
    `<svg class="kr-op-swash" viewBox="0 0 600 60" preserveAspectRatio="none"><path d="M8 40 C 140 12, 300 8, 592 30"/></svg>` +
    `<div class="kr-op-blocks">${['orange', 'teal', 'purple'].map((c, i) => `<div class="kr-op-block">${toyHtml(c, ['lines', 'pic', 'pill'][i])}</div>`).join('')}</div>` +
    `</div>` +
    // 平板
    `<div class="kr-tablet" style="left:${px(TABLET.x)};top:${px(TABLET.y)};width:${px(TABLET.w)};height:${px(TABLET.h)}">` +
    `<div class="kr-tab-shadow"></div><div class="kr-tab-contact"></div>` +
    `<div class="kr-tab-body">` +
    `<div class="kr-tab-edge-sheen"></div>` +
    `<div class="kr-tab-bezel" style="inset:${px(6)}"><span class="kr-tab-cam"></span></div>` +
    `<div class="kr-screen" style="left:${px(BEZEL)};top:${px(BEZEL)};width:${px(SCREEN.w)};height:${px(SCREEN.h)}"><div class="kr-screen-idle"><span class="kr-home-logo"><i></i></span><span class="kr-idle-dots"><i></i><i></i><i></i></span></div>${HOME}<div class="kr-screen-glow"></div></div>` +
    `<div class="kr-tab-dim"></div>` +
    `</div>` +
    `<i class="kr-tab-btn kr-tab-btn-top"></i><i class="kr-tab-btn kr-tab-btn-side"></i><i class="kr-tab-btn kr-tab-btn-side2"></i>` +
    `</div>` +
    // 亮點標籤(兩個輪流用:換亮點時舊的滑走、新的滑進來)
    `<div class="kr-chip-row" style="left:${px(CHIP.x)};top:${px(CHIP.y)};width:${px(CHIP.w)};height:${px(CHIP.h)}">` +
    `<div class="kr-chip"><span class="kr-chip-n"></span><span class="kr-chip-t"></span><span class="kr-chip-shine"></span></div>` +
    `<div class="kr-chip"><span class="kr-chip-n"></span><span class="kr-chip-t"></span><span class="kr-chip-shine"></span></div>` +
    `</div>` +
    // 亮點清單
    `<div class="kr-recap" style="left:${px(SAFE.x)};top:${px(SAFE.y)};width:${px(SAFE.w)};height:${px(SAFE.h)}">` +
    `<div class="kr-recap-head"><span class="kr-recap-kicker">課程亮點</span></div><div class="kr-recap-list"></div></div>`

  const $ = <T extends Element = HTMLElement>(sel: string): T => root.querySelector<T>(sel)!
  const $$ = <T extends Element = HTMLElement>(sel: string): T[] => [...root.querySelectorAll<T>(sel)]
  const blobs = $$('.kr-blob')
  const bokeh = $$('.kr-bokeh')
  const toys = $$('.kr-toy')
  const grid = $('.kr-bg-grid')
  const op = $('.kr-op')
  const opKicker = $('.kr-op-kicker')
  const opKickerText = $('.kr-op-kicker-text')
  const opTitle = $('.kr-op-title')
  const opSwash = $<SVGSVGElement>('.kr-op-swash')
  const opSwashPath = $<SVGPathElement>('.kr-op-swash path')
  const opBlocks = $$('.kr-op-block')
  const tablet = $('.kr-tablet')
  const tabShadow = $('.kr-tab-shadow')
  const tabContact = $('.kr-tab-contact')
  const tabSheen = $('.kr-tab-edge-sheen')
  const tabDim = $('.kr-tab-dim')
  const screen = $('.kr-screen')
  const screenGlow = $('.kr-screen-glow')
  const home = $('.kr-home')
  const idleDots = $$('.kr-idle-dots i')
  const homeCards = $$('.kr-home-card')
  const chipRow = $('.kr-chip-row')
  const chips = $$('.kr-chip')
  const recap = $('.kr-recap')
  const recapHead = $('.kr-recap-head')
  const recapList = $('.kr-recap-list')

  // 位置固定的東西先排好
  BOKEH.forEach((b, i) => kit.css(bokeh[i], { width: px(b.r * 2), height: px(b.r * 2), background: `radial-gradient(circle, rgba(${b.c},${b.a}) 0%, rgba(${b.c},${(b.a * 0.5).toFixed(2)}) 45%, rgba(${b.c},0) 70%)` }))
  BLOBS.forEach((b, i) => kit.css(blobs[i], { width: px(b.r * 2), height: px(b.r * 2), background: `radial-gradient(circle, rgba(${b.c},0.55) 0%, rgba(${b.c},0.22) 40%, rgba(${b.c},0) 70%)` }))
  TOYS.forEach((t, i) => kit.css(toys[i], { width: px(t.s), height: px(t.s) }))

  let titleKey = ''
  let titleChars: HTMLElement[] = []
  let titleLineCount = 1
  let recapKey = ''
  let recapCards: { card: HTMLElement; ring: SVGCircleElement; check: SVGPathElement; text: HTMLElement }[] = []
  const chipKey = ['', '']

  function setTitle(text: string): void {
    if (text === titleKey) return
    titleKey = text
    const lines = headlineLines(text)
    titleLineCount = lines.length
    opTitle.innerHTML = lines
      .map((l, li) => `<span class="kr-op-line${li === lines.length - 1 && lines.length > 1 ? ' kr-op-accent' : ''}">${l.map((c) => `<span class="kr-op-ch">${esc(c)}</span>`).join('')}</span>`)
      .join('')
    titleChars = $$('.kr-op-ch')
  }

  function setRecap(items: string[]): void {
    const key = items.join('\u0000')
    if (key === recapKey) return
    recapKey = key
    recapList.innerHTML = items
      .map(
        (t, i) =>
          `<div class="kr-rc"><span class="kr-rc-badge"><svg viewBox="0 0 72 72"><circle class="kr-rc-ring" cx="36" cy="36" r="30"/><path class="kr-rc-check" d="M23 37l9 9 17-19"/></svg></span>` +
          `<span class="kr-rc-text">${esc(t)}</span><span class="kr-rc-n">${String(i + 1).padStart(2, '0')}</span></div>`,
      )
      .join('')
    recapCards = $$('.kr-rc').map((card) => ({ card, ring: card.querySelector<SVGCircleElement>('.kr-rc-ring')!, check: card.querySelector<SVGPathElement>('.kr-rc-check')!, text: card.querySelector<HTMLElement>('.kr-rc-text')! }))
  }

  function setChip(i: number, n: number, text: string): void {
    const key = `${n}:${text}`
    if (chipKey[i] === key) return
    chipKey[i] = key
    chips[i].querySelector('.kr-chip-n')!.textContent = String(n)
    chips[i].querySelector('.kr-chip-t')!.textContent = text
  }

  /** 東西在不在畫面上(0–1):這個動作讓它出現/消失時依 l 漸變,其他時候看狀態 */
  const presence = (on: (s: ReelState) => boolean, f: ReelFrame, inMs: number, outMs: number, inDelay = 0): { v: number; entering: boolean; leaving: boolean; l: number } => {
    const was = on(f.prev)
    const is = on(f.st)
    if (f.kind && was !== is) {
      if (is) return { v: P(f.l, inDelay, inMs), entering: true, leaving: false, l: f.l - inDelay }
      return { v: 1 - P(f.l, 0, outMs), entering: false, leaving: true, l: f.l }
    }
    return { v: is ? 1 : 0, entering: false, leaving: false, l: Infinity }
  }

  return {
    render(f) {
      const ms = f.ms
      const st = f.st

      // ---------- 背景 ----------
      BLOBS.forEach((b, i) => {
        const x = b.x + Math.sin((ms / b.px) * Math.PI * 2 + i) * b.a - b.r
        const y = b.y + Math.cos((ms / b.py) * Math.PI * 2 + i * 1.7) * b.a - b.r
        kit.css(blobs[i], { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` })
      })
      BOKEH.forEach((b, i) => {
        const t = ms / 1000
        const x = b.x + Math.sin(t * 0.35 * b.sp + b.ph) * 26 - b.r
        const y = b.y + Math.cos(t * 0.27 * b.sp + b.ph) * 34 - b.r
        const tw = 0.65 + 0.35 * Math.sin(t * 0.9 * b.sp + b.ph * 2)
        kit.css(bokeh[i], { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, opacity: tw.toFixed(3) })
      })

      // 開場在畫面上的程度(漂浮積木開場時比較近、比較清楚)
      const opOn = (s: ReelState): boolean => !!s.opener
      const opP = presence(opOn, f, 400, f.kind === 'tablet' ? 450 : f.dur)
      const opText = st.opener ?? f.prev.opener
      const focusToys = opP.v
      TOYS.forEach((t, i) => {
        const s = ms / 1000
        const dx = Math.sin(s * 0.4 + i * 1.3) * 14
        const dy = Math.cos(s * 0.33 + i * 0.9) * 22
        const rot = t.rot + Math.sin(s * 0.3 + i) * 6
        const sc = lerp(0.78, 1, focusToys)
        kit.css(toys[i], {
          transform: `translate(${(t.x - t.s / 2 + dx).toFixed(1)}px, ${(t.y - t.s / 2 + dy).toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`,
          opacity: lerp(0.45, 0.95, focusToys).toFixed(3),
          filter: `blur(${lerp(2.2, 0, focusToys).toFixed(2)}px)`,
        })
      })
      kit.css(grid, { opacity: lerp(0.55, 0.3, focusToys).toFixed(3), transform: `translateY(${(-((ms / 80) % 48)).toFixed(2)}px)` })

      // ---------- 開場標題 ----------
      if (opText) {
        setTitle(opText.text)
        opKickerText.textContent = opText.kicker
        kit.css(opKicker, { display: opText.kicker ? '' : 'none' })
      }
      const opL = f.kind === 'opener' && st.opener ? f.l : Infinity
      const opOut = opP.leaving ? ease.inCubic(1 - opP.v) : opText && (st.opener || opP.leaving) ? 0 : 1
      kit.css(op, { display: opText && opOut < 1 ? '' : 'none', opacity: (1 - opOut).toFixed(3), transform: `translateY(${(-140 * opOut).toFixed(1)}px) scale(${(1 - 0.06 * opOut).toFixed(4)})`, filter: opOut > 0.01 ? `blur(${(opOut * 6).toFixed(2)}px)` : 'none' })
      if (opText && opOut < 1) {
        // 小字膠囊:先淡入往上
        const kp = ease.outCubic(P(opL, 0, 520))
        kit.css(opKicker, { opacity: kp.toFixed(3), transform: `translateY(${((1 - kp) * 30).toFixed(1)}px)` })
        // 標題一個字一個字升起
        titleChars.forEach((el, i) => {
          const p = P(opL, 220 + i * 75, 640)
          const y = (1 - ease.outBack(p)) * 90
          kit.css(el, { opacity: clamp(p * 1.8).toFixed(3), transform: `translateY(${y.toFixed(1)}px) rotate(${((1 - ease.outCubic(p)) * (i % 2 ? 6 : -6)).toFixed(2)}deg)`, filter: p < 1 ? `blur(${((1 - p) * 10).toFixed(2)}px)` : 'none' })
        })
        // 第二行下面畫一道筆刷
        const sw = ease.inOutCubic(P(opL, 220 + titleChars.length * 75 + 120, 520))
        kit.css(opSwash, { display: titleLineCount > 1 ? '' : 'none' })
        kit.css(opSwashPath, kit.drawPath(sw, 620))
        // 三塊積木一塊一塊掉下來疊好
        opBlocks.forEach((el, i) => {
          const start = 900 + i * 180
          const p = P(opL, start, 700)
          const y = (1 - kit.spring(Math.max(0, opL - start), { stiffness: 260, damping: 15 })) * -260
          const breathe = Math.sin(ms / 900 + i) * 4
          kit.css(el, { opacity: clamp(p * 3).toFixed(3), transform: `translateY(${(y + breathe).toFixed(1)}px) rotate(${(-8 + i * 8 + (1 - p) * 20).toFixed(2)}deg)` })
        })
      }

      // ---------- 平板 ----------
      const tabOn = (s: ReelState): boolean => s.tablet
      const tabP = presence(tabOn, f, 850, f.dur, 150)
      let ty = 0
      let trot = 0
      let tsc = 1
      if (tabP.entering) {
        const sp = kit.spring(Math.max(0, tabP.l), { stiffness: 120, damping: 17 })
        ty = (1 - sp) * 1500
        trot = (1 - sp) * 9
        tsc = 0.92 + 0.08 * sp
      } else if (tabP.leaving) {
        const p = ease.inCubic(1 - tabP.v)
        ty = p * 1600
        trot = -p * 7
      } else if (!st.tablet) ty = 1600
      // 亮點清單:平板縮小、退後、變暗
      const rcOn = (s: ReelState): boolean => !!s.recap && s.tablet
      const rcP = presence(rcOn, f, 900, f.dur)
      const back = rcP.leaving && f.kind === 'tablet' ? 1 : ease.inOutCubic(rcP.v)
      tsc *= lerp(1, 0.8, back)
      const visible = st.tablet || tabP.leaving
      kit.css(tablet, {
        display: visible ? '' : 'none',
        transform: `translateY(${(ty - back * 40).toFixed(1)}px) rotate(${trot.toFixed(3)}deg) scale(${tsc.toFixed(4)})`,
        filter: back > 0.01 ? `blur(${(back * 5).toFixed(2)}px) saturate(${(1 - back * 0.3).toFixed(3)})` : 'none',
      })
      kit.css(tabDim, { opacity: (back * 0.42).toFixed(3) })
      // 陰影跟著高度:越高越淡越大
      const lift = clamp(ty / 600)
      kit.css(tabShadow, { opacity: ((1 - lift) * (1 - back * 0.5)).toFixed(3) })
      kit.css(tabContact, { opacity: ((1 - lift) * (1 - back)).toFixed(3) })
      // 鋁框上的反光慢慢流過(機身不動,光在動)
      const sheen = ((ms / 7000) % 1) * 360
      kit.css(tabSheen, { background: `conic-gradient(from ${sheen.toFixed(1)}deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.75) 22deg, rgba(255,255,255,0) 60deg, rgba(255,255,255,0) 180deg, rgba(255,255,255,0.5) 205deg, rgba(255,255,255,0) 240deg, rgba(255,255,255,0) 360deg)` })
      // 螢幕:滑進來時亮起,首頁的卡片一張張浮上來
      const boot = tabP.entering ? ease.inOutQuad(P(tabP.l, 120, 420)) : st.tablet || tabP.leaving ? 1 : 0
      kit.css(screenGlow, { opacity: (1 - boot).toFixed(3) })
      // 首頁只在第一個亮點之前出現;之後換場的空檔是素色的螢幕(不和疊上來的課程演員搶畫面)
      const homeP = presence((s) => s.pointN === 0, f, 300, 300)
      kit.css(home, { display: homeP.v > 0 ? '' : 'none', opacity: homeP.v.toFixed(3) })
      // 換場空檔:三個點輪流跳(下一課載入中)
      idleDots.forEach((el, i) => {
        const b = Math.max(0, Math.sin((ms / 520) * Math.PI - i * 0.9))
        kit.css(el, { transform: `translateY(${(-14 * b).toFixed(1)}px)`, opacity: (0.35 + 0.5 * b).toFixed(3) })
      })
      homeCards.forEach((el, i) => {
        const p = tabP.entering ? ease.outBack(P(tabP.l, 300 + i * 90, 500)) : 1
        kit.css(el, { opacity: clamp(p).toFixed(3), transform: `translateY(${((1 - p) * 40).toFixed(1)}px)` })
      })

      // ---------- 亮點標籤 ----------
      const ptOn = (s: ReelState): boolean => !!s.point && s.tablet
      const changing = f.kind === 'point' && !!f.st.point && !!f.prev.point && f.prev.pointN !== f.st.pointN
      const chipShow = (el: HTMLElement, x: number, o: number, sc: number): void => {
        kit.css(el, { display: o > 0.001 ? '' : 'none', opacity: clamp(o).toFixed(3), transform: `translateX(${x.toFixed(1)}px) scale(${sc.toFixed(4)})` })
      }
      const [chipA, chipB] = chips
      // 標籤的閃光:新標籤落定後掃過一次
      const shineOf = (el: HTMLElement, local: number): void => {
        const p = P(local, 350, 700)
        kit.css(el.querySelector<HTMLElement>('.kr-chip-shine')!, { opacity: p > 0 && p < 1 ? '1' : '0', transform: `translateX(${lerp(-160, 900, ease.inOutQuad(p)).toFixed(1)}px) skewX(-18deg)` })
      }
      if (changing) {
        // 舊的往左滑走,新的從右邊彈進來
        setChip(0, f.prev.pointN, f.prev.point as string)
        setChip(1, st.pointN, st.point as string)
        const pOut = ease.inCubic(P(f.l, 0, 360))
        const pIn = P(f.l, 180, 620)
        chipShow(chipA, -260 * pOut, 1 - pOut, 1 - 0.1 * pOut)
        chipShow(chipB, (1 - ease.outBack(pIn)) * 320, ease.outCubic(pIn), 0.9 + 0.1 * ease.outBack(pIn))
        shineOf(chipB, f.l - 180)
      } else {
        const pp = presence(ptOn, f, 620, Math.min(f.dur, 450))
        const shown = st.point ?? f.prev.point
        const n = st.point ? st.pointN : f.prev.pointN
        if (shown) setChip(1, n, shown)
        chipShow(chipA, 0, 0, 1)
        if (pp.entering) {
          const p = ease.outBack(pp.v)
          chipShow(chipB, 0, ease.outCubic(pp.v), 0.6 + 0.4 * p)
          kit.css(chipB, { transform: `translateY(${((1 - p) * 60).toFixed(1)}px) scale(${(0.6 + 0.4 * p).toFixed(4)})` })
          shineOf(chipB, pp.l)
        } else if (pp.leaving) {
          const p = ease.inCubic(1 - pp.v)
          chipShow(chipB, 0, 1 - p, 1 - 0.15 * p)
          kit.css(chipB, { transform: `translateY(${(-50 * p).toFixed(1)}px) scale(${(1 - 0.15 * p).toFixed(4)})` })
          shineOf(chipB, -1)
        } else {
          chipShow(chipB, 0, pp.v, 1)
          shineOf(chipB, -1)
        }
      }
      // 標籤待機時輕輕浮動(它不和課程演員對位,可以動)
      kit.css(chipRow, { transform: `translateY(${(Math.sin(ms / 1100) * 5).toFixed(2)}px)` })

      // ---------- 亮點清單 ----------
      const items = st.recap ?? f.prev.recap
      if (items) setRecap(items)
      kit.css(recap, { display: items && (rcP.v > 0 || rcP.entering) ? '' : 'none' })
      if (items) {
        const rl = rcP.entering ? f.l : Infinity
        const out = rcP.leaving ? ease.inCubic(1 - rcP.v) : 0
        kit.css(recap, { opacity: (1 - out).toFixed(3), transform: `translateY(${(-80 * out).toFixed(1)}px)` })
        const hp = ease.outCubic(P(rl, 200, 500))
        kit.css(recapHead, { opacity: hp.toFixed(3), transform: `translateY(${((1 - hp) * 24).toFixed(1)}px)` })
        recapCards.forEach((c, i) => {
          const start = 420 + i * 520
          const p = P(rl, start, 560)
          const e = ease.outBack(p)
          kit.css(c.card, { opacity: clamp(p * 1.6).toFixed(3), transform: `translateX(${((1 - e) * -120).toFixed(1)}px) scale(${(0.94 + 0.06 * e).toFixed(4)})` })
          kit.css(c.ring, kit.drawPath(ease.outCubic(P(rl, start + 120, 420)), RING_LEN))
          kit.css(c.check, kit.drawPath(ease.outCubic(P(rl, start + 380, 300)), CHECK_LEN))
          const pop = P(rl, start + 380, 360)
          kit.css(c.card.querySelector<HTMLElement>('.kr-rc-badge')!, { transform: `scale(${(1 + Math.sin(pop * Math.PI) * 0.18).toFixed(4)})` })
          kit.css(c.text, { opacity: clamp(P(rl, start + 120, 400) * 1.2).toFixed(3) })
        })
      }
    },
    target(name) {
      return name === 'tablet' ? tablet : name === 'screen' ? screen : name === 'chip' ? chipRow : null
    },
  }
}

