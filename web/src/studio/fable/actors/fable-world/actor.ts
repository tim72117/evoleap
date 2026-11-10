// 演員 fable-world:「本機與網路上」的場景(研發基地試作,不進公開 bundle;登記在 ../../registerActors.ts)。
// 左邊是你的書桌與筆電(終端機、瀏覽器),右邊是城市另一頭的朋友與他的手機,城市裡有一座伺服器大樓。
// 概念用畫面演:筆電打開變成一間「小房間」(localhost 就是這台電腦自己,門牌是 5173);
// 朋友打 localhost 時,信繞一圈又回到他自己的手機;上線就是把網站搬進城裡那座 24 小時亮著的大樓,誰的信都寄得到。
// 文字都是真的 DOM;所有動畫由 render 依時間算出(SPEC 第 1 節)。place 用 "full",疊在 fable-sky 上面。
//
// props:
//   friend   朋友的名字;預設 "阿哲"
//   port     開發伺服器的門號;預設 5173
//   domain   上線後的網域;預設 "www.example.com"
//   site     網站名稱;預設 "小森烘焙"
//
// 動作(操作式;對不上狀態時載入就報錯;任何一步都可以寫 ms 指定長度,整段動畫依比例放慢或加快):
//   { "boot": true }              在筆電的終端機跑 npm run dev,印出 localhost 網址(要還沒在跑)
//   { "open": true }              筆電上用瀏覽器打開網站,畫面一塊塊畫出(要先 boot)
//   { "send": "訊息" }            把訊息傳給朋友:紙飛機從筆電飛過城市到他的手機
//   { "visit": "網址" }           朋友在手機上輸入網址:localhost 的信繞一圈回到他自己的手機(打不開);
//                                 網域的信飛到伺服器,伺服器開著且網站已上線就把網頁寄回來,關機就沒有回應
//   { "reveal": true | false }    筆電化成一間小房間(門牌是門號、裡面擺著網站);false 變回筆電
//   { "peek": true | false }      朋友的手機旁邊也出現他自己的小房間(裡面沒有網站)
//   { "doors": true | false }     小房間多出其他門牌(3000、8080):同一台電腦可以開好幾個網站
//   { "stop": true }              按 Ctrl+C:終端機印出 ^C,房間的燈暗下來、網站消失(要先 boot)
//   { "deploy": true }            網站從房間飛進城裡的伺服器大樓,招牌亮起網域(要還沒上線)
//   { "power": true | false }     伺服器開機/關機
//   { "crowd": true | false }     城裡各處的裝置一台台亮起同一個網站(誰打開都看得到)
//
// 目標:window、laptop、screen、terminal、url、phone、house、door、server、sign
import { kit } from '../../../../live/kit'
import { defineActor, type CommonStepFields } from '../../../../live/types'
import './actor.css'

// ---------- 型別 ----------
export interface WorldProps {
  friend?: string
  port?: number
  domain?: string
  site?: string
}
export const KINDS = ['boot', 'open', 'send', 'visit', 'reveal', 'peek', 'doors', 'stop', 'deploy', 'power', 'crowd'] as const
export type Kind = (typeof KINDS)[number]
export type WorldStep = CommonStepFields & {
  boot?: true
  open?: true
  send?: string
  visit?: string
  reveal?: boolean
  peek?: boolean
  doors?: boolean
  stop?: true
  deploy?: true
  power?: boolean
  crowd?: boolean
}
export type Target = 'window' | 'laptop' | 'screen' | 'terminal' | 'url' | 'phone' | 'house' | 'door' | 'server' | 'sign'

export type VisitResult = 'fail' | 'site' | 'down'
export interface WorldState {
  dev: boolean
  /** 筆電螢幕上是什麼:桌面、終端機、瀏覽器 */
  screen: 'desktop' | 'terminal' | 'browser'
  stopped: boolean
  chat: string | null
  /** host:local 是本機位址、domain 是上線後的網域(props.domain)、other 是別的網址(永遠找不到);name 是網址裡的主機名稱 */
  visit: { url: string; host: Host; name: string; result: VisitResult } | null
  /** 上線後的網域(props.domain),visit 用它判斷打的是不是這個網站 */
  domain: string
  reveal: boolean
  peek: boolean
  doors: boolean
  deployed: boolean
  server: boolean
  crowd: boolean
  temp: Record<string, never>
}

// ---------- 時間表(毫秒,相對動作開始) ----------
const T = {
  boot: 4200, bootType: 400, bootOut1: 2000, bootOut2: 2500,
  open: 2400, openSlide: 700,
  send: 3000, sendBubble: 150, planeFrom: 700, planeDur: 1800,
  visitSheet: 400, visitType: 500, visitGo: 1700, loopDur: 1900, hopDur: 1500, serverThink: 500,
  reveal: 1800, peek: 1400, doors: 1200,
  stop: 2200, stopKey: 150, stopPress: 800,
  deploy: 3600, deployFly: 2500,
  power: 1000,
  crowd: 2400,
}
const CPS = 16

const DEFAULT_DOMAIN = 'www.example.com'

type Host = 'local' | 'domain' | 'other'

/** 網址裡的主機名稱(小寫,不含協定、帳號、連接埠;IPv6 保留方括號,例如 [::1]) */
export const hostNameOf = (url: string): string => {
  const authority = url.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0]
  const hostPort = authority.slice(authority.lastIndexOf('@') + 1).toLowerCase()
  const name = hostPort.startsWith('[') ? hostPort.slice(0, hostPort.indexOf(']') + 1) : hostPort.split(':')[0]
  if (!name || name === '[') throw new Error(`「${url}」不是網址`)
  return name
}

/** 本機位址(localhost、127.x.x.x、[::1]、0.0.0.0)、上線後的網域,或別的網址 */
export const hostOf = (url: string, domain: string): Host => {
  const name = hostNameOf(url)
  if (name === 'localhost' || name.endsWith('.localhost') || /^127(\.\d{1,3}){3}$/.test(name) || name === '[::1]' || name === '0.0.0.0') return 'local'
  return name === domain.trim().toLowerCase() ? 'domain' : 'other'
}

export function apply(st: WorldState, kind: Kind, s: WorldStep): WorldState {
  const flag = (v: unknown, name: string): boolean => {
    if (typeof v !== 'boolean') throw new Error(`${name} 要寫 true 或 false`)
    return v
  }
  switch (kind) {
    case 'boot':
      if (st.dev) throw new Error('boot:開發伺服器已經在跑了')
      return { ...st, dev: true, stopped: false, screen: 'terminal' }
    case 'open':
      if (!st.dev) throw new Error('open:網站還沒開起來,先 boot')
      return { ...st, screen: 'browser' }
    case 'send':
      if (typeof s.send !== 'string' || !s.send.trim()) throw new Error('send 要寫訊息(字串)')
      return { ...st, chat: s.send }
    case 'visit': {
      if (typeof s.visit !== 'string' || !s.visit.trim()) throw new Error('visit 要寫網址(字串)')
      const host = hostOf(s.visit, st.domain)
      // 只有上線後的網域連得到這個網站;本機位址找的是手機自己,別的網址也不是這個網站
      const result: VisitResult = host !== 'domain' || !st.deployed ? 'fail' : !st.server ? 'down' : 'site'
      return { ...st, visit: { url: s.visit.trim(), host, name: hostNameOf(s.visit), result } }
    }
    case 'reveal': {
      const v = flag(s.reveal, 'reveal')
      if (v === st.reveal) throw new Error(`reveal:筆電已經${v ? '是小房間' : '是筆電'}了`)
      return { ...st, reveal: v }
    }
    case 'peek': {
      const v = flag(s.peek, 'peek')
      if (v === st.peek) throw new Error('peek:已經是這個狀態了')
      return { ...st, peek: v }
    }
    case 'doors': {
      const v = flag(s.doors, 'doors')
      if (v && !st.reveal) throw new Error('doors:要先 reveal 變成小房間,才看得到門牌')
      return { ...st, doors: v }
    }
    case 'stop':
      if (!st.dev) throw new Error('stop:開發伺服器沒有在跑')
      return { ...st, dev: false, stopped: true, screen: 'terminal' }
    case 'deploy':
      if (st.deployed) throw new Error('deploy:網站已經上線了')
      return { ...st, deployed: true }
    case 'power': {
      const v = flag(s.power, 'power')
      if (v === st.server) throw new Error(`power:伺服器已經${v ? '開機' : '關機'}了`)
      return { ...st, server: v }
    }
    case 'crowd':
      return { ...st, crowd: flag(s.crowd, 'crowd') }
  }
}

export const kindIn = (kind: string, step: object): Kind | null =>
  (KINDS as readonly string[]).includes(kind) ? (kind as Kind) : kind === 'show' || kind === 'hide' || kind === 'props' ? (KINDS.find((k) => k in step) ?? null) : null

export function durationOf(kind: Kind, s: WorldStep, prev: WorldState | undefined): number {
  switch (kind) {
    case 'boot': return T.boot
    case 'open': return T.open
    case 'send': return T.send
    case 'visit': {
      const typing = T.visitSheet + T.visitType + kit.typeDuration(s.visit ?? '', CPS)
      if (!prev?.deployed || hostOf(s.visit ?? 'x.y', prev.domain) !== 'domain') return typing + 400 + T.loopDur + 900
      if (!prev.server) return typing + 400 + T.hopDur + 1200
      return typing + 400 + T.hopDur + T.serverThink + T.hopDur + 1400
    }
    case 'reveal': return T.reveal
    case 'peek': return T.peek
    case 'doors': return T.doors
    case 'stop': return T.stop
    case 'deploy': return T.deploy
    case 'power': return T.power
    case 'crowd': return T.crowd
  }
}

// ---------- 畫面 ----------
/** 鏡頭(演員自己的推軌):小房間打開時推近書桌;兩間房間都要看時退回全景。fable-scene 依它讓背景做視差 */
export const dollyOf = (st: WorldState): { x: number; y: number; z: number } => (st.reveal && !st.peek && !st.deployed ? { x: 560, y: 560, z: 1.22 } : { x: 960, y: 540, z: 1 })
/** 推軌的過場長度:動作開始後這麼久推到位 */
export const dollyMs = (dur: number): number => Math.min(dur, 1400)
const SITE = (name: string): string =>
  `<div class="fw-site"><div class="fw-site-nav"><b>${kit.esc(name)}</b><i></i><i></i><i></i></div>` +
  `<div class="fw-site-hero"><h3>${kit.esc(name)}</h3><p>每天現烤的麵包與甜點</p><span class="fw-site-btn">看菜單</span></div>` +
  `<div class="fw-site-cards"><span></span><span></span><span></span></div></div>`
const PLANE = '<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M2 14 46 2 30 30 22 20Z" class="fw-plane-body"/><path d="M22 20 46 2 14 16Z" class="fw-plane-wing"/></svg>'
const ENVELOPE = '<svg viewBox="0 0 48 34" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="31" rx="4"/><path d="M3 4l21 15L45 4"/></svg>'

// 路徑(舞台 px):紙飛機 筆電→手機;localhost 的信 從手機出去繞一圈回來;網域的信 手機→伺服器;上線 房間→伺服器
const PATH = {
  plane: 'M 600 560 C 820 120, 1280 120, 1640 640',
  loop: 'M 1665 600 C 1665 400, 1880 390, 1885 520 C 1890 640, 1720 660, 1665 600',
  visit: 'M 1600 700 C 1480 700, 1420 560, 1322 540',
  deploy: 'M 520 600 C 700 260, 1000 240, 1222 330',
}
const CROWD: { x: number; y: number; kind: 'phone' | 'laptop' }[] = [
  { x: 930, y: 690, kind: 'phone' },
  { x: 1430, y: 650, kind: 'laptop' },
  { x: 1020, y: 560, kind: 'laptop' },
  { x: 1780, y: 420, kind: 'phone' },
  { x: 1520, y: 760, kind: 'phone' },
]

const actor = defineActor<Kind, WorldStep, WorldProps, WorldState, Target>({
  name: 'fable-world',
  kinds: KINDS,

  init(props) {
    if (props.port != null && !(Number.isInteger(props.port) && props.port > 0)) throw new Error('port 要是正整數')
    return { dev: false, screen: 'desktop', stopped: false, chat: null, visit: null, domain: props.domain ?? DEFAULT_DOMAIN, reveal: false, peek: false, doors: false, deployed: false, server: true, crowd: false, temp: {} }
  },
  apply,
  duration(kind, step, _props, prev) {
    return durationOf(kind, step, prev)
  },
  autoFocus() {
    return undefined
  },

  mount(root, props) {
    const friend = props.friend ?? '阿哲'
    const port = props.port ?? 5173
    const domain = props.domain ?? DEFAULT_DOMAIN
    const siteName = props.site ?? '小森烘焙'
    root.classList.add('A-fable-world')
    root.innerHTML =
      `<div class="fw-scene">` +
      `<svg class="fw-paths" viewBox="0 0 1920 1080" aria-hidden="true">` +
      `<path class="fw-path fw-path-plane" d="${PATH.plane}"/><path class="fw-path fw-path-loop" d="${PATH.loop}"/>` +
      `<path class="fw-path fw-path-visit" d="${PATH.visit}"/><path class="fw-path fw-path-deploy" d="${PATH.deploy}"/>` +
      CROWD.map((c) => `<path class="fw-path fw-path-crowd" d="M 1220 520 Q ${(1220 + c.x) / 2} ${Math.min(520, c.y) - 80} ${c.x + 30} ${c.y + 20}"/>`).join('') +
      `</svg>` +
      // 伺服器大樓
      `<div class="fw-server"><div class="fw-sign"><span class="fw-sign-text">${kit.esc(domain)}</span></div><div class="fw-neon">24h</div>` +
      `<div class="fw-srv-body">${Array.from({ length: 24 }, (_, i) => `<i data-i="${i}"></i>`).join('')}<div class="fw-srv-rack"><div class="fw-srv-lamp"></div><div class="fw-srv-site">${SITE(siteName)}</div></div></div>` +
      `<div class="fw-srv-label">伺服器<small>24 小時開著、連著網路的電腦</small></div></div>` +
      // 城裡的裝置
      `<div class="fw-crowd">${CROWD.map((c) => `<div class="fw-dev fw-dev-${c.kind}" style="left:${c.x}px;top:${c.y}px"><div class="fw-dev-screen">${SITE(siteName)}</div></div>`).join('')}</div>` +
      // 書桌與筆電
      `<div class="fw-desk"><div class="fw-lamp"></div><div class="fw-lamp-glow"></div><div class="fw-mug"></div>` +
      `<div class="fw-laptop"><div class="fw-lid"><div class="fw-screen"><div class="fw-wall"></div>` +
      `<div class="fw-term"><div class="fw-term-bar"><i></i><i></i><i></i><span>終端機</span></div><pre class="fw-term-body"><span class="fw-t-prompt">~/projects/bakery $ </span><span class="fw-t-cmd"></span><span class="fw-t-caret">▍</span>\n<span class="fw-t-out1"></span>\n<span class="fw-t-out2"></span><span class="fw-t-url"></span>\n<span class="fw-t-stop"></span></pre></div>` +
      `<div class="fw-brw"><div class="fw-brw-bar"><i></i><i></i><i></i><span class="fw-brw-url">http://localhost:${port}</span></div><div class="fw-brw-page">${SITE(siteName)}</div></div>` +
      `</div></div><div class="fw-base"><div class="fw-keys"></div><div class="fw-pad"></div></div></div>` +
      `<div class="fw-you">你<small>在家裡的書桌</small></div></div>` +
      `<div class="fw-keycap">Ctrl + C</div>` +
      // 小房間(筆電化成的)
      `<div class="fw-house"><div class="fw-roof"></div><div class="fw-wallbox">` +
      `<div class="fw-window"></div><div class="fw-frame">${SITE(siteName)}<div class="fw-frame-off">網站停了</div></div>` +
      `<div class="fw-doorrow"><div class="fw-door fw-door-main"><span class="fw-plate">${port}</span></div><div class="fw-door fw-door-more"><span class="fw-plate">3000</span></div><div class="fw-door fw-door-more"><span class="fw-plate">8080</span></div></div>` +
      `</div><div class="fw-house-label">localhost<small>＝這台電腦自己</small></div></div>` +
      // 朋友的手機與他的小房間
      `<div class="fw-phone"><div class="fw-phone-screen"><div class="fw-pstatus"><span>9:41</span><span>●●●</span></div>` +
      `<div class="fw-chat"><div class="fw-chat-head">你</div><div class="fw-chat-msg"></div></div>` +
      `<div class="fw-sheet"><div class="fw-sheet-bar"><span class="fw-sheet-url"></span><span class="fw-sheet-caret">▍</span></div><div class="fw-sheet-body">` +
      `<div class="fw-sheet-loading">連線中<span class="fw-dots"></span></div><div class="fw-sheet-site">${SITE(siteName)}</div>` +
      `<div class="fw-sheet-err"><b>!</b><h4>無法連上這個網站</h4><p class="fw-err-text"></p></div></div></div></div>` +
      `<div class="fw-friend">${kit.esc(friend)}<small>城市另一頭</small></div></div>` +
      `<div class="fw-phouse"><div class="fw-roof"></div><div class="fw-wallbox"><div class="fw-frame fw-frame-empty">沒有你的網站</div><div class="fw-doorrow"><div class="fw-door fw-door-main"><span class="fw-plate">${port}</span></div></div></div><div class="fw-house-label">${kit.esc(friend)}的 localhost<small>＝他自己的手機</small></div></div>` +
      // 飛行中的東西
      `<div class="fw-bubble"></div>` +
      `<div class="fw-plane">${PLANE}</div>` +
      `<div class="fw-packet"><div class="fw-env">${ENVELOPE}</div><div class="fw-plabel"></div></div>` +
      `<div class="fw-sitebox">${SITE(siteName)}</div>` +
      `</div><div class="fw-vignette"></div>`

    const $ = <E extends Element = HTMLElement>(s: string): E => root.querySelector<E>(s)!
    const scene = $('.fw-scene')
    const paths = {
      plane: $<SVGPathElement>('.fw-path-plane'),
      loop: $<SVGPathElement>('.fw-path-loop'),
      visit: $<SVGPathElement>('.fw-path-visit'),
      deploy: $<SVGPathElement>('.fw-path-deploy'),
    }
    const crowdPaths = [...root.querySelectorAll<SVGPathElement>('.fw-path-crowd')]
    const lenOf = (p: SVGPathElement): number => (typeof p.getTotalLength === 'function' ? p.getTotalLength() : 1000)
    const lens = { plane: lenOf(paths.plane), loop: lenOf(paths.loop), visit: lenOf(paths.visit), deploy: lenOf(paths.deploy), crowd: crowdPaths.map(lenOf) }
    /** 路徑上 t(0–1)的位置與切線角度(度) */
    const along = (p: SVGPathElement, len: number, t: number): { x: number; y: number; ang: number } => {
      if (typeof p.getPointAtLength !== 'function') return { x: 0, y: 0, ang: 0 }
      const a = p.getPointAtLength(kit.clamp(t) * len)
      const b = p.getPointAtLength(kit.clamp(t + 0.01) * len)
      return { x: a.x, y: a.y, ang: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI }
    }
    const setPath = (p: SVGPathElement, draw: number, op: number): void => {
      kit.css(p, { ...kit.drawPath(draw, p === paths.plane ? lens.plane : p === paths.loop ? lens.loop : p === paths.visit ? lens.visit : lens.deploy), opacity: op.toFixed(3) })
    }

    const server = $('.fw-server')
    const sign = $('.fw-sign')
    const neon = $('.fw-neon')
    const srvWins = [...root.querySelectorAll<HTMLElement>('.fw-srv-body > i')]
    const srvLamp = $('.fw-srv-lamp')
    const srvSite = $('.fw-srv-site')
    const devs = [...root.querySelectorAll<HTMLElement>('.fw-dev')]
    const desk = $('.fw-desk')
    const laptop = $('.fw-laptop')
    const screen = $('.fw-screen')
    const term = $('.fw-term')
    const tCmd = $('.fw-t-cmd')
    const tCaret = $('.fw-t-caret')
    const tOut1 = $('.fw-t-out1')
    const tOut2 = $('.fw-t-out2')
    const tUrl = $('.fw-t-url')
    const tStop = $('.fw-t-stop')
    const brw = $('.fw-brw')
    const brwBlocks = [...brw.querySelectorAll<HTMLElement>('.fw-site > div')]
    const keycap = $('.fw-keycap')
    const house = $('.fw-house')
    const frame = house.querySelector<HTMLElement>('.fw-frame')!
    const frameSite = frame.querySelector<HTMLElement>('.fw-site')!
    const frameOff = $('.fw-frame-off')
    const hwindow = $('.fw-window')
    const doorMain = house.querySelector<HTMLElement>('.fw-door-main')!
    const doorsMore = [...house.querySelectorAll<HTMLElement>('.fw-door-more')]
    const phone = $('.fw-phone')
    const chatMsg = $('.fw-chat-msg')
    const chat = $('.fw-chat')
    const sheet = $('.fw-sheet')
    const sheetUrl = $('.fw-sheet-url')
    const sheetCaret = $('.fw-sheet-caret')
    const sheetLoading = $('.fw-sheet-loading')
    const dots = $('.fw-dots')
    const sheetSite = $('.fw-sheet-site')
    const sheetSiteBlocks = [...sheetSite.querySelectorAll<HTMLElement>('.fw-site > div')]
    const sheetErr = $('.fw-sheet-err')
    const errText = $('.fw-err-text')
    const phouse = $('.fw-phouse')
    const bubble = $('.fw-bubble')
    const plane = $('.fw-plane')
    const packet = $('.fw-packet')
    const plabel = $('.fw-plabel')
    const sitebox = $('.fw-sitebox')

    const place = (el: HTMLElement, x: number, y: number, ang = 0, scale = 1, op = 1): void =>
      kit.css(el, { display: op <= 0 ? 'none' : '', left: `${x.toFixed(1)}px`, top: `${y.toFixed(1)}px`, opacity: op.toFixed(3), transform: `translate(-50%, -50%) rotate(${ang.toFixed(1)}deg) scale(${scale.toFixed(3)})` })

    return {
      render(frame_, ms) {
        const view = frame_.view
        if (!view) return
        const ev = view.ev
        const kind = ev ? kindIn(ev.kind, ev.step) : null
        // 腳本用 ms 指定這一步的長度(例如配合旁白)時,整段動作依比例放慢或加快:
        // 動畫的時間表都以原本的長度(durationOf)寫成,這裡把實際經過的時間換算回原本的時間軸
        const natural = kind && ev ? durationOf(kind, ev.step as WorldStep, view.prev) : 0
        const scale = natural > 0 && ev && ev.dur > 0 ? natural / ev.dur : 1
        const l = (ev?.local ?? 0) * scale
        const dur = natural || (ev?.dur ?? 1)
        const st = ev?.kind === 'hide' ? view.prev : view.state
        const prev = view.prev
        const P = (start: number, d: number): number => kit.progress(l, start, d)
        const E = (start: number, d: number): number => kit.ease.inOutCubic(P(start, d))
        /** 布林狀態的過場:這個動作正在切換它時 0→1(或 1→0),否則照狀態 */
        const flip = (k: Kind, now: boolean, was: boolean, start: number, d: number): number => (kind === k && now !== was ? (now ? E(start, d) : 1 - E(start, d)) : now ? 1 : 0)

        // ---- 推軌 ----
        const dA = dollyOf(prev)
        const dB = dollyOf(st)
        const dp = kind ? E(0, dollyMs(dur)) : 1
        const z = kit.lerp(dA.z, dB.z, dp)
        const cx = kit.lerp(dA.x, dB.x, dp)
        const cy = kit.lerp(dA.y, dB.y, dp)
        kit.css(scene, { transform: `translate(${(960 - cx * z).toFixed(1)}px, ${(540 - cy * z).toFixed(1)}px) scale(${z.toFixed(4)})` })

        // ---- 筆電螢幕:終端機與瀏覽器 ----
        const booting = kind === 'boot'
        const termOn = st.screen !== 'desktop'
        kit.setIf(term, 'opacity', (booting ? P(0, 300) : termOn ? 1 : 0).toFixed(3))
        const cmd = booting ? kit.typewriter('npm run dev', l, { start: T.bootType, cps: CPS }) : { text: termOn ? 'npm run dev' : '', done: true }
        kit.setIf(tCmd, 'text', cmd.text)
        kit.setIf(tCaret, 'opacity', booting && !cmd.done && kit.blink(ms) ? '1' : '0')
        const out1 = booting ? l >= T.bootOut1 : termOn && (st.dev || st.stopped)
        const out2 = booting ? l >= T.bootOut2 : out1
        kit.setIf(tOut1, 'text', out1 ? '  VITE v6.0  ready in 320 ms' : '')
        kit.setIf(tOut2, 'text', out2 ? '  ➜  Local:   ' : '')
        kit.setIf(tUrl, 'text', out2 ? `http://localhost:${port}/` : '')
        kit.css(tUrl, { opacity: (booting ? kit.ease.outCubic(P(T.bootOut2, 400)) : out2 ? 1 : 0).toFixed(3) })
        const stopping = kind === 'stop'
        kit.setIf(tStop, 'text', stopping ? (l >= T.stopPress ? '^C' : '') : st.stopped ? '^C' : '')
        // 瀏覽器視窗從螢幕下方滑上來,網站一塊塊畫出
        const opening = kind === 'open'
        const brwOn = st.screen === 'browser'
        const slide = opening ? kit.ease.outCubic(P(0, T.openSlide)) : brwOn ? 1 : 0
        kit.css(brw, { opacity: slide > 0 ? '1' : '0', transform: `translateY(${((1 - slide) * 110).toFixed(2)}%)` })
        brwBlocks.forEach((el, i) => {
          const q = opening ? kit.ease.outCubic(P(T.openSlide + 150 + i * 320, 450)) : 1
          kit.css(el, { opacity: q.toFixed(3), transform: `translateY(${((1 - q) * 12).toFixed(2)}px)` })
        })
        // 螢幕亮度:網站停了之後瀏覽器暗一點
        screen.classList.toggle('dim', !st.dev && st.stopped)

        // ---- 小房間(筆電 ↔ 房間) ----
        const rv = flip('reveal', st.reveal, prev.reveal, 0, 1200)
        kit.css(laptop, { opacity: (1 - rv).toFixed(3), transform: `scale(${kit.lerp(1, 1.12, rv).toFixed(3)})`, visibility: rv >= 1 ? 'hidden' : 'visible' })
        kit.css(house, { opacity: rv.toFixed(3), transform: `scale(${kit.lerp(0.72, 1, kit.ease.outBack(rv)).toFixed(3)})`, visibility: rv <= 0 ? 'hidden' : 'visible' })
        // 房裡的燈:開發伺服器在跑才亮;按 Ctrl+C 時慢慢暗掉
        const lit = stopping ? 1 - E(T.stopPress, 1000) : st.dev ? 1 : 0
        house.classList.toggle('lit', lit > 0.5)
        kit.css(hwindow, { opacity: (0.25 + lit * 0.75).toFixed(3) })
        kit.css(frameSite, { opacity: (0.15 + lit * 0.85).toFixed(3), filter: `saturate(${lit.toFixed(2)})` })
        kit.css(frameOff, { opacity: (1 - lit).toFixed(3) })
        const dr = flip('doors', st.doors, prev.doors, 0, 900)
        doorsMore.forEach((el, i) => {
          const q = kind === 'doors' ? kit.ease.outBack(kit.progress(dr, i * 0.25, 0.75)) : dr
          kit.css(el, { opacity: kit.clamp(q).toFixed(3), transform: `translateY(${((1 - kit.clamp(q)) * 18).toFixed(1)}px)` })
        })
        doorMain.classList.toggle('glow', kind === 'doors' || kind === 'reveal')
        // 按鍵提示
        const kc = stopping ? Math.min(P(T.stopKey, 200), 1 - P(T.stop - 500, 300)) : 0
        kit.css(keycap, { opacity: kc.toFixed(3), transform: `translate(-50%, 0) scale(${kit.lerp(0.9, 1, kc).toFixed(3)})` })

        // ---- 朋友的小房間 ----
        const pk = flip('peek', st.peek, prev.peek, 0, 1000)
        kit.css(phouse, { opacity: pk.toFixed(3), transform: `scale(${kit.lerp(0.75, 1, kit.ease.outBack(pk)).toFixed(3)})`, visibility: pk <= 0 ? 'hidden' : 'visible' })

        // ---- 傳訊息:泡泡、紙飛機、手機上的訊息 ----
        const sending = kind === 'send'
        const msg = st.chat ?? ''
        const bb = sending ? Math.min(kit.ease.outBack(P(T.sendBubble, 400)), 1 - P(T.planeFrom + 300, 400)) : 0
        kit.setIf(bubble, 'text', msg)
        kit.css(bubble, { opacity: kit.clamp(bb).toFixed(3), transform: `translate(-50%, ${((1 - kit.clamp(bb)) * 14).toFixed(1)}px) scale(${kit.lerp(0.85, 1, kit.clamp(bb)).toFixed(3)})` })
        const fly = sending ? P(T.planeFrom, T.planeDur) : 0
        if (sending && fly > 0 && fly < 1) {
          const t = kit.ease.inOutCubic(fly)
          const q = along(paths.plane, lens.plane, t)
          place(plane, q.x, q.y, q.ang, 1, Math.min(P(T.planeFrom, 200), 1 - kit.progress(fly, 0.9, 0.1)))
          setPath(paths.plane, t, 0.5 * (1 - kit.progress(fly, 0.85, 0.15)))
        } else {
          place(plane, 0, 0, 0, 1, 0)
          setPath(paths.plane, 0, 0)
        }
        const chatIn = sending ? kit.ease.outCubic(P(T.planeFrom + T.planeDur - 150, 400)) : st.chat ? 1 : 0
        kit.setIf(chatMsg, 'text', msg)
        kit.css(chat, { opacity: chatIn > 0 ? '1' : '0' })
        kit.css(chatMsg, { opacity: chatIn.toFixed(3), transform: `translateY(${((1 - chatIn) * 10).toFixed(1)}px) scale(${kit.lerp(0.9, 1, chatIn).toFixed(3)})` })

        // ---- 朋友打開網址 ----
        const visiting = kind === 'visit'
        const v = st.visit
        const typeStart = T.visitSheet + T.visitType
        const typed = v ? (visiting ? kit.typewriter(v.url, l, { start: typeStart, cps: CPS }) : { text: v.url, done: true }) : { text: '', done: true }
        const goAt = v ? typeStart + kit.typeDuration(v.url, CPS) + 400 : 0
        const sheetUp = visiting ? kit.ease.outCubic(P(0, T.visitSheet)) : v ? 1 : 0
        kit.css(sheet, { transform: `translateY(${((1 - sheetUp) * 105).toFixed(2)}%)`, opacity: sheetUp > 0 ? '1' : '0' })
        kit.setIf(sheetUrl, 'text', typed.text)
        kit.setIf(sheetCaret, 'opacity', visiting && l >= T.visitSheet && l < goAt && kit.blink(ms) ? '1' : '0')
        // 結果什麼時候揭曉
        let resultAt = goAt + T.loopDur + 150
        if (v && v.host === 'domain' && v.result === 'site') resultAt = goAt + T.hopDur + T.serverThink + T.hopDur + 100
        if (v && v.host === 'domain' && v.result === 'down') resultAt = goAt + T.hopDur + 900
        const resolved = !visiting || l >= resultAt
        const loadingOn = visiting && l >= goAt && !resolved
        kit.css(sheetLoading, { opacity: loadingOn ? '1' : '0' })
        kit.setIf(dots, 'text', kit.dots(l, 350))
        const showSite = !!v && v.result === 'site' && resolved
        const showErr = !!v && v.result !== 'site' && resolved
        kit.css(sheetSite, { opacity: showSite ? '1' : '0' })
        sheetSiteBlocks.forEach((el, i) => {
          const q = visiting && showSite ? kit.ease.outCubic(P(resultAt + 100 + i * 300, 400)) : 1
          kit.css(el, { opacity: q.toFixed(3), transform: `translateY(${((1 - q) * 10).toFixed(1)}px)` })
        })
        const errIn = visiting && showErr ? kit.ease.outCubic(P(resultAt, 350)) : showErr ? 1 : 0
        kit.css(sheetErr, { opacity: errIn.toFixed(3), transform: `scale(${kit.lerp(0.9, 1, errIn).toFixed(3)})` })
        kit.setIf(errText, 'text', v ? (v.host === 'local' ? `${v.name} 找的是這支手機自己，裡面沒有網站。` : v.result === 'down' ? `${v.name} 沒有回應。` : `找不到 ${v.name}。`) : '')
        const shakeX = visiting && showErr ? kit.shake(l, resultAt, 500, 9, 4) : 0
        kit.css(phone, { transform: `translateX(${shakeX.toFixed(2)}px)` })
        // 信:繞一圈回到自己 / 飛到伺服器再回來
        let packetOn = false
        if (visiting && v && l >= goAt) {
          if (v.host === 'local' || v.result === 'fail') {
            const t = kit.ease.inOutCubic(P(goAt, T.loopDur))
            if (t < 1) {
              const q = along(paths.loop, lens.loop, t)
              packetOn = true
              packet.dataset.tone = t > 0.8 ? 'bad' : 'ask'
              kit.setIf(plabel, 'text', t > 0.8 ? '這裡沒有網站' : v.host === 'local' ? `${v.url.replace(/^https?:\/\//, '')} 在哪？` : `${v.name} 在哪？`)
              place(packet, q.x, q.y, 0, 1, Math.min(P(goAt, 200), 1 - kit.progress(t, 0.93, 0.07)))
              setPath(paths.loop, t, 0.75)
            } else setPath(paths.loop, 1, 0)
          } else {
            const go = kit.ease.inOutCubic(P(goAt, T.hopDur))
            const backAt = goAt + T.hopDur + T.serverThink
            const back = kit.ease.inOutCubic(P(backAt, T.hopDur))
            if (go < 1) {
              const q = along(paths.visit, lens.visit, go)
              packetOn = true
              packet.dataset.tone = 'ask'
              kit.setIf(plabel, 'text', `GET ${domain}`)
              place(packet, q.x, q.y, 0, 1, Math.min(P(goAt, 200), 1 - kit.progress(go, 0.94, 0.06)))
              setPath(paths.visit, go, 0.75)
            } else if (v.result === 'down') {
              // 伺服器關機:信在門口晃一下,掉下來
              const dropP = P(goAt + T.hopDur, 900)
              if (dropP < 1) {
                const q = along(paths.visit, lens.visit, 0.97)
                packetOn = true
                packet.dataset.tone = 'bad'
                kit.setIf(plabel, 'text', '沒有回應')
                place(packet, q.x + kit.shake(l, goAt + T.hopDur, 500, 8, 5), q.y + kit.ease.inQuad(dropP) * 120, kit.ease.inQuad(dropP) * 30, 1, 1 - kit.progress(dropP, 0.6, 0.4))
              }
              setPath(paths.visit, 1, 0.4 * (1 - dropP))
            } else if (l >= backAt && back < 1) {
              const q = along(paths.visit, lens.visit, 1 - back)
              packetOn = true
              packet.dataset.tone = 'ok'
              kit.setIf(plabel, 'text', '200 OK · index.html')
              place(packet, q.x, q.y, 0, 1, Math.min(P(backAt, 200), 1 - kit.progress(back, 0.94, 0.06)))
              setPath(paths.visit, 1, 0.75)
            } else setPath(paths.visit, 1, l >= backAt ? 0 : 0.4)
          }
        } else {
          setPath(paths.loop, 0, 0)
          setPath(paths.visit, 0, 0)
        }
        if (!packetOn) kit.setIf(packet, 'display', 'none')
        // 伺服器收到請求時燈快閃
        const thinking = visiting && !!v && v.host === 'domain' && v.result === 'site' && l >= goAt + T.hopDur && l < goAt + T.hopDur + T.serverThink + 200

        // ---- 上線:網站從房間飛進大樓 ----
        const deploying = kind === 'deploy'
        const fp = deploying ? kit.ease.inOutCubic(P(0, T.deployFly)) : 0
        if (deploying && fp < 1) {
          const q = along(paths.deploy, lens.deploy, fp)
          place(sitebox, q.x, q.y, 0, kit.lerp(1, 0.45, fp), Math.min(P(0, 250), 1 - kit.progress(fp, 0.93, 0.07)))
          setPath(paths.deploy, fp, 0.75)
        } else {
          place(sitebox, 0, 0, 0, 1, 0)
          setPath(paths.deploy, 1, deploying ? 0.75 * (1 - P(T.deployFly, 500)) : 0)
        }
        // 房間裡的網站在起飛時留下虛影
        frame.classList.toggle('moved', st.deployed && !(deploying && l < 200))
        const dep = deploying ? kit.ease.outCubic(P(T.deployFly - 100, 700)) : st.deployed ? 1 : 0
        kit.css(srvSite, { opacity: dep.toFixed(3), transform: `scale(${kit.lerp(0.6, 1, dep).toFixed(3)})` })
        const signOn = st.deployed ? (deploying ? kit.ease.outCubic(P(T.deployFly + 200, 600)) : 1) : 0

        // ---- 伺服器:燈光 ----
        const pw = flip('power', st.server, prev.server, 0, 800)
        server.classList.toggle('off', pw < 0.5)
        srvWins.forEach((el, i) => {
          const base = i % 3 === 1 ? 0.95 : 0.6
          const flick = thinking ? (Math.floor(ms / 90 + i) % 2 ? 1 : 0.2) : 1
          kit.setIf(el, 'opacity', (pw * base * flick).toFixed(3))
        })
        kit.setIf(srvLamp, 'opacity', (pw * (thinking ? (Math.floor(ms / 120) % 2 ? 1 : 0.3) : 0.6 + 0.4 * kit.pulse(ms, 2200))).toFixed(3))
        kit.css(sign, { opacity: (0.25 + signOn * 0.75).toFixed(3) })
        sign.classList.toggle('on', signOn > 0.5 && pw > 0.5)
        kit.css(neon, { opacity: (signOn * pw * (0.85 + 0.15 * kit.pulse(ms, 1600))).toFixed(3) })

        // ---- 城裡的裝置亮起 ----
        const cr = flip('crowd', st.crowd, prev.crowd, 0, 1800)
        devs.forEach((el, i) => {
          const q = kind === 'crowd' ? kit.ease.outCubic(kit.progress(cr, i * 0.16, 0.36)) : cr
          kit.css(el, { opacity: kit.clamp(q).toFixed(3), transform: `translateY(${((1 - kit.clamp(q)) * 16).toFixed(1)}px)` })
          // 伺服器關機時,大家的螢幕一起暗掉
          kit.css(el.firstElementChild as HTMLElement, { opacity: (0.08 + 0.92 * pw).toFixed(3) })
          const cp = crowdPaths[i]
          if (cp) kit.css(cp, { ...kit.drawPath(kind === 'crowd' ? kit.clamp(kit.progress(cr, i * 0.16, 0.3)) : cr, lens.crowd[i]), opacity: (kit.clamp(q) * 0.5).toFixed(3) })
        })

        // 書桌的燈:房間打開時暗下來讓位
        kit.css(desk, { opacity: (1 - rv * 0.5).toFixed(3) })
      },

      target(name) {
        switch (name) {
          case 'window': return root
          case 'laptop': return laptop
          case 'screen': return screen
          case 'terminal': return term
          case 'url': return tUrl
          case 'phone': return phone
          case 'house': return house
          case 'door': return doorMain
          case 'server': return server
          case 'sign': return sign
        }
        return null
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
