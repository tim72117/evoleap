// camera.ts — 舞台的鏡頭:把「每一步的鏡頭提示點」整理成關鍵點,再依時間算出鏡頭姿態。
//
// 提示點(Cue)來自腳本的 focus 或演員的 cues/autoFocus(見 stage.ts 的 cuesOf);這裡不認得任何演員,
// 只要有人能把目標名稱換算成位置(measure),就能算出鏡頭。
//   buildCameraKeys  提示點 → 關鍵點:合併重複、讓每個鏡頭至少停留一段時間(太早來的下一個鏡頭延後或略過)
//   cameraPoseAt     關鍵點 + 時間 → 鏡頭姿態(平移與倍率),過渡中被打斷時從「當下實際位置」接續,不會跳
import { kit, type CameraPose, type Rect } from './kit'
import type { CameraKey, FocusSpec } from './types'

/** 一次鏡頭過渡的時間 */
export const CAM_MS = 900
/** 自動鏡頭至少要停留這麼久才會移過去 */
export const CAM_HOLD_MS = 1500
/** 為了讓前一個鏡頭停留滿 CAM_HOLD_MS,下一個自動鏡頭最多延後這麼久 */
const CAM_MAX_DELAY_MS = 600
/** 鏡頭推近時目標下緣最多到畫面 68% 高,避開播放器的字幕與控制列 */
export const SAFE_BOTTOM = 0.68
/** 沒指定倍率時,各目標名稱的預設倍率(其餘用 DEFAULT_ZOOM) */
const ZOOM: Record<string, number> = { composer: 1.8, ask: 1.6, mode: 2.2, head: 1.6 }
const DEFAULT_ZOOM = 1.6

/** 一個步驟裡的鏡頭提示點:at 是相對於步驟開始的毫秒;focus 是 undefined 表示沒意見(沿用上一個鏡頭) */
export interface CameraCue {
  at: number
  focus: FocusSpec | undefined
  auto: boolean
}

/** 規劃好的鏡頭關鍵點:還沒有時間,只記錄「第幾步的第幾毫秒」要換鏡頭 */
export interface PlannedKey {
  /** 第幾步(時間表上的索引) */
  step: number
  /** 相對於那一步開始的毫秒 */
  at: number
  target: string | null
  zoom: number
  auto: boolean
}

/**
 * 規劃:每一步的提示點(依步驟順序)→ 關鍵點。每次目標或倍率改變才產生一個關鍵點。
 * 只決定「哪幾步要換鏡頭」,不碰時間,所以排時間表之前就能呼叫(見 prerollOf)。
 */
export function planCameraKeys(cuesPerStep: CameraCue[][]): PlannedKey[] {
  const keys: PlannedKey[] = []
  cuesPerStep.forEach((cues, step) => {
    for (const cue of cues) {
      const f = cue.focus
      if (f === undefined) continue
      const target = f ? (typeof f === 'string' ? f : f.target) : null
      const name = target && target.split(':')[1]
      const zoom = target ? (typeof f === 'object' && f.zoom) || ZOOM[name as string] || DEFAULT_ZOOM : 1
      const prev = keys.at(-1)
      if (prev ? prev.target === target && prev.zoom === zoom : !target) continue
      keys.push({ step, at: cue.at, target, zoom, auto: cue.auto })
    }
  })
  return keys
}

/**
 * 預備時間:這一步開始前,鏡頭要先轉過去的時間。這一步的第一個提示點(at = 0)換了鏡頭就要留一次過渡的時間,
 * 排時間表時把它加在這一步前面:鏡頭在這段空檔移動,到位後這一步才開始演。
 */
export function prerollOf(planned: PlannedKey[]): Map<number, number> {
  return new Map(planned.filter((k) => k.at === 0).map((k) => [k.step, CAM_MS]))
}

/**
 * 排程:規劃好的關鍵點 + 排好的時間表 → 有時間的關鍵點。
 * 有預備時間的步驟,鏡頭從「步驟開始 − 預備時間」就開始移動,步驟開始時剛好到位。
 */
export function scheduleCameraKeys(
  planned: PlannedKey[],
  startOf: (step: number) => number,
  preroll: Map<number, number>,
): CameraKey[] {
  const keys = planned.map((k) => ({
    at: startOf(k.step) + k.at - (k.at === 0 ? (preroll.get(k.step) ?? 0) : 0),
    target: k.target,
    zoom: k.zoom,
    auto: k.auto,
  }))
  return holdKeys(keys)
}

/**
 * 每個鏡頭至少停留 CAM_HOLD_MS,看得到那一步的內容(例如打字的輸入框),也避免來回推拉造成閃動:
 * 下一個自動鏡頭來得太早就延後到停留滿為止;延後超過 CAM_MAX_DELAY_MS 的話,改成略過前面那個很短的自動鏡頭。
 * 腳本明寫的 focus 不延後(它的時間是作者指定的),但會讓前面來不及停留的自動鏡頭被略過。
 */
function holdKeys(keys: CameraKey[]): CameraKey[] {
  const out: CameraKey[] = []
  for (const key of keys) {
    let k = key
    for (let prev = out.at(-1); prev && k.at - prev.at < CAM_HOLD_MS; prev = out.at(-1)) {
      const wait = prev.at + CAM_HOLD_MS - k.at
      if (k.auto && wait <= CAM_MAX_DELAY_MS) {
        k = { ...k, at: prev.at + CAM_HOLD_MS }
        break
      }
      if (!prev.auto) break
      out.pop()
    }
    out.push(k)
  }
  return out
}

/** 全景 */
const WIDE: CameraPose = { x: 0, y: 0, zoom: 1 }

/**
 * 讓目標置中並放大,盡量不露出舞台以外的空白;目標下緣最多到 SAFE_BOTTOM
 * (用舞台實際的像素大小計算;嵌在播放器裡時是 1920×1080,直接預覽時是視窗大小)
 */
function poseFor(key: CameraKey | undefined, view: { w: number; h: number }, measure: (target: string) => Rect | null): CameraPose {
  const r = key?.target ? measure(key.target) : null
  if (!key || !r || !r.w || !r.h) return WIDE
  const { w: sw, h: sh } = view
  const z = Math.max(1, Math.min(key.zoom, (sw * 0.92) / r.w, (sh * SAFE_BOTTOM * 0.9) / r.h))
  const x = kit.clamp(sw / 2 - (r.x + r.w / 2) * z, sw - sw * z, 0)
  let y = kit.clamp(sh / 2 - (r.y + r.h / 2) * z, sh - sh * z, 0)
  if ((r.y + r.h) * z + y > sh * SAFE_BOTTOM) y = sh * SAFE_BOTTOM - (r.y + r.h) * z
  return { x, y, zoom: z }
}

/**
 * ms 時的鏡頭姿態。
 * 步驟比過渡時間短時,上一個過渡還沒走完就開始下一個:起點要用「下一個過渡開始那一刻鏡頭實際的位置」,
 * 不能直接用上一個目標的終點,否則鏡頭會瞬間跳過去(快速切換輸入框、輸出區、確認框時的閃動)。
 */
export function cameraPoseAt(
  keys: CameraKey[],
  ms: number,
  view: { w: number; h: number },
  measure: (target: string) => Rect | null,
): CameraPose {
  let i = -1
  for (let k = 0; k < keys.length; k++) if (keys[k].at <= ms) i = k
  const at = (idx: number, t: number): CameraPose => {
    const to = poseFor(keys[idx], view, measure)
    if (idx < 0) return to
    const p = kit.ease.inOutCubic(kit.progress(t, keys[idx].at, CAM_MS))
    if (p >= 1) return to
    const from = at(idx - 1, keys[idx].at)
    return { x: kit.lerp(from.x, to.x, p), y: kit.lerp(from.y, to.y, p), zoom: kit.lerp(from.zoom, to.zoom, p) }
  }
  return at(i, ms)
}

// 開發時引擎的程式一改就整頁重新載入:舞台、外殼、演員是掛上去就一直在跑的物件,不是 React 元件,
// 交給 LivePlayer 熱更新的話它的 effect 不會重跑,畫面仍是舊程式建出來的舊物件,看起來像沒有熱重載。
// 必須直接寫 import.meta.hot.accept(Vite 靠這段文字判斷模組會自己處理更新,包成函式它就認不得)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
