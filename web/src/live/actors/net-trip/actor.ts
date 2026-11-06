// 演員 net-trip:輸入網址之後發生的事。左邊是瀏覽器、中上是 DNS(網域的電話簿)、右邊是伺服器,
// 一封信(封包)沿著線來回:問 DNS 要 IP、向伺服器送出請求、伺服器回應網頁、瀏覽器把它畫出來。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定,只描述起始狀態):
//   domain   伺服器的網域,DNS 的電話簿裡只有這一筆;預設 "www.example.com"
//   ip       伺服器的 IP;預設 "93.184.216.34"
//   pages    伺服器上有的網頁:路徑 → { title, heading?, text? };預設只有 "/"(檔名 index.html)。
//            其他路徑的檔名是「路徑.html」,例如 "/menu" → menu.html
//   online   伺服器一開始有沒有開機;預設 true
//   url      網址列一開始的文字;預設空白
//
// 動作(依序操作;順序不對時載入就報錯,並指出第幾步):
//   { "type": "www.example.com" }   (滑鼠)點網址列,逐字打出網址;任何時候都可以重新輸入
//   { "enter": true }               按 Enter,開始前往這個網址(要先 type)。瀏覽器記得 IP 時可以直接 request
//   { "lookup": true }              瀏覽器寄信問 DNS:「這個網域的 IP 是多少?」(要先 enter)
//   { "answer": true }              DNS 查電話簿回覆 IP(泡泡),信寄回瀏覽器,網址列下方記下 IP(要先 lookup)。
//                                   網域不在電話簿裡時回覆「查無此網域」,瀏覽器顯示找不到網站
//   { "request": true }             瀏覽器把請求(GET /路徑)寄到伺服器的 IP(要先知道 IP)。
//                                   伺服器關機時信送不到,瀏覽器顯示無法連上
//   { "respond": true }             伺服器找檔案、寄回回應:有這一頁是 200 OK + 檔名,沒有是 404 Not Found(要先 request)
//   { "render": true }              瀏覽器依收到的檔案把畫面一塊塊畫出來(要先 respond)
//   { "power": false }              關掉伺服器;{ "power": true } 開機
//   { "restart": true }             關掉瀏覽器再打開:網址列與畫面清空,也忘了記得的 IP(下次要重新問 DNS)
//   舞台的 show / hide 也可以順便帶一個動作,例如 { "show": "net", "type": "www.example.com" }。
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window(整個畫面)、browser(瀏覽器視窗)、addressbar(網址列)、page(網頁內容區)、
//   dns(DNS 電話簿)、server(伺服器)、path(瀏覽器與伺服器之間的線)、packet(正在寄送的信;沒在寄時量不到)
import { kit } from '../../kit'
import { defineActor, type CommonStepFields, type CursorPlan, type Hotspot } from '../../types'
import './actor.css'

// ---------- 型別 ----------

export interface NetPage {
  title: string
  heading?: string
  text?: string
}
export interface NetTripProps {
  domain?: string
  ip?: string
  pages?: Record<string, NetPage>
  online?: boolean
  url?: string
}

const KINDS = ['type', 'enter', 'lookup', 'answer', 'request', 'respond', 'render', 'power', 'restart'] as const
type NetKind = (typeof KINDS)[number]
export type NetStep = CommonStepFields & {
  type?: string
  enter?: true
  lookup?: true
  answer?: true
  request?: true
  respond?: true
  render?: true
  power?: boolean
  restart?: true
}
type NetTarget = 'window' | 'browser' | 'addressbar' | 'page' | 'dns' | 'server' | 'path' | 'packet'

/**
 * 進行到哪裡:idle 還沒輸入 → typed 打好網址 → entered 按了 Enter → asking 問 DNS 中 → resolved 拿到 IP
 * → requested 請求送到伺服器 → responded 拿到回應 → rendered 畫好;failed 是查不到網域或連不上
 */
export type NetPhase = 'idle' | 'typed' | 'entered' | 'asking' | 'resolved' | 'requested' | 'responded' | 'rendered' | 'failed'
/** 網頁內容區顯示的東西 */
export type Shown = { kind: 'page'; page: NetPage } | { kind: 'notfound'; path: string } | { kind: 'error'; error: 'dns' | 'down'; domain: string }
export interface NetState {
  site: { domain: string; ip: string; pages: Record<string, NetPage> }
  online: boolean
  /** 網址列上的文字 */
  url: string
  /** 最近一次 enter 的網域與路徑 */
  domain: string | null
  path: string
  /** 瀏覽器記得的 IP(網域 → IP) */
  cache: Record<string, string>
  phase: NetPhase
  response: { status: 200 | 404; file: string } | null
  shown: Shown | null
  temp: Record<string, never>
}

// ---------- 網址 ----------

/** 拆出網域與路徑:去掉 http(s)://,第一個 / 之前是網域;? 之後的查詢字串與 # 之後的錨點不是路徑(請求的還是同一個檔案) */
export function parseUrl(url: string): { domain: string; path: string } {
  const rest = url.trim().replace(/^https?:\/\//i, '').replace(/[?#].*$/s, '')
  const cut = rest.indexOf('/')
  const domain = (cut < 0 ? rest : rest.slice(0, cut)).toLowerCase()
  const path = cut < 0 ? '/' : rest.slice(cut) || '/'
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) throw new Error(`「${url}」不是有效的網址(網域要像 www.example.com)`)
  return { domain, path }
}
/** 路徑 → 伺服器上的檔名 */
export const fileOf = (path: string): string => (path === '/' ? 'index.html' : /\.[a-z0-9]+$/i.test(path) ? path.slice(1) : `${path.slice(1)}.html`)

const DEFAULT_PAGES: Record<string, NetPage> = {
  '/': { title: 'Example Domain', heading: '歡迎光臨', text: '這是伺服器上的 index.html,瀏覽器把它畫成你看到的畫面。' },
}

// ---------- 時間表(毫秒,相對動作開始) ----------
const T = {
  click: 550,
  typeStart: 750,
  cps: 12,
  typeTail: 450,
  enter: 900,
  lookup: 1700,
  answerPop: 700,
  answerTravel: 1400,
  answerTail: 300,
  request: 1900,
  downHit: 1500,
  downTail: 1200,
  respondFind: 700,
  respondTravel: 1700,
  respondTail: 300,
  render: 2200,
  power: 900,
  restart: 1200,
}

// 線的位置(演員畫面的百分比座標):瀏覽器 → DNS 是一條曲線,瀏覽器 → 伺服器是直線
type Pt = readonly [number, number]
const DNS_PATH: [Pt, Pt, Pt] = [[40, 33], [55, 33], [55, 25]]
const MAIN_PATH: [Pt, Pt] = [[40, 58], [80, 58]]
const bez = ([a, c, b]: [Pt, Pt, Pt], t: number): Pt => [
  (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0],
  (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1],
]
const seg = ([a, b]: [Pt, Pt], t: number): Pt => [kit.lerp(a[0], b[0], t), kit.lerp(a[1], b[1], t)]

const IN_FLIGHT: NetPhase[] = ['entered', 'asking', 'resolved', 'requested', 'responded']

// ---------- 狀態推算 ----------

function apply(st: NetState, kind: NetKind, s: NetStep): NetState {
  switch (kind) {
    case 'type': {
      if (typeof s.type !== 'string' || !s.type.trim()) throw new Error('type 要寫網址(字串)')
      return { ...st, url: s.type, phase: 'typed', response: null }
    }
    case 'enter': {
      if (st.phase !== 'typed') throw new Error('enter:網址列還沒輸入新網址,先用 type')
      const { domain, path } = parseUrl(st.url)
      return { ...st, domain, path, phase: 'entered', response: null }
    }
    case 'lookup':
      if (st.phase !== 'entered') throw new Error('lookup:要先 enter 送出網址,才會去問 DNS')
      return { ...st, phase: 'asking' }
    case 'answer': {
      if (st.phase !== 'asking') throw new Error('answer:DNS 還沒收到問題,先用 lookup')
      const domain = st.domain as string
      if (domain !== st.site.domain) return { ...st, phase: 'failed', shown: { kind: 'error', error: 'dns', domain } }
      return { ...st, phase: 'resolved', cache: { ...st.cache, [domain]: st.site.ip } }
    }
    case 'request': {
      if (st.phase !== 'entered' && st.phase !== 'resolved') throw new Error('request:要先 enter 送出網址(還不知道 IP 時再 lookup、answer)')
      const domain = st.domain as string
      if (!st.cache[domain]) throw new Error(`request:瀏覽器還不知道「${domain}」的 IP,先 lookup 問 DNS、再 answer`)
      if (!st.online) return { ...st, phase: 'failed', shown: { kind: 'error', error: 'down', domain } }
      return { ...st, phase: 'requested' }
    }
    case 'respond': {
      if (st.phase !== 'requested') throw new Error('respond:伺服器還沒收到請求,先用 request')
      if (!st.online) throw new Error('respond:伺服器關機了,不能回應')
      const found = Object.prototype.hasOwnProperty.call(st.site.pages, st.path)
      return { ...st, phase: 'responded', response: { status: found ? 200 : 404, file: fileOf(st.path) } }
    }
    case 'render': {
      if (st.phase !== 'responded' || !st.response) throw new Error('render:還沒收到伺服器的回應,先用 respond')
      const shown: Shown = st.response.status === 200 ? { kind: 'page', page: st.site.pages[st.path] } : { kind: 'notfound', path: st.path }
      return { ...st, phase: 'rendered', shown }
    }
    case 'power': {
      if (typeof s.power !== 'boolean') throw new Error('power 要寫 true(開機)或 false(關機)')
      if (s.power === st.online) throw new Error(`power:伺服器已經${st.online ? '開機' : '關機'}了`)
      return { ...st, online: s.power }
    }
    case 'restart':
      return { ...st, url: '', domain: null, path: '/', cache: {}, phase: 'idle', response: null, shown: null }
  }
}

/** 這一步的動作種類(show/hide 帶的動作也算) */
const kindIn = (kind: string, step: object): NetKind | null =>
  (KINDS as readonly string[]).includes(kind) ? (kind as NetKind) : kind === 'show' || kind === 'hide' ? (KINDS.find((k) => k in step) ?? null) : null

function durationOf(kind: NetKind, s: NetStep, prev: NetState | undefined): number {
  switch (kind) {
    case 'type': return T.typeStart + kit.typeDuration(s.type ?? '', T.cps) + T.typeTail
    case 'enter': return T.enter
    case 'lookup': return T.lookup
    case 'answer': return T.answerPop + T.answerTravel + T.answerTail
    case 'request': return prev && !prev.online ? T.downHit + T.downTail : T.request
    case 'respond': return T.respondFind + T.respondTravel + T.respondTail
    case 'render': return T.render
    case 'power': return T.power
    case 'restart': return T.restart
  }
}

// ---------- 畫面 ----------

const ENVELOPE = '<svg viewBox="0 0 48 34" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="31" rx="4"/><path d="M3 4l21 15L45 4"/></svg>'

function pageHtml(shown: Shown | null): string {
  if (!shown) return '<div class="tr-blank">空白分頁</div>'
  if (shown.kind === 'page') {
    const p = shown.page
    return `<div class="tr-site"><div class="tr-site-nav" data-k="0"><b>${kit.esc(p.title)}</b><i></i><i></i><i></i></div>` +
      `<div class="tr-site-hero" data-k="1"><h1>${kit.esc(p.heading ?? p.title)}</h1>${p.text ? `<p>${kit.esc(p.text)}</p>` : ''}</div>` +
      `<div class="tr-site-cards" data-k="2"><span></span><span></span><span></span></div><div class="tr-site-lines" data-k="3"><i></i><i></i><i></i></div></div>`
  }
  if (shown.kind === 'notfound') {
    return `<div class="tr-site tr-site-404"><div class="tr-site-hero" data-k="0"><h1>404</h1><p>Not Found:伺服器上沒有「${kit.esc(shown.path)}」這一頁。</p></div><div class="tr-site-lines" data-k="1"><i></i><i></i></div></div>`
  }
  const msg = shown.error === 'dns' ? `DNS 查不到「${kit.esc(shown.domain)}」的 IP。` : `伺服器沒有回應(${kit.esc(shown.domain)})。`
  return `<div class="tr-error"><div class="tr-error-icon">!</div><h2>${shown.error === 'dns' ? '找不到這個網站' : '無法連上這個網站'}</h2><p>${msg}</p></div>`
}
const titleOf = (shown: Shown | null): string => {
  if (!shown) return '新分頁'
  if (shown.kind === 'page') return shown.page.title
  if (shown.kind === 'notfound') return '404 Not Found'
  return shown.error === 'dns' ? '找不到網站' : '無法連上'
}

/** 正在寄送的信:位置(百分比)、透明度、標籤;沒在寄時回傳 null */
type Flight = { at: Pt; op: number; label: string; tone: 'ask' | 'ok' | 'bad'; shake: number }
function flightOf(kind: NetKind, local: number, prev: NetState, st: NetState): Flight | null {
  const fade = (t: number) => Math.min(kit.progress(t, 0, 0.08), 1 - kit.progress(t, 0.94, 0.06))
  const go = (start: number, dur: number) => kit.ease.inOutCubic(kit.progress(local, start, dur))
  const domain = st.domain ?? ''
  switch (kind) {
    case 'lookup': {
      if (local >= T.lookup - 100) return null
      const t = go(0, T.lookup - 200)
      return { at: bez(DNS_PATH, t), op: fade(t), label: `${domain} 的 IP?`, tone: 'ask', shake: 0 }
    }
    case 'answer': {
      if (local < T.answerPop || local >= T.answerPop + T.answerTravel) return null
      const t = go(T.answerPop, T.answerTravel)
      const ok = st.phase === 'resolved'
      return { at: bez(DNS_PATH, 1 - t), op: fade(t), label: ok ? st.site.ip : '查無此網域', tone: ok ? 'ok' : 'bad', shake: 0 }
    }
    case 'request': {
      const label = `GET ${prev.path}`
      if (prev.online) {
        if (local >= T.request - 100) return null
        const t = go(0, T.request - 200)
        return { at: seg(MAIN_PATH, t), op: fade(t), label, tone: 'ask', shake: 0 }
      }
      // 伺服器關機:信送到門口,沒人收,晃一下就消失
      const t = go(0, T.downHit) * 0.86
      const after = kit.progress(local, T.downHit, T.downTail)
      if (after >= 1) return null
      return { at: seg(MAIN_PATH, t), op: Math.min(kit.progress(local, 0, 150), 1 - kit.progress(after, 0.6, 0.4)), label: after > 0 ? '沒有回應' : label, tone: after > 0 ? 'bad' : 'ask', shake: after > 0 ? Math.sin(after * 40) * (1 - after) : 0 }
    }
    case 'respond': {
      if (local < T.respondFind || local >= T.respondFind + T.respondTravel) return null
      const t = go(T.respondFind, T.respondTravel)
      const r = st.response!
      return { at: seg(MAIN_PATH, 1 - t), op: fade(t), label: r.status === 200 ? `200 OK · ${r.file}` : '404 Not Found', tone: r.status === 200 ? 'ok' : 'bad', shake: 0 }
    }
    default:
      return null
  }
}

const actor = defineActor<NetKind, NetStep, NetTripProps, NetState, NetTarget>({
  name: 'net-trip',
  kinds: KINDS,

  init(props) {
    const domain = (props.domain ?? 'www.example.com').toLowerCase()
    parseUrl(domain)
    const pages = props.pages ?? DEFAULT_PAGES
    if (!Object.keys(pages).length) throw new Error('pages 至少要有一頁')
    for (const p of Object.keys(pages)) if (!p.startsWith('/')) throw new Error(`pages 的路徑要以 / 開頭(「${p}」)`)
    return {
      site: { domain, ip: props.ip ?? '93.184.216.34', pages },
      online: props.online ?? true,
      url: props.url ?? '',
      domain: null,
      path: '/',
      cache: {},
      phase: props.url ? 'typed' : 'idle',
      response: null,
      shown: null,
      temp: {},
    }
  },

  apply,

  duration(kind, step, _props, prev) {
    return durationOf(kind, step, prev)
  },

  autoFocus(kind) {
    return kind === 'type' || kind === 'enter' || kind === 'render' ? 'browser' : false
  },

  cursor(kind): CursorPlan | null {
    if (kind === 'type') return { moves: [{ at: 0, target: 'addressbar' }], clickAt: T.click }
    return null
  },

  hotspots(st) {
    const next: Partial<Record<NetPhase, Hotspot<NetStep>>> = {
      typed: { target: 'addressbar', label: '按 Enter', step: { enter: true } },
      entered: st.domain && st.cache[st.domain] ? { target: 'server', label: '送出請求', step: { request: true } } : { target: 'dns', label: '問 DNS', step: { lookup: true } },
      asking: { target: 'dns', label: 'DNS 回覆', step: { answer: true } },
      resolved: { target: 'server', label: '送出請求', step: { request: true } },
      // 請求送到之後伺服器才關機:收不到回應,要先開機
      requested: st.online ? { target: 'server', label: '伺服器回應', step: { respond: true } } : { target: 'server', label: '開機', step: { power: true } },
      responded: { target: 'page', label: '畫出網頁', step: { render: true } },
    }
    const typing: Hotspot<NetStep> = { target: 'addressbar', label: '輸入網址', input: { placeholder: st.site.domain, step: (text: string) => ({ type: text }) } }
    const n = next[st.phase]
    return n ? [n] : [typing]
  },

  mount(root, props) {
    root.classList.add('A-net-trip')
    root.innerHTML =
      `<svg class="tr-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">` +
      `<path class="tr-line tr-line-dns" d="M${DNS_PATH[0].join(' ')} Q${DNS_PATH[1].join(' ')} ${DNS_PATH[2].join(' ')}"/>` +
      `<path class="tr-line tr-line-main" d="M${MAIN_PATH[0].join(' ')} L${MAIN_PATH[1].join(' ')}"/></svg>` +
      `<div class="tr-path"><span>網際網路</span></div>` +
      `<div class="tr-browser"><div class="tr-bar"><span class="tr-light"></span><span class="tr-light"></span><span class="tr-light"></span>` +
      `<div class="tr-tab"><span class="tr-spin"></span><span class="tr-tab-title"></span></div></div>` +
      `<div class="tr-toolbar"><div class="tr-url"><span class="tr-url-text"></span><span class="tr-caret"></span><span class="tr-placeholder">輸入網址</span></div><span class="tr-enter">Enter ↵</span></div>` +
      `<div class="tr-ipchip"></div><div class="tr-view"><div class="tr-page"></div><div class="tr-drawing">依收到的檔案畫出畫面</div></div></div>` +
      `<div class="tr-tag tr-tag-browser">瀏覽器</div>` +
      `<div class="tr-dns"><div class="tr-head"><b>DNS</b><small>網域的電話簿</small></div>` +
      `<div class="tr-book"><div class="tr-row"><span class="tr-row-name"></span><span class="tr-row-ip"></span></div><div class="tr-row tr-row-more"><span>⋯</span><span>⋯</span></div></div>` +
      `<div class="tr-bubble"></div></div>` +
      `<div class="tr-server"><div class="tr-head"><b>伺服器</b><small class="tr-server-ip"></small></div>` +
      `<div class="tr-rack"><div class="tr-unit"><i></i><i></i><span></span></div><div class="tr-unit"><i></i><i></i><span></span></div><div class="tr-unit"><i></i><i></i><span></span></div></div>` +
      `<div class="tr-files"></div><div class="tr-status"></div><div class="tr-note"></div></div>` +
      `<div class="tr-packet"><div class="tr-env">${ENVELOPE}</div><div class="tr-plabel"></div></div>`
    const $ = <E extends Element = HTMLElement>(s: string): E => root.querySelector<E>(s)!
    const browser = $('.tr-browser')
    const tabTitle = $('.tr-tab-title')
    const spin = $('.tr-spin')
    const url = $('.tr-url')
    const urlText = $('.tr-url-text')
    const caret = $('.tr-caret')
    const placeholder = $('.tr-placeholder')
    const enter = $('.tr-enter')
    const ipchip = $('.tr-ipchip')
    const page = $('.tr-page')
    const drawing = $('.tr-drawing')
    const dns = $('.tr-dns')
    const row = $('.tr-row')
    const bubble = $('.tr-bubble')
    const server = $('.tr-server')
    const files = $('.tr-files')
    const status = $('.tr-status')
    const note = $('.tr-note')
    const leds = [...root.querySelectorAll<HTMLElement>('.tr-unit i')]
    const lineDns = $<SVGPathElement>('.tr-line-dns')
    const lineMain = $<SVGPathElement>('.tr-line-main')
    const pathEl = $('.tr-path')
    const packet = $('.tr-packet')
    const plabel = $('.tr-plabel')
    let flying = false

    const site0 = actor.init!(props).site
    kit.setIf($('.tr-row-name'), 'text', site0.domain)
    kit.setIf($('.tr-row-ip'), 'text', site0.ip)
    kit.setIf($('.tr-server-ip'), 'text', site0.ip)
    kit.setIf(files, 'html', Object.keys(site0.pages).map((p) => `<span data-file="${kit.esc(fileOf(p))}">${kit.esc(fileOf(p))}</span>`).join(''))
    const fileEls = [...files.children] as HTMLElement[]

    return {
      render(frame, ms) {
        const view = frame.view
        if (!view) return
        const ev = view.ev
        const kind = ev ? kindIn(ev.kind, ev.step) : null
        const local = ev?.local ?? 0
        const prev = view.prev
        const hiding = ev?.kind === 'hide'
        // 重開瀏覽器:前半段淡出(還是舊畫面),後半段淡入(已清空)
        const half = kind === 'restart' && local < T.restart / 2
        const st = hiding || half ? prev : view.state
        const reopen = kind === 'restart' ? Math.abs(kit.progress(local, 0, T.restart) * 2 - 1) : 1
        kit.css(browser, { opacity: reopen.toFixed(3), transform: `scale(${kit.lerp(0.96, 1, reopen).toFixed(3)})` })
        const dur = kind && ev ? ev.dur : 0

        // 網址列:打字中逐字打出;等著按 Enter 時游標閃爍
        const typing = kind === 'type'
        const shownUrl = typing ? kit.typewriter(st.url, local, { start: T.typeStart, cps: T.cps }).text : st.url
        kit.setIf(urlText, 'text', shownUrl)
        kit.setIf(placeholder, 'display', shownUrl ? 'none' : '')
        const focused = (typing && local >= T.click) || (st.phase === 'typed' && kind !== 'enter')
        kit.setIf(caret, 'opacity', focused && kit.blink(ms) ? '1' : '0')
        url.classList.toggle('on', focused || kind === 'enter')
        const press = kind === 'enter' ? Math.min(kit.progress(local, 0, 150), 1 - kit.progress(local, T.enter - 300, 300)) : 0
        kit.css(enter, { opacity: press.toFixed(3), transform: `scale(${kit.lerp(0.85, 1, press).toFixed(3)})` })

        // 分頁:載入中轉圈
        const loading = IN_FLIGHT.includes(st.phase) || (kind === 'render' && local < dur * 0.7) || (kind === 'enter' && local > 300)
        kit.setIf(spin, 'display', loading ? '' : 'none')
        if (loading) kit.setIf(spin, 'transform', `rotate(${Math.round(kit.spin(ms, 70))}deg)`)

        // 網址列下方:瀏覽器記得的 IP
        const ip = st.domain ? st.cache[st.domain] : undefined
        const ipNew = kind === 'answer' && !(prev.domain && prev.cache[prev.domain])
        const ipOp = !ip || st.phase === 'typed' || st.phase === 'idle' ? 0 : ipNew ? kit.progress(local, T.answerPop + T.answerTravel, 300) : 1
        kit.setIf(ipchip, 'text', ip ? `${st.domain} 的 IP:${ip}` : '')
        kit.setIf(ipchip, 'opacity', ipOp.toFixed(3))

        // 網頁內容區:畫的時候一塊塊出現;失敗時信寄完才換成錯誤頁
        const failing = (kind === 'answer' || kind === 'request') && st.phase === 'failed' && local < dur - 350
        const shown = kind === 'render' || !failing ? st.shown : prev.shown
        kit.setIf(page, 'html', pageHtml(shown))
        kit.setIf(tabTitle, 'text', kind === 'render' && local < dur * 0.35 ? titleOf(prev.shown) : titleOf(shown))
        const blocks = [...page.querySelectorAll<HTMLElement>('[data-k]')]
        blocks.forEach((el, i) => {
          const q = kind === 'render' ? kit.ease.outCubic(kit.progress(local, 350 + i * 380, 450)) : 1
          kit.css(el, { opacity: q.toFixed(3), transform: `translateY(${((1 - q) * 0.8).toFixed(3)}em)` })
        })
        const blank = page.querySelector<HTMLElement>('.tr-blank')
        if (blank) kit.setIf(blank, 'opacity', kind === 'render' ? '0' : '1')
        const drawOp = kind === 'render' ? Math.min(kit.progress(local, 0, 200), 1 - kit.progress(local, dur - 400, 300)) : 0
        kit.setIf(drawing, 'opacity', drawOp.toFixed(3))
        if (kind === 'render' && st.response) kit.setIf(drawing, 'text', `依收到的 ${st.response.file} 畫出畫面`)

        // DNS:收到問題時電話簿那一列亮起,回覆時跳出泡泡
        const asked = kind === 'lookup' ? kit.progress(local, T.lookup - 450, 300) : kind === 'answer' ? 1 - kit.progress(local, T.answerPop + T.answerTravel, 300) : 0
        const found = kind === 'answer' ? st.phase === 'resolved' : kind === 'lookup' ? st.domain === st.site.domain : false
        row.classList.toggle('hit', asked > 0.5 && found)
        dns.classList.toggle('miss', asked > 0.5 && !found)
        const pop = kind === 'answer' ? Math.min(kit.ease.outBack(kit.progress(local, 0, 400)), 1 - kit.progress(local, dur - 400, 300)) : 0
        kit.setIf(bubble, 'text', kind === 'answer' ? (found ? `${st.domain} → ${st.site.ip}` : `查無「${st.domain}」`) : '')
        bubble.classList.toggle('bad', !found)
        kit.css(bubble, { opacity: kit.clamp(pop).toFixed(3), transform: `translateY(-50%) scale(${kit.lerp(0.7, 1, kit.clamp(pop)).toFixed(3)})` })

        // 伺服器:開機時燈號亮著,處理請求時閃爍;回應前先找檔案
        const powerP = kind === 'power' ? kit.progress(local, 0, T.power) : 1
        const on = kind === 'power' ? (st.online ? powerP > 0.5 : powerP < 0.5) : st.online
        server.classList.toggle('off', !on)
        const busy = kind === 'respond' && local < T.respondFind + 200
        leds.forEach((el, i) => kit.setIf(el, 'opacity', !on ? '0.15' : busy ? (Math.floor(ms / 110 + i) % 2 ? '1' : '0.25') : i % 2 ? '0.55' : '1'))
        kit.setIf(status, 'text', on ? '運作中' : '關機')
        const r = st.response
        const findP = kind === 'respond' ? Math.min(kit.progress(local, 150, 250), 1 - kit.progress(local, dur - 300, 300)) : 0
        fileEls.forEach((el) => el.classList.toggle('hit', findP > 0.3 && !!r && r.status === 200 && el.dataset.file === r.file))
        kit.setIf(note, 'text', kind === 'respond' && r ? (r.status === 200 ? `找到 ${r.file}` : `沒有 ${prev.path}`) : kind === 'request' && !prev.online ? '關機中,收不到' : '')
        note.classList.toggle('bad', !!r && r.status === 404)
        const noteOp = kind === 'respond' ? findP : kind === 'request' && !prev.online ? kit.progress(local, T.downHit, 200) : 0
        kit.setIf(note, 'opacity', noteOp.toFixed(3))

        // 信:沿著線寄送;寄送中的那條線亮起
        const f = kind && ev ? flightOf(kind, local, prev, view.state) : null
        flying = !!f
        lineDns.classList.toggle('on', !!f && (kind === 'lookup' || kind === 'answer'))
        lineMain.classList.toggle('on', !!f && (kind === 'request' || kind === 'respond'))
        pathEl.classList.toggle('on', !!f && (kind === 'request' || kind === 'respond'))
        if (f) {
          kit.setIf(plabel, 'text', f.label)
          packet.dataset.tone = f.tone
          kit.css(packet, { display: '', left: `${f.at[0].toFixed(2)}%`, top: `${f.at[1].toFixed(2)}%`, opacity: f.op.toFixed(3), transform: `translate(calc(-50% + ${(f.shake * 0.5).toFixed(3)}em), -50%)` })
        } else kit.setIf(packet, 'display', 'none')
      },

      target(name) {
        switch (name) {
          case 'window': return root
          case 'browser': return browser
          case 'addressbar': return url
          case 'page': return $('.tr-view')
          case 'dns': return dns
          case 'server': return server
          case 'path': return pathEl
          case 'packet': return flying ? packet : null
        }
        return null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
