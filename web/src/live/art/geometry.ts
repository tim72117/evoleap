// art/geometry:純幾何(沒有狀態、不碰 DOM):點、膠囊、兩節手臂 IK、四邊形上的透視對應。
// 座標都是 1920×1080 舞台的 px;只依賴 kit 的 lerp / clamp。
import { kit } from '../kit'

export type Pt = { x: number; y: number }
/** 四邊形的四個角(左上、右上、右下、左下),例如桌上的鍵盤、斜放的螢幕 */
export type Quad = { tl: Pt; tr: Pt; br: Pt; bl: Pt }

/** 小數一位(SVG 路徑用) */
export const f1 = (n: number): string => n.toFixed(1)

/** 雙線性內插:四邊形上 (u, v) 的位置(u:左→右、v:上→下,都是 0–1);(0,0)=tl、(1,0)=tr、(1,1)=br、(0,1)=bl */
export function onQuad(q: Quad, u: number, v: number): Pt {
  const top = { x: kit.lerp(q.tl.x, q.tr.x, u), y: kit.lerp(q.tl.y, q.tr.y, u) }
  const bot = { x: kit.lerp(q.bl.x, q.br.x, u), y: kit.lerp(q.bl.y, q.br.y, u) }
  return { x: kit.lerp(top.x, bot.x, v), y: kit.lerp(top.y, bot.y, v) }
}

/** 兩節手臂(IK):肩膀 s、手腕目標 t、上臂 a、前臂 b;bend = 1 手肘往下彎。回傳手肘與(夠不到時拉到最遠的)手腕 */
export function solveArm(s: Pt, t: Pt, a: number, b: number, bend = 1): { elbow: Pt; wrist: Pt } {
  const dx = t.x - s.x
  const dy = t.y - s.y
  const d0 = Math.hypot(dx, dy)
  const d = kit.clamp(d0, Math.abs(a - b) + 1, a + b - 0.5)
  const ux = dx / (d0 || 1)
  const uy = dy / (d0 || 1)
  const wrist = { x: s.x + ux * d, y: s.y + uy * d }
  const along = (a * a - b * b + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, a * a - along * along))
  // 法向量:取 y 比較大(往下)的那一邊
  let nx = -uy
  let ny = ux
  if (ny * bend < 0) {
    nx = -nx
    ny = -ny
  }
  return { elbow: { x: s.x + ux * along + nx * h, y: s.y + uy * along + ny * h }, wrist }
}

/** 兩端半徑不同的膠囊(手臂一節)的 SVG path */
export function capsule(a: Pt, b: Pt, ra: number, rb: number): string {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const L = Math.hypot(dx, dy) || 1
  const nx = -dy / L
  const ny = dx / L
  return (
    `M${f1(a.x + nx * ra)} ${f1(a.y + ny * ra)} L${f1(b.x + nx * rb)} ${f1(b.y + ny * rb)} ` +
    `A${f1(rb)} ${f1(rb)} 0 0 1 ${f1(b.x - nx * rb)} ${f1(b.y - ny * rb)} ` +
    `L${f1(a.x - nx * ra)} ${f1(a.y - ny * ra)} A${f1(ra)} ${f1(ra)} 0 0 1 ${f1(a.x + nx * ra)} ${f1(a.y + ny * ra)}Z`
  )
}

/** 膠囊靠光那一側的反光線(光從左上來) */
export function capsuleShine(a: Pt, b: Pt, ra: number, rb: number, k = 0.62): string {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const L = Math.hypot(dx, dy) || 1
  let nx = -dy / L
  let ny = dx / L
  if (nx * -0.7 + ny * -0.7 < 0) {
    nx = -nx
    ny = -ny
  }
  const p = (q: Pt, r: number, t: number): string => `${f1(q.x + nx * r * k + (dx / L) * t)} ${f1(q.y + ny * r * k + (dy / L) * t)}`
  return `M${p(a, ra, ra * 0.3)} L${p(b, rb, -rb * 0.3)}`
}
