// art/fx/ambient:氛圍層 —— 窗光呼吸、灰塵飄、散景閃。全部是時間的純函式(固定種子的 kit.rand / kit.noise),沒有 CSS animation。
// 用法:markup 放進場景的層;mount 後每格 renderRays / renderDust / renderBokeh(els, …, ms)。
import { kit } from '../../kit'
import { attr, fx } from '../dom'
import type { BokehDot } from '../office'
import './ambient.css'

// ---------- 灰塵 ----------
export interface Dust {
  x: number
  y: number
  s: number
  seed: number
  sp: number
}
export interface DustOpts {
  seed?: number
  count?: number
}
/** 灰塵的起點(固定種子) */
export function makeDust(o: DustOpts = {}): Dust[] {
  const r = kit.rand(o.seed ?? 9917)
  return Array.from({ length: o.count ?? 34 }, (_, i) => {
    const t = r()
    return { x: 140 + t * 980 + (r() - 0.5) * 260, y: 120 + t * 860 + (r() - 0.5) * 240, s: 2 + r() * 4, seed: 40 + i * 9, sp: 0.5 + r() * 0.9 }
  })
}
export const dustMarkup = (dust: Dust[]): string => `<div class="art-dust">${dust.map((d) => `<i style="width:${d.s.toFixed(1)}px;height:${d.s.toFixed(1)}px"></i>`).join('')}</div>`
/** 灰塵在時間 ms 的位置與亮度(純函式) */
export function dustAt(d: Dust, ms: number): { x: number; y: number; opacity: number } {
  const t = ms / 1000
  const x = d.x + kit.noise(t * 0.18 * d.sp, d.seed) * 70 + t * 6 * d.sp
  const y = d.y + kit.noise(t * 0.15 * d.sp, d.seed + 1) * 60 - ((t * 9 * d.sp) % 120)
  const tw = 0.25 + 0.75 * kit.pulse(ms + d.seed * 97, 2400 + d.seed * 13)
  return { x, y, opacity: tw * 0.8 }
}
/** els 是 markup 裡的 .art-dust i,順序同 dust */
export function renderDust(els: HTMLElement[], dust: Dust[], ms: number): void {
  dust.forEach((d, i) => {
    const p = dustAt(d, ms)
    kit.css(els[i], { transform: `translate(${fx(p.x, 1)}px, ${fx(p.y, 1)}px)`, opacity: fx(p.opacity, 2) })
  })
}

// ---------- 散景 ----------
export const bokehMarkup = (dots: BokehDot[]): string =>
  `<div class="art-bokeh">${dots.map((b) => `<i class="${b.tone}" style="left:${b.x.toFixed(0)}px;top:${b.y.toFixed(0)}px;width:${b.s.toFixed(0)}px;height:${b.s.toFixed(0)}px"></i>`).join('')}</div>`
export const bokehOpacity = (b: BokehDot, ms: number): number => 0.28 + 0.22 * kit.noise(ms / 3000, b.seed)
export function renderBokeh(els: HTMLElement[], dots: BokehDot[], ms: number): void {
  dots.forEach((b, i) => kit.setIf(els[i], 'opacity', fx(bokehOpacity(b, ms), 3)))
}

// ---------- 窗光 ----------
/** 窗光的不透明度(第 i 道) */
export const rayOpacity = (i: number, ms: number): number => 0.75 + 0.25 * kit.noise(ms / 2600 + i * 3, 70 + i)
/** els 是 raysSvg 裡的 polygon(class `<前綴>-ray`) */
export function renderRays(els: SVGElement[], ms: number): void {
  els.forEach((el, i) => attr(el, 'opacity', fx(rayOpacity(i, ms), 3)))
}
