// ai-tools-reel 的共用小工具:全是純函式(時間進來、SVG 字串出去),不用亂數、不讀時鐘。
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
/** 先快後慢的彈出(0 → 1,略微超過) */
export const pop = (l: number, a: number, dur = 450): number => outBack(seg(l, a, a + dur))
export const n2 = (x: number): string => (Math.round(x * 100) / 100).toString()
export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 決定性的假亂數(同一個 seed 永遠同一個值,0–1) */
export function hash(seed: number): number {
  let h = (seed | 0) ^ 0x9e3779b9
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export const INK = '#2a2f45'
export const SANS = "'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif"
export const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'Noto Sans Mono',monospace"

/** 工具的代表色 */
export const ACCENT = { teacher: '#ff6b5b', nurse: '#18b5a4', lawyer: '#4f5bd5', historian: '#f2a31b' } as const

export function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  const q = clamp(t)
  return `rgb(${Math.round(lerp(x[0], y[0], q))},${Math.round(lerp(x[1], y[1], q))},${Math.round(lerp(x[2], y[2], q))})`
}
/** 淡色(和白色混) */
export const tint = (c: string, t = 0.85): string => mix(c, '#ffffff', t)

/** 群組:位移、縮放(以 (ox, oy) 為中心)、透明度 */
export function grp(inner: string, o: { x?: number; y?: number; s?: number; op?: number; rot?: number; ox?: number; oy?: number } = {}): string {
  const { x = 0, y = 0, s = 1, op = 1, rot = 0, ox = 0, oy = 0 } = o
  if (op <= 0.001) return ''
  const t = `translate(${n2(x + ox)} ${n2(y + oy)})${rot ? ` rotate(${n2(rot)})` : ''}${s !== 1 ? ` scale(${n2(s)})` : ''}${ox || oy ? ` translate(${n2(-ox)} ${n2(-oy)})` : ''}`
  return `<g transform="${t}"${op < 0.999 ? ` opacity="${n2(op)}"` : ''}>${inner}</g>`
}

export const text = (s: string, x: number, y: number, size: number, o: { fill?: string; weight?: number; anchor?: 'start' | 'middle' | 'end'; font?: string; op?: number; spacing?: number } = {}): string =>
  `<text x="${n2(x)}" y="${n2(y)}" font-size="${size}" font-weight="${o.weight ?? 500}" fill="${o.fill ?? INK}" text-anchor="${o.anchor ?? 'start'}" font-family="${o.font ?? SANS}"${o.op !== undefined && o.op < 1 ? ` opacity="${n2(o.op)}"` : ''}${o.spacing ? ` letter-spacing="${o.spacing}"` : ''}>${esc(s)}</text>`

export const rect = (x: number, y: number, w: number, h: number, fill: string, o: { rx?: number; stroke?: string; sw?: number; op?: number; extra?: string } = {}): string =>
  `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(Math.max(0, w))}" height="${n2(Math.max(0, h))}" rx="${o.rx ?? 0}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"` : ''}${o.op !== undefined && o.op < 1 ? ` opacity="${n2(o.op)}"` : ''}${o.extra ? ` ${o.extra}` : ''}/>`

export const circle = (cx: number, cy: number, r: number, fill: string, o: { stroke?: string; sw?: number; op?: number } = {}): string =>
  `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(Math.max(0, r))}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"` : ''}${o.op !== undefined && o.op < 1 ? ` opacity="${n2(o.op)}"` : ''}/>`

export const path = (d: string, fill: string, o: { stroke?: string; sw?: number; op?: number; cap?: boolean } = {}): string =>
  `<path d="${d}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"${o.cap === false ? '' : ' stroke-linecap="round" stroke-linejoin="round"'}` : ''}${o.op !== undefined && o.op < 1 ? ` opacity="${n2(o.op)}"` : ''}/>`

/** 閃光(四角星),r 為外半徑 */
export function sparkle(cx: number, cy: number, r: number, fill = '#ffc83d', op = 1, rot = 0): string {
  if (op <= 0.01 || r <= 0.1) return ''
  const d = `M0 ${-r} Q${n2(r * 0.18)} ${n2(-r * 0.18)} ${r} 0 Q${n2(r * 0.18)} ${n2(r * 0.18)} 0 ${r} Q${n2(-r * 0.18)} ${n2(r * 0.18)} ${-r} 0 Q${n2(-r * 0.18)} ${n2(-r * 0.18)} 0 ${-r}Z`
  return `<g transform="translate(${n2(cx)} ${n2(cy)}) rotate(${n2(rot)})" opacity="${n2(op)}"><path d="${d}" fill="${fill}"/></g>`
}

/** 虛擬滑鼠游標(尖端在 (x, y));press 0–1 按下去時縮小一點 */
export function cursor(x: number, y: number, press = 0): string {
  return `<g transform="translate(${n2(x)} ${n2(y)}) scale(${n2(1 - press * 0.12)})"><path d="M0 0 L0 38 L10 29 L17 44 L24 41 L17 27 L30 27 Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>${press > 0.05 ? `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(14 + press * 22)}" fill="none" stroke="${INK}" stroke-width="3" opacity="${n2(0.5 * (1 - press))}"/>` : ''}`
}

/** 在 [(l0,p0),(l1,p1)...] 之間補間(線性,時間在範圍外取兩端) */
export function track(l: number, keys: [number, number][]): number {
  if (l <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    if (l <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], inOutCubic((l - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])))
  }
  return keys[keys.length - 1][1]
}
