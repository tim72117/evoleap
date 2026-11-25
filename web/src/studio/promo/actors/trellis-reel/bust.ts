// trellis-reel 用的 3D 模型:Marble Bust 01(Rico Cilliers,Poly Haven,CC0),已離線取樣成 128 格高的精簡體素資料(位置、貼圖色、法線)。
// 資料檔與授權說明在 ./assets/(ATTRIBUTION.md);烘焙頁的程式碼在 assets/bake-bust.html.txt。
// 這支只做「載入資料、由細往粗算出 16 / 32 / 64 / 128 四個階層的格子」,純資料,不畫圖。
import raw from './assets/bust.vox128.b64?raw'
import refUrl from './assets/bust-render.webp?url'
import { hash } from './draw'

export const CREDIT = '模型：Marble Bust 01／Rico Cilliers（Poly Haven，CC0）'
export const SOURCE = 'polyhaven.com/a/marble_bust_01'
/** 「輸入的一張圖」:半身像用 PBR 材質渲染的一張圖 */
export const REF_URL = refUrl

/** 四個階層(格高) */
export const RES = [16, 32, 64, 128] as const
const ND = 256

/** 量化法線的方向表(與烘焙頁同一套 Fibonacci 球) */
export const DIRS: Float32Array = (() => {
  const d = new Float32Array(ND * 3)
  for (let i = 0; i < ND; i++) {
    const y = 1 - (2 * (i + 0.5)) / ND
    const r = Math.sqrt(1 - y * y)
    const t = i * 2.399963
    d[i * 3] = Math.cos(t) * r
    d[i * 3 + 1] = y
    d[i * 3 + 2] = Math.sin(t) * r
  }
  return d
})()

function decode(b64: string): { GX: number; GY: number; GZ: number; key: number[]; nrm: Uint8Array; col: Uint8Array; pal: Uint8Array } {
  const bin = atob(b64.trim())
  const b = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
  let o = 0
  const rd = (): number => {
    let v = 0
    let s = 0
    let c: number
    do {
      c = b[o++]
      v += (c & 127) * 2 ** s
      s += 7
    } while (c & 128)
    return v
  }
  const GX = rd()
  const GY = rd()
  const GZ = rd()
  const n = rd()
  const key: number[] = []
  let k = 0
  for (let i = 0; i < n; i++) {
    k += rd()
    key.push(k)
  }
  const nrm = b.slice(o, o + n)
  const col = b.slice(o + n, o + 2 * n)
  const pal = b.slice(o + 2 * n, o + 2 * n + 768)
  return { GX, GY, GZ, key, nrm, col, pal }
}

const D = decode(raw)
export const N = D.key.length
export const GX = D.GX
export const GY = D.GY
export const GZ = D.GZ
/** 資料檔的外框(格),測試與排版用 */
export const EXTENT = { x: GX, y: GY, z: GZ }

/** 128 格的整數座標(以外框最小角為 0) */
export const IX = new Int16Array(N)
export const IY = new Int16Array(N)
export const IZ = new Int16Array(N)
/** 128 格的中心(以一格為單位,中心在 0,y 為 -GY/2…GY/2),貼圖色(0–255),法線 */
export const VX = new Float32Array(N)
export const VY = new Float32Array(N)
export const VZ = new Float32Array(N)
export const VNX = new Float32Array(N)
export const VNY = new Float32Array(N)
export const VNZ = new Float32Array(N)
export const BASE = new Uint8Array(N * 3)
/** 每顆積木固定的小亂數(0–1),各有各的延遲、霧中位置與飄動相位 */
export const R1 = new Float32Array(N)
export const R2 = new Float32Array(N)
export const R3 = new Float32Array(N)
export const RX = new Float32Array(N)
export const RY = new Float32Array(N)
for (let n = 0; n < N; n++) {
  const k = D.key[n]
  IZ[n] = k % GZ
  IX[n] = Math.floor(k / GZ) % GX
  IY[n] = Math.floor(k / GZ / GX)
  VX[n] = IX[n] + 0.5 - GX / 2
  VY[n] = IY[n] + 0.5 - GY / 2
  VZ[n] = IZ[n] + 0.5 - GZ / 2
  const d = D.nrm[n] * 3
  VNX[n] = DIRS[d]
  VNY[n] = DIRS[d + 1]
  VNZ[n] = DIRS[d + 2]
  const c = D.col[n] * 3
  BASE[n * 3] = D.pal[c]
  BASE[n * 3 + 1] = D.pal[c + 1]
  BASE[n * 3 + 2] = D.pal[c + 2]
  R1[n] = hash(n * 3 + 1)
  R2[n] = hash(n * 3 + 2)
  R3[n] = hash(n * 3 + 3)
  RX[n] = hash(n * 7 + 11)
  RY[n] = hash(n * 7 + 12)
}

/** 「還沒上色」的陶土色(示意:只有形狀的階段) */
const CLAY: [number, number, number] = [184, 146, 106]

export interface Cells {
  n: number
  /** 一格有多大(128 格為單位) */
  cell: number
  /** 上一個階層的哪一格(最粗的是 null) */
  par: Int32Array | null
  /** 原始格中心 */
  rx: Float32Array
  ry: Float32Array
  rz: Float32Array
  /** 修邊後:往格內頂點的平均位置靠攏,並依範圍縮小 */
  x: Float32Array
  y: Float32Array
  z: Float32Array
  /** 修邊後的大小(一個數,0.75–1 格) */
  s: Float32Array
  nx: Float32Array
  ny: Float32Array
  nz: Float32Array
  /** 貼圖色(平均) */
  cr: Float32Array
  cg: Float32Array
  cb: Float32Array
  /** 還沒上色時的陶土色(以最粗的 16 格做棋盤明暗) */
  nr: Float32Array
  ng: Float32Array
  nb: Float32Array
  /** 高度 0–1 與展開的延遲(0–0.6) */
  y01: Float32Array
  dl: Float32Array
  /** 128 格 → 這個階層的哪一格,以及每一格的代表(畫面上重疊的只畫代表) */
  cid: Int32Array
  rep: Uint8Array
}

function build(l: number): Cells {
  const sh = 3 - l
  const cell = 2 ** sh
  const map = new Map<number, number>()
  const cid = new Int32Array(N)
  const rep = new Uint8Array(N)
  const first: number[] = []
  for (let n = 0; n < N; n++) {
    const key = ((IX[n] >> sh) * 256 + (IY[n] >> sh)) * 256 + (IZ[n] >> sh)
    let id = map.get(key)
    if (id === undefined) {
      id = first.length
      map.set(key, id)
      first.push(n)
      rep[n] = 1
    }
    cid[n] = id
  }
  const m = first.length
  const f = (): Float32Array => new Float32Array(m)
  const c: Cells = {
    n: m, cell, par: null, rx: f(), ry: f(), rz: f(), x: f(), y: f(), z: f(), s: f(), nx: f(), ny: f(), nz: f(),
    cr: f(), cg: f(), cb: f(), nr: f(), ng: f(), nb: f(), y01: f(), dl: f(), cid, rep,
  }
  const cnt = new Float32Array(m)
  const sx = f(), sy = f(), sz = f()
  const mn = [new Float32Array(m).fill(1e9), new Float32Array(m).fill(1e9), new Float32Array(m).fill(1e9)]
  const mx = [new Float32Array(m).fill(-1e9), new Float32Array(m).fill(-1e9), new Float32Array(m).fill(-1e9)]
  for (let n = 0; n < N; n++) {
    const i = cid[n]
    cnt[i]++
    sx[i] += VX[n]
    sy[i] += VY[n]
    sz[i] += VZ[n]
    c.nx[i] += VNX[n]
    c.ny[i] += VNY[n]
    c.nz[i] += VNZ[n]
    c.cr[i] += BASE[n * 3]
    c.cg[i] += BASE[n * 3 + 1]
    c.cb[i] += BASE[n * 3 + 2]
    const p = [VX[n], VY[n], VZ[n]]
    for (let a = 0; a < 3; a++) {
      if (p[a] - 0.5 < mn[a][i]) mn[a][i] = p[a] - 0.5
      if (p[a] + 0.5 > mx[a][i]) mx[a][i] = p[a] + 0.5
    }
  }
  const G = [GX, GY, GZ]
  for (let i = 0; i < m; i++) {
    const n = first[i]
    const a = [IX[n] >> sh, IY[n] >> sh, IZ[n] >> sh]
    const mean = [sx[i] / cnt[i], sy[i] / cnt[i], sz[i] / cnt[i]]
    const lo = [a[0] * cell - G[0] / 2, a[1] * cell - G[1] / 2, a[2] * cell - G[2] / 2]
    let size = 0
    for (let d = 0; d < 3; d++) size = Math.max(size, 2 * Math.max(mx[d][i] - mean[d], mean[d] - mn[d][i]))
    size = Math.min(cell, Math.max(0.75 * cell, size))
    const ref = mean.map((v, d) => Math.min(lo[d] + cell - size / 2, Math.max(lo[d] + size / 2, v)))
    c.rx[i] = lo[0] + cell / 2
    c.ry[i] = lo[1] + cell / 2
    c.rz[i] = lo[2] + cell / 2
    c.x[i] = ref[0]
    c.y[i] = ref[1]
    c.z[i] = ref[2]
    c.s[i] = size
    const l2 = Math.hypot(c.nx[i], c.ny[i], c.nz[i]) || 1
    c.nx[i] /= l2
    c.ny[i] /= l2
    c.nz[i] /= l2
    c.cr[i] /= cnt[i]
    c.cg[i] /= cnt[i]
    c.cb[i] /= cnt[i]
    const chk = ((IX[n] >> 3) + (IY[n] >> 3) + (IZ[n] >> 3)) & 1
    const v = 0.9 + 0.12 * chk
    c.nr[i] = CLAY[0] * v
    c.ng[i] = CLAY[1] * v
    c.nb[i] = CLAY[2] * v
    const y01 = (c.ry[i] + GY / 2) / GY
    c.y01[i] = y01
    const xs = (c.rx[i] + GX / 2) / GX
    c.dl[i] = 0.6 * (0.4 * y01 + 0.25 * Math.min(1, Math.max(0, xs)) + 0.35 * hash(i * 31 + l * 7 + 5))
  }
  return c
}

/** 16 / 32 / 64 / 128 四個階層(最後一層的格子就是資料檔的格子,索引相同) */
export const LEVELS: Cells[] = [0, 1, 2, 3].map(build)
for (let l = 1; l < 4; l++) {
  const L = LEVELS[l]
  const P = LEVELS[l - 1]
  L.par = new Int32Array(L.n)
  for (let n = 0; n < N; n++) if (L.rep[n]) L.par[L.cid[n]] = P.cid[n]
}
