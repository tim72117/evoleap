// 演員 print3d-layers:兒童 3D 列印課「一層一層長出來」。列印平台上的模型由下往上一層一層疊起來,噴頭跟著走;
// 旁邊的面板顯示層高、疊了幾層、現在多高。規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定):
//   shape    "dome"(小圓頂,看得出一階一階;預設)、"block"(方塊)
//   height   模型高度 mm(預設 30)
//   layer    一開始的層高 mm(預設 5);height 要能被層高整除
//   printed  一開始已經疊好幾層(預設 0)
//   choices  面板下方可以點的層高按鈕,例如 [5, 3, 1, 0.2];不寫就沒有按鈕
//   yaw、pitch  一開始的視角(度;預設 34、28;yaw 不限、可轉整圈,pitch 12–65)
//
// 動作(依序操作;對不上狀態時載入就報錯):
//   { "print": "all" }     噴頭繼續往上疊到最後一層;{ "print": 2 } 疊到第 2 層(不能比現在少)
//   { "slice": 1 }         層高改成 1 mm,平台清空(要再 print)
//   { "peek": 3 }          把第 3 層拿起來看它的形狀(要已經疊到那一層);{ "peek": false } 放回去
//   { "turn": 30 }         視角往右轉 30 度(負數往左);{ "tilt": 10 } 再往下俯看 10 度
//
// 觀看者也可以直接拖曳畫面轉視角(雙擊回到腳本的視角);拖曳只影響自己看到的角度,不進時間軸。
//
// 畫面上的列印機(畫法在 scene.ts,Three.js 的透視 3D;尺與標註是疊在上面的 SVG):X 軸橫桿與皮帶、Y 軸滑軌上前後移動的熱床、Z 軸絲桿與馬達、噴頭組、線材捲、控制盒螢幕。
//
// 目標:window、model、nozzle、spool、bed、screen、xaxis(X 軸橫桿)、yaxis(Y 軸滑軌)、zaxis(Z 軸絲桿與馬達)、panel、slot(面板中間的空位)、layer(層高)、count(層數)、choice:層高(例如 choice:0.2)
// 狀態 tried:完整疊好過的層高
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'
import { drawPrinter, type Layer } from './gl'
import { BEAM_UP, BED, EXTENT, GANTRY, PITCH_LIMIT, SPOOL_AT, bounds, camera, path, type V, type View } from './scene'

export type LayerShape = 'dome' | 'block'
export type Print3dProps = { shape?: LayerShape; height?: number; layer?: number; printed?: number; choices?: number[]; yaw?: number; pitch?: number }
export type Print3dState = { shape: LayerShape; height: number; layer: number; count: number; peek: number | null; tried: number[]; yaw: number; pitch: number }
type Kind = 'print' | 'slice' | 'peek' | 'turn' | 'tilt'
type Step = CommonStepFields & { print?: number | 'all'; slice?: number; peek?: number | false; turn?: number; tilt?: number }

/** 這個層高要疊幾層;除不盡就丟錯 */
export function layersOf(height: number, layer: number): number {
  const n = height / layer
  if (!(layer > 0) || Math.abs(n - Math.round(n)) > 1e-6 || Math.round(n) < 1) throw new Error(`高 ${height} mm 不能剛好分成每層 ${layer} mm`)
  return Math.round(n)
}

/** 第 i 層(從 0 起)的半寬 mm:圓頂用這一層中間高度的半徑 */
export function halfWidthOf(shape: LayerShape, height: number, layer: number, i: number): number {
  if (shape === 'block') return 20
  const t = ((i + 0.5) * layer) / height
  return 30 * Math.sqrt(Math.max(0, 1 - t * t))
}

const fmt = (v: number) => String(+v.toFixed(2))
const finite = (v: number, name: string) => {
  if (!Number.isFinite(v)) throw new Error(`${name} 要是數字(度)`)
  return v
}
const inRange = (v: number, [lo, hi]: readonly [number, number], name: string) => {
  if (!(v >= lo && v <= hi)) throw new Error(`${name} 要在 ${lo} 到 ${hi} 度之間(現在是 ${v})`)
  return v
}
/** 畫布每個版面 px 要幾個像素:裝置像素比 × 舞台目前縮放的倍率,上限 2。舞台 1:1(錄影)時是 1 */
export const canvasRatio = (dpr: number, scale: number): number => Math.min(2, Math.max(0.1, (dpr || 1) * (scale > 0 ? scale : 1)))
/** SVG viewBox(投影後的畫面座標) */
const VIEW = { x: -540, y: -545, w: 1080, h: 920 }

export default defineActor<Kind, Step, Print3dProps, Print3dState, string>({
  name: 'print3d-layers',
  // 版面照 1920 寬的舞台畫(固定 px),靜態互動時整個等比例縮放
  fixedSize: true,
  kinds: ['print', 'slice', 'peek', 'turn', 'tilt'],

  duration(kind, step, _props, prev) {
    if (kind === 'slice') return 700
    if (kind === 'peek' || kind === 'turn' || kind === 'tilt') return 800
    if (!prev) return 2000
    const total = layersOf(prev.height, prev.layer)
    const to = step.print === 'all' ? total : Number(step.print)
    return kit.clamp(600 + (to - prev.count) * 400, 1400, 4500)
  },

  autoFocus: () => false,

  init(props) {
    const height = props.height ?? 30
    const layer = props.layer ?? 5
    const total = layersOf(height, layer)
    const count = props.printed ?? 0
    if (count < 0 || count > total) throw new Error(`printed 要在 0 到 ${total} 之間`)
    for (const c of props.choices ?? []) layersOf(height, c)
    return { shape: props.shape ?? 'dome', height, layer, count, peek: null, tried: [], yaw: finite(props.yaw ?? 34, 'yaw'), pitch: inRange(props.pitch ?? 28, PITCH_LIMIT, 'pitch') }
  },

  apply(state, kind, step) {
    const total = layersOf(state.height, state.layer)
    if (kind === 'turn') return { ...state, yaw: finite(state.yaw + Number(step.turn), 'turn') }
    if (kind === 'tilt') return { ...state, pitch: inRange(state.pitch + Number(step.tilt), PITCH_LIMIT, 'pitch') }
    if (kind === 'slice') {
      const layer = Number(step.slice)
      layersOf(state.height, layer)
      return { ...state, layer, count: 0, peek: null }
    }
    if (kind === 'print') {
      const to = step.print === 'all' ? total : Number(step.print)
      if (!Number.isInteger(to) || to < state.count || to > total) throw new Error(`print 要在 ${state.count} 到 ${total} 層之間`)
      const tried = to === total && !state.tried.includes(state.layer) ? [...state.tried, state.layer] : state.tried
      return { ...state, count: to, peek: null, tried }
    }
    if (step.peek === false) return { ...state, peek: null }
    const n = Number(step.peek)
    if (!Number.isInteger(n) || n < 1 || n > state.count) throw new Error(`第 ${step.peek} 層還沒疊好,不能拿起來看`)
    return { ...state, peek: n }
  },

  mount(root, props) {
    root.classList.add('A-print3d-layers')
    const choices = props.choices ?? []
    const proxies = ['model', 'nozzle', 'spool', 'bed', 'screen', 'xaxis', 'yaxis', 'zaxis']
    root.innerHTML = `
      <div class="pl-scene">
        <canvas class="pl-gl" aria-hidden="true"></canvas>
        <svg class="pl-over" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <g class="pl-world"></g>
          <text class="pl-peek-label" x="0" y="${VIEW.y + 44}" text-anchor="middle"></text>
        </svg>
        <p class="pl-nogl" hidden>這個瀏覽器無法顯示 3D 畫面（WebGL 不可用）。換一個瀏覽器，或開啟硬體加速後重新整理。</p>
        ${proxies.map((n) => `<i class="pl-proxy" data-name="${n}"></i>`).join('')}
      </div>
      <div class="pl-panel">
        <div class="pl-stat pl-layer"><span>層高</span><b></b></div>
        <div class="pl-stat pl-count"><span>疊了幾層</span><b></b></div>
        <div class="pl-stat pl-tall"><span>現在多高</span><b></b></div>
        <div class="pl-slot"></div>
        ${choices.length ? `<div class="pl-choices"><p>換一種層高</p>${choices.map((c) => `<div class="pl-choice" data-v="${c}">${fmt(c)} mm</div>`).join('')}</div>` : ''}
      </div>`
    const q = <E extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as unknown as E
    const world = q<SVGGElement>('.pl-world')
    const gl = q<HTMLCanvasElement>('.pl-gl')
    const nogl = q('.pl-nogl')
    const label = q<SVGTextElement>('.pl-peek-label')
    const layerText = q('.pl-layer b')
    const countText = q('.pl-count b')
    const tallText = q('.pl-tall b')
    const isTall = kit.tallWatch(root)
    // 舞台的聚光燈用 offsetLeft 量位置,SVG 元素量不到:疊一個看不見的 HTML 框當目標,位置照 viewBox 換算
    const scene = q('.pl-scene')
    const proxy = (name: string) => q<HTMLElement>(`.pl-proxy[data-name="${name}"]`)
    const putProxy = (name: string, r: { x: number; y: number; w: number; h: number }) => {
      const k = Math.min(scene.clientWidth / VIEW.w, scene.clientHeight / VIEW.h)
      if (!k) return
      r = { x: r.x * fit.k + fit.x, y: r.y * fit.k + fit.y, w: r.w * fit.k, h: r.h * fit.k }
      kit.css(proxy(name), {
        left: `${(scene.clientWidth - VIEW.w * k) / 2 + (r.x - VIEW.x) * k}px`,
        top: `${(scene.clientHeight - VIEW.h * k) / 2 + (r.y - VIEW.y) * k}px`,
        width: `${r.w * k}px`,
        height: `${r.h * k}px`,
      })
    }
    // 目前畫面的置中縮放(世界畫面座標 → viewBox)
    let fit = { k: 1, x: 0, y: 0 }
    // 觀看者拖曳出來的視角差(度);只影響自己看到的,不進時間軸
    let offset: View = { yaw: 0, pitch: 0 }
    let from0: { x: number; y: number; at: View } | null = null
    let moved = false
    let redraw = () => {}
    // 腳本目前的俯角:拖曳的差要讓兩者相加留在範圍內
    let scriptPitch = 0
    // 只量整個舞台被外層縮放的倍率;鏡頭、進場這些隨時間變的 transform 在舞台裡面,不影響畫布大小(同一時間畫出同樣結果)
    const stage = root.closest<HTMLElement>('.live-stage')
    const stageScale = () => (stage?.offsetWidth ? stage.getBoundingClientRect().width / stage.offsetWidth : 1)
    // 外框變大小(全螢幕、轉向)時縮放倍率跟著變,暫停中也要重畫;等一格讓外層先套好 transform
    const box = stage?.parentElement?.parentElement
    if (box && typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => {
        if (!root.isConnected) return ro.disconnect()
        requestAnimationFrame(() => redraw())
      })
      ro.observe(box)
    }
    scene.addEventListener('pointerdown', (e) => {
      from0 = { x: e.clientX, y: e.clientY, at: offset }
      moved = false
      scene.setPointerCapture?.(e.pointerId)
    })
    scene.addEventListener('pointermove', (e) => {
      if (!from0) return
      const dx = e.clientX - from0.x
      const dy = e.clientY - from0.y
      if (!moved && Math.hypot(dx, dy) < 5) return
      moved = true
      const wanted = from0.at.pitch + dy * 0.3
      const pitch = Math.min(PITCH_LIMIT[1] - scriptPitch, Math.max(PITCH_LIMIT[0] - scriptPitch, wanted))
      // 超出範圍的拖曳量不累積:往回拖馬上有反應
      from0.y += (wanted - pitch) / 0.3
      offset = { yaw: from0.at.yaw - dx * 0.4, pitch }
      redraw()
    })
    for (const type of ['pointerup', 'pointercancel']) scene.addEventListener(type, () => (from0 = null))
    // 拖完放開不要被播放器當成點一下(暫停／播放)
    scene.addEventListener('click', (e) => {
      if (moved) e.stopPropagation()
      moved = false
    })
    scene.addEventListener('dblclick', () => {
      offset = { yaw: 0, pitch: 0 }
      redraw()
    })

    return {
      render(frame, ms) {
        const view = frame.view
        if (!view) return
        redraw = () => this.render(frame, ms)
        root.classList.toggle('pl-tallscreen', isTall())
        const kind = view.ev?.kind as string | undefined
        const ev = kind === 'print' || kind === 'slice' || kind === 'peek' ? view.ev : null
        const from = view.prev
        const to = kind === 'hide' ? view.prev : view.state
        const p = ev ? ev.p : 1
        // 換層高:前半是舊的淡出,後半換成清空的新設定
        const slicing = ev?.kind === 'slice'
        const base = slicing && p < 0.5 ? from : to
        const { layer, shape } = base
        const total = layersOf(base.height, layer)
        const printing = ev?.kind === 'print' ? ev : null
        const amount = printing ? kit.lerp(from.count, to.count, p) : base.count
        const full = Math.floor(amount + 1e-6)
        const part = amount - full
        const drawn = full + (part > 1e-6 ? 1 : 0)
        const lift = (st: Print3dState, i: number) => (st.peek === i + 1 ? 1 : 0)
        const e = ev?.kind === 'peek' ? kit.ease.inOutCubic(p) : 1
        // 視角:腳本的視角(turn、tilt 時平順轉過去)加上觀看者拖曳的差,限制在範圍內
        const rotating = view.ev && ['turn', 'tilt'].includes(view.ev.kind as string) ? kit.ease.inOutCubic(view.ev.p) : 1
        const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v))
        scriptPitch = kit.lerp(from.pitch, to.pitch, rotating)
        const cam = camera({
          yaw: kit.lerp(from.yaw, to.yaw, rotating) + offset.yaw,
          pitch: clamp(scriptPitch + offset.pitch, PITCH_LIMIT),
        })

        // 三軸運動:噴頭沿 X 左右、熱床沿 Y 前後(合起來噴嘴在模型上畫圓),橫桿沿 Z 上下
        const printingNow = !!printing && p < 1 && to.count > from.count
        const last = Math.max(0, Math.min(drawn, total) - 1)
        const half = halfWidthOf(shape, base.height, layer, last)
        const swing = printingNow ? kit.clamp(Math.min(p, 1 - p) * 8) : 0
        const phase = printing ? printing.local / 170 : 0
        const nx = printingNow ? Math.cos(phase) * half * swing : 36
        const bedY = printingNow ? -Math.sin(phase) * half * swing : 0
        const tall = (st: Print3dState) => st.count * st.layer
        const nz = printingNow ? (last + 1) * layer : kit.lerp(tall(from), tall(to), ev ? kit.ease.inOutCubic(p) : 1) + 7
        const spin = printingNow ? printing.local : 0
        const lcdText = printingNow ? `列印中 ${Math.round((drawn / total) * 100)}%　噴頭 200°C` : '噴頭 200°C　熱床 60°C'

        // 模型:一層一個柱體;拿起來的那一層升到模型上方
        let peekAmount = 0
        let peekIndex = -1
        const layers: Layer[] = []
        for (let i = 0; i < drawn; i++) {
          const grow = i === full ? part : 1
          const up = ev?.kind === 'peek' ? kit.lerp(lift(from, i), lift(to, i), e) : lift(base, i)
          if (up > peekAmount) {
            peekAmount = up
            peekIndex = i
          }
          const z0 = i * layer + up * (base.height - i * layer + 8)
          layers.push({ half: halfWidthOf(shape, base.height, layer, i) * (0.15 + 0.85 * grow), z0, height: layer, raised: up > 0 })
        }

        // 尺:立在機器右邊,每 10 mm 一個刻度
        let ruler = `<path d="${path(cam, [[82, -20, 0], [82, -20, base.height]])}"/>`
        for (let mm = 0; mm <= base.height; mm += 10) {
          const [x, y] = cam.p([82, -20, mm])
          ruler += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}h18"/><text x="${(x + 24).toFixed(1)}" y="${(y + 8).toFixed(1)}">${mm} mm</text>`
        }
        kit.setIf(world as unknown as HTMLElement, 'html', `<g class="pl-ruler">${ruler}</g>`)
        label.textContent = peekIndex >= 0 ? `第 ${peekIndex + 1} 層:一片薄薄的${shape === 'dome' ? '圓' : '正方形'}` : ''
        label.style.opacity = peekAmount.toFixed(3)

        // 整台機器置中縮放進畫面(轉視角時外框大小會變)
        const ext = bounds(cam, EXTENT)
        const k = Math.min(VIEW.w / ext.w, (VIEW.h - 50) / ext.h)
        fit = { k, x: VIEW.x + VIEW.w / 2 - (ext.x + ext.w / 2) * k, y: VIEW.y + 25 + VIEW.h / 2 - (ext.y + ext.h / 2) * k }
        world.setAttribute('transform', `translate(${fit.x.toFixed(1)} ${fit.y.toFixed(1)}) scale(${k.toFixed(4)})`)

        // 3D 畫面:畫布和 SVG 疊在一起,看得到的 viewBox 範圍依 xMidYMid meet 推算
        const [cw, ch] = [scene.clientWidth, scene.clientHeight]
        const meet = Math.min(cw / VIEW.w, ch / VIEW.h)
        if (meet > 0) {
          const ratio = canvasRatio(window.devicePixelRatio, stageScale())
          const [pw, ph] = [Math.round(cw * ratio), Math.round(ch * ratio)]
          if (gl.width !== pw || gl.height !== ph) Object.assign(gl, { width: pw, height: ph })
          const visible = { x: VIEW.x - (cw / meet - VIEW.w) / 2, y: VIEW.y - (ch / meet - VIEW.h) / 2, w: cw / meet, h: ch / meet }
          const ok = drawPrinter(gl, { camera: cam, fit, visible, shape, layers, contact: drawn ? halfWidthOf(shape, base.height, layer, 0) * 1.08 : 0, opacity: slicing ? Math.abs(1 - 2 * p) : 1, nozzle: { x: nx, z: nz, hot: printingNow }, bedY, spin, lcd: lcdText }, () => redraw())
          // null:context 暫時遺失,保留原本的畫面,回復時重畫
          if (ok !== null) nogl.hidden = ok
        }

        const around = (pts: V[]) => bounds(cam, pts)
        const cube = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
          around([x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z) => [x, y, z] as V))))
        putProxy('model', cube(-32, 32, bedY - 32, bedY + 32, 0, base.height))
        putProxy('nozzle', cube(nx - 9, nx + 9, -7, 5, nz - 2, nz + 30))
        putProxy('spool', cube(SPOOL_AT[0] - 12, SPOOL_AT[0] + 12, SPOOL_AT[1] - 4, SPOOL_AT[1] + 4, SPOOL_AT[2] - 12, SPOOL_AT[2] + 12))
        putProxy('screen', cube(14, 78, -84, -83, -24, -6))
        putProxy('bed', cube(-BED.half, BED.half, bedY - BED.half, bedY + BED.half, -BED.thick, 0))
        putProxy('xaxis', cube(-GANTRY.x - 18, GANTRY.x + 7, GANTRY.y, GANTRY.y + 1, nz + BEAM_UP - 10, nz + BEAM_UP + 10))
        putProxy('yaxis', cube(-28, 28, -76, 84, -14, -4))
        putProxy('zaxis', cube(-GANTRY.x - 6, -GANTRY.x + 18, GANTRY.y, GANTRY.y + 1, -12, GANTRY.top))

        layerText.textContent = `${fmt(layer)} mm`
        countText.textContent = `${drawn} / ${total}`
        tallText.textContent = `${fmt(drawn * layer)} mm`
        for (const el of root.querySelectorAll<HTMLElement>('.pl-choice')) el.classList.toggle('is-on', Number(el.dataset.v) === layer)
      },
      target(name) {
        if (name === 'window') return root
        if (proxies.includes(name)) return proxy(name)
        if (name === 'panel') return q('.pl-panel')
        // 面板中間的空位:播放器把「繼續看」這類按鈕放在這裡
        if (name === 'slot') return q('.pl-slot')
        if (name === 'layer') return q('.pl-layer')
        if (name === 'count') return q('.pl-count')
        if (name.startsWith('choice:')) return root.querySelector<HTMLElement>(`.pl-choice[data-v="${name.slice(7)}"]`)
        return null
      },
    }
  },
})
