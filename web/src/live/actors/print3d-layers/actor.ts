// 演員 print3d-layers:兒童 3D 列印課「一層一層長出來」。列印平台上的模型由下往上一層一層疊起來,噴頭跟著走;
// 旁邊的面板顯示層高、疊了幾層、現在多高。規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定):
//   shape    "dome"(小圓頂,看得出一階一階;預設)、"block"(方塊)
//   height   模型高度 mm(預設 30)
//   layer    一開始的層高 mm(預設 5);height 要能被層高整除
//   printed  一開始已經疊好幾層(預設 0)
//   choices  面板下方可以點的層高按鈕,例如 [5, 3, 1, 0.2];不寫就沒有按鈕
//
// 動作(依序操作;對不上狀態時載入就報錯):
//   { "print": "all" }     噴頭繼續往上疊到最後一層;{ "print": 2 } 疊到第 2 層(不能比現在少)
//   { "slice": 1 }         層高改成 1 mm,平台清空(要再 print)
//   { "peek": 3 }          把第 3 層拿起來看它的形狀(要已經疊到那一層);{ "peek": false } 放回去
//
// 畫面上的列印機(畫法在 scene.ts,斜角 3D):X 軸橫桿與皮帶、Y 軸滑軌上前後移動的熱床、Z 軸絲桿與馬達、噴頭組、線材捲、控制盒螢幕。
//
// 目標:window、model、nozzle、spool、bed、screen、xaxis(X 軸橫桿)、yaxis(Y 軸滑軌)、zaxis(Z 軸絲桿與馬達)、panel、slot(面板中間的空位)、layer(層高)、count(層數)、choice:層高(例如 choice:0.2)
// 狀態 tried:完整疊好過的層高
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'
import { BEAM_UP, BED, GANTRY, SCALE, SPOOL_AT, baseSvg, beamSvg, bedSvg, bounds, controlSvg, frameSvg, headSvg, path, project, slab, type V } from './scene'

export type LayerShape = 'dome' | 'block'
export type Print3dProps = { shape?: LayerShape; height?: number; layer?: number; printed?: number; choices?: number[] }
export type Print3dState = { shape: LayerShape; height: number; layer: number; count: number; peek: number | null; tried: number[] }
type Kind = 'print' | 'slice' | 'peek'
type Step = CommonStepFields & { print?: number | 'all'; slice?: number; peek?: number | false }

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
const SVG = 'http://www.w3.org/2000/svg'
/** SVG viewBox(投影後的畫面座標) */
const VIEW = { x: -540, y: -545, w: 1080, h: 920 }

export default defineActor<Kind, Step, Print3dProps, Print3dState, string>({
  name: 'print3d-layers',
  // 版面照 1920 寬的舞台畫(固定 px),靜態互動時整個等比例縮放
  fixedSize: true,
  kinds: ['print', 'slice', 'peek'],

  duration(kind, step, _props, prev) {
    if (kind === 'slice') return 700
    if (kind === 'peek') return 800
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
    return { shape: props.shape ?? 'dome', height, layer, count, peek: null, tried: [] }
  },

  apply(state, kind, step) {
    const total = layersOf(state.height, state.layer)
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
    const height = props.height ?? 30
    const proxies = ['model', 'nozzle', 'spool', 'bed', 'screen', 'xaxis', 'yaxis', 'zaxis']
    root.innerHTML = `
      <div class="pl-scene">
        <svg viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          ${baseSvg()}
          <g class="pl-bedg">${bedSvg()}<path class="pl-contact"/><g class="pl-layers"></g></g>
          <g class="pl-ruler"></g>
          ${frameSvg()}
          <path class="pl-filament"/>
          <g class="pl-gantry">${beamSvg()}</g>
          <g class="pl-nozzle">${headSvg()}<circle class="pl-hot" cx="0" cy="-2" r="5"/></g>
          ${controlSvg()}
          <text class="pl-peek-label" x="0" y="${VIEW.y + 44}" text-anchor="middle"></text>
        </svg>
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
    const layersG = q<SVGGElement>('.pl-layers')
    const bed = q<SVGGElement>('.pl-bedg')
    const contact = q<SVGPathElement>('.pl-contact')
    const gantry = q<SVGGElement>('.pl-gantry')
    const nozzle = q<SVGGElement>('.pl-nozzle')
    const filament = q<SVGPathElement>('.pl-filament')
    const fan = q<SVGGElement>('.p-fan')
    const spokes = q<SVGPathElement>('.p-spokes')
    const lcd = q<SVGTextElement>('.p-lcd-text')
    const threads = [...root.querySelectorAll<SVGPathElement>('.p-thread')]
    const label = q<SVGTextElement>('.pl-peek-label')
    const layerText = q('.pl-layer b')
    const countText = q('.pl-count b')
    const tallText = q('.pl-tall b')
    // 尺:立在機器右邊,每 10 mm 一個刻度
    const ruler = q<SVGGElement>('.pl-ruler')
    const mark = (z: number) => project([82, -20, z])
    const add = (tag: string, attrs: Record<string, string>, text?: string) => {
      const el = document.createElementNS(SVG, tag)
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
      if (text) el.textContent = text
      ruler.append(el)
    }
    add('path', { d: path([[82, -20, 0], [82, -20, height]], false) })
    for (let mm = 0; mm <= height; mm += 10) {
      const [x, y] = mark(mm)
      add('path', { d: `M${x} ${y}h18` })
      add('text', { x: String(x + 24), y: String(y + 8) }, `${mm} mm`)
    }
    const isTall = kit.tallWatch(root)
    const slabs: { g: SVGGElement; side: SVGPathElement; top: SVGPathElement }[] = []
    const slabAt = (i: number) => {
      while (slabs.length <= i) {
        const g = document.createElementNS(SVG, 'g')
        const side = document.createElementNS(SVG, 'path')
        const top = document.createElementNS(SVG, 'path')
        side.setAttribute('class', 'pl-side')
        top.setAttribute('class', 'pl-top')
        g.append(side, top)
        layersG.append(g)
        slabs.push({ g, side, top })
      }
      return slabs[i]
    }
    // 舞台的聚光燈用 offsetLeft 量位置,SVG 元素量不到:疊一個看不見的 HTML 框當目標,位置照 viewBox 換算
    const scene = q('.pl-scene')
    const proxy = (name: string) => q<HTMLElement>(`.pl-proxy[data-name="${name}"]`)
    const putProxy = (name: string, r: { x: number; y: number; w: number; h: number }) => {
      const k = Math.min(scene.clientWidth / VIEW.w, scene.clientHeight / VIEW.h)
      if (!k) return
      kit.css(proxy(name), {
        left: `${(scene.clientWidth - VIEW.w * k) / 2 + (r.x - VIEW.x) * k}px`,
        top: `${(scene.clientHeight - VIEW.h * k) / 2 + (r.y - VIEW.y) * k}px`,
        width: `${r.w * k}px`,
        height: `${r.h * k}px`,
      })
    }
    const move = (el: SVGElement, to: V) => {
      const [x, y] = project(to)
      el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
    }

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        root.classList.toggle('pl-tallscreen', isTall())
        const kind = view.ev?.kind
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
        let peekAmount = 0
        let peekIndex = -1
        layersG.style.opacity = slicing ? String(Math.abs(1 - 2 * p).toFixed(3)) : '1'
        for (let i = 0; i < Math.max(drawn, slabs.length); i++) {
          const s = slabAt(i)
          if (i >= drawn) {
            s.g.style.display = 'none'
            continue
          }
          s.g.style.display = ''
          const grow = i === full ? part : 1
          const up = ev?.kind === 'peek' ? kit.lerp(lift(from, i), lift(to, i), e) : lift(base, i)
          if (up > peekAmount) {
            peekAmount = up
            peekIndex = i
          }
          // 拿起來的那一層升到模型上方
          const z0 = i * layer + up * (base.height - i * layer + 8)
          const d = slab(shape, halfWidthOf(shape, base.height, layer, i) * (0.15 + 0.85 * grow), z0, z0 + layer)
          s.side.setAttribute('d', d.side)
          s.top.setAttribute('d', d.top)
          s.g.classList.toggle('is-peek', up > 0)
          s.g.style.strokeWidth = String(Math.min(1.5, layer * 0.8))
        }
        // 由下往上畫,拿起來的那一層最後畫(蓋在最上面)
        const raised = (s: (typeof slabs)[number]) => s.g.classList.contains('is-peek') && s.g.style.display !== 'none'
        ;[...slabs.filter((s) => !raised(s)), ...slabs.filter(raised)].forEach((s, i) => {
          if (layersG.children[i] !== s.g) layersG.insertBefore(s.g, layersG.children[i] ?? null)
        })
        label.textContent = peekIndex >= 0 ? `第 ${peekIndex + 1} 層:一片薄薄的${shape === 'dome' ? '圓' : '正方形'}` : ''
        label.style.opacity = peekAmount.toFixed(3)

        // 三軸運動:噴頭沿 X 左右、熱床沿 Y 前後(合起來噴嘴在模型上畫圓),橫桿沿 Z 上下
        const printingNow = !!printing && p < 1 && to.count > from.count
        const i = Math.max(0, Math.min(drawn, total) - 1)
        const half = halfWidthOf(shape, base.height, layer, i)
        const swing = printingNow ? kit.clamp(Math.min(p, 1 - p) * 8) : 0
        const phase = printing ? printing.local / 170 : 0
        const nx = printingNow ? Math.cos(phase) * half * swing : 36
        const bedY = printingNow ? -Math.sin(phase) * half * swing : 0
        const tall = (st: Print3dState) => st.count * st.layer
        const nz = printingNow ? (i + 1) * layer : kit.lerp(tall(from), tall(to), ev ? kit.ease.inOutCubic(p) : 1) + 7
        move(bed, [0, bedY, 0])
        move(nozzle, [nx, 0, nz])
        move(gantry, [0, 0, nz + BEAM_UP])
        nozzle.classList.toggle('is-on', printingNow)
        contact.setAttribute('d', slab(shape, halfWidthOf(shape, base.height, layer, 0) * 1.08, 0, 0.1).top)
        contact.style.opacity = drawn ? '1' : '0'
        // 絲桿轉動:螺紋跟著橫桿高度移動
        for (const th of threads) th.style.strokeDashoffset = (-(nz * SCALE) % 12).toFixed(1)
        const [sx, sy] = project(SPOOL_AT)
        const [hx, hy] = project([nx, 0, nz + 29])
        filament.setAttribute('d', `M${sx - 36} ${sy}C${sx - 120} ${sy - 20} ${hx.toFixed(1)} ${(hy - 110).toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)}`)
        const spin = printingNow ? printing.local : 0
        fan.setAttribute('transform', `rotate(${((spin * 1.1) % 360).toFixed(1)})`)
        spokes.setAttribute('transform', `rotate(${((spin * 0.12) % 360).toFixed(1)} ${sx.toFixed(1)} ${sy.toFixed(1)})`)

        putProxy('model', bounds([[-32, -32, 0], [32, -32, 0], [32, 32, 0], [-32, 32, base.height], [32, 32, base.height], [-32, -32, base.height]]))
        putProxy('nozzle', bounds([[nx - 9, -7, nz - 2], [nx + 9, -7, nz - 2], [nx + 9, 5, nz + 30], [nx - 9, 5, nz + 30]]))
        putProxy('spool', { x: sx - 60, y: sy - 72, w: 146, h: 134 })
        putProxy('bed', bounds([[-BED.half, -BED.half, -BED.thick], [BED.half, -BED.half, -BED.thick], [BED.half, BED.half, 0], [-BED.half, BED.half, 0]]))
        putProxy('screen', bounds([[14, -84, -24], [78, -84, -24], [78, -72, -6], [14, -84, -6]]))
        putProxy('xaxis', bounds([[-GANTRY.x - 18, GANTRY.y, nz + BEAM_UP - 10], [GANTRY.x + 7, GANTRY.y, nz + BEAM_UP - 10], [-GANTRY.x - 18, GANTRY.y, nz + BEAM_UP + 10], [GANTRY.x + 7, GANTRY.y, nz + BEAM_UP + 10]]))
        putProxy('yaxis', bounds([[-28, -76, -14], [28, -76, -14], [28, 84, -4], [-28, 84, -4]]))
        putProxy('zaxis', bounds([[-GANTRY.x - 6, GANTRY.y, -12], [-GANTRY.x + 18, GANTRY.y, -12], [-GANTRY.x - 6, GANTRY.y, GANTRY.top], [-GANTRY.x + 18, GANTRY.y, GANTRY.top]]))
        const done = drawn / total
        lcd.textContent = printingNow ? `列印中 ${Math.round(done * 100)}%　噴頭 200°C` : '噴頭 200°C　熱床 60°C'

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
