// 演員 browser:仿瀏覽器視窗,顯示「AI 做出來的網頁」,可以切換手機/平板/桌面寬度、捲動、點擊。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// 網頁來自 src/content/live/l0/site/<版本>/(index.html、styles.css、可選 script.js),放在 Shadow DOM 裡(樣式不會漏出去)。
// 寬度由腳本指定:載入 CSS 時,每段 @media 的寬度條件(min-width、max-width)用「目前的畫面寬度」自己判斷,
// 符合才套用,所以不依賴真的瀏覽器視窗,結果只由時間決定(可拖曳、倒轉、逐格重現)。
// 頁面的捲動位置、點擊後的展開狀態也由本演員依時間設定;script.js 會真的執行(以 Shadow DOM 當作它的 document)。
//
// props(登場設定,只描述起始狀態):
//   site    一開始顯示的版本(預設第一個版本,依名稱排序)
//   width   phone | tablet | desktop(預設 desktop;實際寬度 390 / 768 / 1280)
//   url     網址列顯示的文字(預設 file:///Documents/practice/bakery/index.html;不要用真實使用者路徑)
//
// 動作:
//   { "site": "v3" }                      切換到另一個版本(從頁首開始)
//   { "width": "phone" }                  把視窗縮放成手機/平板/桌面寬度(平滑過渡)
//   { "scroll": "faq" }                   平滑捲到某個區塊(id),也可寫 "top"、"bottom" 或像素數字
//   { "go": "faq" }                       (滑鼠)點導覽裡指向 #faq 的連結,接著平滑捲到那個區塊
//   { "click": "summary" }                (滑鼠)點頁面裡的一個元素(CSS 選擇器,取第一個符合的),例如 "summary"、"#menu"、".menu-btn"
//   { "reload": true }                    重新整理:畫面閃一下,頁面回到剛載入的狀態(點擊造成的展開/收合還原)
//   操作對不上(版本不存在、寬度名稱錯誤…)時載入就報錯,並指出第幾步。
//
// 目標(腳本裡寫成「演員代號:目標」):
//   window、tab、addressbar、content(整個內容區)、viewport(網頁畫面本身)、
//   section:<id>(網頁裡某個 id 的元素)、sel:<css>(網頁裡符合選擇器的第一個元素)
import { kit } from '../../kit'
import { defineActor, type ActorEvent, type CommonStepFields, type CursorPlan } from '../../types'
import './actor.css'

// ---------- 網頁素材 ----------

const RAW = import.meta.glob('../../../content/live/l0/site/*/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

interface SiteFiles {
  html: string
  css: string
  js: string
}
const SITES: Record<string, SiteFiles> = {}
for (const [path, text] of Object.entries(RAW)) {
  const m = /\/site\/([^/]+)\/([^/]+)$/.exec(path)
  if (!m) continue
  const site = (SITES[m[1]] ??= { html: '', css: '', js: '' })
  if (m[2] === 'index.html') site.html = text
  else if (m[2] === 'styles.css') site.css = text
  else if (m[2] === 'script.js') site.js = text
}
const SITE_IDS = Object.keys(SITES).filter((id) => SITES[id].html).sort()

/** CSS 的一段:query 為 null 是一般規則;否則是 @media 裡的內容,依畫面寬度決定要不要套用 */
interface CssPart {
  min: number
  max: number
  css: string
}
interface Prepared {
  title: string
  body: string
  parts: CssPart[]
  js: string
}

// 頁面裡的 html、body、:root 在 Shadow DOM 裡不存在,換成我們放的外框元素;
// h1 換成一般元素([data-h1]):這只是示範畫面,不該讓課程頁多出第二個 h1(搜尋引擎與輔助技術看得到 Shadow DOM 的內容)
const rootSel = (css: string): string =>
  css
    .replace(/:root\b/g, '.bw-doc')
    .replace(/(^|[}\s,>+~])(html|body|h1)(?=[\s,{.:#[>+~])/g, (_m, pre: string, tag: string) => `${pre}${tag === 'html' ? '.bw-doc' : tag === 'body' ? '.bw-body' : '[data-h1]'}`)
const demoteH1 = (html: string): string => html.replace(/<h1(?=[\s>])/gi, '<div data-h1').replace(/<\/h1>/gi, '</div>')

/** 解析 @media 的寬度條件:只支援 (min-width: Npx)、(max-width: Npx),用 and 連接 */
function widthRange(query: string, site: string): { min: number; max: number } {
  let min = 0
  let max = Infinity
  for (const part of query.split(/\band\b/)) {
    const m = /^\s*\(\s*(min|max)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)\s*$/.exec(part)
    if (!m) throw new Error(`browser:版本「${site}」的 CSS 用了不支援的媒體條件「@media ${query.trim()}」(只支援 min-width、max-width 的 px 值)`)
    if (m[1] === 'min') min = Math.max(min, Number(m[2]))
    else max = Math.min(max, Number(m[2]))
  }
  return { min, max }
}

function splitCss(css: string, site: string): CssPart[] {
  const parts: CssPart[] = []
  const re = /@media\s*([^{]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g
  let last = 0
  for (let m = re.exec(css); m; m = re.exec(css)) {
    if (m.index > last) parts.push({ min: 0, max: Infinity, css: rootSel(css.slice(last, m.index)) })
    parts.push({ ...widthRange(m[1], site), css: rootSel(m[2]) })
    last = m.index + m[0].length
  }
  if (last < css.length) parts.push({ min: 0, max: Infinity, css: rootSel(css.slice(last)) })
  return parts
}

const prepared = new Map<string, Prepared>()
function prepare(id: string): Prepared {
  let p = prepared.get(id)
  if (p) return p
  const f = SITES[id]
  const doc = new DOMParser().parseFromString(f.html, 'text/html')
  doc.querySelectorAll('link[rel="stylesheet"], script, style').forEach((n) => n.remove())
  p = { title: doc.title, body: demoteH1(doc.body.innerHTML), parts: splitCss(f.css, id), js: f.js }
  prepared.set(id, p)
  return p
}

// 頁面自己的動畫與過場是即時發生的,不是時間的函式,一律關掉
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important}'
const cssAt = (p: Prepared, width: number): string => p.parts.filter((x) => width >= x.min && width <= x.max).map((x) => x.css).join('\n') + FREEZE

// ---------- 型別 ----------

export type BrowserWidth = 'phone' | 'tablet' | 'desktop'
export interface BrowserProps {
  site?: string
  width?: BrowserWidth
  url?: string
}
/** 滑到哪裡:區塊 id、"top"、"bottom" 或像素 */
type ScrollSpec = string | number

export interface BrowserState {
  site: string
  width: BrowserWidth
  scroll: ScrollSpec
  /** 這一次載入之後點過的元素(選擇器),照順序重播 */
  clicks: string[]
  /** 重新整理的次數(改變就重新載入頁面) */
  loads: number
}

const KINDS = ['site', 'width', 'scroll', 'go', 'click', 'reload'] as const
type BrowserKind = (typeof KINDS)[number]
export type BrowserStep = CommonStepFields &
  (
    | { site: string }
    | { width: BrowserWidth }
    | { scroll: ScrollSpec }
    | { go: string }
    | { click: string }
    | { reload: true }
  )
type StepOf<K extends BrowserKind> = Extract<BrowserStep, Record<K, unknown>>

type BrowserTarget = 'window' | 'tab' | 'addressbar' | 'content' | 'viewport' | `section:${string}` | `sel:${string}`

const DIMS: Record<BrowserWidth, { w: number; h: number }> = {
  phone: { w: 390, h: 780 },
  tablet: { w: 768, h: 1024 },
  desktop: { w: 1280, h: 800 },
}

// ---------- 時間表(毫秒,相對動作開始) ----------
const T = {
  site: 600,
  width: 1200,
  scroll: 1200,
  go: 2100,
  click: 1300,
  reload: 1000,
  clickAt: 800, // 滑鼠 150 出發、800 到達並點下
  goScroll: 800, // go:點下去之後才開始捲
  goScrollMs: 1100,
  reloadSwap: 350, // reload:畫面蓋白時才還原頁面
} as const
const kindOf = (ev: ActorEvent): BrowserKind | null =>
  (KINDS as readonly string[]).includes(ev.kind) ? (ev.kind as BrowserKind) : (KINDS.find((k) => k in ev.step) ?? null)

const isWidth = (v: unknown): v is BrowserWidth => v === 'phone' || v === 'tablet' || v === 'desktop'

const actor = defineActor<BrowserKind, BrowserStep, BrowserProps, BrowserState, BrowserTarget>({
  name: 'browser',
  kinds: KINDS,
  parts: { bar: '.bw-bar', lights: '.light', tab: '.bw-tab', url: '.bw-url' },

  hotspots() {
    return [{ target: 'tab', label: '重新整理', step: { reload: true } }]
  },

  init(props) {
    if (!SITE_IDS.length) throw new Error('browser:找不到網頁素材(src/content/live/l0/site/<版本>/index.html)')
    const site = props.site ?? SITE_IDS[0]
    if (!SITES[site]?.html) throw new Error(`browser 的 props.site:找不到版本「${site}」(有:${SITE_IDS.join('、')})`)
    const width = props.width ?? 'desktop'
    if (!isWidth(width)) throw new Error(`browser 的 props.width 要是 phone、tablet 或 desktop`)
    return { site, width, scroll: 'top', clicks: [], loads: 0 }
  },

  apply(st, kind, s) {
    const v = (s as Record<BrowserKind, unknown>)[kind]
    switch (kind) {
      case 'site': {
        if (typeof v !== 'string' || !SITES[v]?.html) throw new Error(`site:找不到版本「${String(v)}」(有:${SITE_IDS.join('、')})`)
        return { ...st, site: v, scroll: 'top', clicks: [], loads: st.loads + 1 }
      }
      case 'width': {
        if (!isWidth(v)) throw new Error(`width 要是 phone、tablet 或 desktop(收到「${String(v)}」)`)
        return { ...st, width: v }
      }
      case 'scroll': {
        if (typeof v !== 'string' && typeof v !== 'number') throw new Error('scroll 要給區塊 id、"top"、"bottom" 或像素數字')
        return { ...st, scroll: v }
      }
      case 'go': {
        if (typeof v !== 'string' || !v) throw new Error('go 要給區塊 id(導覽裡要有指向它的連結)')
        return { ...st, scroll: v }
      }
      case 'click': {
        if (typeof v !== 'string' || !v.trim()) throw new Error('click 要給 CSS 選擇器')
        return { ...st, clicks: [...st.clicks, v] }
      }
      case 'reload':
        return { ...st, clicks: [], loads: st.loads + 1 }
    }
    throw new Error(`browser 不會「${kind}」`)
  },

  duration(kind) {
    return T[kind]
  },

  autoFocus(kind, step): BrowserTarget {
    if (kind === 'click') return `sel:${(step as StepOf<'click'>).click}` // 鏡頭看被點的那個元素
    return kind === 'site' || kind === 'width' || kind === 'reload' ? 'content' : 'viewport'
  },

  cursor(kind, step): CursorPlan | null {
    if (kind === 'click') return { moves: [{ at: 150, target: `sel:${(step as StepOf<'click'>).click}` }], clickAt: T.clickAt }
    if (kind === 'go') return { moves: [{ at: 150, target: `sel:a[href="#${(step as StepOf<'go'>).go}"]` }], clickAt: T.clickAt }
    return null
  },

  mount(root, props) {
    root.classList.add('A-browser')
    root.innerHTML = `<div class="bw-window"><div class="bw-bar"><span class="light red"></span><span class="light yellow"></span><span class="light green"></span><div class="bw-tab"><span class="bw-tab-title"></span></div><div class="bw-url"></div></div><div class="bw-view"><div class="bw-frame"></div><div class="bw-flash"></div><div class="bw-proxies"></div></div></div>`
    const $ = <E extends HTMLElement>(s: string): E => root.querySelector<E>(s)!
    const win = $('.bw-window')
    const tab = $('.bw-tab')
    const tabTitle = $('.bw-tab-title')
    const url = $('.bw-url')
    const view = $('.bw-view')
    const frame = $('.bw-frame')
    const flash = $('.bw-flash')
    const proxies = $('.bw-proxies')
    let scaleNow = 1 // 目前網頁畫面相對實際尺寸的縮放(render 時更新,替身換算位置用)
    kit.setIf(url, 'text', props.url ?? 'file:///Documents/practice/bakery/index.html')

    // 網頁放在 frame 的 Shadow DOM 裡:一個 <style>(依寬度算出)加上一個 .bw-doc(捲動的容器)
    frame.setAttribute('aria-hidden', 'true') // 示範畫面:對輔助技術來說只是裝飾,旁白與字幕已經說明內容
    const shadow = frame.attachShadow({ mode: 'open' })
    shadow.innerHTML = `<style class="bw-base">.bw-doc{position:absolute;inset:0;overflow-anchor:none;overflow-x:hidden;overflow-y:auto;background:#fff}.bw-body{min-height:100%}</style><style class="bw-site"></style><div class="bw-doc"><div class="bw-body"></div></div>`
    const siteStyle = shadow.querySelector<HTMLStyleElement>('.bw-site')!
    const doc = shadow.querySelector<HTMLElement>('.bw-doc')!
    const body = shadow.querySelector<HTMLElement>('.bw-body')!

    // 目前頁面上載入的是哪個版本、第幾次載入、已經重播了幾次點擊
    const page = { site: '', loads: -1, applied: 0 }
    function load(id: string, loads: number): void {
      const p = prepare(id)
      body.innerHTML = p.body
      doc.scrollTop = 0
      page.site = id
      page.loads = loads
      page.applied = 0
      if (p.js) {
        // script.js 以 Shadow DOM 當作 document 執行(getElementById、querySelector 都有),事件監聽留在這份新建的元素上
        try {
          new Function('document', p.js)(shadow)
        } catch (e) {
          console.warn(`browser:版本「${id}」的 script.js 執行失敗`, e)
        }
      }
    }

    /** 這個捲動規格在目前版面下是幾像素(用 offsetTop 累加,不受外框縮放影響) */
    function pxOf(spec: ScrollSpec): number {
      if (typeof spec === 'number') return spec
      if (spec === 'top') return 0
      if (spec === 'bottom') return doc.scrollHeight
      const el = shadow.getElementById(spec)
      if (!el) return 0
      let y = 0
      for (let n: HTMLElement | null = el; n && n !== doc; n = n.offsetParent as HTMLElement | null) y += n.offsetTop
      return y - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0)
    }

    return {
      render(frameData, ms) {
        void ms
        const v = frameData.view
        if (!v || !v.state) return
        let { state } = v
        const { prev, ev } = v
        const k = ev ? kindOf(ev) : null
        // show/hide 沒帶動作:畫面不變;hide 時舞台清掉了狀態,退場過程中仍畫退場前的樣子
        if (ev && !k && ev.kind === 'hide') state = prev
        const local = ev && k ? ev.local : Infinity

        // 重新整理:蓋白時才還原頁面;點擊:在滑鼠點下去的那一刻才生效
        let eff = state
        if (k === 'reload' && local < T.reloadSwap) eff = prev
        if (k === 'click' && local < T.clickAt) eff = prev

        // 寬度(過渡中依進度在前後兩個尺寸之間插值)
        const wp = k === 'width' ? kit.ease.inOutCubic(kit.progress(local, 0, T.width)) : 1
        const from = DIMS[k === 'width' ? prev.width : state.width]
        const to = DIMS[state.width]
        const lw = kit.lerp(from.w, to.w, wp)
        const lh = kit.lerp(from.h, to.h, wp)
        const vw = view.clientWidth
        const vh = view.clientHeight
        const scale = vw && vh ? Math.min((vw - 16) / lw, (vh - 16) / lh) : 1
        scaleNow = scale
        kit.css(frame, {
          width: `${lw.toFixed(1)}px`,
          height: `${lh.toFixed(1)}px`,
          left: `${((vw - lw * scale) / 2).toFixed(1)}px`,
          top: `${((vh - lh * scale) / 2).toFixed(1)}px`,
          transform: `scale(${scale.toFixed(4)})`,
          opacity: k === 'site' ? kit.lerp(0.15, 1, kit.progress(local, 0, 250)).toFixed(3) : '1',
        })
        const fl = k === 'reload' ? Math.sin(Math.PI * kit.progress(local, 0, T.reload)) : 0
        kit.css(flash, { opacity: (fl * 0.9).toFixed(3) })

        // 頁面:版本或載入次數變了、或點擊比應有的多(倒轉)就重新載入(同步完成,不會閃空白)
        const nClicks = eff.clicks.length
        if (page.site !== eff.site || page.loads !== eff.loads || page.applied > nClicks) load(eff.site, eff.loads)
        kit.setIf(siteStyle, 'text', cssAt(prepare(eff.site), lw))
        kit.setIf(tabTitle, 'text', prepare(eff.site).title || '小森烘焙')

        // 重播還沒做的點擊(summary 會展開、按鈕會執行頁面的程式)
        for (; page.applied < nClicks; page.applied++) {
          const sel = eff.clicks[page.applied]
          const el = shadow.querySelector<HTMLElement>(sel)
          if (el) el.click()
          else console.warn(`browser:頁面「${page.site}」裡找不到「${sel}」,這次點擊略過`)
        }

        // 捲動:scroll、go 依進度在前後兩個位置之間插值,其他時候停在目前位置
        let y = pxOf(state.scroll)
        if (k === 'scroll' || k === 'go') {
          const start = k === 'go' ? T.goScroll : 0
          const span = k === 'go' ? T.goScrollMs : T.scroll
          y = kit.lerp(pxOf(prev.scroll), y, kit.ease.inOutCubic(kit.progress(local, start, span)))
        }
        if (Math.abs(doc.scrollTop - y) > 0.5) doc.scrollTop = y
      },

      target(name) {
        if (name === 'window') return win
        if (name === 'tab') return tab
        if (name === 'addressbar') return url
        if (name === 'content') return view
        if (name === 'viewport') return frame
        const m = /^(section|sel):(.+)$/s.exec(name)
        if (!m) return null
        let el: HTMLElement | null = null
        try {
          el = m[1] === 'section' ? shadow.getElementById(m[2]) : shadow.querySelector<HTMLElement>(m[2])
        } catch {
          return null // 選擇器不合法
        }
        if (!el) return null
        // 舞台量位置是用 offsetLeft/offsetTop 累加(不受縮放、捲動、Shadow DOM 影響),網頁裡的元素量不到正確位置。
        // 所以在內容區放一個看不見的替身:位置與大小依元素「目前實際位置」換算成內容區座標(未縮放),鏡頭、聚光燈、滑鼠才對得準。
        const fr = frame.getBoundingClientRect()
        if (!frame.offsetWidth || !fr.width) return null
        const k = fr.width / frame.offsetWidth // 網頁畫面目前的總縮放(含鏡頭)
        const r = el.getBoundingClientRect()
        // 換成網頁畫面內的座標,並夾在畫面範圍內(超出畫面的部分看不到)
        const x0 = Math.max(0, (r.left - fr.left) / k)
        const y0 = Math.max(0, (r.top - fr.top) / k)
        const x1 = Math.min(frame.offsetWidth, (r.right - fr.left) / k)
        const y1 = Math.min(frame.offsetHeight, (r.bottom - fr.top) / k)
        if (x1 <= x0 || y1 <= y0) return null // 完全在畫面外
        let proxy = [...proxies.children].find((c) => (c as HTMLElement).dataset.name === name) as HTMLElement | undefined
        if (!proxy) {
          proxy = document.createElement('div')
          proxy.className = 'bw-proxy'
          proxy.dataset.name = name
          proxies.appendChild(proxy)
        }
        kit.css(proxy, {
          left: `${(frame.offsetLeft + x0 * scaleNow).toFixed(1)}px`,
          top: `${(frame.offsetTop + y0 * scaleNow).toFixed(1)}px`,
          width: `${((x1 - x0) * scaleNow).toFixed(1)}px`,
          height: `${((y1 - y0) * scaleNow).toFixed(1)}px`,
        })
        return proxy
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入:舞台、外殼、演員是掛上去就一直在跑的物件,不是 React 元件,
// 交給 LivePlayer 熱更新的話它的 effect 不會重跑,畫面仍是舊程式建出來的舊物件,看起來像沒有熱重載。
// 必須直接寫 import.meta.hot.accept(Vite 靠這段文字判斷模組會自己處理更新,包成函式它就認不得)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
