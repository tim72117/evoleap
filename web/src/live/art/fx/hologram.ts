// art/fx/hologram:全息面板的出現動畫(由上往下展開、閃兩下)。純函式 holoIn / holoStyle + 套到元素的 renderHolo。
// 外觀在 hologram.css(.art-holo);SPEC 第 1 節:時間純函式,不用 CSS animation,閃爍的亂數用固定種子。
import { kit } from '../../kit'
import { fx } from '../dom'
import './hologram.css'

/** 面板出現:p 0–1 → 不透明度與垂直縮放(p<0.55 時依種子閃爍) */
export const holoIn = (p: number, seed: number): { op: number; sy: number } => {
  if (p <= 0) return { op: 0, sy: 0.02 }
  if (p >= 1) return { op: 1, sy: 1 }
  const flick = p < 0.55 ? (kit.rand(seed + Math.floor(p * 18))() < 0.35 ? 0.35 : 1) : 1
  return { op: Math.min(1, p * 2.2) * flick, sy: kit.lerp(0.02, 1, kit.ease.outCubic(kit.clamp(p * 1.25))) }
}

export interface HoloStyle {
  opacity: string
  visibility: string
  transform: string
}
/** holoIn 換成 CSS 值;base 是前面的 transform(例如 translate/perspective),mul 是整體不透明度倍率 */
export const holoStyle = (p: number, seed: number, base = '', mul = 1): HoloStyle => {
  const h = holoIn(p, seed)
  return { opacity: fx(h.op * mul, 3), visibility: h.op <= 0.001 ? 'hidden' : 'visible', transform: `${base} scaleY(${fx(h.sy, 3)})` }
}
/** 把 holoStyle 套到面板元素 */
export const renderHolo = (el: HTMLElement, p: number, seed: number, base = '', mul = 1): void => {
  kit.css(el, { ...holoStyle(p, seed, base, mul) })
}
