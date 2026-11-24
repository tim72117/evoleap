import { useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { ProposalLayout } from './ProposalLayout'
import s from './MathAreaPage.module.css'

// 試作:4 年級數學「同樣長的圍籬,圍出最大的地」(面積與周長;構想見 oveleap 文件 DOC-1)。
// 單獨操作、不用字卡:農夫有 24 公尺的圍籬,拖右邊的把手把長方形拉寬或拉窄(圍籬長度不變),
// 裡面的方格一格一格數出來;算式條跟著長出 長 × 寬 = 面積;下面的長條圖每試一種形狀就多一根,
// 孩子自己看出「周長一樣,面積不一樣」和「最大的是正方形」。動物客人需要的格數在旁邊。

export const FENCE = 24
const HALF = FENCE / 2 // 長 + 寬 = 12
export const MAX_W = HALF - 1
const CELL = 36
const PAD = 40
const SIDE = HALF * CELL + PAD * 2

export const shapeOf = (w: number) => ({ w, h: HALF - w, area: w * (HALF - w), perimeter: FENCE })
export const BEST = Math.max(...[...Array(MAX_W)].map((_, i) => shapeOf(i + 1).area))
const ANIMALS = [
  { icon: '🐑', need: 30 },
  { icon: '🐘', need: BEST },
]

/** 圍籬:沿著長方形邊界,每一公尺一段 */
function fenceSegments(w: number, h: number): { x1: number; y1: number; x2: number; y2: number }[] {
  const out: { x1: number; y1: number; x2: number; y2: number }[] = []
  const line = (x1: number, y1: number, x2: number, y2: number) => out.push({ x1: PAD + x1 * CELL, y1: PAD + y1 * CELL, x2: PAD + x2 * CELL, y2: PAD + y2 * CELL })
  for (let i = 0; i < w; i++) line(i, 0, i + 1, 0)
  for (let i = 0; i < h; i++) line(w, i, w, i + 1)
  for (let i = w; i > 0; i--) line(i, h, i - 1, h)
  for (let i = h; i > 0; i--) line(0, i, 0, i - 1)
  return out
}

export function MathAreaPage() {
  const [w, setW] = useState(3)
  const [tried, setTried] = useState<number[]>([3])
  const [hint, setHint] = useState(false)
  const [trail, setTrail] = useState<number[]>([3]) // 最近試過的順序(最後兩個拿來比大小)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  const cur = shapeOf(w)
  const pick = (next: number) => {
    const v = Math.max(1, Math.min(MAX_W, next))
    if (v === w) return
    setW(v)
    setHint(false)
    setTried((t) => (t.includes(v) ? t : [...t, v]))
    setTrail((t) => [...t.filter((x) => x !== v), v].slice(-2))
  }
  const toW = (e: RPointerEvent) => {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!svg || !m) return w
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    return Math.round((pt.matrixTransform(m.inverse()).x - PAD) / CELL)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') pick(w + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') pick(w - 1)
    else return
    e.preventDefault()
  }

  const areas = tried.map((v) => shapeOf(v).area)
  const stars = [tried.length >= 3, areas.some((a) => a >= 30), tried.includes(HALF / 2)]
  const open = stars.every(Boolean)
  const relation = (() => {
    if (trail.length < 2) return null
    const [a, b] = [shapeOf(trail[0]), shapeOf(trail[1])]
    if (a.area === b.area) return `${a.w} × ${a.h} = ${b.w} × ${b.h} = ${a.area}`
    return a.area < b.area ? `${a.w} × ${a.h} = ${a.area} < ${b.w} × ${b.h} = ${b.area}` : `${b.w} × ${b.h} = ${b.area} < ${a.w} × ${a.h} = ${a.area}`
  })()

  const barW = 34
  const barH = 130

  return (
    <ProposalLayout title="數學實例化：圍籬與面積" footer="開發 · 試作">
      <h1>開發 · 數學實例化：圍籬與面積</h1>
      <p className={s.lead}>4 年級「同樣長的圍籬，圍出最大的地」試作。拖右邊的把手把地拉寬或拉窄，圍籬永遠是 24 公尺；不用字卡，算式與圖表跟著操作長出來。構想見 oveleap 文件 DOC-1。</p>

      <div className={`${s.app}${open ? ` ${s.open}` : ''}`}>
        <div className={s.top}>
          <div className={s.stars} aria-label="完成度">
            {stars.map((on, i) => (
              <span key={i} className={on ? s.on : ''} />
            ))}
            {open && <span className={s.openTag}>OPEN</span>}
          </div>
          <div className={s.animals}>
            {ANIMALS.map((a) => {
              const ok = cur.area >= a.need
              return (
                <div key={a.icon} className={`${s.animal} ${ok ? s.happy : s.sad}`}>
                  <span className={s.face}>{a.icon}</span>
                  <span className={s.mood} aria-hidden="true">{ok ? '●' : '○'}</span>
                  <b className={s.need}>{a.need} 格</b>
                </div>
              )
            })}
          </div>
        </div>

        <div className={s.main}>
          <svg
            ref={svgRef}
            className={s.field}
            viewBox={`0 0 ${SIDE} ${SIDE}`}
            role="img"
            aria-label={`長 ${cur.w}、寬 ${cur.h} 的地,面積 ${cur.area} 格`}
            onPointerMove={(e) => dragging.current && pick(toW(e))}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
          >
            <rect x={0} y={0} width={SIDE} height={SIDE} fill="#f4f2ec" rx={4} />
            {[...Array(HALF + 1)].map((_, i) => (
              <g key={i} stroke="#d9d6cc" strokeWidth={1}>
                <line x1={PAD + i * CELL} y1={PAD} x2={PAD + i * CELL} y2={PAD + HALF * CELL} />
                <line x1={PAD} y1={PAD + i * CELL} x2={PAD + HALF * CELL} y2={PAD + i * CELL} />
              </g>
            ))}
            {[...Array(cur.h)].map((_, r) =>
              [...Array(cur.w)].map((__, c) => (
                <g key={`${r}-${c}`}>
                  <rect x={PAD + c * CELL + 1} y={PAD + r * CELL + 1} width={CELL - 2} height={CELL - 2} rx={1} fill="#d9ece9" stroke="#9fcfc8" />
                  <text x={PAD + c * CELL + CELL / 2} y={PAD + r * CELL + CELL / 2 + 4} textAnchor="middle" fontSize={11} fill="#4f8a83">
                    {r * cur.w + c + 1}
                  </text>
                </g>
              )),
            )}
            {fenceSegments(cur.w, cur.h).map((l, i) => (
              <line key={i} {...l} stroke="#1f2328" strokeWidth={3.5} strokeLinecap="square" />
            ))}
            <text x={PAD + (cur.w * CELL) / 2} y={PAD - 12} textAnchor="middle" fontSize={18} fontWeight={600} fill="#1f2328">
              {cur.w}
            </text>
            <text x={PAD - 14} y={PAD + (cur.h * CELL) / 2 + 7} textAnchor="middle" fontSize={18} fontWeight={600} fill="#1f2328">
              {cur.h}
            </text>
            <g
              className={`${s.handle}${hint ? ` ${s.pulse}` : ''}`}
              role="slider"
              tabIndex={0}
              aria-label="拉寬或拉窄"
              aria-valuemin={1}
              aria-valuemax={MAX_W}
              aria-valuenow={cur.w}
              onKeyDown={onKey}
              onPointerDown={(e) => {
                dragging.current = true
                svgRef.current?.setPointerCapture?.(e.pointerId)
              }}
            >
              <circle cx={PAD + cur.w * CELL} cy={PAD + (cur.h * CELL) / 2} r={26} fill="transparent" />
              <circle cx={PAD + cur.w * CELL} cy={PAD + (cur.h * CELL) / 2} r={16} fill="#fff" stroke="#0f766e" strokeWidth={2} />
              <text x={PAD + cur.w * CELL} y={PAD + (cur.h * CELL) / 2 + 6} textAnchor="middle" fontSize={18} fill="#0f766e">
                ↔
              </text>
            </g>
          </svg>

          <div className={s.side}>
            <div className={s.bars} role="group" aria-label="試過的形狀的面積">
              <svg viewBox={`0 0 ${MAX_W * barW + 16} ${barH + 62}`} width="100%">
                <g transform="translate(0 16)">
                {[...Array(MAX_W)].map((_, i) => {
                  const v = i + 1
                  const sh = shapeOf(v)
                  const done = tried.includes(v)
                  const h = (sh.area / BEST) * barH
                  const x = 8 + i * barW
                  return (
                    <g key={v} className={s.bar} onClick={() => pick(v)}>
                      <rect x={x} y={0} width={barW} height={barH + 46} fill="transparent" />
                      {done ? (
                        <rect x={x + 4} y={barH - h} width={barW - 8} height={h} rx={1} fill={v === w ? '#0f766e' : '#a8b3c0'} />
                      ) : (
                        <rect x={x + 4} y={barH - 28} width={barW - 8} height={28} rx={1} fill="none" stroke="#c9c5b8" strokeDasharray="3 4" />
                      )}
                      <text x={x + barW / 2} y={done ? barH - h - 5 : barH - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill={done ? '#1f2328' : '#a39f92'}>
                        {done ? sh.area : '?'}
                      </text>
                      <text x={x + barW / 2} y={barH + 16} textAnchor="middle" fontSize={11} fill="#6b7280">
                        {v}×{sh.h}
                      </text>
                    </g>
                  )
                })}
                </g>
              </svg>
            </div>
            <div className={s.tools}>
              <button type="button" className={s.tool} onClick={() => setHint(true)} aria-label="提示">
                提示
              </button>
              <button
                type="button"
                className={s.tool}
                onClick={() => {
                  setW(3)
                  setTried([3])
                  setTrail([3])
                  setHint(false)
                }}
                aria-label="重來"
              >
                重來
              </button>
            </div>
          </div>
        </div>

        <div className={s.strip} aria-live="polite">
          <span className={s.term}>
            {cur.w} × {cur.h} = {cur.area}
          </span>
          <span className={s.term}>
            ({cur.w} + {cur.h}) × 2 = {FENCE}
          </span>
          {relation && <span className={`${s.term} ${s.rel}`}>{relation}</span>}
        </div>
      </div>
    </ProposalLayout>
  )
}
