// 演員 agent-office:「AI Agent 是什麼」的場景(研發基地試作,不進公開 bundle;登記在 ../../registerActors.ts)。
// 明亮的辦公室,左邊是大片窗戶的日光;白色的人形機器人坐在桌前操作電腦,穿西裝、留鬍子的人站在旁邊看螢幕,
// 四周浮著青藍色的全息面板(計畫、權限、工作紀錄、圖表)。要演的是:你只說一次需求、按一下允許,其餘都是它自己在電腦上動手。
// 兩種構圖由狀態決定、用推軌接起來(不硬切):要人參與的時候(說需求、問允許、完成)是兩個人的全景;
// 它自己動手的時候(build、check、fix)推近到機器人、鍵盤上方的全息程式碼面板與螢幕,旁邊的人變成糊掉的前景。
// 文字都是真的 DOM;所有動畫由 render 依時間算出(SPEC 第 1 節:不用 CSS transition/animation、不用 Math.random)。
// place 用 "full"(1920×1080 橫式)。
//
// props:
//   site     網站名稱;預設 "小森烘焙"
//
// 動作(操作式;對不上狀態時載入就報錯;任何一步都可以寫 ms 指定長度,整段動畫依比例放慢或加快):
//   { "need": "需求" }         旁邊的人說出需求(全息對話框逐字出現、聲波跳動),機器人轉頭聽、眼睛脈動(只能說一次)
//   { "plan": true }           全息面板展開步驟:建立檔案 → 寫內容 → 開瀏覽器檢查 → 修改(要先 need)
//   { "ask": "建立 index.html" } 浮出權限面板「可以建立 index.html 嗎？ 允許 / 拒絕」,機器人轉向人等回答
//                              (要先 plan;上一個問題還沒回答時不能再問)
//   { "allow": true | false }  回答權限:true 面板變綠、機器人點頭轉回螢幕;false 面板顯示「已拒絕」,
//                              機器人停下來低頭(之後可以用新的 ask 換個方式再問)
//   { "build": true }          推近:機器人打字,鍵盤上方的全息面板與螢幕上的編輯器串流出程式碼,右邊的預覽一塊塊長出網站
//                              (還沒有樣式),工作紀錄同步(要先有被允許的 ask)
//   { "check": true }          螢幕換成整頁瀏覽器,掃描光掃過網頁,框出問題:「少了樣式」(要先 build)
//   { "fix": true }            機器人寫 style.css,網站由上往下換上顏色與排版(要先 check)
//   { "done": true }           拉回全景,機器人轉向人回報完成,人點點頭,面板收好(要先 fix)
//
// 目標:window、robot、head、human、monitor、screen、code、plan、need、ask、allow、deny、dash、issue
import { kit } from '../../kit'
import { defineActor, type CommonStepFields, type Hotspot } from '../../types'
import type { Pt } from '../../art/geometry'
import { manSvg, robotSvg } from '../../art/characters'
import { deskSvg } from '../../art/office'
import { fx } from '../../art/dom'
import { flag, frameClock, makeKindIn, yes } from '../../art/actorKit'
import { layerMarkup, mountBackdrop, mountOffice, officeMarkup, renderBackdrop, renderBars, renderDecoLines, renderLayers, renderWave } from '../../art/backdrop'
import { agentWindowMarkup, browserMarkup, dashMarkup, decoMarkup, needMarkup } from '../../art/panels'
import { WIDE_CAM, closeness, handheld, lerpCam, type Cam } from '../../art/fx/camera'
import { codeHoloMarkup, codeHtml, streamed, totalChars } from '../../art/fx/codeStream'
import { renderHolo } from '../../art/fx/hologram'
import { askMarkup, mountAsk, renderAsk, type AskView } from '../../art/fx/permission'
import { mountProgress, progressMarkup, renderProgress } from '../../art/fx/progress'
import { botBlink, mixLook, mountBotArms, mountBotRig, renderBotArms, renderBotRig, type BotLook } from '../../art/robotRig'
import { mountManFace, renderManFace } from '../../art/manRig'
import { ARM, ART, BOT, MAN, onKb } from './layout'
import './actor.css'

// ---------- 型別 ----------
export interface OfficeProps {
  site?: string
}
export const KINDS = ['need', 'plan', 'ask', 'allow', 'build', 'check', 'fix', 'done'] as const
export type Kind = (typeof KINDS)[number]
export type OfficeStep = CommonStepFields & {
  need?: string
  plan?: true
  ask?: string
  allow?: boolean
  build?: true
  check?: true
  fix?: true
  done?: true
}
export type Target = 'window' | 'robot' | 'head' | 'human' | 'monitor' | 'screen' | 'code' | 'plan' | 'need' | 'ask' | 'allow' | 'deny' | 'dash' | 'issue'

export type AskStatus = 'pending' | 'allowed' | 'denied'
export interface OfficeState {
  need: string | null
  plan: boolean
  /** 最近一次的權限問題;n 是第幾次問 */
  ask: { text: string; status: AskStatus; n: number } | null
  built: boolean
  checked: boolean
  fixed: boolean
  done: boolean
  temp: Record<string, never>
}

// ---------- 時間表(毫秒,相對動作開始) ----------
export const T = {
  needIn: 1100, needTail: 1700, needCps: 14,
  plan: 4400, planOpen: 300, planStep0: 1100, planStepGap: 420,
  askIn: 1800, askCps: 20,
  allowYes: 1800, allowNo: 2800, press: 220,
  build: 9000, buildCode: 700, buildCodeEnd: 6600, buildFile: 1200,
  check: 5200, checkWiden: 900, scan: 1100, scanDur: 1600, found: 2800,
  fix: 6500, fixCode: 600, fixCodeEnd: 4400, wipe: 1600, wipeDur: 4000,
  done: 3400,
}

const DEFAULT_NEED = '幫我做小森烘焙的一頁式網站，要有菜單和地址。'
const ALT_ASK = '只在「小森烘焙」資料夾裡建立 index.html，不動其他檔案'
export const PLAN_STEPS = ['建立檔案', '寫內容', '開瀏覽器檢查', '修改'] as const

/** 權限問題的完整句子:「建立 index.html」→「可以建立 index.html 嗎？」 */
export const questionOf = (text: string): string => {
  const t = text.trim()
  if (/[？?]$/.test(t)) return t
  return `可以${t}${/[\x21-\x7e]$/.test(t) ? ' ' : ''}嗎？`
}

export function apply(st: OfficeState, kind: Kind, s: OfficeStep): OfficeState {
  switch (kind) {
    case 'need':
      if (typeof s.need !== 'string' || !s.need.trim()) throw new Error('need 要寫需求(字串)')
      if (st.need) throw new Error('need:需求已經說過了,只要說一次')
      return { ...st, need: s.need.trim() }
    case 'plan':
      yes(s.plan, 'plan')
      if (!st.need) throw new Error('plan:還沒有需求,先 need')
      if (st.plan) throw new Error('plan:已經規劃過了')
      return { ...st, plan: true }
    case 'ask':
      if (typeof s.ask !== 'string' || !s.ask.trim()) throw new Error('ask 要寫要做的事(字串),例如 "建立 index.html"')
      if (!st.plan) throw new Error('ask:先 plan,想好步驟再問')
      if (st.ask?.status === 'pending') throw new Error('ask:上一個問題還沒回答,先 allow')
      return { ...st, ask: { text: s.ask.trim(), status: 'pending', n: (st.ask?.n ?? 0) + 1 } }
    case 'allow': {
      const v = flag(s.allow, 'allow')
      if (st.ask?.status !== 'pending') throw new Error('allow:現在沒有等待回答的問題,先 ask')
      return { ...st, ask: { ...st.ask, status: v ? 'allowed' : 'denied' } }
    }
    case 'build':
      yes(s.build, 'build')
      if (st.built) throw new Error('build:已經做過了')
      if (st.ask?.status !== 'allowed') throw new Error('build:還沒得到允許,先 ask 再 allow: true')
      return { ...st, built: true }
    case 'check':
      yes(s.check, 'check')
      if (!st.built) throw new Error('check:還沒有東西可以檢查,先 build')
      if (st.checked) throw new Error('check:已經檢查過了')
      return { ...st, checked: true }
    case 'fix':
      yes(s.fix, 'fix')
      if (!st.checked) throw new Error('fix:先 check 找出問題')
      if (st.fixed) throw new Error('fix:已經修好了')
      return { ...st, fixed: true }
    case 'done':
      yes(s.done, 'done')
      if (!st.fixed) throw new Error('done:還沒修改完,先 fix')
      if (st.done) throw new Error('done:已經完成了')
      return { ...st, done: true }
  }
}

export const kindIn = makeKindIn(KINDS)

export function durationOf(kind: Kind, s: OfficeStep): number {
  switch (kind) {
    case 'need': return T.needIn + kit.typeDuration(s.need ?? '', T.needCps) + T.needTail
    case 'plan': return T.plan
    case 'ask': return T.askIn + kit.typeDuration(questionOf(s.ask ?? ''), T.askCps)
    case 'allow': return s.allow ? T.allowYes : T.allowNo
    case 'build': return T.build
    case 'check': return T.check
    case 'fix': return T.fix
    case 'done': return T.done
  }
}

// ---------- 鏡頭 ----------
const WIDE: Cam = WIDE_CAM
/** 推軌由狀態決定:它自己動手的時候推近(檢查時再近一點看螢幕),完成後拉回兩個人的全景 */
export const dollyOf = (st: OfficeState): Cam => {
  if (!st.built || st.done) return WIDE
  if (st.checked && !st.fixed) return { x: 770, y: 470, z: 1.32 }
  return { x: 870, y: 505, z: 1.22 }
}

// ---------- 視線(頭的方向) ----------
/** yaw:0 面向鏡頭、負的往左(螢幕)、正的往右(人);pitch 正的低頭;tilt 歪頭(度) */
const LOOK = {
  monitor: { yaw: -0.98, pitch: 0.02, tilt: 0 },
  human: { yaw: 0.44, pitch: -0.05, tilt: 3 },
  plan: { yaw: -0.72, pitch: -0.14, tilt: -2 },
  down: { yaw: 0.28, pitch: 0.12, tilt: -5 },
}
const restLook = (st: OfficeState): BotLook => {
  if (st.done) return LOOK.human
  if (st.built || st.ask?.status === 'allowed') return LOOK.monitor
  if (st.ask?.status === 'pending') return LOOK.human
  if (st.ask?.status === 'denied') return LOOK.down
  if (st.plan) return LOOK.plan
  if (st.need) return LOOK.human
  return LOOK.monitor
}

// ---------- 網站與程式碼 ----------
const htmlLines = (site: string): string[] => [
  '<!DOCTYPE html>',
  '<html lang="zh-Hant">',
  '<head>',
  '  <meta charset="utf-8">',
  `  <title>${site}</title>`,
  '  <link rel="stylesheet" href="style.css">',
  '</head>',
  '<body>',
  `  <nav>${site} · 菜單 · 地址</nav>`,
  `  <h1>${site}</h1>`,
  '  <p>每天現烤的麵包與甜點</p>',
  '  <h2>今日菜單</h2>',
  '  <ul>',
  '    <li>可頌 NT$65</li>',
  '    <li>肉桂捲 NT$80</li>',
  '    <li>鄉村麵包 NT$120</li>',
  '  </ul>',
  '  <footer>台北市大安區森林路 12 號</footer>',
  '</body>',
  '</html>',
]
/** 預覽裡每一塊(nav、h1、p、h2、三個 li、footer)在第幾行寫完時出現 */
const RAW_AT = [8, 9, 10, 11, 13, 14, 15, 17]
const CSS_LINES = [
  '/* style.css */',
  'body { margin: 0; font-family: "Noto Sans TC";',
  '       background: #fff8ef; }',
  'nav { display: flex; gap: 24px; padding: 12px 28px;',
  '      background: #5a3a22; color: #fff; }',
  'h1 { font-size: 44px; color: #5a3a22; }',
  'h1, p { text-align: center; }',
  'ul { display: grid; gap: 12px;',
  '     grid-template-columns: repeat(3, 1fr); }',
  'li { padding: 14px; border-radius: 12px;',
  '     background: #fff; list-style: none; }',
  'footer { padding: 14px 28px; background: #2f2a26; }',
]

const SITE_RAW = (site: string): string =>
  `<div class="ao-raw">` +
  `<div class="ao-rb"><u>${kit.esc(site)}</u> · <u>菜單</u> · <u>地址</u></div>` +
  `<div class="ao-rb ao-rh1">${kit.esc(site)}</div>` +
  `<div class="ao-rb">每天現烤的麵包與甜點</div>` +
  `<div class="ao-rb ao-rh2">今日菜單</div>` +
  `<div class="ao-rb ao-rli">可頌 NT$65</div><div class="ao-rb ao-rli">肉桂捲 NT$80</div><div class="ao-rb ao-rli">鄉村麵包 NT$120</div>` +
  `<div class="ao-rb">台北市大安區森林路 12 號</div>` +
  `</div>`
const SITE_STYLED = (site: string): string =>
  `<div class="ao-styled">` +
  `<div class="ao-sn"><b>${kit.esc(site)}</b><span>菜單</span><span>地址</span></div>` +
  `<div class="ao-shero"><div class="ao-sh1">${kit.esc(site)}</div><div class="ao-sp">每天現烤的麵包與甜點</div><span class="ao-sbtn">看菜單</span></div>` +
  `<div class="ao-smenu">` +
  [
    ['可頌', 'NT$65', 'c1'],
    ['肉桂捲', 'NT$80', 'c2'],
    ['鄉村麵包', 'NT$120', 'c3'],
  ]
    .map(([n, p, c]) => `<div class="ao-scard"><i class="ao-bread ${c}"></i><b>${n}</b><span>${p}</span></div>`)
    .join('') +
  `</div>` +
  `<div class="ao-sfoot">台北市大安區森林路 12 號 · 08:00–19:00</div>` +
  `</div>`

// ---------- 工作紀錄 ----------
type LogLine = { kind: Kind; at: number; text: string; tone?: 'ok' | 'warn' }
const LOG = (n: number): LogLine[] => [
  { kind: 'build', at: 400, text: '建立 index.html' },
  { kind: 'build', at: T.buildCode + 200, text: '寫入網頁內容…' },
  { kind: 'build', at: T.build - 900, text: `index.html 寫好了（${n} 行）`, tone: 'ok' },
  { kind: 'check', at: 300, text: '打開瀏覽器檢查' },
  { kind: 'check', at: T.found + 100, text: '發現：沒有顏色，也沒有排版', tone: 'warn' },
  { kind: 'fix', at: 400, text: '新增 style.css' },
  { kind: 'fix', at: T.wipe + T.wipeDur - 200, text: '重新整理：版面正常', tone: 'ok' },
  { kind: 'done', at: 700, text: '完成，交給你看看', tone: 'ok' },
]
const ORDER: Kind[] = ['build', 'check', 'fix', 'done']
const stateHas = (st: OfficeState, k: Kind): boolean => (k === 'build' ? st.built : k === 'check' ? st.checked : k === 'fix' ? st.fixed : k === 'done' ? st.done : false)

const actor = defineActor<Kind, OfficeStep, OfficeProps, OfficeState, Target>({
  name: 'agent-office',
  kinds: KINDS,
  fixedSize: true,

  init() {
    return { need: null, plan: false, ask: null, built: false, checked: false, fixed: false, done: false, temp: {} }
  },
  apply,
  duration(kind, step) {
    return durationOf(kind, step)
  },
  autoFocus() {
    return undefined
  },

  hotspots(st): Hotspot<OfficeStep>[] {
    if (!st.need) return [{ target: 'human', label: '說出需求', step: { need: DEFAULT_NEED } }]
    if (!st.plan) return [{ target: 'robot', label: '請它規劃步驟', step: { plan: true } }]
    if (st.ask?.status === 'pending')
      return [
        { target: 'allow', label: '允許', step: { allow: true } },
        { target: 'deny', label: '拒絕', step: { allow: false } },
      ]
    if (!st.built) {
      if (st.ask?.status === 'allowed') return [{ target: 'monitor', label: '讓它動手做', step: { build: true } }]
      return [{ target: 'plan', label: st.ask ? '換個方式再問' : '請它開始（先問你）', step: { ask: st.ask ? ALT_ASK : '建立 index.html' } }]
    }
    if (!st.checked) return [{ target: 'monitor', label: '開瀏覽器檢查', step: { check: true } }]
    if (!st.fixed) return [{ target: 'issue', label: '修改', step: { fix: true } }]
    if (!st.done) return [{ target: 'human', label: '回報完成', step: { done: true } }]
    return []
  },

  mount(root, props) {
    const site = props.site ?? '小森烘焙'
    const HTML = htmlLines(site)
    const HTML_N = totalChars(HTML)
    const CSS_N = totalChars(CSS_LINES)
    const log = LOG(HTML.length)
    mountOffice(
      root,
      'agent-office',
      officeMarkup(
        ART,
        layerMarkup('ao-man', manSvg(ART)) +
          layerMarkup('ao-desk', deskSvg(ART)) +
          // 螢幕
          layerMarkup(
            'ao-monl',
            `<div class="art-mon"><div class="art-scr">` +
              // 代理人的對話畫面
              agentWindowMarkup(
                site,
                `<div class="art-m ao-m-you"><small>你</small><span class="ao-m-need"></span></div>` +
                  `<div class="art-m ao-m-ai ao-m-plan"><small>Agent</small><span>我會分四步完成：${PLAN_STEPS.join('、')}。</span></div>` +
                  `<div class="art-m ao-m-ai ao-m-ask"><small>Agent</small><span class="ao-m-asktext"></span></div>` +
                  `<div class="art-m ao-m-ai ao-m-res"><small>Agent</small><span class="ao-m-restext"></span></div>`,
              ) +
              // 編輯器 + 瀏覽器
              `<div class="art-work"><div class="art-edbox"><div class="art-tab"><span>index.html</span></div><div class="ao-code art-code"></div></div>` +
              browserMarkup(`${SITE_RAW(site)}${SITE_STYLED(site)}<div class="ao-wipe"></div><div class="ao-scan"></div><div class="ao-mark"><span>少了樣式</span></div>`) +
              `</div><div class="art-glare"></div></div></div>`,
          ) +
          // 機器人
          layerMarkup('ao-bot', robotSvg(ART)) +
          // 全息面板
          layerMarkup(
            'ao-holo',
            decoMarkup() +
              dashMarkup(`<div class="ao-dash-log">${progressMarkup(log, '工作紀錄')}</div>`) +
              `<div class="art-holo ao-plan"><div class="art-holo-title">計畫</div><div class="ao-plan-need"></div>` +
              `<ol>${PLAN_STEPS.map((s, i) => `<li><i class="ao-st"></i><span class="ao-st-n">${i + 1}</span><span class="ao-st-t">${s}</span><em class="ao-st-tag"></em></li>`).join('')}</ol></div>` +
              needMarkup() +
              `<div class="art-holo art-ask ao-ask">${askMarkup()}</div>` +
              `<div class="art-holo art-holo-warn ao-issue"><div class="art-holo-title">檢查結果</div><div class="ao-issue-t">少了樣式：沒有顏色，也沒有排版</div></div>` +
              `<div class="ao-kh">${codeHoloMarkup()}</div>`,
          ),
      ),
    )

    const $ = <E extends Element = HTMLElement>(s: string): E => root.querySelector<E>(s)!
    const $$ = <E extends Element = HTMLElement>(s: string, from: ParentNode = root): E[] => [...from.querySelectorAll<E>(s)]
    const back = mountBackdrop(root, ART.prefix)
    const layers = {
      room: back.room,
      rays: back.rays,
      man: $('.ao-man'),
      desk: $('.ao-desk'),
      monl: $('.ao-monl'),
      bot: $('.ao-bot'),
      holo: $('.ao-holo'),
      fore: back.fore,
    }
    const DEPTH: Record<keyof typeof layers, number> = { room: 0.45, rays: 0.7, man: 0.9, desk: 1, monl: 1, bot: 1, holo: 1.02, fore: 1.3 }
    // 機器人與人
    const rig = mountBotRig(root, ART.prefix)
    const botArms = mountBotArms(root, ART.prefix)
    const man = mountManFace(root, ART.prefix)
    // 螢幕
    const mon = $('.art-mon')
    const scr = $('.art-scr')
    const agent = $('.art-agent')
    const mNeed = $('.ao-m-need')
    const mYou = $('.ao-m-you')
    const mPlan = $('.ao-m-plan')
    const mAsk = $('.ao-m-ask')
    const mAskText = $('.ao-m-asktext')
    const mRes = $('.ao-m-res')
    const mResText = $('.ao-m-restext')
    const work = $('.art-work')
    const ed = $('.art-edbox')
    const code = $('.ao-code')
    const url = $('.art-url')
    const rawBlocks = $$('.ao-rb')
    const styled = $('.ao-styled')
    const wipe = $('.ao-wipe')
    const scan = $('.ao-scan')
    const mark = $('.ao-mark')
    // 全息面板
    const deco = $('.art-deco')
    const decoL1 = $<SVGPolylineElement>('.art-deco-l1')
    const decoL2 = $<SVGPolylineElement>('.art-deco-l2')
    const dash = $('.art-dash')
    const dashAmb = $('.art-dash-amb')
    const bars = $$('.art-bars i')
    const dashLog = $('.ao-dash-log')
    const progress = mountProgress(dash)
    const plan = $('.ao-plan')
    const planNeed = $('.ao-plan-need')
    const planLis = $$('.ao-plan li')
    const need = $('.art-need')
    const needText = $('.art-need-text')
    const wave = $$('.art-wave i')
    const askH = mountAsk($('.ao-ask'))
    const ask = askH.panel
    const btnAllow = askH.allow
    const btnDeny = askH.deny
    const issue = $('.ao-issue')
    const kh = $('.ao-kh')
    const khTab = $('.art-codeholo-tab')
    const khCode = $('.art-codeholo-code')

    return {
      render(frame_, ms) {
        const view = frame_.view
        if (!view) return
        const { kind, l, dur, st, prev, P, E, O, is } = frameClock(view, kindIn, (k, s) => durationOf(k, s as OfficeStep))

        // ---------- 鏡頭:推軌 + 手持的微晃 + 景深 ----------
        const dp = kind ? E(0, Math.min(dur, 1500)) : 1
        const cam = lerpCam(dollyOf(prev), dollyOf(st), dp)
        renderLayers(layers, DEPTH, cam, handheld(ms))
        const close = closeness(cam)
        kit.setIf(layers.man, 'filter', `blur(${fx(0.6 + close * 5.5, 1)}px) brightness(${fx(1 - close * 0.12, 2)})`)
        // 房間與前景的景深、窗光呼吸、灰塵飄、散景閃、底片顆粒
        renderBackdrop(back, close, ms)

        // ---------- 機器人:看哪裡 ----------
        let look = restLook(st)
        if (kind) {
          const turnStart = is('allow') && st.ask?.status === 'allowed' ? 700 : is('done') ? 300 : 0
          look = mixLook(restLook(prev), restLook(st), E(turnStart, 750))
        }
        // 點頭(允許時)、歪頭(發現問題時)
        if (is('allow') && st.ask?.status === 'allowed') look = { ...look, pitch: look.pitch + 0.14 * Math.sin(Math.PI * P(150, 600)) }
        if (is('check')) look = { ...look, tilt: look.tilt + 7 * Math.sin(Math.PI * P(T.found - 200, 1400)) }
        if (is('allow') && st.ask?.status === 'denied') look = { ...look, pitch: look.pitch + 0.04 * Math.sin(Math.PI * P(400, 900)) }
        // 眼睛:聽的時候脈動、被拒絕時變暗變琥珀色、偶爾眨眼
        const listening = is('need') || (!kind && !!st.need && !st.plan)
        const thinking = is('plan') || (is('check') && l > T.scan && l < T.found)
        const denied = st.ask?.status === 'denied' && !(is('ask'))
        const deniedP = is('allow') && denied ? O(300, 500) : denied ? 1 : 0
        let glow = 0.75 + 0.1 * kit.pulse(ms, 3000)
        if (listening) glow = 0.65 + 0.35 * kit.pulse(ms, 700)
        if (is('build') || is('fix')) glow = 0.85 + 0.15 * kit.pulse(ms, 420)
        glow *= 1 - 0.45 * deniedP
        renderBotRig(rig, BOT, {
          look,
          ms,
          glow,
          ear: listening ? kit.pulse(ms, 700) : kit.pulse(ms, 2600),
          core: 0.6 + 0.4 * kit.pulse(ms, is('build') || is('fix') ? 600 : 2400),
          eyeColor: deniedP > 0.5 ? '#ffd38a' : '#bdf3ff',
          eyeScale: botBlink(ms) * (1 - 0.35 * deniedP),
          scan: thinking ? 1 : 0,
          // 聽的時候頭外面一圈圈的光
          halo: listening ? (ms % 1400) / 1400 : null,
        })

        // ---------- 機器人:手 ----------
        const typingNow = (is('build') && l > 500 && l < T.buildCodeEnd + 600) || (is('fix') && l > 400 && l < T.fixCodeEnd + 500) || (is('check') && l > 200 && l < 900)
        const typing = typingNow ? Math.min(P(is('build') ? 500 : is('fix') ? 400 : 200, 300), 1 - P(is('build') ? T.buildCodeEnd + 300 : is('fix') ? T.fixCodeEnd + 200 : 700, 300)) : 0
        const homeN = onKb(0.8, 0.42)
        const homeF = onKb(0.32, 0.48)
        let tN: Pt = { x: homeN.x + kit.noise(ms / 240, 11) * 18 * typing, y: homeN.y + kit.noise(ms / 300, 12) * 6 * typing }
        const tF: Pt = { x: homeF.x + kit.noise(ms / 260, 13) * 16 * typing, y: homeF.y + kit.noise(ms / 320, 14) * 5 * typing }
        // 手勢:規劃時抬手指向面板;完成時攤手
        const lift = is('plan') ? Math.min(E(300, 700), 1 - E(3000, 900)) : is('done') ? Math.min(E(500, 700), 1 - E(2400, 800)) : 0
        if (lift > 0) {
          const g = is('plan') ? { x: 952, y: 690 } : { x: 966, y: 706 }
          tN = { x: kit.lerp(tN.x, g.x, lift), y: kit.lerp(tN.y, g.y, lift) }
        }
        renderBotArms(botArms, BOT, ARM, tN, tF, typing, typing * (1 - lift), ms)

        // ---------- 人 ----------
        const talking = is('need') && l > 300 && l < T.needIn + kit.typeDuration(st.need ?? '', T.needCps)
        let nod = 0
        if (is('done')) nod = 6 * Math.sin(Math.PI * 2 * P(1300, 1300)) * (1 - P(1300, 1300) * 0.4)
        if (is('allow') && st.ask?.status === 'allowed') nod = 4 * Math.sin(Math.PI * 2 * P(0, 700))
        const manTurn = is('need') ? 2 * Math.sin(Math.PI * P(0, dur)) : 0
        renderManFace(man, MAN.neck, ms, talking, nod - manTurn)

        // ---------- 全息:需求對話框 ----------
        const needStr = st.need ?? ''
        const needIn = is('need') ? P(150, 650) : st.need && !st.plan ? 1 : 0
        const needOut = is('plan') ? E(0, 600) : 0
        renderHolo(need, needIn, 11, 'translate(0, 0)', 1 - needOut)
        const typed = is('need') ? kit.typewriter(needStr, l, { start: 500, cps: T.needCps }).text : needStr
        kit.setIf(needText, 'text', typed)
        renderWave(wave, talking, ms)

        // ---------- 全息:計畫 ----------
        const planIn = is('plan') ? P(T.planOpen, 900) : st.plan ? 1 : 0
        const planSettle = st.done ? (is('done') ? E(1600, 1000) : 1) : 0
        renderHolo(plan, planIn, 23, `translate(${fx(-30 * close, 1)}px, ${fx(40 * close, 1)}px) scale(${fx(1 - 0.22 * close, 3)})`, 1 - planSettle * 0.25)
        kit.setIf(planNeed, 'text', needStr ? `「${needStr.length > 22 ? `${needStr.slice(0, 22)}…` : needStr}」` : '')
        // 每一步的狀態
        const stepState = (i: number): 'todo' | 'wait' | 'doing' | 'done' => {
          const s = st
          if (i === 0) {
            if (s.built) return is('build') && l < T.buildFile ? 'doing' : 'done'
            if (s.ask?.status === 'pending' || s.ask?.status === 'denied') return is('ask') && l < 400 ? 'todo' : 'wait'
            if (s.ask?.status === 'allowed') return 'doing'
            return 'todo'
          }
          if (i === 1) {
            if (!s.built) return 'todo'
            if (is('build')) return l < T.buildFile ? 'todo' : l < T.build - 400 ? 'doing' : 'done'
            return 'done'
          }
          if (i === 2) {
            if (!s.checked) return 'todo'
            if (is('check')) return l < T.check - 400 ? 'doing' : 'done'
            return 'done'
          }
          if (!s.fixed) return 'todo'
          if (is('fix')) return l < T.fix - 400 ? 'doing' : 'done'
          return 'done'
        }
        planLis.forEach((li, i) => {
          const q = is('plan') ? O(T.planStep0 + i * T.planStepGap, 420) : st.plan ? 1 : 0
          kit.css(li, { opacity: fx(q, 3), transform: `translateX(${fx((1 - q) * -24, 1)}px)` })
          const s = stepState(i)
          kit.setIf(li, 'className', `s-${s}`)
          const tag = li.querySelector<HTMLElement>('.ao-st-tag')!
          kit.setIf(tag, 'text', s === 'wait' ? (st.ask?.status === 'denied' ? '被拒絕' : '等你允許') : s === 'doing' ? '進行中' : s === 'done' ? '完成' : '')
        })

        // ---------- 全息:權限 ----------
        const a = st.ask
        let askVis = 0
        if (is('ask')) askVis = P(0, 650)
        else if (is('allow')) askVis = a?.status === 'allowed' ? 1 - E(1150, 550) : 1
        else if (a?.status === 'pending' || a?.status === 'denied') askVis = 1
        let askView: AskView | null = null
        if (askVis > 0 && a) {
          const q = questionOf(a.text)
          const resolved = is('allow') ? l >= T.press + 120 : a.status !== 'pending'
          const resText = !resolved ? '' : a.status === 'allowed' ? '已允許 ✓ 開始動手' : '已拒絕：好，我不建立，換個方式再問你。'
          askView = {
            status: a.status,
            title: a.n > 1 ? '換個方式再問一次' : '需要你的允許',
            question: is('ask') ? kit.typewriter(q, l, { start: 450, cps: T.askCps }).text : q,
            btnIn: is('ask') ? O(T.askIn - 700 + kit.typeDuration(q, T.askCps) * 0.4, 400) : 1,
            resolved,
            pressAllow: is('allow') && a.status === 'allowed' ? Math.sin(Math.PI * P(0, T.press * 2)) : 0,
            pressDeny: is('allow') && a.status === 'denied' ? Math.sin(Math.PI * P(0, T.press * 2)) : 0,
            resText: is('allow') && a.status === 'denied' ? kit.typewriter(resText, l, { start: T.press + 200, cps: 22 }).text : resText,
          }
        }
        // 換個方式再問:舊面板閃一下再換新的內容
        renderAsk(askH, askVis, 37 + (a?.n ?? 0), askView)

        // ---------- 螢幕:代理人的對話畫面 ----------
        const workIn = is('build') ? O(0, 600) : st.built ? 1 : 0
        kit.setIf(agent, 'opacity', fx(1 - workIn, 3))
        kit.setIf(work, 'opacity', fx(workIn, 3))
        kit.setIf(mNeed, 'text', needStr)
        kit.setIf(mYou, 'opacity', fx(is('need') ? P(dur - 900, 400) : st.need ? 1 : 0, 3))
        kit.setIf(mPlan, 'opacity', fx(is('plan') ? P(T.planStep0, 500) : st.plan ? 1 : 0, 3))
        kit.setIf(mAsk, 'opacity', fx(a ? (is('ask') && a.n === 1 ? P(500, 400) : 1) : 0, 3))
        kit.setIf(mAskText, 'text', a ? `⏸ 等你允許：${a.text}` : '')
        const resShow = a && a.status !== 'pending' ? (is('allow') ? P(T.press + 100, 400) : 1) : 0
        kit.setIf(mRes, 'opacity', fx(resShow, 3))
        kit.setIf(mResText, 'text', a?.status === 'allowed' ? '✓ 已允許，開始動手' : a?.status === 'denied' ? '好，我不建立，換個方式問你' : '')
        mRes.classList.toggle('no', a?.status === 'denied')

        // ---------- 螢幕:編輯器 + 預覽 / 瀏覽器 ----------
        // 編輯器的寬度:build 時一半;check 之後收起來,整個螢幕都是瀏覽器
        const edW = st.checked ? (is('check') ? 1 - E(0, T.checkWiden) : 0) : 1
        kit.setIf(ed, 'width', `${fx(330 * edW, 1)}px`)
        kit.setIf(ed, 'opacity', fx(Math.min(1, edW * 1.5), 3))
        const htmlN = is('build') ? Math.floor(HTML_N * E(T.buildCode, T.buildCodeEnd - T.buildCode)) : st.built ? HTML_N : 0
        const htmlShown = streamed(HTML, htmlN)
        const caret = is('build') && htmlN < HTML_N && kit.blink(ms, 600)
        kit.setIf(code, 'html', codeHtml(htmlShown, { lang: 'html', tail: 17, numbers: true, caret }))
        // 預覽:寫完那一行,那一塊就出現(還沒有樣式)
        const linesDone = htmlShown.filter((ln, i) => ln.length === HTML[i].length).length
        rawBlocks.forEach((el, i) => {
          const on = linesDone > RAW_AT[i]
          kit.setIf(el, 'opacity', on ? '1' : '0')
        })
        kit.setIf(url, 'text', st.checked ? (is('check') ? kit.typewriter(`file:///${site}/index.html`, l, { start: 300, cps: 30 }).text : `file:///${site}/index.html`) : '預覽')
        // 掃描光
        const scanP = is('check') ? P(T.scan, T.scanDur) : 0
        kit.css(scan, { opacity: scanP > 0 && scanP < 1 ? '1' : '0', top: `${fx(scanP * 100, 2)}%` })
        // 問題框
        const markIn = st.checked ? (is('check') ? O(T.found, 400) : is('fix') ? 1 - E(0, 700) : st.fixed ? 0 : 1) : 0
        kit.css(mark, { opacity: fx(markIn * (0.75 + 0.25 * kit.pulse(ms, 900)), 3) })
        // 換上樣式:由上往下掃過去
        const wipeP = st.fixed ? (is('fix') ? E(T.wipe, T.wipeDur) : 1) : 0
        kit.setIf(styled, 'clipPath', `inset(0 0 ${fx((1 - wipeP) * 100, 2)}% 0)`)
        kit.css(wipe, { top: `${fx(wipeP * 100, 2)}%`, opacity: is('fix') && wipeP > 0 && wipeP < 1 ? '1' : '0' })
        // 螢幕亮度跟著畫面
        kit.setIf(mon, 'filter', `brightness(${fx(1 + 0.05 * kit.pulse(ms, 5000), 3)})`)
        scr.classList.toggle('styled', wipeP >= 1)

        // ---------- 全息:鍵盤上方的程式碼面板 ----------
        const khVis = is('build') ? Math.min(P(300, 600), 1 - P(T.build - 900, 700)) : is('fix') ? Math.min(P(200, 600), 1 - P(T.fix - 900, 700)) : 0
        renderHolo(kh, khVis, 51 + (is('fix') ? 1 : 0), 'perspective(1200px) rotateX(30deg) rotateY(-20deg) rotateZ(-2deg)')
        if (khVis > 0) {
          const isFix = is('fix')
          kit.setIf(khTab, 'text', isFix ? 'style.css' : 'index.html')
          const n = isFix ? Math.floor(CSS_N * E(T.fixCode, T.fixCodeEnd - T.fixCode)) : htmlN
          kit.setIf(khCode, 'html', codeHtml(streamed(isFix ? CSS_LINES : HTML, n), { lang: isFix ? 'css' : 'html', tail: 8, caret: kit.blink(ms, 500) }))
        }

        // ---------- 全息:系統狀態 → 工作紀錄 ----------
        const logIn = is('build') ? E(0, 700) : st.built ? 1 : 0
        renderHolo(dash, 1, 61, `translate(0, ${fx(52 * close, 1)}px)`)
        kit.setIf(dashAmb, 'opacity', fx(1 - logIn, 3))
        kit.setIf(dashLog, 'opacity', fx(logIn, 3))
        renderBars(bars, ms)
        // 進度環:四步做到哪
        let prog = 0
        ORDER.forEach((k, i) => {
          const w = [0.45, 0.2, 0.3, 0.05][i]
          if (stateHas(st, k)) prog += kind === k ? w * P(0, dur - 300) : w
        })
        const finished = st.done && (!is('done') || l > 700)
        renderProgress(progress, {
          prog,
          title: finished ? '完成 ✓' : '工作紀錄',
          ok: finished,
          rows: log.map((x) => ({ show: stateHas(st, x.kind) && (kind !== x.kind || l >= x.at), q: kind === x.kind ? O(x.at, 350) : 1 })),
        })

        // ---------- 全息:檢查結果 ----------
        const issueIn = st.checked && !st.fixed ? (is('check') ? P(T.found + 100, 700) : 1) : is('fix') ? 1 - P(0, 600) : 0
        renderHolo(issue, issueIn, 71, 'translate(0, 0)')

        // ---------- 全息:裝飾圖表 ----------
        renderDecoLines(decoL1, decoL2, ms)
        // 動手的時候,裝飾圖表淡一點
        renderHolo(deco, 1, 81, 'translate(0, 0)', 0.85 - 0.4 * close)
      },

      target(name) {
        switch (name) {
          case 'window': return root
          case 'robot': return rig.body as unknown as HTMLElement
          case 'head': return rig.head as unknown as HTMLElement
          case 'human': return man.body as unknown as HTMLElement
          case 'monitor': return mon
          case 'screen': return scr
          case 'code': return kh
          case 'plan': return plan
          case 'need': return need
          case 'ask': return ask
          case 'allow': return btnAllow
          case 'deny': return btnDeny
          case 'dash': return dash
          case 'issue': return issue
        }
        return null
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
