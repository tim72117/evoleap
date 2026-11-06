// 演員 kid-mail:兒童網頁課 0.3「網頁是一封信」。左邊是孩子的電腦(瀏覽器),右邊是伺服器(放網頁的電腦),
// 中間一條路,信封沿著路來回:瀏覽器照網址寄信去要網頁,伺服器把網頁裝進信封寄回來,瀏覽器打開信照著畫。
// 在自己的電腦上改字只改到自己這一份(伺服器上的不變);按重新整理會再寄一次信,拿回原本的網頁。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定):
//   sites   伺服器上放的網站:[{ "id": "cat", "url": "www.xiaohua.tw", "name": "小花的家", "emoji": "🐱",
//           "text": "小花是一隻愛睡午覺的橘貓。", "button": "摸摸小花", "color": "#ffe3b3" }];預設三個網站
//   url     網址列一開始的文字,預設空白
//
// 動作(依序操作;順序不對時載入就報錯並指出第幾步):
//   { "type": "www.dino.tw" }             在網址列打網址;加 "tap": true 先用虛擬滑鼠點網址列
//   { "send": true }                      按「前往」:瀏覽器把「請給我這個網址的網頁」的信寄到伺服器(要先 type)
//   { "reply": true }                     伺服器找到網頁裝進信封寄回來;沒有這個網址就回「找不到」(要先 send)
//   { "open": true }                      瀏覽器打開信,照著把網頁一塊一塊畫出來(要先 reply)
//   { "go": "dino" }                      一次做完上面四步(打網址、寄信、寄回、畫出來);加 "tap": true 先點書籤列上的這個網站
//   { "edit": "h1", "text": "我的家" }    在自己的電腦上改網頁的字(h1、p、button),逐字打出來;加 "tap": true 先點那個東西。
//                                         只改瀏覽器裡這一份,伺服器上的信不變(要先打開一個網頁)
//   { "reload": true }                    按重新整理:再寄一次信、拿回伺服器上的網頁,改過的字變回原本的樣子;加 "tap": true 先點重新整理鈕
//   { "check": "server", "answer": "server" }  回答題目:孩子選了 check,正確答案是 answer(都是下面的目標名稱);答對變綠,答錯變紅搖一搖。
//                                         { "check": false } 把顏色拿掉
//
// 狀態可以給子腳本的 until 用:visited(打開過的網站 id)、undone(改過字之後按了幾次重新整理)。
//
// 目標:window、browser(你的電腦)、addressbar(網址列)、go(前往鈕)、reload(重新整理鈕)、page(網頁)、
//       server(伺服器)、road(中間的路)、letter(信封;沒在寄時量不到)、bookmark:<id>(書籤列上的網站)、
//       site:<id>(伺服器上的那封網頁)、part:<h1|img|p|button>(網頁上的東西)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type MailKind = 'type' | 'send' | 'reply' | 'open' | 'go' | 'edit' | 'reload' | 'check'
type Tag = 'h1' | 'img' | 'p' | 'button'
type MailStep = CommonStepFields & {
  type?: string
  send?: true
  reply?: true
  open?: true
  go?: string
  edit?: Tag
  text?: string
  reload?: true
  check?: string | false
  answer?: string
  tap?: boolean
}
export interface MailSite {
  id: string
  url: string
  name: string
  emoji: string
  text: string
  button: string
  /** 圖片底色 */
  color?: string
}
interface MailProps {
  sites?: MailSite[]
  url?: string
}
/** idle 還沒打網址 → typed 打好了 → sent 信寄出去了 → replied 信寄回來了 → open 網頁畫好了 */
type Phase = 'idle' | 'typed' | 'sent' | 'replied' | 'open'
export interface MailState {
  /** 伺服器上的網站(登場設定的 sites;apply 拿不到 props,所以放在狀態裡) */
  sites: MailSite[]
  url: string
  phase: Phase
  /** 最近一次寄信要的網站(null:伺服器上沒有這個網址) */
  want: string | null
  /** 網頁上正在顯示的網站;null 而且 phase 是 open 時,顯示「找不到」 */
  site: string | null
  /** 網頁上改過的字(沒改過的照伺服器上的) */
  texts: Partial<Record<Tag, string>>
  edited: Tag[]
  undone: number
  visited: string[]
  verdict: { target: string; right: boolean } | null
}
type MailTarget = 'window' | 'browser' | 'addressbar' | 'go' | 'reload' | 'page' | 'server' | 'road' | 'letter' | `bookmark:${string}` | `site:${string}` | `part:${string}`

const KINDS: readonly MailKind[] = ['type', 'send', 'reply', 'open', 'go', 'edit', 'reload', 'check']
const TAGS: readonly Tag[] = ['h1', 'img', 'p', 'button']
const EDITABLE: readonly Tag[] = ['h1', 'p', 'button']
const isTag = (x: unknown): x is Tag => typeof x === 'string' && (TAGS as readonly string[]).includes(x)

const DEFAULT_SITES: MailSite[] = [
  { id: 'cat', url: 'www.xiaohua.tw', name: '小花的家', emoji: '🐱', text: '小花是一隻愛睡午覺的橘貓。', button: '摸摸小花', color: '#ffe3b3' },
  { id: 'dino', url: 'www.dino.tw', name: '恐龍圖鑑', emoji: '🦖', text: '暴龍的牙齒像香蕉一樣大。', button: '再看一隻', color: '#d6f2c9' },
  { id: 'sun', url: 'www.weather.tw', name: '天氣小站', emoji: '☀️', text: '今天是大晴天，記得戴帽子。', button: '看明天', color: '#ffe9a8' },
]

const TYPE_CPS = 8
/** 示範點擊:滑鼠 150ms 出發、移動 550ms,到了就點(和 kid-web 一樣) */
const TAP_AT = 750
const TYPE_TAIL = 300
const SEND_MS = 1700
const REPLY_MS = 2000
/** 伺服器先找一下網頁,信封才出發 */
const FIND_MS = 600
const OPEN_MS = 1300
const CHECK_MS = 1200
const RELOAD_PRESS = 400

const sitesOf = (props: MailProps): MailSite[] => props.sites ?? DEFAULT_SITES
const siteByUrl = (sites: MailSite[], url: string): MailSite | undefined => sites.find((x) => x.url === url.trim())
const siteById = (sites: MailSite[], id: string | null): MailSite | undefined => (id ? sites.find((x) => x.id === id) : undefined)
const original = (site: MailSite, tag: Tag): string => (tag === 'h1' ? site.name : tag === 'img' ? site.emoji : tag === 'p' ? site.text : site.button)

/** 一個動作拆成幾段:滑鼠點、打字、寄出、寄回、畫出來、改字…;render 依這個知道現在演到哪一段 */
type SegKind = 'tap' | 'type' | 'press' | 'send' | 'reply' | 'open' | 'edit' | 'check'
type Seg = { kind: SegKind; ms: number }
function segments(kind: MailKind, s: MailStep, props: MailProps): Seg[] {
  const tap: Seg[] = s.tap ? [{ kind: 'tap', ms: TAP_AT }] : []
  const typeMs = (url: string): number => kit.typeDuration(url, TYPE_CPS) + TYPE_TAIL
  switch (kind) {
    case 'type':
      return [...tap, { kind: 'type', ms: typeMs(s.type ?? '') }]
    case 'send':
      return [{ kind: 'send', ms: SEND_MS }]
    case 'reply':
      return [{ kind: 'reply', ms: REPLY_MS }]
    case 'open':
      return [{ kind: 'open', ms: OPEN_MS }]
    case 'go': {
      const url = siteById(sitesOf(props), s.go ?? null)?.url ?? ''
      return [...tap, { kind: 'type', ms: typeMs(url) }, { kind: 'send', ms: SEND_MS }, { kind: 'reply', ms: REPLY_MS }, { kind: 'open', ms: OPEN_MS }]
    }
    case 'reload':
      return [...tap, { kind: 'press', ms: RELOAD_PRESS }, { kind: 'send', ms: SEND_MS }, { kind: 'reply', ms: REPLY_MS }, { kind: 'open', ms: OPEN_MS }]
    case 'edit':
      return [...tap, { kind: 'edit', ms: kit.typeDuration(s.text ?? '', TYPE_CPS) + 600 }]
    default:
      return [{ kind: 'check', ms: CHECK_MS }]
  }
}
/** 現在演到哪一段、那一段的進度(0–1);動作結束後回傳 null */
function segAt(list: Seg[], local: number): { kind: SegKind; local: number; p: number; i: number } | null {
  let t = 0
  for (let i = 0; i < list.length; i++) {
    const x = list[i]
    if (local < t + x.ms) return { kind: x.kind, local: local - t, p: kit.clamp((local - t) / x.ms), i }
    t += x.ms
  }
  return null
}

const TARGETS_CHECK = ['browser', 'server', 'addressbar', 'reload', 'page', 'go']

const actor = defineActor<MailKind, MailStep, MailProps, MailState, MailTarget>({
  name: 'kid-mail',
  kinds: KINDS,

  hotspots(_st, props) {
    // 沒寫 interact.spots 時的預設:點書籤列上的網站,就寄信去要那個網頁
    return sitesOf(props).map((x) => ({ target: `bookmark:${x.id}`, label: x.name, step: { go: x.id, narration: `寄信去要「${x.name}」的網頁。` } }))
  },

  init(props) {
    const sites = sitesOf(props)
    if (!Array.isArray(sites) || !sites.length) throw new Error('sites 要列出伺服器上的網站')
    const ids = new Set<string>()
    for (const x of sites) {
      if (!x.id || !x.url || !x.name) throw new Error('sites:每個網站都要有 id、url、name')
      if (ids.has(x.id)) throw new Error(`sites:id「${x.id}」重複了`)
      ids.add(x.id)
    }
    const url = props.url ?? ''
    return { sites, url, phase: url ? 'typed' : 'idle', want: null, site: null, texts: {}, edited: [], undone: 0, visited: [], verdict: null }
  },

  apply(st, kind, s) {
    const clear = { verdict: null }
    if (kind === 'type') {
      if (typeof s.type !== 'string' || !s.type) throw new Error('type 要寫網址')
      return { ...st, ...clear, url: s.type, phase: 'typed' }
    }
    if (kind === 'send') {
      if (st.phase !== 'typed' && st.phase !== 'open') throw new Error('send:要先 type 打好網址')
      if (!st.url) throw new Error('send:網址列是空的')
      return { ...st, ...clear, phase: 'sent', want: siteByUrl(st.sites, st.url)?.id ?? null }
    }
    if (kind === 'reply') {
      if (st.phase !== 'sent') throw new Error('reply:要先 send 寄信')
      return { ...st, ...clear, phase: 'replied' }
    }
    if (kind === 'open') {
      if (st.phase !== 'replied') throw new Error('open:要先 reply 寄回來')
      return opened(st, st.want)
    }
    if (kind === 'go') {
      const site = siteById(st.sites, s.go ?? null)
      if (!site) throw new Error(`go:sites 裡沒有「${String(s.go)}」`)
      return opened({ ...st, url: site.url }, site.id)
    }
    if (kind === 'edit') {
      if (!isTag(s.edit) || !EDITABLE.includes(s.edit)) throw new Error(`edit:只能改 ${EDITABLE.join('、')} 的字`)
      if (typeof s.text !== 'string' || !s.text) throw new Error('edit 要寫新的字(text)')
      if (st.phase !== 'open' || !st.site) throw new Error('edit:要先打開一個網頁')
      const edited = st.edited.includes(s.edit) ? st.edited : [...st.edited, s.edit]
      return { ...st, ...clear, texts: { ...st.texts, [s.edit]: s.text }, edited }
    }
    if (kind === 'reload') {
      if (st.phase !== 'open' || !st.url) throw new Error('reload:要先打開一個網頁')
      const id = siteByUrl(st.sites, st.url)?.id ?? null
      const back = opened({ ...st, want: id }, id)
      return { ...back, undone: st.undone + (st.edited.length ? 1 : 0) }
    }
    if (s.check === false) return { ...st, verdict: null }
    if (typeof s.check !== 'string' || typeof s.answer !== 'string') throw new Error('check 和 answer 都要寫目標名稱,例如 { "check": "server", "answer": "server" }')
    for (const t of [s.check, s.answer]) if (!TARGETS_CHECK.includes(t)) throw new Error(`check/answer 要是 ${TARGETS_CHECK.join('、')}`)
    return { ...st, verdict: { target: s.check, right: s.check === s.answer } }
  },

  duration(kind, step, props) {
    return segments(kind, step, props).reduce((n, x) => n + x.ms, 0)
  },

  cursor(kind, step) {
    if (!step.tap) return null
    const to: Record<string, string | undefined> = {
      type: 'addressbar',
      go: step.go ? `bookmark:${step.go}` : undefined,
      edit: step.edit ? `part:${step.edit}` : undefined,
      reload: 'reload',
    }
    const target = to[kind]
    return target ? { moves: [{ at: 150, target }], clickAt: TAP_AT } : null
  },

  mount(root, props) {
    const sites = sitesOf(props)
    root.classList.add('A-kid-mail')
    root.innerHTML = `
      <div class="km-road"><i></i></div>
      <div class="km-pane km-browser">
        <p class="km-label">🧒 你的電腦</p>
        <div class="km-win">
          <div class="km-bar">
            <span class="km-lights"><i></i><i></i><i></i></span>
            <span class="km-reload">↻</span>
            <span class="km-url"><b></b><s></s></span>
            <span class="km-go">前往 ➜</span>
          </div>
          <div class="km-marks">${sites.map((x) => `<span class="km-mark" data-id="${kit.esc(x.id)}">${kit.esc(x.emoji)} ${kit.esc(x.name)}</span>`).join('')}</div>
          <div class="km-page">
            <p class="km-empty"></p>
            <div class="km-site">
              ${TAGS.map((t) => `<div class="km-part" data-tag="${t}"><span></span><em>✏️</em></div>`).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="km-pane km-server">
        <p class="km-label">🖥️ 伺服器（放網頁的電腦）</p>
        <div class="km-shelf">
          ${sites.map((x) => `<div class="km-file" data-id="${kit.esc(x.id)}"><span class="km-file-emoji">${kit.esc(x.emoji)}</span><span class="km-file-text"><strong>${kit.esc(x.name)}</strong><small>${kit.esc(x.url)}</small></span></div>`).join('')}
          <p class="km-miss">？找不到這個網址</p>
        </div>
      </div>
      <div class="km-letter"><span class="km-env">✉️</span><span class="km-note"></span></div>`
    const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!
    const browser = $('.km-browser')
    const server = $('.km-server')
    const road = $('.km-road')
    const urlBox = $('.km-url')
    const urlText = $('.km-url b')
    const caret = $('.km-url s')
    const goBtn = $('.km-go')
    const reloadBtn = $('.km-reload')
    const page = $('.km-page')
    const empty = $('.km-empty')
    const siteBox = $('.km-site')
    const letter = $('.km-letter')
    const note = $('.km-note')
    const miss = $('.km-miss')
    const marks = new Map(sites.map((x) => [x.id, $(`.km-mark[data-id="${CSS.escape(x.id)}"]`)]))
    const files = new Map(sites.map((x) => [x.id, $(`.km-file[data-id="${CSS.escape(x.id)}"]`)]))
    const parts = new Map(TAGS.map((t) => [t, $(`.km-part[data-tag="${t}"]`)]))
    const partText = new Map(TAGS.map((t) => [t, $(`.km-part[data-tag="${t}"] > span`)]))
    const checkable: Record<string, HTMLElement> = { browser, server, addressbar: urlBox, reload: reloadBtn, page, go: goBtn }
    // 外框比寬還高(直式舞台)時上下排;外框大小改變才重算(kit.tallWatch),不在每一格量版面
    const isTall = kit.tallWatch(root)

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        const ev = view.ev && KINDS.includes(view.ev.kind as MailKind) ? view.ev : null
        const from = view.prev
        const to = view.ev?.kind === 'hide' ? view.prev : view.state
        const step = (ev?.step ?? {}) as MailStep
        const seg = ev ? segAt(segments(ev.kind as MailKind, step, props), ev.local) : null
        const tall = isTall()
        if (root.dataset.tall !== String(tall)) root.dataset.tall = String(tall)

        // ── 網址列:打字時逐字打出來,其他時候是狀態的網址 ──
        let url = to.url
        const typingUrl = ev && (ev.kind === 'type' || ev.kind === 'go') ? to.url : null
        if (typingUrl !== null && seg) {
          if (seg.kind === 'tap') url = from.url
          else if (seg.kind === 'type') url = kit.typewriter(typingUrl, seg.local, { cps: TYPE_CPS }).text
        }
        kit.setIf(urlText, 'text', url)
        kit.css(caret, { opacity: seg?.kind === 'type' && Math.floor(seg.local / 400) % 2 === 0 ? '1' : '0' })
        // 按前往、按重新整理:按鈕壓下去一下
        const pressGo = seg?.kind === 'send' && seg.i === (step.tap ? 2 : 1) && ev?.kind === 'go' ? seg.p : seg?.kind === 'send' && ev?.kind === 'send' ? seg.p : -1
        kit.css(goBtn, { transform: pressGo >= 0 && pressGo < 0.15 ? 'translateY(4px)' : 'none' })
        const spin = seg?.kind === 'press' ? seg.p : -1
        kit.css(reloadBtn, { transform: `rotate(${spin >= 0 ? Math.round(spin * 360) : 0}deg)` })

        // ── 信封:寄出往右(往下),寄回往左(往上);伺服器先找一下再寄 ──
        const want = siteById(sites, to.want) ?? (ev?.kind === 'go' ? siteById(sites, step.go ?? null) : undefined)
        const asked = (ev?.kind === 'reload' ? to.url : url) || to.url
        let lp = -1 // 信封的位置:0 在瀏覽器、1 在伺服器
        if (seg?.kind === 'send') {
          lp = kit.ease.inOutCubic(seg.p)
          kit.setIf(note, 'text', `請給我 ${asked}`)
        } else if (seg?.kind === 'reply' && seg.local >= FIND_MS) {
          lp = 1 - kit.ease.inOutCubic(kit.progress(seg.local, FIND_MS, REPLY_MS - FIND_MS))
          kit.setIf(note, 'text', want ? `${want.emoji} ${want.name} 的網頁` : '找不到這個網址')
        }
        // 動作演完、旁白還在念的時候,信封停在路的那一頭:寄出後停在伺服器,寄回後停在瀏覽器,等下一步
        const parked = !seg && (to.phase === 'sent' || to.phase === 'replied')
        if (parked) {
          lp = to.phase === 'sent' ? 1 : 0
          kit.setIf(note, 'text', to.phase === 'sent' ? `請給我 ${to.url}` : want ? `${want.emoji} ${want.name} 的網頁` : '找不到這個網址')
        }
        const back = seg?.kind === 'reply' || (parked && to.phase === 'replied')
        letter.dataset.show = lp >= 0 ? 'true' : 'false'
        letter.dataset.dir = back ? 'back' : 'out'
        letter.dataset.miss = back && !want ? 'true' : 'false'
        const pos = tall ? { x: 50, y: kit.lerp(56, 63, lp) } : { x: kit.lerp(46, 64, lp), y: 30 }
        const hop = Math.sin(Math.max(0, lp) * Math.PI) * 4
        kit.css(letter, { left: `${pos.x.toFixed(2)}%`, top: `${(pos.y - (tall ? 0 : hop)).toFixed(2)}%` })

        // ── 伺服器:收到信時,被要的那封網頁亮起來;沒有這個網址就冒出問號 ──
        const finding = (seg?.kind === 'send' && seg.p > 0.85) || seg?.kind === 'reply' || (parked && to.phase === 'sent')
        for (const x of sites) files.get(x.id)!.dataset.on = finding && want?.id === x.id ? 'true' : 'false'
        miss.dataset.show = finding && !want ? 'true' : 'false'
        // 書籤:go 的那一個在點下去時亮一下
        for (const x of sites) marks.get(x.id)!.dataset.on = ev?.kind === 'go' && step.go === x.id && (seg?.kind === 'tap' || seg?.kind === 'type') ? 'true' : 'false'

        // ── 網頁:寄信、等信時變淡;打開時一塊一塊由上往下畫出來 ──
        const before = ev && seg && seg.kind !== 'open' && ev.kind !== 'edit' && ev.kind !== 'check' && ev.kind !== 'type'
        const shown = before ? from : to
        const waiting = !!before && (seg.kind === 'send' || seg.kind === 'reply' || seg.kind === 'press')
        const openP = seg?.kind === 'open' ? seg.p : 1
        const site = shown.phase === 'open' ? siteById(sites, shown.site) : undefined
        const notFound = shown.phase === 'open' && !site
        kit.setIf(empty, 'text', notFound ? '😢 找不到這個網址' : site ? '' : waiting ? '⏳ 等信寄回來…' : '（還沒有網頁）')
        siteBox.dataset.show = site ? 'true' : 'false'
        kit.css(page, { opacity: waiting && site ? '0.35' : '1' })
        if (site) {
          page.style.setProperty('--photo', site.color ?? '#ffe3b3')
          const typing = ev?.kind === 'edit' && seg?.kind === 'edit' ? step : null
          TAGS.forEach((t, i) => {
            let text = shown.texts[t] ?? original(site, t)
            if (typing && typing.edit === t && seg) text = kit.typewriter(text, seg.local, { cps: TYPE_CPS }).text
            else if (ev?.kind === 'edit' && typing === null && step.edit === t) text = from.texts[t] ?? original(site, t)
            kit.setIf(partText.get(t)!, 'text', text)
            const appear = kit.clamp((openP - i * 0.18) / 0.3)
            const el = parts.get(t)!
            kit.css(el, { opacity: appear.toFixed(3), transform: `translateY(${((1 - appear) * 30).toFixed(1)}px)` })
            el.dataset.edited = shown.edited.includes(t) ? 'true' : 'false'
          })
        }

        // ── 回答題目:選的那一塊變綠或變紅,答錯搖一搖 ──
        const v = to.verdict
        const shakeP = ev?.kind === 'check' && v && !v.right ? ev.p : 1
        for (const [name, el] of Object.entries(checkable)) {
          el.dataset.verdict = v && v.target === name ? (v.right ? 'right' : 'wrong') : ''
          const shake = v && !v.right && v.target === name && shakeP < 1 ? Math.sin(shakeP * Math.PI * 6) * (1 - shakeP) * 14 : 0
          kit.css(el, { translate: `${shake.toFixed(2)}px 0` })
        }
      },

      target(name) {
        if (name === 'window') return root
        if (name === 'browser') return browser
        if (name === 'server') return server
        if (name === 'road') return road
        if (name === 'addressbar') return urlBox
        if (name === 'go') return goBtn
        if (name === 'reload') return reloadBtn
        if (name === 'page') return page
        if (name === 'letter') return letter.dataset.show === 'true' ? letter : null
        const m = /^(bookmark|site|part):(.+)$/.exec(name)
        if (!m) return null
        if (m[1] === 'bookmark') return marks.get(m[2]) ?? null
        if (m[1] === 'site') return files.get(m[2]) ?? null
        return isTag(m[2]) ? (parts.get(m[2]) ?? null) : null
      },
    }
  },
})

/** 打開信:網頁換成這個網站(沒有就是找不到),改過的字清掉,記下來過的網站 */
function opened(st: MailState, id: string | null): MailState {
  const visited = id && !st.visited.includes(id) ? [...st.visited, id] : st.visited
  return { ...st, phase: 'open', want: id, site: id, texts: {}, edited: [], visited, verdict: null }
}

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
