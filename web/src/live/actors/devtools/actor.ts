// 演員 devtools:瀏覽器視窗,右側(窄的時候在下方)是開發者工具,用來演出「每個網站都能看到它的背面」。
// 網頁是演員內建的示範小店(小森選物):頁首與選單、標題、一張商品卡(圖片、名稱、價格、按鈕)、頁尾。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定,只描述起始狀態):
//   url        網址列的網址(預設 https://shop.example/);第一個請求(document)的名稱取它的主機名稱
//   title      分頁標題(預設 小森選物)
//   open       一開始開發者工具就是開著的(預設 false)
//   tab        一開始的分頁:elements(預設)、console、network
//   console    一開始 Console 裡已經有的訊息:[{ "level": "log" | "warn" | "error", "text": "…", "src": "app.js:8" }]
//   requests   選用:換掉預設的請求清單(重新整理時依序出現)。每筆 { name, type, mime, size(位元組), time(毫秒), start(毫秒), status?, url? }
//              預設:shop.example(document)、style.css、app.js、mug.jpg、products(fetch,JSON)、favicon.ico
//
// 網頁上的元素(el:<id>)與 Elements 樹的行(node:<id>)用同一組 id:
//   html、head(meta、doctitle、link、script,網頁上看不到)、body、
//   header(logo、nav(navNew、navAll、cart))、main(title、card(img、name、price、buy))、footer
//   一開始展開 html、body、main、card。
//
// 動作:
//   { "open": true }            按 F12 打開開發者工具(停在目前的分頁;沒選過元素時選 body)。已經開著時報錯
//   { "open": "title" }         在網頁的元素上按右鍵 →「檢查」:打開(或已經開著)並切到 Elements,選中那一行
//   { "close": true }           按右上角的 ✕ 關掉開發者工具
//   { "tab": "network" }        切換分頁:elements、console、network(不分大小寫)
//   { "pick": true }            按左上角的選取工具(箭頭),進入選取模式;{ "pick": false } 取消
//   { "hover": "price" }        滑鼠移過去:選取模式中是滑過網頁上的元素(Elements 樹自動展開到那一行),
//                               不在選取模式時是滑過 Elements 樹的那一行(要在 Elements 分頁、那一行看得到)。
//                               兩種都會在網頁上框出元素並標出「標籤.class 寬 × 高」,對應的那一行也會亮起來。{ "hover": false } 移開
//   { "inspect": "buy" }        點選:選取模式中是點網頁上的元素(結束選取模式、切到 Elements),否則是點 Elements 樹的那一行
//   { "expand": "header" }      點 Elements 樹那一行的箭頭展開;{ "collapse": "card" } 收合(選中的行在裡面時改選它)
//   { "click": "buy" }          在網頁上點一下元素(按鈕按下去的樣子);選取模式中要用 inspect
//   { "log": "文字", "src": "app.js:12" }   網頁的 JavaScript 在 Console 留下一行訊息(src 選用,預設 app.js)
//   { "warn": "文字" }、{ "error": "文字" }  黃色警告、紅色錯誤;有錯誤時 Console 分頁上會顯示紅色的數字
//   { "clear": true }           按 Console 的清除鈕(要在 Console 分頁)
//   { "reload": true }          按重新整理:Console 清空;開發者工具開著時 Network 一筆筆記錄請求(關著時不記錄)
//   { "request": 1 }            點 Network 的第 N 列(1 起算,也可寫名稱如 "app.js"),右邊顯示細節;{ "request": false } 關掉細節
//   舞台的 show / hide 也可以順便帶一個動作。操作對不上目前的狀態時載入就報錯,並指出第幾步。
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window、page(網頁)、panel(開發者工具)、picker(選取工具)、reload(重新整理鈕)、close(✕)、menu(右鍵選單的「檢查」)、
//   tab:<分頁>、el:<id>(網頁上的元素)、node:<id>(Elements 樹的行)、styles(Elements 下方的 CSS)、
//   console(Console 分頁內容)、console:last(最後一行訊息)、clear(清除鈕)、network(Network 分頁內容)、
//   request:<N 或名稱>(Network 的列)、detail(請求細節)
import { kit } from '../../kit'
import { defineActor, type ActorEvent, type CommonStepFields, type CursorPlan, type Hotspot } from '../../types'
import './actor.css'

// ---------- 型別 ----------

type Tab = 'elements' | 'console' | 'network'
const TABS: readonly Tab[] = ['elements', 'console', 'network']
const TAB_LABEL: Record<Tab, string> = { elements: 'Elements', console: 'Console', network: 'Network' }

type Level = 'log' | 'warn' | 'error'
interface Msg {
  level: Level
  text: string
  src: string
}
interface Req {
  name: string
  url: string
  method: string
  status: number
  type: string
  mime: string
  size: number
  time: number
  start: number
}

export interface DevtoolsProps {
  url?: string
  title?: string
  open?: boolean
  tab?: string
  console?: { level?: string; text: string; src?: string }[]
  requests?: Partial<Req>[]
}

/** 只在一連串滑鼠動作之間有意義的狀態:選取模式、滑鼠停在哪裡(via:網頁上或 Elements 樹上) */
interface Temp {
  picking?: boolean
  hover?: string
  via?: 'page' | 'tree'
}
export interface DevtoolsState {
  open: boolean
  tab: Tab
  selected: string | null
  expanded: string[]
  console: Msg[]
  reqs: Req[]
  /** 開發者工具開著時重新整理過,Network 才有紀錄 */
  recorded: boolean
  /** Network 選中的列(0 起算) */
  request: number | null
  temp: Temp
}

const KINDS = ['open', 'close', 'tab', 'pick', 'hover', 'inspect', 'expand', 'collapse', 'click', 'log', 'warn', 'error', 'clear', 'reload', 'request'] as const
type DevtoolsKind = (typeof KINDS)[number]
export type DevtoolsStep = CommonStepFields & {
  open?: true | string
  close?: true
  tab?: string
  pick?: boolean
  hover?: string | false
  inspect?: string
  expand?: string
  collapse?: string
  click?: string
  log?: string
  warn?: string
  error?: string
  src?: string
  clear?: true
  reload?: true
  request?: number | string | false
}
type DevtoolsTarget =
  | 'window'
  | 'page'
  | 'panel'
  | 'picker'
  | 'reload'
  | 'close'
  | 'menu'
  | 'styles'
  | 'console'
  | 'console:last'
  | 'clear'
  | 'network'
  | 'detail'
  | `tab:${string}`
  | `el:${string}`
  | `node:${string}`
  | `request:${string}`

// ---------- 示範網頁(網頁上的元素與 Elements 樹共用) ----------

interface PNode {
  id: string
  tag: string
  attrs?: [string, string][]
  text?: string
  kids?: PNode[]
  /** 網頁上量到的大小(CSS px,顯示在框框旁邊) */
  size?: [number, number]
  /** Elements 下方顯示的 CSS */
  css?: string[]
}
const DOC: PNode = {
  id: 'html',
  tag: 'html',
  attrs: [['lang', 'zh-Hant']],
  size: [1280, 900],
  kids: [
    {
      id: 'head',
      tag: 'head',
      kids: [
        { id: 'meta', tag: 'meta', attrs: [['charset', 'utf-8']] },
        { id: 'doctitle', tag: 'title', text: '小森選物' },
        { id: 'link', tag: 'link', attrs: [['rel', 'stylesheet'], ['href', 'style.css']] },
        { id: 'script', tag: 'script', attrs: [['src', 'app.js'], ['defer', '']] },
      ],
    },
    {
      id: 'body',
      tag: 'body',
      size: [1280, 900],
      css: ['body {', 'margin: 0;', 'background: #faf7f2;', '}'],
      kids: [
        {
          id: 'header',
          tag: 'header',
          attrs: [['class', 'top']],
          size: [1280, 72],
          css: ['.top {', 'display: flex;', 'background: #2f4a3a;', '}'],
          kids: [
            { id: 'logo', tag: 'a', attrs: [['class', 'logo'], ['href', '/']], text: '小森選物', size: [112, 32] },
            {
              id: 'nav',
              tag: 'nav',
              size: [236, 24],
              kids: [
                { id: 'navNew', tag: 'a', attrs: [['href', '/new']], text: '新品', size: [40, 24] },
                { id: 'navAll', tag: 'a', attrs: [['href', '/shop']], text: '全部商品', size: [80, 24] },
                { id: 'cart', tag: 'a', attrs: [['href', '/cart']], text: '購物車', size: [60, 24] },
              ],
            },
          ],
        },
        {
          id: 'main',
          tag: 'main',
          size: [960, 560],
          css: ['main {', 'max-width: 960px;', 'margin: 0 auto;', '}'],
          kids: [
            { id: 'title', tag: 'h1', attrs: [['class', 'title']], text: '本週新品', size: [960, 48], css: ['.title {', 'font-size: 32px;', 'color: #2b2118;', '}'] },
            {
              id: 'card',
              tag: 'div',
              attrs: [['class', 'card']],
              size: [640, 280],
              css: ['.card {', 'display: grid;', 'border-radius: 12px;', '}'],
              kids: [
                { id: 'img', tag: 'img', attrs: [['class', 'photo'], ['src', 'mug.jpg'], ['alt', '手作馬克杯']], size: [240, 240], css: ['.photo {', 'width: 240px;', 'border-radius: 8px;', '}'] },
                { id: 'name', tag: 'h2', attrs: [['class', 'name']], text: '手作馬克杯', size: [352, 36], css: ['.name {', 'font-size: 24px;', '}'] },
                { id: 'price', tag: 'p', attrs: [['class', 'price']], text: 'NT$ 680', size: [352, 32], css: ['.price {', 'color: #c2410c;', 'font-weight: 700;', '}'] },
                { id: 'buy', tag: 'button', attrs: [['class', 'buy']], text: '加入購物車', size: [168, 48], css: ['.buy {', 'background: #2f4a3a;', 'color: white;', '}'] },
              ],
            },
          ],
        },
        { id: 'footer', tag: 'footer', text: '© 2026 小森選物', size: [1280, 64] },
      ],
    },
  ],
}
const VOID = new Set(['img', 'meta', 'link'])
const INITIAL_EXPANDED = ['html', 'body', 'main', 'card']

interface Info {
  node: PNode
  parent: string | null
  /** 網頁上看得到(在 body 裡) */
  page: boolean
}
const INDEX: Record<string, Info> = {}
;(function index(n: PNode, parent: string | null, page: boolean) {
  const onPage = page || n.id === 'body' || n.id === 'html'
  INDEX[n.id] = { node: n, parent, page: onPage }
  for (const k of n.kids ?? []) index(k, n.id, n.id === 'html' ? false : onPage)
})(DOC, null, false)
const IDS = Object.keys(INDEX)

const ancestors = (id: string): string[] => {
  const out: string[] = []
  for (let p = INDEX[id]?.parent; p; p = INDEX[p].parent) out.push(p)
  return out
}
const lineVisible = (id: string, expanded: readonly string[]): boolean => ancestors(id).every((a) => expanded.includes(a))
const withAncestors = (expanded: readonly string[], id: string): string[] => [...new Set([...expanded, ...ancestors(id)])]
const labelOf = (n: PNode): string => {
  const cls = n.attrs?.find(([k]) => k === 'class')?.[1]
  return cls ? `${n.tag}.${cls.split(/\s+/).join('.')}` : n.tag
}

// ---------- Elements 樹的行 ----------

const openTag = (n: PNode): string =>
  `<span class="t">&lt;${n.tag}</span>${(n.attrs ?? [])
    .map(([k, v]) => ` <span class="an">${kit.esc(k)}</span>${v ? `<span class="t">=</span><span class="av">"${kit.esc(v)}"</span>` : ''}`)
    .join('')}<span class="t">&gt;</span>`
const closeTag = (n: PNode): string => `<span class="t">&lt;/${n.tag}&gt;</span>`

interface Line {
  id: string
  depth: number
  close: boolean
  arrow: '' | 'open' | 'shut'
  html: string
}
function linesOf(expanded: readonly string[]): Line[] {
  const out: Line[] = []
  const walk = (n: PNode, d: number): void => {
    if (n.kids?.length) {
      if (expanded.includes(n.id)) {
        out.push({ id: n.id, depth: d, close: false, arrow: 'open', html: openTag(n) })
        for (const k of n.kids) walk(k, d + 1)
        out.push({ id: n.id, depth: d, close: true, arrow: '', html: closeTag(n) })
      } else out.push({ id: n.id, depth: d, close: false, arrow: 'shut', html: `${openTag(n)}<span class="dots">…</span>${closeTag(n)}` })
    } else out.push({ id: n.id, depth: d, close: false, arrow: '', html: openTag(n) + (VOID.has(n.tag) ? '' : kit.esc(n.text ?? '') + closeTag(n)) })
  }
  walk(DOC, 0)
  return out
}

// ---------- 請求 ----------

const SLOW = 2.5 // 重新整理時請求出現的速度放慢幾倍(畫面上的時間 = 真實毫秒 × SLOW),顯示的數字仍是真實毫秒
function reqsOf(props: DevtoolsProps): Req[] {
  const url = props.url || 'https://shop.example/'
  let origin: string
  let host: string
  try {
    const u = new URL(url)
    origin = u.origin
    host = u.hostname
  } catch {
    throw new Error(`devtools 的 props.url 不是有效的網址:「${url}」`)
  }
  const list: Partial<Req>[] = props.requests ?? [
    { name: host, url, type: 'document', mime: 'text/html', size: 8240, time: 120, start: 0 },
    { name: 'style.css', type: 'stylesheet', mime: 'text/css', size: 14520, time: 70, start: 150 },
    { name: 'app.js', type: 'script', mime: 'text/javascript', size: 32100, time: 110, start: 160 },
    { name: 'mug.jpg', type: 'jpeg', mime: 'image/jpeg', size: 248300, time: 420, start: 290 },
    { name: 'products', url: `${origin}/api/products`, type: 'fetch', mime: 'application/json', size: 1620, time: 180, start: 330 },
    { name: 'favicon.ico', type: 'x-icon', mime: 'image/x-icon', size: 4210, time: 40, start: 760 },
  ]
  if (!Array.isArray(list) || !list.length) throw new Error('devtools 的 props.requests 要是至少一筆的陣列')
  return list.map((r, i) => {
    if (!r || typeof r.name !== 'string' || !r.name) throw new Error(`devtools 的 props.requests 第 ${i + 1} 筆要有 name`)
    const num = (v: unknown, what: string, dflt?: number): number => {
      const x = v ?? dflt
      if (typeof x !== 'number' || !(x >= 0)) throw new Error(`devtools 的 props.requests「${r.name}」的 ${what} 要是 0 以上的數字`)
      return x
    }
    return {
      name: r.name,
      url: r.url || `${origin}/${r.name}`,
      method: r.method || 'GET',
      status: num(r.status, 'status', 200),
      type: r.type || 'other',
      mime: r.mime || 'text/plain',
      size: num(r.size, 'size'),
      time: num(r.time, 'time'),
      start: num(r.start, 'start', 0),
    }
  })
}
const endOf = (reqs: Req[]): number => Math.max(...reqs.map((r) => r.start + r.time))
const fmtSize = (n: number): string => (n < 1000 ? `${n} B` : `${(n / 1000).toFixed(1)} kB`)
const STATUS_TEXT: Record<number, string> = { 200: 'OK', 204: 'No Content', 301: 'Moved Permanently', 304: 'Not Modified', 404: 'Not Found', 500: 'Internal Server Error' }
const colorOf = (r: Req): string =>
  r.type === 'document' ? 'doc' : r.type === 'stylesheet' ? 'css' : r.type === 'script' ? 'js' : r.type === 'fetch' || r.type === 'xhr' ? 'api' : r.mime.startsWith('image/') ? 'img' : 'other'
/** 重新整理時圖片載入完才出現:找第一個非圖示的圖片請求 */
const photoReq = (reqs: Req[]): Req | undefined => reqs.find((r) => r.mime.startsWith('image/') && !r.mime.includes('icon'))
const findReq = (reqs: Req[], v: unknown): number => {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 1 && v <= reqs.length ? v - 1 : -1
  if (typeof v === 'string') return /^\d+$/.test(v) ? findReq(reqs, Number(v)) : reqs.findIndex((r) => r.name === v)
  return -1
}

// ---------- 時間表(毫秒,相對動作開始) ----------
const LEAD = 750 // 重新整理:按下之後開始載入
const T: Record<DevtoolsKind, number> = {
  open: 1000,
  close: 1300,
  tab: 1000,
  pick: 1000,
  hover: 1300,
  inspect: 1100,
  expand: 900,
  collapse: 900,
  click: 1000,
  log: 900,
  warn: 900,
  error: 900,
  clear: 1000,
  reload: 0,
  request: 1000,
}
const OPEN_MENU = 2100 // 右鍵 → 檢查
/** 畫面從 prev 換成 state 的時間點(多半是滑鼠點下去的時候) */
function cutOf(kind: DevtoolsKind, s: DevtoolsStep): number {
  switch (kind) {
    case 'open':
      return typeof s.open === 'string' ? 1500 : 250
    case 'close':
      return 1150
    case 'hover':
      return 650
    case 'log':
    case 'warn':
    case 'error':
      return 0
    case 'reload':
      return LEAD
    case 'request':
      return s.request === false ? 0 : 700
    default:
      return 700
  }
}
const kindOf = (ev: ActorEvent): DevtoolsKind | null =>
  (KINDS as readonly string[]).includes(ev.kind) ? (ev.kind as DevtoolsKind) : (KINDS.find((k) => k in ev.step) ?? null)

// ---------- 檢查(操作對不上狀態時丟錯) ----------
const mustNode = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !INDEX[v]) throw new Error(`${what}:沒有叫「${String(v)}」的元素(可用 ${IDS.join('、')})`)
  return v
}
const mustPage = (v: unknown, what: string): string => {
  const id = mustNode(v, what)
  if (!INDEX[id].page) throw new Error(`${what}:「${id}」在 <head> 裡,網頁上看不到`)
  return id
}
const mustOpen = (st: DevtoolsState, what: string): void => {
  if (!st.open) throw new Error(`${what}:開發者工具還沒打開(先用 open)`)
}
const mustTree = (st: DevtoolsState, id: string, what: string): void => {
  mustOpen(st, what)
  if (st.tab !== 'elements') throw new Error(`${what}:目前在 ${TAB_LABEL[st.tab]} 分頁,要先切到 Elements(或用 pick 從網頁上選)`)
  if (!lineVisible(id, st.expanded)) throw new Error(`${what}:「${id}」那一行被收合起來了,先 expand 它的上層`)
}
const tabOf = (v: unknown): Tab => {
  const t = typeof v === 'string' ? (v.toLowerCase() as Tab) : null
  if (!t || !TABS.includes(t)) throw new Error(`tab:沒有「${String(v)}」分頁(可用 elements、console、network)`)
  return t
}
/** 一般動作:滑鼠離開原本停的地方,選取模式保留 */
const calm = (st: DevtoolsState): Temp => (st.temp.picking ? { picking: true } : {})

const actor = defineActor<DevtoolsKind, DevtoolsStep, DevtoolsProps, DevtoolsState, DevtoolsTarget>({
  name: 'devtools',
  kinds: KINDS,
  parts: { bar: '.dt-bar', address: '.dt-addr', styles: '.dt-styles' },

  hotspots(st) {
    const out: Hotspot<DevtoolsStep>[] = []
    if (!st.open) return [{ target: 'el:title', label: '右鍵 → 檢查', step: { open: 'title' } }]
    for (const t of TABS) if (t !== st.tab) out.push({ target: `tab:${t}`, label: `切到 ${TAB_LABEL[t]}`, step: { tab: t } })
    if (st.tab === 'elements')
      for (const l of linesOf(st.expanded)) if (!l.close && l.id !== st.selected) out.push({ target: `node:${l.id}`, label: `選取 ${labelOf(INDEX[l.id].node)}`, step: { inspect: l.id } })
    if (st.tab === 'network') {
      if (!st.recorded) out.push({ target: 'reload', label: '重新整理', step: { reload: true } })
      else st.reqs.forEach((r, i) => {
          if (i !== st.request) out.push({ target: `request:${i + 1}`, label: `看 ${r.name}`, step: { request: i + 1 } })
        })
    }
    return out
  },

  init(props) {
    const tab = props.tab ? tabOf(props.tab) : 'elements'
    const msgs = (props.console ?? []).map((m, i) => {
      const level = (m?.level ?? 'log') as Level
      if (!['log', 'warn', 'error'].includes(level)) throw new Error(`devtools 的 props.console 第 ${i + 1} 筆:level 要是 log、warn 或 error`)
      if (typeof m?.text !== 'string' || !m.text) throw new Error(`devtools 的 props.console 第 ${i + 1} 筆要有 text`)
      return { level, text: m.text, src: m.src || 'app.js' }
    })
    const open = !!props.open
    return { open, tab, selected: open ? 'body' : null, expanded: INITIAL_EXPANDED, console: msgs, reqs: reqsOf(props), recorded: false, request: null, temp: {} }
  },

  // 純函式:回傳新狀態
  apply(st, kind, s) {
    const v = (s as Record<string, unknown>)[kind]
    switch (kind) {
      case 'open': {
        if (v === true) {
          if (st.open) throw new Error('open:開發者工具已經打開了')
          return { ...st, open: true, selected: st.selected ?? 'body', temp: {} }
        }
        const id = mustPage(v, 'open(右鍵 → 檢查)')
        return { ...st, open: true, tab: 'elements', selected: id, expanded: withAncestors(st.expanded, id), temp: {} }
      }
      case 'close':
        mustOpen(st, 'close')
        return { ...st, open: false, temp: {} }
      case 'tab':
        mustOpen(st, 'tab')
        return { ...st, tab: tabOf(v), temp: calm(st) }
      case 'pick':
        mustOpen(st, 'pick')
        if (v === true) {
          if (st.temp.picking) throw new Error('pick:已經在選取模式了')
          return { ...st, temp: { picking: true } }
        }
        if (v === false) {
          if (!st.temp.picking) throw new Error('pick:目前不在選取模式')
          return { ...st, temp: {} }
        }
        throw new Error('pick 要寫 true(進入選取模式)或 false(取消)')
      case 'hover': {
        if (v === false) return { ...st, temp: calm(st) }
        if (st.temp.picking) {
          const id = mustPage(v, 'hover')
          return { ...st, expanded: withAncestors(st.expanded, id), temp: { picking: true, hover: id, via: 'page' } }
        }
        const id = mustNode(v, 'hover')
        mustTree(st, id, 'hover')
        return { ...st, temp: { hover: id, via: 'tree' } }
      }
      case 'inspect': {
        if (st.temp.picking) {
          const id = mustPage(v, 'inspect')
          return { ...st, tab: 'elements', selected: id, expanded: withAncestors(st.expanded, id), temp: {} }
        }
        const id = mustNode(v, 'inspect')
        mustTree(st, id, 'inspect')
        return { ...st, selected: id, temp: {} }
      }
      case 'expand':
      case 'collapse': {
        const id = mustNode(v, kind)
        mustTree(st, id, kind)
        if (!INDEX[id].node.kids?.length) throw new Error(`${kind}:「${id}」裡面沒有其他元素,不能展開或收合`)
        const isOpen = st.expanded.includes(id)
        if (kind === 'expand') {
          if (isOpen) throw new Error(`expand:「${id}」已經展開了`)
          return { ...st, expanded: [...st.expanded, id], temp: calm(st) }
        }
        if (!isOpen) throw new Error(`collapse:「${id}」已經收合了`)
        const inside = st.selected && ancestors(st.selected).includes(id)
        return { ...st, expanded: st.expanded.filter((x) => x !== id), selected: inside ? id : st.selected, temp: calm(st) }
      }
      case 'click': {
        mustPage(v, 'click')
        if (st.temp.picking) throw new Error('click:選取模式中點網頁會選取元素,要用 inspect(或先 pick: false)')
        return { ...st, temp: {} }
      }
      case 'log':
      case 'warn':
      case 'error': {
        if (typeof v !== 'string' || !v) throw new Error(`${kind} 要寫訊息文字`)
        if (s.src !== undefined && typeof s.src !== 'string') throw new Error(`${kind} 的 src 要是字串,例如 "app.js:12"`)
        return { ...st, console: [...st.console, { level: kind, text: v, src: s.src || 'app.js' }], temp: calm(st) }
      }
      case 'clear':
        mustOpen(st, 'clear')
        if (st.tab !== 'console') throw new Error('clear:清除鈕在 Console 分頁,要先切到 Console')
        return { ...st, console: [], temp: calm(st) }
      case 'reload':
        return { ...st, console: [], recorded: st.open, request: null, temp: {} }
      case 'request': {
        if (v === false) {
          if (st.request === null) throw new Error('request:目前沒有打開請求的細節')
          return { ...st, request: null, temp: calm(st) }
        }
        mustOpen(st, 'request')
        if (st.tab !== 'network') throw new Error(`request:目前在 ${TAB_LABEL[st.tab]} 分頁,要先切到 Network`)
        if (!st.recorded) throw new Error('request:Network 還沒有紀錄,要在開發者工具開著時 reload')
        const i = findReq(st.reqs, v)
        if (i < 0) throw new Error(`request:沒有「${String(v)}」這一列(共 ${st.reqs.length} 列:${st.reqs.map((r) => r.name).join('、')})`)
        return { ...st, request: i, temp: calm(st) }
      }
    }
    throw new Error(`devtools 不會「${kind}」`)
  },

  duration(kind, step, props) {
    if (kind === 'open' && typeof step.open === 'string') return OPEN_MENU
    if (kind === 'reload') return LEAD + endOf(reqsOf(props)) * SLOW + 600
    return T[kind]
  },
  autoFocus: () => undefined,

  cursor(kind, step, prev): CursorPlan | null {
    const one = (target: string): CursorPlan => ({ moves: [{ at: 150, target }], clickAt: 700 })
    switch (kind) {
      case 'open':
        return typeof step.open === 'string' ? { moves: [{ at: 150, target: `el:${step.open}` }, { at: 900, target: 'menu' }], clickAt: 1450 } : null
      case 'close':
        return one('close')
      case 'tab':
        return one(`tab:${String(step.tab).toLowerCase()}`)
      case 'pick':
        return one('picker')
      case 'hover':
        if (step.hover === false) return null
        return one(prev?.temp.picking ? `el:${step.hover}` : `node:${step.hover}`)
      case 'inspect':
        return one(prev?.temp.picking ? `el:${step.inspect}` : `node:${step.inspect}`)
      case 'expand':
      case 'collapse':
        return one(`node:${step[kind]}`)
      case 'click':
        return one(`el:${step.click}`)
      case 'clear':
        return one('clear')
      case 'reload':
        return one('reload')
      case 'request':
        return step.request === false ? null : one(`request:${step.request}`)
    }
    return null
  },

  mount(root, props) {
    root.classList.add('A-devtools')
    const url = props.url || 'https://shop.example/'
    const title = props.title || '小森選物'
    const reqs0 = reqsOf(props)

    // 網頁:每個元素一個 .dt-e,data-el 是 id(head 裡的不畫)
    const pageHtml = (n: PNode): string => {
      if (!INDEX[n.id].page) return ''
      if (n.id === 'html') return (n.kids ?? []).map(pageHtml).join('')
      const inner = n.id === 'img' ? MUG : n.kids?.length ? n.kids.map(pageHtml).join('') : kit.esc(n.text ?? '')
      return `<div class="dt-e s-${n.id}" data-el="${n.id}">${inner}</div>`
    }
    const site = pageHtml(DOC).replace(/^<div class="dt-e s-body" data-el="body">/, '<div class="dt-site" data-el="body">')
    const menu = ['返回', '重新載入', '另存新檔…', '列印…'].map((t) => `<div class="dt-mi">${t}</div>`).join('') + `<div class="dt-msep"></div><div class="dt-mi dt-mi-inspect">檢查</div>`
    root.innerHTML =
      `<div class="dt-window">` +
      `<div class="dt-bar"><span class="light red"></span><span class="light yellow"></span><span class="light green"></span><div class="dt-btab"><i class="dt-fav"></i><span>${kit.esc(title)}</span></div></div>` +
      `<div class="dt-addr"><span class="dt-nav">←</span><span class="dt-nav">→</span><span class="dt-reload"><svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4"/></svg></span><div class="dt-url">${kit.esc(url)}</div></div>` +
      `<div class="dt-body">` +
      `<div class="dt-page">${site}<div class="dt-ov"><div class="dt-ov-box"></div><div class="dt-ov-tip"></div></div><div class="dt-menu">${menu}</div><div class="dt-key">F12</div></div>` +
      `<div class="dt-panel">` +
      `<div class="dt-ph"><span class="dt-ic dt-picker"><svg viewBox="0 0 24 24"><path d="M4 4h12v4M4 4v12h4"/><path d="M11 11l9 3.5-4 1.5-1.5 4z"/></svg></span><span class="dt-ic dt-device"><svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/></svg></span><span class="dt-sep"></span>` +
      TABS.map((t) => `<span class="dt-tab" data-tab="${t}">${TAB_LABEL[t]}<b class="dt-badge" hidden></b></span>`).join('') +
      `<span class="dt-gap"></span><span class="dt-ic dt-close">✕</span></div>` +
      `<div class="dt-pane dt-elements"><div class="dt-tree"><div class="dt-tree-in"></div></div><div class="dt-styles"></div></div>` +
      `<div class="dt-pane dt-console"><div class="dt-tool"><span class="dt-ic dt-clear"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/></svg></span><span class="dt-ctx">top ▾</span><span class="dt-filter">Filter</span></div><div class="dt-msgs"></div></div>` +
      `<div class="dt-pane dt-network"><div class="dt-tool"><span class="dt-rec"></span><span class="dt-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/></svg></span><span class="dt-chip on">All</span><span class="dt-chip">Doc</span><span class="dt-chip">CSS</span><span class="dt-chip">JS</span><span class="dt-chip">Img</span><span class="dt-chip">Fetch/XHR</span></div><div class="dt-net"></div><div class="dt-foot"></div></div>` +
      `</div></div></div>`
    const $ = (s: string) => root.querySelector<HTMLElement>(s)!
    const page = $('.dt-page')
    const siteEl = $('.dt-site')
    const ov = $('.dt-ov')
    const ovBox = $('.dt-ov-box')
    const ovTip = $('.dt-ov-tip')
    const menuEl = $('.dt-menu')
    const menuInspect = $('.dt-mi-inspect')
    const keyEl = $('.dt-key')
    const reloadIc = $('.dt-reload')
    const panel = $('.dt-panel')
    const picker = $('.dt-picker')
    const tabEls = [...root.querySelectorAll<HTMLElement>('.dt-tab')]
    const panes: Record<Tab, HTMLElement> = { elements: $('.dt-elements'), console: $('.dt-console'), network: $('.dt-network') }
    const tree = $('.dt-tree')
    const treeIn = $('.dt-tree-in')
    const styles = $('.dt-styles')
    const msgs = $('.dt-msgs')
    const net = $('.dt-net')
    const foot = $('.dt-foot')
    const pageEls = [...root.querySelectorAll<HTMLElement>('.dt-page [data-el]')]
    const elOf = (id: string): HTMLElement | null => (id === 'html' ? siteEl : (pageEls.find((e) => e.dataset.el === id) ?? null))

    return {
      render(frame, ms) {
        void ms
        const v = frame.view
        if (!v || !v.state) return
        let ev = v.ev
        let k = ev ? kindOf(ev) : null
        if (ev && !k) ev = null // show/hide 沒帶動作:畫面不變(hide 的過程中舞台給的仍是退場前的狀態)
        const local = ev ? ev.local : Infinity
        const step = (ev?.step ?? {}) as DevtoolsStep
        const sh = ev && k && local < cutOf(k, step) ? v.prev : v.state

        // 開發者工具的寬度(打開、關掉時滑進滑出)
        let f = sh.open ? 1 : 0
        if (k === 'open' && !v.prev.open) f = kit.ease.inOutCubic(kit.progress(local, cutOf('open', step), 450))
        if (k === 'close') f = 1 - kit.ease.inOutCubic(kit.progress(local, 700, 450))
        kit.css(panel, { flexBasis: `${(f * 44).toFixed(2)}%`, display: f > 0 ? 'flex' : 'none' })

        // ---- 分頁列 ----
        const errors = sh.console.filter((m) => m.level === 'error').length
        for (const t of tabEls) {
          t.classList.toggle('on', t.dataset.tab === sh.tab)
          const b = t.querySelector<HTMLElement>('.dt-badge')!
          const n = t.dataset.tab === 'console' ? errors : 0
          b.hidden = !n
          kit.setIf(b, 'text', String(n))
        }
        picker.classList.toggle('on', !!sh.temp.picking)
        for (const t of TABS) panes[t].hidden = t !== sh.tab
        kit.css(panes[sh.tab], { opacity: k === 'tab' ? kit.progress(local, 700, 160).toFixed(3) : '1' })

        // ---- Elements ----
        const hover = sh.temp.hover ?? null
        const lines = linesOf(sh.expanded)
        kit.setIf(
          treeIn,
          'html',
          `<div class="dt-ln dt-doctype">&lt;!DOCTYPE html&gt;</div>` +
            lines
              .map((l) => {
                const sel = !l.close && l.id === sh.selected
                const hov = !l.close && l.id === hover
                return `<div class="dt-ln${sel ? ' sel' : ''}${hov ? ' hov' : ''}" data-id="${l.id}"${l.close ? ' data-close' : ''} style="padding-left: ${(l.depth * 1.15 + 0.4).toFixed(2)}em"><span class="dt-arrow ${l.arrow}"></span>${l.html}${sel ? '<span class="dt-eq"> == $0</span>' : ''}</div>`
              })
              .join(''),
        )
        // 選中(或滑鼠停著)的那一行保持在看得到的地方
        const focusLine = treeIn.querySelector<HTMLElement>('.dt-ln.hov') || treeIn.querySelector<HTMLElement>('.dt-ln.sel')
        let off = 0
        if (focusLine && tree.clientHeight) {
          const lh = focusLine.offsetHeight
          const over = focusLine.offsetTop + lh * 2 - tree.clientHeight
          if (over > 0) off = over
        }
        kit.css(treeIn, { transform: `translateY(${(-off).toFixed(1)}px)` })
        const selNode = sh.selected ? INDEX[sh.selected].node : null
        const cssLines = selNode?.css ?? []
        kit.setIf(
          styles,
          'html',
          `<div class="dt-sty-h">Styles</div><div class="dt-sty"><div><span class="sel">element.style</span> {</div><div>}</div>` +
            cssLines
              .map((c) => {
                if (c.endsWith('{')) return `<div><span class="sel">${kit.esc(c.slice(0, -1).trim())}</span> {</div>`
                if (c === '}') return '<div>}</div>'
                const [p, ...rest] = c.split(':')
                return `<div class="dt-decl"><span class="pn">${kit.esc(p)}</span>: <span class="pv">${kit.esc(rest.join(':').trim())}</span></div>`
              })
              .join('') +
            `</div>`,
        )

        // ---- Console ----
        const icon: Record<Level, string> = { log: '', warn: '⚠', error: '✖' }
        kit.setIf(
          msgs,
          'html',
          sh.console.map((m) => `<div class="dt-msg ${m.level}"><span class="dt-mico">${icon[m.level]}</span><span class="dt-mtext">${kit.esc(m.text)}</span><span class="dt-msrc">${kit.esc(m.src)}</span></div>`).join('') +
            `<div class="dt-prompt"><span>›</span><i class="dt-caret"></i></div>`,
        )
        const newMsg = k === 'log' || k === 'warn' || k === 'error'
        const lastMsg = msgs.querySelectorAll<HTMLElement>('.dt-msg')
        lastMsg.forEach((m, i) => kit.css(m, { opacity: newMsg && i === lastMsg.length - 1 ? kit.progress(local, 0, 300).toFixed(3) : '1' }))

        // ---- Network ----
        const reloading = k === 'reload' && local >= LEAD
        const elapsed = reloading ? (local - LEAD) / SLOW : Infinity
        if (!sh.recorded) {
          kit.setIf(net, 'html', `<div class="dt-hint">正在記錄網路活動…<br>重新整理網頁（Ctrl + R）就會看到請求</div>`)
          kit.setIf(foot, 'text', '')
          panes.network.classList.remove('detail')
        } else {
          const total = endOf(sh.reqs) * 1.08
          const shown = sh.reqs.map((r, i) => ({ r, i })).filter(({ r }) => r.start <= elapsed)
          const detail = sh.request !== null && !reloading ? sh.reqs[sh.request] : null
          panes.network.classList.toggle('detail', !!detail)
          const head = `<div class="dt-tr dt-th"><span>Name</span><span>Status</span><span>Type</span><span>Size</span><span>Time</span><span>Waterfall</span></div>`
          const rows = shown
            .map(({ r, i }) => {
              const done = elapsed >= r.start + r.time
              const w = Math.min(1, (elapsed - r.start) / Math.max(1, r.time)) * (r.time / total)
              return (
                `<div class="dt-tr${i === sh.request && detail ? ' sel' : ''}" data-n="${i + 1}" data-name="${kit.esc(r.name)}">` +
                `<span class="dt-name"><i class="dt-ri ${colorOf(r)}"></i>${kit.esc(r.name)}</span>` +
                `<span class="${done ? (r.status >= 400 ? 'bad' : '') : 'dim'}">${done ? r.status : '(pending)'}</span><span>${kit.esc(r.type)}</span>` +
                `<span>${done ? fmtSize(r.size) : ''}</span><span>${done ? `${r.time} ms` : ''}</span>` +
                `<span class="dt-wf"><i class="${colorOf(r)}" style="left: ${((r.start / total) * 100).toFixed(2)}%; width: ${(Math.max(0.004, w) * 100).toFixed(2)}%"></i></span></div>`
              )
            })
            .join('')
          const box = detail
            ? `<div class="dt-detail"><div class="dt-dh"><span class="dt-ic">✕</span><span class="on">Headers</span><span>Preview</span><span>Response</span><span>Timing</span></div>` +
              `<div class="dt-dsec">General</div>` +
              `<div class="dt-kv"><b>Request URL</b><span>${kit.esc(detail.url)}</span></div>` +
              `<div class="dt-kv"><b>Request Method</b><span>${kit.esc(detail.method)}</span></div>` +
              `<div class="dt-kv"><b>Status Code</b><span><i class="dt-dot${detail.status >= 400 ? ' bad' : ''}"></i>${detail.status} ${STATUS_TEXT[detail.status] ?? ''}</span></div>` +
              `<div class="dt-dsec">Response Headers</div>` +
              `<div class="dt-kv"><b>content-type</b><span>${kit.esc(detail.mime)}</span></div>` +
              `<div class="dt-kv"><b>content-length</b><span>${detail.size}</span></div></div>`
            : ''
          kit.setIf(net, 'html', `<div class="dt-table">${head}<div class="dt-rows">${rows}</div></div>${box}`)
          const doneReqs = shown.filter(({ r }) => elapsed >= r.start + r.time).map(({ r }) => r)
          const kb = doneReqs.reduce((a, r) => a + r.size, 0)
          kit.setIf(foot, 'text', `${doneReqs.length} requests | ${fmtSize(kb)} transferred${doneReqs.length ? ` | Finish: ${Math.max(...doneReqs.map((r) => r.start + r.time))} ms` : ''}`)
          const d = net.querySelector<HTMLElement>('.dt-detail')
          if (d) kit.css(d, { opacity: k === 'request' ? kit.progress(local, 700, 180).toFixed(3) : '1' })
        }

        // ---- 網頁:重新整理、按鈕按下 ----
        let siteOp = 1
        let photoOp = 1
        let spin = 0
        if (reloading) {
          // 網頁在 HTML 文件(document)載完時出現;自訂的請求清單沒有 document 時用第一筆
          const doc = sh.reqs.find((r) => r.type === 'document') ?? sh.reqs[0]
          siteOp = kit.progress(local, LEAD + (doc.start + doc.time) * SLOW, 220)
          const ph = photoReq(sh.reqs)
          if (ph) photoOp = kit.progress(local, LEAD + (ph.start + ph.time) * SLOW, 250)
          spin = kit.progress(local, LEAD, endOf(reqs0) * SLOW)
        } else if (k === 'reload') siteOp = 1 - kit.progress(local, 600, 150)
        kit.css(siteEl, { opacity: siteOp.toFixed(3) })
        const photo = elOf('img')
        if (photo) kit.css(photo, { opacity: photoOp.toFixed(3) })
        kit.css(reloadIc, { transform: `rotate(${(spin * 360).toFixed(1)}deg)` })
        for (const e of pageEls) {
          const pressed = k === 'click' && e.dataset.el === step.click ? Math.sin(Math.PI * kit.progress(local, 650, 250)) : 0
          kit.css(e, { transform: pressed > 0 ? `scale(${(1 - pressed * 0.05).toFixed(3)})` : '', filter: pressed > 0 ? `brightness(${(1 - pressed * 0.15).toFixed(3)})` : '' })
        }

        // ---- 框出元素(滑鼠停著的,或在 Elements 分頁選中的) ----
        let ovId: string | null = null
        let ovOp = 0
        if (hover && INDEX[hover].page && (sh.temp.via === 'page' || (sh.open && sh.tab === 'elements'))) {
          ovId = hover
          ovOp = k === 'hover' ? kit.progress(local, 650, 150) : 1
        } else if (sh.open && sh.tab === 'elements' && f >= 1 && sh.selected && INDEX[sh.selected].page && sh.selected !== 'body' && sh.selected !== 'html') {
          ovId = sh.selected
          ovOp = k === 'inspect' || k === 'open' ? kit.progress(local, cutOf(k, step), 150) : 1
        }
        const target = ovId ? elOf(ovId) : null
        if (target && ovOp > 0 && page.clientWidth) {
          const r = kit.rectIn(target, page)
          const n = INDEX[ovId!].node
          ov.hidden = false
          kit.css(ov, { opacity: ovOp.toFixed(3) })
          kit.css(ovBox, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` })
          kit.setIf(ovTip, 'html', `<b>${kit.esc(labelOf(n))}</b> <span>${n.size ? `${n.size[0]} × ${n.size[1]}` : ''}</span>`)
          const below = r.y + r.h + 8 + ovTip.offsetHeight <= page.clientHeight
          const top = below ? r.y + r.h + 8 : Math.max(4, r.y - ovTip.offsetHeight - 8)
          kit.css(ovTip, { left: `${kit.clamp(r.x, 4, Math.max(4, page.clientWidth - ovTip.offsetWidth - 4))}px`, top: `${top}px` })
        } else ov.hidden = true

        // ---- 右鍵選單(open: 元素) ----
        if (k === 'open' && typeof step.open === 'string') {
          const el = elOf(step.open)
          if (el && page.clientWidth) {
            const r = kit.rectIn(el, page)
            const x = kit.clamp(r.x + r.w * 0.55, 4, Math.max(4, page.clientWidth - menuEl.offsetWidth - 4))
            const y = kit.clamp(r.y + r.h * 0.6, 4, Math.max(4, page.clientHeight - menuEl.offsetHeight - 4))
            kit.css(menuEl, { left: `${x.toFixed(1)}px`, top: `${y.toFixed(1)}px` })
          }
          kit.css(menuEl, { opacity: Math.min(kit.progress(local, 700, 120), 1 - kit.progress(local, 1450, 100)).toFixed(3) })
          menuInspect.classList.toggle('on', local >= 1300)
        } else kit.css(menuEl, { opacity: '0' })
        kit.css(keyEl, { opacity: k === 'open' && step.open === true ? Math.sin(Math.PI * kit.progress(local, 0, 800)).toFixed(3) : '0' })
      },

      target(name) {
        switch (name) {
          case 'window':
            return $('.dt-window')
          case 'page':
            return page
          case 'panel':
            return panel
          case 'picker':
            return picker
          case 'reload':
            return reloadIc
          case 'close':
            return $('.dt-close')
          case 'menu':
            return menuInspect
          case 'styles':
            return styles
          case 'console':
            return panes.console
          case 'console:last':
            return [...msgs.querySelectorAll<HTMLElement>('.dt-msg')].at(-1) ?? null
          case 'clear':
            return $('.dt-clear')
          case 'network':
            return panes.network
          case 'detail':
            return net.querySelector<HTMLElement>('.dt-detail')
        }
        const m = /^(tab|el|node|request):(.+)$/s.exec(name)
        if (!m) return null
        const [, kind, key] = m
        if (kind === 'tab') return tabEls.find((t) => t.dataset.tab === key.toLowerCase()) ?? null
        if (kind === 'el') return INDEX[key]?.page ? elOf(key) : null
        if (kind === 'node') return [...treeIn.querySelectorAll<HTMLElement>('.dt-ln[data-id]')].find((l) => l.dataset.id === key && !l.hasAttribute('data-close')) ?? null
        const rows = [...net.querySelectorAll<HTMLElement>('.dt-tr[data-n]')]
        return rows.find((r) => r.dataset.n === key || r.dataset.name === key) ?? null
      },
    }
  },
})

/** 商品圖片(馬克杯插畫,代替真的圖片檔) */
const MUG = `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="48" cy="84" rx="30" ry="5" fill="#d9c9b3"/><path d="M24 30h48v38a14 14 0 0 1-14 14H38a14 14 0 0 1-14-14z" fill="#f4efe6" stroke="#8a6f52" stroke-width="3"/><path d="M72 40h6a9 9 0 0 1 0 18h-6" fill="none" stroke="#8a6f52" stroke-width="3"/><path d="M30 46h36" stroke="#6f9a7e" stroke-width="5"/><path d="M38 18c-3 4 3 6 0 10M50 16c-3 4 3 6 0 10M62 18c-3 4 3 6 0 10" fill="none" stroke="#b9a58d" stroke-width="2.5" stroke-linecap="round"/></svg>`

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
