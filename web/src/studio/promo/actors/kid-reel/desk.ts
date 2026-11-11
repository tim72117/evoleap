// kid-reel 的書桌鏡頭:比較寫實的一段。鏡頭在孩子右肩的側後方,看他在家裡的書桌上用平板上課。
// 前景是孩子的後腦勺、耳朵、帽 T 的肩膀(淺景深、有點糊),右手伸向桌上斜立的平板;
// 背景是窗戶、書櫃、檯燈(模糊),窗光從左邊斜斜照進來,光束裡有灰塵在飄。
// 平板一開始是 3.5「擲骰子」那一課的學習畫面(課程播放列、老師字幕、魔法積木「點了擲骰子 → 擲出 □」、積木盒、小測驗):
//   deskLearn "drag"   孩子按住積木盒裡的「1 到 6」拖進空格,放好時積木彈一下、空格發光、字幕換下一句
//   deskLearn "answer" 小測驗「1 到 6 的骰子，會擲出 8 嗎？」點「不會」:變綠、打勾、「答對了！」跳出來,孩子開心一聳
//   deskLearn "play"   「換你擲骰子 ▶」跳出來,按下去,學習畫面往左滑走、骰子遊戲從右邊滑進來
// 接著是簡化版的「幸運骰子」遊戲:每次 deskTap 食指移到「擲骰子」按下去,骰子滾一滾停在新點數(3、5、6…),
// 寫 deskTap: "cheer" 的那一次(沒寫就是第 3 次)有小小的慶祝(彩紙、星星飛出來、星星全亮,孩子肩膀跟著一聳)。
// 平板用 CSS 3D(rotateX/Y/Z + 透視)斜放;手的位置用同一組矩陣在 JS 裡投影出來,所以手指一定點在按鈕上。
// 所有動畫都由 render 依 f.st / f.prev / f.kind / f.l / f.ms 算出(SPEC 第 1 節):不用 CSS transition/animation、不用 Math.random。
import { kit } from '../../../../live/kit'
import { T, type ReelFrame, type Target } from './actor'
import './desk.css'

// ---------- 幾何(1080×1920 設計畫布的 px) ----------
/** 平板機身:寬高、邊框、中心點、斜放的角度(度) */
const TAB = { w: 620, h: 440, bezel: 18, cx: 596, cy: 1004, rx: 28, ry: -16, rz: -3, s: 1.12 }
/** 透視:距離與消失點 */
const CAM = { p: 1500, ox: 560, oy: 700 }
/** 骰子遊戲畫面裡(螢幕座標)按鈕與骰子的中心 */
const BTN = { x: 442, y: 262, w: 212, h: 78 }
const DIE = { x: 158, y: 206, s: 132 }
/** 學習畫面裡(螢幕座標):積木盒裡的「1 到 6」、魔法積木的空格、測驗的兩個選項、「換你擲骰子」按鈕 */
const CHIP = { x: 372, y: 273, w: 112, h: 42 }
const SLOT = { x: 488, y: 194, w: 124, h: 50 }
const OPT_YES = { x: 205, y: 366, w: 130, h: 50 }
const OPT_NO = { x: 362, y: 366, w: 150, h: 50 }
const RIGHT = { x: 510, y: 364 }
const PLAY = { x: 360, y: 366, w: 300, h: 54 }

// ---------- 時間表(毫秒,相對動作開始) ----------
/** 點一下(deskTap 按擲骰子、deskLearn 的 answer 與 play 也照這個節奏;T.deskTap = 1500) */
export const TAP = { hover: 430, touch: 560, release: 690, roll: 640, land: 1100, back: 880, rest: 1400 }
/** 拖積木(deskLearn: "drag";T.deskLearn = 1600):按住 → 拖到空格 → 放開 */
export const DRAG = { hover: 420, touch: 540, grab: 640, drop: 1080, release: 1140, back: 1220, rest: 1600 }
/** 按「換你擲骰子」之後畫面往左滑 */
export const SLIDE = { start: 740, dur: 700 }
/** 每一次擲出的點數(第 1、2、3… 次) */
export const DICE = [3, 5, 6, 2, 4, 1] as const
/** 擲完 n 次之後骰子停在幾點;還沒擲過是 1 */
export const dieAfter = (n: number): number => (n <= 0 ? 1 : DICE[(n - 1) % DICE.length])
/** 學習畫面上老師的字幕(依做到哪一步) */
export const SUBS = ['點了擲骰子，就擲出 1 到 6', '1 到 6 叫做範圍', '8 不在 1 到 6 裡面，答對了！'] as const

const rad = (d: number): number => (d * Math.PI) / 180
const R = { cx: Math.cos(rad(TAB.rx)), sx: Math.sin(rad(TAB.rx)), cy: Math.cos(rad(TAB.ry)), sy: Math.sin(rad(TAB.ry)), cz: Math.cos(rad(TAB.rz)), sz: Math.sin(rad(TAB.rz)) }
/**
 * 平板座標(機身左上角為原點,z 朝螢幕外)→ 畫布座標。
 * 跟 CSS 的 `perspective + scale() rotateZ() rotateX() rotateY()` 是同一組計算(最右邊的先作用在點上)。
 */
export function project(x: number, y: number, z = 0): { x: number; y: number; k: number } {
  let px = x - TAB.w / 2
  let py = y - TAB.h / 2
  let pz = z
  // rotateY
  ;[px, pz] = [px * R.cy + pz * R.sy, -px * R.sy + pz * R.cy]
  // rotateX
  ;[py, pz] = [py * R.cx - pz * R.sx, py * R.sx + pz * R.cx]
  // rotateZ
  ;[px, py] = [px * R.cz - py * R.sz, px * R.sz + py * R.cz]
  // scale
  px *= TAB.s
  py *= TAB.s
  pz *= TAB.s
  const X = TAB.cx + px
  const Y = TAB.cy + py
  const k = CAM.p / (CAM.p - pz)
  return { x: CAM.ox + (X - CAM.ox) * k, y: CAM.oy + (Y - CAM.oy) * k, k }
}

// ---------- 姿勢(純函式:同一個 frame 一定得到同一個姿勢) ----------
type Pt = { x: number; y: number }
type Pt3 = { x: number; y: number; z: number }
export interface DeskPose {
  /** 學習畫面要畫到哪一步(0 還沒動、1 積木拖好、2 答對;3 已經在骰子遊戲) */
  learn: number
  /** 「1 到 6」積木從積木盒(0)到空格(1)的位置,與被拿起來的程度 0–1 */
  chip: { p: number; lifted: number }
  /** 這一步的回饋(積木放好、答對、按下按鈕、骰子落地)發生後經過的毫秒;沒有是 null */
  fx: number | null
  /** 「換你擲骰子」按鈕出現的程度 0–1 */
  playBtn: number
  /** 學習畫面(0)→ 骰子遊戲(1)的換頁進度 */
  slide: number
  /** 骰子遊戲畫面上已經擲完幾次(星星、進度條、點數照這個) */
  shown: number
  /** 骰子正在滾的進度 0–1;沒在滾是 null */
  rolling: number | null
  /** 骰子現在朝上的點數 */
  face: number
  /** 這一步裡骰子落地後經過的毫秒;沒有落地是 null */
  sinceLand: number | null
  /** 按下去的程度 0–1 */
  press: number
  /** 漣漪 0–1 與位置(螢幕座標);沒有是 null */
  ripple: { p: number; x: number; y: number } | null
  /** 指尖的位置(平板座標,z 是離螢幕多高) */
  tip: Pt3
  /** 手往前伸的程度 0(放在桌邊)–1(在螢幕上) */
  reach: number
  /** 慶祝彩紙的進度 0–1;沒有是 null */
  confetti: number | null
  /** 孩子興奮聳肩 0–1 */
  excite: number
}

const REST: Pt3 = { x: TAB.w * 0.72, y: TAB.h + 34, z: 40 }
/** 螢幕座標 → 平板座標;指尖點在目標中心偏右下一點,手指才不會整個蓋住字 */
const aimAt = (b: Pt, dx = 18, dy = 8): Pt => ({ x: TAB.bezel + b.x + dx, y: TAB.bezel + b.y + dy })

const E = kit.ease
/** 點一下:桌邊 → 目標上方 → 按下 → 抬起 → 回桌邊 */
function tapPath(l: number, aim: Pt): { tip: Pt3; reach: number; press: number } {
  const P = (s: number, d: number): number => kit.progress(l, s, d)
  const go = E.inOutCubic(P(0, TAP.hover))
  const down = E.inOutQuad(P(TAP.hover, TAP.touch - TAP.hover))
  const up = E.outCubic(P(TAP.release, 200))
  const back = E.inOutCubic(P(TAP.back, TAP.rest - TAP.back))
  const reach = go * (1 - back)
  const zAt = 46 * (1 - down) + 38 * up
  const arc = Math.sin(go * Math.PI) * 34 + Math.sin(back * Math.PI) * 30
  return {
    tip: { x: kit.lerp(REST.x, aim.x + up * 14, reach), y: kit.lerp(REST.y, aim.y + up * 10, reach), z: kit.lerp(REST.z, zAt, reach) + arc },
    reach,
    press: Math.min(E.outCubic(P(TAP.touch, 70)), 1 - E.inOutQuad(P(TAP.release - 40, 90))),
  }
}
/** 拖曳:桌邊 → 按住 from → 貼著螢幕拖到 to → 放開 → 回桌邊;drag 是拖到哪(0–1) */
function dragPath(l: number, from: Pt, to: Pt): { tip: Pt3; reach: number; press: number; drag: number; lifted: number } {
  const P = (s: number, d: number): number => kit.progress(l, s, d)
  const go = E.inOutCubic(P(0, DRAG.hover))
  const down = E.inOutQuad(P(DRAG.hover, DRAG.touch - DRAG.hover))
  const drag = E.inOutCubic(P(DRAG.grab, DRAG.drop - DRAG.grab))
  const up = E.outCubic(P(DRAG.release, 200))
  const back = E.inOutCubic(P(DRAG.back, DRAG.rest - DRAG.back))
  const reach = go * (1 - back)
  const at = { x: kit.lerp(from.x, to.x, drag), y: kit.lerp(from.y, to.y, drag) }
  const zAt = 46 * (1 - down) + 38 * up
  const arc = Math.sin(go * Math.PI) * 34 + Math.sin(back * Math.PI) * 30
  return {
    tip: { x: kit.lerp(REST.x, at.x + up * 14, reach), y: kit.lerp(REST.y, at.y + up * 10, reach), z: kit.lerp(REST.z, zAt, reach) + arc },
    reach,
    press: Math.min(E.outCubic(P(DRAG.touch, 80)), 1 - E.inOutQuad(P(DRAG.release - 40, 90))),
    drag,
    lifted: Math.min(E.outCubic(P(DRAG.touch + 40, 120)), 1 - E.inOutQuad(P(DRAG.drop, 100))),
  }
}

export function poseOf(f: ReelFrame): DeskPose {
  const { st, kind, l } = f
  const taps = st.taps
  const learn = st.learn
  const P = (s: number, d: number): number => kit.progress(l, s, d)
  const idle: DeskPose = {
    learn: Math.min(learn, 2),
    chip: { p: learn >= 1 ? 1 : 0, lifted: 0 },
    fx: null,
    playBtn: learn >= 3 ? 1 : 0,
    slide: learn >= 3 ? 1 : 0,
    shown: taps,
    rolling: null,
    face: dieAfter(taps),
    sinceLand: null,
    press: 0,
    ripple: null,
    tip: { ...REST },
    reach: 0,
    confetti: null,
    excite: 0,
  }
  if (!st.desk) return idle
  const ripple = (b: Pt, at: number): DeskPose['ripple'] => {
    const rp = P(at + 20, 520)
    return l >= at + 20 && rp < 1 ? { p: rp, x: b.x, y: b.y } : null
  }

  if (kind === 'deskLearn' && learn === 1) {
    // 把「1 到 6」從積木盒拖進空格
    const h = dragPath(l, aimAt(CHIP, 22, 6), aimAt(SLOT, 22, 6))
    const placed = l >= DRAG.release - 40
    return { ...idle, learn: placed ? 1 : 0, chip: { p: h.drag, lifted: h.lifted }, fx: placed ? l - (DRAG.release - 40) : null, tip: h.tip, reach: h.reach, press: h.press, ripple: ripple(SLOT, DRAG.release - 60) }
  }
  if (kind === 'deskLearn' && learn === 2) {
    // 測驗:點「不會」
    const h = tapPath(l, aimAt(OPT_NO))
    const answered = l >= TAP.touch
    const excite = 0.45 * Math.min(E.outCubic(P(TAP.touch + 60, 200)), 1 - E.inOutQuad(P(TAP.touch + 300, 260)))
    return { ...idle, learn: answered ? 2 : 1, fx: answered ? l - TAP.touch : null, tip: h.tip, reach: h.reach, press: h.press, ripple: ripple(OPT_NO, TAP.touch), excite }
  }
  if (kind === 'deskLearn' && learn === 3) {
    // 「換你擲骰子」按鈕跳出來,按下去,畫面往左滑到骰子遊戲
    const h = tapPath(l, aimAt(PLAY, 30, 6))
    return {
      ...idle,
      learn: 2,
      playBtn: E.outBack(P(60, 320)),
      slide: E.inOutCubic(P(SLIDE.start, SLIDE.dur)),
      fx: l >= TAP.touch ? l - TAP.touch : null,
      tip: h.tip,
      reach: h.reach,
      press: h.press,
      ripple: ripple(PLAY, TAP.touch),
    }
  }
  if (kind !== 'deskTap' || taps <= 0) return idle

  // 骰子遊戲:按「擲骰子」
  const landed = l >= TAP.land
  const shown = landed ? taps : taps - 1
  const rolling = l >= TAP.roll && !landed ? P(TAP.roll, TAP.land - TAP.roll) : null
  let face = dieAfter(shown)
  if (rolling !== null) {
    // 一開始翻得快、快停時翻得慢:換面的間隔越來越長
    const tt = l - TAP.roll
    const idx = Math.floor(tt / (55 + tt * 0.14))
    const r = kit.rand(taps * 977 + idx * 31 + 5)
    face = 1 + Math.floor(r() * 6)
    if (face === dieAfter(taps) && rolling > 0.7) face = (face % 6) + 1
  }
  const h = tapPath(l, aimAt(BTN))
  const cheerTap = st.cheerAt === taps
  const cheer = cheerTap && landed
  const excite = cheerTap ?Math.min(E.outCubic(P(TAP.land - 20, 200)), 1 - E.inOutQuad(P(TAP.land + 200, 200))) : 0
  return {
    ...idle,
    shown,
    rolling,
    face,
    sinceLand: landed ? l - TAP.land : null,
    fx: landed ? l - TAP.land : null,
    tip: h.tip,
    reach: h.reach,
    press: h.press,
    ripple: ripple(BTN, TAP.touch),
    confetti: cheer ? P(TAP.land, 400) : null,
    excite,
  }
}

// ---------- 靜態圖形 ----------
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}
const dieFace = (v: number): string => (PIPS[v] ?? PIPS[1]).map(([c, r]) => `<i style="left:${25 + c * 25}%;top:${25 + r * 25}%"></i>`).join('')

const fx = (n: number): string => n.toFixed(1)
const pts = (a: { x: number; y: number }[]): string => a.map((p) => `${fx(p.x)},${fx(p.y)}`).join(' ')

/** 背景的房間(會整片模糊):牆、窗、窗簾、小孩的畫、書櫃、檯燈 */
function roomSvg(): string {
  const r = kit.rand(20261111)
  const palette = ['#c8553d', '#e0a458', '#5b8e7d', '#3d5a80', '#9a6fb0', '#e9d8a6', '#7a9e9f', '#b5838d', '#6d597a', '#f2cc8f']
  let books = ''
  for (const base of [262, 446, 630, 812]) {
    let x = 716
    while (x < 1090) {
      const w = 16 + r() * 22
      const h = 96 + r() * 62
      const c = palette[Math.floor(r() * palette.length)]
      const lean = r() < 0.12 ? (r() < 0.5 ? -8 : 8) : 0
      books += `<rect x="${fx(x)}" y="${fx(base - h)}" width="${fx(w)}" height="${fx(h)}" rx="2" fill="${c}" transform="rotate(${lean} ${fx(x + w / 2)} ${base})"/>`
      books += `<rect x="${fx(x + 3)}" y="${fx(base - h + 14)}" width="${fx(w - 6)}" height="4" fill="rgba(255,255,255,.35)"/>`
      x += w + (r() < 0.15 ? 14 + r() * 26 : 1.5)
    }
  }
  return (
    `<svg class="kr-d-roomsvg" viewBox="0 0 1080 900" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="krd-wall" x1="0" x2="1"><stop offset="0" stop-color="#efd6b4"/><stop offset=".42" stop-color="#d4b08b"/><stop offset="1" stop-color="#8f6d52"/></linearGradient>` +
    `<linearGradient id="krd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset=".55" stop-color="#fff1d6"/><stop offset="1" stop-color="#f6dcb2"/></linearGradient>` +
    `<radialGradient id="krd-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6dc" stop-opacity=".95"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="krd-lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd18a" stop-opacity=".9"/><stop offset="1" stop-color="#ffb760" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="krd-curtain" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".25" stop-color="#f4e6d0" stop-opacity=".5"/><stop offset=".5" stop-color="#fff" stop-opacity=".8"/><stop offset=".75" stop-color="#ead8bd" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity=".7"/></linearGradient>` +
    `</defs>` +
    `<rect width="1080" height="900" fill="url(#krd-wall)"/>` +
    // 窗戶
    `<rect x="18" y="70" width="350" height="640" rx="6" fill="#f6ead8"/>` +
    `<rect x="36" y="88" width="314" height="604" fill="url(#krd-sky)"/>` +
    `<ellipse cx="120" cy="600" rx="150" ry="110" fill="#a9c08c" opacity=".55"/><ellipse cx="290" cy="640" rx="120" ry="80" fill="#93b07a" opacity=".5"/>` +
    `<ellipse cx="200" cy="300" rx="300" ry="300" fill="url(#krd-glow)"/>` +
    `<rect x="186" y="88" width="14" height="604" fill="#f3e3cc"/><rect x="36" y="380" width="314" height="14" fill="#f3e3cc"/>` +
    `<rect x="0" y="704" width="400" height="22" rx="4" fill="#f1dfc4"/>` +
    // 窗台上的盆栽
    `<path d="M282 704 L292 650 L346 650 L356 704 Z" fill="#c4704f"/>` +
    `<g fill="#5f8f4e"><ellipse cx="300" cy="610" rx="16" ry="44" transform="rotate(-28 300 640)"/><ellipse cx="322" cy="596" rx="16" ry="54"/><ellipse cx="346" cy="612" rx="15" ry="44" transform="rotate(30 346 640)"/><ellipse cx="312" cy="580" rx="12" ry="36" transform="rotate(-10 312 610)" fill="#78a862"/></g>` +
    // 窗簾
    `<path d="M-40 40 L96 40 C88 260 112 480 84 760 L-40 760 Z" fill="url(#krd-curtain)"/>` +
    `<path d="M330 40 L430 40 C440 280 412 520 436 760 L346 760 C364 520 336 300 330 40 Z" fill="url(#krd-curtain)" opacity=".85"/>` +
    `<rect x="-20" y="30" width="480" height="14" rx="7" fill="#b9946f"/>` +
    // 牆上的畫(孩子畫的太陽)
    `<g transform="rotate(-3 540 280)"><rect x="456" y="170" width="170" height="210" fill="#fffaf0"/><circle cx="541" cy="250" r="34" fill="#f6b73c"/>` +
    `<g stroke="#f6b73c" stroke-width="7" stroke-linecap="round"><path d="M541 196v-14M541 304v14M487 250h-14M595 250h14M503 212l-10-10M579 288l10 10M579 212l10-10M503 288l-10 10"/></g>` +
    `<path d="M470 360 q35 -30 70 0 t70 0" stroke="#5ba36b" stroke-width="8" fill="none"/><circle cx="541" cy="168" r="6" fill="#d9534f"/></g>` +
    // 書櫃
    `<rect x="700" y="70" width="420" height="760" fill="#5d3f2b"/><rect x="712" y="82" width="400" height="736" fill="#3f2a1d"/>` +
    books +
    `<g fill="#7a5439">${[262, 446, 630, 812].map((y) => `<rect x="704" y="${y}" width="420" height="14"/>`).join('')}</g>` +
    `<circle cx="1020" cy="408" r="30" fill="#5aa0c8"/><path d="M996 396 q24 10 48 -4 M1000 420 q20 -8 40 4" stroke="#7cc08a" stroke-width="8" fill="none"/>` +
    // 檯燈(亮著)
    `<ellipse cx="520" cy="470" rx="240" ry="200" fill="url(#krd-lamp)"/>` +
    `<path d="M560 720 L548 560 L470 470" stroke="#2f3238" stroke-width="12" fill="none" stroke-linecap="round"/>` +
    `<path d="M420 440 L520 420 L540 500 L432 520 Z" fill="#2c3036"/><ellipse cx="486" cy="512" rx="56" ry="14" fill="#ffd796" transform="rotate(-10 486 512)"/>` +
    `<ellipse cx="560" cy="724" rx="54" ry="12" fill="#2a2d33"/>` +
    // 牆腳的陰影
    `<rect x="0" y="780" width="1080" height="120" fill="#3a2618" opacity=".35"/>` +
    `</svg>`
  )
}

/** 桌面:木紋、窗光照在桌上的那塊亮、平板的影子與皮套、筆記本與蠟筆 */
function deskSvg(): string {
  const r = kit.rand(7311)
  const top = 760
  let grain = ''
  for (let i = 0; i < 46; i++) {
    const t = i / 46
    const y = top + Math.pow(t, 1.7) * (1920 - top)
    const a = 6 + t * 20
    const ph = r() * 600
    const op = (0.05 + r() * 0.12) * (0.4 + t * 0.6)
    const sw = 1 + t * 3 * r()
    grain += `<path d="M-100 ${fx(y)} C ${fx(200 + ph)} ${fx(y - a)}, ${fx(500 + ph)} ${fx(y + a)}, 1180 ${fx(y + (r() - 0.5) * a)}" stroke="${r() < 0.5 ? '#5a3418' : '#d9a271'}" stroke-width="${fx(sw)}" fill="none" opacity="${op.toFixed(3)}"/>`
  }
  // 木板的接縫
  const seams = [930, 1230, 1660].map((y) => `<path d="M-100 ${y} L1180 ${y + 6}" stroke="#4a2a14" stroke-width="${y > 1500 ? 4 : 2.5}" opacity=".35"/>`).join('')
  // 平板的影子:窗光從左後方來,影子落在右前方的桌上
  const bl = project(0, TAB.h)
  const br = project(TAB.w, TAB.h)
  const tl = project(0, 0)
  const tr = project(TAB.w, 0)
  const sh = (p: { x: number; y: number }, dx: number, dy: number) => ({ x: p.x + dx, y: p.y + dy })
  const shadow = pts([bl, br, sh(br, 140, 40), sh(tr, 230, 200), sh(tl, 150, 230)])
  const contact = pts([sh(bl, -6, -4), sh(br, 8, -6), sh(br, 10, 14), sh(bl, -8, 16)])
  // 皮套:平板底下折起來那一截
  const caseFold = pts([sh(bl, -4, 2), sh(br, 6, 0), sh(br, 18, 26), sh(bl, -14, 30)])
  return (
    `<svg class="kr-d-desksvg" viewBox="0 0 1080 1920" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="krd-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e4428"/><stop offset=".08" stop-color="#8d5a35"/><stop offset=".45" stop-color="#b07a4b"/><stop offset="1" stop-color="#8a5634"/></linearGradient>` +
    `<linearGradient id="krd-pool" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2cf" stop-opacity=".55"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></linearGradient>` +
    `<filter id="krd-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>` +
    `<filter id="krd-soft2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>` +
    `<filter id="krd-soft3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="40"/></filter>` +
    `</defs>` +
    `<rect x="-100" y="${top}" width="1280" height="${1920 - top}" fill="url(#krd-wood)"/>` +
    grain +
    seams +
    `<rect x="-100" y="${top}" width="1280" height="10" fill="#e4b688" opacity=".45"/>` +
    // 窗光落在桌上
    `<path d="M-60 780 L420 780 L760 1240 L40 1420 Z" fill="url(#krd-pool)" filter="url(#krd-soft3)"/>` +
    // 遠處的杯子、鉛筆筒的影子
    `<ellipse cx="930" cy="868" rx="90" ry="16" fill="#2a160a" opacity=".35" filter="url(#krd-soft2)"/>` +
    `<polygon points="${shadow}" fill="#2a1609" opacity=".42" filter="url(#krd-soft)"/>` +
    `<polygon points="${caseFold}" fill="#2b3a4a"/>` +
    `<polygon points="${contact}" fill="#1a0e06" opacity=".7" filter="url(#krd-soft2)"/>` +
    // 筆記本與蠟筆(在平板右前方)
    `<g transform="translate(0 0)">` +
    `<polygon points="784,1236 1008,1212 1066,1392 806,1424" fill="#1d120a" opacity=".25" filter="url(#krd-soft2)"/>` +
    `<polygon points="772,1218 996,1196 1048,1370 790,1400" fill="#fdf8ee"/>` +
    `<polygon points="772,1218 884,1207 906,1386 790,1400" fill="#f4ecdc"/>` +
    `<g stroke="#9fc3dd" stroke-width="2" opacity=".8">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${fx(902 + i * 0.6)} ${fx(1230 + i * 26)} L${fx(1000 + i * 8)} ${fx(1220 + i * 25)}"/>`).join('')}</g>` +
    `<path d="M800 1250 q30 -14 60 4 q20 30 -14 46 q-40 8 -46 -20" stroke="#e76f51" stroke-width="4" fill="none" opacity=".8"/>` +
    `<path d="M812 1340 l30 -40 l26 34 l20 -22 l12 20" stroke="#2a9d8f" stroke-width="4" fill="none" opacity=".8"/>` +
    `<g fill="#9a8f80">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${fx(884 + i * 3.2)}" cy="${fx(1222 + i * 26)}" r="4"/>`).join('')}</g>` +
    `</g>` +
    `<g><rect x="0" y="0" width="120" height="16" rx="8" fill="#e63946" transform="translate(690 1446) rotate(-14)"/><rect x="0" y="0" width="20" height="16" rx="3" fill="#a4161a" transform="translate(690 1446) rotate(-14)"/></g>` +
    `<g><rect x="0" y="0" width="112" height="15" rx="7" fill="#ffb703" transform="translate(722 1484) rotate(8)"/><rect x="92" y="0" width="20" height="15" rx="3" fill="#fb8500" transform="translate(722 1484) rotate(8)"/></g>` +
    `</svg>`
  )
}

/** 遠一點的桌上小東西(輕微模糊):牛奶杯、鉛筆筒 */
function farSvg(): string {
  return (
    `<svg class="kr-d-farsvg" viewBox="0 0 1080 1920" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="krd-glass" x1="0" x2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".2" stop-color="#ffffff" stop-opacity=".15"/><stop offset=".8" stop-color="#ffffff" stop-opacity=".1"/><stop offset="1" stop-color="#ffffff" stop-opacity=".45"/></linearGradient>` +
    `<linearGradient id="krd-milk" x1="0" x2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset=".6" stop-color="#f1ebe0"/><stop offset="1" stop-color="#d9cfc0"/></linearGradient>` +
    `<linearGradient id="krd-cup" x1="0" x2="1"><stop offset="0" stop-color="#7fb7be"/><stop offset=".5" stop-color="#5e9aa3"/><stop offset="1" stop-color="#3f7179"/></linearGradient>` +
    `</defs>` +
    // 鉛筆筒
    `<g><rect x="836" y="686" width="12" height="120" rx="3" fill="#f4a261" transform="rotate(-12 842 800)"/><rect x="860" y="666" width="12" height="140" rx="3" fill="#2a9d8f" transform="rotate(4 866 800)"/>` +
    `<rect x="882" y="690" width="12" height="120" rx="3" fill="#e9c46a" transform="rotate(14 888 800)"/><path d="M842 682 l6 -18 l6 18Z" fill="#3b2a20" transform="rotate(-12 842 800)"/>` +
    `<path d="M830 740 L912 740 L906 852 Q871 862 836 852 Z" fill="url(#krd-cup)"/><ellipse cx="871" cy="740" rx="41" ry="9" fill="#9ccbd1"/></g>` +
    // 牛奶杯
    `<g><path d="M944 760 L1030 760 L1022 900 Q987 912 952 900 Z" fill="url(#krd-milk)"/>` +
    `<path d="M940 712 L1034 712 L1022 900 Q987 912 952 900 Z" fill="url(#krd-glass)" stroke="rgba(255,255,255,.6)" stroke-width="2"/>` +
    `<ellipse cx="987" cy="760" rx="43" ry="8" fill="#fffef9"/><ellipse cx="987" cy="712" rx="47" ry="9" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2.5"/>` +
    `<rect x="952" y="720" width="8" height="170" rx="4" fill="#fff" opacity=".55"/></g>` +
    `</svg>`
  )
}

/** 孩子(前景,淺景深):帽 T 的背、帽子、脖子、後腦勺的頭髮、右耳 */
function kidSvg(): string {
  return (
    `<svg class="kr-d-kidsvg" viewBox="0 0 1080 1920" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="krd-hoodie" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fb0bd"/><stop offset=".35" stop-color="#4f8494"/><stop offset="1" stop-color="#29505c"/></linearGradient>` +
    `<linearGradient id="krd-hood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fc0cc"/><stop offset=".55" stop-color="#4a7d8c"/><stop offset="1" stop-color="#2b5260"/></linearGradient>` +
    `<radialGradient id="krd-hair" cx=".32" cy=".3" r=".8"><stop offset="0" stop-color="#6b4a33"/><stop offset=".55" stop-color="#3d2a1e"/><stop offset="1" stop-color="#1e140e"/></radialGradient>` +
    `<linearGradient id="krd-skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6cfb2"/><stop offset=".6" stop-color="#e3a587"/><stop offset="1" stop-color="#b9765e"/></linearGradient>` +
    `<linearGradient id="krd-rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd9a3" stop-opacity=".9"/><stop offset="1" stop-color="#ffd9a3" stop-opacity="0"/></linearGradient>` +
    `</defs>` +
    `<g class="kr-d-body">` +
    `<path d="M-90 1920 L-90 1300 C-50 1236 60 1196 190 1188 C 320 1180 440 1206 540 1262 C 640 1318 716 1404 770 1520 C 812 1620 836 1760 846 1920 Z" fill="url(#krd-hoodie)"/>` +
    // 肩膀上的光(左邊窗光)
    `<path d="M-90 1300 C-50 1236 60 1196 190 1188 C 120 1210 20 1250 -40 1320 Z" fill="#ffe2b8" opacity=".35"/>` +
    // 肩線與皺褶
    `<path d="M560 1290 C 600 1360 610 1460 600 1600" stroke="#24434d" stroke-width="5" fill="none" opacity=".45"/>` +
    `<path d="M180 1420 C 260 1460 360 1470 440 1440" stroke="#24434d" stroke-width="10" fill="none" opacity=".18" stroke-linecap="round"/>` +
    `<path d="M120 1600 C 220 1640 330 1650 420 1620" stroke="#24434d" stroke-width="14" fill="none" opacity=".14" stroke-linecap="round"/>` +
    // 帽子堆在後頸
    `<path d="M96 1196 C 120 1128 262 1104 396 1146 C 460 1168 494 1222 470 1268 C 420 1316 254 1318 150 1284 C 104 1266 86 1232 96 1196 Z" fill="url(#krd-hood)"/>` +
    `<path d="M140 1218 C 200 1180 320 1176 420 1214" stroke="#21414b" stroke-width="12" fill="none" opacity=".35" stroke-linecap="round"/>` +
    `<path d="M130 1258 C 220 1290 340 1292 440 1262" stroke="#9fd0db" stroke-width="5" fill="none" opacity=".35" stroke-linecap="round"/>` +
    `</g>` +
    `<g class="kr-d-head">` +
    // 脖子與耳朵
    `<linearGradient id="krd-neck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5340"/><stop offset=".35" stop-color="#c98a6c"/><stop offset="1" stop-color="#b07258"/></linearGradient>` +
    `<path d="M196 1070 C 236 1092 300 1090 334 1066 C 340 1110 344 1150 346 1182 C 300 1198 240 1202 204 1194 C 202 1150 200 1110 196 1070 Z" fill="url(#krd-neck)"/>` +
    `<path d="M232 1110 C 236 1140 240 1166 242 1190" stroke="#9b604a" stroke-width="6" fill="none" opacity=".35" stroke-linecap="round"/>` +
    // 右邊臉頰的一點點輪廓
    `<path d="M330 900 C 360 940 372 1010 360 1066 C 352 1092 334 1104 318 1100 Z" fill="url(#krd-skin)"/>` +
    `<g transform="rotate(8 330 990)"><path d="M316 930 C 352 922 372 950 370 990 C 368 1030 352 1054 330 1060 C 316 1062 306 1050 308 1034 Z" fill="url(#krd-skin)"/>` +
    `<path d="M330 950 C 352 950 360 976 356 1004 C 352 1026 342 1036 330 1040" stroke="#b9715a" stroke-width="5" fill="none" opacity=".8" stroke-linecap="round"/>` +
    `<path d="M340 966 C 346 984 344 1004 336 1016" stroke="#c97f66" stroke-width="4" fill="none" opacity=".7" stroke-linecap="round"/>` +
    `<path d="M356 954 C 368 976 368 1010 356 1036" stroke="#ff9a7a" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/></g>` +
    // 後腦勺的頭髮(下緣是一撮撮髮尾)
    `<path d="M-110 980 C -110 820 0 700 130 690 C 260 680 360 760 372 880 C 380 930 360 960 340 952 C 332 992 330 1036 316 1066 Q 306 1092 296 1080 Q 286 1106 268 1094 Q 254 1124 236 1100 Q 220 1114 204 1098 Q 184 1128 166 1102 Q 146 1118 130 1100 Q 112 1126 96 1096 Q 80 1108 64 1094 C 0 1100 -110 1080 -110 980 Z" fill="url(#krd-hair)"/>` +
    `<g stroke="#8a6447" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round">` +
    `<path d="M40 760 C 120 740 220 760 290 830"/><path d="M10 820 C 110 800 230 830 320 910"/><path d="M60 900 C 150 900 240 940 300 1020"/><path d="M-40 900 C 40 920 120 980 170 1080"/><path d="M180 720 C 240 740 300 790 340 860"/></g>` +
    `<g stroke="#2a1b12" stroke-width="5" fill="none" opacity=".35" stroke-linecap="round"><path d="M100 980 C 160 1000 220 1040 250 1100"/><path d="M200 900 C 250 930 290 980 300 1050"/></g>` +
    // 窗光打在頭髮左上緣的輪廓光
    `<path d="M-110 980 C -110 820 0 700 130 690 C 200 686 260 704 300 738 C 240 716 150 712 70 744 C -20 784 -80 880 -86 990 Z" fill="url(#krd-rim)" opacity=".55"/>` +
    `</g>` +
    `</svg>`
  )
}

/** 手(指尖在原點、往上指;手腕在下方)與袖子 */
const HAND_WRIST = { x: 52, y: 170 }
function armSvg(): string {
  return (
    `<svg class="kr-d-armsvg" viewBox="0 0 1080 1920" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="krd-hand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8d6bc"/><stop offset=".55" stop-color="#e6a98b"/><stop offset="1" stop-color="#c07b62"/></linearGradient>` +
    `<linearGradient id="krd-finger" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbdcc4"/><stop offset=".6" stop-color="#eab093"/><stop offset="1" stop-color="#c98468"/></linearGradient>` +
    `<linearGradient id="krd-sleeve" gradientUnits="userSpaceOnUse" x1="560" y1="1200" x2="1000" y2="1500"><stop offset="0" stop-color="#76aab8"/><stop offset=".5" stop-color="#4a7f8f"/><stop offset="1" stop-color="#264954"/></linearGradient>` +
    `<radialGradient id="krd-screenlight" cx=".3" cy=".1" r=".6"><stop offset="0" stop-color="#dff1ff" stop-opacity=".55"/><stop offset="1" stop-color="#dff1ff" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<g class="kr-d-hand">` +
    // 拇指(收在左下)
    `<path d="M10 104 C -6 100 -18 90 -20 78 C -22 68 -13 63 -6 68 C 2 74 8 84 18 90 Z" fill="url(#krd-hand)"/>` +
    // 手背
    `<path d="M4 80 C 2 66 22 58 42 60 C 66 60 88 70 96 90 C 104 112 100 142 90 166 L 26 174 C 14 154 6 122 4 98 Z" fill="url(#krd-hand)"/>` +
    // 收起來的三根手指(彎在前面,只看得到指背)
    `<path d="M26 66 C 44 54 76 58 94 76 C 104 88 104 102 96 108 C 84 100 62 90 40 86 C 30 84 24 74 26 66 Z" fill="#dd9d80"/>` +
    `<path d="M50 62 C 56 70 60 80 62 92 M74 68 C 80 76 84 86 86 98" stroke="#b9715a" stroke-width="2.2" fill="none" opacity=".55" stroke-linecap="round"/>` +
    `<path d="M32 64 C 48 56 72 58 88 70" stroke="#fbe1cd" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>` +
    // 手背的骨線與窗光
    `<path d="M30 92 L 40 150 M52 92 L 58 152 M72 100 L 74 150" stroke="#c98468" stroke-width="2" opacity=".35"/>` +
    `<path d="M6 84 C 4 110 10 140 22 168" stroke="#ffe7cf" stroke-width="5" fill="none" opacity=".55" stroke-linecap="round"/>` +
    // 食指(按下去時會被壓短一點)
    `<g class="kr-d-index">` +
    `<path d="M4 74 C 0 52 -8 28 -9 12 C -10 1 -4 -6 4 -5 C 11 -4 13 2 13 9 C 15 28 22 52 30 72 Z" fill="url(#krd-finger)"/>` +
    `<path d="M2 38 q7 -3 13 1" stroke="#c98468" stroke-width="2" fill="none" opacity=".6"/>` +
    `<ellipse cx="3" cy="6" rx="6.5" ry="8.5" fill="#f7d3c4" transform="rotate(-6 3 6)"/>` +
    `<ellipse cx="1.5" cy="4" rx="2.6" ry="4" fill="#fff" opacity=".7" transform="rotate(-6 1.5 4)"/>` +
    `</g>` +
    // 螢幕的冷光打在手指上
    `<path d="M-10 0 C 10 -10 40 20 60 70 L 0 80 Z" fill="url(#krd-screenlight)"/>` +
    `</g>` +
    `<path class="kr-d-upper" fill="url(#krd-sleeve)"/>` +
    `<circle class="kr-d-elbow" r="80" fill="url(#krd-sleeve)"/>` +
    `<path class="kr-d-sleeve" fill="url(#krd-sleeve)"/>` +
    `<path class="kr-d-fold" fill="none" stroke="#24434d" stroke-width="7" opacity=".35" stroke-linecap="round"/>` +
    `<path class="kr-d-cuff" fill="#3f7381"/>` +
    `<path class="kr-d-sleevelight" fill="none" stroke="#ffe2b8" stroke-width="6" opacity=".3" stroke-linecap="round"/>` +
    `</svg>`
  )
}

const CONFETTI_N = 26
const SPARK_N = 9
const DUST_N = 44
const BOKEH_N = 7

export function mountDesk(root: HTMLElement): { render(f: ReelFrame): void; target(name: Target): HTMLElement | null } {
  const rr = kit.rand(4242)
  const confetti = Array.from({ length: CONFETTI_N }, () => ({
    vx: (rr() - 0.5) * 900,
    vy: -380 - rr() * 620,
    rot: (rr() - 0.5) * 1440,
    c: ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f1c'][Math.floor(rr() * 6)],
    w: 8 + rr() * 8,
    h: 12 + rr() * 10,
  }))
  const sparks = Array.from({ length: SPARK_N }, (_, i) => ({ ang: -150 + (i / (SPARK_N - 1)) * 120 + (rr() - 0.5) * 14, dist: 180 + rr() * 160, s: 22 + rr() * 22, d: rr() * 120 }))
  const dust = Array.from({ length: DUST_N }, (_, i) => {
    // 沿著光束分布:從窗戶往右下
    const t = rr()
    return { x: 80 + t * 760 + (rr() - 0.5) * 260, y: 300 + t * 760 + (rr() - 0.5) * 280, s: 2 + rr() * 5, seed: 100 + i * 13, sp: 0.6 + rr() * 0.8 }
  })
  const bokeh = Array.from({ length: BOKEH_N }, (_, i) => ({ x: 40 + rr() * 380, y: 120 + rr() * 520, s: 40 + rr() * 70, seed: 900 + i * 7 }))

  root.innerHTML =
    `<div class="kr-desk">` +
    `<div class="kr-d-cam">` +
    `<div class="kr-d-room">${roomSvg()}<div class="kr-d-bokeh">${bokeh.map((b) => `<i style="left:${fx(b.x)}px;top:${fx(b.y)}px;width:${fx(b.s)}px;height:${fx(b.s)}px"></i>`).join('')}</div></div>` +
    `<div class="kr-d-surface">${deskSvg()}</div>` +
    `<div class="kr-d-far">${farSvg()}</div>` +
    `<div class="kr-d-persp"><div class="kr-d-tablet"><div class="kr-d-edge"></div><div class="kr-d-cambump"></div>` +
    `<div class="kr-d-screen">` +
    // 學習畫面:課程播放列、老師字幕、魔法積木、積木盒、小測驗
    `<div class="kr-d-page kr-d-learn">` +
    `<div class="kr-d-lhead"><b class="kr-d-ltitle">3.5 擲骰子</b><div class="kr-d-dots">${[0, 1, 2, 3, 4].map(() => '<i></i>').join('')}</div><span class="kr-d-teacher">🧑‍🏫</span></div>` +
    `<div class="kr-d-sub"><span class="kr-d-subtext"></span></div>` +
    `<div class="kr-d-magic"><span class="kr-d-mtag">魔法積木</span>` +
    `<span class="kr-d-when">點了<em>擲骰子</em></span><span class="kr-d-arrow">→</span><span class="kr-d-do">擲出</span></div>` +
    `<div class="kr-d-slot"></div>` +
    `<div class="kr-d-tray"><span class="kr-d-traytag">積木盒</span><span class="kr-d-chip kr-d-decoy">1 到 100</span></div>` +
    `<div class="kr-d-ghost"></div>` +
    `<div class="kr-d-chip kr-d-range">1 到 6</div>` +
    `<div class="kr-d-quiz"><b>1 到 6 的骰子，會擲出 8 嗎？</b></div>` +
    `<div class="kr-d-opt kr-d-yes">會</div><div class="kr-d-opt kr-d-no"><span class="kr-d-check">✓</span>不會</div>` +
    `<div class="kr-d-right">答對了！</div>` +
    `<div class="kr-d-play">換你擲骰子 ▶</div>` +
    `</div>` +
    // 骰子遊戲
    `<div class="kr-d-page kr-d-app">` +
    `<div class="kr-d-ghead"><span class="kr-d-lesson">換你玩</span><b class="kr-d-title">幸運骰子 🎲</b><div class="kr-d-stars"><i></i><i></i><i></i></div></div>` +
    `<div class="kr-d-card"></div>` +
    `<div class="kr-d-dshadow"></div><div class="kr-d-die"></div>` +
    `<div class="kr-d-msg"></div>` +
    `<div class="kr-d-btn"><span>擲骰子</span></div>` +
    `<div class="kr-d-foot"><span class="kr-d-count"></span><div class="kr-d-bar"><i></i></div></div>` +
    `<div class="kr-d-confetti">${confetti.map((c) => `<i style="width:${fx(c.w)}px;height:${fx(c.h)}px;background:${c.c}"></i>`).join('')}</div>` +
    `<div class="kr-d-yay">太棒了！</div>` +
    `</div>` +
    `<div class="kr-d-ripple"></div>` +
    `<div class="kr-d-fshadow"></div>` +
    `<div class="kr-d-glare"></div>` +
    `</div></div></div>` +
    `<div class="kr-d-sparks">${sparks.map(() => `<i></i>`).join('')}</div>` +
    `<div class="kr-d-kid">${kidSvg()}</div>` +
    `<div class="kr-d-arm">${armSvg()}</div>` +
    `<div class="kr-d-rays"><i></i><i></i><i></i><i></i></div>` +
    `<div class="kr-d-dust">${dust.map((d) => `<i style="width:${fx(d.s)}px;height:${fx(d.s)}px"></i>`).join('')}</div>` +
    `</div>` +
    `<div class="kr-d-grade"></div><div class="kr-d-vignette"></div><div class="kr-d-grain"></div>` +
    `</div>`

  const $ = <E extends Element = HTMLElement>(s: string): E => root.querySelector<E>(s)!
  const desk = $('.kr-desk')
  const cam = $('.kr-d-cam')
  const room = $('.kr-d-room')
  const far = $('.kr-d-far')
  const persp = $('.kr-d-persp')
  const tablet = $('.kr-d-tablet')
  const kid = $('.kr-d-kid')
  const body = $<SVGGElement>('.kr-d-body')
  const head = $<SVGGElement>('.kr-d-head')
  const arm = $('.kr-d-arm')
  const hand = $<SVGGElement>('.kr-d-hand')
  const index = $<SVGGElement>('.kr-d-index')
  const sleeve = $<SVGPathElement>('.kr-d-sleeve')
  const upper = $<SVGPathElement>('.kr-d-upper')
  const elbowEl = $<SVGCircleElement>('.kr-d-elbow')
  const fold = $<SVGPathElement>('.kr-d-fold')
  const cuff = $<SVGPathElement>('.kr-d-cuff')
  const sleeveLight = $<SVGPathElement>('.kr-d-sleevelight')
  const die = $('.kr-d-die')
  const dshadow = $('.kr-d-dshadow')
  const msg = $('.kr-d-msg')
  const btn = $('.kr-d-btn')
  const ripple = $('.kr-d-ripple')
  const stars = [...root.querySelectorAll<HTMLElement>('.kr-d-stars i')]
  const count = $('.kr-d-count')
  const bar = $('.kr-d-bar i')
  const confEls = [...root.querySelectorAll<HTMLElement>('.kr-d-confetti i')]
  const yay = $('.kr-d-yay')
  const fshadow = $('.kr-d-fshadow')
  const sparkEls = [...root.querySelectorAll<HTMLElement>('.kr-d-sparks i')]
  const rays = [...root.querySelectorAll<HTMLElement>('.kr-d-rays i')]
  const dustEls = [...root.querySelectorAll<HTMLElement>('.kr-d-dust i')]
  const bokehEls = [...root.querySelectorAll<HTMLElement>('.kr-d-bokeh i')]
  const grain = $('.kr-d-grain')
  const learnPage = $('.kr-d-learn')
  const gamePage = $('.kr-d-app')
  const dots = [...root.querySelectorAll<HTMLElement>('.kr-d-dots i')]
  const subtext = $('.kr-d-subtext')
  const slot = $('.kr-d-slot')
  const ghost = $('.kr-d-ghost')
  const chip = $('.kr-d-range')
  const optYes = $('.kr-d-yes')
  const optNo = $('.kr-d-no')
  const check = $('.kr-d-check')
  const right = $('.kr-d-right')
  const play = $('.kr-d-play')
  const box = (el: HTMLElement, b: { x: number; y: number; w: number; h: number }): void =>
    kit.css(el, { left: `${b.x - b.w / 2}px`, top: `${b.y - b.h / 2}px`, width: `${b.w}px`, height: `${b.h}px` })
  box(slot, SLOT)
  box(ghost, CHIP)
  box(chip, CHIP)
  box(optYes, OPT_YES)
  box(optNo, OPT_NO)
  box(play, PLAY)
  kit.css(right, { left: `${RIGHT.x}px`, top: `${RIGHT.y}px` })

  // 平板:位置與斜放的角度(跟 project 同一組數字)
  kit.css(tablet, {
    left: `${TAB.cx - TAB.w / 2}px`,
    top: `${TAB.cy - TAB.h / 2}px`,
    width: `${TAB.w}px`,
    height: `${TAB.h}px`,
    transform: `scale(${TAB.s}) rotateZ(${TAB.rz}deg) rotateX(${TAB.rx}deg) rotateY(${TAB.ry}deg)`,
  })
  kit.css(persp, { perspective: `${CAM.p}px`, perspectiveOrigin: `${CAM.ox}px ${CAM.oy}px` })
  kit.css(btn, { left: `${BTN.x - BTN.w / 2}px`, top: `${BTN.y - BTN.h / 2}px`, width: `${BTN.w}px`, height: `${BTN.h}px` })
  kit.css(die, { left: `${DIE.x - DIE.s / 2}px`, top: `${DIE.y - DIE.s / 2}px`, width: `${DIE.s}px`, height: `${DIE.s}px` })

  /** SVG 屬性:值變了才寫入 */
  const attrs = new WeakMap<Element, Record<string, string>>()
  const attr = (el: Element, name: string, v: string): void => {
    const m = attrs.get(el) ?? {}
    if (m[name] === v) return
    m[name] = v
    attrs.set(el, m)
    el.setAttribute(name, v)
  }
  /** 手的變換:指尖在 tip、旋轉 rot 度、縮放 s;回傳手腕的位置 */
  const handAt = (tip: Pt, rot: number, s: number): Pt => {
    const c = Math.cos(rad(rot))
    const sn = Math.sin(rad(rot))
    return { x: tip.x + (HAND_WRIST.x * c - HAND_WRIST.y * sn) * s, y: tip.y + (HAND_WRIST.x * sn + HAND_WRIST.y * c) * s }
  }
  /** 袖子:從肩膀 a 到手腕 b 的一條漸細的管子(中間的手肘往外彎) */
  const tube = (a: Pt, b: Pt, ctl: Pt, wa: number, wb: number, t0 = 0, t1 = 1): string => {
    const N = 18
    const L: Pt[] = []
    const Rr: Pt[] = []
    for (let i = 0; i <= N; i++) {
      const t = kit.lerp(t0, t1, i / N)
      const mt = 1 - t
      const p = { x: mt * mt * a.x + 2 * mt * t * ctl.x + t * t * b.x, y: mt * mt * a.y + 2 * mt * t * ctl.y + t * t * b.y }
      const d = { x: 2 * mt * (ctl.x - a.x) + 2 * t * (b.x - ctl.x), y: 2 * mt * (ctl.y - a.y) + 2 * t * (b.y - ctl.y) }
      const len = Math.hypot(d.x, d.y) || 1
      const n = { x: -d.y / len, y: d.x / len }
      const w = kit.lerp(wa, wb, t) / 2
      L.push({ x: p.x + n.x * w, y: p.y + n.y * w })
      Rr.push({ x: p.x - n.x * w, y: p.y - n.y * w })
    }
    const all = [...L, ...Rr.reverse()]
    return 'M' + all.map((p) => `${fx(p.x)} ${fx(p.y)}`).join(' L') + ' Z'
  }

  return {
    render(f) {
      const { st, prev, kind, l, ms } = f
      const E = kit.ease
      // ---- 進場/離場 ----
      const switching = kind === 'desk' && st.desk !== prev.desk
      let op: number
      let push: number
      let rack: number
      if (switching && st.desk) {
        op = E.outCubic(kit.progress(l, 0, 700))
        push = E.inOutCubic(kit.progress(l, 0, T.desk))
        rack = E.inOutCubic(kit.progress(l, 250, T.desk - 350))
      } else if (switching) {
        op = 1 - E.inOutQuad(kit.progress(l, 0, T.desk))
        push = 1 + 0.4 * E.inQuad(kit.progress(l, 0, T.desk))
        rack = 1 - 0.5 * E.inQuad(kit.progress(l, 0, T.desk))
      } else {
        op = st.desk ? 1 : 0
        push = 1
        rack = 1
      }
      kit.css(desk, { opacity: op.toFixed(3), visibility: op <= 0.001 ? 'hidden' : 'visible' })
      if (op <= 0.001) return

      const pose = poseOf(f)

      // ---- 鏡頭:慢慢推近 + 手持的微晃 + 失焦到對焦 ----
      const t = ms / 1000
      const dx = kit.noise(t * 0.55, 11) * 7 + kit.noise(t * 1.7, 12) * 1.6
      const dy = kit.noise(t * 0.5, 23) * 6 + kit.noise(t * 1.9, 24) * 1.4 - pose.excite * 4
      const dr = kit.noise(t * 0.4, 37) * 0.35
      const z = kit.lerp(1.0, 1.075, push)
      kit.css(cam, { transform: `translate(${dx.toFixed(2)}px, ${(dy + (1 - push) * 30).toFixed(2)}px) rotate(${dr.toFixed(3)}deg) scale(${z.toFixed(4)})` })
      kit.setIf(room, 'filter', `blur(${kit.lerp(4, 13, rack).toFixed(1)}px) saturate(1.05)`)
      kit.setIf(far, 'filter', `blur(${kit.lerp(2, 5, rack).toFixed(1)}px)`)
      const tabBlur = kit.lerp(9, 0, rack)
      kit.setIf(persp, 'filter', tabBlur < 0.05 ? 'none' : `blur(${tabBlur.toFixed(1)}px)`)
      kit.setIf(kid, 'filter', `blur(${kit.lerp(12, 3.2, rack).toFixed(1)}px)`)
      const armBlur = kit.lerp(8, 0.6, rack)
      kit.setIf(arm, 'filter', `blur(${armBlur.toFixed(1)}px)`)

      // ---- 孩子:呼吸、靠近、開心聳肩 ----
      const breath = Math.sin((ms / 3800) * Math.PI * 2)
      const lift = pose.excite * 18
      attr(body, 'transform', `translate(0 ${(breath * 3.5 - lift).toFixed(2)})`)
      const headRot = kit.noise(t * 0.35, 51) * 0.9 + pose.reach * 1.6 - pose.excite * 1.2
      attr(head, 'transform', `translate(${(pose.reach * 6 - 28).toFixed(2)} ${(breath * 2.2 - lift * 0.8 + pose.reach * 4).toFixed(2)}) rotate(${headRot.toFixed(3)} 220 1150)`)

      // ---- 手與袖子 ----
      const idle = { x: kit.noise(t * 0.7, 61) * 5, y: kit.noise(t * 0.6, 62) * 4, z: kit.noise(t * 0.8, 63) * 4 }
      const calm = 1 - pose.reach
      const tipL = { x: pose.tip.x + idle.x * calm, y: pose.tip.y + idle.y * calm, z: pose.tip.z + idle.z * calm }
      const tp = project(tipL.x, tipL.y, tipL.z)
      const hs = 1.5 * tp.k
      const rot = kit.lerp(-24, -8, pose.reach) + kit.noise(t * 0.5, 64) * 2 * calm
      // 按下:手往指尖方向沉一點,指尖被壓扁
      const sink = pose.press * 6
      const tipPx = { x: tp.x, y: tp.y + sink * 0.3 }
      attr(hand, 'transform', `translate(${fx(tipPx.x)} ${fx(tipPx.y)}) rotate(${rot.toFixed(2)}) scale(${hs.toFixed(4)}) translate(0 ${(-sink).toFixed(2)})`)
      attr(index, 'transform', `translate(0 ${(sink).toFixed(2)}) scale(${(1 + pose.press * 0.06).toFixed(3)} ${(1 - pose.press * 0.08).toFixed(3)})`)
      const wrist = handAt(tipPx, rot, hs)
      // 上臂從肩膀往下到桌邊的手肘,前臂從手肘往前伸到平板
      const shoulder = { x: 640 + breath * 1.5, y: 1480 + breath * 3.5 - lift }
      const elbow = { x: 905 - pose.reach * 40 + breath, y: 1740 - pose.reach * 70 - lift * 0.6 }
      const mid = (a: Pt, b: Pt, ox: number, oy: number): Pt => ({ x: (a.x + b.x) / 2 + ox, y: (a.y + b.y) / 2 + oy })
      attr(upper, 'd', tube(shoulder, elbow, mid(shoulder, elbow, 30, -30), 220, 160))
      attr(elbowEl, 'cx', fx(elbow.x))
      attr(elbowEl, 'cy', fx(elbow.y))
      const fctl = mid(elbow, wrist, 34, 14)
      const ww = 96 * tp.k
      attr(sleeve, 'd', tube(elbow, wrist, fctl, 158, ww, 0, 0.98))
      // 袖口:最後一小截
      attr(cuff, 'd', tube(elbow, wrist, fctl, 158, ww * 1.04, 0.86, 1.0))
      attr(fold, 'd', `M${fx(elbow.x - 40)} ${fx(elbow.y - 50)} Q ${fx(fctl.x - 10)} ${fx(fctl.y + 6)} ${fx(kit.lerp(elbow.x, wrist.x, 0.7))} ${fx(kit.lerp(elbow.y, wrist.y, 0.7) + 14)}`)
      attr(sleeveLight, 'd', `M${fx(elbow.x - 70)} ${fx(elbow.y - 40)} Q ${fx(fctl.x - 60)} ${fx(fctl.y - 20)} ${fx(wrist.x - ww * 0.42)} ${fx(wrist.y - 6)}`)

      // 手指在螢幕上的影子(越靠近越清楚)
      const sx = tipL.x - TAB.bezel + tipL.z * 0.55
      const sy = tipL.y - TAB.bezel + 36 + tipL.z * 0.35
      const near = kit.clamp(1 - tipL.z / 110)
      kit.css(fshadow, {
        left: `${fx(sx)}px`,
        top: `${fx(sy)}px`,
        opacity: (0.5 * near * near).toFixed(3),
        filter: `blur(${(3 + tipL.z * 0.22).toFixed(1)}px)`,
        transform: `translate(-50%, -18%) rotate(${(-rot - 14).toFixed(1)}deg)`,
      })

      // ---- 漣漪(點到哪就在哪) ----
      if (pose.ripple !== null) {
        const q = pose.ripple
        kit.css(ripple, { left: `${pose.ripple.x}px`, top: `${pose.ripple.y}px`, opacity: (0.75 * (1 - q.p)).toFixed(3), transform: `translate(-50%, -50%) scale(${(0.35 + E.outCubic(q.p) * 1.45).toFixed(3)})` })
      } else kit.css(ripple, { opacity: '0', transform: 'translate(-50%, -50%) scale(0.3)' })

      // ---- 學習畫面 → 骰子遊戲的換頁:學習畫面往左滑走、稍微變暗,遊戲從右邊滑進來 ----
      const sl = pose.slide
      kit.css(learnPage, { transform: `translateX(${(-sl * 100).toFixed(2)}%) scale(${(1 - sl * 0.06).toFixed(4)})`, opacity: (1 - sl * 0.5).toFixed(3), visibility: sl >= 1 ? 'hidden' : 'visible' })
      kit.css(gamePage, { transform: `translateX(${((1 - sl) * 100).toFixed(2)}%)`, visibility: sl <= 0 ? 'hidden' : 'visible' })

      // ---- 學習畫面 ----
      const lv = pose.learn
      const learning = st.learn < 3 || (kind === 'deskLearn' && sl < 1)
      if (learning) {
        dots.forEach((el, i) => el.classList.toggle('on', i <= 1 + lv))
        dots.forEach((el, i) => el.classList.toggle('now', i === 1 + lv))
        kit.setIf(subtext, 'text', SUBS[Math.min(lv, SUBS.length - 1)])
        const subPop = pose.fx !== null && kind === 'deskLearn' && st.learn < 3 ? E.outCubic(kit.progress(pose.fx, 0, 300)) : 1
        kit.css(subtext, { opacity: subPop.toFixed(3), transform: `translateY(${((1 - subPop) * 8).toFixed(1)}px)` })
        // 積木:被手指按住時浮起來,跟著手指拖到空格;放好時彈一下
        const cp = pose.chip
        const cx = kit.lerp(CHIP.x, SLOT.x, cp.p)
        const cy = kit.lerp(CHIP.y, SLOT.y, cp.p)
        const snap = pose.fx !== null && kind === 'deskLearn' && st.learn === 1 ? kit.spring(pose.fx, { stiffness: 380, damping: 13 }) : 1
        kit.css(chip, {
          left: `${fx(cx - CHIP.w / 2)}px`,
          top: `${fx(cy - CHIP.h / 2)}px`,
          transform: `translateY(${(-cp.lifted * 8).toFixed(2)}px) scale(${(1 + cp.lifted * 0.1 + (1 - snap) * 0.25).toFixed(3)}) rotate(${(cp.lifted * -3).toFixed(2)}deg)`,
          boxShadow: `0 ${(3 + cp.lifted * 14).toFixed(1)}px ${(6 + cp.lifted * 18).toFixed(1)}px rgba(90, 50, 160, ${(0.25 + cp.lifted * 0.2).toFixed(3)})`,
        })
        chip.classList.toggle('in', lv >= 1)
        // 拖曳中積木盒留下虛線的位置,放好後收掉
        kit.setIf(ghost, 'opacity', cp.p > 0.02 ? (1 - kit.progress(cp.p, 0.85, 0.15)).toFixed(3) : '0')
        slot.classList.toggle('filled', lv >= 1)
        const glow = pose.fx !== null && kind === 'deskLearn' && st.learn === 1 ? 1 - kit.progress(pose.fx, 0, 700) : 0
        kit.setIf(slot, 'boxShadow', glow > 0 ? `0 0 0 ${(4 + (1 - glow) * 14).toFixed(1)}px rgba(255, 214, 90, ${(glow * 0.7).toFixed(3)})` : 'none')
        // 測驗:按到「不會」時按鈕下沉,答對變綠、打勾、「答對了！」跳出來
        const answering = kind === 'deskLearn' && st.learn === 2
        kit.css(optNo, { transform: `translateY(${(answering ? pose.press * 4 : 0).toFixed(2)}px)` })
        optNo.classList.toggle('ok', lv >= 2)
        const okP = answering && pose.fx !== null ? E.outBack(kit.progress(pose.fx, 30, 320)) : lv >= 2 ? 1 : 0
        kit.css(check, { opacity: kit.clamp(okP).toFixed(3), transform: `scale(${kit.lerp(0.2, 1, okP).toFixed(3)})`, width: `${(kit.clamp(okP) * 30).toFixed(1)}px` })
        const rightP = answering && pose.fx !== null ? E.outBack(kit.progress(pose.fx, 80, 380)) : lv >= 2 ? 1 : 0
        const optFade = 1 - kit.clamp(pose.playBtn)
        kit.css(right, { opacity: (kit.clamp(rightP) * optFade).toFixed(3), transform: `translate(-50%, -50%) translateY(${((1 - kit.clamp(rightP)) * 10).toFixed(1)}px) scale(${kit.lerp(0.5, 1, rightP).toFixed(3)}) rotate(-4deg)` })
        kit.setIf(optYes, 'opacity', optFade.toFixed(3))
        kit.setIf(optNo, 'opacity', optFade.toFixed(3))
        // 「換你擲骰子」按鈕
        const pb = pose.playBtn
        const playing = kind === 'deskLearn' && st.learn === 3
        kit.css(play, { opacity: kit.clamp(pb).toFixed(3), transform: `translateY(${((playing ? pose.press * 5 : 0) + (1 - kit.clamp(pb)) * 16).toFixed(2)}px) scale(${kit.lerp(0.6, 1, pb).toFixed(3)})` })
        play.classList.toggle('down', playing && pose.press > 0.4)
      }

      // ---- 骰子遊戲:按鈕、骰子 ----
      const tapping = kind === 'deskTap'
      kit.css(btn, { transform: `translateY(${(tapping ? pose.press * 5 : 0).toFixed(2)}px)` })
      btn.classList.toggle('down', tapping && pose.press > 0.4)

      kit.setIf(die, 'html', dieFace(pose.face))
      let ddx = 0
      let ddy = 0
      let drot = 0
      let sxd = 1
      let syd = 1
      let hgt = 0
      if (pose.rolling !== null) {
        const q = pose.rolling
        const decay = 1 - q
        hgt = Math.abs(Math.sin(q * Math.PI * 3)) * 70 * decay * decay + 8 * decay
        ddy = -hgt
        ddx = Math.sin(q * Math.PI * 1.5) * 26 * decay
        drot = (1 - E.outCubic(q)) * 760 * (st.taps % 2 ? 1 : -1)
        const sq = Math.sin(q * Math.PI * 6) * 0.06 * decay
        sxd = 1 + sq
        syd = 1 - sq
      } else if (pose.sinceLand !== null) {
        // 落地:壓扁再彈回
        const k = kit.spring(pose.sinceLand, { stiffness: 320, damping: 14 })
        sxd = 1 + (1 - k) * 0.14
        syd = 1 - (1 - k) * 0.14
      }
      kit.css(die, { transform: `translate(${ddx.toFixed(2)}px, ${ddy.toFixed(2)}px) rotate(${drot.toFixed(1)}deg) scale(${sxd.toFixed(3)}, ${syd.toFixed(3)})` })
      kit.css(dshadow, { transform: `translate(calc(-50% + ${ddx.toFixed(1)}px), 0) scale(${(1 - hgt / 160).toFixed(3)})`, opacity: (0.4 - hgt / 300).toFixed(3) })

      const shown = pose.shown
      /** 擲完 n 次時亮幾顆星:慶祝那一次(cheer,或第 3 次)之後全亮 */
      const litOf = (n: number): number => (st.cheerAt > 0 && n >= st.cheerAt ? 3 : Math.min(Math.max(n, 0), 3))
      const done = st.cheerAt > 0 && shown >= st.cheerAt
      const msgText =
        pose.rolling !== null ? '骰子滾呀滾…' : shown <= 0 ? '按下按鈕擲骰子！' : `擲出 ${dieAfter(shown)} 點！`
      kit.setIf(msg, 'text', msgText)
      const msgPop = pose.sinceLand !== null ? E.outBack(kit.progress(pose.sinceLand, 0, 260)) : 1
      kit.css(msg, { transform: `scale(${kit.lerp(0.85, 1, msgPop).toFixed(3)})`, opacity: kit.clamp(msgPop).toFixed(3) })
      // 星星:這一次新亮的星星一顆接一顆跳出來(慶祝時剩下的一起亮)
      const litBefore = litOf(shown - 1)
      const lit = litOf(shown)
      stars.forEach((el, i) => {
        const popping = i < lit && i >= litBefore && pose.sinceLand !== null
        const sp = popping ? kit.progress(pose.sinceLand!, 40 + (i - litBefore) * 110, 320) : 1
        el.classList.toggle('on', i < lit && (!popping || sp > 0))
        kit.css(el, { transform: `scale(${(popping ? kit.lerp(0.4, 1, E.outBack(sp)) + Math.sin(sp * Math.PI) * 0.25 : 1).toFixed(3)})` })
      })
      kit.setIf(count, 'text', done ? '全部完成！' : `已擲 ${Math.min(shown, 3)} / 3 次`)
      const barP = pose.sinceLand !== null ? E.outCubic(kit.progress(pose.sinceLand, 0, 380)) : 1
      kit.setIf(bar, 'width', `${(kit.lerp(litBefore / 3, lit / 3, barP) * 100).toFixed(2)}%`)

      // ---- 慶祝(寫 cheer 的那一次,或第 3 次) ----
      const yayP = pose.sinceLand !== null && shown === st.cheerAt ? E.outBack(kit.progress(pose.sinceLand, 60, 360)) : done ? 1 : 0
      kit.css(yay, { opacity: kit.clamp(yayP * 1.5).toFixed(3), transform: `translate(-50%, -50%) rotate(-6deg) scale(${kit.lerp(0.3, 1, yayP).toFixed(3)})` })
      if (pose.confetti !== null) {
        const q = pose.confetti
        const tt = q * 0.9
        confEls.forEach((el, i) => {
          const c = confetti[i]
          const x = DIE.x + c.vx * tt
          const y = DIE.y - 20 + c.vy * tt + 0.5 * 1500 * tt * tt
          kit.css(el, { opacity: (1 - kit.progress(q, 0.7, 0.3)).toFixed(3), transform: `translate(${fx(x)}px, ${fx(y)}px) rotate(${(c.rot * tt).toFixed(1)}deg)` })
        })
      } else confEls.forEach((el) => kit.setIf(el, 'opacity', '0'))
      // 星星從平板飛出來(畫布座標)
      const sparkOrigin = project(TAB.bezel + DIE.x, TAB.bezel + DIE.y, 10)
      sparkEls.forEach((el, i) => {
        const s = sparks[i]
        if (pose.confetti === null || pose.sinceLand === null) return kit.setIf(el, 'opacity', '0')
        const q = kit.progress(pose.sinceLand, s.d * 0.5, 400 - s.d * 0.5)
        if (q <= 0 || q >= 1) return kit.setIf(el, 'opacity', '0')
        const e = E.outCubic(q)
        const x = sparkOrigin.x + Math.cos(rad(s.ang)) * s.dist * e
        const y = sparkOrigin.y + Math.sin(rad(s.ang)) * s.dist * e
        kit.css(el, { opacity: Math.min(1, (1 - q) * 2.2).toFixed(3), width: `${fx(s.s)}px`, height: `${fx(s.s)}px`, transform: `translate(${fx(x - s.s / 2)}px, ${fx(y - s.s / 2)}px) rotate(${(q * 160).toFixed(1)}deg) scale(${(0.5 + e * 0.6).toFixed(3)})` })
      })

      // ---- 光:光束的呼吸、灰塵、窗外的散景 ----
      rays.forEach((el, i) => kit.setIf(el, 'opacity', (0.5 + 0.5 * kit.noise(t * 0.25 + i * 3.1, 70 + i)).toFixed(3)))
      dustEls.forEach((el, i) => {
        const d = dust[i]
        const x = d.x + kit.noise(t * 0.12 * d.sp + i, d.seed) * 70 + t * 4 * d.sp
        const y = d.y + kit.noise(t * 0.1 * d.sp + i * 1.7, d.seed + 1) * 60 - t * 3 * d.sp
        const tw = 0.5 + 0.5 * kit.noise(t * 0.6 + i, d.seed + 2)
        kit.css(el, { transform: `translate(${fx(x)}px, ${fx(y)}px)`, opacity: (tw * 0.85).toFixed(3) })
      })
      bokehEls.forEach((el, i) => kit.setIf(el, 'opacity', (0.35 + 0.35 * kit.noise(t * 0.2 + i, bokeh[i].seed)).toFixed(3)))
      const g = kit.rand(Math.floor(ms / 83) + 7)
      kit.setIf(grain, 'backgroundPosition', `${Math.floor(g() * 200)}px ${Math.floor(g() * 200)}px`)
    },
    target(name) {
      return name === 'desk' ? desk : null
    },
  }
}
