// art/fx/codeStream:程式碼「逐字串流」+ 簡單語法上色。純函式:streamed(lines, n) 給前 n 個字、highlight 上色、codeHtml 組成 HTML。
// 容器要有 class "art-code"(語法色在 codeStream.css);全息版的面板用 codeHoloMarkup()。
// 用法:el.innerHTML = codeHtml(streamed(LINES, n), { lang: 'html', tail: 8, caret: kit.blink(ms, 500) })
import { kit } from '../../kit'
import './codeStream.css'

export type Lang = 'html' | 'css'

/** 語法上色(簡單版):HTML 的標籤、屬性、字串;CSS 的選擇器、屬性名稱 */
export function highlight(line: string, lang: Lang): string {
  const e = kit.esc(line)
  if (lang === 'html')
    return e
      .replace(/ ([a-z-]+)=(&quot;[^&]*(?:&quot;)?)/g, ' <b class="art-a">$1</b>=<b class="art-s">$2</b>')
      .replace(/(&lt;\/?[!a-zA-Z0-9]+)/g, '<b class="art-t">$1</b>')
      .replace(/(&gt;)/g, '<b class="art-t">$1</b>')
  if (/^\s*\/\*/.test(line)) return `<b class="art-c">${e}</b>`
  return e.replace(/^(\s*)([^{:]+)(\{)/, '$1<b class="art-t">$2</b>$3').replace(/([a-z-]+):/g, '<b class="art-a">$1</b>:')
}

/** 串流到第 n 個字:回傳每一行目前打到的文字(換行算一個字) */
export function streamed(lines: string[], n: number): string[] {
  const out: string[] = []
  let left = n
  for (const ln of lines) {
    if (left <= 0) break
    out.push(ln.slice(0, left))
    left -= ln.length + 1
  }
  return out
}
/** 全部的字數(換行算一個字),也就是 streamed 的 n 的上限 */
export const totalChars = (lines: string[]): number => lines.reduce((m, l) => m + l.length + 1, 0)

export interface CodeHtmlOpts {
  lang: Lang
  /** 只顯示最後幾行(像編輯器捲動) */
  tail: number
  /** 左邊顯示行號 */
  numbers?: boolean
  /** 最後一行後面放游標(由呼叫端用 kit.blink 決定亮不亮) */
  caret?: boolean
}
/** 已串流出的行(streamed 的結果)→ HTML:取最後 tail 行、上色、可加行號與游標 */
export function codeHtml(shown: string[], o: CodeHtmlOpts): string {
  const lines = shown.slice(-o.tail)
  const first = shown.length - lines.length
  return lines
    .map((ln, i) => `<div>${o.numbers ? `<em>${first + i + 1}</em>` : ''}${highlight(ln, o.lang)}${o.caret && i === lines.length - 1 ? '<i class="art-caret"></i>' : ''}</div>`)
    .join('')
}

/** 全息程式碼面板的內容(放進自己定位的外框):分頁標籤 + 程式碼區 */
export const codeHoloMarkup = (): string => `<div class="art-codeholo"><div class="art-codeholo-tab"></div><div class="art-codeholo-code art-code"></div></div>`
