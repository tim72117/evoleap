import { useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { ProposalLayout } from './ProposalLayout'
import s from './MathFractionPage.module.css'

// 試做:國小數學「分數是平分出來的」(數學實例化模式,構想見 oveleap 文件 DOC-1)。
// 單一互動介面,沒有字卡、沒有腳本帶路:點披薩切成等分,把片拖到動物的盤子;
// 拿得少的動物會皺眉,下方的算式條跟著操作長出 1/4、2/4 = 1/2、1/3 > 1/4。
// 背後記下三件事(公平平分、找到等值、比大小),都做到時披薩店開張。

const CUTS = [1, 2, 3, 4, 6, 8]
const ANIMALS = ['🐻', '🐰', '🐱', '🐶', '🐼', '🦊']
const R = 110

type Slice = { pizza: number; idx: number; n: number }
type Frac = [number, number]

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
const add = ([a, b]: Frac, [c, d]: Frac): Frac => {
  const n = a * d + c * b
  const m = b * d
  const g = gcd(n, m) || 1
  return [n / g, m / g]
}
const totalOf = (list: Slice[]): Frac => list.reduce<Frac>((t, x) => add(t, [1, x.n]), [0, 1])
const value = ([a, b]: Frac) => a / b
/** 盤子上的寫法:同樣大小的片寫成 k/n(不約分,讓孩子看到 2/4);混著的寫成相加 */
const written = (list: Slice[]): string => {
  if (!list.length) return ''
  const ns = [...new Set(list.map((x) => x.n))]
  if (ns.length === 1) return `${list.length}/${ns[0]}`
  return ns.map((n) => `${list.filter((x) => x.n === n).length}/${n}`).join(' + ')
}
const reduced = ([a, b]: Frac) => (b === 1 ? `${a}` : `${a}/${b}`)

/** 圓心 (cx,cy)、半徑 r,從第 i 片開始的 k 片(每片 1/n)的扇形 */
function wedge(cx: number, cy: number, r: number, n: number, from: number, k = 1): string {
  if (n === 1 && k >= 1) return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`
  const a0 = -Math.PI / 2 + (from * 2 * Math.PI) / n
  const a1 = a0 + (k * 2 * Math.PI) / n
  const p = (a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
  return `M${cx} ${cy} L${p(a0)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`
}
/** 片上的配料(依片的中心角放幾顆) */
function toppings(cx: number, cy: number, r: number, n: number, i: number): { x: number; y: number }[] {
  const mid = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n
  const count = n <= 2 ? 4 : n <= 4 ? 2 : 1
  return [...Array(count)].map((_, j) => {
    const rr = r * (0.35 + 0.35 * ((j % 2) + 0.5) / 1.5)
    const da = n === 1 ? (j * Math.PI) / 2 : (j - (count - 1) / 2) * (Math.PI / n) * 0.6
    return { x: cx + rr * Math.cos(mid + da), y: cy + rr * Math.sin(mid + da) }
  })
}

function Slice({ cx, cy, r, n, i }: { cx: number; cy: number; r: number; n: number; i: number }) {
  return (
    <g>
      <path d={wedge(cx, cy, r, n, i)} fill="#e3cfa0" stroke="#8a6d3b" strokeWidth={r / 40} strokeLinejoin="round" />
      <path d={wedge(cx, cy, r * 0.86, n, i)} fill="#c8654a" opacity={0.92} />
      {toppings(cx, cy, r, n, i).map((t, j) => (
        <circle key={j} cx={t.x} cy={t.y} r={r / 11} fill="#7e3322" />
      ))}
    </g>
  )
}

export function MathFractionPage() {
  const [pizzas, setPizzas] = useState<number[]>([1]) // 每個披薩切成幾片
  const [plates, setPlates] = useState<Slice[][]>([[], [], [], []])
  const [drag, setDrag] = useState<{ slice: Slice; from: number | 'pizza'; x: number; y: number } | null>(null)
  const [done, setDone] = useState({ fair: false, equal: false, compare: false })
  const [hint, setHint] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const pend = useRef<{ slice: Slice; from: number | 'pizza'; x: number; y: number; id: number } | null>(null)

  const onTable = (p: number): Slice[] => {
    const n = pizzas[p]
    const taken = new Set(plates.flat().filter((x) => x.pizza === p).map((x) => x.idx))
    return [...Array(n)].map((_, idx) => ({ pizza: p, idx, n })).filter((x) => !taken.has(x.idx) && !(drag && drag.from === 'pizza' && drag.slice.pizza === p && drag.slice.idx === x.idx))
  }
  const untouched = (p: number) => !plates.flat().some((x) => x.pizza === p)

  // 每個盤子的量、心情、算式條
  const totals = plates.map(totalOf)
  const filled = totals.map((t, i) => ({ i, t })).filter((x) => plates[x.i].length)
  const max = Math.max(0, ...filled.map((x) => value(x.t)))
  const allServed = plates.length >= 2 && filled.length === plates.length
  const fair = allServed && filled.every((x) => value(x.t) === max)
  const lines: string[] = []
  for (let a = 0; a < plates.length; a++)
    for (let b = a + 1; b < plates.length; b++) {
      if (!plates[a].length || !plates[b].length) continue
      const wa = written(plates[a])
      const wb = written(plates[b])
      if (wa === wb) continue
      const va = value(totals[a])
      const vb = value(totals[b])
      const line = va === vb ? `${wa} = ${wb}` : va > vb ? `${wa} > ${wb}` : `${wb} > ${wa}`
      if (!lines.includes(line)) lines.push(line)
    }

  // 背後記下做到過的事(只會由 false 變 true)
  const next = { ...done }
  if (fair && filled.length >= 2) next.fair = true
  if (lines.some((l) => l.includes('=') && /\d\/\d/.test(l))) next.equal = true
  if (lines.some((l) => l.includes('>'))) next.compare = true
  if (next.fair !== done.fair || next.equal !== done.equal || next.compare !== done.compare) queueMicrotask(() => setDone(next))
  const open = done.fair && done.equal && done.compare

  const cut = (p: number) => {
    if (!untouched(p)) return
    setPizzas((ps) => ps.map((n, i) => (i === p ? CUTS[(CUTS.indexOf(n) + 1) % CUTS.length] : n)))
    setHint(null)
  }
  const reset = () => {
    setPizzas((ps) => ps.map(() => 1))
    setPlates((pl) => pl.map(() => []))
    setHint(null)
  }

  // 拖曳:按住一片,放到盤子上(或放回桌上)
  // 手指或滑鼠按下:先記著,移動超過 8px 才算拖(拿起那一片);沒移動就放開是「點一下」(點披薩切片)。
  // 事件接在最外層並鎖定那根手指(setPointerCapture):拖的時候原本的那片會從畫面上拿掉,事件不能跟著它消失。
  const start = (e: RPointerEvent, slice: Slice, from: number | 'pizza') => {
    if (pend.current || drag) return // 第二根手指不理它
    pend.current = { slice, from, x: e.clientX, y: e.clientY, id: e.pointerId }
    rootRef.current?.setPointerCapture?.(e.pointerId)
  }
  const move = (e: RPointerEvent) => {
    if (drag) return setDrag({ ...drag, x: e.clientX, y: e.clientY })
    const p = pend.current
    if (!p || p.id !== e.pointerId || Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return
    setDrag({ slice: p.slice, from: p.from, x: e.clientX, y: e.clientY })
    if (p.from !== 'pizza') setPlates((pl) => pl.map((list, i) => (i === p.from ? list.filter((x) => !(x.pizza === p.slice.pizza && x.idx === p.slice.idx)) : list)))
    pend.current = null
  }
  const end = (e: RPointerEvent) => {
    rootRef.current?.releasePointerCapture?.(e.pointerId)
    if (drag) {
      const hit = document.elementsFromPoint(e.clientX, e.clientY).map((el) => (el as HTMLElement).dataset?.plate).find((v) => v != null)
      if (hit != null) setPlates((pl) => pl.map((list, i) => (i === Number(hit) ? [...list, drag.slice] : list)))
      setDrag(null)
      setHint(null)
    } else if (pend.current?.from === 'pizza' && untouched(pend.current.slice.pizza)) cut(pend.current.slice.pizza)
    pend.current = null
  }
  const cancel = () => {
    pend.current = null
    setDrag(null)
  }

  const showHint = () => {
    if (!done.fair) setHint(pizzas[0] === 1 ? 'pizza' : 'plate')
    else if (!done.equal) setHint(pizzas.length < 2 ? 'more' : 'pizza')
    else setHint('pizza')
  }

  const size = 2 * R + 20
  return (
    <ProposalLayout title="數學實例化：分數披薩" footer="開發 · 試做">
      <h1>開發 · 數學實例化：分數披薩</h1>
      <p className={s.lead}>國小數學「分數是平分出來的」試做。點披薩切成等分，把片拖到動物的盤子；不用字卡、沒有旁白帶路，算式條跟著操作長出來。構想見 oveleap 文件 DOC-1。</p>

      <div ref={rootRef} className={`${s.app}${open ? ` ${s.open}` : ''}`} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onContextMenu={(e) => e.preventDefault()}>
        <div className={s.sign} aria-label={open ? '完成' : '進度'}>
          <span className={s.stars}>{[done.fair, done.equal, done.compare].map((d, i) => <span key={i} className={d ? s.on : ''} />)}</span>
          {open && <span className={s.openTag}>OPEN</span>}
        </div>

        <div className={s.table}>
          {pizzas.map((n, p) => (
            <div key={p} className={`${s.pizza}${hint === 'pizza' && p === 0 ? ` ${s.glow}` : ''}`}>
              <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`披薩,切成 ${n} 片`}>
                <circle cx={size / 2} cy={size / 2} r={R + 6} fill="#efeae0" />
                <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="#cfc8b8" strokeDasharray="3 5" />
                {onTable(p).map((sl) => (
                  <g key={sl.idx} className={s.slice} onPointerDown={(e) => start(e, sl, 'pizza')}>
                    <Slice cx={size / 2} cy={size / 2} r={R} n={n} i={sl.idx} />
                  </g>
                ))}
              </svg>
              <button type="button" className={s.knife} onClick={() => cut(p)} disabled={!untouched(p)} aria-label="切披薩">切</button>
            </div>
          ))}
          <div className={s.tools}>
            {pizzas.length < 2 && (
              <button type="button" className={`${s.tool}${hint === 'more' ? ` ${s.glow}` : ''}`} onClick={() => setPizzas((ps) => [...ps, 1])} aria-label="再拿一個一樣大的披薩">＋披薩</button>
            )}
            <button type="button" className={s.tool} onClick={() => plates.length < 6 && setPlates((pl) => [...pl, []])} disabled={plates.length >= 6} aria-label="再來一位客人">＋客人</button>
            <button type="button" className={s.tool} onClick={reset} aria-label="重來">重來</button>
            <button type="button" className={s.tool} onClick={showHint} aria-label="提示">提示</button>
          </div>
        </div>

        <div className={s.plates}>
          {plates.map((list, i) => {
            const v = value(totals[i])
            const mood = !list.length ? 'wait' : allServed ? (v === max ? 'happy' : 'sad') : 'ok'
            return (
              <div key={i} className={`${s.plate} ${s[mood]}${hint === 'plate' ? ` ${s.glow}` : ''}`} data-plate={i}>
                <div className={s.animal} data-plate={i}>
                  {ANIMALS[i]}
                  <span className={s.mood} aria-hidden="true">{mood === 'happy' ? '●' : mood === 'sad' ? '○' : ''}</span>
                </div>
                <svg viewBox="0 0 120 120" width={110} height={110} data-plate={i}>
                  <circle cx={60} cy={60} r={54} fill="#fff" stroke="#cfc8b8" strokeWidth={1.5} data-plate={i} />
                  {(() => {
                    // 盤子上的片依序排成一圈:2 片 1/4 看起來剛好是半個
                    let at = 0
                    return list.map((sl, k) => {
                      const from = at * sl.n
                      at += 1 / sl.n
                      return (
                        <g key={k} className={s.slice} onPointerDown={(e) => start(e, sl, i)}>
                          <Slice cx={60} cy={60} r={44} n={sl.n} i={from} />
                        </g>
                      )
                    })
                  })()}
                </svg>
                <div className={s.amount}>{written(list)}</div>
              </div>
            )
          })}
        </div>

        <div className={s.strip} aria-live="polite">
          {plates.map((list, i) => list.length > 0 && (
            <span key={i} className={s.term}>{ANIMALS[i]} {written(list)}{written(list).includes('+') || (list.length > 1 && reduced(totals[i]) !== written(list)) ? ` = ${reduced(totals[i])}` : ''}</span>
          ))}
          {lines.map((l) => (
            <span key={l} className={`${s.term} ${s.rel}`}>{l}</span>
          ))}
        </div>

        {drag && (
          <svg className={s.ghost} style={{ left: drag.x - 70, top: drag.y - 70 }} viewBox="0 0 140 140" width={140} height={140}>
            <Slice cx={70} cy={70} r={60} n={drag.slice.n} i={drag.slice.idx} />
          </svg>
        )}
      </div>
    </ProposalLayout>
  )
}
