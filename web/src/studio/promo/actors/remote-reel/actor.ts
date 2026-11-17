// 演員 remote-reel:「在家用手機遠端使用辦公室電腦上的 Claude Code session」宣傳片裡畫出來的幾段(直式 1080×1920;研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 畫面裡的辦公室電腦、手機、專案與指令都是示意:辦公室電腦(藍)跟家裡的手機(綠)連著同一個 session。
// 所有動畫由 render 依時間算出,不用 CSS 動畫、不用 Math.random。
//
// props:無
//
// 動作(任何一步都可以寫 ms 指定長度):
//   { "scene": "hook" }      開場:下班了,辦公室電腦上的 Claude Code 還在跑,你先回家
//   { "scene": "pain" }      痛點:跑到一半卡在等你允許,你人在家,只能等明天進公司
//   { "scene": "link" }      轉折:辦公室電腦上的 session,在家用手機接著操作(同一個 session)
//   { "scene": "phone" }     手機操作:看到同一個對話,按「允許」,辦公室電腦立刻繼續做
//   { "scene": "benefits" }  三個好處:手機看進度、手機按允許、程式與檔案留在原本那台電腦
//   { "scene": "guide" }    詳細步驟:下方拉出 evoleap 網頁預覽(Claude Code 工作術的這一段影片;示意動畫,不是真的連結)
//   { "scene": "follow" }    結尾:追蹤 evoleap 粉絲團,定期提供 AI 資訊(沿用 sessions-reel 的結尾)
//
// 目標:window
import { defineActor, type CommonStepFields } from '../../../../live/types'
import { H, W, clamp, n2, type SceneOut } from '../archify-reel/draw'
import { benefits, follow, guide, hook, link, pain, phoneUse } from './scenes'
import './actor.css'

export const SCENES = ['hook', 'pain', 'link', 'phone', 'benefits', 'guide', 'follow'] as const
export type Scene = (typeof SCENES)[number]
export type ReelStep = CommonStepFields & { scene?: Scene }
export interface ReelState {
  scene: Scene | null
  prev: Scene | null
}
export type Target = 'window'

export const DRAW: Record<Scene, (l: number, D: number) => SceneOut> = { hook, pain, link, phone: phoneUse, benefits, guide, follow }
/** 各段的預設長度(毫秒;腳本通常自己寫 ms) */
export const T: Record<Scene, number> = { hook: 4800, pain: 4400, link: 4400, phone: 7000, benefits: 5200, guide: 5200, follow: 3600 }
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
  name: 'remote-reel',
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
    root.classList.add('A-remote-reel')
    root.innerHTML = `<svg class="rr-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"></svg>`
    const svg = root.querySelector<SVGSVGElement>('.rr-svg')!
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
