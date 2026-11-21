// 演員 bobo:兒童繪本的主角「波波」,一隻愛玩的小熊。整個繪本都是動畫(不用字卡):
// 四個場景(公園、家裡的餐桌、浴室、臥室)跟著 go 換頁,小熊在場景裡玩、吃飯、睡覺、洗澡、刷牙、換衣服,
// 身上的泥巴、沙子、嘴角的餅乾屑、牙齒上黏黏的那層、泡泡、濕答答的毛,都是狀態,由動作一步步改變。
// 所有畫面由 render 依時間算出(SPEC 第 1 節:不用 CSS transition/animation、不用 Math.random)。
// place 用 "full";橫式看整個場景,直式只看中間那一條(會互動的東西都放在中間)。
//
// props:
//   scene     一開始在哪裡:park(預設)、home、bath、bed
//   clothes   一開始穿什麼:overall(黃色吊帶褲,預設)、pajamas(睡衣)
//
// 動作(操作式;對不上狀態時載入就報錯):
//   { "go": "park" | "home" | "bath" | "bed" }   翻到下一頁:畫面淡出再淡入,小熊出現在那個場景
//   { "play": "puddle" | "sand" | "roll" }       在公園玩:跳水坑(濺泥巴)、挖沙(沙子跑進耳朵、指甲縫)、在草地上打滾(只能在 park)
//   { "eat": true }                              在餐桌吃鬆餅和玉米:嘴角沾到屑屑,牙齒黏黏的(只能在 home)
//   { "say": "台詞", "mood": "happy" }           說一句話(泡泡逐字出現);mood:calm、happy、laugh、grumpy、sleepy、curious、proud、itchy
//   { "sleep": true }                            爬上床、蓋被子睡覺(只能在 bed;身上有沙子時床單會沾到沙)
//   { "toss": "itch" | "teeth" }                 睡不著翻來翻去:itch 身上癢、teeth 舌頭舔到牙齒黏黏的(要在床上)
//   { "getup": true }                            起床,站到床邊(要在床上)
//   { "tidy": true }                             把床單上的沙子拍掉(要下床、床單上有沙)
//   { "mirror": true }                           照鏡子,看到自己臉上的泥巴(只能在 bath)
//   { "undress": true }                          脫下衣服,丟進洗衣籃(只能在 bath)
//   { "wash": "water" | "soap" | "rinse" | "dry" } 洗澡:淋濕 → 抹肥皂搓泡泡 → 沖乾淨(泥巴、沙子、屑屑都沖走)→ 用毛巾擦乾(毛變蓬)
//                                                 (要先 undress;順序要對)
//   { "brush": "top" | "bottom" | "inside" | "chew" | "rinse" } 刷牙:上排、下排、裡面、咬東西的那一面,每刷一處黏黏的少一些;rinse 漱口吐掉
//   { "dress": "pajamas" | "overall" }           換上衣服(轉一圈換好;身上濕的要先擦乾)
//
// 目標:window、bear、face、mouth、bubble、puddle、sandbox、table、tub、sink、mirror、basket、bed
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import { makeKindIn } from '../../art/actorKit'
import { attr } from '../../art/dom'
import {
  BODY_MUD, FUR, FUR_WET, OVERALL, PAJAMAS, SAND, VIEW,
  bathFrontSvg, bathSvg, bearSvg, bedFrontSvg, bedSvg, faceSvg, homeFrontSvg, homeSvg, parkSvg,
  type Face,
} from './art'
import './actor.css'

// ---------- 型別 ----------
export const SCENES = ['park', 'home', 'bath', 'bed'] as const
export type Scene = (typeof SCENES)[number]
export const KINDS = ['go', 'play', 'eat', 'say', 'sleep', 'toss', 'getup', 'tidy', 'mirror', 'undress', 'wash', 'brush', 'dress'] as const
export type Kind = (typeof KINDS)[number]
export const MOODS = ['calm', 'happy', 'laugh', 'grumpy', 'sleepy', 'curious', 'proud', 'itchy'] as const
export type Mood = (typeof MOODS)[number]
type Play = 'puddle' | 'sand' | 'roll'
type Wash = 'water' | 'soap' | 'rinse' | 'dry'
type Brush = 'top' | 'bottom' | 'inside' | 'chew' | 'rinse'
type Clothes = 'overall' | 'pajamas' | 'none'
type Spot = 'grass' | 'puddle' | 'sand' | 'table' | 'floor' | 'tub' | 'sink' | 'bed'

export type BoboStep = CommonStepFields & {
  go?: Scene
  play?: Play
  eat?: true
  say?: string
  mood?: Mood
  sleep?: true
  toss?: 'itch' | 'teeth'
  getup?: true
  tidy?: true
  mirror?: true
  undress?: true
  wash?: Wash
  brush?: Brush
  dress?: 'pajamas' | 'overall'
}
export interface BoboProps {
  scene?: Scene
  clothes?: 'overall' | 'pajamas'
}
export type Target = 'window' | 'bear' | 'face' | 'mouth' | 'bubble' | 'puddle' | 'sandbox' | 'table' | 'tub' | 'sink' | 'mirror' | 'basket' | 'bed'

export interface BoboState {
  scene: Scene
  spot: Spot
  /** 身上的泥巴 0–1 */
  dirt: number
  /** 耳朵、指甲縫裡的沙 0–1 */
  sand: number
  crumbs: boolean
  /** 牙齒上黏黏的那層 0–1 */
  teeth: number
  brushed: Brush[]
  ate: boolean
  clothes: Clothes
  laundry: boolean
  inBed: boolean
  sheetSand: boolean
  wet: boolean
  foam: boolean
  fluffy: boolean
  mood: Mood
  temp: Record<string, never>
}

// ---------- 時間表(毫秒,相對動作開始) ----------
export const T = {
  go: 1600,
  puddle: 3400, sand: 3400, roll: 2800,
  eat: 3600,
  sayIn: 300, sayCps: 7, sayHold: 1500,
  sleep: 2600, toss: 3400, getup: 1600, tidy: 2800,
  mirror: 3000, undress: 2200,
  water: 3000, soap: 3800, rinse: 3200, dry: 3000,
  brush: 2600, mouthRinse: 2800,
  dress: 2200,
}

const DEFAULT_SPOT: Record<Scene, Spot> = { park: 'grass', home: 'table', bath: 'floor', bed: 'floor' }

export function naturalDuration(kind: Kind, step: BoboStep): number {
  switch (kind) {
    case 'go': return T.go
    case 'play': return T[(step.play ?? 'puddle') as Play]
    case 'eat': return T.eat
    case 'say': return T.sayIn + kit.typeDuration(step.say ?? '', T.sayCps) + T.sayHold
    case 'sleep': return T.sleep
    case 'toss': return T.toss
    case 'getup': return T.getup
    case 'tidy': return T.tidy
    case 'mirror': return T.mirror
    case 'undress': return T.undress
    case 'wash': return T[(step.wash ?? 'water') as Wash]
    case 'brush': return step.brush === 'rinse' ? T.mouthRinse : T.brush
    case 'dress': return T.dress
  }
}

// ---------- 狀態 ----------
export function initState(props: BoboProps): BoboState {
  const scene = props.scene ?? 'park'
  if (!SCENES.includes(scene)) throw new Error(`bobo 的 scene 只能是 ${SCENES.join('、')}`)
  const clothes = props.clothes ?? 'overall'
  if (clothes !== 'overall' && clothes !== 'pajamas') throw new Error('bobo 的 clothes 只能是 overall 或 pajamas')
  return {
    scene, spot: DEFAULT_SPOT[scene], dirt: 0, sand: 0, crumbs: false, teeth: 0, brushed: [], ate: false,
    clothes, laundry: false, inBed: false, sheetSand: false, wet: false, foam: false, fluffy: false, mood: 'calm', temp: {},
  }
}

const need = (ok: boolean, msg: string) => {
  if (!ok) throw new Error(msg)
}
const oneOf = <V extends string>(v: unknown, list: readonly V[], name: string): V => {
  if (!list.includes(v as V)) throw new Error(`${name} 只能是 ${list.join('、')}`)
  return v as V
}

export function apply(s: BoboState, kind: Kind, step: BoboStep): BoboState {
  switch (kind) {
    case 'go': {
      const scene = oneOf(step.go, SCENES, 'go')
      need(scene !== s.scene, `已經在 ${scene} 了`)
      need(!s.inBed, '還躺在床上,要先 getup')
      return { ...s, scene, spot: DEFAULT_SPOT[scene], mood: 'calm' }
    }
    case 'play': {
      const play = oneOf(step.play, ['puddle', 'sand', 'roll'] as const, 'play')
      need(s.scene === 'park', 'play 只能在公園(park)')
      need(s.clothes !== 'none', '沒穿衣服不能出去玩')
      const add = { puddle: [0.45, 0], sand: [0.15, 1], roll: [0.4, 0.3] }[play]
      return {
        ...s, spot: play === 'roll' ? 'grass' : play, dirt: Math.min(1, s.dirt + add[0]), sand: Math.min(1, s.sand + add[1]),
        wet: false, fluffy: false, mood: 'happy',
      }
    }
    case 'eat':
      need(s.scene === 'home', 'eat 只能在家裡的餐桌(home)')
      need(!s.ate, '已經吃完了')
      return { ...s, crumbs: true, teeth: 1, brushed: [], ate: true, mood: 'happy' }
    case 'say':
      need(typeof step.say === 'string' && step.say.length > 0, 'say 要寫台詞')
      return { ...s, mood: step.mood ? oneOf(step.mood, MOODS, 'mood') : 'calm' }
    case 'sleep':
      need(s.scene === 'bed', 'sleep 只能在臥室(bed)')
      need(!s.inBed, '已經在床上了')
      return { ...s, inBed: true, spot: 'bed', sheetSand: s.sheetSand || s.sand > 0 || s.dirt > 0.3, mood: 'sleepy' }
    case 'toss':
      oneOf(step.toss, ['itch', 'teeth'] as const, 'toss')
      need(s.inBed, 'toss 要躺在床上')
      return { ...s, mood: step.toss === 'itch' ? 'itchy' : 'curious' }
    case 'getup':
      need(s.inBed, '沒有躺在床上')
      return { ...s, inBed: false, spot: 'floor', mood: 'calm' }
    case 'tidy':
      need(s.scene === 'bed' && !s.inBed, 'tidy 要在臥室、下了床')
      need(s.sheetSand, '床單上沒有沙子')
      return { ...s, sheetSand: false, mood: 'calm' }
    case 'mirror':
      need(s.scene === 'bath', 'mirror 只能在浴室(bath)')
      return { ...s, spot: 'sink', mood: 'laugh' }
    case 'undress':
      need(s.scene === 'bath', 'undress 只能在浴室(bath)')
      need(s.clothes !== 'none', '已經沒穿衣服了')
      return { ...s, spot: 'floor', clothes: 'none', laundry: true, mood: 'calm' }
    case 'wash': {
      const w = oneOf(step.wash, ['water', 'soap', 'rinse', 'dry'] as const, 'wash')
      need(s.scene === 'bath', 'wash 只能在浴室(bath)')
      need(s.clothes === 'none', '洗澡前要先 undress')
      if (w === 'water') return { ...s, spot: 'tub', wet: true, fluffy: false, mood: 'happy' }
      if (w === 'soap') {
        need(s.wet, '抹肥皂前要先 wash: water')
        return { ...s, spot: 'tub', foam: true, mood: 'laugh' }
      }
      if (w === 'rinse') {
        need(s.foam, '沖水前要先 wash: soap')
        return { ...s, spot: 'tub', foam: false, dirt: 0, sand: 0, crumbs: false, mood: 'happy' }
      }
      need(s.wet && !s.foam, '擦乾前要先沖乾淨')
      return { ...s, spot: 'floor', wet: false, fluffy: true, mood: 'happy' }
    }
    case 'brush': {
      const b = oneOf(step.brush, ['top', 'bottom', 'inside', 'chew', 'rinse'] as const, 'brush')
      need(s.scene === 'bath', 'brush 只能在浴室(bath)')
      need(!s.foam, '身上還有泡泡')
      if (b === 'rinse') {
        need(s.brushed.length > 0, '漱口前要先刷牙')
        return { ...s, spot: 'sink', teeth: s.brushed.length >= 4 ? 0 : s.teeth, mood: 'happy' }
      }
      const brushed = s.brushed.includes(b) ? s.brushed : [...s.brushed, b]
      return { ...s, spot: 'sink', brushed, teeth: Math.max(0, 1 - brushed.length * 0.25) * (s.teeth > 0 ? 1 : 0), mood: 'calm' }
    }
    case 'dress': {
      const c = oneOf(step.dress, ['pajamas', 'overall'] as const, 'dress')
      need(c !== s.clothes, `已經穿著 ${c} 了`)
      need(!s.wet, '要先擦乾(wash: dry)')
      return { ...s, spot: s.scene === 'bed' ? 'floor' : s.spot === 'tub' ? 'floor' : s.spot, clothes: c, mood: 'happy' }
    }
  }
}

// ---------- 姿勢 ----------
export interface Pose {
  x: number
  y: number
  s: number
  /** 整隻轉動(度);pivot 是轉動中心離地多高 */
  rot: number
  pivot: number
  /** 左右鏡像(轉圈時 -1–1) */
  sx: number
  /** 上下壓扁 */
  sq: number
  /** 手臂往外的角度(度;0 是垂下、160 是舉高、負的是往身體中間),k 是手臂長度比例 */
  aL: number
  aR: number
  kL: number
  kR: number
  /** 頭歪的角度 */
  tilt: number
  hop: number
  legL: number
  legR: number
}

const SPOTS: Record<Scene, Partial<Record<Spot, { x: number; y: number; s: number }>>> = {
  park: { grass: { x: 960, y: 968, s: 1 }, puddle: { x: 800, y: 950, s: 1 }, sand: { x: 1185, y: 935, s: 0.95 } },
  home: { table: { x: 960, y: 905, s: 0.95 } },
  bath: { floor: { x: 1170, y: 968, s: 0.9 }, tub: { x: 700, y: 838, s: 0.9 }, sink: { x: 1140, y: 962, s: 0.9 } },
  bed: { floor: { x: 980, y: 1010, s: 0.85 }, bed: { x: 990, y: 772, s: 0.8 } },
}

const base = (scene: Scene, spot: Spot): Pose => {
  const p = SPOTS[scene][spot] ?? SPOTS[scene][DEFAULT_SPOT[scene]]!
  const lying = spot === 'bed'
  return { x: p.x, y: p.y, s: p.s, rot: lying ? -90 : 0, pivot: 0, sx: 1, sq: 1, aL: 14, aR: 14, kL: 1, kR: 1, tilt: lying ? -8 : 0, hop: 0, legL: 0, legR: 0 }
}

const mixPose = (a: Pose, b: Pose, p: number): Pose => {
  const o = { ...a }
  for (const k of Object.keys(a) as (keyof Pose)[]) o[k] = kit.lerp(a[k], b[k], p)
  return o
}

/** 小熊身上的一點(身體座標)在世界的位置 */
export function toWorld(pose: Pose, lx: number, ly: number): [number, number] {
  const a = (pose.rot * Math.PI) / 180
  const x = lx * pose.s * pose.sx
  const y = (ly + pose.pivot) * pose.s * pose.sq
  return [pose.x + x * Math.cos(a) - y * Math.sin(a), pose.y - pose.hop - pose.pivot * pose.s + x * Math.sin(a) + y * Math.cos(a)]
}

// ---------- 一格畫面要用的資料(純函式) ----------
export interface Look {
  scene: Scene
  /** 換頁的白幕 0–1 */
  fade: number
  pose: Pose
  face: Face
  talk: boolean
  dirt: number
  sand: number
  crumbs: number
  film: number
  mouthFoam: number
  /** 咀嚼開合、舌頭左右 */
  chew: number
  lick: number
  foam: number
  wet: boolean
  fluff: number
  clothes: Clothes
  laundry: number
  /** 丟向洗衣籃的衣服:世界座標 */
  fly: { x: number; y: number; r: number } | null
  towel: number
  held: 'brush' | 'cup' | 'cake' | null
  heldR: number
  heldDx: number
  heldDy: number
  lying: number
  blanketWig: number
  sheetSand: number
  food: number
  rackTowel: boolean
  holderBrush: boolean
  bubble: { text: string; p: number } | null
  /** 粒子等特效的 SVG(世界座標) */
  fx: string
}

const tri = (p: number) => (p < 0.5 ? p * 2 : 2 - p * 2)
const between = (l: number, a: number, b: number) => kit.clamp((l - a) / (b - a))

function idle(pose: Pose, ms: number): Pose {
  const breathe = Math.sin(ms / 620)
  return { ...pose, sq: pose.sq * (1 + 0.012 * breathe), tilt: pose.tilt + 2.2 * Math.sin(ms / 1700), aL: pose.aL + 2 * breathe, aR: pose.aR + 2 * breathe }
}

const moodFace = (m: Mood): Face => (m === 'itchy' ? 'itchy' : m)

/** 濺起的水滴/泥巴/沙子:從 (x,y) 往外拋 */
function burst(seed: number, x: number, y: number, p: number, n: number, color: string, spread = 160, lift = 180, r = 9): string {
  if (p <= 0 || p >= 1) return ''
  const R = kit.rand(seed)
  let out = ''
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.1 + 0.8 * R())
    const v = 0.5 + R() * 0.7
    const dx = Math.cos(a) * spread * v * p
    const dy = Math.sin(a) * lift * v * p + 260 * p * p
    out += `<circle cx="${(x + dx).toFixed(1)}" cy="${(y + dy).toFixed(1)}" r="${(r * (1 - p * 0.5) * (0.6 + R() * 0.6)).toFixed(1)}" fill="${color}" opacity="${(1 - p * 0.6).toFixed(2)}"/>`
  }
  return out
}

/** 往上飄的泡泡 */
function bubbles(seed: number, x: number, y: number, l: number, n: number, w: number): string {
  const R = kit.rand(seed)
  let out = ''
  for (let i = 0; i < n; i++) {
    const t0 = R() * 2400
    const life = 1600 + R() * 900
    const q = ((l - t0) % (life * 2)) / life
    if (l < t0 || q < 0 || q > 1) continue
    const bx = x + (R() - 0.5) * w + Math.sin(q * 6 + i) * 18
    const by = y - q * 340
    const r = 8 + R() * 16
    out += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r.toFixed(1)}" fill="#ffffff" fill-opacity=".35" stroke="#bfe6ff" stroke-width="3" opacity="${(1 - q * 0.7).toFixed(2)}"/>`
  }
  return out
}

/** 蓮蓬頭的水 */
function shower(l: number, on: number): string {
  if (on <= 0) return ''
  let out = ''
  for (let i = 0; i < 9; i++) {
    const x = 664 + i * 9
    const off = ((l * 0.9 + i * 37) % 90).toFixed(1)
    out += `<path d="M${x} 296 L${x - 30 + i * 7} 700" stroke="#8fd1f5" stroke-width="5" stroke-dasharray="34 56" stroke-dashoffset="${'-' + off}" opacity="${(0.85 * on).toFixed(2)}" stroke-linecap="round"/>`
  }
  return out
}

const star = (x: number, y: number, k: number, o: number) =>
  `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(2)})" d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z" fill="#fff6a8" opacity="${o.toFixed(2)}"/>`

export function lookOf(prev: BoboState, st: BoboState, kind: Kind | null, step: BoboStep, l: number, ms: number): Look {
  // 換頁前半段看舊的那頁
  const s = kind === 'go' && l < T.go / 2 ? prev : st
  let pose = base(s.scene, s.spot)
  const L: Look = {
    scene: s.scene, fade: 0, pose, face: moodFace(s.mood), talk: false,
    dirt: s.dirt, sand: s.sand, crumbs: s.crumbs ? 1 : 0, film: s.teeth, mouthFoam: 0, chew: 0, lick: 0, foam: s.foam ? 1 : 0, wet: s.wet, fluff: s.fluffy ? 1 : 0,
    clothes: s.clothes, laundry: s.laundry ? 1 : 0, fly: null, towel: 0, held: null, heldR: 0, heldDx: 0, heldDy: 0,
    lying: s.inBed ? 1 : 0, blanketWig: 0, sheetSand: s.sheetSand ? 1 : 0, food: s.ate ? 0 : 1, rackTowel: true, holderBrush: true, bubble: null, fx: '',
  }
  if (s.inBed) L.face = s.mood === 'sleepy' ? 'sleep' : moodFace(s.mood)
  let fx = ''
  let idleOn = true

  // 換位置(同一個場景裡走過去)
  const walkFrom = (until: number) => {
    if (kind === 'go' || prev.scene !== s.scene || prev.spot === s.spot || prev.inBed || st.inBed) return
    const e = kit.ease.inOutCubic(between(l, 0, until))
    const a = base(prev.scene, prev.spot)
    pose = mixPose(a, pose, e)
    if (e > 0 && e < 1) {
      const w = Math.sin((l / 140) * Math.PI)
      pose.hop = Math.abs(w) * 14
      pose.legL = Math.max(0, w) * 16
      pose.legR = Math.max(0, -w) * 16
    }
  }

  switch (kind) {
    case 'go': {
      L.fade = tri(between(l, 0, T.go))
      break
    }
    case 'play': {
      const play = step.play as Play
      if (play === 'puddle') {
        const from = base(prev.scene, prev.spot)
        let landed = 0
        for (let i = 0; i < 3; i++) {
          const q = between(l, 300 + i * 1000, 1100 + i * 1000)
          if (q >= 1) landed++
          if (q > 0 && q < 1) {
            pose.hop = Math.sin(Math.PI * q) * 150
            pose.aL = pose.aR = 30 + 110 * Math.sin(Math.PI * q)
            pose.sq = 1 + 0.06 * Math.sin(Math.PI * q)
            pose.legL = pose.legR = 20 * Math.sin(Math.PI * q)
          }
          const sp = between(l, 1100 + i * 1000, 1700 + i * 1000)
          fx += burst(31 + i, pose.x, 946, sp, 14, i % 2 ? '#8e6a48' : '#6f4a2c', 230, 260, 11)
          if (sp > 0 && sp < 0.3) pose.sq = 0.9
        }
        if (l < 1100) pose.x = kit.lerp(from.x, pose.x, kit.ease.inOutCubic(between(l, 300, 1100)))
        L.dirt = kit.lerp(prev.dirt, st.dirt, landed / 3)
        L.face = 'laugh'
      } else if (play === 'sand') {
        walkFrom(700)
        const q = between(l, 800, 3100)
        if (q > 0 && q < 1) {
          pose.sq = 0.9
          pose.aL = 10 + 60 * Math.max(0, Math.sin(l / 120))
          pose.aR = 10 + 60 * Math.max(0, Math.sin(l / 120 + Math.PI))
          pose.kL = pose.kR = 0.85
          for (let i = 0; i < 4; i++) fx += burst(50 + i, pose.x + (i % 2 ? 40 : -40), 900, ((l - 800 - i * 500) % 2000) / 900, 8, SAND, 200, 300, 7)
        }
        L.sand = kit.lerp(prev.sand, st.sand, q)
        L.dirt = kit.lerp(prev.dirt, st.dirt, q)
        L.face = 'happy'
      } else {
        const a = base(prev.scene, prev.spot)
        const e = kit.ease.inOutCubic(between(l, 300, 2400))
        const dir = pose.x >= a.x ? 1 : -1
        pose.x = kit.lerp(a.x, pose.x, e) + (a.x === pose.x ? 200 * Math.sin(Math.PI * e) : 0)
        pose.y = kit.lerp(a.y, pose.y, e)
        pose.rot = 360 * e * dir
        pose.pivot = 230
        pose.aL = pose.aR = 40
        if (e > 0 && e < 1) fx += burst(70 + Math.floor(l / 300), pose.x, 960, (l % 300) / 300, 5, '#6fae4c', 120, 140, 8)
        L.dirt = kit.lerp(prev.dirt, st.dirt, e)
        L.sand = kit.lerp(prev.sand, st.sand, e)
        L.face = 'laugh'
      }
      break
    }
    case 'eat': {
      let bites = 0
      L.face = 'happy'
      for (let i = 0; i < 3; i++) {
        const t0 = 300 + i * 1100
        const up = kit.ease.inOutCubic(between(l, t0, t0 + 380))
        const down = kit.ease.inOutCubic(between(l, t0 + 760, t0 + 1050))
        const r = up * (1 - down)
        if (l >= t0 + 380) bites = i + 1
        if (l >= t0 && l < t0 + 1050) {
          pose.aR = kit.lerp(14, -112, r)
          pose.kR = kit.lerp(1, 0.62, r)
          L.held = 'cake'
        }
        if (l > t0 + 380 && l < t0 + 1300) L.face = 'chew'
      }
      L.chew = Math.abs(Math.sin(l / 110))
      L.food = 1 - bites / 3
      L.crumbs = bites > 0 ? 1 : 0
      L.film = bites / 3
      break
    }
    case 'say': {
      const text = step.say ?? ''
      const tw = kit.typewriter(text, l, { start: T.sayIn, cps: T.sayCps })
      const talkEnd = T.sayIn + kit.typeDuration(text, T.sayCps)
      L.talk = l > T.sayIn && l < talkEnd && Math.floor((l - T.sayIn) / 140) % 2 === 0
      L.bubble = { text: tw.text, p: kit.ease.outBack(between(l, 0, T.sayIn)) }
      const m = st.mood
      if (!s.inBed) {
        if (m === 'happy' || m === 'laugh') pose.hop = Math.abs(Math.sin(l / 260)) * 10
        if (m === 'proud') { pose.aL = pose.aR = 150; pose.hop = Math.abs(Math.sin(l / 240)) * 16 }
        if (m === 'grumpy') { pose.aL = pose.aR = -46; pose.kL = pose.kR = 0.8; pose.tilt = -6 }
        if (m === 'curious') { pose.aR = -120; pose.kR = 0.62; pose.tilt = 8 }
        if (m === 'sleepy') { pose.tilt = 10; pose.sq = 0.97 }
        if (m === 'itchy') { pose.aL = 100 + 20 * Math.sin(l / 70); pose.kL = 0.7 }
      }
      break
    }
    case 'sleep': {
      const from = prev.inBed ? base('bed', 'bed') : base(prev.scene, prev.spot)
      const e = kit.ease.inOutCubic(between(l, 0, 1400))
      pose = mixPose(from, base('bed', 'bed'), e)
      pose.hop = Math.sin(Math.PI * e) * 120
      L.lying = e >= 0.5 ? 1 : 0
      L.face = l < 1500 ? 'sleepy' : 'sleep'
      L.sheetSand = l > 1400 ? (st.sheetSand ? 1 : 0) : prev.sheetSand ? 1 : 0
      idleOn = false
      break
    }
    case 'toss': {
      const w = Math.sin((l / T.toss) * Math.PI * 4)
      pose.rot = -90 + 7 * w
      pose.tilt = -8 + 22 * Math.sin((l / T.toss) * Math.PI * 3)
      L.blanketWig = w
      if (step.toss === 'itch') {
        L.face = 'itchy'
        const R = kit.rand(Math.floor(l / 220) + 5)
        for (let i = 0; i < 3; i++) {
          const x = 860 + R() * 380
          const y = 690 + R() * 40
          fx += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} l12 -14 l12 14 l12 -14 l12 14" stroke="#ff7a6b" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        }
        if (st.sheetSand) for (let i = 0; i < 4; i++) fx += star(840 + i * 110, 776 + (i % 2) * 14, 0.6 + 0.4 * Math.abs(Math.sin(l / 200 + i)), 0.9)
      } else {
        L.face = 'tongue'
        L.lick = Math.sin(l / 200)
      }
      idleOn = false
      break
    }
    case 'getup': {
      const e = kit.ease.inOutCubic(between(l, 0, 1400))
      pose = mixPose(base('bed', 'bed'), base('bed', 'floor'), e)
      pose.hop = Math.sin(Math.PI * e) * 120
      L.lying = e < 0.5 ? 1 : 0
      L.face = 'calm'
      break
    }
    case 'tidy': {
      const q = between(l, 300, 2500)
      pose.aL = pose.aR = 110 + 40 * Math.sin(l / 90) * (q > 0 && q < 1 ? 1 : 0)
      pose.kL = pose.kR = 0.85
      L.blanketWig = q > 0 && q < 1 ? Math.sin(l / 90) : 0
      L.sheetSand = 1 - q
      if (q > 0 && q < 1) for (let i = 0; i < 3; i++) fx += burst(90 + i, 900 + i * 140, 780, ((l - 300 + i * 260) % 900) / 900, 6, SAND, 100, 40, 5)
      break
    }
    case 'mirror': {
      walkFrom(600)
      const q = between(l, 600, 3000)
      pose.tilt = 12
      pose.aR = 30
      L.face = q < 0.4 ? 'curious' : 'laugh'
      if (q >= 0.4) pose.hop = Math.abs(Math.sin(l / 200)) * 8
      break
    }
    case 'undress': {
      walkFrom(400)
      const up = kit.ease.inOutCubic(between(l, 300, 900))
      const down = kit.ease.inOutCubic(between(l, 1000, 1500))
      pose.aL = pose.aR = kit.lerp(14, 165, up * (1 - down))
      L.clothes = l < 950 ? prev.clothes : 'none'
      const f = between(l, 950, 1900)
      if (f > 0 && f < 1) {
        const [x0, y0] = toWorld(pose, 0, -420)
        const x1 = 940
        const y1 = 900
        const e = kit.ease.inOutQuad(f)
        L.fly = { x: kit.lerp(x0, x1, e), y: kit.lerp(y0, y1, e) - Math.sin(Math.PI * f) * 200, r: f * 300 }
      }
      L.laundry = f >= 1 ? 1 : prev.laundry ? 1 : 0
      break
    }
    case 'wash': {
      const w = step.wash as Wash
      if (w === 'water' || w === 'rinse') {
        if (w === 'water') walkFrom(900)
        const on = between(l, w === 'water' ? 900 : 200, w === 'water' ? 1200 : 500) * (1 - between(l, T[w] - 400, T[w] - 100))
        fx += shower(l, on)
        pose.aL = pose.aR = 50 + 30 * Math.sin(l / 160)
        L.face = 'happy'
        L.wet = l > 1000 || prev.wet
        if (w === 'rinse') {
          const q = between(l, 400, 2600)
          L.foam = 1 - q
          L.dirt = kit.lerp(prev.dirt, 0, q)
          L.sand = kit.lerp(prev.sand, 0, q)
          L.crumbs = prev.crumbs ? 1 - q : 0
          // 泥巴順著水流走
          fx += burst(120 + Math.floor(l / 400), pose.x, 700, (l % 400) / 400, prev.dirt > 0 ? 4 : 0, '#8e6a48', 80, 10, 6)
        }
      } else if (w === 'soap') {
        const q = between(l, 200, 2600)
        L.foam = q
        pose.aL = -30 + 50 * Math.sin(l / 140)
        pose.aR = -30 + 50 * Math.sin(l / 140 + Math.PI)
        pose.kL = pose.kR = 0.8
        L.face = 'laugh'
        fx += bubbles(130, pose.x, 600, l, 14, 300)
      } else {
        walkFrom(800)
        const q = between(l, 800, 2800)
        L.towel = q > 0 && q < 1 ? 1 : 0
        L.rackTowel = false
        if (q > 0 && q < 1) {
          pose.aL = 150 + 16 * Math.sin(l / 90)
          pose.aR = 150 + 16 * Math.sin(l / 90 + Math.PI)
          pose.kL = pose.kR = 0.7
          pose.tilt = 6 * Math.sin(l / 120)
        }
        L.wet = q < 0.6
        L.fluff = between(l, 2200, 2800)
        L.face = 'happy'
      }
      break
    }
    case 'brush': {
      walkFrom(600)
      const b = step.brush as Brush
      if (b === 'rinse') {
        const up = kit.ease.inOutCubic(between(l, 300, 800))
        const down = kit.ease.inOutCubic(between(l, 1200, 1500))
        pose.aL = kit.lerp(14, -112, up * (1 - down))
        pose.kL = kit.lerp(1, 0.62, up * (1 - down))
        L.held = 'cup'
        L.holderBrush = true
        L.face = l < 900 ? 'brush' : l < 1900 ? 'puff' : 'happy'
        L.film = l < 1900 ? prev.teeth : st.teeth
        L.mouthFoam = l < 900 ? 0.8 : 0
        // 吐掉
        const sp = between(l, 1900, 2400)
        const [mx, my] = toWorld(pose, 0, -256)
        if (sp > 0 && sp < 1) {
          for (let i = 0; i < 6; i++) {
            const q = kit.clamp(sp * 1.3 - i * 0.06)
            fx += `<circle cx="${kit.lerp(mx + 30, 1300, q).toFixed(1)}" cy="${(kit.lerp(my, 640, q) - Math.sin(Math.PI * q) * 80).toFixed(1)}" r="7" fill="#bfe6ff" opacity="${(1 - q * 0.4).toFixed(2)}"/>`
          }
        }
        if (l > 2300) {
          const g = between(l, 2300, 2800)
          fx += star(mx - 70, my - 30, 0.6 + 0.5 * tri(g), tri(g)) + star(mx + 80, my - 10, 0.5 + 0.5 * tri(g), tri(g))
        }
      } else {
        const up = kit.ease.inOutCubic(between(l, 400, 800))
        const down = kit.ease.inOutCubic(between(l, 2200, 2550))
        const r = up * (1 - down)
        const scrub = r * Math.sin(l / 55)
        pose.aR = kit.lerp(14, -110, r) + scrub * 3
        pose.kR = kit.lerp(1, 0.6, r)
        pose.aL = 14
        L.held = 'brush'
        L.holderBrush = false
        L.heldDx = scrub * 10
        L.heldDy = b === 'top' ? -10 : b === 'bottom' ? 12 : b === 'chew' ? 0 : 2
        L.heldR = b === 'inside' ? 28 : b === 'chew' ? -22 : 0
        L.face = r > 0.5 ? 'brush' : 'calm'
        const q = between(l, 800, 2200)
        L.film = kit.lerp(prev.teeth, st.teeth, q)
        L.mouthFoam = q > 0 ? Math.min(1, q * 2) * (1 - down) : 0
      }
      break
    }
    case 'dress': {
      walkFrom(400)
      const q = between(l, 400, 1700)
      pose.sx = q > 0 && q < 1 ? Math.cos(q * Math.PI * 2) : 1
      if (Math.abs(pose.sx) < 0.12) pose.sx = pose.sx < 0 ? -0.12 : 0.12
      L.clothes = q < 0.5 ? prev.clothes : st.clothes
      const g = between(l, 1500, 2200)
      if (g > 0 && g < 1) for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + g * 2
        const [cx, cy] = toWorld(pose, 0, -230)
        fx += star(cx + Math.cos(a) * 210 * (0.6 + g * 0.4), cy + Math.sin(a) * 210 * (0.6 + g * 0.4), 0.5 + 0.6 * tri(g), tri(g))
      }
      L.face = 'proud'
      break
    }
    default:
      break
  }
  // 停在原地時的呼吸、眨眼
  if (idleOn) pose = idle(pose, ms)
  // 身上濕答答:水滴往下掉
  if (L.wet && L.scene === 'bath') {
    const R = kit.rand(7)
    for (let i = 0; i < 5; i++) {
      const q = ((ms + R() * 1400) % 1400) / 1400
      const [dx, dy] = toWorld(pose, (R() - 0.5) * 220, -60 - R() * 300)
      fx += `<path transform="translate(${dx.toFixed(1)} ${(dy + q * 120).toFixed(1)})" d="M0 -10 C-6 0 -6 6 0 8 C6 6 6 0 0 -10 Z" fill="#8fd1f5" opacity="${(1 - q).toFixed(2)}"/>`
    }
  }
  // 睡著了:Z 往上飄
  if (L.lying && L.face === 'sleep') {
    for (let i = 0; i < 3; i++) {
      const q = ((ms + i * 900) % 2700) / 2700
      const [hx, hy] = toWorld(pose, 0, -460)
      fx += `<text x="${(hx + 30 + q * 60 + i * 6).toFixed(1)}" y="${(hy - 40 - q * 160).toFixed(1)}" font-size="${(34 + q * 26).toFixed(1)}" font-weight="800" fill="#fff6c9" opacity="${(1 - q).toFixed(2)}" font-family="Avenir Next, Arial Rounded MT Bold, sans-serif">Z</text>`
    }
  }
  L.pose = pose
  L.fx = fx
  return L
}

// ---------- 演員 ----------
const kindIn = makeKindIn(KINDS)
let seq = 0

const actor = defineActor<Kind, BoboStep, BoboProps, BoboState, Target>({
  name: 'bobo',
  kinds: KINDS,

  init: initState,
  apply,
  duration(kind, step) {
    return naturalDuration(kind, step)
  },

  mount(root) {
    const id = `bb${++seq}`
    root.classList.add('A-bobo')
    root.innerHTML =
      `<svg class="bb-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
      `<defs><clipPath id="${id}-mclip"><rect x="1230" y="228" width="180" height="264" rx="22"/></clipPath></defs>` +
      `<g class="bb-sc" data-sc="park">${parkSvg(id)}</g>` +
      `<g class="bb-sc" data-sc="home">${homeSvg(id)}</g>` +
      `<g class="bb-sc" data-sc="bath">${bathSvg()}<g clip-path="url(#${id}-mclip)"><use class="bb-reflect" href="#${id}-bear" transform="translate(1320 640) scale(-0.62 0.62)"/></g></g>` +
      `<g class="bb-sc" data-sc="bed">${bedSvg(id)}</g>` +
      `<g class="bb-pose"><g id="${id}-bear" class="bb-bear">${bearSvg()}</g></g>` +
      `<g class="bb-fg" data-sc="home">${homeFrontSvg()}</g>` +
      `<g class="bb-fg" data-sc="bath">${bathFrontSvg()}</g>` +
      `<g class="bb-fg" data-sc="bed"><g class="bb-blanket-front">${bedFrontSvg()}</g></g>` +
      `<g class="bb-fly"><g transform="scale(.7)"><path d="M-60 -60 L60 -60 L54 30 L-54 30 Z" fill="#f2b84b"/><path d="M-40 -60 L-60 -100 M40 -60 L60 -100" stroke="#f2b84b" stroke-width="16" stroke-linecap="round"/></g></g>` +
      `<g class="bb-fx"></g>` +
      `<rect class="bb-fade" x="-1000" y="-1000" width="4000" height="4000" fill="#fff8ec" opacity="0"/>` +
      `</svg>` +
      `<div class="bb-bubble" hidden><span class="bb-text"></span></div>` +
      `<div class="bb-proxy"></div>`

    const q = <E extends Element>(sel: string) => root.querySelector<E>(sel)!
    const svg = q<SVGSVGElement>('.bb-svg')
    const scenes = [...root.querySelectorAll<SVGGElement>('.bb-sc, .bb-fg')]
    const poseG = q<SVGGElement>('.bb-pose')
    const head = q<SVGGElement>('.bb-head')
    const faceG = q<SVGGElement>('.bb-face')
    const clothesG = q<SVGGElement>('.bb-clothes')
    const armL = q<SVGGElement>('.bb-armLpos')
    const armR = q<SVGGElement>('.bb-armRpos')
    const armLin = q<SVGGElement>('.bb-armL')
    const armRin = q<SVGGElement>('.bb-armR')
    const legL = q<SVGGElement>('.bb-legL')
    const legR = q<SVGGElement>('.bb-legR')
    const mb = [...root.querySelectorAll<SVGGElement>('.bb-mb')]
    const hm = [...root.querySelectorAll<SVGGElement>('.bb-hm')]
    const pawMud = [...root.querySelectorAll<SVGGElement>('.bb-pawmud')]
    const pawSand = [...root.querySelectorAll<SVGGElement>('.bb-pawsand')]
    const sleeves = [...root.querySelectorAll<SVGElement>('.bb-sleeve, .bb-pant')]
    const fx = q<SVGGElement>('.bb-fx')
    const fade = q<SVGRectElement>('.bb-fade')
    const fly = q<SVGGElement>('.bb-fly')
    const bubble = q<HTMLElement>('.bb-bubble')
    const text = q<HTMLElement>('.bb-text')
    const proxy = q<HTMLElement>('.bb-proxy')
    const foamBody = q<SVGGElement>('.bb-foam-body')
    const foamHead = q<SVGGElement>('.bb-foam-head')
    const towel = q<SVGGElement>('.bb-towel')
    const blanketFront = q<SVGGElement>('.bb-blanket-front')
    const blanket = q<SVGGElement>('.bb-blanket')
    const blanketBack = q<SVGGElement>('.bb-blanket-back')
    const shadow = q<SVGEllipseElement>('.bb-shadow')
    const arms = q<SVGGElement>('.bb-arms')
    const bedLook = (L: Look) => L.lying

    const FOAM_BODY = [[-60, -120], [40, -170], [70, -80], [-20, -60], [-80, -200], [20, -230], [0, -130], [-50, -30], [60, -30]]
    const FOAM_HEAD = [[-60, -110], [-10, -130], [50, -116], [90, -80], [-96, -70], [20, -100]]
    const foamSvg = (list: number[][], k: number) =>
      k <= 0.01 ? '' : list.map(([x, y], i) => {
        const r = (22 + (i % 3) * 8) * kit.clamp(k * 1.6 - i * 0.07)
        return r <= 0 ? '' : `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="#ffffff" stroke="#d8eefa" stroke-width="3"/>`
      }).join('')

    const heldSvg = (h: Look['held']) =>
      h === 'brush'
        ? `<g transform="translate(44 0)"><rect x="-70" y="-6" width="96" height="12" rx="6" fill="#ff7aa8"/><rect x="-92" y="-14" width="28" height="14" rx="3" fill="#ffffff" stroke="#cfe3ef" stroke-width="2"/></g>`
        : h === 'cup'
        ? `<g><rect x="-22" y="-30" width="44" height="54" rx="10" fill="#9fd0ff" opacity=".9"/><rect x="-18" y="-24" width="36" height="16" rx="5" fill="#d9f0ff"/></g>`
        : h === 'cake'
        ? `<g><ellipse cx="-8" cy="-10" rx="26" ry="12" fill="#eeb56b"/><path d="M-30 -14 Q-8 -24 16 -14" stroke="#f7a823" stroke-width="6" fill="none"/></g>`
        : ''

    return {
      render(frame, ms) {
        const view = frame.view!
        const ev = view.ev
        const kind = ev ? kindIn(ev.kind, ev.step) : null
        const step = (ev?.step ?? {}) as BoboStep
        const natural = kind ? naturalDuration(kind, step) : 0
        const l = ev && kind ? (ev.local * natural) / Math.max(1, ev.dur) : 0
        const prev = view.prev
        const st = ev?.kind === 'hide' ? view.prev : view.state
        const L = lookOf(prev, st, kind, step, l, ms)

        // 直式只看中間那一條
        const W = root.clientWidth || 1920
        const H = root.clientHeight || 1080
        const vb = W >= H ? VIEW.landscape : VIEW.portrait
        attr(svg, 'viewBox', vb.join(' '))
        const k = Math.max(W / vb[2], H / vb[3])
        const ox = (W - vb[2] * k) / 2 - vb[0] * k
        const oy = (H - vb[3] * k) / 2 - vb[1] * k

        for (const g of scenes) attr(g, 'display', g.dataset.sc === L.scene ? 'inline' : 'none')
        attr(fade, 'opacity', L.fade.toFixed(3))

        // 公園的雲、臥室的星星
        if (L.scene === 'park') {
          root.querySelectorAll<SVGGElement>('[class^="bb-cloud"]').forEach((c, i) => {
            const x = ((ms / (60 + i * 25) + i * 700) % 2600) - 400
            attr(c, 'transform', `translate(${x.toFixed(1)} ${60 + i * 110})`)
          })
        }
        if (L.scene === 'bed') root.querySelectorAll<SVGCircleElement>('.bb-stars circle').forEach((c, i) => attr(c, 'opacity', (0.5 + 0.5 * Math.abs(Math.sin(ms / 700 + i))).toFixed(2)))

        // 姿勢
        const P = L.pose
        const tf =
          `translate(${P.x.toFixed(1)} ${(P.y - P.hop - P.pivot * P.s).toFixed(1)}) rotate(${P.rot.toFixed(2)}) ` +
          `scale(${(P.s * P.sx).toFixed(3)} ${(P.s * P.sq).toFixed(3)}) translate(0 ${P.pivot})`
        attr(poseG, 'transform', tf)
        attr(shadow, 'opacity', P.rot !== 0 && Math.abs(P.rot) > 20 ? '0' : (0.14 * (1 - Math.min(1, P.hop / 200))).toFixed(3))
        attr(head, 'transform', `translate(0 -330) rotate(${P.tilt.toFixed(2)})`)
        attr(armL, 'transform', `translate(-96 -228) rotate(${P.aL.toFixed(2)})`)
        attr(armR, 'transform', `translate(96 -228) rotate(${(-P.aR).toFixed(2)})`)
        for (const [g, kk] of [[armLin, P.kL], [armRin, P.kR]] as const) {
          attr(g.querySelector('rect')!, 'height', (134 * kk).toFixed(1))
          attr(g.querySelector('.bb-sleeve')!, 'height', (70 * kk).toFixed(1))
          const shift = (108 * kk - 108).toFixed(1)
          g.querySelectorAll(':scope > ellipse, :scope > .bb-pawmud, :scope > .bb-pawsand').forEach((e) => attr(e, 'transform', `translate(0 ${shift})`))
        }
        attr(legL, 'transform', `translate(0 ${(-P.legL).toFixed(1)})`)
        attr(legR, 'transform', `translate(0 ${(-P.legR).toFixed(1)})`)

        // 拿著的東西(保持水平,不跟著手臂轉)
        const heldR = armRin.querySelector<SVGGElement>('.bb-held')!
        const heldL = armLin.querySelector<SVGGElement>('.bb-held')!
        const inR = L.held === 'brush' || L.held === 'cake'
        kit.setIf(heldR, 'html', inR ? heldSvg(L.held) : '')
        kit.setIf(heldL, 'html', L.held === 'cup' ? heldSvg('cup') : '')
        attr(heldR, 'transform', `translate(${L.heldDx.toFixed(1)} ${(108 * P.kR + L.heldDy).toFixed(1)}) rotate(${(P.aR + L.heldR).toFixed(2)})`)
        attr(heldL, 'transform', `translate(0 ${(108 * P.kL).toFixed(1)}) rotate(${(-P.aL).toFixed(2)})`)

        // 毛的顏色、衣服
        root.style.setProperty('--bb-fur', L.wet ? FUR_WET : FUR)
        kit.setIf(clothesG, 'html', L.clothes === 'overall' ? OVERALL : L.clothes === 'pajamas' ? PAJAMAS : '')
        for (const e of sleeves) attr(e, 'opacity', L.clothes === 'pajamas' ? '1' : '0')

        // 泥巴、沙子、屑屑
        mb.forEach((g, i) => attr(g, 'opacity', kit.clamp(L.dirt * BODY_MUD.length - i).toFixed(2)))
        hm.forEach((g, i) => attr(g, 'opacity', kit.clamp((L.dirt - 0.35) * 6 - i).toFixed(2)))
        pawMud.forEach((g) => attr(g, 'opacity', kit.clamp(L.dirt * 3).toFixed(2)))
        pawSand.forEach((g) => attr(g, 'opacity', L.sand.toFixed(2)))
        attr(q('.bb-headsand'), 'opacity', L.sand.toFixed(2))
        attr(q('.bb-crumbs'), 'opacity', L.crumbs.toFixed(2))
        attr(q('.bb-fluff'), 'opacity', L.fluff.toFixed(2))
        kit.setIf(foamBody, 'html', foamSvg(FOAM_BODY, L.foam))
        kit.setIf(foamHead, 'html', foamSvg(FOAM_HEAD, L.foam))
        attr(towel, 'opacity', String(L.towel))
        attr(towel, 'transform', L.towel ? `rotate(${(8 * Math.sin(ms / 90)).toFixed(1)})` : '')

        // 五官
        const blink = (ms + 400) % 3800 < 150
        kit.setIf(faceG, 'html', faceSvg(L.face, { blink, talk: L.talk, film: L.film, foam: L.mouthFoam, lick: L.lick, chew: L.chew }))

        // 場景裡跟著狀態變的東西
        attr(q('.bb-basket-cloth'), 'opacity', String(L.laundry))
        attr(q('.bb-rack-towel'), 'opacity', L.rackTowel ? '1' : '0')
        attr(q('.bb-holder-brush'), 'opacity', L.holderBrush ? '1' : '0')
        attr(q('.bb-sheet-sand'), 'opacity', L.sheetSand.toFixed(2))
        attr(arms, 'opacity', bedLook(L) ? '0' : '1')
        attr(blanketFront, 'display', bedLook(L) ? 'inline' : 'none')
        attr(blanketBack, 'display', bedLook(L) ? 'none' : 'inline')
        attr(blanket, 'transform', `translate(0 ${(L.blanketWig * 8).toFixed(1)}) rotate(${(L.blanketWig * 1.2).toFixed(2)} 1060 770)`)
        attr(blanketBack, 'transform', `translate(0 ${(L.blanketWig * 10).toFixed(1)})`)
        const fs = 0.35 + 0.65 * L.food
        attr(q('.bb-pancake'), 'transform', `translate(1040 722) scale(${fs.toFixed(3)}) translate(-1040 -722)`)
        attr(q('.bb-corn'), 'transform', `translate(1112 728) scale(${kit.clamp(L.food * 1.5 - 0.2).toFixed(3)}) translate(-1112 -728)`)

        if (L.fly) {
          attr(fly, 'display', 'inline')
          attr(fly, 'transform', `translate(${L.fly.x.toFixed(1)} ${L.fly.y.toFixed(1)}) rotate(${L.fly.r.toFixed(1)})`)
        } else attr(fly, 'display', 'none')

        kit.setIf(fx, 'html', L.fx)

        // 說話泡泡(HTML,跟著頭)
        if (L.bubble && L.fade < 0.5) {
          const [hx, hy] = toWorld(P, 0, -470)
          bubble.hidden = false
          kit.setIf(text, 'text', L.bubble.text)
          kit.css(bubble, {
            left: `${(ox + hx * k).toFixed(1)}px`,
            top: `${(oy + hy * k).toFixed(1)}px`,
            fontSize: `${(40 * k).toFixed(1)}px`,
            transform: `translate(-50%, -100%) scale(${L.bubble.p.toFixed(3)})`,
          })
        } else bubble.hidden = true
      },

      target(name) {
        const sel: Record<string, string> = {
          bear: '.bb-bear', face: '.bb-head', mouth: '.bb-mouthbox', puddle: '.bb-puddle', sandbox: '.bb-sandbox', table: '.bb-table',
          tub: '.bb-tub', sink: '.bb-sink', mirror: '.bb-mirror', basket: '.bb-basket', bed: '.bb-bed',
        }
        if (name === 'window') return root
        if (name === 'bubble') return bubble.hidden ? null : bubble
        const el = sel[name] ? root.querySelector(sel[name]) : null
        if (!el) return null
        // 不在目前場景的東西量不到位置
        const sc = el.closest<SVGGElement>('[data-sc]')
        if (sc && sc.getAttribute('display') === 'none') return null
        // 舞台用 offsetLeft/offsetTop 量位置,SVG 元素量不到:放一個同位置的 div 代替
        const rr = root.getBoundingClientRect()
        const er = el.getBoundingClientRect()
        const k = rr.width / (root.clientWidth || 1) || 1
        kit.css(proxy, {
          left: `${((er.left - rr.left) / k).toFixed(1)}px`,
          top: `${((er.top - rr.top) / k).toFixed(1)}px`,
          width: `${(er.width / k).toFixed(1)}px`,
          height: `${(er.height / k).toFixed(1)}px`,
        })
        return proxy
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
