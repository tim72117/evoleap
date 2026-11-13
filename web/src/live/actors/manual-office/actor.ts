// 演員 manual-office:「手寫程式的年代」(研發基地試作,不進公開 bundle;登記在 ../../registerActors.ts)。
// 跟 agent-office 是同一間明亮的辦公室(同一個房間、桌子、螢幕、燈光、鏡位、底片調色),不同的是只有穿西裝的人坐在桌前,
// 一個字一個字手打 HTML:左半個螢幕是編輯器、右半個是瀏覽器預覽。打錯一個符號,存檔、重新整理,預覽就壞了;
// 他一行一行找、圈出可疑的那一行、改一個字、再重新整理——又壞在別的地方。牆上的時鐘一天一天過去(時間快轉、窗外天黑又天亮)。
// 最後他累了、舉手求助;白色機器人坐著辦公椅從右邊滑進來、眼睛亮起;他說出需求。結束的畫面跟 agent-office 的第一格一樣
// (機器人坐在桌前、人站在右邊、螢幕是代理人的對話畫面、系統狀態面板亮著),腳本可以用 show/hide 無縫接過去(見 lab/scenes/intro-manual-to-agent.json)。
// 文字都是真的 DOM;所有動畫由 render 依時間算出(SPEC 第 1 節:不用 CSS transition/animation、不用 Math.random)。
// place 用 "full"(1920×1080 橫式)。
//
// props:
//   site     網站名稱;預設 "小森烘焙"
//
// 動作(操作式;對不上狀態時載入就報錯;任何一步都可以寫 ms 指定長度,整段動畫依比例放慢或加快):
//   { "write": true }          他在桌前手打整頁 HTML(逐字、慢慢打,打到一半有一個符號漏掉)。可寫行數 { "write": 8 }:只打最後 8 行(前面當作已經打好)
//   { "run": true }            存檔、重新整理:瀏覽器載入條跑一下,預覽換成「目前程式碼」的結果。有 bug 的時候預覽是壞的
//                              (第一次內容不見、改一個字後沒有樣式、再改一個字後選單擠成一行、全部改完才正常);要先 write
//   { "hunt": true }           找錯:亮條在編輯器一行一行掃過去,最後圈出可疑的那一行;人往前傾(第二次起還會揉太陽穴),時鐘快轉(一天)。
//                              要先 run 過、而且預覽現在是壞的(還沒圈過)
//   { "patch": true }          把圈起來的那一行改一個字(補 > 或 }、改正 <il>),編輯器那行閃一下;預覽還是舊的,要再 run 才看得到結果。
//                              要先 hunt。一共有 3 個 bug,所以最多改 3 次;每次改完下一個 bug 才會出現
//   { "slump": true }          累了:往後靠、嘆氣、手摀臉(又過了半天)。要先 run 過
//   { "call": true }           他停下來、舉起手求助(天色回到白天、時鐘淡出)。要先 run 過
//   { "enter": true }          他站起來讓出位子;機器人坐著辦公椅從右邊滑進來、停在桌前,眼睛亮起、點頭,螢幕換成代理人的對話畫面、系統狀態面板亮起(要先 call)
//   { "handoff": "需求" }      他用全息對話框說出需求(逐字出現、聲波跳動),機器人聽著;最後對話框收掉,畫面 = agent-office 的第一格(要先 enter);不寫文字就用預設
//   (時間的快轉折在 write / hunt / patch / slump 裡:每個動作都會往前推幾個小時,牆上時鐘與天色跟著走)
//
// 目標:window、human、head、monitor、screen、code、preview、clock、circle、robot、say
import { kit } from '../../kit'
import { defineActor, type CommonStepFields, type Hotspot } from '../../types'
import type { Pt } from '../../art/geometry'
import { manSvg, robotSvg } from '../../art/characters'
import { deskSvg } from '../../art/office'
import { attr, fx } from '../../art/dom'
import { yes, frameClock, makeKindIn } from '../../art/actorKit'
import { layerMarkup, mountBackdrop, mountOffice, officeMarkup, renderBackdrop, renderBars, renderDecoLines, renderLayers, renderWave } from '../../art/backdrop'
import { agentWindowMarkup, browserMarkup, dashMarkup, decoMarkup, needMarkup } from '../../art/panels'
import { WIDE_CAM, closeness, handheld, lerpCam, type Cam } from '../../art/fx/camera'
import { streamed, totalChars, type Lang } from '../../art/fx/codeStream'
import { clockMarkup, mountClock, nightOf, renderClock } from '../../art/fx/clock'
import { ROW_H, editorHtml, rowTop, scribbleCircle, type EditorRow } from '../../art/fx/editor'
import { renderHolo } from '../../art/fx/hologram'
import { MAN_SHOULDER, STAND_POSE, drawManArm, manArmsSvg, mountManArm, mountManFace, poseCss, poseMap, renderManFace, type ManPose } from '../../art/manRig'
import { botBlink, mixLook, mountBotArms, mountBotRig, renderBotArms, renderBotRig, type BotLook } from '../../art/robotRig'
import { ARM, ART, BOT, BOT_START_DX, DESK_Y, MAN, MAN_ARM, MAN_SPOT, onKb, sitPose } from './layout'
import './actor.css'

// ---------- 型別 ----------
export interface ManualProps {
  site?: string
}
export const KINDS = ['write', 'run', 'hunt', 'patch', 'slump', 'call', 'enter', 'handoff'] as const
export type Kind = (typeof KINDS)[number]
export type ManualStep = CommonStepFields & {
  write?: true | number
  run?: true
  hunt?: true
  patch?: true
  slump?: true
  call?: true
  enter?: true
  handoff?: string | true
}
export type Target = 'window' | 'human' | 'head' | 'monitor' | 'screen' | 'code' | 'preview' | 'clock' | 'circle' | 'robot' | 'say'

export interface ManualState {
  written: boolean
  /** write 打了幾行(其餘當作已經打好) */
  lines: number
  /** 已經改掉幾個 bug(0–3);程式碼依它決定哪幾行還有錯 */
  fixes: number
  /** 最近一次 run 時的 fixes(預覽顯示那一次的結果);null = 還沒 run 過 */
  shown: number | null
  /** 有一行被圈起來、等著改 */
  circled: boolean
  slumped: boolean
  called: boolean
  entered: boolean
  say: string | null
  /** 經過了幾小時(第 1 天 09:00 起算),時鐘與天色由它決定 */
  hours: number
  temp: Record<string, never>
}
export const MAX_FIX = 3
/** 每個動作往前推幾小時 */
export const HOURS = { write: 3, hunt: 20, patch: 1, slump: 4 } as const

// ---------- 程式碼(手寫的網頁,有三個 bug) ----------
/** 第幾行(從 0)有第 i 個 bug */
export const BUG_ROW = [11, 6, 14] as const
export const codeLines = (site: string, fixes: number): string[] => [
  '<!DOCTYPE html>',
  '<html lang="zh-Hant">',
  '<head>',
  '  <meta charset="utf-8">',
  `  <title>${site}</title>`,
  '  <style>',
  fixes < 2 ? '    body { background: #fff8ef;' : '    body { background: #fff8ef; }',
  '    h1 { color: #5a3a22; }',
  '  </style>',
  '</head>',
  '<body>',
  fixes < 1 ? `  <h1>${site}</h1` : `  <h1>${site}</h1>`,
  '  <p>每天現烤的麵包與甜點</p>',
  '  <ul>',
  fixes < 3 ? '    <il>可頌 NT$65</li>' : '    <li>可頌 NT$65</li>',
  '    <li>肉桂捲 NT$80</li>',
  '  </ul>',
  '</body>',
  '</html>',
]
export const CODE_ROWS = codeLines('x', 0).length
const langOf = (i: number): Lang => (i === 6 || i === 7 ? 'css' : 'html')
/** 一行文字在編輯器裡的寬度(px):中文 12、其他約 7.2 */
export const textWidth = (s: string): number => [...s].reduce((w, c) => w + ((c.codePointAt(0) ?? 0) > 255 ? 12 : 7.2), 0)

// ---------- 時間表(毫秒,相對動作開始) ----------
export const T = {
  write0: 1000, writeEnd: 700, writeMsPerChar: 15,
  run: 2600, runSave: 400, runSwap: 1100,
  hunt: 4600, scan0: 500, scanDown: 1200, scanEnd: 2700, circle: 2900, circleDur: 800,
  patch: 2500, patchEdit: 1000,
  slump: 4000,
  call: 3000, wave: 1400,
  enter: 5600, rise: 150, step: 450, rollStart: 900, roll: 2500, swap: 3600, eyes: 3500, nod: 4300, boot: 4500,
  handoff: 700, handoffTail: 1500, handoffCps: 14,
}
const DEFAULT_SAY = '我需要一個網站。'
const DEFAULT_SITE = '小森烘焙'

/** 這次 write 要打的行數 */
export const writeRows = (v: true | number | undefined): number => (typeof v === 'number' ? Math.min(Math.floor(v), CODE_ROWS) : CODE_ROWS)
/** 最後 n 行(含換行)的字數 */
const charsOfLast = (site: string, n: number): number => totalChars(codeLines(site, 0).slice(-n))

export function apply(st: ManualState, kind: Kind, s: ManualStep): ManualState {
  if (st.entered && kind !== 'handoff') throw new Error(`${kind}:AI 代理人已經來了,只剩 handoff`)
  switch (kind) {
    case 'write': {
      const v = s.write
      if (v !== true && !(typeof v === 'number' && Number.isInteger(v) && v >= 1)) throw new Error('write 要寫 true,或要打的行數(正整數)')
      if (st.written) throw new Error('write:已經打過了')
      return { ...st, written: true, lines: writeRows(v), hours: st.hours + HOURS.write }
    }
    case 'run':
      yes(s.run, 'run')
      if (!st.written) throw new Error('run:還沒有程式碼可以執行,先 write')
      return { ...st, shown: st.fixes }
    case 'hunt':
      yes(s.hunt, 'hunt')
      if (st.shown === null) throw new Error('hunt:還沒 run 過,不知道哪裡壞了,先 run')
      if (st.circled) throw new Error('hunt:已經圈出來了,先 patch')
      if (st.fixes >= MAX_FIX || st.shown >= MAX_FIX) throw new Error('hunt:預覽是正常的,沒有東西要找')
      if (st.shown !== st.fixes) throw new Error('hunt:改過了還沒重新整理,先 run')
      return { ...st, circled: true, hours: st.hours + HOURS.hunt }
    case 'patch':
      yes(s.patch, 'patch')
      if (!st.circled) throw new Error('patch:還沒圈出要改哪一行,先 hunt')
      return { ...st, circled: false, fixes: st.fixes + 1, hours: st.hours + HOURS.patch }
    case 'slump':
      yes(s.slump, 'slump')
      if (st.shown === null) throw new Error('slump:還沒試過就累了?先 write 和 run')
      if (st.slumped) throw new Error('slump:已經累癱了')
      if (st.called) throw new Error('slump:已經在求助了')
      return { ...st, slumped: true, circled: false, hours: st.hours + HOURS.slump }
    case 'call':
      yes(s.call, 'call')
      if (st.shown === null) throw new Error('call:還沒試過就求助?先 write 和 run')
      if (st.called) throw new Error('call:已經求助過了')
      return { ...st, called: true, circled: false }
    case 'enter':
      yes(s.enter, 'enter')
      if (!st.called) throw new Error('enter:沒有人求助,機器人不會自己進來,先 call')
      return { ...st, entered: true }
    case 'handoff': {
      if (s.handoff !== true && (typeof s.handoff !== 'string' || !s.handoff.trim())) throw new Error('handoff 要寫需求(字串)或 true')
      if (!st.entered) throw new Error('handoff:機器人還沒進來,先 enter')
      if (st.say) throw new Error('handoff:已經說過了')
      return { ...st, say: typeof s.handoff === 'string' ? s.handoff.trim() : DEFAULT_SAY }
    }
  }
}

export const kindIn = makeKindIn(KINDS)

export function durationOf(kind: Kind, s: ManualStep, site = DEFAULT_SITE): number {
  switch (kind) {
    case 'write': return T.write0 + T.writeEnd + charsOfLast(site, writeRows(s.write)) * T.writeMsPerChar
    case 'run': return T.run
    case 'hunt': return T.hunt
    case 'patch': return T.patch
    case 'slump': return T.slump
    case 'call': return T.call
    case 'enter': return T.enter
    case 'handoff': return T.handoff + kit.typeDuration(typeof s.handoff === 'string' ? s.handoff : DEFAULT_SAY, T.handoffCps) + T.handoffTail
  }
}

// ---------- 鏡頭 ----------
const MID: Cam = { x: 990, y: 530, z: 1.16 }
const SCREEN_CAM: Cam = { x: 800, y: 470, z: 1.42 }
const MAN_CAM: Cam = { x: 1180, y: 560, z: 1.3 }
const CALL_CAM: Cam = { x: 1100, y: 540, z: 1.1 }
/** 推軌由狀態決定:開場是兩個人的全景,開始工作後推近一點、累了拉近看他、機器人來了拉回全景(跟 agent-office 一樣的 WIDE) */
export const dollyOf = (st: ManualState): Cam => {
  if (st.entered) return WIDE_CAM
  if (st.called) return CALL_CAM
  if (st.slumped) return MAN_CAM
  if (st.written) return MID
  return WIDE_CAM
}

// ---------- 人的身體 ----------
/** 一隻手臂的姿勢權重:打字 / 舉起(近側:揉額頭、遠側:揮手)/ 放在腿上 */
type G = { type: number; up: number; lap: number }
interface Body {
  /** 前傾 > 0、後靠 < 0 */
  lean: number
  /** 頭的額外旋轉(度,順時針 = 臉朝上) */
  head: number
  /** 嘆氣:胸口抬起 0–1 */
  sigh: number
  near: G
  far: G
  /** 手指敲鍵盤的強度 0–1 */
  typing: number
}
const g = (type = 0, up = 0, lap = 0): G => ({ type, up, lap })
const mixG = (a: G, b: G, p: number): G => ({ type: kit.lerp(a.type, b.type, p), up: kit.lerp(a.up, b.up, p), lap: kit.lerp(a.lap, b.lap, p) })
const mixBody = (a: Body, b: Body, p: number): Body => ({
  lean: kit.lerp(a.lean, b.lean, p), head: kit.lerp(a.head, b.head, p), sigh: kit.lerp(a.sigh, b.sigh, p), near: mixG(a.near, b.near, p), far: mixG(a.far, b.far, p), typing: kit.lerp(a.typing, b.typing, p),
})
export const restBody = (st: ManualState): Body => {
  if (st.entered) return { lean: 0, head: 0, sigh: 0, near: g(0, 0, 1), far: g(0, 0, 1), typing: 0 }
  if (st.called) return { lean: -0.25, head: 5, sigh: 0, near: g(0, 0, 1), far: g(0, 1, 0), typing: 0 }
  if (st.slumped) return { lean: -1, head: -8, sigh: 0, near: g(0, 0, 1), far: g(0, 0, 1), typing: 0 }
  if (st.written) return { lean: 0.35, head: 0, sigh: 0, near: g(1), far: g(1), typing: 0 }
  return { lean: 0.12, head: 0, sigh: 0, near: g(1), far: g(1), typing: 0 }
}
/** 分段內插:keys 是 [時間, 值],段與段之間用 inOutCubic */
export const keyed = (l: number, keys: [number, number][]): number => {
  if (l <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    if (l < keys[i][0]) return kit.lerp(keys[i - 1][1], keys[i][1], kit.ease.inOutCubic((l - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])))
  }
  return keys[keys.length - 1][1]
}

// ---------- 預覽的網頁(依 run 時的 fixes) ----------
const pageVanish = (site: string): string => `<div class="mo-serif"><h1>${kit.esc(site)}</h1></div>`
const pageRaw = (site: string): string =>
  `<div class="mo-serif"><h1>${kit.esc(site)}</h1><p>每天現烤的麵包與甜點</p><ul><li>可頌 NT$65</li><li>肉桂捲 NT$80</li></ul></div>`
const pageHalf = (site: string): string =>
  `<h1>${kit.esc(site)}</h1><p>每天現烤的麵包與甜點</p><span class="mo-runon">可頌 NT$65肉桂捲 NT$80</span>`
const pageOk = (site: string): string => `<h1>${kit.esc(site)}</h1><p>每天現烤的麵包與甜點</p><ul><li>可頌 NT$65</li><li>肉桂捲 NT$80</li></ul>`

const LOOK = {
  monitor: { yaw: -0.98, pitch: 0.02, tilt: 0 } as BotLook,
  human: { yaw: 0.44, pitch: -0.05, tilt: 3 } as BotLook,
}

const actor = defineActor<Kind, ManualStep, ManualProps, ManualState, Target>({
  name: 'manual-office',
  kinds: KINDS,
  fixedSize: true,

  init() {
    return { written: false, lines: 0, fixes: 0, shown: null, circled: false, slumped: false, called: false, entered: false, say: null, hours: 0, temp: {} }
  },
  apply,
  duration(kind, step, props) {
    return durationOf(kind, step, (props as ManualProps).site ?? DEFAULT_SITE)
  },
  autoFocus() {
    return undefined
  },

  hotspots(st): Hotspot<ManualStep>[] {
    if (st.entered) return st.say ? [] : [{ target: 'human', label: '說出需求', step: { handoff: true } }]
    if (st.called) return [{ target: 'robot', label: '請 AI 代理人進來', step: { enter: true } }]
    if (st.slumped) return [{ target: 'human', label: '舉手求助', step: { call: true } }]
    if (!st.written) return [{ target: 'human', label: '手寫程式', step: { write: true } }]
    if (st.shown === null || st.shown !== st.fixes) return [{ target: 'monitor', label: '存檔、重新整理', step: { run: true } }]
    if (st.circled) return [{ target: 'code', label: '改這一行', step: { patch: true } }]
    const spots: Hotspot<ManualStep>[] = []
    if (st.shown < MAX_FIX) spots.push({ target: 'screen', label: '找哪裡壞了', step: { hunt: true } })
    spots.push({ target: 'human', label: st.fixes >= 2 ? '累了' : '放棄', step: { slump: true } })
    return spots
  },

  mount(root, props) {
    const site = props.site ?? DEFAULT_SITE
    const LINES0 = codeLines(site, 0)
    mountOffice(
      root,
      'manual-office',
      officeMarkup(
        ART,
        layerMarkup('mo-dusk', `<i></i>`) +
          layerMarkup('mo-clockbox', clockMarkup()) +
          layerMarkup('mo-desk', deskSvg(ART)) +
          // 螢幕
          layerMarkup(
            'mo-monl',
            `<div class="art-mon"><div class="art-scr">` +
              `<div class="art-work"><div class="art-edbox mo-ed"><div class="art-tab mo-tab"><span>index.html<b class="mo-dot">●</b></span></div><div class="mo-code art-code art-ed"></div>` +
              `<svg class="mo-circle" viewBox="0 0 330 358" aria-hidden="true"><path pathLength="1"/></svg></div>` +
              browserMarkup(
                `<div class="mo-pg mo-pg-blank"><span>按下儲存、重新整理<br>才看得到網頁的樣子</span></div>` +
                  `<div class="mo-pg mo-pg-vanish">${pageVanish(site)}</div>` +
                  `<div class="mo-pg mo-pg-raw">${pageRaw(site)}</div>` +
                  `<div class="mo-pg mo-pg-half">${pageHalf(site)}</div>` +
                  `<div class="mo-pg mo-pg-ok">${pageOk(site)}</div>` +
                  `<div class="mo-loadbar"></div>`,
              ) +
              `</div>` +
              // 代理人的對話畫面(機器人進來之後)
              agentWindowMarkup(site) +
              `<div class="art-glare"></div></div></div>`,
          ) +
          // 人坐的椅子(機器人的椅子滑進來之後換成它的)
          layerMarkup(
            'mo-chair',
            `<svg viewBox="0 0 1920 1080" aria-hidden="true"><defs><linearGradient id="mo-chair2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c3ccd6"/><stop offset=".5" stop-color="#8a97a6"/><stop offset="1" stop-color="#5a6676"/></linearGradient></defs>` +
              `<path d="M1340 640 C 1380 626 1430 632 1446 664 L 1452 960 C 1430 984 1376 986 1356 968 Z" fill="url(#mo-chair2)"/>` +
              `<path d="M1352 660 C 1384 650 1420 654 1436 676 L 1440 950" stroke="#e8eef4" stroke-width="4" fill="none" opacity=".5"/></svg>`,
          ) +
          // 人(坐姿 ↔ 站姿)與手臂
          layerMarkup('mo-man', `<div class="mo-pose">${manSvg(ART)}</div>`) +
          layerMarkup('mo-arms', manArmsSvg(ART)) +
          // 機器人
          layerMarkup('mo-bot', `<div class="mo-botpose">${robotSvg(ART)}</div>`) +
          // 全息面板
          layerMarkup('mo-holo', decoMarkup() + dashMarkup() + needMarkup('mo-say')),
      ),
    )

    const $ = <E extends Element = HTMLElement>(s: string): E => root.querySelector<E>(s)!
    const $$ = <E extends Element = HTMLElement>(s: string, from: ParentNode = root): E[] => [...from.querySelectorAll<E>(s)]
    const back = mountBackdrop(root, ART.prefix)
    const layers = {
      room: back.room,
      rays: back.rays,
      dusk: $('.mo-dusk'),
      clock: $('.mo-clockbox'),
      desk: $('.mo-desk'),
      monl: $('.mo-monl'),
      chair: $('.mo-chair'),
      man: $('.mo-man'),
      arms: $('.mo-arms'),
      bot: $('.mo-bot'),
      holo: $('.mo-holo'),
      fore: back.fore,
    }
    const DEPTH: Record<keyof typeof layers, number> = { room: 0.45, rays: 0.7, dusk: 0.45, clock: 0.8, desk: 1, monl: 1, chair: 1, man: 1, arms: 1, bot: 1, holo: 1.02, fore: 1.3 }
    const duskFill = $('.mo-dusk i')
    const clock = mountClock($('.art-clock'))
    // 機器人
    const rig = mountBotRig(root, ART.prefix)
    const botArms = mountBotArms(root, ART.prefix)
    const botPose = $('.mo-botpose')
    // 人
    const pose = $('.mo-pose')
    const man = mountManFace(root, ART.prefix)
    const armNear = mountManArm(root, ART.prefix, 'near')
    const armFar = mountManArm(root, ART.prefix, 'far')
    // 螢幕
    const mon = $('.art-mon')
    const scr = $('.art-scr')
    const agent = $('.art-agent')
    const work = $('.art-work')
    const ed = $('.mo-ed')
    const dot = $('.mo-dot')
    const code = $('.mo-code')
    const circle = $<SVGSVGElement>('.mo-circle')
    const circlePath = $<SVGPathElement>('.mo-circle path')
    const url = $('.art-url')
    const page = $('.art-page')
    const pages = [$('.mo-pg-blank'), $('.mo-pg-vanish'), $('.mo-pg-raw'), $('.mo-pg-half'), $('.mo-pg-ok')]
    const loadbar = $('.mo-loadbar')
    // 全息面板
    const deco = $('.art-deco')
    const decoL1 = $<SVGPolylineElement>('.art-deco-l1')
    const decoL2 = $<SVGPolylineElement>('.art-deco-l2')
    const dash = $('.art-dash')
    const barEls = $$('.art-bars i')
    const say = $('.mo-say')
    const sayText = $('.art-need-text')
    const wave = $$('.art-wave i')

    return {
      render(frame_, ms) {
        const view = frame_.view
        if (!view) return
        const { kind, l, dur, st, prev, P, E, is } = frameClock(view, kindIn, (k, s) => durationOf(k, s as ManualStep, site))
        const K = (keys: [number, number][]): number => keyed(l, keys)

        // ---------- 時間:經過了幾小時(時鐘、天色) ----------
        const hoursEase = is('write') ? E(T.write0, dur - T.write0 - 500) : is('hunt') ? E(300, 4200) : is('patch') ? E(0, 900) : is('slump') ? E(300, 3200) : 1
        const hours = kind ? kit.lerp(prev.hours, st.hours, hoursEase) : st.hours
        const night = nightOf(hours)

        // ---------- 人的身體 ----------
        const restPrev = restBody(prev)
        const restNow = restBody(st)
        let b: Body = restNow
        if (kind) {
          b = mixBody(restPrev, restNow, E(0, 700))
          switch (kind) {
            case 'write': {
              b = {
                lean: K([[0, restPrev.lean], [900, 0.32], [dur - 700, 0.32], [dur, restNow.lean]]) + 0.05 * kit.noise(ms / 900, 41),
                head: K([[0, 0], [1000, -1.5], [dur, 0]]) + 0.8 * kit.noise(ms / 700, 42),
                sigh: 0, near: g(1), far: g(1),
                typing: Math.min(P(T.write0 - 300, 300), 1 - P(dur - T.writeEnd - 100, 400)),
              }
              break
            }
            case 'run': {
              const after = T.runSwap
              b = {
                lean: K([[0, 0.35], [T.runSave, 0.35], [900, -0.2], [after + 100, -0.2], [after + 500, 0.85], [dur - 300, 0.7], [dur, restNow.lean]]),
                head: 5 * Math.sin(Math.PI * P(after + 200, 900)),
                sigh: 0, near: g(1), far: g(1),
                typing: Math.sin(Math.PI * P(0, T.runSave)) * 0.8,
              }
              break
            }
            case 'hunt': {
              const rub = prev.fixes >= 1 ? K([[0, 0], [3000, 0], [3400, 1], [dur - 300, 1], [dur, 0]]) : 0
              b = {
                lean: K([[0, 0.35], [700, 0.95], [dur - 800, 0.95], [dur, 0.4]]) + 0.04 * kit.noise(ms / 500, 43),
                head: K([[0, 0], [700, -3], [dur, -1]]) + 1.2 * kit.noise(ms / 400, 44),
                sigh: 0, near: g(1 - rub, rub, 0), far: g(1),
                typing: 0,
              }
              break
            }
            case 'patch': {
              b = {
                lean: K([[0, 0.4], [600, 0.7], [2000, 0.6], [dur, restNow.lean]]),
                head: K([[0, -1], [T.patchEdit + 500, 2], [dur, 0]]),
                sigh: 0, near: g(1), far: g(1),
                typing: Math.sin(Math.PI * P(T.patchEdit - 300, 700)),
              }
              break
            }
            case 'slump': {
              const tw = 1 - E(0, 700)
              const up = K([[0, 0], [1800, 0], [2400, 1], [3300, 1], [4000, 0]])
              b = {
                lean: K([[0, 0.35], [1300, -1], [dur, -1]]),
                head: K([[0, 0], [1300, -2], [2300, 7], [3200, 5], [dur, -8]]),
                sigh: K([[0, 0], [1500, 0], [2200, 1], [3100, 0]]),
                near: g(tw * (1 - up), up, Math.max(0, 1 - tw * (1 - up) - up)),
                far: g(tw, 0, 1 - tw),
                typing: 0,
              }
              break
            }
            case 'call': {
              const up = E(500, 800)
              b = {
                lean: K([[0, -1], [900, -0.4], [dur, -0.25]]),
                head: K([[0, -8], [900, 3], [1700, 8], [dur, 5]]),
                sigh: 0, near: g(0, 0, 1), far: g(0, up, 1 - up),
                typing: 0,
              }
              break
            }
            case 'enter': {
              const down = E(0, 600)
              b = { lean: K([[0, -0.25], [600, 0]]), head: K([[0, 5], [1000, 0]]), sigh: 0, near: g(0, 0, 1), far: g(0, 1 - down, down), typing: 0 }
              break
            }
            case 'handoff':
              b = { ...restNow, head: 3 * Math.sin(Math.PI * P(T.handoff, 900)) }
              break
          }
        }

        // 站起來:先站直(e1),再走回右邊(e2)
        const e1 = st.entered ? (is('enter') ? E(T.rise, 1100) : 1) : 0
        const e2 = st.entered ? (is('enter') ? E(T.step, 1500) : 1) : 0
        let manPose: ManPose = sitPose(b.lean, b.sigh)
        if (st.entered && !is('enter')) manPose = STAND_POSE
        else if (is('enter')) manPose = { tx: kit.lerp(manPose.tx, 0, e2), ty: kit.lerp(manPose.ty, 0, e1), rot: kit.lerp(manPose.rot, 0, e1), k: 1 }
        kit.setIf(pose, 'transform', poseCss(manPose))

        // ---------- 鏡頭:推軌 + 手持的微晃 + 景深 ----------
        const dp = kind ? E(0, Math.min(dur, 1500)) : 1
        let cam = lerpCam(dollyOf(prev), dollyOf(st), dp)
        if (kind) {
          const focus = is('hunt') ? K([[0, 0], [900, 1], [dur - 900, 1], [dur, 0]]) : is('patch') ? K([[0, 0], [700, 1], [dur - 700, 1], [dur, 0]]) : is('run') ? K([[0, 0], [800, 1], [dur - 900, 1], [dur, 0]]) : 0
          if (focus > 0) cam = lerpCam(cam, SCREEN_CAM, focus)
        }
        const shake = handheld(ms)
        const depthMan = kit.lerp(1, 0.9, e2)
        renderLayers(layers, DEPTH, cam, shake, (name) => (name === 'man' || name === 'arms' ? depthMan : DEPTH[name]))
        const close = closeness(cam)
        // 天黑:房間、桌子、人都暗下來(白天不寫 filter,跟 agent-office 一樣)
        const dark = night > 0.001
        // 房間與前景的景深、窗光呼吸、灰塵飄、散景閃、底片顆粒
        renderBackdrop(back, close, ms, dark ? ` brightness(${fx(1 - 0.5 * night, 2)})` : '')
        kit.setIf(layers.rays, 'opacity', dark ? fx(1 - 0.9 * night, 3) : '')
        kit.setIf(layers.desk, 'filter', dark ? `brightness(${fx(1 - 0.32 * night, 2)})` : '')
        const manBlur = e2 * (0.6 + close * 5.5)
        kit.setIf(layers.man, 'filter', manBlur > 0.04 || e2 > 0 || dark ? `blur(${fx(manBlur, 1)}px) brightness(${fx(1 - close * 0.12 * e2 - 0.34 * night, 2)})` : '')
        kit.setIf(layers.man, 'clipPath', e2 > 0 ? `inset(0 0 ${fx(1080 - kit.lerp(1080, DESK_Y - 2, e2), 1)}px 0)` : 'none')
        kit.setIf(layers.arms, 'filter', dark ? `brightness(${fx(1 - 0.34 * night, 2)})` : '')
        kit.setIf(layers.chair, 'filter', dark ? `brightness(${fx(1 - 0.32 * night, 2)})` : '')
        // 天色的色調:傍晚偏橘、夜裡偏藍(multiply)
        kit.setIf(layers.dusk, 'visibility', dark ? 'visible' : 'hidden')
        if (dark) {
          const warm = Math.sin(Math.PI * Math.min(1, night * 1.6)) // 傍晚最橘
          const r = Math.round(kit.lerp(255, 70, night) + 0 * warm)
          const gC = Math.round(kit.lerp(255, 92, night) - 40 * warm * (1 - night))
          const bC = Math.round(kit.lerp(255, 150, night) - 80 * warm * (1 - night))
          kit.setIf(duskFill, 'background', `rgb(${r}, ${gC}, ${bC})`)
        }

        // ---------- 時鐘 ----------
        const clockOp = st.entered ? (is('enter') ? 1 - E(0, 700) : 0) : 1
        kit.setIf(layers.clock, 'opacity', fx(clockOp, 3))
        kit.setIf(layers.clock, 'visibility', clockOp > 0.001 ? 'visible' : 'hidden')
        renderClock(clock, hours)

        // ---------- 人:頭、臉、身體 ----------
        const sayStr = st.say ?? ''
        const talking = is('handoff') && l > T.handoff + 150 && l < T.handoff + kit.typeDuration(sayStr, T.handoffCps)
        renderManFace(man, MAN.neck, ms, talking, b.head)

        // ---------- 人:手臂 ----------
        const armsOp = st.entered ? (is('enter') ? 1 - E(450, 450) : 0) : 1
        kit.setIf(layers.arms, 'opacity', fx(armsOp, 3))
        kit.setIf(layers.arms, 'visibility', armsOp > 0.001 ? 'visible' : 'hidden')
        if (armsOp > 0.001) {
          const wv = is('call') ? P(T.wave, 500) : st.called && !st.entered ? 1 : is('enter') ? 1 - E(0, 600) : 0
          const tp = b.typing
          const kN = onKb(0.84, 0.45)
          const kF = onKb(0.5, 0.5)
          const type = { n: { x: kN.x + kit.noise(ms / 240, 11) * 14 * tp, y: kN.y + kit.noise(ms / 300, 12) * 5 * tp }, f: { x: kF.x + kit.noise(ms / 260, 13) * 14 * tp, y: kF.y + kit.noise(ms / 320, 14) * 5 * tp } }
          const spot = (p: Pt): Pt => poseMap(manPose, p)
          const sw = (gw: G, t: Pt, u: Pt, lp: Pt): Pt => {
            const s = gw.type + gw.up + gw.lap || 1
            return { x: (t.x * gw.type + u.x * gw.up + lp.x * gw.lap) / s, y: (t.y * gw.type + u.y * gw.up + lp.y * gw.lap) / s }
          }
          const wavePt = spot(MAN_SPOT.wave)
          const waveT = { x: wavePt.x + Math.sin(ms / 170) * 26 * wv, y: wavePt.y + Math.sin(ms / 170 + 1.4) * 9 * wv }
          const tN = sw(b.near, type.n, spot(MAN_SPOT.rub), spot(MAN_SPOT.lapNear))
          const tF = sw(b.far, type.f, waveT, spot(MAN_SPOT.lapFar))
          const fol = (gw: G): number => kit.lerp(0.32, 1, gw.up)
          drawManArm(armFar, poseMap(manPose, MAN_SHOULDER.far), tF, MAN_ARM.len, MAN_ARM.r, 0.95, tp, fol(b.far), ms, 0.7)
          drawManArm(armNear, poseMap(manPose, MAN_SHOULDER.near), tN, MAN_ARM.len, MAN_ARM.r, 1, tp, fol(b.near), ms, 0)
        }

        // ---------- 機器人:滑進來、眼睛亮起 ----------
        const rollP = is('enter') ? P(T.rollStart, T.roll) : st.entered ? 1 : 0
        const rollE = kit.ease.outCubic(rollP)
        const botShown = is('enter') ? rollP > 0 : st.entered
        kit.setIf(layers.bot, 'visibility', botShown ? 'visible' : 'hidden')
        const dx = BOT_START_DX * (1 - rollE)
        kit.setIf(botPose, 'transform', rollP >= 1 ? 'none' : `translate(${fx(dx, 1)}px, ${fx(Math.abs(Math.sin(rollP * 26)) * 2.2 * (1 - rollP), 1)}px) rotate(${fx(-1.4 * (1 - rollP) * Math.sin(rollP * 9), 2)}deg)`)
        // 我的椅子:機器人的椅子到位後被它蓋住(兩張完全重疊,淡出避免邊緣疊兩層)
        kit.setIf(layers.chair, 'opacity', fx(1 - (is('enter') ? kit.progress(rollP, 0.85, 0.15) : st.entered ? 1 : 0), 3))
        // 眼睛開機(閃兩下才穩)
        const power = st.entered ? (is('enter') ? P(T.eyes, 700) : 1) : 0
        const powerGlow = power >= 1 ? 1 : power <= 0 ? 0 : kit.ease.outCubic(power) * (kit.rand(61 + Math.floor(power * 16))() < 0.4 ? 0.3 : 1)
        // 頭:滑進來時看著人,停下來之後轉向螢幕、點頭
        let look = LOOK.monitor
        if (st.entered) look = is('enter') ? mixLook(LOOK.human, LOOK.monitor, E(T.rollStart + T.roll - 300, 800)) : LOOK.monitor
        if (is('enter')) look = { ...look, pitch: look.pitch + 0.14 * Math.sin(Math.PI * P(T.nod, 700)) }
        const lw = is('handoff') ? Math.min(P(T.handoff - 300, 400), 1 - P(dur - T.handoffTail + 100, 500)) : 0
        if (is('handoff')) look = mixLook(LOOK.monitor, LOOK.human, E(200, 600) * (1 - E(dur - T.handoffTail + 200, 700)))
        const restGlow = 0.75 + 0.1 * kit.pulse(ms, 3000)
        const glow = kit.lerp(restGlow, 0.65 + 0.35 * kit.pulse(ms, 700), lw) * powerGlow
        const earPulse = kit.lerp(kit.pulse(ms, 2600), kit.pulse(ms, 700), lw)
        renderBotRig(rig, BOT, {
          look, ms, glow, ear: earPulse, earMul: powerGlow, core: powerGlow * (0.6 + 0.4 * kit.pulse(ms, 2400)),
          eyeColor: power > 0 || st.entered ? '#bdf3ff' : '#2b3a4c', eyeScale: botBlink(ms), halo: lw > 0 ? (ms % 1400) / 1400 : null,
        })
        // 手:放在鍵盤上(跟 agent-office 的待機一樣)
        const homeN = onKb(0.8, 0.42)
        const homeF = onKb(0.32, 0.48)
        renderBotArms(botArms, BOT, ARM, { x: homeN.x, y: homeN.y }, { x: homeF.x, y: homeF.y }, 0, 0, ms)

        // ---------- 螢幕:編輯器 ----------
        const rows: EditorRow[] = []
        const nowFix = is('patch') ? prev.fixes : st.fixes
        const rowsFull = codeLines(site, nowFix)
        let caretRow = -1
        let shownLines: string[] = rowsFull
        if (!st.written) {
          shownLines = ['']
          caretRow = 0
        } else if (is('write')) {
          const typed = Math.max(0, Math.min(1, P(T.write0, dur - T.write0 - T.writeEnd)))
          const pre = LINES0.length - st.lines
          const preChars = totalChars(LINES0.slice(0, pre))
          const total = totalChars(LINES0)
          const frac = Math.min(1, typed + 0.01 * Math.sin(typed * 50) * Math.min(1, (1 - typed) * 8))
          const n = Math.floor(preChars + (total - preChars) * frac)
          shownLines = streamed(LINES0, n)
          if (shownLines.length === 0) shownLines = ['']
          caretRow = shownLines.length - 1
        } else if (is('patch')) {
          shownLines = codeLines(site, l < T.patchEdit ? prev.fixes : st.fixes)
        }
        const blinkOn = kit.blink(ms, 560)
        const hotRows = new Map<number, number>()
        const bugRow = BUG_ROW[Math.min(st.fixes, 2)]
        let circRow = -1
        let circP = 0
        let circOp = 0
        if (is('hunt')) {
          const c = K([[T.scan0, 0], [T.scan0 + T.scanDown, CODE_ROWS - 1], [T.scan0 + T.scanDown + 200, CODE_ROWS - 1], [T.scanEnd, bugRow]])
          const scanning = l >= T.scan0 - 100 && l < T.scanEnd + 300
          if (scanning) for (let i = 0; i < CODE_ROWS; i++) { const d = Math.abs(i - c); if (d < 1.4) hotRows.set(i, (1 - d / 1.4) * 0.9) }
          circRow = bugRow
          circP = P(T.circle, T.circleDur)
          circOp = 1
          if (l >= T.circle) hotRows.set(bugRow, 0.3 * circP)
        } else if (st.circled && !is('patch')) {
          circRow = bugRow
          circP = 1
          circOp = 1
          hotRows.set(bugRow, 0.3)
        } else if (is('patch')) {
          circRow = BUG_ROW[Math.min(prev.fixes, 2)]
          circP = 1
          circOp = 1 - P(T.patchEdit + 100, 500)
          if (l < T.patchEdit) caretRow = circRow
        }
        const editedRow = is('patch') ? BUG_ROW[Math.min(prev.fixes, 2)] : -1
        const flashV = is('patch') && l >= T.patchEdit ? 1 - P(T.patchEdit, 1100) : 0
        shownLines.forEach((text, i) => {
          rows.push({
            text, lang: langOf(i), hot: hotRows.get(i), flash: i === editedRow && flashV > 0 ? flashV * 0.9 : undefined,
            caret: i === caretRow && (blinkOn || is('write')),
          })
        })
        kit.setIf(code, 'html', editorHtml(rows))
        // 圈起來的紅圈(手繪、一筆一筆畫出來)
        if (circRow >= 0 && circOp > 0 && rowsFull[circRow] !== undefined) {
          const w = textWidth(rowsFull[circRow]) + 2
          const cy = rowTop(circRow) + ROW_H / 2
          attr(circlePath, 'd', scribbleCircle(30 + 6 + w / 2, cy, w / 2 + 16, 15, 5 + circRow))
          attr(circlePath, 'stroke-dasharray', '1 1')
          attr(circlePath, 'stroke-dashoffset', fx(1 - kit.ease.outCubic(circP), 3))
          kit.setIf(circle as unknown as HTMLElement, 'opacity', fx(circOp, 3))
        } else kit.setIf(circle as unknown as HTMLElement, 'opacity', '0')
        // 分頁的「未儲存」圓點:改過還沒存檔(run)就亮
        let dirty: boolean
        if (!st.written) dirty = false
        else if (is('write')) dirty = true
        else if (is('run')) dirty = l < T.runSave
        else if (is('patch')) dirty = l >= T.patchEdit
        else dirty = st.shown === null || st.shown !== st.fixes
        kit.setIf(dot, 'opacity', dirty ? '1' : '0')
        kit.setIf(ed, 'opacity', '1')

        // ---------- 螢幕:預覽 ----------
        const swapped = is('run') && l >= T.runSwap
        const showIdx = is('run') ? (swapped ? st.shown : prev.shown) : st.shown
        const pageIdx = showIdx === null ? 0 : showIdx + 1
        const flash = is('run') ? Math.max(0, 1 - Math.abs(l - T.runSwap) / 140) : 0
        pages.forEach((el, i) => kit.setIf(el, 'opacity', i === pageIdx ? fx(1 - flash * 0.9, 3) : '0'))
        const loadP = is('run') ? P(T.runSwap - 500, 900) : 0
        kit.css(loadbar, { opacity: loadP > 0 && loadP < 1 ? '1' : '0', width: `${fx(loadP * 100, 1)}%` })
        kit.setIf(url, 'text', showIdx === null && !is('run') ? '預覽' : `file:///${site}/index.html`)
        // ---------- 螢幕:換成代理人的對話畫面 ----------
        const chat = st.entered ? (is('enter') ? E(T.swap, 800) : 1) : 0
        kit.setIf(agent, 'opacity', fx(chat, 3))
        kit.setIf(agent, 'visibility', chat > 0 ? 'visible' : 'hidden')
        kit.setIf(work, 'opacity', chat >= 1 ? '0' : '1')
        kit.setIf(mon, 'filter', `brightness(${fx(1 + 0.05 * kit.pulse(ms, 5000), 3)})`)
        scr.classList.toggle('chat', chat >= 1)

        // ---------- 全息:說需求 ----------
        const sayIn = is('handoff') ? P(250, 650) : 0
        const sayOut = is('handoff') ? E(dur - T.handoffTail + 200, 700) : 0
        renderHolo(say, sayIn, 11, 'translate(0, 0)', 1 - sayOut)
        kit.setIf(sayText, 'text', is('handoff') ? kit.typewriter(sayStr, l, { start: T.handoff, cps: T.handoffCps }).text : '')
        renderWave(wave, talking, ms)

        // ---------- 全息:系統狀態與裝飾圖表(機器人開機之後才亮,最後 = agent-office 的第一格) ----------
        const bootP = st.entered ? (is('enter') ? P(T.boot, 900) : 1) : 0
        renderHolo(dash, bootP, 61, `translate(0, ${fx(52 * close, 1)}px)`)
        renderBars(barEls, ms)
        renderDecoLines(decoL1, decoL2, ms)
        renderHolo(deco, bootP, 81, 'translate(0, 0)', 0.85 - 0.4 * close)
      },

      target(name) {
        switch (name) {
          case 'window': return root
          case 'human': return man.body as unknown as HTMLElement
          case 'head': return man.head as unknown as HTMLElement
          case 'monitor': return mon
          case 'screen': return scr
          case 'code': return code
          case 'preview': return page
          case 'clock': return $('.art-clock')
          case 'circle': return circle as unknown as HTMLElement
          case 'robot': return rig.body as unknown as HTMLElement
          case 'say': return say
        }
        return null
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
