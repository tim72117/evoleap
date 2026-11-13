// 演員 ai-tools-reel:FB Reels(直式)宣傳片「文組也能用 AI 寫工具」的整支畫面(研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 全部是 SVG 插畫,畫面是時間的純函式(SPEC 第 1 節):一個動作就是一個場景,場景內的動畫依時間算出,
// 腳本裡給這一步的 ms 會把整段場景依比例放慢或加快;場景之間用交叉淡入換場。place 用 "full"。
//
// props:無
//
// 動作:
//   { "scene": "pain" }       文組的人被作文、排班表、合約淹沒,想著「要是有個工具」
//   { "scene": "ask" }        用幾句話跟 AI 說需求,程式碼自己長出來,小工具跳出來
//   { "scene": "teacher" }    案例:國文老師的作文批改輔助工具
//   { "scene": "nurse" }      案例:護理排班檢查工具
//   { "scene": "lawyer" }     案例:法務的合約版本比對工具
//   { "scene": "historian" }  案例:研究者的史料時間軸整理工具
//   { "scene": "toolbox" }    四個工具縮成圖示,排進同一個工具箱,人安心地笑
//   { "scene": "course" }     evoleap 的課程地圖與互動課程畫面,階梯表現起步 → 零基礎 → 基礎
//   { "scene": "brand" }      evoleap 標誌與瀏覽器網址列(evoleap.io)
//
// 目標:window
import { kit } from '../../../../live/kit'
import { defineActor, type CommonStepFields } from '../../../../live/types'
import { H, W, clamp } from './util'
import { background, NATURAL, SCENES, sceneSvg, type SceneId } from './scenes'
import './actor.css'

export const KINDS = ['scene'] as const
export type Kind = (typeof KINDS)[number]
export type ReelStep = CommonStepFields & { scene?: SceneId }
export type Target = 'window'

export interface ReelState {
  scene: SceneId | null
  prev: SceneId | null
}

/** 換場交叉淡入的長度(毫秒,實際時間) */
export const CROSSFADE = 520

export function apply(st: ReelState, _kind: Kind, s: ReelStep): ReelState {
  if (!s.scene || !(SCENES as readonly string[]).includes(s.scene)) throw new Error(`scene 要寫 ${SCENES.join('、')} 其中一個`)
  return { scene: s.scene, prev: st.scene }
}

/** 共用的 defs:模糊陰影與各種裁切形狀 */
export const DEFS =
  `<defs><filter id="blur18" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>` +
  `<clipPath id="clipPanel"><rect x="0" y="0" width="870" height="1000" rx="40"/></clipPath>` +
  `<clipPath id="clipWin"><rect x="0" y="0" width="870" height="1000" rx="30"/></clipPath>` +
  `<clipPath id="clipAv"><circle cx="0" cy="0" r="34"/></clipPath>` +
  `<clipPath id="clipBadge"><circle cx="0" cy="0" r="60"/></clipPath>` +
  `<clipPath id="clipHero"><circle cx="0" cy="0" r="38"/></clipPath>` +
  `<clipPath id="clipBrowser"><rect x="0" y="0" width="870" height="820" rx="32"/></clipPath>` +
  `<clipPath id="clipPage"><rect x="0" y="0" width="400" height="700" rx="18"/></clipPath></defs>`

/** 畫某個時間點的整張 SVG(測試與演員共用) */
export function frameSvg(st: ReelState, local: number, dur: number, running: boolean, ms: number): string {
  const cur = st.scene
  if (!cur) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${DEFS}${background('pain', 0)}</svg>`
  const natural = NATURAL[cur]
  const l = running && dur > 0 ? Math.min(natural, (local * natural) / dur) : natural
  const x = running && st.prev ? clamp(local / CROSSFADE) : 1
  const parts: string[] = [DEFS]
  if (x < 1 && st.prev) {
    parts.push(background(st.prev, NATURAL[st.prev]), sceneSvg(st.prev, NATURAL[st.prev]))
    parts.push(`<g opacity="${x.toFixed(3)}">${background(cur, l)}<g transform="translate(0 ${((1 - x) * 40).toFixed(1)})">${sceneSvg(cur, l)}</g></g>`)
  } else {
    parts.push(background(cur, l), sceneSvg(cur, l))
  }
  void ms
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`
}

const actor = defineActor<Kind, ReelStep, object, ReelState, Target>({
  name: 'ai-tools-reel',
  kinds: KINDS,

  init() {
    return { scene: null, prev: null }
  },
  apply,
  duration(_kind, step) {
    return step.scene ? NATURAL[step.scene] : 1000
  },
  autoFocus() {
    return undefined
  },

  mount(root) {
    root.classList.add('A-ai-tools-reel')
    root.innerHTML = `<div class="atr-canvas"></div>`
    const canvas = root.querySelector<HTMLElement>('.atr-canvas')!
    let sizeKey = ''
    const setSize = (w: number, h: number): void => {
      if (!(w > 0 && h > 0)) return
      const key = `${w}x${h}`
      if (key === sizeKey) return
      sizeKey = key
      const sc = Math.min(w / W, h / H)
      kit.css(canvas, { transform: `translate(${((w - W * sc) / 2).toFixed(2)}px, ${((h - H * sc) / 2).toFixed(2)}px) scale(${sc.toFixed(5)})` })
    }
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(([e]) => {
        if (!root.isConnected) return ro.disconnect()
        setSize(e.contentRect.width, e.contentRect.height)
      })
      ro.observe(root)
    }
    return {
      render(frame, ms) {
        if (!sizeKey) setSize(root.offsetWidth, root.offsetHeight)
        const view = frame.view
        if (!view) return
        const ev = view.ev
        const running = !!ev && ev.kind === 'scene'
        const st = ev?.kind === 'hide' ? view.prev : view.state
        kit.setIf(canvas, 'html', frameSvg(st, ev?.local ?? 0, ev?.dur ?? 1, running, ms))
      },
      target(name) {
        return name === 'window' ? root : null
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
