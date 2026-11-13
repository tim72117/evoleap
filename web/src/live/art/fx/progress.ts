// art/fx/progress:進度環 + 工作紀錄。markup 放進全息面板(通常是 flex 橫排的容器),render 依 0–1 的進度與每行的顯示量更新。
import { kit } from '../../kit'
import { attr, fx } from '../dom'
import './progress.css'

export interface LogLine {
  text: string
  tone?: 'ok' | 'warn'
}
/** 進度環 + 紀錄清單的 HTML(兩個並排的子元素);title 是紀錄標題 */
export const progressMarkup = (lines: LogLine[], title: string): string =>
  `<div class="art-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" class="art-ring-bg"/><circle cx="50" cy="50" r="40" class="art-ring-fg"/></svg><b class="art-ring-n"></b></div>` +
  `<div class="art-logbox"><div class="art-holo-title art-log-title">${title}</div><div class="art-log">${lines.map((x) => `<div class="art-lg${x.tone ? ` ${x.tone}` : ''}">${kit.esc(x.text)}</div>`).join('')}</div></div>`

export interface ProgressHandles {
  /** 切換 .art-ok(完成變綠)的外框 */
  panel: HTMLElement
  ringFg: SVGCircleElement
  ringN: HTMLElement
  title: HTMLElement
  lines: HTMLElement[]
}
export function mountProgress(panel: HTMLElement): ProgressHandles {
  return {
    panel,
    ringFg: panel.querySelector<SVGCircleElement>('.art-ring-fg')!,
    ringN: panel.querySelector<HTMLElement>('.art-ring-n')!,
    title: panel.querySelector<HTMLElement>('.art-log-title')!,
    lines: [...panel.querySelectorAll<HTMLElement>('.art-lg')],
  }
}

export interface ProgressView {
  /** 0–1 */
  prog: number
  title: string
  ok: boolean
  /** 每一行:show 是否顯示、q 浮現進度 0–1 */
  rows: { show: boolean; q: number }[]
}
const CIRC = 2 * Math.PI * 40
export function renderProgress(h: ProgressHandles, v: ProgressView): void {
  v.rows.forEach((r, i) => kit.css(h.lines[i], { display: r.show ? '' : 'none', opacity: fx(r.q, 3) }))
  attr(h.ringFg, 'stroke-dasharray', fx(CIRC, 2))
  attr(h.ringFg, 'stroke-dashoffset', fx(CIRC * (1 - v.prog), 2))
  kit.setIf(h.ringN, 'text', `${Math.round(v.prog * 100)}%`)
  kit.setIf(h.title, 'text', v.title)
  h.panel.classList.toggle('art-ok', v.ok)
}
