// ai-tools-reel 的人物與場景插畫:半身像、桌上的道具、四種專業的小房間。全是純函式(時間進來、SVG 字串出去)。
import { circle, clamp, grp, hash, INK, lerp, n2, path, rect, seg, sparkle, tint } from './util'

export interface Look {
  skin: string
  hair: string
  style: 'bun' | 'bob' | 'short' | 'long' | 'wavy'
  top: string
  gear: 'cardigan' | 'tie' | 'scrubs' | 'vest'
  glasses?: boolean
  cap?: boolean
}

export const LOOKS = {
  /** 開場與收尾的主角:穿針織外套的文組上班族 */
  hero: { skin: '#f6cfae', hair: '#3b2a26', style: 'bob', top: '#f08a5d', gear: 'cardigan', glasses: true } as Look,
  teacher: { skin: '#f3c6a2', hair: '#4a2f27', style: 'bun', top: '#ef6f6c', gear: 'cardigan', glasses: true } as Look,
  nurse: { skin: '#eab890', hair: '#2d2a3a', style: 'long', top: '#3cc1b3', gear: 'scrubs', cap: false } as Look,
  lawyer: { skin: '#f6d2b4', hair: '#2b2b33', style: 'short', top: '#3d4a9c', gear: 'tie', glasses: false } as Look,
  historian: { skin: '#e8b48b', hair: '#6b6f78', style: 'wavy', top: '#a9743c', gear: 'vest', glasses: true } as Look,
}

/**
 * 半身像。(x, y) 是腰線的中心(身體在上方),s 為縮放;mood 0 = 疲憊、1 = 開心;t 是毫秒(搖晃、汗滴)。
 */
export function person(look: Look, x: number, y: number, s: number, mood: number, t: number): string {
  const tired = clamp(1 - mood * 1.4)
  const happy = clamp((mood - 0.45) / 0.4)
  const sway = Math.sin(t / 650) * 2.2 * tired + tired * 3
  const bob = Math.sin(t / 900) * 1.2
  const { skin, hair, style, top, gear } = look
  const shadeSkin = '#00000014'
  const out: string[] = []
  // 後髮
  if (style === 'long') out.push(path('M-76 -215 Q-92 -140 -84 -92 L84 -92 Q92 -140 76 -215 Z', hair))
  if (style === 'bob') out.push(path('M-77 -215 Q-86 -150 -70 -122 L70 -122 Q86 -150 77 -215 Z', hair))
  if (style === 'bun') out.push(circle(0, -298, 31, hair), circle(0, -298, 31, 'none', { stroke: '#ffffff22', sw: 3 }))
  if (style === 'wavy') out.push(path('M-78 -215 Q-92 -170 -74 -140 Q-70 -126 -62 -130 L62 -130 Q70 -126 74 -140 Q92 -170 78 -215 Z', hair))
  // 身體
  const body: string[] = []
  body.push(path('M-132 0 L-132 -62 Q-132 -122 -72 -130 L72 -130 Q132 -122 132 -62 L132 0 Z', top))
  body.push(path('M-132 -40 Q-132 -122 -72 -130 L-60 -130 Q-120 -110 -118 -40 Z', '#ffffff30'))
  if (gear === 'cardigan') {
    body.push(path('M-36 -130 L0 -84 L36 -130 Z', '#fff8ef'))
    body.push(path('M-36 -130 L0 -84 L-12 -130Z', '#00000010'))
    body.push(path('M0 -84 L0 0', 'none', { stroke: '#00000022', sw: 3 }))
    body.push(circle(-3, -50, 5, '#fff3e0'), circle(-3, -20, 5, '#fff3e0'))
  } else if (gear === 'tie') {
    body.push(path('M-40 -130 L0 -76 L40 -130 Z', '#ffffff'))
    body.push(path('M-72 -130 L-40 -130 L0 -30 L-30 0 L-132 0 L-132 -62 Q-132 -122 -72 -130Z', '#00000018'))
    body.push(path('M-9 -112 L9 -112 L14 -68 L0 -46 L-14 -68Z', '#e8576b'))
    body.push(path('M-40 -130 L-18 -124 L-4 -100 L-24 -92 Z', '#f2f2f2'), path('M40 -130 L18 -124 L4 -100 L24 -92 Z', '#f2f2f2'))
  } else if (gear === 'scrubs') {
    body.push(path('M-30 -130 L0 -90 L30 -130 Z', '#2a9d92'))
    body.push(rect(40, -64, 56, 30, '#ffffff', { rx: 6 }), rect(48, -54, 30, 5, '#9ee0d8', { rx: 2 }), rect(48, -44, 22, 4, '#c8ece7', { rx: 2 }))
  } else {
    body.push(path('M-36 -130 L0 -70 L36 -130 Z', '#fff3df'))
    body.push(path('M-90 -112 L-30 -100 L0 -70 L-24 0 L-132 0 L-132 -62Z', '#00000014'), path('M90 -112 L30 -100 L0 -70 L24 0 L132 0 L132 -62Z', '#00000014'))
    body.push(circle(-14, -46, 5, '#6b4a22'), circle(-14, -16, 5, '#6b4a22'))
  }
  // 頭與脖子
  const head: string[] = []
  head.push(rect(-23, -158, 46, 44, skin), rect(-23, -158, 46, 16, shadeSkin))
  head.push(circle(-68, -202, 12, skin), circle(68, -202, 12, skin))
  head.push(`<ellipse cx="0" cy="-205" rx="67" ry="73" fill="${skin}"/>`)
  // 臉
  const eyeY = -202
  const lid = lerp(8, 2.2, tired)
  for (const sx of [-1, 1]) {
    const ex = sx * 27
    if (happy > 0.6) head.push(path(`M${ex - 10} ${eyeY + 3} Q${ex} ${eyeY - 11} ${ex + 10} ${eyeY + 3}`, 'none', { stroke: INK, sw: 4.5 }))
    else {
      head.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="7" ry="${n2(lid)}" fill="${INK}"/>`)
      if (tired > 0.4) head.push(path(`M${ex - 11} ${eyeY - 5} L${ex + 11} ${eyeY - 5 + sx * 2}`, 'none', { stroke: skin, sw: 9 }), path(`M${ex - 10} ${eyeY + 13} Q${ex} ${eyeY + 17} ${ex + 10} ${eyeY + 13}`, 'none', { stroke: '#00000030', sw: 3 }))
    }
    const bt = -228 - happy * 2 - tired * (sx === 1 ? 0 : 3)
    head.push(path(`M${ex - 14} ${bt + 4 - tired * 5 * sx * -1} L${ex + 14} ${bt + 2 + tired * 5 * sx * -1}`, 'none', { stroke: look.hair, sw: 5 }))
  }
  head.push(path(`M-20 -166 Q0 ${n2(-166 + lerp(-11, 22, mood))} 20 -166`, happy > 0.5 ? '#fff' : 'none', { stroke: '#b9524f', sw: 4.5 }))
  if (happy > 0.2) head.push(circle(-44, -178, 11, '#ff8d8d', { op: 0.38 * happy }), circle(44, -178, 11, '#ff8d8d', { op: 0.38 * happy }))
  head.push(path('M-4 -190 Q0 -180 5 -190', 'none', { stroke: '#00000028', sw: 3 }))
  if (look.glasses) head.push(`<g fill="#ffffff33" stroke="#2c2c3a" stroke-width="4.5"><circle cx="-27" cy="${eyeY}" r="23"/><circle cx="27" cy="${eyeY}" r="23"/></g>`, path(`M-4 ${eyeY - 2} Q0 ${eyeY - 8} 4 ${eyeY - 2}`, 'none', { stroke: '#2c2c3a', sw: 4.5 }))
  // 前髮
  if (style === 'short') head.push(path('M-71 -205 Q-76 -296 0 -296 Q76 -296 71 -205 Q56 -240 22 -244 Q-32 -248 -71 -205Z', hair))
  else if (style === 'wavy') head.push(path('M-72 -200 Q-80 -296 0 -296 Q80 -296 72 -200 Q58 -246 24 -240 Q-6 -252 -26 -236 Q-52 -242 -72 -200Z', hair))
  else head.push(path('M-71 -205 Q-76 -296 0 -296 Q76 -296 71 -205 Q54 -250 8 -252 Q-36 -250 -71 -205Z', hair))
  head.push(path('M-30 -270 Q0 -282 34 -270', 'none', { stroke: '#ffffff30', sw: 6 }))
  if (look.cap) head.push(path('M-40 -286 L40 -286 L32 -258 L-32 -258 Z', '#fff'), path('M-8 -278 L8 -278 M0 -285 L0 -271', 'none', { stroke: '#ef5b6a', sw: 5 }))
  const sweat =
    tired > 0.5
      ? `<g transform="translate(74 ${n2(-250 + ((t / 11) % 60))})" opacity="${n2(0.9 - ((t / 11) % 60) / 80)}"><path d="M0 -12 Q9 2 0 9 Q-9 2 0 -12Z" fill="#8fd3ff"/></g>`
      : ''
  return grp(`<g transform="translate(0 ${n2(bob)})">${out.join('')}${body.join('')}<g transform="rotate(${n2(sway)} 0 -140)">${head.join('')}${sweat}</g></g>`, { x, y, s })
}

// ---------- 道具 ----------
/** 一疊作文紙(底邊在 (x, y)),n 張,top 為最上面那張的紅筆批改 */
export function essayStack(x: number, y: number, s: number, n: number, t: number): string {
  const sheets: string[] = []
  for (let i = 0; i < n; i++) {
    const h = hash(i + 7)
    const dx = (h - 0.5) * 14 + Math.sin(t / 1100 + i) * (i / n) * 3
    sheets.push(rect(-90 + dx, -(i + 1) * 15, 180, 13, i % 2 ? '#fffdf6' : '#fff7e3', { rx: 2, stroke: '#00000012', sw: 1.5 }))
    if (i % 3 === 0) sheets.push(rect(-72 + dx, -(i + 1) * 15 + 5, 70, 3, '#ef5b5b', { rx: 1.5 }))
  }
  const top = -(n + 1) * 15
  sheets.push(rect(-82, top + 1, 164, 2, '#00000010'))
  for (let r = 0; r < 3; r++) sheets.push(rect(-66, top - 4 - r * 0, 0, 0, 'none'))
  return grp(sheets.join(''), { x, y, s })
}

/** 密密麻麻的排班表(掛牆或平放),左上角在 (x, y) */
export function scheduleSheet(x: number, y: number, w: number, h: number, rot = 0): string {
  const cols = 9
  const rows = 11
  const cw = (w - 16) / cols
  const rh = (h - 36) / rows
  const colors = ['#ffd166', '#6c8cff', '#ff8fa3', '#e8e8f0', '#5ed1b5', '#b39cff']
  const cells: string[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(rect(8 + c * cw + 1.5, 28 + r * rh + 1.5, cw - 3, rh - 3, colors[Math.floor(hash(r * 31 + c) * colors.length)], { rx: 2.5 }))
  return grp(rect(0, 0, w, h, '#ffffff', { rx: 10, stroke: '#00000018', sw: 2 }) + rect(8, 8, w * 0.4, 12, '#3c3f58', { rx: 4 }) + cells.join(''), { x, y, rot, ox: w / 2, oy: h / 2 })
}

/** 一份厚厚的合約(夾子與頁緣),底邊中心在 (x, y) */
export function binder(x: number, y: number, s: number, color: string, thick = 70): string {
  const pages = []
  for (let i = 0; i < 9; i++) pages.push(rect(-92, -thick + 8 + i * ((thick - 14) / 9), 176, 2, '#d8d6cf'))
  return grp(
    rect(-100, -thick, 200, thick, color, { rx: 8 }) + rect(-92, -thick + 6, 184, thick - 12, '#fffdf8', { rx: 4 }) + pages.join('') + rect(-100, -thick, 14, thick, '#00000025', { rx: 4 }) + rect(34, -thick - 10, 40, 20, '#c8ccd8', { rx: 5 }),
    { x, y, s },
  )
}

export function mug(x: number, y: number, s: number, color = '#ffffff', t = 0): string {
  const steam = [0, 1].map((i) => path(`M${-8 + i * 16} -64 q-8 ${-12 + Math.sin(t / 500 + i) * 3} 0 -22 t0 -22`, 'none', { stroke: '#ffffff', sw: 4, op: 0.7 })).join('')
  return grp(`${steam}<rect x="-26" y="-52" width="52" height="52" rx="10" fill="${color}"/><path d="M26 -40 q22 2 22 18 q0 16 -22 16" fill="none" stroke="${color}" stroke-width="9"/><rect x="-26" y="-52" width="52" height="10" rx="5" fill="#00000012"/>`, { x, y, s })
}

export function plant(x: number, y: number, s: number, t: number): string {
  const leaves = [-38, -18, 4, 24, 42].map((a, i) => `<path d="M0 -40 Q${a * 1.6} ${-110 - (i % 2) * 24} ${a * 0.4 + Math.sin(t / 900 + i) * 2} ${-150 + (i % 2) * 16} Q${a * 0.1} -90 0 -40Z" fill="${i % 2 ? '#4fb286' : '#38a077'}"/>`).join('')
  return grp(leaves + path('M-30 -44 L30 -44 L22 0 L-22 0 Z', '#d9825b') + rect(-34, -52, 68, 14, '#e8946b', { rx: 6 }), { x, y, s })
}

export function lamp(x: number, y: number, s: number, on = 1): string {
  return grp(
    (on > 0 ? `<path d="M-70 -250 L-120 -60 L100 -60 L50 -250Z" fill="#fff3b0" opacity="${n2(0.28 * on)}"/>` : '') +
      path('M0 0 L0 -140 L40 -230', 'none', { stroke: '#4a4f6a', sw: 9 }) + path('M20 -250 L80 -240 L60 -208 L8 -222Z', '#f2a31b') + rect(-34, -12, 68, 12, '#4a4f6a', { rx: 5 }),
    { x, y, s },
  )
}

/** 書架上的一排書 */
export function books(x: number, y: number, n: number, seed = 1): string {
  const cols = ['#ef6f6c', '#f2a31b', '#4f5bd5', '#18b5a4', '#8e6bd8', '#f08a5d']
  let cx = 0
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const w = 18 + hash(seed + i) * 16
    const h = 70 + hash(seed * 3 + i) * 40
    out.push(rect(cx, -h, w, h, cols[Math.floor(hash(seed * 7 + i) * cols.length)], { rx: 3 }), rect(cx + 3, -h + 12, w - 6, 4, '#ffffff66', { rx: 2 }))
    cx += w + 3
  }
  return grp(out.join('') + rect(-8, 0, cx + 16, 12, '#c89968', { rx: 4 }), { x, y })
}

export function magnifier(x: number, y: number, s: number, rot = 0): string {
  return grp(path('M26 26 L70 70', 'none', { stroke: '#8a5a2b', sw: 12 }) + `<circle cx="0" cy="0" r="32" fill="#bfe8ff55" stroke="#c9a05a" stroke-width="9"/>` + path('M-16 -8 Q-8 -22 8 -22', 'none', { stroke: '#ffffff', sw: 5, op: 0.8 }), { x, y, s, rot })
}

export function redPen(x: number, y: number, rot: number): string {
  return grp(rect(-60, -5, 120, 10, '#e84a4a', { rx: 5 }) + path('M60 -5 L82 0 L60 5Z', '#f3c6a2') + rect(-60, -5, 22, 10, '#c43a3a', { rx: 5 }), { x, y, rot })
}

/** 一疊卡片(研究者桌上的紙條) */
export function noteCards(x: number, y: number, rot: number, color: string): string {
  return grp(rect(-60, -40, 120, 80, color, { rx: 8, stroke: '#00000014', sw: 2 }) + rect(-44, -22, 70, 6, '#00000022', { rx: 3 }) + rect(-44, -8, 88, 6, '#00000018', { rx: 3 }) + rect(-44, 6, 52, 6, '#00000018', { rx: 3 }), { x, y, rot })
}

/** 想法泡泡:icon 是泡泡裡的圖(以泡泡中心為原點);p 是出現的進度 */
export function thought(cx: number, cy: number, w: number, h: number, icon: string, p: number, t: number): string {
  if (p <= 0) return ''
  const e = clamp(p)
  const wob = Math.sin(t / 500) * 3
  const dots = [
    [-w * 0.34, h * 0.62, 9],
    [-w * 0.42, h * 0.86, 15],
  ]
  const tail = dots.map(([dx, dy, r], i) => circle(cx + dx, cy + dy, r * clamp(e * 2.4 - i * 0.5), '#ffffff', { stroke: '#e6dccd', sw: 3 })).join('')
  const cloud = `<ellipse cx="0" cy="0" rx="${n2(w / 2)}" ry="${n2(h / 2)}" fill="#fff" stroke="#e6dccd" stroke-width="4"/>` + [-0.32, 0, 0.32].map((k) => `<circle cx="${n2(w * k)}" cy="${n2(-h * 0.4)}" r="${n2(h * 0.22)}" fill="#fff" stroke="#e6dccd" stroke-width="4"/>`).join('') + `<ellipse cx="0" cy="0" rx="${n2(w / 2 - 2)}" ry="${n2(h / 2 - 2)}" fill="#fff"/>` + [-0.32, 0, 0.32].map((k) => `<circle cx="${n2(w * k)}" cy="${n2(-h * 0.4)}" r="${n2(h * 0.22 - 2)}" fill="#fff"/>`).join('')
  const k = outB(e)
  return tail + grp(cloud + icon, { x: cx, y: cy + wob, s: k })
}
const outB = (p: number): number => {
  const q = clamp(p)
  const c1 = 1.70158
  return 1 + (c1 + 1) * (q - 1) ** 3 + c1 * (q - 1) ** 2
}

/** 「要是有個工具」的圖示:小視窗 + 打勾 + 魔法棒,以 (0,0) 為中心 */
export function toolIcon(color = '#4f5bd5', t = 0, big = 1): string {
  const sp = (Math.sin(t / 300) + 1) / 2
  return grp(
    rect(-70, -52, 140, 104, '#f6f7ff', { rx: 14, stroke: color, sw: 6 }) +
      rect(-70, -52, 140, 26, color, { rx: 14 }) + rect(-70, -40, 140, 14, color) +
      [0, 1, 2].map((i) => rect(-52, -12 + i * 22, 56 - i * 8, 10, '#c9ceea', { rx: 5 }) + circle(34, -7 + i * 22, 9, '#3cc89a')).join('') +
      path('M66 -20 L82 -52 M70 -48 l6 4', 'none', { stroke: '#8a5a2b', sw: 7 }) +
      sparkle(88, -62, 14 + sp * 4, '#ffc83d') + sparkle(54, -64, 9, '#ff8fa3', 0.9),
    { s: big },
  )
}

// ---------- 房間 ----------
export interface Room {
  top: string
  bottom: string
  desk: string
}
export const ROOMS = {
  hero: { top: '#ffe9d2', bottom: '#ffd6b8', desk: '#c98f5b' } as Room,
  teacher: { top: '#ffe3dc', bottom: '#ffc9bd', desk: '#c98a5b' } as Room,
  nurse: { top: '#d9f5f0', bottom: '#b6e9e1', desk: '#d9c3a1' } as Room,
  lawyer: { top: '#e1e5ff', bottom: '#c6cdfb', desk: '#8c6a4a' } as Room,
  historian: { top: '#fdecc8', bottom: '#f7d99b', desk: '#a9743c' } as Room,
}

/** 房間底圖(870×1000 的局部座標):牆、窗光、桌面。桌面上緣在 y = 650 */
export function roomBack(r: Room, t: number): string {
  const rays = [0, 1, 2].map((i) => `<path d="M${150 + i * 90} 120 L${250 + i * 120} 650 L${190 + i * 120} 650 L${100 + i * 80} 120Z" fill="#ffffff" opacity="${n2(0.1 + 0.03 * Math.sin(t / 900 + i))}"/>`).join('')
  return (
    `<defs><linearGradient id="rm${r.top.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${r.top}"/><stop offset="1" stop-color="${r.bottom}"/></linearGradient></defs>` +
    rect(0, 0, 870, 1000, `url(#rm${r.top.slice(1)})`) +
    rect(70, 70, 190, 220, '#ffffff', { rx: 14, op: 0.7 }) + rect(82, 82, 166, 196, '#cfeaff', { rx: 8 }) + path('M165 82 L165 278 M82 180 L248 180', 'none', { stroke: '#ffffff', sw: 8 }) + circle(210, 124, 24, '#ffe28a') +
    rays
  )
}

export function roomDesk(r: Room): string {
  return rect(0, 650, 870, 350, r.desk) + rect(0, 650, 870, 22, '#ffffff30') + rect(0, 672, 870, 8, '#00000018') + rect(0, 700, 870, 300, '#00000012')
}

export function sparkles(cx: number, cy: number, n: number, spread: number, p: number, t: number, colors = ['#ffc83d', '#ff8fa3', '#6dd5c4', '#8fa2ff']): string {
  const o: string[] = []
  for (let i = 0; i < n; i++) {
    const a = hash(i * 5 + 1) * Math.PI * 2
    const d = (0.55 + hash(i * 5 + 2) * 0.6) * spread * outBackSoft(p)
    const tw = 0.6 + 0.4 * Math.sin(t / 260 + i * 2)
    o.push(sparkle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, (10 + hash(i * 5 + 3) * 14) * clamp(p * 3) * tw, colors[i % colors.length], clamp(p * 3) * (1 - seg(p, 0.7, 1) * 0.6), hash(i) * 40))
  }
  return o.join('')
}
const outBackSoft = (p: number): number => 1 - (1 - clamp(p)) ** 3

export { seg, tint }
