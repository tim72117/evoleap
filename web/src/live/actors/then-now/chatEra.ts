// 「後來:對話式 AI」的自動示範:用說的問 AI,它回一段程式;複製、貼上、存檔、打開、自己點一遍,
// 發現問題再貼回去問。AI 只負責翻譯,每一趟來回都是自己的手在搬。畫面是時間 t(毫秒)的純函式。
import { kit } from '../../kit'
import { SIGNUP_CODE } from './signupCode'

export type ChatStage = 1 | 2 | 3
/** 三個階段各演多久(毫秒,演員另外會放慢) */
export const CHAT_MS: Record<ChatStage, number> = { 1: 7000, 2: 5400, 3: 10400 }

const ASK = '做一個週末工作坊報名網頁：三個場次、剩幾位、填姓名電話送出'
const BUG = '額滿的場次，居然還送得出去'
// 和手寫版同一份程式:AI 第一版沒擋額滿,修正就是把那一行補上
const GUARD = SIGNUP_CODE.findIndex((l) => l.includes('if (s.left <= 0)'))
const CODE = SIGNUP_CODE.filter((_, i) => i !== GUARD)
const FIX = SIGNUP_CODE.slice(GUARD, GUARD + 2)

const icon = (body: string): string => `<svg viewBox="0 0 16 16" aria-hidden="true">${body}</svg>`
const AVATAR = `<span class="tn-cava">${icon('<path d="M8 1.5l1.6 4.9L14.5 8l-4.9 1.6L8 14.5 6.4 9.6 1.5 8l4.900-1.6z" fill="currentColor"/>')}</span>`
const COPY = icon('<path d="M6 5h7v9H6zM3 11V2h7" fill="none" stroke="currentColor" stroke-width="1.5"/>')
const COPIED = icon('<path d="M3 8.500l3.200 3L13 4.500" fill="none" stroke="currentColor" stroke-width="2"/>')
const SEND = icon('<path d="M8 13V3.500M3.800 7.500L8 3.200l4.200 4.300" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')

/** 一行程式的語法上色:標籤、字串、關鍵字、數字 */
function highlight(line: string): string {
  return line
    .split(/(<\/?[a-z0-9]+|>|"[^"]*"|\b(?:if|return|const|function)\b|\b\d+\b)/)
    .map((part, i) => {
      if (i % 2 === 0) return kit.esc(part)
      const kind = part[0] === '"' ? 's' : part[0] === '<' || part === '>' ? 't' : /^\d/.test(part) ? 'n' : 'k'
      return `<span class="tn-h${kind}">${kit.esc(part)}</span>`
    })
    .join('')
}

type Target = 'send' | 'copy' | 'editor' | 'save' | 'open' | 'copy2'
export type ChatFrame = {
  html: string
  /** 網頁打開了沒(打開之後右邊才看得到) */
  opened: boolean
  /** 正在用手點網頁的哪裡 */
  probe: { at: string; state: 'move' | 'pass' | 'fail'; part: number } | null
}

export function chatFrame(stage: ChatStage, t: number): ChatFrame {
  /** a 到 b 之間的進度(0..1) */
  const p = (a: number, b: number): number => Math.min(1, Math.max(0, (t - a) / (b - a)))
  let pointer: { on: Target; away: number; press: boolean } | null = null
  /** 滑鼠在 [from, to) 移到 on:前七成移動,後三成按下 */
  const click = (on: Target, from: number, to: number): void => {
    if (t >= from && t < to) pointer = { on, away: 1 - kit.ease.outCubic(p(from, from + (to - from) * 0.7)), press: t >= from + (to - from) * 0.7 }
  }
  const type = (text: string, from: number, to: number): string => kit.graphemes(text).slice(0, Math.floor(kit.graphemes(text).length * p(from, to))).join('')

  let compose = ''
  let asked = false
  let copied = false
  let pasted = false
  let saved = false
  let opened = false
  let told = false
  let fix = 0
  let copied2 = false
  let fixed = false
  let doing = '用說的，告訴 AI 你要什麼'
  let probe: ChatFrame['probe'] = null

  if (stage === 1) {
    compose = t < 3000 ? type(ASK, 200, 2600) : ''
    click('send', 2500, 3000)
    asked = t >= 3000
    if (asked) doing = 'AI 回了一段程式'
  } else {
    asked = true
    click('copy', 100, 1100)
    click('editor', 1400, 2500)
    click('save', 2900, 3800)
    click('open', 4000, 4900)
    const past = stage === 3
    copied = past || t >= 900
    pasted = past || t >= 2300
    saved = past || t >= 3600
    opened = past || t >= 4700
    doing = !copied ? '選起來，按複製' : !pasted ? '換到編輯器，貼上' : !saved ? '存檔' : '打開網頁來看'
  }
  if (stage === 3) {
    pointer = null
    const tests: [number, number, string, boolean, string][] = [
      [0, 900, 'list', true, '用手點：三個場次有出現嗎'],
      [900, 1800, 'submit', true, '填資料，按送出'],
      [1800, 2900, 'card:1', false, '選額滿的場次再送出…'],
    ]
    for (const [from, to, at, ok, label] of tests) {
      if (t >= from && t < to) {
        doing = label
        probe = { at, state: p(from, to) < 0.6 ? 'move' : ok ? 'pass' : 'fail', part: p(from, to) }
      }
    }
    compose = t >= 2900 && t < 4600 ? type(BUG, 2900, 4100) : ''
    click('send', 4100, 4600)
    told = t >= 4600
    fix = Math.round(FIX.length * p(4900, 5700))
    click('copy2', 5900, 6700)
    click('editor', 6900, 7700)
    click('save', 7900, 8600)
    click('open', 8700, 9300)
    copied2 = t >= 6500
    fixed = t >= 7500
    if (t >= 2900) doing = !told ? '回到聊天視窗，把問題貼給 AI' : !copied2 ? 'AI 給了修正，再複製一次' : !fixed ? '找到那一行，貼上' : t < 8500 ? '再存檔' : t < 9300 ? '重新整理' : '再點一次'
    if (t >= 9300) probe = { at: 'card:1', state: t < 9900 ? 'move' : 'pass', part: p(9300, 9900) }
  }

  const mouse = (on: Target): string => {
    const m = pointer as { on: Target; away: number; press: boolean } | null
    return m?.on === on ? `<i class="tn-mouse${m.press ? ' press' : ''}" style="--away:${m.away.toFixed(3)}"></i>` : ''
  }
  const button = (on: Target, label: string, done = false): string => `<span class="tn-cbtn${done ? ' done' : ''}">${label}${mouse(on)}</span>`
  const caret = '<i class="tn-caret"></i>'
  const me = (text: string, error = false): string =>
    error
      ? `<div class="tn-cq err"><span class="tn-cqtag">貼上看到的問題</span>${kit.esc(text)}</div>`
      : `<p class="tn-cq">${kit.esc(text)}</p>`
  /** AI 的一則回覆:頭像、一句話、深色的程式碼區塊(檔名列與複製鈕) */
  const ai = (intro: string, said: number, lines: readonly string[], count: number, on: Target, done: boolean, selected: boolean): string => {
    const words = kit.graphemes(intro)
    const shown = lines.slice(0, count)
    const block = count
      ? `<figure class="tn-cblock"><figcaption><span>signup.html</span>${button(on, done ? `${COPIED}已複製` : `${COPY}複製`, done)}</figcaption><pre class="${selected ? 'sel' : ''}">${shown.map(highlight).join('\n')}${count < lines.length ? caret : ''}</pre></figure>`
      : ''
    return `<div class="tn-reply">${AVATAR}<div class="tn-cmsg"><p>${kit.esc(words.slice(0, said).join(''))}${said < words.length ? caret : ''}</p>${block}</div></div>`
  }
  /** 等 AI 回覆:三個點依時間輪流亮 */
  const dots = (): string =>
    `<div class="tn-reply">${AVATAR}<div class="tn-cdots">${[0, 1, 2].map((i) => `<i style="opacity:${(0.25 + 0.75 * Math.max(0, Math.sin(t / 140 - i * 1.1))).toFixed(2)}"></i>`).join('')}</div></div>`

  const HELLO = '好的，這是完整的網頁：'
  const SORRY = '抱歉，送出前要先檢查名額：'
  /** 第一則回覆:stage 1 是現場串流,之後是完整的 */
  const first = stage === 1 ? { said: Math.round(kit.graphemes(HELLO).length * p(3350, 3750)), lines: Math.round(CODE.length * p(3750, 6600)) } : { said: 99, lines: CODE.length }
  const second = stage === 3 ? { said: Math.round(kit.graphemes(SORRY).length * p(4900, 5300)), lines: fix } : { said: 0, lines: 0 }

  const chat = [
    asked ? me(ASK) : '',
    stage === 1 && asked && t < 3350 ? dots() : '',
    first.said ? ai(HELLO, first.said, CODE, first.lines, 'copy', copied, stage === 2 && t >= 700 && t < 2300) : '',
    told ? me(BUG, true) : '',
    told && t < 4900 ? dots() : '',
    second.said ? ai(SORRY, second.said, FIX, second.lines, 'copy2', copied2, t >= 6300 && t < 7500) : '',
  ].join('')
  const file = !pasted ? '' : (fixed ? SIGNUP_CODE : CODE).map((l) => (fixed && l === FIX[0] ? `<mark>${kit.esc(l)}</mark>` : kit.esc(l))).join('\n')
  const html =
    `<p class="tn-cdo">${kit.esc(doing)}</p>` +
    `<div class="tn-cwin"><div class="tn-chead">${AVATAR}<b>AI 助理</b><span>對話中</span></div>` +
    `<div class="tn-cchat">${chat || '<p class="tn-cempty">想做什麼？用說的告訴我。</p>'}</div>` +
    `<div class="tn-ccompose"><span class="tn-cinput">${compose ? `${kit.esc(compose)}${caret}` : '<em>傳訊息給 AI 助理…</em>'}</span><span class="tn-csend${compose ? ' ready' : ''}" aria-label="送出">${SEND}${mouse('send')}</span></div></div>` +
    `<div class="tn-ced"><div class="tn-cbar"><b>signup.html</b>${button('save', saved && !(stage === 3 && fixed && t < 8400) ? '已存檔' : '存檔')}${button('open', opened ? '重新整理' : '打開')}</div>` +
    `<pre>${file || '<em>空白的檔案</em>'}</pre>${mouse('editor')}</div>`
  return { html, opened, probe }
}
