// art/fx/permission:權限提示全息面板。markup 放進 `<div class="art-holo art-ask my-pos">…</div>`,render 每格依參數設內容與按鈕狀態。
// 面板「何時出現、打字打到哪、按鈕何時被按」是場景的時間表,這裡只負責把算好的數值畫出來(時間 → 樣式)。
import { kit } from '../../kit'
import { fx } from '../dom'
import { renderHolo } from './hologram'
import './permission.css'

export type AskStatus = 'pending' | 'allowed' | 'denied'

export interface AskLabels {
  allow?: string
  deny?: string
}
/** 面板內部的 HTML(標題、問題、兩顆按鈕、結果列) */
export const askMarkup = (l: AskLabels = {}): string =>
  `<div class="art-holo-title art-ask-title"></div><div class="art-ask-q"></div>` +
  `<div class="art-ask-btns"><span class="art-btn art-allow">${l.allow ?? '允許'}</span><span class="art-btn art-deny">${l.deny ?? '拒絕'}</span></div>` +
  `<div class="art-ask-res"></div>`

export interface AskHandles {
  panel: HTMLElement
  title: HTMLElement
  q: HTMLElement
  allow: HTMLElement
  deny: HTMLElement
  res: HTMLElement
}
/** 找到面板裡的元素(panel 是外框 .art-ask) */
export function mountAsk(panel: HTMLElement): AskHandles {
  const $ = (s: string): HTMLElement => panel.querySelector<HTMLElement>(s)!
  return { panel, title: $('.art-ask-title'), q: $('.art-ask-q'), allow: $('.art-allow'), deny: $('.art-deny'), res: $('.art-ask-res') }
}

export interface AskView {
  status: AskStatus
  title: string
  /** 此刻要顯示的問題文字(打字中就是打到一半的) */
  question: string
  /** 按鈕浮現 0–1 */
  btnIn: number
  /** 已經回答(按鈕亮起、面板變色) */
  resolved: boolean
  /** 按下去的縮放量 0–1(sin 脈衝) */
  pressAllow: number
  pressDeny: number
  /** 結果列此刻的文字 */
  resText: string
}
/** 畫權限面板:vis 是出現進度 0–1(0 隱藏);view 為 null 或 vis 為 0 時只設出現動畫 */
export function renderAsk(h: AskHandles, vis: number, seed: number, view: AskView | null): void {
  renderHolo(h.panel, vis, seed, 'translate(0, 0)')
  if (vis > 0 && view) {
    const { status, resolved } = view
    kit.setIf(h.title, 'text', view.title)
    kit.setIf(h.q, 'text', view.question)
    kit.css(h.allow, { opacity: fx(view.btnIn * (resolved && status === 'denied' ? 0.35 : 1), 3), transform: `scale(${fx(1 - view.pressAllow * 0.08, 3)})` })
    kit.css(h.deny, { opacity: fx(view.btnIn * (resolved && status === 'allowed' ? 0.35 : 1), 3), transform: `scale(${fx(1 - view.pressDeny * 0.08, 3)})` })
    h.allow.classList.toggle('art-on', resolved && status === 'allowed')
    h.deny.classList.toggle('art-on', resolved && status === 'denied')
    h.panel.classList.toggle('art-ok', resolved && status === 'allowed')
    h.panel.classList.toggle('art-no', resolved && status === 'denied')
    kit.setIf(h.res, 'text', view.resText)
    kit.setIf(h.res, 'opacity', resolved ? '1' : '0')
  }
}
