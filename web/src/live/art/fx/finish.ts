// art/fx/finish:收尾層 —— 調色(soft-light)、暗角、底片顆粒。顆粒每 83ms 換一次固定種子的位置(時間純函式)。
// 用法:根元素最後放 finishMarkup(),mount 時 querySelector('.art-grain'),每格 renderGrain(el, ms)。
import { kit } from '../../kit'
import './finish.css'

export const finishMarkup = (): string => `<div class="art-grade"></div><div class="art-vignette"></div><div class="art-grain"></div>`

/** 顆粒的背景位置(px);同一個 83ms 區間內不變 */
export function grainOffset(ms: number): { x: number; y: number } {
  const gr = kit.rand(Math.floor(ms / 83))
  return { x: Math.floor(gr() * 256), y: Math.floor(gr() * 256) }
}
export function renderGrain(el: HTMLElement, ms: number): void {
  const g = grainOffset(ms)
  kit.setIf(el, 'backgroundPosition', `${g.x}px ${g.y}px`)
}
