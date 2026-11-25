// trellis-reel 的 3D 示意:一座大理石半身像(Marble Bust 01,CC0,體素化後約 3.2 萬個格子),畫在 2D canvas 上。
// 三種畫法(同一份資料、同一個繪製函式):
//   'hook' / 'voxel':方格堆出形狀 → 修邊 → 切細(16→32→64→128 格)→ 修細節(上貼圖色)→ 平滑著色。每格有各自的延遲與 ease-in-out,沒有跳格。
//   'flow':整團積木從頭到尾都在,位置與顏色一開始是亂的(霧),三段同時往正確的地方收攏(16 → 64 → 128 格 + 上色),最後平滑著色。
// 這是 2D 近似,沒有真正的網格 shader:「平滑著色」= 最細一層的格子縮成略大的面片、換成法線平滑明暗與光澤、去掉格子邊線,再輕輕模糊。
// 軟體光柵(Uint32Array 像素緩衝,由遠到近排序),純函式、不用亂數、不讀時鐘;呼叫端(actor.ts)把緩衝用 putImageData 貼到 canvas。
import { LEVELS, N, BASE, R1, R2, R3, RX, RY, VX, VY, VZ, VNX, VNY, VNZ, GX, GY, GZ } from './bust'
import { clamp, hash, inOutCubic, lerp, outBack, seg } from './draw'

/** 建構動畫(hook / voxel)的進度 */
export interface Tl {
  /** 目前顯示哪一層(0–3 = 16 / 32 / 64 / 128 格) */
  lv: 0 | 1 | 2 | 3
  /** 0–1:出現(最粗的方格長出來) */
  ap: number
  /** 0–1:這一層由上一層切細 */
  sp: number
  /** 0–1:這一層修邊 */
  rf: number
  /** 0–1:修細節(上貼圖色) */
  col: number
  /** 0–1:平滑著色(網格質感) */
  sm: number
}
export type Win = [number, number]
export interface TlWin {
  ap: Win
  sp: [Win, Win, Win]
  rf: [Win, Win, Win, Win]
  col: Win
  sm: Win
}
/** 時間窗(0–1 的進度)→ 各項進度 */
export function timeline(p: number, w: TlWin): Tl {
  const lv = p < w.sp[0][0] ? 0 : p < w.sp[1][0] ? 1 : p < w.sp[2][0] ? 2 : 3
  return {
    lv,
    ap: seg(p, w.ap[0], w.ap[1]),
    sp: lv > 0 ? seg(p, w.sp[lv - 1][0], w.sp[lv - 1][1]) : 1,
    rf: seg(p, w.rf[lv][0], w.rf[lv][1]),
    col: lv === 3 ? seg(p, w.col[0], w.col[1]) : 0,
    sm: seg(p, w.sm[0], w.sm[1]),
  }
}
/** 完成狀態(最細一層,已修邊、已上色);sm 是平滑著色的程度 */
export const doneTl = (sm: number): Tl => ({ lv: 3, ap: 1, sp: 1, rf: 1, col: 1, sm })

export interface Phase {
  /** 0–1:整團被壓縮打包(縮小) */
  pack: number
  /** 0–1:散成一團霧 */
  scatter: number
  /** 0–1:三段凝聚各自的進度 */
  e1: number
  e2: number
  e3: number
  /** 0–1:平滑著色 */
  sm: number
}
export interface Region {
  x: number
  y: number
  w: number
  h: number
}
export interface MeshSpec {
  mode: 'flow' | 'voxel' | 'hook'
  l: number
  /** 畫在舞台上的哪一塊(舞台座標) */
  region: Region
  /** 模型中心(舞台座標)與縮放:128 格的一格 = S 像素 */
  cx: number
  cy: number
  S: number
  /** 霧散開的範圍(舞台座標) */
  box: { x0: number; x1: number; y0: number; y1: number }
  ph?: Phase
  tl?: Tl
  /** voxel:dots 格線出現、fade 空格子淡出、grow 有東西的格子長成方塊 */
  vx?: { dots: number; fade: number; grow: number }
}

const BG: [number, number, number] = [248, 250, 252]
const FOGC: [number, number, number][] = [[199, 210, 254], [226, 232, 240], [221, 214, 254], [203, 213, 225]]
const JIT: [number, number, number][] = [[245, 158, 11], [99, 102, 241], [20, 184, 166], [236, 72, 153], [100, 116, 139]]
const STRUCT: [number, number, number] = [165, 180, 252]
const CLAYC: [number, number, number] = [203, 213, 225]
const YAW = 0.3
const PHI = 0.14
const LX = -0.45
const LY = 0.75
const LZ = 0.55
const LN = Math.hypot(LX, LY, LZ)
// 半向量(光與視線的中間),算光澤用
const HX = LX / LN
const HY = LY / LN
const HZ = LZ / LN + 1
const HN = Math.hypot(HX, HY, HZ)
/** 緩慢左右擺動的角度(從 0 開始,與輸入圖同一個角度) */
export const swing = (l: number): number => 0.5 * Math.sin(l / 2300)

const st = (e: number, d: number): number => inOutCubic(seg(e, d * 0.4, d * 0.4 + 0.6))

// ---- 16 格的格線(「整個空間的格子」) ----
const L0 = LEVELS[0]
export const LATTICE: { x: number[]; y: number[]; z: number[]; occ: boolean[] } = { x: [], y: [], z: [], occ: [] }
{
  const used = new Set<number>()
  for (let n = 0; n < N; n++) if (L0.rep[n]) used.add(Math.floor((VX[n] + GX / 2) / 8) * 4096 + Math.floor((VY[n] + GY / 2) / 8) * 64 + Math.floor((VZ[n] + GZ / 2) / 8))
  for (let a = 0; a < Math.ceil(GX / 8); a++)
    for (let b = 0; b < 16; b++)
      for (let c = 0; c < Math.ceil(GZ / 8); c++) {
        LATTICE.x.push((a + 0.5) * 8 - GX / 2)
        LATTICE.y.push((b + 0.5) * 8 - GY / 2)
        LATTICE.z.push((c + 0.5) * 8 - GZ / 2)
        LATTICE.occ.push(used.has(a * 4096 + b * 64 + c))
      }
}

// ---- 緩衝與暫存 ----
let sx: Float32Array
let sy: Float32Array
let sz: Float32Array
let sd: Float32Array
let sc: Uint32Array
let se: Uint8Array
let ord: Int32Array
let cnt: Int32Array
let tmp: Uint32Array
const ensure = (): void => {
  if (sx) return
  sx = new Float32Array(N)
  sy = new Float32Array(N)
  sz = new Float32Array(N)
  sd = new Float32Array(N)
  sc = new Uint32Array(N)
  se = new Uint8Array(N)
  ord = new Int32Array(N)
  cnt = new Int32Array(1025)
}
const pack = (r: number, g: number, b: number): number => ((255 << 24) | (Math.min(255, Math.max(0, b | 0)) << 16) | (Math.min(255, Math.max(0, g | 0)) << 8) | Math.min(255, Math.max(0, r | 0))) >>> 0

interface View {
  ct: number
  stt: number
  cp: number
  sp: number
}
const view = (l: number): View => {
  const t = YAW + swing(l)
  return { ct: Math.cos(t), stt: Math.sin(t), cp: Math.cos(PHI), sp: Math.sin(PHI) }
}
/** 一個點(128 格為單位)→ 螢幕位置與深度(大 = 近) */
function proj(v: View, x: number, y: number, z: number, out: number[]): void {
  const x1 = x * v.ct + z * v.stt
  const z1 = -x * v.stt + z * v.ct
  out[0] = x1
  out[1] = -(y * v.cp - z1 * v.sp)
  out[2] = z1 * v.cp + y * v.sp
}
/** 法線轉到視角空間 */
function vn(v: View, nx: number, ny: number, nz: number, out: number[]): void {
  const x1 = nx * v.ct + nz * v.stt
  const z1 = -nx * v.stt + nz * v.ct
  out[0] = x1
  out[1] = ny * v.cp - z1 * v.sp
  out[2] = z1 * v.cp + ny * v.sp
}
/** 明暗:blk = 0 → 平滑法線;blk = 1 → 貼向最近的座標軸(方塊的面)。spec = 光澤強度。回傳 [明暗, 光澤] */
const SH = [0, 0]
const nq = [0, 0, 0]
function shade(v: View, nx: number, ny: number, nz: number, blk: number, spec: number): void {
  if (blk > 0.001) {
    const ax = Math.abs(nx)
    const ay = Math.abs(ny)
    const az = Math.abs(nz)
    const m = Math.max(ax, ay, az) || 1
    nx = nx * (1 - blk) + (ax === m ? Math.sign(nx) : 0) * blk
    ny = ny * (1 - blk) + (ay === m ? Math.sign(ny) : 0) * blk
    nz = nz * (1 - blk) + (az === m ? Math.sign(nz) : 0) * blk
  }
  const l = Math.hypot(nx, ny, nz) || 1
  vn(v, nx / l, ny / l, nz / l, nq)
  const d = (nq[0] * LX + nq[1] * LY + nq[2] * LZ) / LN
  SH[0] = 0.58 + 0.5 * clamp(d, -0.3, 1)
  if (spec > 0) {
    const h = clamp((nq[0] * HX + nq[1] * HY + nq[2] * HZ) / HN)
    SH[1] = spec * h ** 28 * 70
  } else SH[1] = 0
}

/** 某個 128 格的中心在舞台上的位置(畫標示框用) */
export function cellScreen(spec: MeshSpec, n: number): [number, number] {
  const o = [0, 0, 0]
  proj(view(spec.l), VX[n], VY[n], VZ[n], o)
  return [spec.cx + o[0] * spec.S, spec.cy + o[1] * spec.S]
}

// ---- 建構動畫:每一格的狀態 ----
function stateTl(spec: MeshSpec): number {
  const tl = spec.tl!
  const L = LEVELS[tl.lv]
  const P = tl.lv > 0 ? LEVELS[tl.lv - 1] : null
  const v = view(spec.l)
  const S = spec.S
  const q = [0, 0, 0]
  const lattice = !!spec.vx
  for (let i = 0; i < L.n; i++) {
    sz[i] = 0
    const dd = L.dl[i]
    const spE = inOutCubic(clamp(tl.sp * 1.6 - dd))
    const rfE = inOutCubic(clamp(tl.rf * 1.6 - dd))
    let bx: number, by: number, bz: number, bs: number, nx: number, ny: number, nz: number
    if (P) {
      const p = L.par![i]
      bx = lerp(P.x[p], L.rx[i], spE)
      by = lerp(P.y[p], L.ry[i], spE)
      bz = lerp(P.z[p], L.rz[i], spE)
      bs = lerp(P.s[p], L.cell, spE)
      nx = lerp(P.nx[p], L.nx[i], spE)
      ny = lerp(P.ny[p], L.ny[i], spE)
      nz = lerp(P.nz[p], L.nz[i], spE)
    } else {
      bx = L.rx[i]
      by = L.ry[i]
      bz = L.rz[i]
      bs = L.cell
      nx = L.nx[i]
      ny = L.ny[i]
      nz = L.nz[i]
    }
    const x = lerp(bx, L.x[i], rfE)
    const y = lerp(by, L.y[i], rfE)
    const z = lerp(bz, L.z[i], rfE)
    let size = lerp(bs, L.s[i], rfE)
    // 出現:hook 由下往上長出來;voxel 從格線的點各自長成方塊
    if (tl.ap < 1) {
      const m = lattice ? clamp(outBack(seg(tl.ap, hash(i * 7 + 3) * 0.5, hash(i * 7 + 3) * 0.5 + 0.5))) : inOutCubic(clamp((tl.ap - (1 - L.y01[i]) * 0.6) / 0.4))
      if (m <= 0.002) continue
      size *= lattice ? 0.35 + 0.65 * m : m
    }
    const kk = tl.lv === 3 ? inOutCubic(clamp(tl.col * 1.6 - dd)) : 0
    const sm = tl.lv === 3 ? inOutCubic(clamp(tl.sm * 1.6 - dd)) : 0
    const r = lerp(L.nr[i], L.cr[i], kk)
    const g = lerp(L.ng[i], L.cg[i], kk)
    const b = lerp(L.nb[i], L.cb[i], kk)
    proj(v, x, y, z, q)
    sx[i] = spec.cx + q[0] * S - spec.region.x
    sy[i] = spec.cy + q[1] * S - spec.region.y
    sd[i] = q[2]
    sz[i] = size * S * (1 + 0.4 * sm)
    shade(v, nx, ny, nz, 0.6 * (1 - sm), sm)
    const f = SH[0]
    sc[i] = pack(r * f + SH[1], g * f + SH[1], b * f + SH[1])
    se[i] = sm < 0.5 ? 1 : 0
  }
  return L.n
}

// ---- 迷霧凝聚:每顆積木的狀態 ----
function stateFlow(spec: MeshSpec): number {
  const ph = spec.ph!
  const v = view(spec.l)
  const l = spec.l
  const S = spec.S
  const pk = inOutCubic(ph.pack)
  const q = [0, 0, 0]
  const A = LEVELS[0]
  const M = LEVELS[2]
  const F = LEVELS[3]
  for (let n = 0; n < N; n++) {
    const d1 = R1[n]
    const d2 = R2[n]
    const d3 = R3[n]
    const s0 = st(ph.scatter, d1)
    const c1 = st(ph.e1, d2)
    const c2 = st(ph.e2, d3)
    const c3 = st(ph.e3, d1)
    const sm = st(ph.sm, d2)
    const ca = A.cid[n]
    const cm = M.cid[n]
    // 三個解析度的位置、大小、法線
    proj(v, F.x[n], F.y[n], F.z[n], q)
    const bx = lerp(spec.cx + q[0] * S, spec.cx, pk * 0.72)
    const by = lerp(spec.cy + q[1] * S, spec.cy, pk * 0.72)
    const bd = q[2]
    const bz = lerp(1, 0.28, pk)
    proj(v, A.x[ca], A.y[ca], A.z[ca], q)
    const ax = spec.cx + q[0] * S
    const ay = spec.cy + q[1] * S
    const ad = q[2]
    proj(v, M.x[cm], M.y[cm], M.z[cm], q)
    const mx = spec.cx + q[0] * S
    const my = spec.cy + q[1] * S
    const md = q[2]
    const fx = lerp(spec.box.x0, spec.box.x1, RX[n]) + Math.sin(l / 700 + d1 * 6.28) * 12
    const fy = lerp(spec.box.y0, spec.box.y1, RY[n]) + Math.cos(l / 820 + d2 * 6.28) * 12
    const w = 14 * s0 * (1 - c1 * 0.55) * (1 - c2)
    let x = lerp(lerp(bx, fx, s0), ax, c1)
    let y = lerp(lerp(by, fy, s0), ay, c1)
    let dep = lerp(bd, ad, c1)
    // 大小:整團 1 格 → 霧(點)→ 粗(16 格)→ 64 格 → 128 格
    let size = lerp(lerp(1 * bz, 1.5, s0), A.cell, c1 ** 2.2)
    let nx = lerp(VNX[n], A.nx[ca], c1)
    let ny = lerp(VNY[n], A.ny[ca], c1)
    let nz = lerp(VNZ[n], A.nz[ca], c1)
    if (c2 > 0) {
      if (c2 < 0.5) {
        const t = c2 * 2
        x = lerp(ax, mx, t)
        y = lerp(ay, my, t)
        dep = lerp(ad, md, t)
        size = lerp(A.cell, M.cell, t)
        nx = lerp(A.nx[ca], M.nx[cm], t)
        ny = lerp(A.ny[ca], M.ny[cm], t)
        nz = lerp(A.nz[ca], M.nz[cm], t)
      } else {
        const t = c2 * 2 - 1
        proj(v, F.x[n], F.y[n], F.z[n], q)
        x = lerp(mx, spec.cx + q[0] * S, t)
        y = lerp(my, spec.cy + q[1] * S, t)
        dep = lerp(md, q[2], t)
        size = lerp(M.cell, 1, t)
        nx = lerp(M.nx[cm], VNX[n], t)
        ny = lerp(M.ny[cm], VNY[n], t)
        nz = lerp(M.nz[cm], VNZ[n], t)
      }
    }
    x += Math.sin(l / 230 + d3 * 9) * w
    y += Math.cos(l / 260 + d2 * 9) * w
    // 顏色:底色 → 霧 → 結構 → 無貼圖 → 上色(中途閃幾種色)
    const br = BASE[n * 3]
    const bg = BASE[n * 3 + 1]
    const bb = BASE[n * 3 + 2]
    let r = br
    let g = bg
    let b = bb
    const mixc = (c: [number, number, number], t: number): void => {
      r = lerp(r, c[0], t)
      g = lerp(g, c[1], t)
      b = lerp(b, c[2], t)
    }
    mixc(FOGC[n & 3], s0)
    mixc(STRUCT, c1)
    mixc(CLAYC, c2)
    r = lerp(r, br, c3)
    g = lerp(g, bg, c3)
    b = lerp(b, bb, c3)
    const jit = Math.sin(c3 * Math.PI) * 0.6
    if (jit > 0.01) mixc(JIT[Math.floor(hash(n * 13 + Math.floor(l / 110)) * 5)], jit)
    shade(v, nx, ny, nz, 0.55 * (1 - sm), sm)
    const f = lerp(1, SH[0], 1 - s0 * 0.6)
    const op = lerp(lerp(1, 0.4, s0), 1, c1)
    const gl = SH[1] * (1 - s0)
    r = lerp(BG[0], r * f + gl, op)
    g = lerp(BG[1], g * f + gl, op)
    b = lerp(BG[2], b * f + gl, op)
    // 重疊的代表才畫:收攏到 16 / 64 格後,同一格的其他積木位置與大小都一樣,畫了也看不到
    const settled = c1 >= 0.995 && c2 < 0.5 && !A.rep[n] && !M.rep[n]
    sx[n] = x - spec.region.x
    sy[n] = y - spec.region.y
    sz[n] = settled ? 0 : size * S * (1 + 0.4 * sm)
    sd[n] = dep
    sc[n] = pack(r, g, b)
    se[n] = sm < 0.5 ? 1 : 0
  }
  return N
}

let bx0 = 0
let by0 = 0
let bx1 = 0
let by1 = 0
function square(buf: Uint32Array, w: number, h: number, cx: number, cy: number, size: number, col: number, edge: number): void {
  const s = Math.max(1, Math.round(size))
  const x0 = Math.round(cx - s / 2)
  const y0 = Math.round(cy - s / 2)
  const xa = Math.max(0, x0)
  const xb = Math.min(w, x0 + s)
  if (xb <= xa) return
  if (xa < bx0) bx0 = xa
  if (xb > bx1) bx1 = xb
  if (y0 < by0) by0 = Math.max(0, y0)
  if (y0 + s > by1) by1 = Math.min(h, y0 + s)
  for (let y = Math.max(0, y0); y < Math.min(h, y0 + s); y++) {
    const o = y * w
    if (edge && s >= 7 && (y === y0 || y === y0 + s - 1)) buf.fill(edge, o + xa, o + xb)
    else {
      buf.fill(col, o + xa, o + xb)
      if (edge && s >= 7) {
        if (x0 >= 0 && x0 < w) buf[o + x0] = edge
        if (x0 + s - 1 >= 0 && x0 + s - 1 < w) buf[o + x0 + s - 1] = edge
      }
    }
  }
}
const darker = (c: number): number => (255 << 24) | ((((c >> 16) & 255) * 0.74) << 16) | ((((c >> 8) & 255) * 0.74) << 8) | ((c & 255) * 0.74)

/** 輕輕模糊(只在已畫出來的範圍、只混合有顏色的鄰居):平滑著色的「網格質感」 */
function soften(buf: Uint32Array, w: number, h: number, amt: number): void {
  const xa = Math.max(1, bx0)
  const xb = Math.min(w - 1, bx1)
  const ya = Math.max(1, by0)
  const yb = Math.min(h - 1, by1)
  if (xb <= xa || yb <= ya) return
  if (!tmp || tmp.length < w * h) tmp = new Uint32Array(w * h)
  const pass = (src: Uint32Array, dst: Uint32Array, step: number, mixAmt: number): void => {
    for (let y = ya; y < yb; y++)
      for (let x = xa; x < xb; x++) {
        const o = y * w + x
        const c = src[o]
        if (!(c >>> 24)) {
          dst[o] = 0
          continue
        }
        let r = c & 255
        let g = (c >> 8) & 255
        let b = (c >> 16) & 255
        let k = 1
        const c1 = src[o - step]
        const c2 = src[o + step]
        if (c1 >>> 24) {
          r += c1 & 255
          g += (c1 >> 8) & 255
          b += (c1 >> 16) & 255
          k++
        }
        if (c2 >>> 24) {
          r += c2 & 255
          g += (c2 >> 8) & 255
          b += (c2 >> 16) & 255
          k++
        }
        r = (c & 255) + (r / k - (c & 255)) * mixAmt
        g = ((c >> 8) & 255) + (g / k - ((c >> 8) & 255)) * mixAmt
        b = ((c >> 16) & 255) + (b / k - ((c >> 16) & 255)) * mixAmt
        dst[o] = pack(r, g, b)
      }
  }
  pass(buf, tmp, 1, amt)
  pass(tmp, buf, w, amt)
}

/** 把這一刻的積木畫進像素緩衝(w×h,先清成透明)。回傳畫出幾個積木(量測用)。 */
export function paintMesh(buf: Uint32Array, w: number, h: number, spec: MeshSpec): number {
  ensure()
  buf.fill(0)
  bx0 = w
  by0 = h
  bx1 = 0
  by1 = 0
  let items = 0
  if (spec.mode === 'flow') items = stateFlow(spec)
  else {
    const vx = spec.vx
    // 空間裡的格線:有東西的格子之後會長成方塊
    if (vx && vx.dots > 0) {
      const v = view(spec.l)
      const q = [0, 0, 0]
      for (let i = 0; i < LATTICE.x.length; i++) {
        const hh = hash(i * 5 + 3)
        const a = clamp(vx.dots) * (LATTICE.occ[i] ? 1 - clamp(vx.grow * 3 - hh) : 1 - clamp(outBack(seg(vx.fade, hh * 0.4, hh * 0.4 + 0.6))))
        if (a <= 0.02) continue
        proj(v, LATTICE.x[i], LATTICE.y[i], LATTICE.z[i], q)
        const px = spec.cx + q[0] * spec.S - spec.region.x
        const py = spec.cy + q[1] * spec.S - spec.region.y
        const c = lerp(255, 160, a * 0.8)
        square(buf, w, h, px, py, 3, pack(c, lerp(255, 174, a * 0.8), lerp(255, 194, a * 0.8)), 0)
      }
    }
    items = stateTl(spec)
  }
  // 由遠到近(計數排序)
  cnt.fill(0)
  let m = 0
  for (let n = 0; n < items; n++) {
    if (sz[n] <= 0) continue
    const k = Math.min(1023, Math.max(0, Math.floor((sd[n] + 100) * 5)))
    cnt[k + 1]++
    m++
  }
  for (let k = 0; k < 1024; k++) cnt[k + 1] += cnt[k]
  for (let n = 0; n < items; n++) {
    if (sz[n] <= 0) continue
    const k = Math.min(1023, Math.max(0, Math.floor((sd[n] + 100) * 5)))
    ord[cnt[k]++] = n
  }
  // 平滑著色的模糊範圍只算積木(格線不算)
  bx0 = w
  by0 = h
  bx1 = 0
  by1 = 0
  for (let i = 0; i < m; i++) {
    const n = ord[i]
    const s = sz[n] * 1.12
    square(buf, w, h, sx[n], sy[n], s, sc[n], se[n] && s >= 7 ? darker(sc[n]) : 0)
  }
  const smo = spec.mode === 'flow' ? spec.ph!.sm : spec.tl!.sm
  if (smo > 0.02) soften(buf, w, h, inOutCubic(smo) * 0.85)
  return m
}
