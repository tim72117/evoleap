// print3d-layers 的視角與尺寸:全部用 mm 的世界座標(x 右、y 往後、z 往上)。純函式,不碰 WebGL。
// 3D 畫面由 gl.ts(Three.js)畫;疊在上面的尺、標註與聚光燈目標用這裡同一套透視公式投影,兩者位置一致。

export type V = readonly [x: number, y: number, z: number]
/** 視角(度):yaw 繞 Z 軸轉(不限圈數),pitch 俯角 */
export type View = { yaw: number; pitch: number }
export const PITCH_LIMIT = [12, 65] as const
export const SCALE = 5
/** 鏡頭到轉動中心的距離 mm(越小透視越明顯) */
export const DIST = 650
export const CENTER_Z = 20
const RAD = Math.PI / 180

export type Camera = {
  view: View
  /** 鏡頭位置 */
  eye: V
  /** 世界座標 → 畫面座標(置中縮放前) */
  p: (v: V) => [number, number]
}

export function camera(view: View): Camera {
  const [ca, sa, cb, sb] = [Math.cos(view.yaw * RAD), Math.sin(view.yaw * RAD), Math.cos(view.pitch * RAD), Math.sin(view.pitch * RAD)]
  return {
    view,
    eye: [-DIST * sa * cb, -DIST * ca * cb, CENTER_Z + DIST * sb],
    p: ([x, y, z]) => {
      const depth = (x * sa + y * ca) * cb - (z - CENTER_Z) * sb
      const k = (DIST / (DIST + depth)) * SCALE
      return [(x * ca - y * sa) * k, -((z - CENTER_Z) * cb + (x * sa + y * ca) * sb) * k]
    },
  }
}

export const path = (cam: Camera, pts: V[]): string => pts.map((v, i) => `${i ? 'L' : 'M'}${cam.p(v).map((n) => n.toFixed(1)).join(' ')}`).join('')

/** 一組世界座標點在畫面上的外框(給聚光燈當目標、置中縮放) */
export function bounds(cam: Camera, pts: V[]): { x: number; y: number; w: number; h: number } {
  const p = pts.map(cam.p)
  const xs = p.map((q) => q[0])
  const ys = p.map((q) => q[1])
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

// ---------- 列印機尺寸(mm) ----------
export const BED = { half: 40, thick: 3 }
/** 兩根立柱的 x、龍門架的 y(比模型中心後面一點)、立柱高 */
export const GANTRY = { x: 62, y: 12, top: 66 }
/** 噴嘴尖到橫桿中心 */
export const BEAM_UP = 15
export const SPOOL_AT: V = [40, GANTRY.y, GANTRY.top + 20]
/** 整台機器的外框(畫面依它置中縮放) */
export const EXTENT: V[] = [-82, 94].flatMap((x) => [-86, 86].flatMap((y) => [-24, 100].map((z) => [x, y, z] as V)))
