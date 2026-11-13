// art/panels:辦公室螢幕與全息面板的共用 markup(代理人的對話視窗、瀏覽器外框、系統狀態、裝飾圖表、需求對話框)。
// 樣式在 office.css(類別 art-…);各場景自己的位置、內容與時間動畫留在 actor 裡。
import { kit } from '../kit'
import { BARS_N, WAVE_N } from './backdrop'

const ticks = (n: number): string => Array.from({ length: n }, () => '<i></i>').join('')

/** 螢幕上代理人的對話視窗:標題列、訊息(msgs 是 .art-msgs 裡的內容)、輸入框 */
export const agentWindowMarkup = (site: string, msgs = ''): string =>
  `<div class="art-agent"><div class="art-bar"><i></i><i></i><i></i><span>AI Agent · ~/${kit.esc(site)}</span></div>` +
  `<div class="art-msgs">${msgs}</div>` +
  `<div class="art-input"><span>輸入訊息…</span></div></div>`

/** 瀏覽器外框:網址列(.art-url)與網頁區(.art-page,裡面放 page) */
export const browserMarkup = (page: string): string =>
  `<div class="art-brw"><div class="art-bbar"><i></i><i></i><i></i><span class="art-url"></span></div><div class="art-page">${page}</div></div>`

/** 系統狀態面板:.art-dash 裡先放環境長條(.art-dash-amb);extra 是場景自己多放的內容(例如工作紀錄) */
export const dashMarkup = (extra = ''): string =>
  `<div class="art-holo art-dash"><div class="art-dash-amb"><div class="art-holo-title">系統狀態</div><div class="art-bars">${ticks(BARS_N)}</div></div>${extra}</div>`

/** 裝飾圖表:兩條折線(.art-deco-l1 / .art-deco-l2) */
export const decoMarkup = (): string =>
  `<div class="art-holo art-deco"><div class="art-holo-title">CPU · 記憶體</div><svg viewBox="0 0 300 80" preserveAspectRatio="none"><polyline class="art-deco-l1" fill="none"/><polyline class="art-deco-l2" fill="none"/></svg></div>`

/** 需求對話框:標題、文字(.art-need-text)、說話的聲波;cls 是場景自己的 class */
export const needMarkup = (cls = ''): string =>
  `<div class="art-holo art-need ${cls}"><div class="art-holo-title">你的需求</div><div class="art-need-text"></div><div class="art-wave">${ticks(WAVE_N)}</div></div>`
