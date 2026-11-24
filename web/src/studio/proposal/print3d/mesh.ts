// 簡易 3D 列印軟體的幾何:所有形狀都用「一圈一圈的多邊形」疊出來(由數學算出每一圈的點),
// 再把相鄰兩圈連成三角形、上下封口。單位是 mm,z 往上。純函式,有單元測試。

export type Vec = [number, number, number]
export type Tri = [Vec, Vec, Vec]

export type ShapeKind = 'prism' | 'box' | 'vase' | 'twist' | 'sphere' | 'cone' | 'star'
export interface ShapeParams {
  kind: ShapeKind
  /** 正多邊形的邊數(prism、twist、vase) */
  sides: number
  /** 半徑 mm(prism、twist、vase 的基本半徑) */
  radius: number
  height: number
  /** box 的寬、深 mm */
  width: number
  depth: number
  /** vase:波浪的振幅 mm 與週期數;頂部半徑的比例(錐度) */
  wave: number
  waves: number
  taper: number
  /** twist:從底到頂總共扭轉幾度 */
  twist: number
  /** star:內圈半徑占外圈的比例 */
  inner: number
  /** 壁厚 mm;0 = 實心,大於 0 = 挖空(頂部開口、底部有厚度一樣的底) */
  wall: number
  /** 整體縮放比例 */
  scale: number
}

export const DEFAULTS: ShapeParams = { kind: 'prism', sides: 6, radius: 20, height: 30, width: 40, depth: 25, wave: 4, waves: 2, taper: 0.8, twist: 90, inner: 0.5, wall: 0, scale: 1 }

/** 第 j 圈(高度 z)的點:正多邊形,半徑 r(z)、旋轉 θ(z) */
export function ringAt(p: ShapeParams, z: number): [number, number][] {
  if (p.kind === 'box') {
    const w = p.width / 2
    const d = p.depth / 2
    return [[-w, -d], [w, -d], [w, d], [-w, d]]
  }
  const t = p.height > 0 ? z / p.height : 0
  // 花瓶、球是旋轉體:邊數固定切細,看起來是圓的
  const round = p.kind === 'vase' || p.kind === 'sphere'
  const pts = Math.max(3, Math.round(p.sides))
  const n = round ? 64 : p.kind === 'star' ? pts * 2 : p.kind === 'cone' ? pts : pts
  let r = p.radius
  if (p.kind === 'vase') r = p.radius * (1 + (p.taper - 1) * t) + p.wave * Math.sin(2 * Math.PI * p.waves * t)
  if (p.kind === 'cone') r = p.radius * (1 + (p.taper - 1) * t)
  if (p.kind === 'sphere') r = p.radius * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2))
  const rot = p.kind === 'twist' || p.kind === 'star' ? (p.twist * t * Math.PI) / 180 : 0
  return [...Array(n)].map((_, i) => {
    const a = (2 * Math.PI * i) / n + rot
    const rr = Math.max(0.5, p.kind === 'star' && i % 2 === 1 ? r * p.inner : r)
    return [rr * Math.cos(a), rr * Math.sin(a)]
  })
}

/** 疊幾圈:直的形狀兩圈就夠,會變化的切細一點 */
export const ringsOf = (p: ShapeParams): number => (p.kind === 'vase' || p.kind === 'twist' || p.kind === 'sphere' || (p.kind === 'star' && p.twist > 0) ? 48 : 1)

export function buildMesh(p: ShapeParams): Tri[] {
  const steps = ringsOf(p)
  const rings = [...Array(steps + 1)].map((_, j) => {
    const z = (p.height * j) / steps
    return ringAt(p, z).map(([x, y]) => [x, y, z] as Vec)
  })
  const tris: Tri[] = []
  const n = rings[0].length
  for (let j = 0; j < steps; j++) {
    const a = rings[j]
    const b = rings[j + 1]
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n
      // 外側朝外(逆時針看進去)
      tris.push([a[i], a[k], b[k]], [a[i], b[k], b[i]])
    }
  }
  const bottom = rings[0]
  const top = rings[steps]
  const cb: Vec = [0, 0, 0]
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n
    tris.push([cb, bottom[k], bottom[i]])
  }
  if (p.wall > 0) {
    // 挖空:內壁(朝向內側)、內底、頂部的環形開口
    const floor = Math.min(Math.max(p.wall, 0.4), p.height * 0.5)
    const inner = [...Array(steps + 1)].map((_, j) => {
      const z = floor + ((p.height - floor) * j) / steps
      const ring = ringAt(p, z)
      const rmax = Math.max(...ring.map(([x, y]) => Math.hypot(x, y)))
      const k = Math.max(0.05, (rmax - p.wall) / rmax)
      return ring.map(([x, y]) => [x * k, y * k, z] as Vec)
    })
    for (let j = 0; j < steps; j++) {
      const a = inner[j]
      const b = inner[j + 1]
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n
        tris.push([a[i], b[k], a[k]], [a[i], b[i], b[k]])
      }
    }
    const cf: Vec = [0, 0, floor]
    const q = inner[steps]
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n
      tris.push([cf, inner[0][i], inner[0][k]], [top[i], top[k], q[k]], [top[i], q[k], q[i]])
    }
  } else {
    const ct: Vec = [0, 0, p.height]
    for (let i = 0; i < n; i++) tris.push([ct, top[i], top[(i + 1) % n]])
  }
  if (p.scale === 1) return tris
  return tris.map((t) => t.map((v) => [v[0] * p.scale, v[1] * p.scale, v[2] * p.scale] as Vec) as Tri)
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: Vec) => Math.hypot(a[0], a[1], a[2])

export const normal = (t: Tri): Vec => {
  const c = cross(sub(t[1], t[0]), sub(t[2], t[0]))
  const l = len(c) || 1
  return [c[0] / l, c[1] / l, c[2] / l]
}

/** 量測:外框尺寸、體積(mm³,用三角形和原點組成的四面體加總)、表面積(mm²) */
export function measure(tris: Tri[]): { size: Vec; volume: number; area: number } {
  let vol = 0
  let area = 0
  const lo: Vec = [Infinity, Infinity, Infinity]
  const hi: Vec = [-Infinity, -Infinity, -Infinity]
  for (const t of tris) {
    vol += dot(t[0], cross(t[1], t[2])) / 6
    area += len(cross(sub(t[1], t[0]), sub(t[2], t[0]))) / 2
    for (const v of t) for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], v[i])
      hi[i] = Math.max(hi[i], v[i])
    }
  }
  return { size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], volume: Math.abs(vol), area }
}

/** 懸空:面朝下、離開平台、與垂直的夾角超過 deg 度的三角形(列印時需要支撐) */
export function overhangs(tris: Tri[], deg = 45): { flags: boolean[]; area: number } {
  const lim = -Math.sin((deg * Math.PI) / 180)
  let area = 0
  const flags = tris.map((t) => {
    if (Math.max(t[0][2], t[1][2], t[2][2]) < 1e-6) return false // 貼著平台
    if (normal(t)[2] >= lim) return false
    area += len(cross(sub(t[1], t[0]), sub(t[2], t[0]))) / 2
    return true
  })
  return { flags, area }
}

/** 列印時間粗估(秒):實際擠出的塑料體積 ÷ 每秒約 8 mm³ */
export const printSeconds = (extrudedMm3: number): number => extrudedMm3 / 8

/** Wavefront OBJ(文字格式,Blender 等軟體都讀得懂) */
export function toObj(tris: Tri[], name = 'evoleap'): string {
  const lines = [`o ${name}`]
  tris.forEach((t) => t.forEach((v) => lines.push(`v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}`)))
  tris.forEach((_, i) => lines.push(`f ${i * 3 + 1} ${i * 3 + 2} ${i * 3 + 3}`))
  return lines.join('\n') + '\n'
}

/** 切片:高度 z 的水平面切過模型,回傳截面的線段(列印時一層就是沿著這些線走) */
export function sliceAt(tris: Tri[], z: number): [[number, number], [number, number]][] {
  const segs: [[number, number], [number, number]][] = []
  for (const t of tris) {
    const pts: [number, number][] = []
    for (let i = 0; i < 3; i++) {
      const a = t[i]
      const b = t[(i + 1) % 3]
      if ((a[2] - z) * (b[2] - z) < 0) {
        const u = (z - a[2]) / (b[2] - a[2])
        pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u])
      }
    }
    if (pts.length === 2) segs.push([pts[0], pts[1]])
  }
  return segs
}

/** 二進位 STL(切片軟體都讀得懂的格式) */
export function toStl(tris: Tri[], name = 'evoleap'): ArrayBuffer {
  const buf = new ArrayBuffer(84 + tris.length * 50)
  const dv = new DataView(buf)
  const head = new TextEncoder().encode(name.slice(0, 79))
  new Uint8Array(buf, 0, 80).set(head)
  dv.setUint32(80, tris.length, true)
  let o = 84
  for (const t of tris) {
    for (const v of [normal(t), ...t]) for (const c of v) {
      dv.setFloat32(o, c, true)
      o += 4
    }
    dv.setUint16(o, 0, true)
    o += 2
  }
  return buf
}

/** 這個形狀「用數學怎麼寫」:給畫面顯示 */
export function formulaOf(p: ShapeParams): string[] {
  const n = Math.max(3, Math.round(p.sides))
  switch (p.kind) {
    case 'box':
      return [`四個角:(±${p.width / 2}, ±${p.depth / 2})`, `體積 = 寬 × 深 × 高 = ${p.width} × ${p.depth} × ${p.height}`]
    case 'prism':
      return [`第 i 個點:( r·cos(2π·i/${n}), r·sin(2π·i/${n}) ),r = ${p.radius}`, `邊數越多越接近圓柱:π·r²·h ≈ ${(Math.PI * p.radius ** 2 * p.height / 1000).toFixed(2)} cm³`]
    case 'vase':
      return [`每一層的半徑 r(z) = ${p.radius}·(1 + (${p.taper} − 1)·z/h) + ${p.wave}·sin(2π·${p.waves}·z/h)`, `把一個函數繞著中心轉一圈,就是花瓶`]
    case 'sphere':
      return [`每一層的半徑 r(z) = ${p.radius}·√(1 − (2z/h − 1)²),h = ${p.height}`, `h = 2r 時是正球:體積 = 4/3·π·r³`]
    case 'cone':
      return [`每一層的半徑 r(z) = ${p.radius}·(1 + (${p.taper} − 1)·z/h)`, `${n} 邊形錐台:越往上越細(比例 ${p.taper}×)`]
    case 'star':
      return [`${n} 個尖角:奇數點的半徑 = ${p.radius} × ${p.inner}`, `扭轉 ${p.twist}° 時每層轉 θ(z) = ${p.twist}° × z/h`]
    case 'twist':
      return [`每一層轉 θ(z) = ${p.twist}° × z/h`, `同一個 ${n} 邊形,一層層疊上去時慢慢轉`]
  }
}
