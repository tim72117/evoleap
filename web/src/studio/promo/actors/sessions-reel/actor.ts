// 演員 sessions-reel:「Claude Code 跨 session 通訊」宣傳片裡畫出來的幾段(直式 1080×1920;研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 中間「擬真」的 session 對話用 claude-desktop 演員演(腳本裡 hide 這個演員、show claude-desktop,再切回來);這裡只畫開場、痛點、好處、結尾。
// 所有動畫由 render 依時間算出,不用 CSS 動畫、不用 Math.random。畫面裡的專案(App、套件)都是示意。
//
// props:無
//
// 動作(任何一步都可以寫 ms 指定長度):
//   { "scene": "hook" }     開場:同時開好幾個 session,你夾在中間傳話
//   { "scene": "pain" }     痛點:複製貼上到另一個 session,對方不懂背景還要重講
//   { "scene": "fetch" }    情境一 取資料:詢問資料規格(三張撲克牌攤開,翻開第一張;圖示是資料庫)
//   { "scene": "send" }     情境二 傳訊:使用上有問題,傳訊息通知對方(翻開第二張;圖示是信封加驚嘆號)
//   { "scene": "coord" }    情境三 協調溝通:溝通細節後修正、發布並通知(翻開第三張;圖示是兩端循環箭頭加確認)
//   { "scene": "follow" }   結尾:追蹤 evoleap 粉絲團,定期提供 AI 資訊
//
// 目標:window
import { defineActor, type CommonStepFields } from '../../../../live/types'
import { H, W, clamp, n2, type SceneOut } from '../archify-reel/draw'
import { coord, fetch, follow, hook, pain, send } from './scenes'
import './actor.css'

export const SCENES = ['hook', 'pain', 'fetch', 'send', 'coord', 'follow'] as const
export type Scene = (typeof SCENES)[number]
export type ReelStep = CommonStepFields & { scene?: Scene }
export interface ReelState {
  scene: Scene | null
  prev: Scene | null
}
export type Target = 'window'

export const DRAW: Record<Scene, (l: number, D: number) => SceneOut> = { hook, pain, fetch, send, coord, follow }
/** 各段的預設長度(毫秒;腳本通常自己寫 ms) */
export const T: Record<Scene, number> = { hook: 3800, pain: 5000, fetch: 4800, send: 3800, coord: 4600, follow: 4200 }
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
    const old = DRAW[st.prev](1000000, 1000)
    s += `<rect width="${W}" height="${H}" fill="${old.bg}"/><g opacity="${n2(1 - f)}">${old.body}</g>`
    s += `<g opacity="${n2(f)}"><rect width="${W}" height="${H}" fill="${cur.bg}"/>${cur.body}</g>`
  } else s += `<rect width="${W}" height="${H}" fill="${cur.bg}"/>${cur.body}`
  return s
}

const actor = defineActor<'scene', ReelStep, object, ReelState, Target>({
  name: 'sessions-reel',
  kinds: ['scene'],
  init() {
    return { scene: null, prev: null }
  },
  apply,
  duration(_kind, step) {
    return T[(step.scene ?? 'hook') as Scene] ?? 5000
  },
  autoFocus() {
    return undefined
  },
  mount(root) {
    root.classList.add('A-sessions-reel')
    root.innerHTML = `<svg class="ss-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"></svg>`
    const svg = root.querySelector<SVGSVGElement>('.ss-svg')!
    let last = ''
    return {
      render(frame, ms) {
        const view = frame.view
        if (!view) return
        const ev = view.ev
        const running = ev && ev.kind !== 'hide'
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
