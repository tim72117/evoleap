// 演員 box-size:兒童 3D 列印課 1.2「尺寸要說清楚」。量一個實物(橡皮擦、積木),把寬、深、高(mm)輸入進來,
// 左邊的立體盒子跟著變、邊上標出尺寸,最後記到量測紀錄。規格見 ../../README.md「演員」(2A.1)、「動作要是操作」(2A.4)、「init/apply」(2A.5)。
//
// props(登場設定):
//   size     一開始的尺寸 { width, depth, height }(mm,1–200 的整數;預設 20、20、20)
//
// 動作(依序操作;對不上狀態時載入就報錯):
//   { "pick": "width" }      點選要輸入的欄位:width(寬)、depth(深)、height(高)
//   { "type": "42" }         在點選的欄位打數字;剛點選時取代舊值,之後接在後面(結果要在 1–200)
//   { "erase": true }        刪掉點選欄位的最後一個數字(刪光時盒子維持原來的尺寸)
//   { "record": "橡皮擦" }    把目前的寬、深、高記到量測紀錄(最多留 3 筆)
//
// 學員直接操作(靜態互動,page + press):點欄位、按數字鍵、倒退、記下來;左側「繼續看」是互動點的選項
// (選項寫 "target": "<代號>:next")。
// 目標:window、view、panel、field:width|depth|height、key:0–9、erase、record、records
// 區塊(parts):pad(數字鍵)、records(量測紀錄)
import { ringAt, DEFAULTS } from '../../../shapes/mesh'
import { kit } from '../../kit'
import { defineActor, type CommonStepFields, type ScriptStep } from '../../types'
import './actor.css'

export const FIELDS = ['width', 'depth', 'height'] as const
export type Field = (typeof FIELDS)[number]
const LABEL: Record<Field, string> = { width: '寬', depth: '深', height: '高' }
export const MAX_MM = 200

export type BoxSize = Record<Field, number>
export type BoxSizeProps = { size?: Partial<BoxSize> }
export type BoxSizeState = {
  size: BoxSize
  field: Field | null
  /** 點選欄位之後打的字;null = 還沒打,顯示原本的值 */
  entry: string | null
  records: (BoxSize & { name: string })[]
  /** 總共記過幾筆(紀錄只留 3 筆,編號照這個接下去) */
  recorded: number
}
type Kind = 'pick' | 'type' | 'erase' | 'record'
type Step = CommonStepFields & { pick?: Field; type?: string; erase?: boolean; record?: string }

const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_MM

export function initState(props: BoxSizeProps): BoxSizeState {
  const size = { width: 20, depth: 20, height: 20, ...props.size }
  for (const f of FIELDS) if (!valid(size[f])) throw new Error(`size.${f} 要是 1 到 ${MAX_MM} 的整數`)
  return { size, field: null, entry: null, records: [], recorded: 0 }
}

export function applyStep(st: BoxSizeState, kind: Kind, step: Step): BoxSizeState {
  if (kind === 'pick') {
    if (!FIELDS.includes(step.pick as Field)) throw new Error(`pick 要是 ${FIELDS.join('、')}`)
    return { ...st, field: step.pick as Field, entry: null }
  }
  if (kind === 'record') {
    const name = String(step.record ?? '').trim()
    if (!name) throw new Error('record 要寫量的是什麼')
    return { ...st, field: null, entry: null, records: [...st.records, { name, ...st.size }].slice(-3), recorded: st.recorded + 1 }
  }
  const field = st.field
  if (!field) throw new Error('要先 pick 一個欄位才能打字')
  let entry: string
  if (kind === 'erase') entry = (st.entry ?? String(st.size[field])).slice(0, -1)
  else {
    const digits = String(step.type ?? '')
    entry = (st.entry ?? '') + digits
    if (!/^\d+$/.test(digits) || !valid(Number(entry))) throw new Error(`「${entry}」不是 1 到 ${MAX_MM} 的尺寸`)
  }
  return { ...st, entry, size: entry ? { ...st.size, [field]: Number(entry) } : st.size }
}

/** 學員點了 name 時要演的步驟;不能點回傳 null */
export function pressSteps(st: BoxSizeState, name: string): ScriptStep[] | null {
  const [what, arg] = name.split(':')
  const step = (s: Step): ScriptStep[] => [s as ScriptStep]
  if (what === 'field') return FIELDS.includes(arg as Field) ? step({ pick: arg as Field }) : null
  if (what === 'record') {
    const last = st.records[st.records.length - 1]
    // 和上一筆一樣就不重複記
    if (last && FIELDS.every((f) => last[f] === st.size[f])) return null
    return step({ record: `第 ${st.recorded + 1} 件` })
  }
  if (!st.field) return null
  if (what === 'erase') return (st.entry ?? String(st.size[st.field])) ? step({ erase: true }) : null
  if (what === 'key') return valid(Number((st.entry ?? '') + arg)) ? step({ type: arg }) : null
  return null
}

/** 欄位上顯示的字 */
export const shown = (st: BoxSizeState, f: Field): string => (st.field === f && st.entry != null ? st.entry : String(st.size[f]))

// ---------- 畫面 ----------
type P = [number, number]
/** 斜角投影:x 往右、y 往後、z 往上(mm) */
const project = (x: number, y: number, z: number): P => [x + y * 0.55, -z - y * 0.4]
const pts = (list: P[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

/** 盒子的 SVG:三個看得到的面、地面格線(每格 10 mm)與三條尺寸線 */
export function boxSvg(size: BoxSize, active: Field | null): { viewBox: string; body: string } {
  const p = { ...DEFAULTS, kind: 'box' as const, ...size }
  const ring = ringAt(p, 0)
  // ringAt 的順序:左前、右前、右後、左後
  const [b0, b1, b2] = ring.map(([x, y]) => project(x, y, 0))
  const [t0, t1, t2, t3] = ring.map(([x, y]) => project(x, y, size.height))
  const w = size.width / 2
  const d = size.depth / 2
  // 小東西也不要放到滿版:至少用 60 mm 的範圍,大小才比得出來
  const span = Math.max(60, size.width + size.depth * 0.55, size.height + size.depth * 0.4)
  const u = span / 100
  const cx = (b0[0] + b2[0]) / 2
  const cy = (t3[1] + b0[1]) / 2
  const half = span * 0.95
  const grid: string[] = []
  const g = Math.ceil((Math.max(w, d) + 10) / 10) * 10
  for (let v = -g; v <= g; v += 10) {
    grid.push(`M${pts([project(v, -g, 0)])}L${pts([project(v, g, 0)])}`, `M${pts([project(-g, v, 0)])}L${pts([project(g, v, 0)])}`)
  }
  const dim = (f: Field, a: P, b: P, off: P, anchor: string) => {
    const [ox, oy] = [off[0] * u, off[1] * u]
    const mid: P = [(a[0] + b[0]) / 2 + ox * 1.6, (a[1] + b[1]) / 2 + oy * 1.6]
    return `<g class="bs-dim${active === f ? ' is-on' : ''}" data-dim="${f}"><path d="M${pts([a])}l${ox} ${oy}M${pts([b])}l${ox} ${oy}M${a[0] + ox * 0.7} ${a[1] + oy * 0.7}L${b[0] + ox * 0.7} ${b[1] + oy * 0.7}"/><text x="${mid[0]}" y="${mid[1]}" font-size="${6.5 * u}" text-anchor="${anchor}" dominant-baseline="middle">${LABEL[f]} ${size[f] % 1 ? size[f].toFixed(0) : size[f]} mm</text></g>`
  }
  return {
    viewBox: `${(cx - half).toFixed(1)} ${(cy - half * 0.72).toFixed(1)} ${(half * 2).toFixed(1)} ${(half * 1.44).toFixed(1)}`,
    body: `<path class="bs-grid" d="${grid.join('')}"/>
      <polygon class="bs-front" points="${pts([b0, b1, t1, t0])}"/><polygon class="bs-side" points="${pts([b1, b2, t2, t1])}"/><polygon class="bs-top" points="${pts([t0, t1, t2, t3])}"/>
      ${dim('width', b0, b1, [0, 8], 'middle')}${dim('depth', b1, b2, [7, 4], 'start')}${dim('height', t0, b0, [-8, 0], 'end')}`,
  }
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

export default defineActor<Kind, Step, BoxSizeProps, BoxSizeState, string>({
  name: 'box-size',
  kinds: ['pick', 'type', 'erase', 'record'],
  // 靜態互動時當一般網頁排版,自己處理點擊
  page: true,
  parts: { pad: '.bs-pad', records: '.bs-records' },

  duration(kind, step) {
    if (kind === 'type') return 200 + String(step.type ?? '').length * 300
    return kind === 'record' ? 700 : 400
  },

  autoFocus: () => false,

  cursor(kind, step) {
    const target = kind === 'pick' ? `field:${step.pick}` : kind === 'type' ? `key:${String(step.type)[0]}` : kind
    return { moves: [{ at: 120, target }], clickAt: 150 }
  },

  init: initState,
  apply: applyStep,

  mount(root) {
    root.classList.add('A-box-size')
    // 靜態互動(外層標 data-pressable):可以點的畫成按鈕;影片裡是一般元素
    const pressable = !!root.closest('[data-pressable]')
    const tag = pressable ? 'button type="button"' : 'div'
    const end = pressable ? 'button' : 'div'
    root.innerHTML = `
      <div class="bs-view"><svg preserveAspectRatio="xMidYMid meet" role="img"></svg></div>
      <div class="bs-panel">
        <div class="bs-fields">${FIELDS.map((f) => `<${tag} class="bs-field" data-t="field:${f}"><span>${LABEL[f]}</span><b></b><i>mm</i></${end}>`).join('')}</div>
        <div class="bs-pad">${KEYS.map((k) => `<${tag} class="bs-key" data-t="key:${k}">${k}</${end}>`).join('')}<${tag} class="bs-key bs-erase" data-t="erase" aria-label="倒退">⌫</${end}></div>
        <${tag} class="bs-record" data-t="record">記下來</${end}>
        <div class="bs-records" data-t="records"></div>
      </div>`
    const q = <E extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as unknown as E
    const svg = q<SVGSVGElement>('svg')
    const records = q('.bs-records')
    const isTall = kit.tallWatch(root)
    let latest: BoxSizeState | null = null

    return {
      render(frame) {
        const view = frame.view
        if (!view) return
        root.classList.toggle('bs-tall', isTall())
        const st = view.state
        latest = st
        const p = view.ev ? kit.ease.inOutCubic(view.ev.p) : 1
        // 盒子從舊尺寸平順變到新尺寸
        const size = Object.fromEntries(FIELDS.map((f) => [f, kit.lerp(view.prev.size[f], st.size[f], p)])) as BoxSize
        const drawn = boxSvg(size, st.field)
        svg.setAttribute('viewBox', drawn.viewBox)
        kit.setIf(svg as unknown as HTMLElement, 'html', drawn.body)
        svg.setAttribute('aria-label', `盒子:寬 ${st.size.width}、深 ${st.size.depth}、高 ${st.size.height} mm`)
        for (const f of FIELDS) {
          const el = q(`[data-t="field:${f}"]`)
          el.classList.toggle('is-on', st.field === f)
          kit.setIf(el.querySelector<HTMLElement>('b')!, 'text', shown(st, f))
          if (pressable) el.setAttribute('aria-pressed', String(st.field === f))
        }
        root.classList.toggle('bs-nofield', !st.field)
        kit.setIf(
          records,
          'html',
          `<p>量測紀錄(mm)</p>` +
            (st.records.length
              ? `<table><tr><th></th><th>寬</th><th>深</th><th>高</th></tr>${st.records.map((r) => `<tr><th>${kit.esc(r.name)}</th><td>${r.width}</td><td>${r.depth}</td><td>${r.height}</td></tr>`).join('')}</table>`
              : `<p class="bs-empty">還沒有紀錄</p>`),
        )
      },
      press: (name) => (latest ? pressSteps(latest, name) : null),
      controls: () => [{ name: 'next', label: '繼續看', primary: true }],
      target(name) {
        if (name === 'window') return root
        if (name === 'view') return q('.bs-view')
        if (name === 'panel') return q('.bs-panel')
        return q(`[data-t="${name}"]`)
      },
    }
  },
})
