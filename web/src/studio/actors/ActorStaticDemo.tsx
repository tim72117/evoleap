import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ACTORS } from '../../live/actors'
import { loadScript } from '../../live/scripts'
import { createStage, type Stage } from '../../live/stage'
import type { Hotspot, ScriptStep, StageScript } from '../../live/types'
import ui from '../proposal/proposal.module.css'
import styles from './ActorsPage.module.css'

// 靜態展示:只有舞台,沒有播放器。可以做的操作取自示範腳本的步驟,也能自己輸入一步 JSON。
// 每按一次就把步驟接到清單後面、重新載入舞台,再演出新的這一步,所以畫面一樣只由時間決定。
// 互動層:演員用 hotspots(state) 說明目前可以點什麼,這裡量出目標的位置,疊上透明的真實按鈕;
// 演員不處理點擊事件,點下去走的是同一條路(接一步、重新載入)。

const STAGE_W = 1920
const CAST_ID = 'a'
// 舞台在最後一步之後多留的時間(stage.ts 的 total = t + 600),新的一步從這裡之前開始
const TAIL_MS = 600
// 舞台比這個窄時,側欄一列只剩幾個像素,點不準,互動層不出現,改用下方的操作
const MIN_HIT_WIDTH = 500

const kindOf = (actor: string, step: object): string | undefined => ACTORS[actor].kinds.find((k) => k in step)

function opLabel(actor: string, step: object): string {
  const kind = kindOf(actor, step) as string
  const v = (step as Record<string, unknown>)[kind]
  const text = v === true ? '' : typeof v === 'string' ? v : JSON.stringify(v)
  return text ? `${kind}：${text.length > 18 ? `${text.slice(0, 18)}…` : text}` : kind
}

/** 依序套用步驟後的狀態;沒有狀態的演員回傳 undefined。操作對不上時丟錯 */
function stateAfter(actor: string, props: object, steps: object[]): unknown {
  const def = ACTORS[actor]
  if (!def.init || !def.apply) return undefined
  return steps.reduce<unknown>((st, s) => def.apply?.(st, kindOf(actor, s) as string, s), def.init(props))
}

type Rect = { left: number; top: number; width: number; height: number }
type Spot = { spot: Hotspot; rect: Rect }

export function ActorStaticDemo({ actor, hidden }: { actor: string; hidden: string[] }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const timeRef = useRef(0)
  const frameRef = useRef(0)
  const seqRef = useRef(0)
  const hiddenRef = useRef(hidden)
  const [script, setScript] = useState<StageScript | null>(null)
  const [steps, setSteps] = useState<ScriptStep[]>([])
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [layout, setLayout] = useState(0)
  const [spots, setSpots] = useState<Spot[]>([])
  const [outline, setOutline] = useState(true)
  const [typing, setTyping] = useState<Spot | null>(null)
  const [text, setText] = useState('')
  const [narrow, setNarrow] = useState(false)

  const withSteps = (base: StageScript, list: ScriptStep[]): StageScript => ({
    ...base,
    cast: { [CAST_ID]: { ...base.cast[CAST_ID], parts: Object.fromEntries(hiddenRef.current.map((p) => [p, false])) } },
    steps: list,
  })

  /** 載入這份步驟,從 from 演到最後(from 是 null 就直接停在最後) */
  async function show(base: StageScript, list: ScriptStep[], from: number | null, cursor = true): Promise<void> {
    const stage = stageRef.current
    if (!stage) return
    const seq = ++seqRef.current
    cancelAnimationFrame(frameRef.current)
    setBusy(true)
    await stage.load(withSteps(base, list), { cursor })
    if (seq !== seqRef.current) return
    const end = stage.duration
    if (from == null) {
      timeRef.current = end
      stage.renderAt(end)
      setBusy(false)
      return
    }
    const t0 = performance.now()
    const tick = (now: number): void => {
      const t = Math.min(end, from + now - t0)
      timeRef.current = t
      stage.renderAt(t)
      if (t < end) frameRef.current = requestAnimationFrame(tick)
      else setBusy(false)
    }
    tick(t0)
  }

  useEffect(() => {
    const host = hostRef.current
    const box = boxRef.current
    if (!host || !box) return
    let cancelled = false
    stageRef.current = createStage(host)
    const fit = (): void => {
      host.style.transform = `scale(${box.clientWidth / STAGE_W})`
      setNarrow(box.clientWidth < MIN_HIT_WIDTH)
      setLayout((n) => n + 1)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    loadScript(`lab/actors/${actor}.json`)
      .then(async (data) => {
        await document.fonts.ready
        if (cancelled) return
        setScript(data)
        await show(data, [], null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })
    return () => {
      cancelled = true
      ro.disconnect()
      cancelAnimationFrame(frameRef.current)
      seqRef.current++
      stageRef.current = null
    }
    // show 只用 ref 與參數,不需要跟著重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor])

  useEffect(() => {
    hiddenRef.current = hidden
    const stage = stageRef.current
    if (!stage || !script) return
    stage.setParts(CAST_ID, Object.fromEntries(hidden.map((p) => [p, false])))
    stage.renderAt(timeRef.current)
    setLayout((n) => n + 1)
  }, [hidden, script])

  // 互動層:演出結束後量目標的位置。關掉的區塊量不到,就不會有按鈕;套用不了的動作也不放
  useLayoutEffect(() => {
    const stage = stageRef.current
    const box = boxRef.current
    const def = ACTORS[actor]
    if (!stage || !box || !script || busy || narrow || !def.hotspots) {
      setSpots([])
      return
    }
    const props = script.cast[CAST_ID].props ?? {}
    const state = stateAfter(actor, props, steps)
    const area = box.getBoundingClientRect()
    const next: Spot[] = []
    for (const spot of def.hotspots(state, props) as Hotspot[]) {
      if (spot.step) {
        try {
          stateAfter(actor, props, [...steps, spot.step])
        } catch {
          continue
        }
      }
      const r = stage.element(`${CAST_ID}:${spot.target}`)?.getBoundingClientRect()
      if (!r || r.width < 2 || r.height < 2) continue
      const left = Math.max(r.left, area.left)
      const top = Math.max(r.top, area.top)
      const right = Math.min(r.right, area.right)
      const bottom = Math.min(r.bottom, area.bottom)
      if (right - left < 2 || bottom - top < 2) continue
      next.push({ spot, rect: { left: left - area.left, top: top - area.top, width: right - left, height: bottom - top } })
    }
    setSpots(next)
  }, [actor, script, steps, busy, narrow, layout])

  // 操作清單:示範腳本裡這位演員會的步驟,去掉重複;目前做不了的(例如還沒開選單就 fork)停用
  const ops = useMemo(() => {
    const seen = new Set<string>()
    return (script?.steps ?? []).filter((s) => {
      const key = JSON.stringify(s)
      if (!kindOf(actor, s) || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [script, actor])
  const canDo = (step: ScriptStep): boolean => {
    try {
      stateAfter(actor, script?.cast[CAST_ID].props ?? {}, [...steps, step])
      return true
    } catch {
      return false
    }
  }

  // byHand:使用者直接點舞台。不畫虛擬滑鼠,也跳過滑鼠移過去的那段
  async function perform(step: ScriptStep, byHand = false): Promise<void> {
    const stage = stageRef.current
    if (!script || !stage) return
    const kind = kindOf(actor, step)
    const skip = byHand && kind ? ACTORS[actor].cursor?.(kind, step, undefined)?.clickAt ?? 0 : 0
    const from = stage.duration - TAIL_MS + skip
    const next = [...steps, step]
    setError(null)
    setTyping(null)
    try {
      await show(script, next, from, !byHand)
      setSteps(next)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      await show(script, steps, null)
    }
  }

  function performCustom(): void {
    let step: ScriptStep
    try {
      step = JSON.parse(custom) as ScriptStep
    } catch {
      setError('不是有效的 JSON，例如 {"say": "你好"}')
      return
    }
    void perform(step)
  }

  function clickSpot(s: Spot): void {
    if (s.spot.step) void perform(s.spot.step, true)
    else {
      setText('')
      setTyping(s)
    }
  }

  function submitTyping(): void {
    const value = text.trim()
    if (typing?.spot.input && value) void perform(typing.spot.input.step(value) as ScriptStep, true)
  }

  const replaceSteps = (list: ScriptStep[]): void => {
    if (!script) return
    setError(null)
    setTyping(null)
    setSteps(list)
    void show(script, list, null)
  }

  return (
    <div>
      <div ref={boxRef} className={styles.box} data-testid="actor-static">
        <div ref={hostRef} className={styles.staticStage} />
        <div className={outline ? `${styles.hitLayer} ${styles.outlined}` : styles.hitLayer} data-testid="actor-hits">
          {spots.map((s) => (
            <button key={s.spot.target} type="button" className={styles.hit} style={s.rect} aria-label={s.spot.label} title={s.spot.label} data-target={s.spot.target} onClick={() => clickSpot(s)}>
              {s.spot.glyph}
            </button>
          ))}
          {typing && (
            <form
              className={styles.hitForm}
              style={{ left: typing.rect.left, width: Math.max(typing.rect.width, 220), top: Math.max(0, typing.rect.top + typing.rect.height - 44) }}
              onSubmit={(e) => {
                e.preventDefault()
                submitTyping()
              }}
            >
              <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setTyping(null)} placeholder={typing.spot.input?.placeholder} aria-label={typing.spot.label} data-testid="actor-hit-input" />
              <button type="submit" disabled={!text.trim()}>送出</button>
            </form>
          )}
        </div>
      </div>
      <div className={styles.ops}>
        <div className={styles.opList} role="group" aria-label="操作">
          {ops.map((s) => {
            const label = opLabel(actor, s)
            return (
              <button key={JSON.stringify(s)} type="button" className={`${ui.btn} ${ui.ghost}`} disabled={!canDo(s)} title={JSON.stringify(s)} data-testid="actor-op" onClick={() => void perform(s)}>
                {label}
              </button>
            )
          })}
        </div>
        <form
          className={styles.customOp}
          onSubmit={(e) => {
            e.preventDefault()
            performCustom()
          }}
        >
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder='自訂一步，例如 {"say": "你好"}' aria-label="自訂動作" data-testid="actor-custom" />
          <button type="submit" className={ui.btn} disabled={!custom.trim()}>執行</button>
        </form>
        <div className={styles.opFoot}>
          <span>已執行 {steps.length} 步</span>
          {narrow ? <span data-testid="actor-narrow">畫面太窄，無法直接點，請用上方的操作</span> : <label className={styles.part}>
            <input type="checkbox" checked={outline} data-testid="actor-outline" onChange={(e) => setOutline(e.target.checked)} />
            <span>標示可點區域</span>
          </label>}
          <button type="button" className={`${ui.btn} ${ui.ghost}`} disabled={!steps.length} data-testid="actor-undo" onClick={() => replaceSteps(steps.slice(0, -1))}>復原</button>
          <button type="button" className={`${ui.btn} ${ui.ghost}`} disabled={!steps.length} data-testid="actor-reset" onClick={() => replaceSteps([])}>重設</button>
        </div>
        {error && <p role="alert" className={styles.opError}>{error}</p>}
      </div>
    </div>
  )
}
