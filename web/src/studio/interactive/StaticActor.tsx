import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ACTORS } from '../../live/actors'
import { placeOf } from '../../live/place'
import { createStage, type StageScript } from '../../live/stage'
import { collapsedParts, staticScript, type Answer, type Answers, type Moment } from './scene'
import styles from './InteractiveScenePage.module.css'

// 互動時的靜態演員:影片停在互動點,主舞台壓暗留在後面,這裡是另一個舞台,只有這位演員,停在同一個狀態。
// 這個舞台不縮放:大小就是畫面上的大小(不是 1920×1080 再由外殼縮小),也沒有鏡頭,字維持演員原本的大小;
// 依舞台大小調整:單位跟著舞台寬度變小(CSS 的 --u),舞台太窄時收合不在互動區的區塊(互動點的 stage.zone),都是重新排版,不是整個縮小。
// 學員直接操作演員:選項疊在演員的目標上(真實按鈕,演員不處理點擊);沒有對應目標的選項放進指定的區域(例如輸入框)。
// 詢問框只用在沒有演員可以操作的互動點(見 scene.ts 的 answersOnActor)。

type Rect = { x: number; y: number; w: number; h: number }
type Measured = { rects: Record<string, Rect>; height: number }

type Props = {
  /** 互動點加進去之前的腳本與目前的回答:這個舞台自己演到互動點 */
  script: StageScript
  answers: Answers
  moment: Moment
  /** false:只呈現演員,回答在詢問框 */
  interactive: boolean
  headRef: RefObject<HTMLHeadingElement | null>
  /** 提示放在這裡(小播放器放不下,不要蓋住演員);不寫就在演員上方 */
  hintSlot?: HTMLElement | null
  onAnswer: (a: Answer) => void
}

export function StaticActor({ script, answers, moment, interactive, headRef, hintSlot, onAnswer }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<Measured | null>(null)
  const [error, setError] = useState<string | null>(null)
  const actor = (moment.stage?.focus ?? '').split(':')[0]
  const choicesRef = moment.stage?.choices

  useLayoutEffect(() => {
    const host = hostRef.current
    const root = rootRef.current
    if (!host || !root) return
    let cancelled = false
    let ro: ResizeObserver | null = null
    // 大小上限是演員在主舞台上的大小
    const place = placeOf(script.cast[actor]?.place)
    host.style.maxWidth = `${place.w}px`
    if (place.h != null) host.style.maxHeight = `${place.h}px`
    const stage = createStage(root)
    const refs = [choicesRef, ...moment.options.map((o) => o.target)].filter((x): x is string => !!x)
    const cast = script.cast[actor]
    let collapsed = ''
    /** 依舞台寬度收合區塊;寬度沒有跨過門檻就不重畫 */
    const fit = (width: number): void => {
      const parts = collapsedParts(ACTORS[cast.actor]?.collapsible, moment.stage?.zone, width)
      const key = JSON.stringify(parts)
      if (key === collapsed) return
      collapsed = key
      stage.setParts(actor, { ...cast.parts, ...parts })
      // 區塊是畫完才套用,演員的捲動位置是依舊版面算的:先換到別的時間讓區塊生效,再畫一次才會依新版面重算
      stage.renderAt(0)
      stage.renderAt(stage.duration)
    }
    const measure = (): void => {
      const box = host.getBoundingClientRect()
      fit(box.width)
      const rects: Record<string, Rect> = {}
      for (const ref of refs) {
        const el = stage.element(ref)
        if (!el) continue
        const r = el.getBoundingClientRect()
        rects[ref] = { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }
      }
      setMeasured({ rects, height: box.height })
    }
    stage
      .load(staticScript(script, answers, moment.id, actor, ACTORS[cast.actor]?.kinds ?? []), { cursor: false })
      .then(() => {
        if (cancelled) return
        measure() // 第一次一定會畫:collapsed 還是空字串
        ro = new ResizeObserver(measure)
        ro.observe(host)
        ro.observe(root) // 提示換行時,舞台變矮但外框不變
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })
    return () => {
      cancelled = true
      ro?.disconnect()
      root.replaceChildren()
    }
  }, [script, answers, moment, actor, choicesRef])

  const rects = measured?.rects ?? {}
  const height = measured?.height ?? 0
  // 量到位置之前還不知道哪些選項要放進提示,先不放(否則全部選項會閃一下);載入失敗時全部放進提示,學員才答得了
  const loose = measured || error ? moment.options.map((o, option) => ({ ...o, option })).filter((o) => !o.target || !rects[o.target]) : []
  const chips = loose.map((o) => (
    <button key={o.label} type="button" onClick={() => onAnswer({ option: o.option })}>
      {o.label}
    </button>
  ))
  const choicesRect = choicesRef ? rects[choicesRef] : undefined
  const hint = interactive && (
    <div className={styles.staticHint}>
      <h2 ref={headRef} tabIndex={-1}>
        {moment.title}
      </h2>
      {!choicesRect && chips.length > 0 && <div className={styles.pushChips}>{chips}</div>}
      <button type="button" className={styles.skip} onClick={() => onAnswer({ skipped: true })}>
        {moment.skip?.label ?? '略過，繼續看'}
      </button>
    </div>
  )

  return (
    <div className={styles.staticLayer} data-testid="static-actor">
      <div ref={hostRef} className={styles.staticHost}>
        {!hintSlot && hint}
        <div ref={rootRef} className={styles.staticRoot} />
        {error && (
          <p className={styles.error} role="alert">
            無法載入演員：{error}
          </p>
        )}
        {interactive && (
          <>
            {moment.options.map((o, option) => {
              const r = o.target ? rects[o.target] : undefined
              return r ? <button key={o.label} type="button" className={styles.pushHit} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} aria-label={o.label} onClick={() => onAnswer({ option })} /> : null
            })}
            {choicesRect && chips.length > 0 && (
              // 從輸入框的底部往上長:選項多的時候蓋住上面的對話,不會超出演員
              <div className={`${styles.pushChips} ${styles.staticChips}`} style={{ left: choicesRect.x, width: choicesRect.w, bottom: height - choicesRect.y - choicesRect.h }}>
                {chips}
              </div>
            )}
          </>
        )}
      </div>
      {hintSlot && hint && createPortal(hint, hintSlot)}
    </div>
  )
}
