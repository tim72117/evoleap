// blocking.ts — 調度(場面調度 / blocking):幾位演員共用同一塊位置時,誰在前景、誰退到後景、怎麼輪替。
// 純函式,沒有 DOM,方便單元測試;舞台(stage.ts)在 load 時規劃、在 renderAt 時取姿勢套到演員外框上。規格見 README.md「調度」。
//
// 腳本頂層:
//   "blocking": { "cast": ["claude", "browser"], "shot": "depth", "auto": true }
//     cast  參與調度的演員(依序是一開始由前到後的順序);它們通常放在同一個 place
//     shot  構圖(預設 depth;用詞依電影與轉播的說法):
//             depth   縱深構圖(staging in depth):前景完整,後景縮小、變暗、失焦,從前景後方露出一截(直式露在上緣、橫式露在左側)
//             pip     子母畫面(picture-in-picture):前景完整,後景縮成角落的小畫面,疊在前景上
//             single  單人鏡頭:只看得到前景
//     auto  預設 true:演員動作(與 show)的那位演員自動換到前景,像視窗被點到最前面
//   也可以兩種方向分開寫:{ "portrait": { … }, "landscape": { … } };沒寫的方向不調度(例如橫式維持並排)。
// 退場(hide)的演員排到最後面,前後順序只在看得到的演員之間算;所以同一份 cast 可以放好幾段場景的演員。
// 任何一步都能加:
//   "foreground": "browser"  指定換到前景(不管 auto)
//   "shot": "pip"            換構圖
//   "transition": "cut"      這次輪替直接切換(切);預設是轉焦(rack focus):約 0.9 秒,前後景的大小、明暗、焦點同時交換
// 輪替會在動作開始前完成(和鏡頭一樣,演員的動作等輪替到位才開始)。
//
// 站位標記(mark)用外框大小的比例表示(tx、ty 是外框寬高的比例,transform-origin 是左上角),和畫布尺寸無關。
import { kit } from './kit'
import type { Aspect } from './types'

export type Shot = 'depth' | 'pip' | 'single'
export const SHOTS: readonly Shot[] = ['depth', 'pip', 'single']
/** 輪替(轉焦)的時間,和鏡頭移動一樣長,兩者可以同時進行 */
export const BLOCK_MS = 900

export interface BlockingSpec {
  cast: string[]
  shot?: Shot
  auto?: boolean
}
/** 腳本裡的寫法:一種(兩種方向共用),或依方向各寫一種(沒寫的方向不調度) */
export type BlockingScript = BlockingSpec | { landscape?: BlockingSpec; portrait?: BlockingSpec }

/** 取出這個方向的調度設定;沒有就回傳 null */
export function blockingFor(script: BlockingScript | undefined, aspect: Aspect): BlockingSpec | null {
  if (!script) return null
  if ('cast' in script) return script
  return (script as { landscape?: BlockingSpec; portrait?: BlockingSpec })[aspect] ?? null
}

/** 站位標記(mark):一位演員在某個時間點的位置、大小與明暗 */
export interface Mark {
  /** 位移,外框寬高的比例 */
  tx: number
  ty: number
  /** 縮放 */
  s: number
  /** 亮度(1 = 原樣) */
  bright: number
  /** 失焦(px) */
  blur: number
  opacity: number
  /** 上下層:數字大的在上面 */
  z: number
  /** 陰影強度 0–1 */
  shadow: number
}

/** 規劃結果:第幾步換成什麼順序、什麼構圖 */
export interface PlannedBlock {
  step: number
  order: string[]
  shot: Shot
  cut: boolean
}
/** 調度的提示點(cue,和鏡頭的 CameraCue 對應):at 起開始輪替,BLOCK_MS 後到位(cut 則立即) */
export interface BlockCue {
  at: number
  order: string[]
  shot: Shot
  cut: boolean
}

/** 規劃用的一步:誰演、是不是演員動作、腳本欄位 */
export interface BlockStep {
  actor: string | null
  /** 演員的動作或 show(會讓 auto 換前景) */
  acts: boolean
  foreground?: unknown
  shot?: unknown
  transition?: unknown
  /** 這一步讓誰出場/退場(舞台的 show/hide) */
  show?: string
  hide?: string
}

/** 第 depth 層(0 = 前景)在某個構圖下的站位 */
export function markOf(shot: Shot, depth: number, aspect: Aspect = 'portrait'): Mark {
  if (shot === 'single') return { tx: 0, ty: 0, s: 1, bright: 1, blur: 0, opacity: depth === 0 ? 1 : 0, z: 10 - depth, shadow: 0 }
  if (shot === 'pip') {
    if (depth === 0) return { tx: 0, ty: 0, s: 1, bright: 1, blur: 0, opacity: 1, z: 1, shadow: 0 }
    // 角落的小畫面,第 2 個以後往上(直式)或往左(橫式)排
    const s = aspect === 'portrait' ? 0.3 : 0.26
    const m = 0.03
    const k = depth - 1
    return {
      tx: aspect === 'portrait' ? 1 - s - m : 1 - s - m - k * (s + m),
      ty: aspect === 'portrait' ? 1 - s - m - k * (s + m) : 1 - s - m,
      s,
      bright: 1,
      blur: 0,
      opacity: depth <= 3 ? 1 : 0,
      z: 10 + depth,
      shadow: 1,
    }
  }
  // depth:前景稍微縮小、貼著外框的下緣(直式)或右緣(橫式);後景更小、往上(左)露出一截
  const s = Math.max(0.7, 0.94 - 0.07 * depth)
  const peek = 0.06
  const lead = kit.clamp(peek - peek * depth, -peek, peek) // 前景 0.06、後景 0、再後面 -0.06
  const across = (1 - s) / 2
  return {
    tx: aspect === 'portrait' ? across : lead,
    ty: aspect === 'portrait' ? lead : across,
    s,
    bright: Math.max(0.55, 1 - 0.2 * depth),
    blur: Math.min(5, 2.5 * depth),
    opacity: depth <= 2 ? 1 : 0,
    z: 10 - depth,
    shadow: depth === 0 ? 1 : 0.4,
  }
}

const isShot = (v: unknown): v is Shot => typeof v === 'string' && (SHOTS as readonly string[]).includes(v)

/** 檢查頂層設定;castIds 是演員表的代號 */
export function checkBlocking(spec: BlockingSpec, castIds: string[]): void {
  if (!Array.isArray(spec.cast) || spec.cast.length < 2) throw new Error('blocking.cast 至少要有兩位演員')
  for (const id of spec.cast) if (!castIds.includes(id)) throw new Error(`blocking.cast:演員表裡沒有「${id}」`)
  if (new Set(spec.cast).size !== spec.cast.length) throw new Error('blocking.cast 有重複的演員')
  if (spec.shot != null && !isShot(spec.shot)) throw new Error(`blocking.shot 只能是 ${SHOTS.join('、')}`)
}

/**
 * 規劃:依序看每一步,找出換前景或換構圖的步驟。腳本寫錯時丟出含 step(從 0 開始)的錯誤,由舞台補上「第幾步」。
 */
/** 前後順序:看得到的演員依「最近用過的在前」,退場的排在最後 */
const normalize = (mru: string[], visible: Set<string>): string[] => [...mru.filter((id) => visible.has(id)), ...mru.filter((id) => !visible.has(id))]

/** 一開始的順序(hidden 是登場時藏起來的演員) */
export function initialOrder(spec: BlockingSpec, hidden: string[] = []): string[] {
  return normalize(spec.cast, new Set(spec.cast.filter((id) => !hidden.includes(id))))
}

export function planBlocking(spec: BlockingSpec, steps: BlockStep[], hidden: string[] = []): PlannedBlock[] {
  const auto = spec.auto !== false
  let mru = [...spec.cast]
  const visible = new Set(spec.cast.filter((id) => !hidden.includes(id)))
  let order = normalize(mru, visible)
  let shot: Shot = spec.shot ?? 'depth'
  const out: PlannedBlock[] = []
  steps.forEach((x, i) => {
    if (x.foreground != null && (typeof x.foreground !== 'string' || !mru.includes(x.foreground))) {
      throw Object.assign(new Error(`foreground 要是 blocking.cast 裡的演員(${order.join('、')})`), { step: i })
    }
    if (x.shot != null && !isShot(x.shot)) throw Object.assign(new Error(`shot 只能是 ${SHOTS.join('、')}`), { step: i })
    if (x.transition != null && x.transition !== 'cut' && x.transition !== 'rack') {
      throw Object.assign(new Error('transition 只能是 cut 或 rack'), { step: i })
    }
    if (x.show && mru.includes(x.show)) visible.add(x.show)
    if (x.hide && mru.includes(x.hide)) visible.delete(x.hide)
    const front = (x.foreground as string | undefined) ?? (auto && x.acts && x.actor && mru.includes(x.actor) ? x.actor : undefined)
    if (front) mru = [front, ...mru.filter((id) => id !== front)]
    const nextShot = (x.shot as Shot | undefined) ?? shot
    const nextOrder = normalize(mru, visible)
    if (nextOrder.join() === order.join() && nextShot === shot) return
    order = nextOrder
    shot = nextShot
    out.push({ step: i, order, shot, cut: x.transition === 'cut' })
  })
  return out
}

/** 有輪替的步驟要預留的時間(cut 不用) */
export function blockPreroll(planned: PlannedBlock[]): Map<number, number> {
  return new Map(planned.filter((b) => !b.cut).map((b) => [b.step, BLOCK_MS]))
}

/** 排時間(產生 BlockCue):輪替在「步驟開始 − 預留時間」開始;最前面補一個起始的關鍵點 */
export function scheduleBlocking(
  spec: BlockingSpec,
  planned: PlannedBlock[],
  startOf: (step: number) => number,
  preroll: Map<number, number>,
  hidden: string[] = [],
): BlockCue[] {
  const first: BlockCue = { at: 0, order: initialOrder(spec, hidden), shot: spec.shot ?? 'depth', cut: true }
  return [
    first,
    ...planned.map((b) => ({ at: Math.max(0, startOf(b.step) - (b.cut ? 0 : (preroll.get(b.step) ?? 0))), order: b.order, shot: b.shot, cut: b.cut })),
  ]
}

const lerpMark = (a: Mark, b: Mark, p: number): Mark => ({
  tx: kit.lerp(a.tx, b.tx, p),
  ty: kit.lerp(a.ty, b.ty, p),
  s: kit.lerp(a.s, b.s, p),
  bright: kit.lerp(a.bright, b.bright, p),
  blur: kit.lerp(a.blur, b.blur, p),
  opacity: kit.lerp(a.opacity, b.opacity, p),
  // 上下層在過程的一半交換,換到前面的那位從後面「走」到前面
  z: p < 0.5 ? a.z : b.z,
  shadow: kit.lerp(a.shadow, b.shadow, p),
})

const marksOf = (k: BlockCue, aspect: Aspect): Record<string, Mark> => Object.fromEntries(k.order.map((id, d) => [id, markOf(k.shot, d, aspect)]))

/** 第 idx 個提示點從哪裡開始、到哪裡、在 ms 時走到哪 */
const marksDuring = (cues: BlockCue[], idx: number, from: Record<string, Mark>, ms: number, aspect: Aspect): Record<string, Mark> => {
  const to = marksOf(cues[idx], aspect)
  if (idx === 0 || cues[idx].cut) return to
  const p = kit.ease.inOutCubic(kit.progress(ms, cues[idx].at, BLOCK_MS))
  if (p >= 1) return to
  return Object.fromEntries(Object.keys(to).map((id) => [id, lerpMark(from[id] ?? to[id], to[id], p)]))
}

/**
 * ms 時每位參與調度的演員的站位(純函式:同一個時間點一定得到同一組站位)。
 * 每次輪替都從「上一次輪替在這一刻實際走到的站位」開始,兩次輪替相隔不到 BLOCK_MS 時也不會跳。
 */
export function blockingAt(cues: BlockCue[], ms: number, aspect: Aspect = 'portrait'): Record<string, Mark> {
  if (!cues.length) return {}
  let idx = 0
  for (let i = 0; i < cues.length; i++) if (cues[i].at <= ms) idx = i
  let start: Record<string, Mark> = marksOf(cues[0], aspect)
  for (let i = 1; i <= idx; i++) start = marksDuring(cues, i - 1, start, cues[i].at, aspect)
  return marksDuring(cues, idx, start, ms, aspect)
}
