import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ProposalLayout } from '../ProposalLayout'
import { buildMesh, DEFAULTS, formulaOf, measure, normal, overhangs, printSeconds, sliceAt, toObj, toStl, type ShapeKind, type ShapeParams, type Tri } from './mesh'
import s from './Print3dPage.module.css'

// 試做:簡易 3D 列印軟體(給「3D 列印課」用,構想見 oveleap 文件 DOC-2)。
// 形狀都由數學產生(一圈圈的多邊形疊起來),旁邊即時顯示公式、尺寸、體積、用料;
// 切片看每一層的截面,下載 STL 給真的切片軟體。3D 畫面是自己畫的(Canvas,沒有外部套件)。

const KINDS: { kind: ShapeKind; label: string }[] = [
  { kind: 'box', label: '方塊' },
  { kind: 'prism', label: '多邊形柱' },
  { kind: 'vase', label: '函數花瓶' },
  { kind: 'twist', label: '扭轉柱' },
  { kind: 'sphere', label: '球／橢球' },
  { kind: 'cone', label: '錐台' },
  { kind: 'star', label: '星形柱' },
]
const PRESETS: { label: string; p: Partial<ShapeParams> }[] = [
  { label: '六角筆筒', p: { kind: 'prism', sides: 6, radius: 25, height: 90, wall: 2 } },
  { label: '波浪花瓶', p: { kind: 'vase', radius: 22, height: 90, taper: 0.7, wave: 5, waves: 2, wall: 1.5 } },
  { label: '螺旋塔', p: { kind: 'twist', sides: 4, radius: 20, height: 80, twist: 180, wall: 0 } },
  { label: '星星擺飾', p: { kind: 'star', sides: 5, radius: 30, inner: 0.45, height: 8, twist: 0, wall: 0 } },
  { label: '小碗', p: { kind: 'sphere', radius: 35, height: 35, wall: 2 } },
  { label: '燭台', p: { kind: 'cone', sides: 8, radius: 28, taper: 0.5, height: 40, wall: 2 } },
]
const VIEWS = [
  { label: '等角', yaw: 0.7, pitch: 0.55 },
  { label: '正面', yaw: 0, pitch: 0.05 },
  { label: '右側', yaw: Math.PI / 2, pitch: 0.05 },
  { label: '上方', yaw: 0, pitch: 1.5 },
]
const fmtTime = (sec: number) => (sec < 3600 ? `${Math.max(1, Math.round(sec / 60))} 分鐘` : `${Math.floor(sec / 3600)} 小時 ${Math.round((sec % 3600) / 60)} 分`)
const PLA = 1.24 // g/cm³

type Slider = { key: keyof ShapeParams; label: string; min: number; max: number; step: number; unit: string }
const SLIDERS: Record<ShapeKind, Slider[]> = {
  box: [
    { key: 'width', label: '寬', min: 5, max: 80, step: 1, unit: 'mm' },
    { key: 'depth', label: '深', min: 5, max: 80, step: 1, unit: 'mm' },
    { key: 'height', label: '高', min: 2, max: 80, step: 1, unit: 'mm' },
  ],
  prism: [
    { key: 'sides', label: '邊數', min: 3, max: 64, step: 1, unit: '' },
    { key: 'radius', label: '半徑', min: 5, max: 40, step: 1, unit: 'mm' },
    { key: 'height', label: '高', min: 2, max: 80, step: 1, unit: 'mm' },
  ],
  vase: [
    { key: 'radius', label: '底半徑', min: 8, max: 40, step: 1, unit: 'mm' },
    { key: 'height', label: '高', min: 10, max: 100, step: 1, unit: 'mm' },
    { key: 'taper', label: '頂部比例', min: 0.3, max: 1.6, step: 0.05, unit: '×' },
    { key: 'wave', label: '波浪振幅', min: 0, max: 10, step: 0.5, unit: 'mm' },
    { key: 'waves', label: '波浪幾圈', min: 0, max: 5, step: 0.5, unit: '' },
  ],
  twist: [
    { key: 'sides', label: '邊數', min: 3, max: 12, step: 1, unit: '' },
    { key: 'radius', label: '半徑', min: 5, max: 40, step: 1, unit: 'mm' },
    { key: 'height', label: '高', min: 10, max: 100, step: 1, unit: 'mm' },
    { key: 'twist', label: '扭轉', min: 0, max: 360, step: 5, unit: '°' },
  ],
  sphere: [
    { key: 'radius', label: '半徑', min: 5, max: 50, step: 1, unit: 'mm' },
    { key: 'height', label: '高(=2×半徑 為正球)', min: 5, max: 100, step: 1, unit: 'mm' },
  ],
  cone: [
    { key: 'sides', label: '邊數', min: 3, max: 64, step: 1, unit: '' },
    { key: 'radius', label: '底半徑', min: 5, max: 40, step: 1, unit: 'mm' },
    { key: 'taper', label: '頂部比例', min: 0.05, max: 1.6, step: 0.05, unit: '×' },
    { key: 'height', label: '高', min: 2, max: 100, step: 1, unit: 'mm' },
  ],
  star: [
    { key: 'sides', label: '尖角數', min: 3, max: 12, step: 1, unit: '' },
    { key: 'radius', label: '外半徑', min: 5, max: 40, step: 1, unit: 'mm' },
    { key: 'inner', label: '內圈比例', min: 0.2, max: 0.95, step: 0.05, unit: '×' },
    { key: 'height', label: '高', min: 2, max: 100, step: 1, unit: 'mm' },
    { key: 'twist', label: '扭轉', min: 0, max: 360, step: 5, unit: '°' },
  ],
}
const COMMON: Slider[] = [
  { key: 'wall', label: '壁厚(0=實心)', min: 0, max: 10, step: 0.5, unit: 'mm' },
  { key: 'scale', label: '整體縮放', min: 0.2, max: 3, step: 0.05, unit: '×' },
]

// ── 圖示(簡單的線條 SVG,不用外部套件) ──
function Ico({ d, size = 18, box = 20 }: { d: string; size?: number; box?: number }) {
  return (
    <svg viewBox={`0 0 ${box} ${box}`} width={size} height={size} fill="none" stroke="currentColor" strokeWidth={box === 24 ? 1.5 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  )
}
const IC = {
  undo: 'M7 4 3.5 7.5 7 11M3.5 7.5H12a4.5 4.5 0 0 1 0 9H8',
  redo: 'M13 4l3.5 3.5L13 11M16.5 7.5H8a4.5 4.5 0 0 0 0 9h4',
  reset: 'M16 10a6 6 0 1 1-1.76-4.24M15 2.5V6h-3.5',
  plus: 'M10 4.5v11M4.5 10h11',
  minus: 'M4.5 10h11',
  fit: 'M3.5 7V3.5H7M13 3.5h3.5V7M16.5 13v3.5H13M7 16.5H3.5V13',
  wire: 'M10 2.5 16.5 6v8L10 17.5 3.5 14V6zM3.5 6 10 9.5 16.5 6M10 9.5v8',
  grid: 'M3.5 3.5h13v13h-13zM3.5 8h13M3.5 12h13M8 3.5v13M12 3.5v13',
  over: 'M3.5 16.5h13M10 16.5V9.5M4 9.5h12l-2.5-5h-7z',
  download: 'M10 3.5v9M6 9l4 4 4-4M4 16.5h12',
  check: 'M4.5 10.5 8.5 14.5 15.5 6',
  warn: 'M10 3.5 17.5 16.5H2.5zM10 8.5v3.5M10 14.3v.2',
}
/** 形狀的小剪影(24×24) */
const SHAPE_IC: Record<ShapeKind, string> = {
  box: 'M12 3 20 7.5v9L12 21 4 16.5v-9zM4 7.5 12 12l8-4.5M12 12v9',
  prism: 'M7.5 3.5h9L20 7l-3.5 3.5h-9L4 7zM4 7v10l3.5 3.5h9L20 17V7M7.5 10.5v10M16.5 10.5v10',
  vase: 'M9 3h6M9.5 3c0 3-3.5 5-3.5 9s2 6 3 9h6c1-3 3-5 3-9s-3.5-6-3.5-9',
  twist: 'M7 3h10v18H7zM7 9l10-3.5M7 14.5 17 11M7 20l10-3.5',
  sphere: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.5 12c0 1.8 3.8 3.2 8.5 3.2s8.5-1.4 8.5-3.2',
  cone: 'M8 6c0 .9 1.8 1.6 4 1.6S16 6.9 16 6s-1.8-1.6-4-1.6S8 5.1 8 6zM8 6 4.5 18c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5L16 6',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
}

/** 把三角形畫到 Canvas:透視投影、依深度由遠到近畫、依法向量明暗(深色視窗用的配色) */
function draw(cv: HTMLCanvasElement, tris: Tri[], yaw: number, pitch: number, height: number, sliceZ: number | null, zoom: number, opt: { wire: boolean; grid: boolean; over: boolean[] | null }) {
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const W = cv.width
  const H = cv.height
  const px = W / 720 // 畫布是 2 倍解析度,線寬跟著放大
  ctx.clearRect(0, 0, W, H)
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const zc = height / 2
  const view = ([x, y, z]: [number, number, number]) => {
    const x1 = x * cy - y * sy
    const y1 = x * sy + y * cy
    const z1 = z - zc
    return [x1, y1 * sp + z1 * cp, -y1 * cp + z1 * sp] as const // 右、上、往前(越大越近)
  }
  const scale = (Math.min(W, H) / 95) * zoom
  const dist = 260
  const proj = (v: readonly [number, number, number]) => {
    const f = dist / (dist - v[2])
    return [W / 2 + v[0] * scale * f, H / 2 - v[1] * scale * f] as const
  }
  // 列印平台:10 mm 一格;中線與外框稍微亮一點
  ctx.lineWidth = px
  for (let i = -60; i <= 60 && opt.grid; i += 10) {
    ctx.strokeStyle = i === 0 || Math.abs(i) === 60 ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.075)'
    for (const [a, b] of [[[i, -60, 0], [i, 60, 0]], [[-60, i, 0], [60, i, 0]]] as const) {
      const p = proj(view(a as [number, number, number]))
      const q = proj(view(b as [number, number, number]))
      ctx.beginPath()
      ctx.moveTo(p[0], p[1])
      ctx.lineTo(q[0], q[1])
      ctx.stroke()
    }
  }
  const light: [number, number, number] = [0.4, 0.5, 0.75]
  const items = tris.map((t, ti) => {
    const v = t.map(view)
    const n = normal(t)
    const nv = view([n[0], n[1], n[2] + zc]) // 只要方向:平移抵消
    const shade = Math.max(0.25, nv[0] * light[0] + nv[1] * light[1] + nv[2] * light[2])
    const above = sliceZ != null && Math.min(t[0][2], t[1][2], t[2][2]) >= sliceZ - 1e-6
    return { bad: !!opt.over?.[ti], v, depth: (v[0][2] + v[1][2] + v[2][2]) / 3, shade, above, front: nv[2] > 0 }
  })
  items.sort((a, b) => a.depth - b.depth)
  const tone = (r: number, g: number, b: number, k: number) => {
    const m = 0.32 + 0.68 * Math.min(1, k)
    return `rgb(${Math.round(r * m)},${Math.round(g * m)},${Math.round(b * m)})`
  }
  ctx.lineWidth = px * 0.75
  ctx.lineJoin = 'round'
  for (const it of items) {
    const p = it.v.map(proj)
    ctx.beginPath()
    ctx.moveTo(p[0][0], p[0][1])
    ctx.lineTo(p[1][0], p[1][1])
    ctx.lineTo(p[2][0], p[2][1])
    ctx.closePath()
    const k = it.shade
    ctx.fillStyle = opt.wire ? 'rgba(45,212,191,.05)' : it.bad ? tone(244, 96, 78, k) : it.above ? 'rgba(94,234,212,.09)' : tone(64, 208, 190, k)
    ctx.fill()
    if (!it.above) {
      // 實體:用同色描邊把三角形之間的縫補起來,面看起來才平整
      ctx.strokeStyle = opt.wire ? 'rgba(94,234,212,.7)' : ctx.fillStyle
      ctx.stroke()
    }
  }
}

function drawSlice(cv: HTMLCanvasElement, segs: ReturnType<typeof sliceAt>, extent: number) {
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const W = cv.width
  ctx.clearRect(0, 0, W, W)
  ctx.strokeStyle = 'rgba(255,255,255,.08)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W / 2, 12)
  ctx.lineTo(W / 2, W - 12)
  ctx.moveTo(12, W / 2)
  ctx.lineTo(W - 12, W / 2)
  ctx.stroke()
  const k = (W * 0.42) / Math.max(10, extent)
  ctx.strokeStyle = '#2dd4bf'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  for (const [a, b] of segs) {
    ctx.beginPath()
    ctx.moveTo(W / 2 + a[0] * k, W / 2 - a[1] * k)
    ctx.lineTo(W / 2 + b[0] * k, W / 2 - b[1] * k)
    ctx.stroke()
  }
}

export function Print3dPage() {
  const [p, setP] = useState<ShapeParams>(DEFAULTS)
  const [yaw, setYaw] = useState(0.7)
  const [pitch, setPitch] = useState(0.55)
  const [layer, setLayer] = useState(0.2)
  const [sliceAtPct, setSliceAtPct] = useState<number | null>(null)
  const [infill, setInfill] = useState(20)
  const view = useRef<HTMLCanvasElement>(null)
  const slice = useRef<HTMLCanvasElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef(0)
  const [zoom, setZoom] = useState(1)
  const [wire, setWire] = useState(false)
  const [grid, setGrid] = useState(true)
  const [showOver, setShowOver] = useState(true)
  const past = useRef<ShapeParams[]>([])
  const future = useRef<ShapeParams[]>([])
  const lastEdit = useRef(0)
  const [, bump] = useState(0)
  // 改參數:拖滑桿連續的變動併成一步復原
  const edit = (next: ShapeParams) => {
    const now = Date.now()
    if (now - lastEdit.current > 500) past.current = [...past.current.slice(-49), p]
    lastEdit.current = now
    future.current = []
    setP(next)
    bump((n) => n + 1)
  }
  const undo = () => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(p)
    lastEdit.current = 0
    setP(prev)
    bump((n) => n + 1)
  }
  const redo = () => {
    const nxt = future.current.pop()
    if (!nxt) return
    past.current.push(p)
    lastEdit.current = 0
    setP(nxt)
    bump((n) => n + 1)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      if ((e.target as HTMLElement)?.tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'number') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const tris = useMemo(() => buildMesh(p), [p])
  const m = useMemo(() => measure(tris), [tris])
  const H = p.height * p.scale
  const oh = useMemo(() => overhangs(tris), [tris])
  const sliceZ = sliceAtPct == null ? null : Math.max(0.01, Math.min(H - 0.01, (H * sliceAtPct) / 100))
  const segs = useMemo(() => (sliceZ == null ? [] : sliceAt(tris, sliceZ)), [tris, sliceZ])
  const layers = Math.ceil(H / layer)
  // 用料粗估:外殼(表面積 × 約 0.8 mm 牆厚)+ 內部 × 填充率
  const shell = Math.min(m.volume, m.area * 0.8)
  const extruded = shell + (m.volume - shell) * (infill / 100)
  const grams = (extruded / 1000) * PLA

  useEffect(() => {
    if (view.current) draw(view.current, tris, yaw, pitch, H, sliceZ, zoom, { wire, grid, over: showOver && oh.area > 0 ? oh.flags : null })
  }, [tris, yaw, pitch, H, sliceZ, zoom, wire, grid, showOver, oh])
  useEffect(() => {
    if (slice.current) drawSlice(slice.current, segs, Math.max(m.size[0], m.size[1]) / 2)
  }, [segs, m.size])

  const download = (fmt: 'stl' | 'obj') => {
    const blob = fmt === 'stl' ? new Blob([toStl(tris, `evoleap-${p.kind}`)], { type: 'model/stl' }) : new Blob([toObj(tris, `evoleap-${p.kind}`)], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `evoleap-${p.kind}.${fmt}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const resetView = () => {
    setZoom(1)
    setYaw(0.7)
    setPitch(0.55)
  }
  // 方位小標示:把 X/Y/Z 單位向量用同一個視角投影到螢幕
  const cyw = Math.cos(yaw)
  const syw = Math.sin(yaw)
  const axes = [
    { n: 'X', x: cyw, y: -syw * Math.sin(pitch), d: -syw * Math.cos(pitch), c: '#f87171' },
    { n: 'Y', x: -syw, y: -cyw * Math.sin(pitch), d: -cyw * Math.cos(pitch), c: '#4ade80' },
    { n: 'Z', x: 0, y: -Math.cos(pitch), d: Math.sin(pitch), c: '#60a5fa' },
  ].sort((a, b) => a.d - b.d)
  const needSupport = oh.area > 0
  const fileBase = `evoleap-${p.kind}`

  return (
    <ProposalLayout title="3D 列印：數學造形" footer="開發 · 試做" wide>
      <div className={s.app}>
        <header className={s.head}>
          <span className={s.eyebrow}>開發 · 試做</span>
          <h1 className={s.title}>簡易 3D 列印軟體</h1>
          <p className={s.lead}>形狀都由數學產生：一圈圈的多邊形疊起來。拖曳畫面旋轉；右邊即時顯示公式、尺寸、體積與用料；切片看每一層；下載 STL 可以直接丟進切片軟體列印。構想見 oveleap 文件 DOC-2。</p>
        </header>

        <div className={s.shell}>
          <div className={s.work}>
            <div className={s.shapes} role="group" aria-label="形狀">
              {KINDS.map((k) => (
                <button key={k.kind} type="button" className={`${s.shape} ${p.kind === k.kind ? s.on : ''}`} aria-pressed={p.kind === k.kind} onClick={() => edit({ ...p, kind: k.kind })}>
                  <Ico d={SHAPE_IC[k.kind]} size={22} box={24} />
                  <span>{k.label}</span>
                </button>
              ))}
            </div>

            <div className={s.stage}>
              <div className={s.bar} role="toolbar" aria-label="工具列">
                <div className={s.grp}>
                  <button type="button" className={`${s.tb} ${s.tip}`} onClick={undo} disabled={!past.current.length} aria-label="復原" data-tip="復原 ⌘/Ctrl+Z"><Ico d={IC.undo} /></button>
                  <button type="button" className={`${s.tb} ${s.tip}`} onClick={redo} disabled={!future.current.length} aria-label="重做" data-tip="重做 ⌘/Ctrl+Shift+Z"><Ico d={IC.redo} /></button>
                  <button type="button" className={`${s.tb} ${s.tip}`} onClick={() => edit({ ...DEFAULTS })} aria-label="重設" data-tip="重設:回到預設形狀"><Ico d={IC.reset} /></button>
                </div>
                <select className={s.preset} aria-label="範例" value="" onChange={(e) => e.target.value && edit({ ...DEFAULTS, ...PRESETS[Number(e.target.value)].p } as ShapeParams)}>
                  <option value="">範例…</option>
                  {PRESETS.map((pr, i) => (
                    <option key={pr.label} value={i}>{pr.label}</option>
                  ))}
                </select>
                <span className={s.spacer} />
                <div className={s.grp} role="group" aria-label="視角">
                  {VIEWS.map((v) => {
                    const on = Math.abs(yaw - v.yaw) < 1e-6 && Math.abs(pitch - v.pitch) < 1e-6
                    return (
                      <button key={v.label} type="button" className={`${s.tb} ${s.txt} ${on ? s.cur : ''}`} aria-pressed={on} onClick={() => { setYaw(v.yaw); setPitch(v.pitch) }}>{v.label}</button>
                    )
                  })}
                </div>
                <div className={s.grp} role="group" aria-label="縮放">
                  <button type="button" className={`${s.tb} ${s.tip}`} onClick={() => setZoom((z) => Math.max(0.5, z / 1.2))} aria-label="縮小" data-tip="縮小"><Ico d={IC.minus} /></button>
                  <span className={s.zoom} aria-label={`縮放 ${Math.round(zoom * 100)}%`}>{Math.round(zoom * 100)}%</span>
                  <button type="button" className={`${s.tb} ${s.tip}`} onClick={() => setZoom((z) => Math.min(3, z * 1.2))} aria-label="放大" data-tip="放大"><Ico d={IC.plus} /></button>
                  <button type="button" className={`${s.tb} ${s.tip} ${s.tipEnd}`} onClick={resetView} aria-label="適合畫面" data-tip="適合畫面(雙擊畫面也可以)"><Ico d={IC.fit} /></button>
                </div>
              </div>

              <div className={s.canvasWrap}>
                <canvas
                  ref={view}
                  className={s.view}
                  width={1440}
                  height={1040}
                  // 一根手指(或滑鼠)拖曳旋轉;兩根手指捏合縮放;滑鼠滾輪也能縮放;雙擊回到預設視角
                  onPointerDown={(e) => {
                    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
                    e.currentTarget.setPointerCapture(e.pointerId)
                    pinch.current = 0
                  }}
                  onPointerMove={(e) => {
                    const prev = pointers.current.get(e.pointerId)
                    if (!prev) return
                    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
                    const pts = [...pointers.current.values()]
                    if (pts.length >= 2) {
                      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
                      if (pinch.current > 0) setZoom((z) => Math.max(0.5, Math.min(3, z * (d / pinch.current))))
                      pinch.current = d
                      return
                    }
                    setYaw((v) => v + (e.clientX - prev.x) * 0.01)
                    setPitch((v) => Math.max(0.05, Math.min(1.5, v + (e.clientY - prev.y) * 0.01)))
                  }}
                  onPointerUp={(e) => {
                    pointers.current.delete(e.pointerId)
                    pinch.current = 0
                  }}
                  onPointerCancel={(e) => {
                    pointers.current.delete(e.pointerId)
                    pinch.current = 0
                  }}
                  onWheel={(e) => setZoom((z) => Math.max(0.5, Math.min(3, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))))}
                  onDoubleClick={resetView}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label="3D 預覽:拖曳旋轉,兩指捏合縮放,雙擊回到預設視角"
                />
                <div className={s.hud}>
                  <span>{tris.length.toLocaleString()} 個三角形</span>
                  {needSupport && showOver && (
                    <span className={s.legend}><i />懸空面</span>
                  )}
                </div>
                <div className={`${s.grp} ${s.float}`} role="group" aria-label="顯示">
                  <button type="button" aria-pressed={wire} className={`${s.tb} ${s.txt} ${wire ? s.tOn : ''}`} onClick={() => setWire(!wire)}><Ico d={IC.wire} size={16} />線框</button>
                  <button type="button" aria-pressed={grid} className={`${s.tb} ${s.txt} ${grid ? s.tOn : ''}`} onClick={() => setGrid(!grid)}><Ico d={IC.grid} size={16} />格線</button>
                  <button type="button" aria-pressed={showOver} className={`${s.tb} ${s.txt} ${showOver ? s.tOn : ''}`} onClick={() => setShowOver(!showOver)}><Ico d={IC.over} size={16} />懸空</button>
                </div>
                <svg className={s.gizmo} viewBox="-32 -32 64 64" width="64" height="64" aria-hidden="true" focusable="false">
                  {axes.map((a) => (
                    <g key={a.n} opacity={a.d < 0 ? 0.55 : 1}>
                      <line x1="0" y1="0" x2={a.x * 19} y2={a.y * 19} stroke={a.c} strokeWidth="2" strokeLinecap="round" />
                      <text x={a.x * 26} y={a.y * 26} fill={a.c} fontSize="9" fontWeight="700" textAnchor="middle" dominantBaseline="central">{a.n}</text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            <div className={s.formula} aria-label="公式">
              <span className={s.fxTag}>ƒ(x)</span>
              <div>
                {formulaOf(p).map((f) => (
                  <code key={f}>{f}</code>
                ))}
              </div>
            </div>
          </div>

          <aside className={s.panel} aria-label="設定面板">
            <section className={s.sec}>
              <h2 className={s.secTitle}>參數</h2>
              {[...SLIDERS[p.kind], ...COMMON].map((sl) => {
                const v = p[sl.key] as number
                const [name, hint] = sl.label.replace(')', '').split('(')
                return (
                  <label key={sl.key} className={s.row}>
                    <span className={s.lab}>
                      {name}
                      {hint && <small>{hint}</small>}
                    </span>
                    <input className={s.range} style={{ '--pct': `${((v - sl.min) / (sl.max - sl.min)) * 100}%` } as CSSProperties} type="range" min={sl.min} max={sl.max} step={sl.step} value={v} onChange={(e) => edit({ ...p, [sl.key]: Number(e.target.value) })} />
                    <span className={s.num}>
                      <input
                        type="number"
                        min={sl.min}
                        max={sl.max}
                        step={sl.step}
                        value={v}
                        aria-label={sl.label}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          if (Number.isFinite(v) && e.target.value !== '') edit({ ...p, [sl.key]: Math.max(sl.min, Math.min(sl.max, v)) })
                        }}
                      />
                      {sl.unit && <i>{sl.unit}</i>}
                    </span>
                  </label>
                )
              })}
            </section>

            <section className={s.sec}>
              <h2 className={s.secTitle}>量測</h2>
              <dl className={s.metrics}>
                <div className={s.wideCell}>
                  <dt>尺寸</dt>
                  <dd>{m.size.map((v) => v.toFixed(1)).join(' × ')} <i>mm</i></dd>
                </div>
                <div>
                  <dt>體積</dt>
                  <dd>{(m.volume / 1000).toFixed(2)} <i>cm³</i></dd>
                </div>
                <div>
                  <dt>表面積</dt>
                  <dd>{(m.area / 100).toFixed(1)} <i>cm²</i></dd>
                </div>
                <div>
                  <dt>列印時間</dt>
                  <dd>約 {fmtTime(printSeconds(extruded))}</dd>
                </div>
                <div>
                  <dt>用料</dt>
                  <dd>約 {grams.toFixed(1)} <i>g PLA</i></dd>
                </div>
                <div className={s.wideCell}>
                  <dt>支撐</dt>
                  <dd>
                    {needSupport ? (
                      <span className={`${s.tag} ${s.warn}`}><Ico d={IC.warn} size={14} />需要支撐 · 懸空 {(oh.area / 100).toFixed(1)} cm²(紅色)</span>
                    ) : (
                      <span className={`${s.tag} ${s.ok}`}><Ico d={IC.check} size={14} />不需要</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section className={s.sec}>
              <h2 className={s.secTitle}>
                切片
                {sliceAtPct != null && (
                  <button type="button" className={s.link} onClick={() => setSliceAtPct(null)}>關閉截面</button>
                )}
              </h2>
              <label className={s.row}>
                <span className={s.lab}>層高</span>
                <input className={s.range} style={{ '--pct': `${((layer - 0.1) / 0.3) * 100}%` } as CSSProperties} type="range" min={0.1} max={0.4} step={0.05} value={layer} onChange={(e) => setLayer(Number(e.target.value))} />
                <b className={s.val}>{layer.toFixed(2)} <i>mm</i></b>
              </label>
              <label className={s.row}>
                <span className={s.lab}>填充</span>
                <input className={s.range} style={{ '--pct': `${infill}%` } as CSSProperties} type="range" min={0} max={100} step={5} value={infill} onChange={(e) => setInfill(Number(e.target.value))} />
                <b className={s.val}>{infill} <i>%</i></b>
              </label>
              <label className={s.row}>
                <span className={s.lab}>看第幾層</span>
                <input className={s.range} style={{ '--pct': `${sliceAtPct ?? 50}%` } as CSSProperties} type="range" min={0} max={100} step={1} value={sliceAtPct ?? 50} onChange={(e) => setSliceAtPct(Number(e.target.value))} onFocus={() => sliceAtPct == null && setSliceAtPct(50)} />
                <b className={s.val}>{sliceZ == null ? '—' : `${Math.max(1, Math.ceil(sliceZ / layer))} / ${layers}`}</b>
              </label>
              <div className={s.sliceBox}>
                <div className={s.sliceWrap}>
                  <canvas ref={slice} width={280} height={280} className={s.slice} aria-label="這一層的截面" />
                  {sliceZ == null && <span className={s.sliceHint}>拖曳「看第幾層」<br />顯示截面</span>}
                </div>
                <dl className={s.sliceStats}>
                  <dt>層數</dt>
                  <dd>{layers} <i>層</i></dd>
                  <dd className={s.calc}>{+H.toFixed(1)} ÷ {layer} = {layers}</dd>
                  <dt>截面高度</dt>
                  <dd>{sliceZ == null ? '—' : <>{sliceZ.toFixed(1)} <i>mm</i></>}</dd>
                </dl>
              </div>
            </section>

            <section className={`${s.sec} ${s.out}`}>
              <h2 className={s.secTitle}>輸出</h2>
              <div className={s.dl}>
                <button type="button" className={s.download} onClick={() => download('stl')}>
                  <Ico d={IC.download} />
                  下載 STL
                </button>
                <button type="button" className={`${s.download} ${s.alt}`} onClick={() => download('obj')}>
                  下載 OBJ
                </button>
              </div>
              <p className={s.file}>{fileBase}.stl · {tris.length.toLocaleString()} 個三角形</p>
            </section>
          </aside>
        </div>
      </div>
    </ProposalLayout>
  )
}
