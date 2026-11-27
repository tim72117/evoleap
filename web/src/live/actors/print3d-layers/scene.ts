// print3d-layers 的立體畫法:全部用 mm 的世界座標(x 右、y 往後、z 往上)描述,再用同一個斜角正投影畫成 SVG,
// 所以 X(橫桿)、Y(熱床滑軌)、Z(絲桿)三個方向的機構前後關係一致。純函式。

export type V = readonly [x: number, y: number, z: number]
const YAW = 0.6
const PITCH = 0.48
export const SCALE = 5
const cy = Math.cos(YAW)
const sy = Math.sin(YAW)
const cp = Math.cos(PITCH)
const sp = Math.sin(PITCH)

/** 世界座標 → 畫面座標 */
export const project = ([x, y, z]: V): [number, number] => [(x * cy - y * sy) * SCALE, -(z * cp + (x * sy + y * cy) * sp) * SCALE]

const f = (n: number) => n.toFixed(1)
export const path = (pts: V[], close = true): string => pts.map((p, i) => `${i ? 'L' : 'M'}${project(p).map(f).join(' ')}`).join('') + (close ? 'Z' : '')
export const poly = (pts: V[], cls: string) => `<path class="${cls}" d="${path(pts)}"/>`
export const line = (a: V, b: V, cls: string) => `<path class="${cls}" d="${path([a, b], false)}"/>`

/** 長方體:看得到的三面(頂、前 -y、左 -x),同一個材質用三種深淺 */
export function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: string): string {
  return (
    poly([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], `m-${mat} f-side`) +
    poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], `m-${mat} f-front`) +
    poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], `m-${mat} f-top`)
  )
}

/** 水平圓盤上的點 */
const ring = (r: number, z: number, from: number, to: number, n: number): V[] => Array.from({ length: n + 1 }, (_, i) => {
  const a = from + ((to - from) * i) / n
  return [r * Math.cos(a), r * Math.sin(a), z]
})
/** 朝著觀看者那一半的中心角度 */
const FRONT = Math.atan2(-cy, -sy)

/** 一層(圓盤或方塊),中心在原點;回傳側面與頂面的路徑 */
export function slab(shape: 'dome' | 'block', half: number, z0: number, z1: number): { side: string; top: string } {
  if (shape === 'block') {
    const h = half
    return {
      side: path([[-h, h, z0], [-h, -h, z0], [h, -h, z0], [h, -h, z1], [-h, -h, z1], [-h, h, z1]]),
      top: path([[-h, -h, z1], [h, -h, z1], [h, h, z1], [-h, h, z1]]),
    }
  }
  const lower = ring(half, z0, FRONT - Math.PI / 2, FRONT + Math.PI / 2, 24)
  const upper = ring(half, z1, FRONT + Math.PI / 2, FRONT - Math.PI / 2, 24)
  return { side: path([...lower, ...upper]), top: path(ring(half, z1, 0, Math.PI * 2, 48)) }
}

// ---------- 列印機尺寸(mm) ----------
export const BED = { half: 40, thick: 3 }
/** 兩根立柱的 x、龍門架的 y(比模型中心後面一點)、立柱高 */
export const GANTRY = { x: 62, y: 12, top: 66 }
/** 噴嘴尖到橫桿中心 */
export const BEAM_UP = 15
export const SPOOL_AT: V = [40, GANTRY.y, GANTRY.top + 20]

/** 底下不動的部分:地面影子、底座框、Y 軸滑軌與馬達、皮帶 */
export function baseSvg(): string {
  const slot = (x: number) => line([x, -66, -12], [x, 66, -12], 'p-groove')
  return [
    poly([[-78, -76, -22], [78, -76, -22], [78, 72, -22], [-78, 72, -22]], 'p-shadow'),
    // 後橫樑、左右兩條邊框(沿 Y)
    box(-68, 68, 56, 66, -20, -12, 'alu'),
    box(-68, -56, -66, 56, -20, -12, 'alu'),
    slot(-62),
    box(56, 68, -66, 56, -20, -12, 'alu'),
    slot(62),
    // Y 軸馬達(後端)
    box(-9, 9, 68, 84, -22, -4, 'motor'),
    // Y 軸滑軌:從前到後兩根亮面圓桿 + 中間的皮帶
    box(-26, -20, -72, 70, -12, -8, 'steel'),
    line([0, -70, -10], [0, 70, -10], 'p-belt'),
    box(20, 26, -72, 70, -12, -8, 'steel'),
    // 前橫樑
    box(-68, 68, -76, -66, -20, -12, 'alu'),
  ].join('')
}

/** 熱床(會沿 Y 移動):滑塊、床板、四個調平旋鈕、格線 */
export function bedSvg(): string {
  const h = BED.half
  const grid = [-24, -8, 8, 24].map((v) => line([v, -h, 0], [v, h, 0], 'p-grid') + line([-h, v, 0], [h, v, 0], 'p-grid')).join('')
  const knob = (x: number, y: number) => box(x - 3, x + 3, y - 3, y + 3, -7, -BED.thick, 'knob')
  return [
    box(-30, 30, -22, 22, -8, -6, 'motor'),
    knob(-h + 5, h - 5),
    knob(h - 5, h - 5),
    knob(-h + 5, -h + 5),
    knob(h - 5, -h + 5),
    box(-h, h, -h, h, -BED.thick, 0, 'bed'),
    grid,
  ].join('')
}

/** 立柱、Z 軸絲桿與馬達、頂樑、線材捲 */
export function frameSvg(): string {
  const { x, y, top } = GANTRY
  const upright = (s: -1 | 1) => box(s * x - 5, s * x + 5, y - 5, y + 5, -12, top, 'alu') + line([s * x, y - 5.1, -10], [s * x, y - 5.1, top - 2], 'p-groove')
  const screw = (s: -1 | 1) => {
    const sx = s * (x - 10)
    return (
      box(sx - 6, sx + 6, y - 6, y + 6, -12, 1, 'motor') +
      box(sx - 3, sx + 3, y - 3, y + 3, 1, 5, 'steel') +
      line([sx, y, 5], [sx, y, top], 'p-screw') +
      `<path class="p-thread" d="${path([[sx, y, 5], [sx, y, top]], false)}"/>`
    )
  }
  const [px, py] = project(SPOOL_AT)
  return [
    upright(-1),
    screw(-1),
    screw(1),
    upright(1),
    box(-x - 5, x + 5, y - 5, y + 5, top, top + 8, 'alu'),
    box(SPOOL_AT[0] - 3, SPOOL_AT[0] + 3, y - 3, y + 3, top + 8, top + 20, 'motor'),
    `<g class="p-spool"><ellipse class="p-flange-back" cx="${f(px + 26)}" cy="${f(py - 8)}" rx="52" ry="58"/><ellipse class="p-flange" cx="${f(px)}" cy="${f(py)}" rx="52" ry="58"/><ellipse class="p-roll" cx="${f(px)}" cy="${f(py)}" rx="36" ry="41"/><ellipse class="p-hub" cx="${f(px)}" cy="${f(py)}" rx="14" ry="16"/><path class="p-spokes" d="M${f(px - 11)} ${f(py)}h22M${f(px)} ${f(py - 12)}v24"/></g>`,
  ].join('')
}

/** X 軸橫桿(高度為原點的 z=0):兩端滑塊套在立柱與絲桿上、橫桿、皮帶、X 軸馬達 */
export function beamSvg(): string {
  const { x, y } = GANTRY
  const end = (s: -1 | 1) => box(Math.min(s * (x - 14), s * (x + 7)), Math.max(s * (x - 14), s * (x + 7)), y - 8, y + 7, -7, 7, 'motor')
  return [
    box(-x - 18, -x - 4, y - 8, y + 8, -8, 8, 'motor'),
    end(-1),
    box(-x + 7, x - 14, y - 4, y + 4, -4, 4, 'steel'),
    line([-x + 7, y - 4.1, 1.5], [x - 14, y - 4.1, 1.5], 'p-belt'),
    line([-x + 7, y - 4.1, -1.5], [x - 14, y - 4.1, -1.5], 'p-groove'),
    end(1),
  ].join('')
}

/** 噴頭組,原點是噴嘴尖:噴嘴、加熱塊、散熱片、外殼與風扇(風扇葉片由演員轉動) */
export function headSvg(): string {
  const fan = project([0, -7, 17])
  return [
    box(-6, 6, 4, GANTRY.y - 4, 10, 22, 'steel'),
    poly([[-2.4, -1, 3], [2.4, -1, 3], [0.6, 0, 0], [-0.6, 0, 0]], 'p-brass'),
    box(-4, 4, -3, 3, 3, 7, 'steel'),
    box(-3, 3, -3, 3, 7, 10, 'fins'),
    box(-8, 8, -7, 5, 10, 25, 'shell'),
    `<ellipse class="p-fan-hole" cx="${f(fan[0])}" cy="${f(fan[1])}" rx="25" ry="28"/>`,
    `<g transform="translate(${f(fan[0])} ${f(fan[1])})"><g class="p-fan"><path d="M0 0C-5 -16 10 -25 18 -17C10 -12 5 -7 0 0ZM0 0C16 5 16 23 6 27C5 17 3 8 0 0ZM0 0C-11 11 -28 5 -25 -7C-16 -2 -9 1 0 0Z"/></g><circle class="p-fan-hub" r="6"/></g>`,
    box(-4, 4, -3, 3, 25, 29, 'motor'),
  ].join('')
}

/** 右前方的控制盒:正面有螢幕與旋鈕 */
export function controlSvg(): string {
  const front = (x: number, z: number): V => [x, -84.1, z]
  const [lx, ly] = project(front(20, -9))
  const skew = f((Math.atan2(-Math.sin(YAW) * sp, Math.cos(YAW)) * 180) / Math.PI)
  const squeeze = Math.hypot(cy, sy * sp)
  return [
    box(14, 78, -84, -72, -24, -6, 'motor'),
    `<g transform="translate(${f(lx)} ${f(ly)}) skewY(${skew}) scale(${squeeze.toFixed(3)} 1)"><rect class="p-lcd" x="0" y="0" width="250" height="48" rx="4"/><text class="p-lcd-text" x="125" y="32" text-anchor="middle">噴頭 200°C　熱床 60°C</text><circle class="p-knob-body" cx="284" cy="24" r="18"/><path class="p-knob" d="M284 24V10"/></g>`,
  ].join('')
}

/** 一組世界座標點在畫面上的外框(給聚光燈當目標) */
export function bounds(pts: V[]): { x: number; y: number; w: number; h: number } {
  const p = pts.map(project)
  const xs = p.map((q) => q[0])
  const ys = p.map((q) => q[1])
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}
