// 演員 archify-reel:Archify 與 Diagram Design 兩個開源專案的 FB Reels 宣傳片(直式 1080×1920;研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 全部用圖形「模擬」專案的效果,沒有講解用字卡;畫面裡的小字(節點名稱、程式碼、終端機指令)是模擬畫面的一部分。
// 所有動畫由 render 依時間算出(SPEC 第 1 節):不用 CSS transition/animation、不用 Math.random(假亂數用 draw.ts 的 hash)。
// 數字:只有兩個專案的終點星數與 fork 數是真的(GitHub API,2026-11-13);成長曲線與湧入的星星是示意。
//
// props:無
//
// 動作(任何一步都可以寫 ms 指定長度;整段動畫依比例放慢或加快):
//   { "scene": "growth" }   成長:星星計數器從零往上衝(停在 96,093 與 66,821)、背景是示意的上升曲線
//   { "scene": "assist" }   做什麼:亂糟糟的想法與程式碼 → AI 程式助手(終端機)→ 整理成一張乾淨的圖
//   { "scene": "ir" }       原理(Archify):想法 → 結構化 JSON 一個欄位一個欄位長出來 → 驗證(捏造的元件被擋下、修正)→ 渲染
//   { "scene": "style" }    原理(Diagram Design):同一份內容換成多種編輯風格的圖型(紙色、細線、不用陰影),下方是縮圖牆
//   { "scene": "show" }     效果:節點長出、資料流光點、點節點展開、明暗主題切換、匯出圖片
//   { "scene": "types" }    效果:架構、流程、時序、生命週期四種圖型快速畫出
//   { "scene": "repos" }    收尾:兩張儲存庫卡片(星數、fork 數)並排
//
// 目標:window
import { defineActor, type CommonStepFields } from '../../../../live/types'
import { H, W, clamp, n2, type SceneOut } from './draw'
import { growth, repos } from './growth'
import { assist, ir } from './flow'
import { show, style, types } from './show'
import './actor.css'

export const SCENES = ['growth', 'assist', 'ir', 'style', 'show', 'types', 'repos'] as const
export type Scene = (typeof SCENES)[number]
export type ReelStep = CommonStepFields & { scene?: Scene }
export interface ReelState {
  scene: Scene | null
  prev: Scene | null
}
export type Target = 'window'

export const DRAW: Record<Scene, (l: number, D: number) => SceneOut> = { growth, assist, ir, style, show, types, repos }
/** 各段的預設長度(毫秒;腳本通常自己寫 ms) */
export const T: Record<Scene, number> = { growth: 8000, assist: 10000, ir: 9000, style: 6000, show: 12000, types: 4000, repos: 5000 }
/** 換景時的交叉淡化(毫秒) */
export const FADE = 320

export function apply(st: ReelState, kind: 'scene', s: ReelStep): ReelState {
  void kind
  if (!s.scene || !(SCENES as readonly string[]).includes(s.scene)) throw new Error(`scene 要寫 ${SCENES.join('、')} 其中之一`)
  return { scene: s.scene, prev: st.scene }
}

/** 某一刻整張畫面的 SVG(純函式:同樣的輸入一定同樣的字串) */
export function frameSvg(st: ReelState, l: number, D: number): string {
  if (!st.scene) return ''
  const cur = DRAW[st.scene](l, D)
  const f = clamp(l / FADE)
  let s = ''
  if (st.prev && f < 1) {
    const old = DRAW[st.prev](1000, 1000)
    s += `<rect width="${W}" height="${H}" fill="${old.bg}"/><g opacity="${n2(1 - f)}">${old.body}</g>`
    s += `<g opacity="${n2(f)}"><rect width="${W}" height="${H}" fill="${cur.bg}"/>${cur.body}</g>`
  } else s += `<rect width="${W}" height="${H}" fill="${cur.bg}"/>${cur.body}`
  return s
}

const actor = defineActor<'scene', ReelStep, object, ReelState, Target>({
  name: 'archify-reel',
  kinds: ['scene'],
  init() {
    return { scene: null, prev: null }
  },
  apply,
  duration(_kind, step) {
    return T[(step.scene ?? 'growth') as Scene] ?? 5000
  },
  autoFocus() {
    return undefined
  },
  mount(root) {
    root.classList.add('A-archify-reel')
    root.innerHTML = `<svg class="ar-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"></svg>`
    const svg = root.querySelector<SVGSVGElement>('.ar-svg')!
    let last = ''
    return {
      render(frame, ms) {
        const view = frame.view
        if (!view) return
        const ev = view.ev
        const running = ev && ev.kind !== 'hide'
        // 動作進行中:依動作自己的進度;結束後停在最後一格(迴圈小動畫仍依舞台時間走)
        const D = running ? Math.max(1, ev!.dur) : 1000
        const l = running ? ev!.local : 100000 + ms
        const html = frameSvg(view.state, l, D)
        if (html !== last) {
          last = html
          svg.innerHTML = html
        }
      },
      target() {
        return root
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
