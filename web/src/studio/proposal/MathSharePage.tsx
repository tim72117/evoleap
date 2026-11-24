import { useEffect, useRef, useState } from 'react'
import { ProposalLayout } from './ProposalLayout'
import s from './MathSharePage.module.css'

// 試作:分數是除法「分食物給動物:公平嗎?」(構想見 oveleap 文件庫的分數構想)。
// 單獨操作、不用字卡:幾隻動物分幾條麵包,孩子把每條麵包切成幾份(− / +),再一塊一塊點,把它給動物(換一隻就換顏色);
// 每隻動物拿到的量用長條與分數即時顯示,全部分完而且每隻一樣多,動物就滿意了,「麵包 ÷ 動物 = 分數」的算式跟著長出來。
// 孩子自己看出:不管怎麼切,每隻拿到的都是同一個分數,分數就是除法。

export type Frac = [num: number, den: number]
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))
export const reduce = ([n, d]: Frac): Frac => {
  const g = gcd(n, d) || 1
  return [n / g, d / g]
}
export const add = (a: Frac, b: Frac): Frac => reduce([a[0] * b[1] + b[0] * a[1], a[1] * b[1]])
export const same = (a: Frac, b: Frac) => a[0] * b[1] === b[0] * a[1]

/** 一條麵包:切成 parts 份,owners[i] 是第 i 份給了哪一隻動物(-1 還沒給) */
export type Loaf = { parts: number; owners: number[] }
export const freshLoaf = (): Loaf => ({ parts: 1, owners: [-1] })

/** 第 animal 隻動物拿到的量(幾條麵包) */
export function shareOf(loaves: Loaf[], animal: number): Frac {
  let sum: Frac = [0, 1]
  for (const l of loaves) for (const o of l.owners) if (o === animal) sum = add(sum, [1, l.parts])
  return sum
}
/** 全部分完、而且每隻一樣多(回傳那個分數,否則 null) */
export function fairShare(loaves: Loaf[], animals: number): Frac | null {
  if (loaves.some((l) => l.owners.includes(-1))) return null
  const first = shareOf(loaves, 0)
  for (let a = 1; a < animals; a++) if (!same(first, shareOf(loaves, a))) return null
  return first[0] === 0 ? null : first
}

export const MAX_PARTS = 8
export const TASKS = [
  { animals: 3, loaves: 2 },
  { animals: 4, loaves: 3 },
  { animals: 2, loaves: 3 },
]
const COLORS = ['#0f766e', '#b4563c', '#5b6b82', '#a8863a']
const TINTS = ['#d9e9e6', '#f2dfd7', '#dfe4ea', '#efe7d2']
const NAMES = ['綿羊', '小熊', '兔子', '狐狸']

type Mood = 'happy' | 'sad' | 'idle'

/** 分數的寫法:分子疊在分母上(整數就直接寫) */
export function Fr({ f }: { f: Frac }) {
  if (f[0] === 0) return <span className={s.whole}>0</span>
  if (f[1] === 1) return <span className={s.whole}>{f[0]}</span>
  return (
    <span className={s.fr} role="img" aria-label={`${f[1]} 分之 ${f[0]}`}>
      <i aria-hidden="true">{f[0]}</i>
      <i aria-hidden="true">{f[1]}</i>
    </span>
  )
}

/** 動物頭像:平面幾何色塊,每隻最多兩個色階、沒有描邊與漸層;底下一個牠的代表色淡圓。表情跟著心情(滿意瞇眼笑、不公平垂嘴) */
function Animal({ kind, mood, size = 64 }: { kind: number; mood: Mood; size?: number }) {
  const ink = '#1f2328'
  const cream = '#fbf7ee'
  const face = kind === 0 ? cream : ink
  const mouth = mood === 'happy' ? 'M20 33.5 Q24 37.5 28 33.5' : mood === 'sad' ? 'M20.5 36 Q24 32.8 27.5 36' : 'M21.5 34.6 L26.5 34.6'
  const head =
    kind === 0 ? (
      <>
        {[[12, 22], [17, 13], [26, 10.5], [34, 15], [37, 24], [13.5, 31], [34.5, 31.5]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={7.6} fill={cream} />)}
        <ellipse cx={12.5} cy={26} rx={3} ry={5} fill="#3d4249" transform="rotate(-28 12.5 26)" />
        <ellipse cx={35.5} cy={26} rx={3} ry={5} fill="#3d4249" transform="rotate(28 35.5 26)" />
        <ellipse cx={24} cy={28} rx={10.2} ry={11.4} fill="#4d535b" />
        <circle cx={24} cy={17} r={5.6} fill={cream} />
      </>
    ) : kind === 1 ? (
      <>
        <circle cx={12} cy={15} r={6.2} fill="#8d9aab" />
        <circle cx={36} cy={15} r={6.2} fill="#8d9aab" />
        <circle cx={24} cy={27.5} r={15} fill="#aab5c3" />
        <ellipse cx={24} cy={33} rx={7.6} ry={6.2} fill="#e8ecf1" />
      </>
    ) : kind === 2 ? (
      <>
        <ellipse cx={17.5} cy={12} rx={4.6} ry={10.5} fill={cream} />
        <ellipse cx={30.5} cy={12} rx={4.6} ry={10.5} fill={cream} />
        <ellipse cx={17.5} cy={13} rx={1.9} ry={6.6} fill="#e3b9ad" />
        <ellipse cx={30.5} cy={13} rx={1.9} ry={6.6} fill="#e3b9ad" />
        <circle cx={24} cy={30.5} r={13.6} fill={cream} />
      </>
    ) : (
      <>
        <path d="M8.5 25 L11 6 L23 15 Z" fill="#b8623a" />
        <path d="M39.5 25 L37 6 L25 15 Z" fill="#b8623a" />
        <path d="M24 44.5 L7 26 Q8 14 24 14 Q40 14 41 26 Z" fill="#d98a55" />
        <path d="M24 44.5 L10.5 29.8 Q24 34 37.5 29.8 Z" fill={cream} />
      </>
    )
  const eyeY = 26.4
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={s.avatar}>
      <circle cx={24} cy={24} r={24} fill={TINTS[kind]} />
      {head}
      {mood === 'happy' ? (
        <>
          <path d={`M16.4 ${eyeY + 0.8} q2.1 -2.8 4.2 0`} stroke={face} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <path d={`M27.4 ${eyeY + 0.8} q2.1 -2.8 4.2 0`} stroke={face} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx={18.5} cy={eyeY} r={1.9} fill={face} />
          <circle cx={29.5} cy={eyeY} r={1.9} fill={face} />
        </>
      )}
      <ellipse cx={24} cy={30.6} rx={1.7} ry={1.2} fill={kind === 0 ? cream : ink} />
      <path d={mouth} stroke={kind === 0 ? cream : ink} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** 第 animal 隻動物盤子裡的每一塊(各是切成幾份的其中一份) */
export const piecesOf = (loaves: Loaf[], animal: number): number[] => loaves.flatMap((l) => l.owners.filter((o) => o === animal).map(() => l.parts))

/** 盤子:整個寬度代表「一條麵包」,每一塊的寬度就是它的大小,所以誰多誰少、拼起來一不一樣長,一眼看得出來 */
function Plate({ loaves, animal, plateRef }: { loaves: Loaf[]; animal: number; plateRef: (el: HTMLDivElement | null) => void }) {
  const chips = loaves
    .flatMap((l, i) => l.owners.map((o, k) => ({ o, parts: l.parts, id: `${i}-${k}-${l.parts}` })))
    .filter((c) => c.o === animal)
    .sort((a, b) => a.parts - b.parts)
  return (
    <div className={s.plate} ref={plateRef} aria-hidden="true">
      {chips.map((c) => (
        <span key={c.id} className={s.chip} style={{ width: `calc((100% - ${(c.parts - 1) * 4}px) / ${c.parts})` }} />
      ))}
    </div>
  )
}

const fresh = (n: number) => [...Array(n)].map(freshLoaf)
const calm = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function MathSharePage() {
  const [task, setTask] = useState(0)
  const { animals, loaves: count } = TASKS[task]
  const [loaves, setLoaves] = useState<Loaf[]>(() => fresh(TASKS[0].loaves))
  const [solved, setSolved] = useState<number[]>([])
  const plates = useRef<(HTMLDivElement | null)[]>([])
  const strip = useRef<HTMLDivElement | null>(null)

  const go = (t: number) => {
    setTask(t)
    setLoaves(fresh(TASKS[t].loaves))
  }
  const update = (next: Loaf[]) => {
    setLoaves(next)
    if (fairShare(next, animals) && !solved.includes(task)) setSolved((x) => [...x, task])
  }
  const cut = (i: number, delta: number) => {
    const parts = Math.max(1, Math.min(MAX_PARTS, loaves[i].parts + delta))
    if (parts === loaves[i].parts) return
    update(loaves.map((l, j) => (j === i ? { parts, owners: Array(parts).fill(-1) } : l)))
  }
  /** 一塊麵包從砧板飛到那隻動物的盤子 */
  const fly = (from: HTMLElement, to: number) => {
    const plate = plates.current[to]
    if (!plate || typeof from.animate !== 'function' || calm()) return
    const a = from.getBoundingClientRect()
    const b = plate.getBoundingClientRect()
    const g = document.createElement('div')
    g.className = s.ghost
    Object.assign(g.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` })
    document.body.appendChild(g)
    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height / 2 - (a.top + a.height / 2)
    const k = Math.min(1, 24 / a.height)
    const anim = g.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 18}px) scale(${(1 + k) / 2})`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0.25 },
      ],
      { duration: 400, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    )
    anim.onfinish = anim.oncancel = () => g.remove()
    window.setTimeout(() => g.remove(), 900)
  }
  const give = (i: number, k: number, from?: HTMLElement) => {
    const o = loaves[i].owners[k]
    const next = o + 2 > animals ? -1 : o + 1
    if (next >= 0 && from) fly(from, next)
    update(loaves.map((l, j) => (j === i ? { ...l, owners: l.owners.map((v, x) => (x === k ? next : v)) } : l)))
  }

  const fair = fairShare(loaves, animals)
  const shares = [...Array(animals)].map((_, a) => shareOf(loaves, a))
  const allGiven = loaves.every((l) => !l.owners.includes(-1))
  const stars = [solved.length >= 1, solved.length >= 2, solved.length >= 3]
  const open = stars.every(Boolean)
  const isFair = !!fair

  useEffect(() => {
    if (isFair) strip.current?.scrollIntoView?.({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' })
  }, [isFair])

  return (
    <ProposalLayout title="數學實例化：分食物給動物" footer="開發 · 試作">
      <h1>開發 · 數學實例化：分食物給動物</h1>
      <p className={s.lead}>「分數就是除法」試作。把每條麵包切成幾份，點一塊就把它送給下一隻動物，麵包會移到牠的盤子裡；分得一樣多，動物就滿意。不用字卡，算式跟著操作長出來。</p>

      <div className={s.app}>
        <div className={s.top}>
          <div className={s.tasks} role="group" aria-label="題目">
            {TASKS.map((t, i) => (
              <button key={i} type="button" className={`${s.task}${i === task ? ` ${s.taskOn}` : ''}`} onClick={() => go(i)} aria-label={`${t.loaves} 條麵包 ${t.animals} 隻動物${solved.includes(i) ? ',已完成' : ''}`} aria-pressed={i === task}>
                {t.loaves} ÷ {t.animals}
                {solved.includes(i) && (
                  <svg className={s.tick} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
                    <path d="M2.5 6.4 L5 8.8 L9.6 3.6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <div className={s.stars} role="img" aria-label={`完成 ${solved.length} / ${TASKS.length}`}>
            {stars.map((on, i) => (
              <span key={i} className={on ? s.on : ''} />
            ))}
            {open && <span className={s.openTag}>OPEN</span>}
          </div>
        </div>

        <div className={s.board} role="group" aria-label="砧板上的麵包">
          {loaves.map((l, i) => (
            <div key={i} className={s.loaf}>
              <div className={s.bread} role="group" aria-label={`第 ${i + 1} 條麵包,切成 ${l.parts} 份`}>
                {l.owners.map((o, k) => (
                  <button
                    key={`${l.parts}-${k}`}
                    type="button"
                    className={`${s.piece}${o >= 0 ? ` ${s.given}` : ''}`}
                    style={o >= 0 ? ({ '--who': COLORS[o], '--tint': TINTS[o] } as React.CSSProperties) : undefined}
                    onClick={(e) => give(i, k, e.currentTarget)}
                    aria-label={`第 ${k + 1} 塊,${o >= 0 ? `給了${NAMES[o]}` : '還沒給'}`}
                  >
                    {o >= 0 && <Animal kind={o} mood="idle" size={l.parts > 6 ? 24 : 32} />}
                  </button>
                ))}
              </div>
              <div className={s.cutter}>
                <button type="button" onClick={() => cut(i, -1)} disabled={l.parts <= 1} aria-label="少切一刀">
                  <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true"><path d="M3.5 8 H12.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" /></svg>
                </button>
                <span aria-label={`切成 ${l.parts} 份`}>{l.parts}</span>
                <button type="button" onClick={() => cut(i, 1)} disabled={l.parts >= MAX_PARTS} aria-label="多切一刀">
                  <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true"><path d="M3.5 8 H12.5 M8 3.5 V12.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className={s.guests} data-n={animals}>
          {shares.map((f, a) => {
            const ok = !!fair && same(f, fair)
            const mood: Mood = ok ? 'happy' : allGiven ? 'sad' : 'idle'
            return (
              <div key={a} className={`${s.guest}${ok ? ` ${s.fair}` : ''}`} role="group" aria-label={`${NAMES[a]}${ok ? ',滿意' : allGiven ? ',不滿意' : ''}`} style={{ '--who': COLORS[a] } as React.CSSProperties}>
                <div className={s.who}>
                  <span className={s.face}>
                    <Animal kind={a} mood={mood} />
                    {ok && (
                      <svg className={s.badge} viewBox="0 0 20 20" width={20} height={20} aria-hidden="true">
                        <circle cx={10} cy={10} r={10} fill="#0f766e" />
                        <path d="M5.8 10.4 L8.8 13.2 L14.2 7.2" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className={s.frac}><Fr f={f} /></span>
                </div>
                <Plate loaves={loaves} animal={a} plateRef={(el) => { plates.current[a] = el }} />
              </div>
            )
          })}
        </div>

        <div ref={strip} className={`${s.strip}${fair ? ` ${s.stripOn}` : ''}`} aria-live="polite">
          <div className={s.eq}>
            <span>{count}</span>
            <span className={s.op}>÷</span>
            <span>{animals}</span>
            {fair && (
              <span className={s.res}>
                <span className={s.op}>=</span>
                <Fr f={fair} />
              </span>
            )}
          </div>
          {fair ? (
            <div className={s.check}>
              {animals} × <Fr f={fair} /> = {count}
            </div>
          ) : (
            allGiven && <span className={s.sr}>還不一樣多</span>
          )}
        </div>
      </div>
    </ProposalLayout>
  )
}
