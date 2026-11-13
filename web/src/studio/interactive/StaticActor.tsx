import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ACTORS } from '../../live/actors'
import { placeOf } from '../../live/place'
import { createStage, type Stage, type StageScript } from '../../live/stage'
import type { ScriptStep } from '../../live/types'
import { dragPlan, type DragPlan } from '../../kids/drag'
import { DragLayer } from '../../kids/DragLayer'
import { clickInPage, collapsedParts, goneInPage, spotId, staticScript, type Answer, type Answers, type InteractSpot, type Moment } from './scene'
import { useT } from '../../i18n/I18nProvider'
import styles from './InteractiveScenePage.module.css'

// 互動時的靜態演員:影片停在互動點,換成另一個舞台(主舞台先藏起來,不是壓暗),只有這位演員,停在同一個狀態。
// 這個舞台不縮放:大小就是畫面上的大小(不是 1920×1080 再由外殼縮小),也沒有鏡頭,字維持演員原本的大小;
// 依舞台大小調整:單位跟著舞台寬度變小(CSS 的 --u),舞台太窄時收合不在互動區的區塊(互動點的 stage.zone),都是重新排版,不是整個縮小。
// 學員直接操作演員:選項疊在演員的目標上(真實按鈕,演員不處理點擊);沒有對應目標的選項放進指定的區域(例如輸入框)。
// 互動腳本(moment.interact,live/README.md 第 2A.7 節):觸發點疊在演員的目標上,點了就讓演員從目前的狀態演一段回應(舞台的 react),
// 不重新載入、沒有互動時間軸;interact.cast 的第二位演員放在旁邊的側欄卡片,一樣可以有觸發點。
// 詢問框只用在沒有演員可以操作的互動點(見 scene.ts 的 answersOnActor)。

type Rect = { x: number; y: number; w: number; h: number }
type Spot = InteractSpot & { key: string; pressed: boolean }

/** 一段回應:在每個舞台上演,依各自的長度從 0 播到結尾(requestAnimationFrame) */
function play(runs: { stage: Stage; id: number; duration: number }[], done: () => void): () => void {
  const t0 = performance.now()
  const end = Math.max(0, ...runs.map((r) => r.duration))
  let raf = 0
  const tick = (): void => {
    const t = performance.now() - t0
    for (const r of runs) r.stage.reactAt(r.id, Math.min(t, r.duration))
    if (t < end) raf = requestAnimationFrame(tick)
    else done()
  }
  tick()
  return () => cancelAnimationFrame(raf)
}

/**
 * 放在旁邊一起看的演員(interact.cast 的第二位,例如網頁旁邊的結構圖):一張浮在主要演員旁邊的側欄卡片(不放進主要演員的框裡)。
 * 照卡片大小排版,字不縮放(--u 固定,見 .besideRoot);停在互動點那一刻的樣子,在主舞台上藏起來也照樣顯示。
 * 它身上的觸發點(spots)也疊成透明按鈕;回應由外面(StaticActor)交給這個舞台演
 */
function BesideActor({
  script,
  answers,
  momentId,
  actor,
  only,
  spots,
  drag,
  version,
  onStage,
  onSpot,
}: {
  script: StageScript
  answers: Answers
  momentId: string
  actor: string
  /** 蓋過演員的 props.only(stage.split 時側欄只顯示樹) */
  only?: string
  spots: Spot[]
  /** 拖曳在這張卡片上(stage.split):可以拖什麼、放下去演哪一步 */
  drag?: { plan: DragPlan; drop: (step: ScriptStep) => void } | null
  /** 回應演完時加一:重新量觸發點的位置 */
  version: number
  onStage: (stage: Stage | null) => void
  onSpot: (spot: Spot) => void
}) {
  const L = useT().player.scene
  const boxRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const measureRef = useRef<() => void>(() => {})
  const [rects, setRects] = useState<Record<string, Rect>>({})
  const [error, setError] = useState<string | null>(null)
  // 要量位置的目標:觸發點與拖放的位置(拖完計畫會變,只重新量、不重建舞台)
  const plan = drag?.plan
  const dragRefs = plan ? [...plan.items.map((x) => x.target), ...new Set(plan.items.flatMap((x) => plan.slotsFor(x.id).map((d) => d.target)))] : []
  const targets = [...spots.map((s) => s.target), ...dragRefs].join('\n')
  const targetsRef = useRef(targets)
  targetsRef.current = targets
  useLayoutEffect(() => {
    const box = boxRef.current
    const root = rootRef.current
    if (!box || !root) return
    let cancelled = false
    const cast = script.cast[actor]
    const stage = createStage(root)
    stageRef.current = stage
    const measure = (): void => {
      const b = box.getBoundingClientRect()
      const found: Record<string, Rect> = {}
      for (const target of targetsRef.current.split('\n').filter(Boolean)) {
        const el = stage.element(target)
        if (!el) continue
        const r = el.getBoundingClientRect()
        found[target] = { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }
      }
      setRects(found)
    }
    measureRef.current = measure
    const base = staticScript(script, answers, momentId, actor, ACTORS[cast?.actor]?.kinds ?? [])
    // 在主舞台上可能藏著:旁邊這份不演 show/hide
    const steps = (base.steps as unknown as Record<string, unknown>[]).filter((st) => !('show' in st) && !('hide' in st))
    const castNow = only ? { ...base.cast, [actor]: { ...base.cast[actor], props: { ...base.cast[actor].props, only } } } : base.cast
    const ro = new ResizeObserver(measure)
    stage
      .load({ ...base, cast: castNow, steps } as unknown as StageScript, { cursor: false })
      .then(() => {
        if (cancelled) return
        stage.renderAt(stage.duration) // 停在互動點那一刻(載入後畫的是第 0 格)
        measure()
        ro.observe(box)
        onStage(stage)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })
    return () => {
      cancelled = true
      ro.disconnect()
      stageRef.current = null
      onStage(null)
      root.replaceChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, answers, momentId, actor, only])
  useLayoutEffect(() => measureRef.current(), [version, targets])
  return (
    <div ref={boxRef} className={styles.staticBeside}>
      <div ref={rootRef} className={styles.besideRoot} aria-hidden="true" />
      {spots.map((s) => {
        const r = rects[s.target]
        return r ? (
          <button
            key={s.key}
            type="button"
            className={styles.toggleHit}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
            aria-label={s.label}
            aria-pressed={s.again ? s.pressed : undefined}
            onClick={() => onSpot(s)}
          />
        ) : null
      })}
      {drag && (
        <DragLayer
          classes={{ grab: styles.dragGrab, dropZone: styles.dropZone, dropDot: styles.dropDot, ghost: styles.dragGhost }}
          minZone={{ w: 120, h: 36 }}
          drag={drag}
          rects={rects}
          elementOf={(target) => stageRef.current?.element(target) ?? null}
          toStage={(cx, cy) => {
            const b = boxRef.current?.getBoundingClientRect()
            return { x: cx - (b?.left ?? 0), y: cy - (b?.top ?? 0) }
          }}
        />
      )}
      {error && <p className={styles.error}>{L.actorLoadError}{error}</p>}
    </div>
  )
}
type Measured = { rects: Record<string, Rect>; height: number }

/** 靜態舞台上這位演員的狀態(演員的 init/apply 是純函式;舞台沒有對外提供狀態),拖曳時算可以放的位置用 */
function actorStateOf(script: StageScript, actor: string): unknown {
  const cast = script.cast[actor]
  const def = ACTORS[cast?.actor]
  if (!def?.init || !def.apply) return null
  let st = def.init(cast.props ?? {})
  for (const raw of script.steps as unknown as Record<string, unknown>[]) {
    if (raw.on !== undefined && raw.on !== actor) continue
    const kind = def.kinds.find((k) => k in raw)
    if (kind) st = def.apply(st, kind, raw)
  }
  return st
}

/** 回應的一步是哪一位演員的:寫了 on 就是它,沒寫就找 cast 裡唯一會這個動作的 */
function ownerOf(step: ScriptStep, cast: string[], script: StageScript): string {
  const s = step as Record<string, unknown>
  if (typeof s.on === 'string') return s.on
  const able = cast.filter((id) => ACTORS[script.cast[id]?.actor]?.kinds.some((k) => k in s))
  if (able.length !== 1) throw new Error(`回應 ${JSON.stringify(step).slice(0, 60)}:${able.length ? `${able.join('、')} 都會這個動作,請用 "on" 指定演員` : '沒有演員會這個動作'}`)
  return able[0]
}

type Props = {
  /** 互動點加進去之前的腳本與目前的回答:這個舞台自己演到互動點 */
  script: StageScript
  answers: Answers
  moment: Moment
  /** false:只呈現演員,回答在詢問框 */
  interactive: boolean
  headRef: RefObject<HTMLHeadingElement | null>
  /** 題目與略過鈕放在演員旁邊(首頁嵌入沒有側欄時);課程頁的題目在導覽(側欄)裡 */
  hint?: boolean
  /** 提示放在這裡(小播放器放不下,不要蓋住演員);不寫就在演員上方 */
  hintSlot?: HTMLElement | null
  /** 互動腳本的 until 還沒達成時是 true,達成(或沒有 until)時是 false;頁面依此決定選項能不能按 */
  onLocked?: (locked: boolean) => void
  onAnswer: (a: Answer) => void
}

export function StaticActor({ script, answers, moment, interactive, headRef, hint: withHint = false, hintSlot, onLocked, onAnswer }: Props) {
  const L = useT().player.scene
  const hostRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<Measured | null>(null)
  const measureRef = useRef<() => void>(() => {})
  // 學員自由點過的東西(stage.toggles,沒有互動腳本時):直接點靜態舞台上的網頁元素,網頁的 script.js 決定顯示或隱藏什麼。
  // 不重建舞台;舞台因為寬度改變重畫(網頁重新載入)時,再依序補點一次(clicksRef)
  const [clicks, setClicks] = useState<string[]>([])
  const clicksRef = useRef<string[]>([])
  const stageRef = useRef<Stage | null>(null)
  const besideStageRef = useRef<Stage | null>(null)
  const toggles = moment.interact ? undefined : moment.stage?.toggles
  // 拖曳(stage.drag):學員拖演員身上的東西(例如樹狀圖的節點),放下去就在靜態舞台上多演一步(例如 put),舞台重載後播放這一步
  const [drops, setDrops] = useState<ScriptStep[]>([])
  const [plan, setPlan] = useState<DragPlan | null>(null)
  const playedDrops = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const interact = moment.interact
  const actor = interact?.cast[0] ?? (moment.stage?.focus ?? '').split(':')[0]
  // stage.split:同一位演員分成兩張卡片,中間只顯示網頁、側欄只顯示樹;拖曳在側欄,放下去兩邊一起演(react)
  const split = !!moment.stage?.split
  const beside = interact?.cast[1] ?? (split ? actor : undefined)
  const [splitDrops, setSplitDrops] = useState<ScriptStep[]>([])
  const choicesRef = moment.stage?.choices
  // 互動腳本:每個觸發點(依 id)點了幾次;回應演完時加一 version,重新量位置
  const [counts, setCounts] = useState<Record<string, number>>({})
  const countsRef = useRef<Record<string, number>>({})
  const [version, setVersion] = useState(0)
  const doneRef = useRef(false)
  const stopRef = useRef<(() => void)[]>([])
  const spots: Spot[] = (interact?.spots ?? []).map((s, i) => ({ ...s, key: `${i}:${s.target}`, pressed: (counts[spotId(s)] ?? 0) % 2 === 1 }))
  const pickedCount = Object.values(counts).filter((n) => n > 0).length
  const locked = !!interact?.until && pickedCount < interact.until.picked
  useLayoutEffect(() => onLocked?.(locked), [locked, onLocked])
  // 離開互動點時解除(下一個互動點從沒鎖住開始,不沿用這一個的狀態)
  useLayoutEffect(() => () => onLocked?.(false), [onLocked])

  /** 觸發一段回應:步驟依演員分給主要舞台或旁邊的舞台,各自從目前的狀態演起;舞台還沒載好時不演,回傳 false */
  const trigger = (steps: ScriptStep[]): boolean => {
    if (!interact) return false
    const byStage = new Map<Stage, ScriptStep[]>()
    try {
      for (const st of steps) {
        const owner = ownerOf(st, interact.cast, script)
        const stage = owner === actor ? stageRef.current : besideStageRef.current
        if (!stage) return false
        byStage.set(stage, [...(byStage.get(stage) ?? []), st])
      }
      const runs = [...byStage].map(([stage, list]) => ({ stage, ...stage.react(list as never) }))
      stopRef.current.push(
        play(runs, () => {
          measureRef.current()
          setVersion((v) => v + 1)
        }),
      )
      return true
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      return false
    }
  }
  const pressSpot = (spot: Spot): void => {
    const id = spotId(spot)
    const n = countsRef.current[id] ?? 0
    // 演得出來才記這一次(舞台還在載入時點的不算,之後的 again 才不會顛倒)
    if (!trigger(spot.again && n % 2 === 1 ? spot.again : spot.steps)) return
    countsRef.current = { ...countsRef.current, [id]: n + 1 }
    setCounts(countsRef.current)
    // 達成 until:接著演 done(只演一次)
    const picked = Object.values(countsRef.current).filter((x) => x > 0).length
    if (interact?.until && !doneRef.current && picked >= interact.until.picked) {
      doneRef.current = true
      if (interact.done?.length) trigger(interact.done)
    }
  }
  useLayoutEffect(() => () => stopRef.current.forEach((stop) => stop()), [])

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
    // 尺寸固定的演員(fixedSize):放進一般大小的舞台(1920×1080,演員佔滿),再整個等比例縮放到這一格裡
    const fixed = !split && !!ACTORS[script.cast[actor]?.actor]?.fixedSize
    let canvas = root
    if (fixed) {
      canvas = document.createElement('div')
      root.style.position = 'relative'
      root.appendChild(canvas)
    }
    const scaleToFit = (): void => {
      if (!fixed) return
      Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', transformOrigin: '0 0' })
      const w = canvas.offsetWidth || 1
      const h = canvas.offsetHeight || 1
      const k = Math.min(root.clientWidth / w, root.clientHeight / h)
      canvas.style.transform = `translate(${((root.clientWidth - w * k) / 2).toFixed(1)}px, ${((root.clientHeight - h * k) / 2).toFixed(1)}px) scale(${k.toFixed(4)})`
    }
    const stage = createStage(canvas)
    stageRef.current = stage
    // 沒有互動腳本時,自由點過的東西在網頁重新載入後補點一次(互動腳本的回應記在舞台上,重畫時照樣帶著)
    const replay = (): void => {
      for (const sel of clicksRef.current) clickInPage(stage, actor, sel)
    }
    const cast = script.cast[actor]
    const base0 = staticScript(script, answers, moment.id, actor, ACTORS[cast.actor]?.kinds ?? [])
    const base = split ? ({ ...base0, cast: { [actor]: { ...base0.cast[actor], props: { ...base0.cast[actor].props, only: 'page' } } } } as StageScript) : base0
    const played = drops.length ? ({ ...base, steps: [...base.steps, ...drops] } as StageScript) : base
    const dragging = moment.stage?.drag && !split ? dragPlan(cast.actor, actor, actorStateOf(played, actor)) : null
    const dragRefs = dragging ? [...dragging.items.map((x) => x.target), ...new Set(dragging.items.flatMap((x) => dragging.slotsFor(x.id).map((d) => d.target)))] : []
    const spotRefs = (interact?.spots ?? []).map((s) => s.target).filter((t) => t.split(':')[0] === actor)
    const refs = [choicesRef, ...moment.options.map((o) => o.target), ...(toggles ?? []).map((t) => `${actor}:sel:${t.sel}`), ...spotRefs, ...dragRefs].filter((x): x is string => !!x)
    let raf = 0
    let collapsed = ''
    let lastSize = ''
    /** 依舞台大小重畫:大小變了就重畫這一格(演員依新的大小排版,例如瀏覽器的網頁跟著視窗變寬);寬度跨過門檻時再收合區塊 */
    const fit = (width: number): void => {
      const parts = collapsedParts(ACTORS[cast.actor]?.collapsible, moment.stage?.zone, width)
      const key = JSON.stringify(parts)
      if (key === collapsed) {
        const size = `${root.clientWidth}x${root.clientHeight}`
        if (size !== lastSize) {
          lastSize = size
          stage.renderAt(stage.duration) // 狀態沒變,只是依新大小重排;網頁不會重新載入,點開的框照樣留著
        }
        return
      }
      collapsed = key
      lastSize = `${root.clientWidth}x${root.clientHeight}`
      stage.setParts(actor, { ...cast.parts, ...parts })
      // 區塊是畫完才套用,演員的捲動位置是依舊版面算的:先換到別的時間讓區塊生效,再畫一次才會依新版面重算
      stage.renderAt(0)
      stage.renderAt(stage.duration)
      replay()
    }
    const measure = (): void => {
      scaleToFit()
      const box = host.getBoundingClientRect()
      fit(box.width)
      const rects: Record<string, Rect> = {}
      for (const ref of refs) {
        const el = stage.element(ref)
        if (!el) continue
        // 網頁裡藏起來的元素(或它外面的容器藏起來了)不能點
        const sel = ref.startsWith(`${actor}:sel:`) ? ref.slice(`${actor}:sel:`.length) : null
        if (sel && goneInPage(stage, actor, sel)) continue
        const r = el.getBoundingClientRect()
        rects[ref] = { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }
      }
      setMeasured({ rects, height: box.height })
    }
    measureRef.current = measure
    stage
      .load(played, { cursor: false })
      .then(() => {
        if (cancelled) return
        measure() // 第一次一定會畫:collapsed 還是空字串
        setPlan(dragging)
        ro = new ResizeObserver(measure)
        ro.observe(host)
        ro.observe(root) // 提示換行時,舞台變矮但外框不變
        // 剛放下的那一步:從那一步開始的時間播到結尾(移動的動畫),播完再量一次位置
        const fresh = drops.length > playedDrops.current
        playedDrops.current = drops.length
        const last = stage.steps.at(-1)
        if (fresh && last) {
          const from = last.start
          const t0 = performance.now()
          const tick = (): void => {
            const ms = Math.min(stage.duration, from + (performance.now() - t0))
            stage.renderAt(ms)
            if (ms < stage.duration) raf = requestAnimationFrame(tick)
            else measure()
          }
          stage.renderAt(from)
          raf = requestAnimationFrame(tick)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e))
      })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      stageRef.current = null
      root.replaceChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, answers, moment, actor, choicesRef, toggles, drops, split])

  // stage.split 的拖曳:計畫照「互動點的狀態 + 放下過的步驟」算(在側欄的樹上拖)
  const splitPlan = useMemo(() => {
    if (!split || !moment.stage?.drag) return null
    const cast = script.cast[actor]
    const base = staticScript(script, answers, moment.id, actor, ACTORS[cast.actor]?.kinds ?? [])
    return dragPlan(cast.actor, actor, actorStateOf({ ...base, steps: [...base.steps, ...splitDrops] } as StageScript, actor))
  }, [split, moment, script, answers, actor, splitDrops])
  const dropSplit = (step: ScriptStep): void => {
    const runs: { stage: Stage; id: number; duration: number }[] = []
    try {
      for (const stage of [stageRef.current, besideStageRef.current]) if (stage) runs.push({ stage, ...stage.react([step] as never) })
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      return
    }
    setSplitDrops((d) => [...d, step])
    stopRef.current.push(
      play(runs, () => {
        measureRef.current()
        setVersion((v) => v + 1)
      }),
    )
  }

  const rects = measured?.rects ?? {}
  const height = measured?.height ?? 0
  // 量到位置之前還不知道哪些選項要放進提示,先不放(否則全部選項會閃一下);載入失敗時全部放進提示,學員才答得了
  const loose = measured || error ? moment.options.map((o, option) => ({ ...o, option })).filter((o) => !o.target || !rects[o.target]) : []
  const chips = loose.map((o) => (
    <button key={o.label} type="button" disabled={locked} onClick={() => onAnswer({ option: o.option })}>
      {o.label}
    </button>
  ))
  const choicesRect = choicesRef ? rects[choicesRef] : undefined
  const hint = interactive && withHint && (
    <div className={styles.staticHint}>
      <h2 ref={headRef} tabIndex={-1}>
        {moment.title}
      </h2>
      {!choicesRect && chips.length > 0 && <div className={styles.pushChips}>{chips}</div>}
      {!moment.noSkip && (
        <button type="button" className={styles.skip} onClick={() => onAnswer({ skipped: true })}>
          {moment.skip?.label ?? L.skip}
        </button>
      )}
    </div>
  )

  return (
    <div className={styles.staticLayer} data-testid="static-actor">
      <div ref={hostRef} className={styles.staticHost}>
        {!hintSlot && hint}
        <div ref={rootRef} className={styles.staticRoot} />
        {error && (
          <p className={styles.error} role="alert">
            {L.actorLoadError}
            {error}
          </p>
        )}
        {interactive && (
          <>
            {/* 自由點的東西(stage.toggles):容器先放、裡面的元素後放,點到裡面的元素時不會被外面的容器擋住 */}
            {(toggles ?? []).map((t) => {
              const r = rects[`${actor}:sel:${t.sel}`]
              const on = clicks.filter((c) => c === t.sel).length % 2 === 1
              return r ? (
                <button
                  key={t.sel}
                  type="button"
                  className={styles.toggleHit}
                  style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                  aria-label={t.label}
                  aria-pressed={on}
                  onClick={() => {
                    clicksRef.current = [...clicksRef.current, t.sel]
                    setClicks(clicksRef.current)
                    if (stageRef.current) clickInPage(stageRef.current, actor, t.sel)
                  }}
                />
              ) : null
            })}
            {/* 互動腳本的觸發點(主要演員身上的);寫在前面的在下層,容器寫在裡面的元素前面 */}
            {spots
              .filter((s) => s.target.split(':')[0] === actor)
              .map((s) => {
                const r = rects[s.target]
                return r ? (
                  <button
                    key={s.key}
                    type="button"
                    className={styles.toggleHit}
                    style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                    aria-label={s.label}
                    aria-pressed={s.again ? s.pressed : undefined}
                    onClick={() => pressSpot(s)}
                  />
                ) : null
              })}
            {plan && (
              <DragLayer
                classes={{ grab: styles.dragGrab, dropZone: styles.dropZone, dropDot: styles.dropDot, ghost: styles.dragGhost }}
                minZone={{ w: 120, h: 36 }}
                drag={{ plan, drop: (step) => setDrops((d) => [...d, step]) }}
                rects={rects}
                elementOf={(target) => stageRef.current?.element(target) ?? null}
                toStage={(cx, cy) => {
                  const box = hostRef.current?.getBoundingClientRect()
                  return { x: cx - (box?.left ?? 0), y: cy - (box?.top ?? 0) }
                }}
              />
            )}
            {moment.options.map((o, option) => {
              const r = o.target ? rects[o.target] : undefined
              return r ? <button key={o.label} type="button" disabled={locked} className={styles.pushHit} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} aria-label={o.label} onClick={() => onAnswer({ option })} /> : null
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
      {/* 旁邊一起看的演員(interact.cast 的第二位):浮在主要演員旁邊的側欄卡片,不放進主要演員的框裡 */}
      {beside && (
        <BesideActor
          script={script}
          answers={answers}
          momentId={moment.id}
          actor={beside}
          only={split ? 'tree' : undefined}
          spots={interactive ? spots.filter((s) => s.target.split(':')[0] === beside) : []}
          drag={interactive && splitPlan ? { plan: splitPlan, drop: dropSplit } : null}
          version={version}
          onStage={(s) => (besideStageRef.current = s)}
          onSpot={pressSpot}
        />
      )}
      {hintSlot && hint && createPortal(hint, hintSlot)}
    </div>
  )
}
