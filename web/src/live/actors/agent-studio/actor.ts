// 演員 agent-studio:虛擬的 AI Agent 軟體開發介面(模擬,不接真的 AI):左邊跟 Agent 對話,右邊是做出來的網頁預覽,
// 上面是工具列(復原、版本紀錄、測試、存版本、上線),下面是狀態列。成人課用 look "dev"(深色開發工具),兒童課用 "kids"。
// 規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5);網頁與測試的規則在 model.ts。
// 建議 place 用 { "x": 80, "y": 20, "w": 1760, "h": 780 }(下方留給字幕,免得蓋住測試結果)。尺寸照橫式舞台設計。
//
// props(登場設定,只描述起始狀態):
//   look      dev(預設)| kids
//   project   專案名稱(標題列)
//   url       上線後的網址(預設 my-site.example.app;只用 .example 這類不存在的網域)
//   cards     指令卡(兒童課;有寫就用卡片取代輸入框):[{ "id": "c1", "text": "幫我做一個恐龍網頁", "emoji": "🦕", "ops": [做法…], "reply": "做好了！", "needs": "h1"(網頁上有這個區塊才出現,可省略) }]
//             卡片的做法對不上當時網頁的部分會略過;整張做了也沒改變時,那張卡片不顯示
//   page      一開始的網頁 { "bg": "#fff", "blocks": [區塊…] };預設空白
//             區塊:{ "id": "h1", "kind": "title|text|image|list|button", "text": "…", "emoji": "🍞"(image)、"items": ["…"](list)、
//                    "does": "按下去發生什麼"(button;沒寫就是沒反應)、"alt": "圖片說明"(image)、"wide": true(手機上會超出畫面)、
//                    "color"、"bg"、"size": "s|m|l|xl"、"align": "left|center" }
//
// 動作(依序操作;對不上狀態時載入就報錯並指出第幾步):
//   { "need": "幫我做…" }          在輸入框打字,按送出(有指著的區塊就一起帶上)
//   { "build": [做法…], "reply": "…" }  Agent 動手改網頁:想一想 → 一項一項改 → 回覆。做法:
//        { "add": {區塊}, "after": "h1" | null }(after 不寫加在最後、null 加在最前面)
//        { "set": "h1", "text": "…", "does": "…", "alt": "…", "wide": false, … }("set": "page" 改背景 bg)
//        { "remove": "btn" }、{ "move": "list", "after": "h1" | null }
//   { "ask": "c1" }                點一張指令卡:把卡片的話送出,Agent 照卡片改網頁、回覆
//   { "say": "…" }                 Agent 只回話,不改網頁
//   { "pick": "h1" }               在預覽上點一個區塊,指著它說(false 取消)
//   { "press": "btn" }             按網頁上的按鈕:有 does 就跳出結果,沒有就沒反應
//   { "device": "phone" }          預覽切成手機 / "desktop" 電腦寬度
//   { "undo": true }               復原上一次修改
//   { "check": true }              按「測試」:一項一項檢查(大標題、按鈕有反應、圖片有說明、手機不超出),結果依網頁內容推算
//   { "save": "第一版" }           按「存版本」(要有還沒存的修改)
//   { "versions": true }           打開版本紀錄(false 關掉)
//   { "restore": 1 }               在版本紀錄裡還原第幾版(要先打開版本紀錄);只改草稿,線上網站不變
//   { "publish": true }            按「上線」:把最新存好的版本發布到網址(要先存版本,且有新版本)
//   { "close": true }              關掉測試結果、版本紀錄或上線成功的卡片
//
// 目標:window、chat、composer、send、last(最新一則訊息)、preview、page、part:區塊id、
//   tray、card:id、undo、versions、check、save、publish、device:phone、device:desktop、
//   results、issue:title|button|alt|phone、history、version:N、published、url、status、close
import { kit } from '../../kit'
import { defineActor, type CommonStepFields, type CursorPlan } from '../../types'
import { applyOp, blockInner, blockName, blockStyle, emptyPage, find, opText, runChecks, usableOps, type Card, type CheckItem, type Look, type Op, type Page } from './model'
import './actor.css'

type Kind = 'need' | 'ask' | 'build' | 'say' | 'pick' | 'press' | 'device' | 'undo' | 'check' | 'save' | 'versions' | 'restore' | 'publish' | 'close'
type StudioStep = CommonStepFields & {
  need?: string
  ask?: string
  build?: Op[]
  reply?: string
  say?: string
  pick?: string | false
  press?: string
  device?: 'phone' | 'desktop'
  undo?: boolean
  check?: boolean
  save?: string
  versions?: boolean
  restore?: number
  publish?: boolean
  close?: boolean
}
interface StudioProps {
  look?: Look
  project?: string
  url?: string
  page?: Partial<Page>
  cards?: Card[]
}
interface Msg {
  who: 'user' | 'agent'
  text: string
  /** 這句話指著哪一種區塊 */
  about?: string
}
interface Version {
  n: number
  label: string
  page: Page
}
export interface StudioState {
  look: Look
  cards: Card[]
  /** 試用過(按過網頁上的按鈕或切成手機看) */
  tried: boolean
  /** 測試全部通過過 */
  passed: boolean
  page: Page
  /** 復原用:每次改網頁之前的樣子 */
  history: Page[]
  chat: Msg[]
  device: 'phone' | 'desktop'
  checks: CheckItem[] | null
  versions: Version[]
  /** 目前網頁來自哪一版(0 = 還沒存過) */
  base: number
  published: number
  panel: 'results' | 'history' | 'published' | null
  temp: { picked?: string; pressed?: string }
}

const KINDS: readonly Kind[] = ['need', 'ask', 'build', 'say', 'pick', 'press', 'device', 'undo', 'check', 'save', 'versions', 'restore', 'publish', 'close']
const CPS = 18
const SAY_CPS = 30
/** 滑鼠移到按鈕並按下的時間;按下之後畫面才改變 */
const CLICK = 700
const T = { type: 250, sendGap: 600, think: 800, op: 650, row: 450, deploy: 1500 }

const same = (a: Page, b: Page) => JSON.stringify(a) === JSON.stringify(b)
/** 有沒有還沒存成版本的修改 */
export const dirty = (st: StudioState): boolean => {
  const v = st.versions.find((x) => x.n === st.base)
  return v ? !same(v.page, st.page) : st.page.blocks.length > 0
}

/** 現在做得到哪些操作(工具列變淡與可點區都看它) */
export function can(st: StudioState) {
  const latest = st.versions.at(-1)
  return {
    undo: st.history.length > 0,
    versions: st.versions.length > 0,
    check: st.page.blocks.length > 0,
    save: st.page.blocks.length > 0 && dirty(st),
    publish: !!latest && latest.n !== st.published,
  }
}

const needTyped = (text: string) => T.type + kit.typeDuration(text, CPS)

function pageAfter(page: Page, ops: Op[]): Page {
  return ops.reduce(applyOp, page)
}

const TEXT = {
  dev: {
    agent: 'AI Agent', you: '你', placeholder: '告訴 Agent 你要什麼…', send: '送出', undo: '復原', versions: '版本紀錄',
    check: '測試', save: '存版本', publish: '上線', desktop: '桌面', phone: '手機', empty: '還沒有任何內容。跟 Agent 說你要做什麼。',
    thinking: '思考中', working: '正在', results: '測試結果', running: '檢查中', pass: '全部通過', fail: (n: number) => `${n} 項沒通過`,
    noVersion: '還沒有版本', unsaved: '有未儲存的修改', saved: '已儲存', offline: '尚未上線', online: (n: number) => `線上是 v${n}`,
    behind: (n: number) => `線上仍是 v${n}`, deploying: '發布中', deployed: '已上線', noReaction: '按了沒有反應', about: '指著', restore: '還原', current: '目前',
  },
  kids: {
    agent: '小幫手', you: '我', placeholder: '跟小幫手說你想要什麼…', send: '送出', undo: '回上一步', versions: '我的存檔',
    check: '檢查', save: '存起來', publish: '分享', desktop: '電腦', phone: '手機', empty: '這裡還是空的。跟小幫手說你想做什麼！',
    thinking: '想一想', working: '正在', results: '檢查看看', running: '看一看', pass: '全部沒問題！', fail: (n: number) => `有 ${n} 個地方要修`,
    noVersion: '還沒存起來', unsaved: '有新的改變還沒存', saved: '存好了', offline: '還沒分享', online: (n: number) => `朋友看到的是存檔 ${n}`,
    behind: (n: number) => `朋友看到的還是存檔 ${n}`, deploying: '傳出去中', deployed: '朋友看得到了！', noReaction: '按了沒有反應', about: '指著', restore: '回到這個', current: '現在',
  },
} as const

const versionName = (look: Look, n: number) => (look === 'kids' ? `存檔 ${n}` : `v${n}`)

const actor = defineActor<Kind, StudioStep, StudioProps, StudioState, string>({
  name: 'agent-studio',
  kinds: KINDS,
  parts: {
    undo: '[data-t="undo"]', versions: '[data-t="versions"]', check: '[data-t="check"]', save: '[data-t="save"]', publish: '[data-t="publish"]',
    devices: '.ags-devices', status: '.ags-status',
  },

  init(props) {
    const look = props.look ?? 'dev'
    if (look !== 'dev' && look !== 'kids') throw new Error('look 要是 dev 或 kids')
    const page = (props.page?.blocks ?? []).reduce((p, b) => applyOp(p, { add: b }), { ...emptyPage(), bg: props.page?.bg ?? '#ffffff' })
    const cards = props.cards ?? []
    for (const c of cards) if (!c?.id || !c.text || !Array.isArray(c.ops)) throw new Error('cards 的每張卡片要有 id、text、ops')
    return { look, cards, tried: false, passed: false, page, history: [], chat: [], device: 'desktop', checks: null, versions: [], base: 0, published: 0, panel: null, temp: {} }
  },

  hotspots(st) {
    type Spot = { target: string; label: string; step: StudioStep }
    const spot = (target: string, label: string, step: StudioStep): Spot => ({ target, label, step })
    const L = TEXT[st.look]
    const ok = can(st)
    const out: Spot[] = st.cards.filter((c) => usableOps(st.page, c).length).map((c) => spot(`card:${c.id}`, c.text, { ask: c.id }))
    // 面板蓋在預覽上時,底下的網頁不能點
    if (!st.panel) for (const b of st.page.blocks) if (b.kind === 'button') out.push(spot(`part:${b.id}`, `按「${b.text ?? ''}」試試看`, { press: b.id }))
    const other = st.device === 'phone' ? 'desktop' : 'phone'
    out.push(spot(`device:${other}`, L[other], { device: other }))
    if (ok.undo) out.push(spot('undo', L.undo, { undo: true }))
    if (ok.check) out.push(spot('check', L.check, { check: true }))
    if (ok.save) out.push(spot('save', L.save, { save: `第 ${st.versions.length + 1} 次存的` }))
    if (ok.publish) out.push(spot('publish', L.publish, { publish: true }))
    if (st.panel === 'history') {
      out.push(spot('close', '關掉', { versions: false }))
      for (const v of st.versions) if (v.n !== st.base || dirty(st)) out.push(spot(`version:${v.n}`, `${L.restore}：${v.label}`, { restore: v.n }))
    } else {
      if (ok.versions) out.push(spot('versions', L.versions, { versions: true }))
      if (st.panel) out.push(spot(st.panel, '關掉', { close: true }))
    }
    return out
  },

  apply(prev, kind, s) {
    // 版本紀錄以外的面板,做下一件事就收起來;按過按鈕的提示也一樣
    const st: StudioState = { ...prev, panel: prev.panel === 'history' ? 'history' : null, temp: { picked: prev.temp.picked } }
    const changed = (page: Page): StudioState => ({ ...st, page, history: [...st.history, st.page], checks: null, panel: null, temp: {} })
    const hasPage = () => {
      if (!st.page.blocks.length) throw new Error(`${kind}:網頁還是空的`)
    }
    switch (kind) {
      case 'need': {
        if (typeof s.need !== 'string' || !s.need.trim()) throw new Error('need 要給文字')
        const i = st.temp.picked
        const about = i ? blockName(st.look, st.page.blocks[find(st.page, i)].kind) : undefined
        return { ...st, chat: [...st.chat, { who: 'user', text: s.need, ...(about ? { about } : {}) }], panel: null, temp: {} }
      }
      case 'ask': {
        const card = st.cards.find((c) => c.id === s.ask)
        if (!card) throw new Error(`ask:沒有「${s.ask}」這張卡片`)
        const ops = usableOps(st.page, card)
        if (!ops.length) throw new Error(`ask:「${card.id}」現在做了也不會改變網頁`)
        const next = changed(pageAfter(st.page, ops))
        const reply: Msg[] = card.reply ? [{ who: 'agent', text: card.reply }] : []
        return { ...next, chat: [...next.chat, { who: 'user', text: card.text }, ...reply] }
      }
      case 'say':
        if (typeof s.say !== 'string' || !s.say) throw new Error('say 要給文字')
        return { ...st, chat: [...st.chat, { who: 'agent', text: s.say }] }
      case 'build': {
        if (!Array.isArray(s.build) || !s.build.length) throw new Error('build 要給做法陣列')
        const next = changed(pageAfter(st.page, s.build))
        return s.reply ? { ...next, chat: [...next.chat, { who: 'agent', text: s.reply }] } : next
      }
      case 'pick':
        if (s.pick === false) return { ...st, temp: {} }
        find(st.page, String(s.pick))
        return { ...st, panel: null, temp: { picked: String(s.pick) } }
      case 'press': {
        const b = st.page.blocks[find(st.page, String(s.press))]
        if (b.kind !== 'button') throw new Error(`press:「${b.id}」不是按鈕`)
        return { ...st, tried: true, panel: null, temp: { pressed: b.id } }
      }
      case 'device':
        if (s.device !== 'phone' && s.device !== 'desktop') throw new Error('device 要是 phone 或 desktop')
        return { ...st, tried: st.tried || s.device === 'phone', device: s.device, panel: null }
      case 'undo': {
        const page = st.history.at(-1)
        if (!page) throw new Error('undo:沒有可以復原的修改')
        return { ...st, page, history: st.history.slice(0, -1), checks: null, panel: null, temp: {} }
      }
      case 'check': {
        hasPage()
        const checks = runChecks(st.look, st.page)
        return { ...st, checks, passed: st.passed || checks.every((c) => c.ok), panel: 'results', temp: {} }
      }
      case 'save': {
        if (typeof s.save !== 'string' || !s.save.trim()) throw new Error('save 要給版本名稱')
        hasPage()
        if (!dirty(st)) throw new Error('save:沒有新的修改可以存')
        const n = st.versions.length + 1
        return { ...st, versions: [...st.versions, { n, label: s.save, page: st.page }], base: n, panel: null }
      }
      case 'versions':
        if (s.versions && !st.versions.length) throw new Error('versions:還沒有存過任何版本')
        return { ...st, panel: s.versions ? 'history' : null }
      case 'restore': {
        if (prev.panel !== 'history') throw new Error('restore:要先打開版本紀錄({ "versions": true })')
        const v = st.versions.find((x) => x.n === s.restore)
        if (!v) throw new Error(`restore:沒有第 ${s.restore} 版`)
        return { ...changed(v.page), base: v.n }
      }
      case 'publish': {
        const latest = st.versions.at(-1)
        if (!latest) throw new Error('publish:要先存版本')
        if (latest.n === st.published) throw new Error('publish:沒有新的版本可以上線')
        return { ...st, published: latest.n, panel: 'published', temp: {} }
      }
      case 'close':
        if (!prev.panel) throw new Error('close:沒有打開的面板')
        return { ...st, panel: null }
    }
  },

  duration(kind, step, _props, prev) {
    switch (kind) {
      case 'ask': {
        const card = prev?.cards.find((c) => c.id === step.ask)
        const n = card && prev ? usableOps(prev.page, card).length : 1
        return CLICK + T.think + n * T.op + (card?.reply ? kit.typeDuration(card.reply, SAY_CPS) : 0) + 600
      }
      case 'need': return needTyped(step.need ?? '') + T.sendGap + 500
      case 'say': return 300 + kit.typeDuration(step.say ?? '', SAY_CPS) + 500
      case 'build': return T.think + (step.build?.length ?? 0) * T.op + (step.reply ? kit.typeDuration(step.reply, SAY_CPS) : 0) + 600
      case 'check': return CLICK + 4 * T.row + 1100
      case 'publish': return CLICK + T.deploy + 1200
      case 'press': return CLICK + 1500
      case 'device': return CLICK + 900
      case 'restore': return CLICK + 800
      case 'pick': return step.pick === false && !prev?.temp.picked ? 300 : CLICK + 500
      default: return CLICK + 700
    }
  },

  autoFocus() {
    return false
  },

  cursor(kind, step, prev): CursorPlan | null {
    const click = (target: string): CursorPlan => ({ moves: [{ at: CLICK - 100, target }], clickAt: CLICK })
    switch (kind) {
      case 'need': {
        const at = needTyped(step.need ?? '') + T.sendGap - 150
        return { moves: [{ at: T.type, target: 'composer' }, { at, target: 'send' }], clickAt: at }
      }
      case 'ask': return click(`card:${step.ask}`)
      case 'pick': return step.pick ? click(`part:${step.pick}`) : null
      case 'press': return click(`part:${step.press}`)
      case 'device': return click(`device:${step.device}`)
      case 'restore': return click(`version:${step.restore}`)
      case 'versions': return click(step.versions || prev?.panel !== 'history' ? 'versions' : 'close')
      case 'undo': case 'check': case 'save': case 'publish': case 'close': return click(kind)
      default: return null
    }
  },

  mount(root, props) {
    const look: Look = props.look ?? 'dev'
    const L = TEXT[look]
    const url = props.url || 'my-site.example.app'
    root.classList.add('A-agent-studio')
    root.dataset.look = look
    const btn = (t: string, label: string, cls = '') => `<span class="ags-btn ${cls}" data-t="${t}">${label}</span>`
    root.innerHTML =
      `<div class="ags-window">` +
      `<div class="ags-bar"><span class="ags-lights"><i></i><i></i><i></i></span><span class="ags-project">${kit.esc(props.project || '我的專案')}</span>` +
      `<span class="ags-tools">${btn('undo', L.undo)}${btn('versions', L.versions)}${btn('check', L.check, 'ags-main')}${btn('save', L.save, 'ags-main')}${btn('publish', L.publish, 'ags-go')}</span></div>` +
      `<div class="ags-body">` +
      `<div class="ags-chat"><div class="ags-agent"><span class="ags-face">${look === 'kids' ? '🤖' : '✦'}</span>${L.agent}</div>` +
      `<div class="ags-log"><div class="ags-msgs"></div></div>` +
      `<div class="ags-tray"></div>` +
      `<div class="ags-composer"><div class="ags-chip"></div><div class="ags-input"></div>${btn('send', L.send, 'ags-go')}</div></div>` +
      `<div class="ags-work"><div class="ags-address"><span class="ags-url"></span><span class="ags-devices">${btn('device:desktop', L.desktop)}${btn('device:phone', L.phone)}</span></div>` +
      `<div class="ags-preview"><div class="ags-frame"><div class="ags-page"></div></div><div class="ags-toast"></div>` +
      `<div class="ags-results"></div><div class="ags-history"></div><div class="ags-published"></div></div></div>` +
      `</div><div class="ags-status"></div></div>`
    const $ = (s: string) => root.querySelector<HTMLElement>(s)!
    const byT = (t: string) => root.querySelector<HTMLElement>(`[data-t="${t}"]`)
    const tray = $('.ags-tray'), composer = $('.ags-composer')
    const log = $('.ags-log'), msgs = $('.ags-msgs'), chip = $('.ags-chip'), input = $('.ags-input')
    const urlEl = $('.ags-url'), preview = $('.ags-preview'), frame = $('.ags-frame'), pageEl = $('.ags-page'), toast = $('.ags-toast')
    const results = $('.ags-results'), history = $('.ags-history'), published = $('.ags-published'), status = $('.ags-status')
    const show = (el: HTMLElement, p: number) => {
      el.hidden = p <= 0
      kit.css(el, { opacity: p.toFixed(3), transform: `translateY(${((1 - p) * 24).toFixed(1)}px)` })
    }

    return {
      render(frameData) {
        const v = frameData.view
        if (!v) return
        const ev = v.ev && KINDS.includes(v.ev.kind as Kind) ? v.ev : null
        const kind = ev?.kind as Kind | undefined
        const step = (ev?.step ?? {}) as StudioStep
        const local = ev?.local ?? 0
        const end = v.ev?.kind === 'hide' ? v.prev : v.state
        // 按鈕按下去之前,畫面還是動作前的樣子
        const needAt = kind === 'need' ? needTyped(step.need ?? '') + T.sendGap : 0
        const waiting = ev ? (kind === 'need' ? local < needAt : kind === 'build' || kind === 'say' ? false : local < CLICK) : false
        const st = waiting ? v.prev : end
        const after = (from: number, len = 300) => (ev ? kit.progress(local, from, len) : 1)

        // ---- 對話 ----
        let chat = st.chat
        let working = ''
        let reply: string | null = null
        let page = st.page
        let justChanged = ''
        const card = kind === 'ask' ? v.prev.cards.find((c) => c.id === step.ask) : undefined
        if (kind === 'build' || (card && !waiting)) {
          const ops = card ? usableOps(v.prev.page, card) : (step.build ?? [])
          const text = card ? card.reply : step.reply
          // 卡片:滑鼠按下去之後才開始
          const t = card ? local - CLICK : local
          const done = Math.floor((t - T.think) / T.op)
          const k = Math.max(0, Math.min(ops.length, done + 1))
          page = t < T.think ? v.prev.page : pageAfter(v.prev.page, ops.slice(0, k))
          chat = card ? [...v.prev.chat, { who: 'user', text: card.text }] : v.prev.chat
          const doneAt = T.think + ops.length * T.op
          if (t < T.think) working = `${L.thinking}${'.'.repeat(1 + (Math.floor(t / 250) % 3))}`
          else if (t < doneAt) {
            const op = ops[k - 1]
            working = `${L.working}${opText(look, pageAfter(v.prev.page, ops.slice(0, k - 1)), op)}（${k}/${ops.length}）`
            justChanged = 'add' in op ? op.add.id : 'set' in op ? op.set : 'move' in op ? op.move : ''
          } else if (text) reply = kit.typewriter(text, t, { start: doneAt, cps: SAY_CPS }).text
        } else if (kind === 'say') {
          chat = v.prev.chat
          reply = kit.typewriter(step.say ?? '', local, { start: 300, cps: SAY_CPS }).text
        }
        const bubble = (m: Msg, extra = '') =>
          `<div class="ags-msg ags-${m.who}"${extra}>${m.about ? `<span class="ags-about">${L.about}${kit.esc(m.about)}</span>` : ''}${kit.esc(m.text)}</div>`
        const fresh = kind === 'need' && !waiting ? after(needAt, 250) : 1
        kit.setIf(
          msgs,
          'html',
          chat.map((m, i) => bubble(m, i === chat.length - 1 && fresh < 1 ? ` style="opacity:${fresh.toFixed(3)}"` : '')).join('') +
            (reply !== null && reply ? bubble({ who: 'agent', text: reply }) : '') +
            (working ? `<div class="ags-working"><i></i>${kit.esc(working)}</div>` : ''),
        )
        kit.css(msgs, { transform: `translateY(${(-Math.max(0, msgs.offsetHeight - log.clientHeight)).toFixed(1)}px)` })

        // ---- 輸入框 ----
        const picked = st.temp.picked ? st.page.blocks.find((b) => b.id === st.temp.picked) : undefined
        kit.setIf(chip, 'text', picked ? `${L.about}：${blockName(look, picked.kind)}` : '')
        chip.hidden = !picked
        const typing = kind === 'need' && waiting ? kit.typewriter(step.need ?? '', local, { start: T.type, cps: CPS }).text : ''
        kit.setIf(input, 'text', typing || L.placeholder)
        input.classList.toggle('ags-hint', !typing)

        // ---- 指令卡 ----
        // 有卡片的畫面用卡片說話,不放輸入框(腳本真的打字時才出現)
        composer.hidden = st.cards.length > 0 && kind !== 'need'
        tray.hidden = !st.cards.length
        kit.setIf(
          tray,
          'html',
          st.cards
            .filter((c) => usableOps(st.page, c).length)
            .map((c) => `<div class="ags-card${kind === 'ask' && c.id === step.ask && ev && local >= CLICK - 100 && local < CLICK + 220 ? ' ags-press' : ''}" data-t="card:${kit.esc(c.id)}"><span>${kit.esc(c.emoji ?? '💬')}</span>${kit.esc(c.text)}</div>`)
            .join(''),
        )

        // ---- 預覽 ----
        const phoneP = kind === 'device' && v.prev.device !== end.device ? after(CLICK, 700) : 1
        const phoneness = st.device === 'phone' ? (waiting ? 1 : phoneP) : kind === 'device' && v.prev.device === 'phone' && !waiting ? 1 - phoneP : 0
        kit.css(frame, { width: `${(100 - 60 * kit.ease.inOutCubic(phoneness)).toFixed(2)}%` })
        frame.classList.toggle('ags-phone', st.device === 'phone')
        kit.css(pageEl, { background: page.bg })
        const swap = kind === 'undo' || kind === 'restore' ? (waiting ? 1 : after(CLICK, 450)) : 1
        kit.css(pageEl, { opacity: swap.toFixed(3) })
        const flagged = st.panel === 'results' && st.checks ? new Set(st.checks.filter((c) => !c.ok && c.block).map((c) => c.block)) : new Set<string>()
        const rows = kind === 'check' && !waiting ? Math.floor((local - CLICK) / T.row) : 4
        kit.setIf(
          pageEl,
          'html',
          page.blocks.length
            ? page.blocks
                .map((b) => {
                  const bad = flagged.has(b.id) && rows >= (st.checks?.findIndex((c) => c.block === b.id) ?? 0)
                  const cls = ['ags-block', `ags-k-${b.kind}`, `ags-s-${b.size ?? 'm'}`, b.wide ? 'ags-wide' : '', picked?.id === b.id ? 'ags-picked' : '', justChanged === b.id ? 'ags-new' : '', bad ? 'ags-bad' : '']
                  return `<div class="${cls.filter(Boolean).join(' ')}" data-id="${kit.esc(b.id)}" style="${blockStyle(b)}">${blockInner(b)}</div>`
                })
                .join('')
            : `<div class="ags-empty">${L.empty}</div>`,
        )
        const pressed = st.temp.pressed ? st.page.blocks.find((b) => b.id === st.temp.pressed) : undefined
        kit.setIf(toast, 'text', pressed ? (pressed.does ?? L.noReaction) : '')
        toast.classList.toggle('ags-none', !!pressed && !pressed.does)
        show(toast, pressed ? (kind === 'press' ? after(CLICK + (pressed.does ? 100 : 500)) : 1) : 0)

        // ---- 測試結果 ----
        const checks = st.checks
        if (st.panel === 'results' && checks) {
          const done = rows >= checks.length
          const fails = checks.filter((c) => !c.ok).length
          kit.setIf(
            results,
            'html',
            `<div class="ags-head"><b>${L.results}</b><span class="${done ? (fails ? 'ags-ng' : 'ags-ok') : ''}">${done ? (fails ? L.fail(fails) : L.pass) : `${L.running}…`}</span></div>` +
              checks
                .map((c, i) => (i < rows ? `<div class="ags-row ${c.ok ? 'ags-ok' : 'ags-ng'}" data-id="${c.id}"><i>${c.ok ? '✓' : '✗'}</i>${c.label}</div>` : `<div class="ags-row ags-wait"><i>·</i>${c.label}</div>`))
                .join(''),
          )
          show(results, kind === 'check' ? after(CLICK, 250) : 1)
        } else show(results, 0)

        // ---- 版本紀錄 ----
        if (st.panel === 'history') {
          kit.setIf(
            history,
            'html',
            `<div class="ags-head"><b>${L.versions}</b>${btn('close', '✕')}</div>` +
              [...st.versions]
                .reverse()
                .map(
                  (x) =>
                    `<div class="ags-version" data-t="version:${x.n}"><b>${versionName(look, x.n)}</b><span>${kit.esc(x.label)}</span>` +
                    `<em>${x.n === st.published ? `${L.deployed}　` : ''}${x.n === st.base && !dirty(st) ? L.current : L.restore}</em></div>`,
                )
                .join(''),
          )
          show(history, kind === 'versions' ? after(CLICK, 300) : 1)
        } else show(history, 0)

        // ---- 上線 ----
        if (st.panel === 'published') {
          const p = kind === 'publish' ? kit.progress(local, CLICK, T.deploy) : 1
          kit.setIf(
            published,
            'html',
            p < 1
              ? `<b>${L.deploying}…</b><div class="ags-meter"><i style="width:${(p * 100).toFixed(1)}%"></i></div>`
              : `<span class="ags-big">${look === 'kids' ? '🎉' : '✓'}</span><b>${L.deployed}</b><span class="ags-link">https://${kit.esc(url)}</span><em>${versionName(look, st.published)}</em>`,
          )
          show(published, kind === 'publish' ? after(CLICK, 250) : 1)
        } else show(published, 0)

        // ---- 網址列與狀態列 ----
        kit.setIf(urlEl, 'text', st.published ? `https://${url}` : look === 'kids' ? '我的網頁（只有我看得到）' : '預覽（只有你看得到）')
        for (const d of ['desktop', 'phone']) byT(`device:${d}`)?.classList.toggle('ags-on', st.device === d)
        byT('versions')?.classList.toggle('ags-on', st.panel === 'history')
        for (const t of ['undo', 'versions', 'check', 'save', 'publish', 'send']) byT(t)?.classList.toggle('ags-press', waiting === false && !!ev && local >= (t === 'send' ? needAt : CLICK) && local < (t === 'send' ? needAt : CLICK) + 220 && (t === 'send' ? kind === 'need' : kind === t))
        const ok = can(st)
        for (const t of ['undo', 'versions', 'check', 'save', 'publish'] as const) byT(t)?.classList.toggle('ags-off', !ok[t] && kind !== t)
        const isDirty = dirty(st)
        kit.setIf(
          status,
          'html',
          `<span>${st.base ? versionName(look, st.base) : L.noVersion}</span>` +
            `<span class="${isDirty ? 'ags-warn' : ''}">${isDirty ? L.unsaved : st.base ? L.saved : ''}</span>` +
            `<span class="ags-live">${!st.published ? L.offline : st.published === st.base && !isDirty ? L.online(st.published) : L.behind(st.published)}</span>`,
        )
        preview.dataset.panel = st.panel ?? ''
      },

      target(name) {
        const simple: Record<string, string> = {
          window: '.ags-window', chat: '.ags-chat', composer: '.ags-composer', preview: '.ags-preview', page: '.ags-frame',
          tray: '.ags-tray', results: '.ags-results', history: '.ags-history', published: '.ags-published', url: '.ags-url', status: '.ags-status',
        }
        if (simple[name]) return $(simple[name])
        if (name === 'last') return msgs.lastElementChild as HTMLElement | null
        const [head, rest] = [name.slice(0, name.indexOf(':')), name.slice(name.indexOf(':') + 1)]
        if (head === 'part') return [...pageEl.children].find((c) => (c as HTMLElement).dataset.id === rest) as HTMLElement | null ?? null
        if (head === 'issue') return results.querySelector<HTMLElement>(`[data-id="${rest}"]`)
        return byT(name)
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
