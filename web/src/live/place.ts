// place.ts — 舞台的畫布尺寸與演員位置的換算(純函式,沒有 DOM,方便單元測試)。
//
// 畫布:橫式 1920×1080(預設,與舞台一直以來的行為相同)、直式 1080×1920。
// 位置(腳本的 place / move.to):
//   "window" | "full" | "left" | "right" | "center"   語意名稱,每個方向各有一張換算表(PLACES)
//   { x, y, w, h }                                      畫布的 px,或 "50%"(相對於該方向的畫布)
//   { landscape: <上面任一種>, portrait: <上面任一種> }  兩種方向各寫一種;缺的方向沿用另一個
import type { Aspect, Place, PlaceBase, PlaceName, PlaceSpec } from './types'

export const SIZES: Record<Aspect, { w: number; h: number }> = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
}
export const stageSize = (aspect: Aspect = 'landscape'): { w: number; h: number } => SIZES[aspect]

const LW = SIZES.landscape.w
const LH = SIZES.landscape.h
const PW = SIZES.portrait.w
const PH = SIZES.portrait.h

/**
 * 語意名稱 → 位置(每個方向一張表)。
 * 直式(1080×1920):字幕與播放器的控制列壓在畫面下緣,所以 window 在下方多留邊;
 * left = 上半部、right = 下半部(橫式的左右在直式變成上下);center 是垂直置中(高度固定,才能算出置中)。
 */
export const PLACES: Record<Aspect, Record<PlaceName, Place>> = {
  landscape: {
    window: { x: 96, y: 76, w: 1728, h: 928 },
    full: { x: 0, y: 0, w: LW, h: LH },
    left: { x: 96, y: 120, w: 1100, h: 840 },
    right: { x: 1190, y: 150, w: 620, h: null },
    center: { x: 560, y: 240, w: 800, h: null },
  },
  portrait: {
    window: { x: 40, y: 110, w: 1000, h: 1560 },
    full: { x: 0, y: 0, w: PW, h: PH },
    left: { x: 40, y: 110, w: 1000, h: 760 },
    right: { x: 40, y: 940, w: 1000, h: 760 },
    center: { x: 90, y: 560, w: 900, h: 800 },
  },
}

const pct = (v: number | string | null | undefined, full: number): number => (typeof v === 'string' && v.endsWith('%') ? (parseFloat(v) / 100) * full : (v as number))

/** 取出某個方向的寫法:{ landscape, portrait } 物件挑對應的方向(缺的沿用另一個),其他寫法兩種方向共用 */
export function placeFor(spec: PlaceSpec | undefined, aspect: Aspect): PlaceBase | undefined {
  if (spec && typeof spec === 'object' && ('landscape' in spec || 'portrait' in spec)) {
    const o = spec as { landscape?: PlaceBase; portrait?: PlaceBase }
    return o[aspect] ?? o[aspect === 'landscape' ? 'portrait' : 'landscape']
  }
  return spec as PlaceBase | undefined
}

/** 腳本的位置 → 該方向畫布上的 { x, y, w, h }(px;h 為 null 表示依內容高度) */
export function placeOf(spec: PlaceSpec | undefined, aspect: Aspect = 'landscape'): Place {
  const base = PLACES[aspect]
  const p = placeFor(spec, aspect)
  const r = typeof p === 'string' ? base[p] : p ? { ...base.window, ...p } : base.window
  if (!r) throw new Error(`不認得的位置:${p}`)
  const { w, h } = SIZES[aspect]
  return { x: pct(r.x, w), y: pct(r.y, h), w: pct(r.w, w), h: r.h == null ? null : pct(r.h, h) }
}
