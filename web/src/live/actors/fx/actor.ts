// 演員 fx:宣傳片用的特效層(參考 HyperFrames 效果目錄的做法,改寫成「時間 → 樣式」的純函式,不用 GSAP)。
// 放在演員表最後、place 用 "full",就會疊在其他演員上面;座標一律用 1920×1080 的舞台 px。
// 規格見 ../../README.md「演員」(2A.1)。
//
// props:無
//
// 動作(畫面類:同一時間只顯示最新的一個,演完停在最後一格,直到下一個畫面類或 clear):
//   { "logo": "evoleap", "sub": "不會寫程式，也能做軟體" }   品牌落定:標誌彈入、光環擴散,字母逐一浮現
//   { "stream": "回答文字", "prompt": "使用者的問題" }       AI 對話:問題泡泡出現,回答一段段湧出(kit.streamCount)
//   { "diff": "index.html", "lines": [[" ", "…"], ["-", "…"], ["+", "…"]] }
//                                                            程式碼差異:刪除行轉紅後收合,新增行展開並轉綠
//   { "shimmer": "標題", "sub": "副標" }                     標題浮現後,一道光掃過字面
// 動作(標註類:疊在畫面上、會累積,直到 clear 或下一個畫面類):
//   { "circle": { "x": 0, "y": 0, "w": 0, "h": 0 }, "seed": 1 }   手繪圈選:抖動的橢圓逐筆畫出,畫超過一圈收尾
//   { "arrow": { "from": [x, y], "to": [x, y] }, "label": "說明" } 手繪箭頭:線先畫出,箭頭兩筆再補上,標籤跟著浮現
// 動作(轉場類:兩步一組):
//   { "flash": true }   白閃蓋住畫面,停在全白;這時換下面的演員
//   { "whip": "left" }  甩鏡:帶動態模糊的光帶往左(right)掃過並蓋住畫面
//   { "reveal": true }  掀開前一個蓋住的效果(白閃淡出;甩鏡繼續往同方向掃走)
//   { "clear": true }   收掉畫面類與標註類
//
// 目標:window、panel(目前的畫面類)
import markSvg from '../../../../public/brand/evoleap-mark.svg?raw'
import { kit, type Point } from '../../kit'
import { defineActor, type ActorEvent, type CommonStepFields } from '../../types'
import './actor.css'

type FxKind = 'logo' | 'stream' | 'diff' | 'shimmer' | 'circle' | 'arrow' | 'flash' | 'whip' | 'reveal' | 'clear'
interface Box {
  x: number
  y: number
  w: number
  h: number
}
type DiffLine = [' ' | '-' | '+', string]
type FxStep = CommonStepFields & {
  logo?: string
  stream?: string
  prompt?: string
  diff?: string
  lines?: DiffLine[]
  shimmer?: string
  sub?: string
  circle?: Box
  seed?: number
  arrow?: { from: Point; to: Point }
  label?: string
  flash?: boolean
  whip?: 'left' | 'right'
  reveal?: boolean
  clear?: boolean
}
type FxTarget = 'window' | 'panel'

const KINDS: readonly FxKind[] = ['logo', 'stream', 'diff', 'shimmer', 'circle', 'arrow', 'flash', 'whip', 'reveal', 'clear']
const PANEL: readonly FxKind[] = ['logo', 'stream', 'diff', 'shimmer']
const MARK: readonly FxKind[] = ['circle', 'arrow']
const COVER: readonly FxKind[] = ['flash', 'whip']
const STREAM = { start: 900, cps: 16 }

type Ev = ActorEvent<FxStep, FxKind>

/** 抖動的手繪橢圓:比一圈多畫 0.12 圈收尾,半徑用固定種子的平滑雜訊擾動 */
function wobblyEllipse(b: Box, seed = 1): { d: string; len: number } {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const rx = b.w / 2 + 18
  const ry = b.h / 2 + 14
  const pts: Point[] = []
  const steps = 72
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 1.12
    const a = -Math.PI * 0.62 + t * Math.PI * 2
    const k = 1 + kit.noise(t * 5, seed) * 0.05 + (t > 1 ? (t - 1) * 0.5 : 0)
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  let len = 0
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return { d: 'M ' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L '), len }
}

/** 箭頭:微彎的主線與兩筆箭頭(長度給 drawPath 用) */
function sketchArrow(from: Point, to: Point): { line: string; head: string; lineLen: number; headLen: number } {
  const line = kit.arrowPath(from, to, 0.18)
  const lineLen = Math.hypot(to[0] - from[0], to[1] - from[1]) * 1.05
  // 末端切線方向:二次曲線在終點的切線是 (終點 − 控制點)
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const cx = (from[0] + to[0]) / 2 - dy * 0.18
  const cy = (from[1] + to[1]) / 2 + dx * 0.18
  const ang = Math.atan2(to[1] - cy, to[0] - cx)
  const L = 34
  const a1: Point = [to[0] - Math.cos(ang - 0.5) * L, to[1] - Math.sin(ang - 0.5) * L]
  const a2: Point = [to[0] - Math.cos(ang + 0.5) * L, to[1] - Math.sin(ang + 0.5) * L]
  return { line, head: `M ${a1[0].toFixed(1)} ${a1[1].toFixed(1)} L ${to[0]} ${to[1]} L ${a2[0].toFixed(1)} ${a2[1].toFixed(1)}`, lineLen, headLen: L * 2 }
}

const lastOf = (events: Ev[], kinds: readonly FxKind[]): Ev | null => {
  for (let i = events.length - 1; i >= 0; i--) if (kinds.includes(events[i].kind)) return events[i]
  return null
}

const actor = defineActor<FxKind, FxStep, object, undefined, FxTarget>({
  name: 'fx',
  kinds: KINDS,

  duration(kind, s) {
    switch (kind) {
      case 'logo': return 3400
      case 'stream': return kit.streamDuration(s.stream ?? '', STREAM) + 1800
      case 'diff': return 3000
      case 'shimmer': return 2600
      case 'circle': return 1000
      case 'arrow': return 1100
      case 'flash': return 420
      case 'whip': return 380
      case 'reveal': return 480
      case 'clear': return 350
    }
  },

  mount(root) {
    root.classList.add('A-fx')
    root.innerHTML = `<div class="fx-panel"></div><svg class="fx-marks" viewBox="0 0 1920 1080" preserveAspectRatio="none"></svg><div class="fx-cover"></div>`
    const panel = root.querySelector<HTMLElement>('.fx-panel')!
    const marks = root.querySelector<SVGSVGElement>('.fx-marks')!
    const cover = root.querySelector<HTMLElement>('.fx-cover')!

    function renderPanel(ev: Ev | null, fade: number): void {
      if (!ev) {
        kit.setIf(panel, 'html', '')
        return
      }
      const s = ev.step
      const l = ev.local
      panel.style.opacity = fade.toFixed(3)
      if (ev.kind === 'logo') {
        const word = kit.graphemes(s.logo ?? '')
        kit.setIf(panel, 'html', `<div class="fx-logo" data-key="${ev.start}"><div class="fx-ring"></div><div class="fx-mark">${markSvg}</div><div class="fx-word">${word.map((c) => `<span>${kit.esc(c)}</span>`).join('')}</div>${s.sub ? `<p class="fx-sub">${kit.rich(s.sub)}</p>` : ''}</div>`)
        // 標誌:彈簧放大(會稍微超過再回來)、模糊變清晰
        const sp = kit.spring(l - 100, { stiffness: 210, damping: 14 })
        const mark = panel.querySelector<HTMLElement>('.fx-mark')!
        kit.css(mark, { transform: `scale(${kit.lerp(0.4, 1, sp).toFixed(4)})`, opacity: kit.progress(l, 100, 250).toFixed(3), filter: `blur(${((1 - kit.progress(l, 100, 420)) * 10).toFixed(2)}px)` })
        // 光環:標誌落定時擴散一次
        const rp = kit.progress(l, 450, 900)
        kit.css(panel.querySelector<HTMLElement>('.fx-ring')!, { transform: `scale(${kit.lerp(0.6, 2.1, kit.ease.outCubic(rp)).toFixed(4)})`, opacity: (rp > 0 ? 0.55 * (1 - rp) : 0).toFixed(3) })
        panel.querySelectorAll<HTMLElement>('.fx-word span').forEach((el, i) => kit.css(el, kit.blurIn(kit.progress(l, 750 + i * 70, 460))))
        const sub = panel.querySelector<HTMLElement>('.fx-sub')
        if (sub) kit.css(sub, kit.enter(kit.progress(l, 750 + word.length * 70 + 300, 500), { dist: '0.6em' }))
      } else if (ev.kind === 'stream') {
        kit.setIf(panel, 'html', `<div class="fx-chat" data-key="${ev.start}"><div class="fx-q">${kit.esc(s.prompt ?? '')}</div><div class="fx-a"><span class="fx-a-text"></span><span class="fx-dot"></span></div></div>`)
        const q = panel.querySelector<HTMLElement>('.fx-q')!
        q.style.display = s.prompt ? '' : 'none'
        kit.css(q, kit.enter(kit.progress(l, 0, 380), { dist: '0.8em', scale: 0.92 }))
        const text = s.stream ?? ''
        const n = kit.streamCount(text, l, STREAM)
        const all = kit.graphemes(text)
        const a = panel.querySelector<HTMLElement>('.fx-a')!
        kit.css(a, kit.enter(kit.progress(l, 450, 300), { dist: '0.5em' }))
        kit.setIf(panel.querySelector<HTMLElement>('.fx-a-text')!, 'text', n ? all.slice(0, n).join('') : kit.dots(l, 300).replace(/\./g, '·'))
        // 串流中的游標點:打完後淡掉
        const dot = panel.querySelector<HTMLElement>('.fx-dot')!
        dot.style.opacity = (n > 0 && n < all.length ? 1 : n === all.length ? 1 - kit.progress(l, kit.streamDuration(text, STREAM), 300) : 0).toFixed(3)
      } else if (ev.kind === 'diff') {
        const lines = s.lines ?? []
        kit.setIf(panel, 'html', `<div class="fx-diff" data-key="${ev.start}"><div class="fx-file">${kit.esc(s.diff ?? '')}</div>${lines.map(([t, code], i) => `<div class="fx-line" data-t="${t === ' ' ? 'same' : t === '-' ? 'del' : 'add'}"><span class="fx-no">${i + 1}</span><span class="fx-sign">${t === ' ' ? '' : t}</span><code>${kit.esc(code)}</code></div>`).join('')}</div>`)
        const box = panel.querySelector<HTMLElement>('.fx-diff')!
        kit.css(box, kit.enter(kit.progress(l, 0, 450), { dist: '1em' }))
        // 先標紅刪除行(0.5–0.9 秒),再收合(0.9–1.5 秒);新增行在 1.3–2.0 秒展開、轉綠
        const red = kit.progress(l, 500, 400)
        const shut = kit.ease.inOutCubic(kit.progress(l, 900, 600))
        const open = kit.ease.outCubic(kit.progress(l, 1300, 700))
        panel.querySelectorAll<HTMLElement>('.fx-line').forEach((el) => {
          const t = el.dataset.t
          if (t === 'del') kit.css(el, { background: `rgba(220, 70, 60, ${(0.28 * red).toFixed(3)})`, height: `${(1.75 * (1 - shut)).toFixed(3)}em`, opacity: (1 - shut * 0.9).toFixed(3) })
          else if (t === 'add') kit.css(el, { background: `rgba(60, 170, 90, ${(0.26 * open).toFixed(3)})`, height: `${(1.75 * open).toFixed(3)}em`, opacity: open.toFixed(3) })
        })
      } else if (ev.kind === 'shimmer') {
        kit.setIf(panel, 'html', `<div class="fx-shimmer" data-key="${ev.start}"><h1>${kit.rich(s.shimmer ?? '')}</h1>${s.sub ? `<p>${kit.rich(s.sub)}</p>` : ''}</div>`)
        const h1 = panel.querySelector<HTMLElement>('.fx-shimmer h1')!
        // 光帶從左外側掃到右外側(background-position 100% → 0%)
        const sweep = kit.ease.inOutCubic(kit.progress(l, 800, 1300))
        kit.css(h1, { ...kit.blurIn(kit.progress(l, 0, 600), { dist: '0.4em' }), backgroundPosition: `${kit.lerp(100, 0, sweep).toFixed(2)}% 0` })
        const sub = panel.querySelector<HTMLElement>('.fx-shimmer p')
        if (sub) kit.css(sub, kit.enter(kit.progress(l, 500, 500), { dist: '0.6em' }))
      }
    }

    function renderMarks(list: Ev[], fade: number): void {
      kit.setIf(marks, 'html', list.map((ev) => {
        if (ev.kind === 'circle' && ev.step.circle) {
          const { d } = wobblyEllipse(ev.step.circle, ev.step.seed ?? 1)
          return `<path class="fx-circle" d="${d}"/>`
        }
        const a = ev.step.arrow
        if (!a) return ''
        const { line, head } = sketchArrow(a.from, a.to)
        const lx = a.from[0]
        const ly = a.from[1] + (a.from[1] > a.to[1] ? 46 : -26)
        return `<g><path class="fx-arrow" d="${line}"/><path class="fx-arrow fx-head" d="${head}"/>${ev.step.label ? `<text class="fx-label" x="${lx}" y="${ly}" text-anchor="middle">${kit.esc(ev.step.label)}</text>` : ''}</g>`
      }).join(''))
      marks.style.opacity = fade.toFixed(3)
      const els = [...marks.children] as SVGElement[]
      list.forEach((ev, i) => {
        const el = els[i]
        if (!el) return
        if (ev.kind === 'circle' && ev.step.circle) {
          const { len } = wobblyEllipse(ev.step.circle, ev.step.seed ?? 1)
          kit.css(el as unknown as HTMLElement, kit.drawPath(kit.ease.inOutCubic(kit.progress(ev.local, 0, 850)), len))
        } else if (ev.step.arrow) {
          const { lineLen, headLen } = sketchArrow(ev.step.arrow.from, ev.step.arrow.to)
          const [lineEl, headEl, label] = [...el.children] as HTMLElement[]
          kit.css(lineEl, kit.drawPath(kit.ease.outCubic(kit.progress(ev.local, 0, 650)), lineLen))
          kit.css(headEl, kit.drawPath(kit.progress(ev.local, 620, 260), headLen))
          if (label) label.style.opacity = kit.progress(ev.local, 500, 400).toFixed(3)
        }
      })
    }

    function renderCover(ev: Ev | null, reveal: Ev | null): void {
      if (!ev) {
        cover.className = 'fx-cover'
        cover.style.opacity = '0'
        return
      }
      const out = reveal ? reveal.p : 0
      if (ev.kind === 'flash') {
        cover.className = 'fx-cover flash'
        // 蓋上:由淡到全白、先曝出一點亮光;掀開:淡出
        const inP = kit.ease.inCubic(ev.p)
        cover.style.opacity = (inP * (1 - kit.ease.outCubic(out))).toFixed(3)
        cover.style.transform = ''
        cover.style.backdropFilter = `blur(${(inP * 6 * (1 - out)).toFixed(2)}px) brightness(${(1 + inP * 0.6).toFixed(3)})`
      } else {
        const dir = ev.step.whip === 'right' ? 1 : -1
        cover.className = 'fx-cover whip'
        // 一條帶模糊的光幕:蓋上時從一側掃進到正中,掀開時繼續往同方向掃出
        const x = reveal ? kit.lerp(0, 1, kit.ease.inCubic(out)) : kit.lerp(-1, 0, kit.ease.outCubic(ev.p))
        cover.style.opacity = '1'
        cover.style.transform = `translateX(${(-dir * x * 130).toFixed(2)}%)`
        cover.style.backdropFilter = `blur(${(14 * (1 - Math.abs(x))).toFixed(2)}px)`
        // 速度線跟著移動量:蓋到正中、或剛開始掀時看不到
        cover.style.setProperty('--streak', Math.min(1, Math.abs(x) * 2.2).toFixed(3))
      }
    }

    return {
      render({ events }) {
        const evs = (events as Ev[]).filter((e) => KINDS.includes(e.kind))
        const clear = lastOf(evs, ['clear'])
        const pan = lastOf(evs, PANEL)
        const panelEv = pan && (!clear || pan.start > clear.start) ? pan : clear && pan && clear.p < 1 ? pan : null
        const panelFade = panelEv && clear && clear.start > panelEv.start ? 1 - clear.p : 1
        renderPanel(panelEv, panelFade)

        const since = Math.max(pan && pan === panelEv ? pan.start : -1, clear && clear.p >= 1 ? clear.start : -1)
        const markList = evs.filter((e) => MARK.includes(e.kind) && e.start > since)
        const markFade = clear && markList.length && clear.start > markList[markList.length - 1].start ? 1 - clear.p : 1
        renderMarks(markList, markFade)

        const cov = lastOf(evs, COVER)
        const rev = lastOf(evs, ['reveal'])
        const active = cov && (!rev || rev.start < cov.start) ? cov : cov && rev && rev.p < 1 ? cov : null
        renderCover(active, active && rev && rev.start > active.start ? rev : null)
      },

      target(name) {
        if (name === 'panel') return panel.firstElementChild as HTMLElement | null
        return root
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
