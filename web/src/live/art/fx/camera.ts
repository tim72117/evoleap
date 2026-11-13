// art/fx/camera:推軌鏡頭 —— 多層視差(每層有深度 d:0 遠景不太動、1 主體、>1 前景動得多)+ 手持微晃。
// 全是純函式:狀態 → {x, y, z} → 每層的 transform 字串。舞台預設 1920×1080,中心 (960, 540)。
// 用法:cam = lerpCam(a, b, p);每層 kit.setIf(el, 'transform', layerTransform(cam, depth, handheld(ms)))
import { kit } from '../../kit'
import { fx } from '../dom'

/** 鏡頭:看向舞台上的 (x, y)、放大 z 倍 */
export type Cam = { x: number; y: number; z: number }
export const WIDE_CAM: Cam = { x: 960, y: 540, z: 1 }
export const STAGE_CENTER = { x: 960, y: 540 }

export const lerpCam = (a: Cam, b: Cam, p: number): Cam => ({ x: kit.lerp(a.x, b.x, p), y: kit.lerp(a.y, b.y, p), z: kit.lerp(a.z, b.z, p) })

/** 手持的微晃(px,在深度 1 的層) */
export const handheld = (ms: number): { x: number; y: number } => ({ x: kit.noise(ms / 1900, 3) * 4, y: kit.noise(ms / 2300, 4) * 3 })

/** 推近的程度 0–1(z 從 1 到 1+span);拿來決定景深模糊、面板縮放 */
export const closeness = (cam: Cam, span = 0.3): number => kit.clamp((cam.z - 1) / span)

/** 某一層(深度 depth)的 transform;層的 transform-origin 要是 0 0 */
export function layerTransform(cam: Cam, depth: number, shake: { x: number; y: number } = { x: 0, y: 0 }, center = STAGE_CENTER): string {
  const z = 1 + (cam.z - 1) * depth
  const cx = center.x + (cam.x - center.x) * depth
  const cy = center.y + (cam.y - center.y) * depth
  return `translate(${fx(center.x - cx * z + shake.x * depth, 1)}px, ${fx(center.y - cy * z + shake.y * depth, 1)}px) scale(${fx(z, 4)})`
}
