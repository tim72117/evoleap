// 演員 kid-reel-cards:兒童課宣傳片的「浮空字卡」上層(研發基地專用;登記在 ../../registerActors.ts)。
// kid-reel 排在演員表最前面、課程演員疊在它上面,字卡壓到平板螢幕時會被課程演員蓋住;
// 所以字卡另外做成一位演員,排在演員表最後(place 用 "full"),只畫字卡,其他什麼都不畫。
// 字卡告訴觀眾「這一課學會什麼」:斜斜地浮在平板下緣(壓著機身),有景深、玻璃感、柔和陰影,會輕輕漂浮;
// 換一課時舊字卡往上飄走、新字卡浮上來。所有動畫由 render 依時間算出(SPEC 第 1 節)。
//
// props:無
//
// 動作:
//   { "learn": "網頁是一棵樹", "also": "樹改了，畫面就跟著改" }   浮出字卡:主卡寫「這一課學會」與 learn,副卡寫 also(選用);
//                                                                 已經有字卡時,舊的飄走、新的浮上來;
//                                                                 "side": "right" 主卡改放右邊、副卡放左邊(避開演員左下角要操作的東西)
//   { "learn": "先跟著老師學", "plain": true, "at": "top" }      說明卡:plain 不加「這一課學會」字頭(換成小圖示);
//                                                                 at "top" 放在畫面上方(書桌鏡頭的窗光區),預設 "bottom" 壓著平板下緣
//   { "learn": false }                                           字卡飄走
// 字卡的進出場照自己的長度(約 0.9 秒)演完,不跟著步驟的 ms 縮短:可以寫極短的 ms、pause 0,
// 讓字卡在別的演員動作時一起浮出來(用 frame.events 的經過時間算,步驟結束後動畫照樣接著演)。
//
// 目標:window、main(主卡)、also(副卡)
import { kit } from '../../../../live/kit'
import { defineActor, type CommonStepFields } from '../../../../live/types'
import { DESIGN, SAFE, TABLET } from './layout'
import './learn.css'

const { clamp, lerp, ease, esc } = kit

export const KINDS = ['learn'] as const
type Kind = (typeof KINDS)[number]
export type Side = 'left' | 'right'
export type At = 'bottom' | 'top'
export type CardsStep = CommonStepFields & { learn?: string | false; also?: string; side?: Side; plain?: boolean; at?: At }
type Target = 'window' | 'main' | 'also'

export interface Card {
  learn: string
  also: string
  /** 主卡在哪一邊(副卡在另一邊) */
  side: Side
  /** 說明卡:不加「這一課學會」字頭,改成一個小圖示 */
  plain: boolean
  /** 放在平板下緣(bottom,預設)或畫面上方(top,書桌鏡頭的窗光區) */
  at: At
}
export interface CardsState {
  card: Card | null
  /** 第幾組字卡(換一組 +1;畫面用它決定字卡的傾斜方向) */
  n: number
}

export const T = { learn: 900 }

export function apply(st: CardsState, _kind: Kind, s: CardsStep): CardsState {
  if (s.learn === false) {
    if (!st.card) throw new Error('learn:false:畫面上沒有字卡')
    return { ...st, card: null }
  }
  if (typeof s.learn !== 'string' || !s.learn.trim()) throw new Error('learn 要寫這一課學會什麼(字串)或 false')
  if (s.also != null && typeof s.also !== 'string') throw new Error('also 要寫字串')
  if (s.side != null && s.side !== 'left' && s.side !== 'right') throw new Error('side 要寫 left 或 right')
  if (s.at != null && s.at !== 'bottom' && s.at !== 'top') throw new Error('at 要寫 bottom 或 top')
  if (s.plain != null && typeof s.plain !== 'boolean') throw new Error('plain 要寫 true 或 false')
  return { card: { learn: s.learn, also: s.also ?? '', side: s.side ?? 'left', plain: !!s.plain, at: s.at ?? 'bottom' }, n: st.n + 1 }
}

/** 字卡的位置(設計座標):主卡靠左、壓著平板下緣;副卡靠右、再低一點。都在安全區裡(右側 x 960、下方 22% 以外) */
export const CARD = {
  main: { x: SAFE.x + 6, bottom: TABLET.y + TABLET.h - 62, tilt: -3.2 },
  also: { right: SAFE.x + SAFE.w - 8, bottom: TABLET.y + TABLET.h - 24, tilt: 2.4 },
  /** at "top":卡片的上緣(畫面上方、安全區頂端往下一點);主卡左右照 side,離安全區左右邊各留 inset */
  top: { y: SAFE.y + 60, inset: 40 },
}

const BULB =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.1.9 1.8v.5h6v-.5c0-.7.3-1.3.9-1.8A6.5 6.5 0 0 0 12 2.5Z"/><rect x="9" y="18" width="6" height="2" rx="1"/><rect x="10" y="21" width="4" height="1.6" rx=".8"/></svg>'
const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.3 6.2L20.5 10l-6.2 2.3L12 18.5l-2.3-6.2L3.5 10l6.2-1.8Z"/><circle cx="19" cy="19" r="2"/></svg>'

const cardsHtml = (): string =>
  `<div class="kc-card kc-main"><div class="kc-glass"></div><div class="kc-body"><span class="kc-kicker">${BULB}這一課學會</span><span class="kc-ico kc-ico-plain">${SPARK}</span><b class="kc-text"></b></div><i class="kc-sheen"></i></div>` +
  `<div class="kc-card kc-also"><div class="kc-glass"></div><div class="kc-body"><span class="kc-ico">${SPARK}</span><span class="kc-text"></span></div><i class="kc-sheen"></i></div>`

const actor = defineActor<Kind, CardsStep, object, CardsState, Target>({
  name: 'kid-reel-cards',
  kinds: KINDS,
  init() {
    return { card: null, n: 0 }
  },
  apply,
  duration() {
    return T.learn
  },
  autoFocus() {
    return undefined
  },

  mount(root) {
    root.classList.add('A-kid-reel-cards')
    // 兩組字卡輪流用:換一課時舊的那組飄走、新的那組浮上來
    root.innerHTML = `<div class="kc-canvas"><div class="kc-set">${cardsHtml()}</div><div class="kc-set">${cardsHtml()}</div></div>`
    const canvas = root.querySelector<HTMLElement>('.kc-canvas')!
    const sets = [...root.querySelectorAll<HTMLElement>('.kc-set')].map((el) => ({
      el,
      main: el.querySelector<HTMLElement>('.kc-main')!,
      also: el.querySelector<HTMLElement>('.kc-also')!,
      mainText: el.querySelector<HTMLElement>('.kc-main .kc-text')!,
      alsoText: el.querySelector<HTMLElement>('.kc-also .kc-text')!,
      key: '',
    }))
    /** 擺位置:預設主卡靠左、副卡靠右;side "right" 時左右對調(副卡仍比主卡低) */
    const place = (s: (typeof sets)[number], side: Side, at: At): void => {
      const l = (x: number): string => `${x}px`
      const r = (x: number): string => `${DESIGN.w - x}px`
      const mainB = l(DESIGN.h - CARD.main.bottom)
      const alsoB = l(DESIGN.h - CARD.also.bottom)
      if (at === 'top') {
        // 畫面上方:主卡在上、副卡(若有)接在下面同一邊
        const x0 = SAFE.x + CARD.top.inset
        const x1 = SAFE.x + SAFE.w - CARD.top.inset
        const h = side === 'right' ? { left: 'auto', right: r(x1) } : { right: 'auto', left: l(x0) }
        kit.css(s.main, { ...h, top: l(CARD.top.y), bottom: 'auto' })
        kit.css(s.also, { ...h, top: l(CARD.top.y + 150), bottom: 'auto' })
        return
      }
      kit.css(s.main, { top: 'auto' })
      kit.css(s.also, { top: 'auto' })
      // 兩張卡左右放不下(主卡字多,例如「要什麼、在哪裡、長什麼樣」)時,主卡往上抬到副卡上方,不重疊
      // (offsetWidth 是設計座標的寬,不受 canvas 的 scale 影響;文字固定,所以每次量的結果都一樣)
      const alsoOn = s.also.style.visibility !== 'hidden'
      // 間距要大過漂浮的上下擺動與傾斜(兩張卡各自浮動,貼太近會擦到)
      // 只差一點(兩張卡傾斜著、上下錯開,邊角擦到看不出來)時不抬,免得主卡蓋到演員的操作區(例如 2.1 的背景色票)
      const crowded = alsoOn && s.main.offsetWidth + s.also.offsetWidth > SAFE.w + 80
      if (crowded) {
        const lift = s.also.offsetHeight + 40 - (CARD.also.bottom - CARD.main.bottom)
        if (lift > 0) kit.css(s.main, { bottom: l(DESIGN.h - CARD.main.bottom + lift) })
      }
      if (side === 'right') {
        kit.css(s.main, { left: 'auto', right: r(CARD.also.right), transformOrigin: '50% 100%', ...(crowded ? {} : { bottom: mainB }) })
        kit.css(s.also, { right: 'auto', left: l(CARD.main.x), bottom: alsoB })
      } else {
        kit.css(s.main, { right: 'auto', left: l(CARD.main.x), ...(crowded ? {} : { bottom: mainB }) })
        kit.css(s.also, { left: 'auto', right: r(CARD.also.right), bottom: alsoB })
      }
    }

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

    /** 一組字卡:p 是進場進度(0–1),q 是退場進度(0–1);n 決定這組的傾斜(單雙數左右交替) */
    const draw = (set: (typeof sets)[number], card: Card | null, n: number, p: number, q: number, ms: number): void => {
      const on = card && p > 0 && q < 1
      kit.css(set.el, { display: on ? '' : 'none' })
      if (!card || !on) return
      const key = `${card.learn}\u0000${card.also}\u0000${card.side}\u0000${card.plain}\u0000${card.at}`
      if (key !== set.key) {
        set.key = key
        set.mainText.innerHTML = esc(card.learn)
        set.alsoText.innerHTML = esc(card.also)
        kit.css(set.also, { visibility: card.also ? '' : 'hidden' })
        set.main.classList.toggle('kc-plain', card.plain)
        place(set, card.side, card.at)
      }
      const flip = n % 2 ? 1 : -1
      const parts: [HTMLElement, number, number, number][] = [
        // 元素、延遲(ms)、傾斜、景深(0 近、1 遠)
        [set.main, 0, CARD.main.tilt * (flip < 0 ? 1 : 0.7), 0],
        [set.also, 170, CARD.also.tilt * (flip < 0 ? 1 : 1.3), 1],
      ]
      parts.forEach(([el, delay, tilt, depth], i) => {
        // 進場:從下方浮上來、由模糊變清楚、略微回彈;退場:往上飄走、轉一點、淡出
        const pIn = clamp((p * T.learn - delay) / (T.learn - 260))
        const e = ease.outBack(pIn)
        const out = ease.inCubic(clamp((q * T.learn - delay * 0.6) / (T.learn * 0.55)))
        const t = ms / 1000
        // 待機漂浮:上下、左右、傾斜都很小;兩張卡不同步
        const fy = Math.sin(t * 1.25 + i * 1.9) * (5 - depth * 1.5)
        const fx = Math.cos(t * 0.8 + i * 2.3) * 3
        const fr = Math.sin(t * 0.9 + i) * 0.6
        const ry = Math.sin(t * 0.7 + i * 1.4) * 4
        const y = (1 - e) * 120 + fy - out * 150
        const x = fx + out * (i ? 40 : -40)
        const rot = tilt + fr + (1 - e) * 4 * flip + out * 5 * (i ? 1 : -1)
        const sc = lerp(0.82, 1, e) * (1 - depth * 0.04) * (1 + out * 0.04)
        const blur = (1 - clamp(pIn * 1.4)) * 10 + out * 8
        kit.css(el, {
          opacity: (clamp(pIn * 1.8) * (1 - out)).toFixed(3),
          transform: `perspective(1400px) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateX(${(6 * (1 - e)).toFixed(2)}deg) scale(${sc.toFixed(4)})`,
          filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none',
        })
        // 卡片上的光:進場時掃過一次,之後跟著漂浮慢慢移動
        const sweep = clamp((p * T.learn - delay - 300) / 600)
        const sheen = el.querySelector<HTMLElement>('.kc-sheen')!
        kit.css(sheen, { opacity: sweep > 0 && sweep < 1 ? '1' : '0', transform: `translateX(${lerp(-200, 900, ease.inOutQuad(sweep)).toFixed(1)}px) skewX(-20deg)` })
      })
    }

    return {
      render(frame, ms) {
        if (!sizeKey) setSize(root.offsetWidth, root.offsetHeight)
        const view = frame.view
        if (!view) return
        // 字卡的動畫照自己的長度(T.learn)演完,不跟著步驟的 ms 縮短:
        // 用最後一個 learn 動作開始後經過的時間(frame.events 的 local 不會停在步驟結束),
        // 所以腳本可以寫極短的 ms、pause 0,字卡跟著別的演員的動作一起浮出來,整支片不會變長
        const last = frame.events[frame.events.length - 1]
        const active = !!last && last.local < T.learn
        const st = view.state
        const prev = view.prev
        const l = active ? Math.max(0, last.local) : Infinity
        const p = clamp(l / T.learn)
        if (active && prev.card && st.card && prev.n !== st.n) {
          // 換一組:舊的(用上一組的位置)飄走,新的浮上來
          const iOld = prev.n % 2
          draw(sets[iOld], prev.card, prev.n, 1, clamp(l / (T.learn * 0.6)), ms)
          draw(sets[1 - iOld], st.card, st.n, clamp((l - 220) / (T.learn - 220)), 0, ms)
        } else if (active && prev.card && !st.card) {
          draw(sets[prev.n % 2], prev.card, prev.n, 1, p, ms)
          draw(sets[1 - (prev.n % 2)], null, 0, 0, 1, ms)
        } else {
          draw(sets[st.n % 2], st.card, st.n, st.card ? p : 0, 0, ms)
          draw(sets[1 - (st.n % 2)], null, 0, 0, 1, ms)
        }
      },
      target(name) {
        if (name === 'window') return root
        const set = sets.find((s) => s.el.style.display !== 'none') ?? sets[0]
        return name === 'main' ? set.main : name === 'also' ? set.also : null
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
