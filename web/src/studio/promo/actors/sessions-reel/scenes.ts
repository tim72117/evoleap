// sessions-reel 的各段畫面:全是純函式(時間進來、SVG 字串出去),不用亂數、不讀時鐘。
// 用兩個終端機視窗模擬兩個 Claude Code session;session 之間的訊息用信封在兩個視窗之間飛。
// 版面在直式 Reels 安全區內(x 70–940、y 250–1500)。
import { INK, MONO, SANS, clamp, cursor, esc, inOutCubic, lerp, mix, n2, outBack, outCubic, path2, seg, star, type SceneOut } from '../archify-reel/draw'

const CX = 505 // 安全區的中線
/** Reels 左下角粉絲團頭像的位置(平台疊的介面,在安全區外) */
const FOLLOW_ICON: [number, number] = [110, 1640]
const BG = '#f4efe8'
const ACCENT = '#c8643c'
const MUTED = '#6b6155'
const TERM = '#1d1b24'
const TEXT = '#e8e4dc'
export const BLUE = '#5b8def'
export const GREEN = '#3fbf78'
export const PURPLE = '#9b72e6'

const txt = (x: number, y: number, s: string, size: number, fill = INK, o: { anchor?: string; weight?: number; font?: string; op?: number } = {}): string =>
  `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${o.anchor ?? 'start'}" font-family="${o.font ?? SANS}" font-size="${size}" font-weight="${o.weight ?? 600}" fill="${fill}" opacity="${n2(o.op ?? 1)}">${esc(s)}</text>`

/** 粗估字串寬度:全形字算一格,半形字算 0.58 格 */
export const textW = (s: string, size: number): number => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 1 : 0.58), 0) * size

const pill = (cx: number, cy: number, label: string, fill: string, color: string, op = 1, fs = 30, sc = 1): string => {
  const w = textW(label, fs) + fs * 1.6
  const h = fs * 1.9
  return `<g opacity="${n2(op)}" transform="translate(${n2(cx)} ${n2(cy)}) scale(${n2(sc)})"><rect x="${n2(-w / 2)}" y="${n2(-h / 2)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(h / 2)}" fill="${fill}"/>${txt(0, fs * 0.36, label, fs, color, { anchor: 'middle', weight: 800 })}</g>`
}

const typed = (s: string, p: number): string => [...s].slice(0, Math.floor([...s].length * clamp(p))).join('')
/** 某個時間點起 250ms 內算按下 */
const pressAt = (l: number, t: number): number => (l >= t && l < t + 250 ? 1 : 0)

// ---------- 版面 ----------
type Win = { x: number; y: number; w: number; h: number }
export const TOP: Win = { x: 70, y: 400, w: 870, h: 420 }
export const BOT: Win = { x: 70, y: 1040, w: 870, h: 420 }
/** 兩個視窗之間的空隙中線 */
const GAP_Y = (TOP.y + TOP.h + BOT.y) / 2

/** 段落標題(視窗上方) */
const heading = (tag: string, label: string, op = 1): string =>
  `<g opacity="${n2(op)}">${pill(70 + (textW(tag, 34) + 54) / 2, 306, tag, ACCENT, '#fff', 1, 34)}${txt(70 + textW(tag, 34) + 54 + 24, 320, label, 44, INK, { weight: 800 })}</g>`

type Line = { s: string; c?: string; op?: number; p?: number }

/** 終端機視窗:標題列有 session 名稱與顏色點;lines 最多 5 行;glow 是外框亮起的程度 */
function term(w: Win, title: string, color: string, lines: Line[], glow = 0, dx = 0, op = 1): string {
  let s = `<g opacity="${n2(op)}" transform="translate(${n2(dx)} 0)">`
  if (glow > 0) s += `<rect x="${w.x - 9}" y="${w.y - 9}" width="${w.w + 18}" height="${w.h + 18}" rx="40" fill="none" stroke="${color}" stroke-width="6" opacity="${n2(glow)}"/>`
  s += `<rect x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" rx="32" fill="${TERM}"/>`
  s += `<circle cx="${w.x + 50}" cy="${w.y + 46}" r="13" fill="${color}"/>${txt(w.x + 78, w.y + 57, title, 32, '#fff', { weight: 800 })}`
  s += txt(w.x + w.w - 40, w.y + 57, 'Claude Code', 24, '#8f8a99', { anchor: 'end', weight: 600 })
  s += `<line x1="${w.x}" y1="${w.y + 92}" x2="${w.x + w.w}" y2="${w.y + 92}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>`
  lines.slice(0, 5).forEach((ln, i) => {
    const o = ln.op ?? 1
    if (o <= 0) return
    const str = ln.p === undefined ? ln.s : typed(ln.s, ln.p)
    s += txt(w.x + 44, w.y + 150 + i * 62, str, 30, ln.c ?? TEXT, { op: o, font: MONO, weight: 500 })
  })
  return s + '</g>'
}

const show = (l: number, a: number): number => seg(l, a, a + 300)

// ---------- 各段 ----------
/** 開場:同時開好幾個 Claude Code,你夾在中間傳話 */
export function hook(l: number): SceneOut {
  let s = txt(CX, 470, '用 Claude Code 做專案', 58, MUTED, { anchor: 'middle', weight: 800, op: seg(l, 0, 450) })
  s += txt(CX, 590, '同時開好幾個 session？', 70, ACCENT, { anchor: 'middle', weight: 800, op: seg(l, 200, 650) })
  const names = ['App', '套件', '文件']
  const cols = [BLUE, GREEN, PURPLE]
  const me = { x: CX, y: 1250 }
  names.forEach((n, i) => {
    const a = outBack(seg(l, 600 + i * 180, 1100 + i * 180))
    if (a <= 0) return
    const x = 70 + i * 300
    // 你和每個視窗之間的傳話線
    const p = seg(l, 1700 + i * 150, 2200 + i * 150)
    if (p > 0) s += `<line x1="${x + 135}" y1="960" x2="${n2(lerp(x + 135, me.x, p))}" y2="${n2(lerp(960, me.y - 60, p))}" stroke="${MUTED}" stroke-width="4" stroke-dasharray="10 10"/>`
    s += `<g transform="translate(${x + 135} 860) scale(${n2(a)})"><rect x="-135" y="-100" width="270" height="200" rx="24" fill="${TERM}"/><circle cx="-100" cy="-68" r="10" fill="${cols[i]}"/>${txt(-80, -58, n, 28, '#fff', { weight: 800 })}`
    for (let k = 0; k < 3; k++) s += `<rect x="-105" y="${-20 + k * 36}" width="${[190, 140, 170][(k + i) % 3]}" height="14" rx="7" fill="#ffffff" fill-opacity="0.22"/>`
    s += '</g>'
  })
  const m = outBack(seg(l, 1500, 1900))
  if (m > 0) s += `<g transform="translate(${me.x} ${me.y}) scale(${n2(m)})"><circle r="62" fill="${ACCENT}"/>${txt(0, 15, '你', 44, '#fff', { anchor: 'middle', weight: 800 })}</g>`
  s += txt(CX, 1420, '複製、貼上、再說明一次……', 44, MUTED, { anchor: 'middle', op: seg(l, 2500, 3000) })
  return { bg: BG, body: decor(l) + s }
}

/** 痛點:從一個 session 複製內容貼到另一個,對方不懂背景,還要重講 */
export function pain(l: number): SceneOut {
  let s = heading('痛點', '你成了傳話筒')
  const topLines: Line[] = [
    { s: '> formatPrice 做好了', c: '#fff' },
    { s: '參數 amount, currency, digits' },
  ]
  s += term(TOP, '套件 session', BLUE, topLines)
  // 反白選取
  const sel = outCubic(seg(l, 700, 1300))
  if (sel > 0) s += `<rect x="${TOP.x + 38}" y="${TOP.y + 212 - 36}" width="${n2(560 * sel)}" height="48" rx="6" fill="${BLUE}" opacity="0.4"/>`
  s += pill(820, TOP.y + 200, '⌘C', '#fff', INK, pressAt(l, 1350) || (l > 1350 && l < 2000 ? 1 : 0), 28)
  // 剪貼簿往下飛
  const f = seg(l, 1600, 2400)
  if (f > 0 && f < 1) {
    const y = lerp(TOP.y + 220, BOT.y + 150, outCubic(f))
    s += `<g transform="translate(${CX} ${n2(y)})"><rect x="-150" y="-36" width="300" height="72" rx="16" fill="#fff" stroke="${BLUE}" stroke-width="4"/>${txt(0, 10, 'amount, currency…', 26, INK, { anchor: 'middle', font: MONO })}</g>`
  }
  const botLines: Line[] = [
    { s: '> amount, currency, digits', c: '#fff', op: show(l, 2400) },
    { s: 'digits 可以不填嗎？回傳什麼？', c: ACCENT, op: show(l, 3000) },
    { s: '> 我再說明一次專案背景……', c: '#fff', p: seg(l, 3800, 4900), op: l >= 3800 ? 1 : 0 },
    { s: '> 這個函式是給記帳 App 用的……', c: '#fff', p: seg(l, 5000, 5900), op: l >= 5000 ? 1 : 0 },
  ]
  s += term(BOT, 'App session', GREEN, botLines)
  s += pill(820, BOT.y + 150, '⌘V', '#fff', INK, l > 2350 && l < 2900 ? 1 : 0, 28)
  // 重講次數
  const b = outBack(seg(l, 5300, 5800))
  if (b > 0) s += pill(CX, GAP_Y, '第 3 次重講背景', '#d6453d', '#fff', 1, 36, b)
  const [x, y] = path2(l, [{ at: 0, x: 640, y: 900 }, { at: 700, x: TOP.x + 44, y: TOP.y + 200 }, { at: 1300, x: TOP.x + 600, y: TOP.y + 200 }, { at: 2400, x: 640, y: BOT.y + 140 }, { at: 3200, x: 700, y: BOT.y + 300 }])
  s += cursor(x, y, pressAt(l, 2350), l < 3600 ? 1 : 1 - seg(l, 3600, 3900))
  return { bg: BG, body: decor(l) + s }
}

// ---------- 色彩與點綴(參考兒童課宣傳片:暖色光斑、漸層、小星星) ----------
const SPARKS: [number, number, number, string][] = [
  [105, 300, 26, '#ffb062'], [965, 340, 20, '#b39cff'], [90, 980, 18, '#5ad6c0'],
  [985, 1180, 28, '#ffd166'], [120, 1560, 22, '#ff6b6b'], [950, 1580, 18, '#b39cff'],
]
/** 背景光斑與漂浮的星星(全部由時間算出) */
function decor(l: number): string {
  const defs = ['ss-b1:255,176,98', 'ss-b2:179,156,255', 'ss-b3:90,214,192', 'ss-b4:255,209,102']
    .map((d) => {
      const [id, c] = d.split(':')
      return `<radialGradient id="${id}"><stop offset="0" stop-color="rgb(${c})" stop-opacity=".55"/><stop offset="1" stop-color="rgb(${c})" stop-opacity="0"/></radialGradient>`
    })
    .join('')
  const blobs: [string, number, number, number][] = [['ss-b1', 130, 430, 400], ['ss-b2', 960, 800, 420], ['ss-b3', 170, 1480, 400], ['ss-b4', 930, 1640, 360]]
  let s = `<defs>${defs}</defs>`
  blobs.forEach(([id, x, y, r], i) => {
    s += `<circle cx="${n2(x + Math.sin(l / 1700 + i * 1.3) * 34)}" cy="${n2(y + Math.cos(l / 2100 + i) * 28)}" r="${r}" fill="url(#${id})"/>`
  })
  SPARKS.forEach(([x, y, r, c], i) => {
    const tw = 0.82 + 0.18 * Math.sin(l / 420 + i * 1.7)
    s += star(x, y + Math.sin(l / 900 + i) * 8, r * tw, c, 0.9, Math.sin(l / 1500 + i) * 0.25)
  })
  return s
}

// ---------- 三個情境:撲克牌扇形攤開,一張一張翻開來看 ----------
type CaseCard = { tag: string; title: string; icon: 'mail' | 'data' | 'swap'; colors: [string, string]; foot: string }
const CARDS: CaseCard[] = [
  { tag: '01', title: '取資料', icon: 'data', colors: ['#ffb062', '#ff6b6b'], foot: '先問清楚規格' },
  { tag: '02', title: '回報問題', icon: 'mail', colors: ['#b39cff', '#7a5cf0'], foot: '有問題就通知' },
  { tag: '03', title: '協調溝通', icon: 'swap', colors: ['#5ad6c0', '#2f9fe0'], foot: '修好發布再通知' },
]
const ICONS: Record<CaseCard['icon'], string> = {
  mail: '<rect x="-15" y="-11" width="30" height="22" rx="4"/><path d="M-14 -9 L0 3 L14 -9"/>',
  data: '<ellipse cx="0" cy="-9" rx="13" ry="5"/><path d="M-13 -9 V9 A13 5 0 0 0 13 9 V-9 M-13 0 A13 5 0 0 0 13 0"/>',
  swap: '<path d="M-14 -6 H12 M6 -12 L12 -6 L6 0 M14 8 H-12 M-6 2 L-12 8 L-6 14"/>',
}
const FAN = { cx: CX, py: 1560, r: 235, angles: [-16, 0, 16], scale: 0.7 }
const FOCUS = { x: CX, y: 860, scale: 1.95 }
const easeIO = (p: number): number => inOutCubic(p)

const CARD_RECT = 'x="-150" y="-220" width="300" height="440" rx="30"'

/** 牌背:漸層底、菱格紋、雙層邊框、中間圓形徽章加號碼,左上與右下有撲克牌的小號碼,一道斜光 */
function cardBack(k: number, c: CaseCard): string {
  const id = `ss-back${k}`
  let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.colors[0]}"/><stop offset="1" stop-color="${c.colors[1]}"/></linearGradient>` +
    `<pattern id="ss-lat" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M13 0 L26 13 L13 26 L0 13Z" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="1.6"/></pattern>` +
    `<linearGradient id="ss-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".48" stop-color="#fff" stop-opacity=".3"/><stop offset=".66" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="${id}c"><rect ${CARD_RECT}/></clipPath></defs>`
  s += `<rect ${CARD_RECT} fill="url(#${id})"/><g clip-path="url(#${id}c)"><rect x="-150" y="-220" width="300" height="440" fill="url(#ss-lat)"/><rect x="-150" y="-220" width="300" height="440" fill="url(#ss-sheen)"/></g>`
  s += `<rect x="-136" y="-206" width="272" height="412" rx="22" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2.5"/><rect x="-124" y="-194" width="248" height="388" rx="16" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1.5"/>`
  s += `<circle r="82" fill="#fff" fill-opacity=".14"/><circle r="70" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round"/><circle r="56" fill="#fff"/><circle r="56" fill="none" stroke="${c.colors[0]}" stroke-width="4"/>`
  s += txt(0, 22, String(k + 1), 62, c.colors[1], { anchor: 'middle', weight: 900 })
  s += star(0, -88, 12, '#ffffff', 0.9) + star(0, 88, 12, '#ffffff', 0.9)
  s += txt(-118, -166, String(k + 1), 24, '#fff', { weight: 800 }) + star(-106, -146, 8, '#ffffff', 0.9)
  s += `<g transform="rotate(180)">${txt(-118, -166, String(k + 1), 24, '#fff', { weight: 800 })}${star(-106, -146, 8, '#ffffff', 0.9)}</g>`
  return s
}

/** 牌面中間的大圖示(三張各一個,翻開後彈出、會動)。案例本身由旁白說,畫面只放圖示 */
function feature(c: CaseCard, ll: number): string {
  const [c0, c1] = c.colors
  const pop = outBack(seg(ll, 100, 700))
  const bob = Math.sin(ll / 450) * 4
  let s = `<g transform="translate(0 12)"><circle r="112" fill="${c0}" opacity=".13"/><circle r="112" fill="none" stroke="${c1}" stroke-opacity=".35" stroke-width="2.5" stroke-dasharray="4 12" stroke-linecap="round" transform="rotate(${n2(ll / 40)})"/>`
  s += star(-96, -84, 9, c0, 0.9) + star(98, 72, 11, c1, 0.7) + star(86, -92, 7, '#ffd166', 0.95)
  if (c.icon === 'mail') {
    const slide = (1 - clamp(pop)) * -150
    s += `<g transform="translate(${n2(slide)} ${n2(bob)})">`
    for (let i = 0; i < 3; i++) s += `<rect x="${-126 + i * 6}" y="${-26 + i * 24}" width="${36 - i * 8}" height="7" rx="3.5" fill="${c1}" opacity="${n2(0.55 - i * 0.12)}"/>`
    s += `<rect x="-72" y="-46" width="144" height="100" rx="15" fill="#fff" stroke="${c1}" stroke-width="6"/><path d="M-70 -34 L0 16 L70 -34" fill="none" stroke="${c1}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M-66 50 L-24 8 M66 50 L24 8" fill="none" stroke="${c0}" stroke-width="4" stroke-linecap="round" opacity=".6"/>`
    const b = outBack(seg(ll, 650, 1000))
    if (b > 0.001) s += `<g transform="translate(70 -46) scale(${n2(b)})"><circle r="22" fill="#ff7a3d" stroke="#fff" stroke-width="4"/><path d="M0 -11 V3" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cy="12" r="3.6" fill="#fff"/></g>`
    s += '</g>'
  } else if (c.icon === 'data') {
    s += `<defs><linearGradient id="ss-db" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs>`
    s += `<g transform="translate(-34 ${n2(bob)}) scale(${n2(clamp(pop))})"><path d="M-58 -56 V50 A58 20 0 0 0 58 50 V-56Z" fill="url(#ss-db)"/><ellipse cy="-56" rx="58" ry="20" fill="${c0}"/><ellipse cy="-56" rx="58" ry="20" fill="#fff" opacity=".35"/>`
    s += `<path d="M-58 -16 A58 20 0 0 0 58 -16 M-58 24 A58 20 0 0 0 58 24" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4"/><rect x="-44" y="-50" width="10" height="92" rx="5" fill="#fff" opacity=".3"/><circle cx="36" cy="-2" r="5" fill="#fff"/><circle cx="36" cy="38" r="5" fill="#fff"/></g>`
    // 一份份資料從資料庫飛出來
    for (let i = 0; i < 3; i++) {
      const p = (ll / 1500 + i / 3) % 1
      if (ll < 700) continue
      const x = lerp(30, 138, p)
      const y = -34 + i * 38
      s += `<g opacity="${n2(Math.sin(Math.PI * p))}" transform="translate(${n2(x)} ${y})"><rect x="-26" y="-18" width="52" height="36" rx="8" fill="#fff" stroke="${c1}" stroke-width="4"/><rect x="-16" y="-8" width="32" height="5" rx="2.5" fill="${c0}"/><rect x="-16" y="3" width="22" height="5" rx="2.5" fill="${c1}" opacity=".6"/></g>`
    }
  } else {
    const av = (x: number, col: string, ch: string): string =>
      `<g transform="translate(${x} ${n2(bob * (x < 0 ? 1 : -1))}) scale(${n2(clamp(pop))})"><circle r="50" fill="${col}" stroke="#fff" stroke-width="6"/><circle r="50" fill="#fff" opacity=".12" cy="-12"/>${txt(0, 18, ch, 52, '#fff', { anchor: 'middle', weight: 900 })}</g>`
    s += av(-72, GREEN, '記') + av(72, PURPLE, 'P')
    const arc = (d: string, delay: number): string => {
      const p = seg(ll, 500 + delay, 1100 + delay)
      return p > 0 ? `<path d="${d}" fill="none" stroke="${c1}" stroke-width="7" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${n2(1 - p)}"/>` : ''
    }
    s += arc('M-40 -62 Q0 -104 40 -62', 0) + arc('M40 66 Q0 108 -40 66', 250)
    const tip = (x: number, y: number, rot: number, delay: number): string => (seg(ll, 1000 + delay, 1150 + delay) > 0 ? `<path d="M-11 -9 L0 3 L11 -9" fill="none" stroke="${c1}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x} ${y}) rotate(${rot})"/>` : '')
    s += tip(40, -62, -62, 0) + tip(-40, 66, 118, 250)
    const ok = outBack(seg(ll, 1500, 1850))
    if (ok > 0.001) s += `<g transform="translate(0 2) scale(${n2(ok)})"><circle r="25" fill="#2fbf71" stroke="#fff" stroke-width="5"/><path d="M-11 0 L-3 9 L12 -9" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></g>`
  }
  return s + '</g>'
}

/** 牌面:色帶(情境名、圖示)、兩個 session(頭像加名稱)、訊息(帶色條)、下方一句重點。ll 是這張牌翻開後經過的時間 */
function cardFace(k: number, c: CaseCard, ll: number): string {
  const id = `ss-face${k}`
  let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.colors[0]}"/><stop offset="1" stop-color="${c.colors[1]}"/></linearGradient>` +
    `<linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#fff6ec"/></linearGradient>` +
    `<linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<pattern id="ss-str" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="6" height="16" fill="#fff" fill-opacity=".1"/></pattern>` +
    `<linearGradient id="ss-sw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="${id}c"><rect ${CARD_RECT}/></clipPath></defs>`
  s += `<rect ${CARD_RECT} fill="url(#${id}p)"/>`
  // 色帶:漸層、斜紋、右上的大圓、底下一條高光
  s += `<g clip-path="url(#${id}c)"><rect x="-150" y="-220" width="300" height="106" fill="url(#${id})"/><rect x="-150" y="-220" width="300" height="106" fill="url(#ss-str)"/><rect x="-150" y="-220" width="300" height="106" fill="url(#${id}h)"/><circle cx="112" cy="-196" r="78" fill="#fff" opacity=".13"/><circle cx="-132" cy="-120" r="40" fill="#fff" opacity=".08"/></g>`
  s += `<rect x="-150" y="-115" width="300" height="3" fill="#fff" opacity=".55"/>`
  const tagW = textW(c.tag, 15) + 22
  s += `<rect x="-128" y="-207" width="${n2(tagW)}" height="23" rx="11.5" fill="#fff" fill-opacity=".26"/><text x="${n2(-128 + tagW / 2)}" y="-191" text-anchor="middle" font-family="${SANS}" font-size="15" font-weight="800" letter-spacing="2" fill="#fff">${esc(c.tag)}</text>`
  s += txt(-127, -136, c.title, 40, '#3a1d12', { weight: 900, op: 0.16 }) + txt(-128, -138, c.title, 40, '#fff', { weight: 900 })
  s += `<g transform="translate(108 -166)"><circle r="33" fill="#fff" fill-opacity=".2"/><circle r="27" fill="#fff" fill-opacity=".22" stroke="#fff" stroke-opacity=".8" stroke-width="2"/><g fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[c.icon]}</g></g>`
  s += feature(c, ll)
  s += `<rect x="-120" y="146" width="240" height="1.5" rx=".75" fill="${c.colors[1]}" opacity=".22"/>`
  const foot = outBack(seg(ll, 900, 1300))
  if (foot > 0.001) s += `<g transform="translate(0 178) scale(${n2(clamp(foot))})"><rect x="-98" y="-22" width="196" height="44" rx="22" fill="url(#${id})"/><rect x="-98" y="-22" width="196" height="22" rx="11" fill="#fff" opacity=".2"/>${txt(0, 7.5, c.foot, 20, '#fff', { anchor: 'middle', weight: 800 })}</g>`
  s += txt(122, 208, String(k + 1), 20, c.colors[1], { anchor: 'middle', weight: 800, op: 0.55 })
  // 翻開之後一道光掃過牌面
  const sw = seg(ll, 0, 900)
  if (sw > 0 && sw < 1) s += `<g clip-path="url(#${id}c)" opacity="${n2(1 - Math.abs(sw - 0.5) * 0.6)}"><rect x="${n2(lerp(-260, 200, sw))}" y="-260" width="90" height="520" fill="url(#ss-sw)" transform="rotate(18)"/></g>`
  s += `<rect ${CARD_RECT} fill="none" stroke="${c.colors[1]}" stroke-opacity=".55" stroke-width="3"/><rect x="-147" y="-217" width="294" height="434" rx="28" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/>`
  return s
}

/** 第 s 個情境:這張牌翻開、放大到中間,前一張翻回扇形裡;第一個情境先把三張牌攤開 */
function cardsScene(l: number, s: number): SceneOut {
  const t0 = s === 0 ? 700 : 0
  let body = decor(l)
  body += txt(CX, 330, '三種用法', 60, INK, { anchor: 'middle', weight: 900, op: seg(l, 0, 350) })
  const focus = (k: number): number => (k === s ? easeIO(seg(l, t0, t0 + 650)) : k === s - 1 ? 1 - easeIO(seg(l, 0, 500)) : 0)
  // 進度點
  CARDS.forEach((c, k) => {
    body += `<circle cx="${CX + (k - 1) * 46}" cy="392" r="10" fill="${mix('#d9cfc2', c.colors[0], clamp(focus(k) + (k < s ? 1 : 0)))}"/>`
  })
  const order = CARDS.map((_, k) => k).sort((a, b) => focus(a) - focus(b))
  body += `<defs><filter id="ss-sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="16" stdDeviation="14" flood-color="#6e2846" flood-opacity=".3"/></filter></defs>`
  for (const k of order) {
    const f = focus(k)
    const deal = s === 0 ? outBack(seg(l, k * 120, 600 + k * 120)) : 1
    const a0 = FAN.angles[k]
    const rad = (a0 * Math.PI) / 180
    const fx = FAN.cx + FAN.r * Math.sin(rad)
    const fy = FAN.py - FAN.r * Math.cos(rad) + (1 - clamp(deal)) * 520
    const e = f
    const x = lerp(fx, FOCUS.x, e)
    const y = lerp(fy, FOCUS.y, e) - Math.sin(Math.PI * f) * 70
    const ang = lerp(a0, 0, e)
    const sc = lerp(FAN.scale, FOCUS.scale, e)
    const phi = Math.PI * seg(f, 0.15, 0.65)
    const sx = Math.abs(Math.cos(phi))
    const ll = k === s ? Math.max(0, l - (t0 + 650)) : 1000000
    const face = phi > Math.PI / 2
    body += `<g transform="translate(${n2(x)} ${n2(y)}) rotate(${n2(ang)}) scale(${n2(sc)})" filter="url(#ss-sh)"><g transform="scale(${n2(Math.max(sx, 0.001))} 1)">${face ? cardFace(k, CARDS[k], ll) : cardBack(k, CARDS[k])}</g></g>`
  }
  return { bg: BG, body }
}
export const fetch = (l: number): SceneOut => cardsScene(l, 0)
export const send = (l: number): SceneOut => cardsScene(l, 1)
export const coord = (l: number): SceneOut => cardsScene(l, 2)

/** 結尾:追蹤粉絲團,定期提供 AI 資訊。箭頭指向 Reels 介面左下角真實的粉絲團頭像(平台自己疊的,畫面裡不畫它) */
export function follow(l: number): SceneOut {
  let s = txt(CX, 520, '想知道更多 AI 新知？', 60, INK, { anchor: 'middle', weight: 800, op: seg(l, 0, 500) })
  const c = outBack(seg(l, 300, 900))
  if (c > 0) {
    s += `<g transform="translate(${CX} 860) scale(${n2(c)})"><rect x="-360" y="-200" width="720" height="400" rx="40" fill="#fff" stroke="#e0d6c8" stroke-width="3"/>`
    s += `<defs><linearGradient id="ss-av" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb062"/><stop offset="1" stop-color="#ff6b6b"/></linearGradient></defs><circle cx="0" cy="-80" r="86" fill="#ffb062" opacity=".25"/><circle cx="0" cy="-80" r="74" fill="url(#ss-av)"/>${txt(0, -54, 'e', 80, '#fff', { anchor: 'middle', weight: 800 })}`
    s += txt(0, 60, 'evoleap 粉絲團', 50, INK, { anchor: 'middle', weight: 800 })
    s += txt(0, 128, '定期分享實用的 AI 資訊', 36, MUTED, { anchor: 'middle' }) + '</g>'
  }
  // 大箭頭從卡片往左下角,指向平台疊在畫面上的粉絲團頭像與「追蹤」,一直輕輕往前頂
  const ar = outBack(seg(l, 900, 1500))
  if (ar > 0.001) {
    const bump = Math.abs(Math.sin(l / 230)) * 22
    const k = clamp(ar)
    s += `<g transform="translate(${n2(FOLLOW_ICON[0] + 55 - bump * 0.6)} ${n2(FOLLOW_ICON[1] - 55 - bump * 0.8 - (1 - k) * 100)}) rotate(135)" opacity="${n2(k)}"><polygon points="0,0 -46,-44 -46,-20 -150,-20 -150,20 -46,20 -46,44" fill="url(#ss-av)" stroke="#fff" stroke-width="6" stroke-linejoin="round"/></g>`
    s += txt(330, 1390, '點左下角追蹤', 48, ACCENT, { anchor: 'middle', weight: 800, op: seg(l, 1500, 2000) })
  }
  return { bg: BG, body: decor(l) + s }
}
