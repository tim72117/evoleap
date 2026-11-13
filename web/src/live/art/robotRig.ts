// art/robotRig:白色機器人(robotSvg)的「頭、臉罩、眼睛、耳燈」與兩隻手臂的操控 —— 每格依時間改屬性。
// 公式與 agent-office 完全一樣(同一個時間畫出一樣的畫面),抽出來給別的場景(例如 manual-office)用,agent-office 之後可以改用。
import { kit } from '../kit'
import { attr, fx } from './dom'
import { drawRobotArm, type BotLayout } from './characters'
import type { Pt } from './geometry'

/** 頭的方向:yaw 0 面向鏡頭、負的往左(螢幕)、正的往右(人);pitch 正的低頭;tilt 歪頭(度) */
export type BotLook = { yaw: number; pitch: number; tilt: number }
export const mixLook = (a: BotLook, b: BotLook, p: number): BotLook => ({ yaw: kit.lerp(a.yaw, b.yaw, p), pitch: kit.lerp(a.pitch, b.pitch, p), tilt: kit.lerp(a.tilt, b.tilt, p) })

export interface BotRig {
  head: SVGGElement
  face: SVGGElement
  eyes: SVGGElement
  eyeRects: SVGRectElement[]
  eyeGlows: SVGEllipseElement[]
  scan: SVGRectElement
  earR: SVGGElement
  earL: SVGGElement
  earGlows: SVGEllipseElement[]
  seam: SVGPathElement
  halo: SVGEllipseElement
  core: SVGGElement
  body: SVGGElement
}
export function mountBotRig(root: ParentNode, k = 'ao'): BotRig {
  const q = <E extends Element>(s: string): E => root.querySelector<E>(`.${k}-r-${s}`)!
  const qa = <E extends Element>(s: string): E[] => [...root.querySelectorAll<E>(`.${k}-r-${s}`)]
  return {
    head: q('head'),
    face: q('face'),
    eyes: q('eyes'),
    eyeRects: qa('eye'),
    eyeGlows: qa('eyeglow'),
    scan: q('scan'),
    earR: q('earR'),
    earL: q('earL'),
    earGlows: qa('earglow'),
    seam: q('seam'),
    halo: q('halo'),
    core: q('core'),
    body: q('body'),
  }
}

export interface BotRender {
  look: BotLook
  ms: number
  /** 眼睛發光 0–1(0 = 關機) */
  glow: number
  /** 眼睛縮放(眨眼 / 被拒絕時瞇起來):scaleY,預設依 ms 眨眼 */
  eyeScale?: number
  eyeColor?: string
  /** 耳燈整體亮度倍率(預設 1;關機時 0) */
  earMul?: number
  /** 耳燈亮度 0–1 */
  ear: number
  /** 臉罩上掃過的光 0–1 */
  scan?: number
  /** 頭外面一圈圈光的相位 0–1(null / 沒給 = 沒有) */
  halo?: number | null
  /** 胸口燈條亮度 0–1 */
  core: number
}
/** 眨眼:每 4300ms 一次、持續 110ms */
export const botBlink = (ms: number): number => (ms % 4300 < 110 ? 0.15 : 1)

export function renderBotRig(rig: BotRig, BOT: BotLayout, o: BotRender): void {
  const { look, ms } = o
  const idleYaw = kit.noise(ms / 2400, 21) * 0.04
  const idleBob = kit.noise(ms / 1800, 22) * 2.2
  const yaw = look.yaw + idleYaw
  const H = BOT.head
  attr(rig.head, 'transform', `rotate(${fx(look.tilt, 2)} ${BOT.neck.x} ${BOT.neck.y}) translate(0 ${fx(look.pitch * 26 + idleBob, 2)})`)
  const faceX = H.x + Math.sin(yaw) * BOT.rx * 0.5
  const faceY = H.y + 12 + look.pitch * 40
  const faceSx = 0.36 + 0.62 * Math.cos(yaw)
  attr(rig.face, 'transform', `translate(${fx(faceX, 1)} ${fx(faceY, 1)}) scale(${fx(faceSx, 3)} 1)`)
  const earPos = (side: 1 | -1): { x: number; depth: number } => ({ x: H.x + side * Math.cos(yaw) * BOT.rx * 0.9, depth: -side * Math.sin(yaw) })
  for (const [el, side] of [
    [rig.earR, 1],
    [rig.earL, -1],
  ] as const) {
    const e = earPos(side)
    attr(el, 'transform', `translate(${fx(e.x, 1)} ${fx(H.y + 6 + look.pitch * 20, 1)}) scale(${fx(Math.max(0.06, e.depth), 3)} 1)`)
    attr(el, 'opacity', fx(kit.clamp(e.depth * 5), 3))
  }
  const seamOff = BOT.rx * Math.sin(yaw + 1.3)
  attr(rig.seam, 'd', `M${H.x} ${H.y - BOT.ry + 4} Q${fx(H.x + seamOff * 2, 1)} ${H.y} ${H.x} ${H.y + BOT.ry - 4}`)
  attr(rig.seam, 'opacity', fx(kit.clamp(Math.cos(yaw + 1.3) * 3) * 0.8, 2))
  rig.eyeRects.forEach((el) => attr(el, 'fill', o.eyeColor ?? '#bdf3ff'))
  rig.eyeGlows.forEach((el) => attr(el, 'opacity', fx(o.glow, 3)))
  attr(rig.eyes, 'transform', `scale(1 ${fx(o.eyeScale ?? botBlink(ms), 3)})`)
  rig.earGlows.forEach((el) => attr(el, 'opacity', fx((0.55 + 0.45 * o.ear) * (o.earMul ?? 1), 3)))
  const scan = o.scan ?? 0
  attr(rig.scan, 'opacity', scan > 0 ? '0.75' : '0')
  attr(rig.scan, 'x', fx(-4 + Math.sin(ms / 260) * 54, 1))
  const haloP = o.halo ?? 0
  attr(rig.halo, 'opacity', fx(o.halo != null ? (1 - haloP) * 0.6 : 0, 3))
  attr(rig.halo, 'transform', `translate(${H.x} ${H.y}) scale(${fx(0.92 + haloP * 0.22, 3)}) translate(${-H.x} ${-H.y})`)
  attr(rig.core, 'opacity', fx(o.core, 3))
}

type ArmParts = Parameters<typeof drawRobotArm>[0]
export interface BotArms {
  near: ArmParts
  far: ArmParts
  nearFingers: SVGGElement[]
  farFingers: SVGGElement[]
}
export function mountBotArms(root: ParentNode, k = 'ao'): BotArms {
  const q = <E extends Element>(s: string): E => root.querySelector<E>(`.${k}-r-${s}`)!
  const near = {
    up: q<SVGPathElement>('up'),
    upShine: q<SVGPathElement>('upshine'),
    elbow: q<SVGCircleElement>('elbow'),
    elbowLight: q<SVGCircleElement>('elbowlight'),
    fore: q<SVGPathElement>('fore'),
    foreShine: q<SVGPathElement>('foreshine'),
    hand: q<SVGGElement>('hand'),
  }
  const far = { up: q<SVGPathElement>('farup'), elbow: q<SVGCircleElement>('farelbow'), fore: q<SVGPathElement>('farfore'), hand: q<SVGGElement>('farhand') }
  return { near, far, nearFingers: [...near.hand.querySelectorAll<SVGGElement>(`.${k}-f`)], farFingers: [...far.hand.querySelectorAll<SVGGElement>(`.${k}-f`)] }
}
/** 兩隻手臂一起畫(參數同 agent-office:遠側 [30,24,18]×0.9、近側 [40,32,22]×1.05);typingNear 是近側的打字強度 */
export function renderBotArms(a: BotArms, BOT: BotLayout, ARM: { near: readonly [number, number]; far: readonly [number, number] }, tNear: Pt, tFar: Pt, typing: number, typingNear: number, ms: number): void {
  drawRobotArm(a.far, a.farFingers, BOT.farShoulder, tFar, ARM.far, [30, 24, 18], 0.9, typing, ms, 0.7)
  drawRobotArm(a.near, a.nearFingers, BOT.nearShoulder, tNear, ARM.near, [40, 32, 22], 1.05, typingNear, ms, 0)
}
