import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ACTORS } from '../../live/actors'
import type { StudioState } from '../../live/actors/agent-studio/actor'
import { createStage, type Stage } from '../../live/stage'
import type { Hotspot, ScriptStep, StageScript } from '../../live/types'
import { KIDS_PLAY } from './demo'
import { MILESTONES, nextHint, replay } from './play'
import styles from './agentStudio.module.css'

// 自己玩:只有舞台,沒有播放器。孩子點卡片、工具列或網頁上的按鈕,就接一步到步驟清單、重新載入舞台,
// 再從原本的結尾演出新的這一步(畫面仍只由時間決定)。可點的地方由演員的 hotspots 決定,做法同演員展示的靜態展示。

const STAGE_W = 1920
// 舞台在最後一步之後多留的時間(stage.ts 的 total = t + 600),新的一步從這裡之前開始
const TAIL_MS = 600
const CAST = 'studio'
// 比這個窄時按鈕太小點不準
const MIN_WIDTH = 600

type Spot = { spot: Hotspot; style: { left: number; top: number; width: number; height: number } }

export function PlayArea() {
  const boxRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const frameRef = useRef(0)
  const seqRef = useRef(0)
  const [steps, setSteps] = useState<ScriptStep[]>([])
  const [state, setState] = useState<StudioState | null>(null)
  const [busy, setBusy] = useState(true)
  const [spots, setSpots] = useState<Spot[]>([])
  const [layout, setLayout] = useState(0)
  const [narrow, setNarrow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** 載入這份步驟;animate 時從原本的結尾演到新的結尾,否則直接停在最後 */
  async function show(list: ScriptStep[], animate: boolean): Promise<void> {
    const stage = stageRef.current
    if (!stage) return
    const seq = ++seqRef.current
    cancelAnimationFrame(frameRef.current)
    setBusy(true)
    const prevEnd = stage.duration
    try {
      await stage.load({ ...KIDS_PLAY, steps: list } as StageScript, { cursor: false })
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      return
    }
    if (seq !== seqRef.current) return
    setState(replay(ACTORS['agent-studio'], KIDS_PLAY.cast[CAST].props ?? {}, list))
    const end = stage.duration
    const from = animate ? Math.max(0, prevEnd - TAIL_MS) : end
    const t0 = performance.now()
    const tick = (now: number): void => {
      const t = Math.min(end, from + now - t0)
      stage.renderAt(t)
      if (t < end) frameRef.current = requestAnimationFrame(tick)
      else setBusy(false)
    }
    tick(t0)
  }

  useEffect(() => {
    const host = hostRef.current!
    const box = boxRef.current!
    stageRef.current = createStage(host)
    const fit = (): void => {
      host.style.transform = `scale(${box.clientWidth / STAGE_W})`
      setNarrow(box.clientWidth < MIN_WIDTH)
      setLayout((n) => n + 1)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    void document.fonts.ready.then(() => show([], false))
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frameRef.current)
      seqRef.current++
      stageRef.current = null
      host.innerHTML = ''
    }
    // show 只用 ref 與參數,不需要跟著重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 演完後量可點目標的位置
  useLayoutEffect(() => {
    const stage = stageRef.current
    const box = boxRef.current
    const def = ACTORS['agent-studio']
    if (!stage || !box || !def || !state || busy || narrow) {
      setSpots([])
      return
    }
    const area = box.getBoundingClientRect()
    setSpots(
      (def.hotspots!(state, KIDS_PLAY.cast[CAST].props ?? {}) as Hotspot[]).flatMap((spot) => {
        const r = stage.element(`${CAST}:${spot.target}`)?.getBoundingClientRect()
        if (!r || r.width < 2 || r.height < 2) return []
        return [{ spot, style: { left: r.left - area.left, top: r.top - area.top, width: r.width, height: r.height } }]
      }),
    )
  }, [state, busy, narrow, layout])

  const perform = (step: ScriptStep): void => {
    const next = [...steps, { on: CAST, ...step } as ScriptStep]
    setSteps(next)
    setSpots([])
    void show(next, true)
  }

  const restart = (): void => {
    setSteps([])
    setError(null)
    void show([], false)
  }

  return (
    <div>
      <ol className={styles.milestones} aria-label="開發的步驟">
        {MILESTONES.map((m, i) => (
          <li key={m.id} className={state && m.done(state) ? styles.done : ''}>
            <span aria-hidden="true">{state && m.done(state) ? '⭐' : i + 1}</span>
            {m.label}
          </li>
        ))}
      </ol>
      <p className={styles.hint} aria-live="polite">{state ? nextHint(state) : '準備中…'}</p>
      <div ref={boxRef} className={styles.box}>
        <div ref={hostRef} className={styles.stage} />
        {spots.map((s) => (
          <button key={s.spot.target} type="button" className={styles.hit} style={s.style} aria-label={s.spot.label} title={s.spot.label} onClick={() => s.spot.step && perform(s.spot.step as ScriptStep)} />
        ))}
      </div>
      {narrow && <p className={styles.hint}>畫面太窄，按鈕點不準。請用平板橫放或電腦玩。</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.foot}>
        <button type="button" className={styles.restart} onClick={restart} disabled={!steps.length}>
          重新開始
        </button>
      </div>
    </div>
  )
}
