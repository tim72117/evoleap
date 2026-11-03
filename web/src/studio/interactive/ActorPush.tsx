import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Stage } from '../../live/stage'
import type { Answer, Moment } from './scene'
import styles from './InteractiveScenePage.module.css'

// 把演員推到主畫面互動:整個舞台推近聚焦的目標、其他地方變暗,學員直接操作演員身上的選項與按鈕。
// 這些控制項是疊在舞台上的真實元素,用舞台座標(1920×1080)定位,所以會跟著舞台縮放,開關側欄也不用重算。
// 只在暫停於互動點時出現,不屬於時間軸;推近用 CSS transition,離開互動點就退回,不影響「畫面是時間的純函式」。

const STAGE_W = 1920
/** 目標推近後的中心;比畫面中央低一點,上方留給提問卡 */
const CENTER = { x: 960, y: 620 }
const MAX_ZOOM = 1.6

type Rect = { x: number; y: number; w: number; h: number }

type Props = {
  stage: Stage
  /** 舞台的根元素:推近時整個移動它 */
  root: HTMLElement
  /** 舞台上的疊加層,控制項畫在這裡 */
  layer: HTMLElement
  moment: Moment
  onAnswer: (a: Answer) => void
}

export function ActorPush({ stage, root, layer, moment, onAnswer }: Props) {
  const [rects, setRects] = useState<Record<string, Rect>>({})
  const headRef = useRef<HTMLHeadingElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  /** 選項換行時,比原本的輸入框多出來的高度(舞台座標) */
  const [extra, setExtra] = useState(0)
  const focusRef = moment.stage?.focus ?? ''
  const choicesRef = moment.stage?.choices

  useLayoutEffect(() => {
    // 目標和舞台根元素在同一個縮放底下,換算成舞台座標時不受縮放與推近影響
    const measure = (ref: string): Rect | null => {
      const el = stage.element(ref)
      if (!el) return null
      const r = el.getBoundingClientRect()
      const box = root.getBoundingClientRect()
      const s = box.width / STAGE_W
      return { x: (r.left - box.left) / s, y: (r.top - box.top) / s, w: r.width / s, h: r.height / s }
    }
    const refs = [focusRef, choicesRef, ...moment.options.map((o) => o.target)].filter((x): x is string => !!x)
    const found: Record<string, Rect> = {}
    for (const ref of refs) {
      const rect = measure(ref)
      if (rect) found[ref] = rect
    }
    setRects(found)

    const f = found[focusRef]
    if (f) {
      const zoom = Math.max(1, Math.min(MAX_ZOOM, 1500 / f.w, 640 / f.h))
      root.style.transform = `translate(${CENTER.x - (f.x + f.w / 2) * zoom}px, ${CENTER.y - (f.y + f.h / 2) * zoom}px) scale(${zoom})`
      root.style.setProperty('--push-zoom', String(zoom))
    }
    return () => {
      root.style.transform = ''
      root.style.removeProperty('--push-zoom')
    }
  }, [stage, root, moment, focusRef, choicesRef])

  // 焦點放在問題上(不是選項):習慣按空白鍵暫停的人才不會誤選答案
  useLayoutEffect(() => {
    headRef.current?.focus({ preventScroll: true })
  }, [rects])

  const measured = rects[focusRef]
  const choicesRect = choicesRef ? rects[choicesRef] : undefined
  useLayoutEffect(() => {
    if (chipsRef.current && choicesRect) setExtra(Math.max(0, chipsRef.current.offsetHeight - choicesRect.h))
  }, [choicesRect])
  if (!measured) return null
  const focus = { ...measured, y: measured.y - extra, h: measured.h + extra }
  const box = (r: Rect) => ({ left: r.x, top: r.y, width: r.w, height: r.h })
  // 沒有對應到演員身上位置的選項:放進指定的區域(例如輸入框),沒有指定就放在提問卡裡
  const loose = moment.options.map((o, option) => ({ ...o, option })).filter((o) => !o.target || !rects[o.target])
  const chips = loose.map((o) => (
    <button key={o.label} type="button" onClick={() => onAnswer({ option: o.option })}>
      {o.label}
    </button>
  ))

  return createPortal(
    <>
      <div className={styles.pushRing} style={box(focus)} aria-hidden="true" />

      <div className={styles.pushCard} style={{ left: focus.x, bottom: 1080 - focus.y + 18, maxWidth: Math.max(focus.w, 420) }}>
        <p className={styles.eyebrow}>換你動手</p>
        <h2 ref={headRef} tabIndex={-1}>
          {moment.title}
        </h2>
        {moment.body && <p className={styles.note}>{moment.body}</p>}
        {!choicesRect && chips.length > 0 && <div className={styles.pushChips}>{chips}</div>}
        <button type="button" className={styles.skip} onClick={() => onAnswer({ skipped: true })}>
          {moment.skip?.label ?? '略過，繼續看'}
        </button>
      </div>

      {choicesRect && chips.length > 0 && (
        <div ref={chipsRef} className={`${styles.pushChips} ${styles.pushChipsIn}`} style={{ left: choicesRect.x, top: choicesRect.y - extra, width: choicesRect.w, minHeight: choicesRect.h }}>
          {chips}
        </div>
      )}

      {moment.options.map((o, option) => {
        const r = o.target ? rects[o.target] : undefined
        return r ? <button key={o.label} type="button" className={styles.pushHit} style={box(r)} aria-label={o.label} onClick={() => onAnswer({ option })} /> : null
      })}
    </>,
    layer,
  )
}
