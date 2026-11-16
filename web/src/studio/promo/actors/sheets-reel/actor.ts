// 演員 sheets-reel:Claude Sheets 最近發布功能的 FB Reels 功能說明片(直式 1080×1920;研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 做法同 archify-reel:全部用圖形「模擬」畫面,沒有講解用字卡;所有動畫由 render 依時間算出,不用 CSS 動畫、不用 Math.random。
// 內容出自數位時代 2026-11-11 報導與其他二手報導(未讀 Anthropic 官方原文);試算表裡的資料是示意,合計是真的加總。
//
// props:無
//
// 動作(任何一步都可以寫 ms 指定長度):
//   { "scene": "intro" }    開場:名稱、BETA、「最值得看的三個功能」
//   { "scene": "open" }     步驟 1:Artifacts 點「新增」→ 選 Sheets → 空白試算表
//   { "scene": "ask" }      特色 1:Ask Claude 打字描述 → 試算表一列列長出來、分頁與公式
//   { "scene": "edit" }     特色 2:請 Claude 改一格 → 改過的儲存格框起來、「已更新 2 個儲存格」→ 按復原
//   { "scene": "share" }    特色 3:點分享、邀請成員 → 團隊與 Claude 的游標一起在表格上
//   { "scene": "export" }   步驟 5:點匯出 → 選 .xlsx → 檔案出現
//   { "scene": "outro" }    收尾:網頁、桌面、行動;目前是基本功能
//
// 目標:window
import { defineActor, type CommonStepFields } from '../../../../live/types'
import { H, W, clamp, n2, type SceneOut } from '../archify-reel/draw'
import { ask, edit, exportScene, intro, open, outro, share } from './scenes'
import './actor.css'

export const SCENES = ['intro', 'open', 'ask', 'edit', 'share', 'export', 'outro'] as const
export type Scene = (typeof SCENES)[number]
export type ReelStep = CommonStepFields & { scene?: Scene }
export interface ReelState {
  scene: Scene | null
  prev: Scene | null
}
export type Target = 'window'

export const DRAW: Record<Scene, (l: number, D: number) => SceneOut> = { intro, open, ask, edit, share, export: exportScene, outro }
/** 各段的預設長度(毫秒;腳本通常自己寫 ms) */
export const T: Record<Scene, number> = { intro: 3000, open: 6000, ask: 6500, edit: 5800, share: 6200, export: 4500, outro: 3500 }
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
  name: 'sheets-reel',
  kinds: ['scene'],
  init() {
    return { scene: null, prev: null }
  },
  apply,
  duration(_kind, step) {
    return T[(step.scene ?? 'intro') as Scene] ?? 5000
  },
  autoFocus() {
    return undefined
  },
  mount(root) {
    root.classList.add('A-sheets-reel')
    root.innerHTML = `<svg class="sr-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"></svg>`
    const svg = root.querySelector<SVGSVGElement>('.sr-svg')!
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
