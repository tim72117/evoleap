// 演員 kid-reel:兒童課宣傳片(FB Reels,直式)的場景(研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 三段:
//   1. 開場標題(opener)
//   2. 平板:畫出平板機身,真正的兒童課演員(kid-tree、lt9-wear、lt10-magic…)疊在螢幕上演(腳本的 place = layout.ts 的 PLACE);
//      平板上方是亮點標籤(point),最後收成亮點清單(recap)。
//      「這一課學會什麼」的浮空字卡要壓在課程演員上面,另外是一位演員 kid-reel-cards(learn.ts,動作 learn),排在演員表最後
//   3. 書桌:比較寫實的一段,從孩子的側後方拍,孩子在桌上用平板上課:先在學習畫面上操作(deskLearn),再切到骰子遊戲點螢幕(deskTap)
// 畫面細節分在 tablet.ts(開場、平板、亮點)與 desk.ts(書桌鏡頭),這裡只管狀態、時間與分派。
// 所有動畫由 render 依時間算出(SPEC 第 1 節)。place 用 "full"、放在演員表最前面,課程演員排在後面(疊在上面)。
//
// props:無
//
// 動作(操作式;任何一步都可以寫 ms 指定長度,整段動畫依比例放慢或加快):
//   { "opener": "標題", "kicker": "小字" }   開場標題(kicker 選用);寫 "opener": false 收起
//   { "tablet": true | false }               平板滑進來/滑走(滑進來時開場標題自動收起)
//   { "point": "亮點" }                      平板上方換一個亮點標籤;寫 false 收起
//   { "recap": ["亮點1", "亮點2", …] }        平板縮小退後,亮點一條條列出來;寫 false 收起
//   { "desk": true | false }                 切到/離開書桌鏡頭(切過去時平板、亮點都收起)
//   { "deskLearn": "drag" }                 書桌鏡頭的學習畫面:孩子把「1 到 6」積木拖進魔法積木的空格(要先 desk)
//   { "deskLearn": "answer" }               學習畫面的小測驗「會擲出 8 嗎？」點「不會」,答對打勾(要先 drag)
//   { "deskLearn": "play" }                 按「換你擲骰子」,畫面往左滑到骰子遊戲(要先 answer)
//   { "deskTap": true | "cheer" }            骰子遊戲裡孩子按一下「擲骰子」(要先 deskLearn: "play");
//                                            寫 "cheer" 的那一次擲完就慶祝(彩紙、星星、「太棒了！」,進度條直接滿、星星全亮);
//                                            沒寫 cheer 時第 3 次照舊慶祝
//
// 目標:window、tablet、screen、chip、desk
import { kit } from '../../../../live/kit'
import { defineActor, type CommonStepFields } from '../../../../live/types'
import { mountDesk } from './desk'
import { DESIGN } from './layout'
import { mountTablet } from './tablet'
import './actor.css'

// ---------- 型別 ----------
export const KINDS = ['opener', 'tablet', 'point', 'recap', 'desk', 'deskLearn', 'deskTap'] as const
export const LEARN = ['drag', 'answer', 'play'] as const
export type Learn = (typeof LEARN)[number]
/** 沒寫 "cheer" 時第幾次擲骰子慶祝(舊腳本的行為) */
export const CHEER_TAP = 3
export type Kind = (typeof KINDS)[number]
export type ReelStep = CommonStepFields & {
  opener?: string | false
  kicker?: string
  tablet?: boolean
  point?: string | false
  recap?: string[] | false
  desk?: boolean
  deskLearn?: Learn
  deskTap?: true | 'cheer'
}
export type Target = 'window' | 'tablet' | 'screen' | 'chip' | 'desk'

export interface ReelState {
  opener: { text: string; kicker: string } | null
  tablet: boolean
  point: string | null
  /** 第幾個亮點(從 1 開始;換亮點時 +1,畫面用它決定標籤的編號與換場方向) */
  pointN: number
  recap: string[] | null
  desk: boolean
  /** 書桌鏡頭的學習畫面做到哪:0 還沒動、1 積木拖好了、2 測驗答對了、3 已經切到骰子遊戲 */
  learn: number
  /** 骰子遊戲裡第幾次擲完要慶祝(寫 "cheer" 的那一次,或第 3 次);還沒慶祝是 0 */
  cheerAt: number
  /** 骰子遊戲裡擲了幾次(平板畫面依它換) */
  taps: number
}

// ---------- 時間表(毫秒) ----------
export const T = {
  opener: 2200,
  tablet: 1000,
  point: 900,
  recap: 2800,
  desk: 1600,
  deskLearn: 1600,
  deskTap: 1500,
}

export function apply(st: ReelState, kind: Kind, s: ReelStep): ReelState {
  switch (kind) {
    case 'opener':
      if (s.opener === false) return { ...st, opener: null }
      if (typeof s.opener !== 'string' || !s.opener.trim()) throw new Error('opener 要寫標題(字串)或 false')
      return { ...st, opener: { text: s.opener, kicker: s.kicker ?? '' } }
    case 'tablet':
      if (typeof s.tablet !== 'boolean') throw new Error('tablet 要寫 true 或 false')
      if (s.tablet === st.tablet) throw new Error(`tablet:平板已經${s.tablet ? '在畫面上' : '收起來'}了`)
      return { ...st, tablet: s.tablet, opener: s.tablet ? null : st.opener, desk: s.tablet ? false : st.desk }
    case 'point':
      if (s.point === false) return { ...st, point: null }
      if (typeof s.point !== 'string' || !s.point.trim()) throw new Error('point 要寫亮點(字串)或 false')
      if (!st.tablet) throw new Error('point:要先 tablet 讓平板出來')
      return { ...st, point: s.point, pointN: st.pointN + 1 }
    case 'recap':
      if (s.recap === false) return { ...st, recap: null }
      if (!Array.isArray(s.recap) || !s.recap.length || s.recap.some((x) => typeof x !== 'string')) throw new Error('recap 要寫亮點清單(字串陣列)或 false')
      return { ...st, recap: s.recap, point: null }
    case 'desk':
      if (typeof s.desk !== 'boolean') throw new Error('desk 要寫 true 或 false')
      if (s.desk === st.desk) throw new Error(`desk:已經${s.desk ? '在' : '不在'}書桌鏡頭了`)
      return s.desk ? { ...st, desk: true, tablet: false, point: null, recap: null, opener: null, learn: 0, taps: 0, cheerAt: 0 } : { ...st, desk: false }
    case 'deskLearn': {
      if (!st.desk) throw new Error('deskLearn:要先 desk 切到書桌鏡頭')
      const i = LEARN.indexOf(s.deskLearn as Learn)
      if (i < 0) throw new Error('deskLearn 要寫 "drag"、"answer" 或 "play"')
      if (i !== st.learn) throw new Error(`deskLearn:"${s.deskLearn}"的前一步要先做(順序是 drag → answer → play)`)
      return { ...st, learn: i + 1 }
    }
    case 'deskTap':
      if (!st.desk) throw new Error('deskTap:要先 desk 切到書桌鏡頭')
      if (st.learn < LEARN.length) throw new Error('deskTap:要先 deskLearn: "play" 切到骰子遊戲')
      if (s.deskTap !== true && s.deskTap !== 'cheer') throw new Error('deskTap 要寫 true 或 "cheer"')
      return { ...st, taps: st.taps + 1, cheerAt: s.deskTap === 'cheer' || st.taps + 1 === CHEER_TAP ? st.taps + 1 : st.cheerAt }
  }
}

export const kindIn = (kind: string, step: object): Kind | null =>
  (KINDS as readonly string[]).includes(kind) ? (kind as Kind) : kind === 'show' || kind === 'hide' || kind === 'props' ? (KINDS.find((k) => k in step) ?? null) : null

/** 交給 tablet.ts、desk.ts 的畫面資料 */
export interface ReelFrame {
  st: ReelState
  prev: ReelState
  /** 正在進行的動作(沒有就 null) */
  kind: Kind | null
  /** 動作開始後經過的時間(已換算回自然長度的時間軸) */
  l: number
  /** 動作的自然長度 */
  dur: number
  /** 舞台的絕對時間(閃爍、呼吸這類循環動畫用) */
  ms: number
}

const actor = defineActor<Kind, ReelStep, object, ReelState, Target>({
  name: 'kid-reel',
  kinds: KINDS,

  init() {
    return { opener: null, tablet: false, point: null, pointN: 0, recap: null, desk: false, learn: 0, taps: 0, cheerAt: 0 }
  },
  apply,
  duration(kind) {
    return T[kind]
  },
  autoFocus() {
    return undefined
  },

  mount(root) {
    root.classList.add('A-kid-reel')
    root.innerHTML = `<div class="kr-canvas"><div class="kr-tablet-layer"></div><div class="kr-desk-layer"></div></div>`
    const canvas = root.querySelector<HTMLElement>('.kr-canvas')!
    const tablet = mountTablet(root.querySelector<HTMLElement>('.kr-tablet-layer')!)
    const desk = mountDesk(root.querySelector<HTMLElement>('.kr-desk-layer')!)

    // 1080×1920 的設計座標依根元素大小等比例縮放、置中(橫式時縮在中央一欄)
    let sizeKey = ''
    const setSize = (w: number, h: number): void => {
      if (!(w > 0 && h > 0)) return
      const key = `${w}x${h}`
      if (key === sizeKey) return
      sizeKey = key
      const sc = Math.min(w / DESIGN.w, h / DESIGN.h)
      kit.css(canvas, { transform: `translate(${((w - DESIGN.w * sc) / 2).toFixed(2)}px, ${((h - DESIGN.h * sc) / 2).toFixed(2)}px) scale(${sc.toFixed(5)})` })
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
        const kind = ev ? kindIn(ev.kind, ev.step) : null
        const natural = kind ? T[kind] : 0
        const scale = natural > 0 && ev && ev.dur > 0 ? natural / ev.dur : 1
        const f: ReelFrame = {
          st: ev?.kind === 'hide' ? view.prev : view.state,
          prev: view.prev,
          kind,
          l: (ev?.local ?? 0) * scale,
          dur: natural || (ev?.dur ?? 1),
          ms,
        }
        tablet.render(f)
        desk.render(f)
      },
      target(name) {
        if (name === 'window') return root
        return tablet.target(name as Target) ?? desk.target(name as Target)
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
