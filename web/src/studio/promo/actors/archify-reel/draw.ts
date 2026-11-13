// archify-reel 的共用繪圖小工具:全是純函式(時間進來、SVG 字串出去),不用亂數、不讀時鐘。
export const W = 1080
export const H = 1920

export const clamp = (x: number, a = 0, b = 1): number => Math.min(b, Math.max(a, x))
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p
/** l 在 [a, b] 之間的進度 0–1 */
export const seg = (l: number, a: number, b: number): number => clamp((l - a) / (b - a))
export const outCubic = (p: number): number => 1 - (1 - clamp(p)) ** 3
export const inOutCubic = (p: number): number => {
  const q = clamp(p)
  return q < 0.5 ? 4 * q ** 3 : 1 - (-2 * q + 2) ** 3 / 2
}
export const outBack = (p: number): number => {
  const q = clamp(p)
  const c1 = 1.70158
  return 1 + (c1 + 1) * (q - 1) ** 3 + c1 * (q - 1) ** 2
}
export const n2 = (x: number): string => (Math.round(x * 100) / 100).toString()

/** 決定性的假亂數(同一個 seed 永遠同一個值,0–1) */
export function hash(seed: number): number {
  let h = (seed | 0) ^ 0x9e3779b9
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------- 顏色 ----------
export function rgb(hex: string): [number, number, number] {
  const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(hex)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  const q = clamp(t)
  return `rgb(${Math.round(lerp(x[0], y[0], q))},${Math.round(lerp(x[1], y[1], q))},${Math.round(lerp(x[2], y[2], q))})`
}

export const INK = '#14213d'
export const SANS = "'Noto Sans TC','PingFang TC','Microsoft JhengHei',Inter,system-ui,sans-serif"
export const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'Noto Sans Mono',monospace"
export const SERIF = "'Noto Serif TC',Georgia,'Times New Roman',serif"

// ---------- 圖形 ----------
export function starPts(cx: number, cy: number, r: number, rot = 0): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.42 : r
    pts.push(`${n2(cx + Math.cos(a) * rr)},${n2(cy + Math.sin(a) * rr)}`)
  }
  return pts.join(' ')
}
export const star = (cx: number, cy: number, r: number, fill = '#f5b301', op = 1, rot = 0): string =>
  `<polygon points="${starPts(cx, cy, r, rot)}" fill="${fill}" opacity="${n2(op)}" stroke-linejoin="round"/>`

/** GitHub 風格的分岔(fork)圖示,左上角 (x,y),大小 s */
export function forkIcon(x: number, y: number, s: number, color: string): string {
  const u = s / 16
  const c = (cx: number, cy: number): string => `<circle cx="${cx}" cy="${cy}" r="2" fill="none" stroke="${color}" stroke-width="1.6"/>`
  return `<g transform="translate(${n2(x)} ${n2(y)}) scale(${n2(u)})">${c(4, 3)}${c(12, 3)}${c(8, 13)}<path d="M4 5 V7 Q4 9 6 9 H10 Q12 9 12 7 V5 M8 9 V11" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/></g>`
}

/** 儲存庫(書本)圖示 */
export function repoIcon(x: number, y: number, s: number, color: string): string {
  const u = s / 16
  return `<g transform="translate(${n2(x)} ${n2(y)}) scale(${n2(u)})"><path d="M3 2.5 H12.5 V13.5 H4.5 A1.5 1.5 0 0 1 3 12 Z M3 12 A1.5 1.5 0 0 1 4.5 10.5 H12.5" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/></g>`
}

/** 圓角節點方塊(中心 cx,cy) */
export function nodeBox(cx: number, cy: number, w: number, h: number, label: string, o: { fill: string; stroke: string; text: string; sw?: number; fs?: number; op?: number; sc?: number; font?: string }): string {
  const sc = o.sc ?? 1
  return `<g opacity="${n2(o.op ?? 1)}" transform="translate(${n2(cx)} ${n2(cy)}) scale(${n2(sc)})"><rect x="${n2(-w / 2)}" y="${n2(-h / 2)}" width="${w}" height="${h}" rx="18" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.sw ?? 3}"/><text x="0" y="${n2((o.fs ?? 30) * 0.36)}" text-anchor="middle" font-family="${o.font ?? SANS}" font-size="${o.fs ?? 30}" font-weight="600" fill="${o.text}">${esc(label)}</text></g>`
}

/** 線(a→b)畫到 p(0–1),可帶箭頭 */
export function line(a: [number, number], b: [number, number], p: number, color: string, sw = 4, arrow = true): string {
  if (p <= 0) return ''
  const x = lerp(a[0], b[0], p)
  const y = lerp(a[1], b[1], p)
  let s = `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(x)}" y2="${n2(y)}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`
  if (arrow && p >= 1) {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
    const L = sw * 4.2
    const p1 = [b[0] - Math.cos(ang - 0.45) * L, b[1] - Math.sin(ang - 0.45) * L]
    const p2 = [b[0] - Math.cos(ang + 0.45) * L, b[1] - Math.sin(ang + 0.45) * L]
    s += `<polygon points="${n2(b[0])},${n2(b[1])} ${n2(p1[0])},${n2(p1[1])} ${n2(p2[0])},${n2(p2[1])}" fill="${color}"/>`
  }
  return s
}

/** 游標(箭頭),尖端在 x,y */
export function cursor(x: number, y: number, press = 0, op = 1): string {
  const s = 1 - press * 0.12
  return `<g opacity="${n2(op)}" transform="translate(${n2(x)} ${n2(y)}) scale(${n2(s)})"><path d="M0 0 L0 38 L10 29 L17 44 L25 40 L18 26 L31 25 Z" fill="#111827" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></g>`
}

/** 多個關鍵點之間內插(at 為毫秒或進度,皆可) */
export function path2(l: number, keys: { at: number; x: number; y: number }[]): [number, number] {
  if (l <= keys[0].at) return [keys[0].x, keys[0].y]
  for (let i = 1; i < keys.length; i++) {
    if (l <= keys[i].at) {
      const q = inOutCubic(seg(l, keys[i - 1].at, keys[i].at))
      return [lerp(keys[i - 1].x, keys[i].x, q), lerp(keys[i - 1].y, keys[i].y, q)]
    }
  }
  const k = keys[keys.length - 1]
  return [k.x, k.y]
}

export interface SceneOut {
  bg: string
  body: string
}
