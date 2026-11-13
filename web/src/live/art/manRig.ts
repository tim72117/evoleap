// art/manRig:旁邊那個人(manSvg)的「坐姿 / 站姿」與手臂。
// manSvg 畫的是站著的上半身(頭在 1664,302);坐在桌前打字時,整個人(wrapper 元素)平移 + 轉一點 + 縮放(ManPose),
// 手臂另畫在桌子上面的一層(manArmsSvg),肩膀的位置用 poseMap 換算,手腕用 IK 伸到鍵盤、頭旁邊或舉高。
// 純函式 + 一個只改屬性的 drawManArm。座標都是 1920×1080 舞台的 px。
import { kit } from '../kit'
import { attr, fx } from './dom'
import { capsule, capsuleShine, solveArm, type Pt } from './geometry'

/** 人在「站姿」座標裡的兩個肩膀(遠側 = 靠螢幕那邊、近側);手臂從這裡長出來 */
export const MAN_SHOULDER = { far: { x: 1548, y: 566 } as Pt, near: { x: 1690, y: 604 } as Pt }
/** 旋轉與縮放的支點(站姿座標裡的腰) */
export const POSE_ORIGIN: Pt = { x: 1690, y: 900 }
/** 站姿座標裡頭的中心與脖子(點頭的轉軸),跟 agent-office 的 MAN 一樣 */
export const MAN_HEAD: Pt = { x: 1664, y: 302 }

/** 姿勢:先以 POSE_ORIGIN 縮放 k、轉 rot 度(順時針為正),再平移 (tx, ty) */
export interface ManPose {
  tx: number
  ty: number
  rot: number
  k: number
}
/** 站著(= agent-office 裡人的位置,不做任何變換) */
export const STAND_POSE: ManPose = { tx: 0, ty: 0, rot: 0, k: 1 }
export const lerpPose = (a: ManPose, b: ManPose, p: number): ManPose => ({ tx: kit.lerp(a.tx, b.tx, p), ty: kit.lerp(a.ty, b.ty, p), rot: kit.lerp(a.rot, b.rot, p), k: kit.lerp(a.k, b.k, p) })
export const isStand = (p: ManPose): boolean => p.tx === 0 && p.ty === 0 && p.rot === 0 && p.k === 1

/** 站姿座標的點 → 套用姿勢之後在舞台上的位置 */
export function poseMap(p: ManPose, pt: Pt): Pt {
  const a = (p.rot * Math.PI) / 180
  const dx = (pt.x - POSE_ORIGIN.x) * p.k
  const dy = (pt.y - POSE_ORIGIN.y) * p.k
  return { x: POSE_ORIGIN.x + p.tx + dx * Math.cos(a) - dy * Math.sin(a), y: POSE_ORIGIN.y + p.ty + dx * Math.sin(a) + dy * Math.cos(a) }
}
/** CSS transform(元素的 transform-origin 要設成 POSE_ORIGIN 的 px);站姿回傳 "none" */
export const poseCss = (p: ManPose): string => (isStand(p) ? 'none' : `translate(${fx(p.tx, 1)}px, ${fx(p.ty, 1)}px) rotate(${fx(p.rot, 2)}deg) scale(${fx(p.k, 4)})`)

// ---------- 手臂 ----------
function handSvg(k: string, far: boolean): string {
  const skin = `url(#${k}-hskin)`
  const fingers = [-21, -7, 7, 20]
    .map((y, i) => {
      const len = [46, 52, 50, 40][i]
      const a = len * 0.55
      return (
        `<g class="${k}-mf" data-y="${y}" data-a="${a}">` +
        `<rect x="${-66 - a}" y="${y - 6.5}" width="${a + 6}" height="13" rx="6.5" fill="${skin}"/>` +
        `<g class="${k}-mf2"><rect x="${-66 - len}" y="${y - 6}" width="${len - a + 4}" height="12" rx="6" fill="${skin}"/></g>` +
        `<path d="M${-66 - a + 2} ${y - 5} v10" stroke="#b9876c" stroke-width="1.6" opacity=".6"/>` +
        `</g>`
      )
    })
    .join('')
  return (
    // 袖口(白襯衫)
    `<rect x="-2" y="-31" width="30" height="62" rx="7" fill="url(#${k}-cuff)" stroke="#aebdcc" stroke-width="1.5"/>` +
    // 手掌
    `<path d="M0 -28 C -24 -34 -52 -33 -68 -27 C -76 -10 -76 12 -68 28 C -48 33 -20 32 0 26 C 6 10 6 -12 0 -28Z" fill="${skin}"/>` +
    `<path d="M-8 -22 C -28 -26 -50 -26 -62 -22" stroke="#ffe9da" stroke-width="3.4" fill="none" opacity="${far ? 0.3 : 0.6}" stroke-linecap="round"/>` +
    fingers +
    // 拇指
    `<g class="${k}-mthumb"><rect x="-56" y="22" width="36" height="14" rx="7" fill="${skin}" transform="rotate(26 -20 28)"/></g>`
  )
}
function armSvg(k: string, which: 'near' | 'far'): string {
  const far = which === 'far'
  const sleeve = far ? `url(#${k}-sleevefar)` : `url(#${k}-sleeve)`
  const edge = `stroke="#0a1018" stroke-opacity="${far ? 0.7 : 0.5}" stroke-width="3" stroke-linejoin="round"`
  return (
    `<g class="${k}-ma-${which}">` +
    `<path class="${k}-ma-up" fill="${sleeve}" ${edge}/>` +
    `<path class="${k}-ma-upshine" stroke="#9db9d8" stroke-width="5" fill="none" opacity="${far ? 0.25 : 0.5}" stroke-linecap="round"/>` +
    `<circle class="${k}-ma-elbow" r="36" fill="${sleeve}" ${edge}/>` +
    `<path class="${k}-ma-fore" fill="${sleeve}" ${edge}/>` +
    `<path class="${k}-ma-foreshine" stroke="#9db9d8" stroke-width="4" fill="none" opacity="${far ? 0.25 : 0.5}" stroke-linecap="round"/>` +
    `<g class="${k}-ma-hand">${handSvg(k, far)}</g>` +
    `</g>`
  )
}
/** 兩隻手臂(西裝袖子 + 白袖口 + 手),疊在桌子上面;遠側在前面(先畫)、近側在後面 */
export function manArmsSvg(o: { prefix?: string } = {}): string {
  const k = o.prefix ?? 'ao'
  return (
    `<svg class="${k}-armsvg" viewBox="0 0 1920 1080" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="${k}-sleeve" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f647e"/><stop offset=".5" stop-color="#2a384b"/><stop offset="1" stop-color="#151d29"/></linearGradient>` +
    `<linearGradient id="${k}-sleevefar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a4b61"/><stop offset="1" stop-color="#0f1620"/></linearGradient>` +
    `<linearGradient id="${k}-cuff" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c6d2df"/></linearGradient>` +
    `<linearGradient id="${k}-hskin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d3be"/><stop offset=".55" stop-color="#d6a489"/><stop offset="1" stop-color="#a97562"/></linearGradient>` +
    `</defs>` +
    armSvg(k, 'far') +
    armSvg(k, 'near') +
    `</svg>`
  )
}

export interface ManArmParts {
  up: SVGPathElement
  upShine: SVGPathElement
  elbow: SVGCircleElement
  fore: SVGPathElement
  foreShine: SVGPathElement
  hand: SVGGElement
  fingers: { g: SVGGElement; g2: SVGGElement }[]
}
export function mountManArm(root: ParentNode, k: string, which: 'near' | 'far'): ManArmParts {
  const g = root.querySelector(`.${k}-ma-${which}`)!
  const q = <E extends Element>(s: string): E => g.querySelector<E>(`.${k}-ma-${s}`)!
  const hand = q<SVGGElement>('hand')
  return { up: q('up'), upShine: q('upshine'), elbow: q('elbow'), fore: q('fore'), foreShine: q('foreshine'), hand, fingers: [...hand.querySelectorAll<SVGGElement>(`.${k}-mf`)].map((g) => ({ g, g2: g.querySelector<SVGGElement>(`.${k}-mf2`)! })) }
}

/**
 * 畫一隻手臂:肩膀 s 到手腕目標 target 做 IK(手肘往下彎)。len = [上臂, 前臂];r = [肩, 肘, 腕] 的半徑;
 * typing 0–1 時手指照節奏按;follow 0–1 是手跟著前臂方向轉多少(打字平放 ≈ 0.35、舉起來 = 1);回傳手腕位置。
 */
export function drawManArm(p: ManArmParts, s: Pt, target: Pt, len: readonly [number, number], r: readonly [number, number, number], scale: number, typing: number, follow: number, ms: number, seed: number): Pt {
  const { elbow, wrist } = solveArm(s, target, len[0], len[1])
  attr(p.up, 'd', capsule(s, elbow, r[0], r[1]))
  attr(p.fore, 'd', capsule(elbow, wrist, r[1] * 0.9, r[2]))
  attr(p.upShine, 'd', capsuleShine(s, elbow, r[0], r[1]))
  attr(p.foreShine, 'd', capsuleShine(elbow, wrist, r[1] * 0.9, r[2]))
  attr(p.elbow, 'cx', fx(elbow.x, 1))
  attr(p.elbow, 'cy', fx(elbow.y, 1))
  let d = (Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) * 180) / Math.PI - 180
  while (d < -180) d += 360
  while (d > 180) d -= 360
  attr(p.hand, 'transform', `translate(${fx(wrist.x, 1)} ${fx(wrist.y, 1)}) rotate(${fx(d * follow, 1)}) scale(${scale})`)
  p.fingers.forEach(({ g, g2 }, i) => {
    const y = Number(g.dataset.y)
    const a = Number(g.dataset.a)
    const press = typing * Math.max(0, Math.sin(ms / (70 + i * 13) + i * 1.7 + seed)) ** 4
    attr(g, 'transform', `rotate(${fx(-4 - press * 9, 1)} -66 ${y})`)
    attr(g2, 'transform', `rotate(${fx(-18 - press * 22, 1)} ${-66 - a} ${y})`)
  })
  return wrist
}

// ---------- 臉與身體的待機微動 ----------
export interface ManFace {
  head: SVGGElement
  body: SVGGElement
  eye: SVGGElement
  mouth: SVGPathElement
}
/** manSvg 的頭、身體、眼睛、嘴(class `<前綴>-m-…`) */
export function mountManFace(root: ParentNode, k = 'ao'): ManFace {
  const q = <E extends Element>(s: string): E => root.querySelector<E>(`.${k}-m-${s}`)!
  return { head: q('head'), body: q('body'), eye: q('eye'), mouth: q('mouth') }
}
/** 每格:嘴(說話時張合)、呼吸、頭(headRot 度 + 微晃,繞脖子 neck)、眨眼;talking 是正在說話 */
export function renderManFace(f: ManFace, neck: Pt, ms: number, talking: boolean, headRot: number): void {
  const mouth = talking ? 2 + 5 * Math.abs(kit.noise(ms / 85, 31)) : 0
  attr(f.mouth, 'd', `M1596 352 Q1606 ${fx(354 + mouth, 1)} 1616 352`)
  const breathe = Math.sin(ms / 1700) * 1.6
  attr(f.head, 'transform', `rotate(${fx(headRot + kit.noise(ms / 2600, 33) * 1.2, 2)} ${neck.x} ${neck.y}) translate(0 ${fx(breathe * 0.6, 2)})`)
  attr(f.body, 'transform', `translate(0 ${fx(breathe, 2)})`)
  attr(f.eye, 'transform', `translate(0 ${fx(297 * (1 - (ms % 3700 < 120 ? 0.1 : 1)), 2)}) scale(1 ${ms % 3700 < 120 ? 0.1 : 1})`)
}
