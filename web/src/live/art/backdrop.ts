// art/backdrop:辦公室場景共用的底層 —— 房間(窗光、散景)、光束(灰塵)、前景、調色收尾,以及每格的鏡頭視差與氛圍動畫。
// agent-office 與 manual-office 是同一間辦公室:兩邊的層疊順序在最底(room、rays)與最上(fore、調色)一樣,中間夾各自的層。
// 樣式在 office.css(類別 art-…;根元素要加 art-office,mountOffice 會加)。
import { kit } from '../kit'
import { attr, fx } from './dom'
import { bokehDots, foreSvg, raysSvg, roomSvg, type BokehDot, type OfficeOpts } from './office'
import { bokehMarkup, dustMarkup, makeDust, renderBokeh, renderDust, renderRays, type Dust } from './fx/ambient'
import { finishMarkup, renderGrain } from './fx/finish'
import { layerTransform, type Cam } from './fx/camera'
import './office.css'

const DUST: Dust[] = makeDust()
const BOKEH: BokehDot[] = bokehDots()

/** 一層(1920×1080、原點在左上);cls 是這層自己的 class(例如 "ao-desk") */
export const layerMarkup = (cls: string, inner: string): string => `<div class="art-L ${cls}">${inner}</div>`

/** 整個場景:底層(room、rays)+ middle(各場景自己的層)+ fore + 調色收尾;art 是傳給 roomSvg 等的選項(含 prefix) */
export const officeMarkup = (art: OfficeOpts, middle: string): string =>
  `<div class="art-frame">` +
  layerMarkup('art-room', `${roomSvg(art)}${bokehMarkup(BOKEH)}`) +
  layerMarkup('art-rays', `${raysSvg(art)}${dustMarkup(DUST)}`) +
  middle +
  layerMarkup('art-fore', foreSvg(art)) +
  `</div>` +
  finishMarkup()

/** 根元素:加上場景自己的 class(A-xxx)與共用的 art-office,然後放進 markup */
export function mountOffice(root: HTMLElement, name: string, html: string): void {
  root.classList.add(`A-${name}`, 'art-office')
  root.innerHTML = html
}

export interface Backdrop {
  room: HTMLElement
  rays: HTMLElement
  fore: HTMLElement
  rayEls: SVGPolygonElement[]
  dust: HTMLElement[]
  bokeh: HTMLElement[]
  grain: HTMLElement
}
export function mountBackdrop(root: ParentNode, prefix: string): Backdrop {
  const one = <E extends Element>(s: string): E => root.querySelector<E>(s)!
  const all = <E extends Element>(s: string): E[] => [...root.querySelectorAll<E>(s)]
  return { room: one('.art-room'), rays: one('.art-rays'), fore: one('.art-fore'), rayEls: all(`.${prefix}-ray`), dust: all('.art-dust i'), bokeh: all('.art-bokeh i'), grain: one('.art-grain') }
}

/** 每格:鏡頭推近時房間與前景的景深模糊(roomExtra 接在房間的 filter 後面,例如天黑時的 brightness)+ 窗光呼吸、灰塵飄、散景閃、底片顆粒 */
export function renderBackdrop(b: Backdrop, close: number, ms: number, roomExtra = ''): void {
  kit.setIf(b.room, 'filter', `blur(${fx(5 + close * 5, 1)}px) saturate(.92)${roomExtra}`)
  kit.setIf(b.fore, 'filter', `blur(${fx(16 + close * 6, 0)}px)`)
  renderRays(b.rayEls, ms)
  renderDust(b.dust, DUST, ms)
  renderBokeh(b.bokeh, BOKEH, ms)
  renderGrain(b.grain, ms)
}

/** 每一層依深度套鏡頭的視差 transform;depthOf 可以對個別層改深度(例如站起來走遠的人) */
export function renderLayers<N extends string>(layers: Record<N, HTMLElement>, depth: Record<N, number>, cam: Cam, shake: { x: number; y: number }, depthOf?: (name: N) => number): void {
  for (const [name, el] of Object.entries(layers) as [N, HTMLElement][]) kit.setIf(el, 'transform', layerTransform(cam, depthOf ? depthOf(name) : depth[name], shake))
}

// ---------- 全息的裝飾:系統狀態長條、圖表線、說話的聲波 ----------
export const BARS_N = 10
export const WAVE_N = 16
/** 長條的高度(0–1 縮放),每格由 ms 決定 */
export const barScale = (i: number, ms: number): number => 0.25 + 0.7 * (0.5 + 0.5 * kit.noise(ms / 900 + i * 1.3, 80 + i))
export const renderBars = (els: HTMLElement[], ms: number): void => els.forEach((el, i) => kit.setIf(el, 'transform', `scaleY(${fx(barScale(i, ms), 3)})`))
/** 圖表折線的 points(31 點、寬 300) */
export const decoLine = (seed: number, amp: number, base: number, ms: number): string =>
  Array.from({ length: 31 }, (_, i) => `${i * 10},${fx(base + kit.noise(i * 0.35 + ms / 1400, seed) * amp + Math.sin(i * 0.9 + ms / 900) * amp * 0.25, 1)}`).join(' ')
export function renderDecoLines(l1: SVGElement, l2: SVGElement, ms: number): void {
  attr(l1, 'points', decoLine(91, 18, 40, ms))
  attr(l2, 'points', decoLine(92, 12, 56, ms))
}
/** 說話的聲波:talking 時每條隨機跳動,否則靜止 */
export function renderWave(els: HTMLElement[], talking: boolean, ms: number): void {
  els.forEach((el, i) => {
    const a = talking ? 0.2 + 0.8 * Math.abs(kit.noise(ms / 70 + i * 0.7, 50 + i)) : 0.12
    kit.setIf(el, 'transform', `scaleY(${fx(a, 3)})`)
  })
}
