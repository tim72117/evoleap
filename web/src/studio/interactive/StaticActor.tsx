import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ACTORS } from '../../live/actors'
import { placeOf } from '../../live/place'
import { createStage, type Stage, type StageScript } from '../../live/stage'
import type { ActorControl, ScriptStep } from '../../live/types'
import { dragPlan, type DragPlan } from '../../kids/drag'
import { DragLayer } from '../../kids/DragLayer'
import { clickInPage, collapsedParts, goneInPage, spotId, staticScript, untilReached, type Answer, type Answers, type InteractSpot, type Moment } from './scene'
import { useT } from '../../i18n/I18nProvider'
import { locate, screenOf, startOf, type DemoPlan, type DemoView } from './demoEngine'
import type { Shell } from '../../live/shell'
import styles from './InteractiveScenePage.module.css'

// 互動時的靜態演員:影片停在互動點,換成另一個舞台(主舞台先藏起來,不是壓暗),只有這位演員,停在同一個狀態。
// 這個舞台不縮放:大小就是畫面上的大小(不是 1920×1080 再由外殼縮小),也沒有鏡頭,字維持演員原本的大小;
// 依舞台大小調整:單位跟著舞台寬度變小(CSS 的 --u),舞台太窄時收合不在互動區的區塊(互動點的 stage.zone),都是重新排版,不是整個縮小。
// 學員直接操作演員:選項疊在演員的目標上(真實按鈕,演員不處理點擊);沒有對應目標的選項放進指定的區域(例如輸入框)。
// 互動腳本(moment.interact,live/README.md 第 2A.7 節):觸發點疊在演員的目標上,點了就讓演員從目前的狀態演一段回應(舞台的 react),
// 不重新載入、沒有互動時間軸;interact.cast 的第二位演員放在旁邊的卡片,一樣可以有觸發點。
// 詢問框只用在沒有演員可以操作的互動點(見 scene.ts 的 answersOnActor)。

/** 自動示範:上一段演完到下一段開始之間停多久(毫秒) */
const AUTO_GAP_MS = 500

/** 當一般網頁排版的演員量不到影片寬度時的寬度(px) */
const PAGE_WIDTH = 640
/** 左側浮空按鈕佔的寬度;舞台比 RAIL_STACK_BELOW 窄時按鈕改排在上面(和 CSS 的 container query 一致) */
const RAIL_SPACE = 84
const RAIL_STACK_BELOW = 700

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
 * 放在旁邊一起看的演員(interact.cast 的第二位,例如網頁旁邊的結構圖):一張浮在主要演員旁邊的卡片(不放進主要演員的框裡)。
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
  /** 蓋過演員的 props.only(stage.split 時旁邊的卡片只顯示樹) */
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
  /** true:自動示範先等著(開場旁白還在講) */
  holdAuto?: boolean
  /** 併進主時間軸的示範(moment.demo):at 是它在時間軸上的開始;畫面照播放器目前的位置算(demoEngine.ts) */
  demo?: { plan: DemoPlan; at: number; shell: () => Shell | undefined } | null
  /** 學員自己按了演員身上的東西 */
  onPress?: () => void
  headRef: RefObject<HTMLHeadingElement | null>
  /** 題目與略過鈕放在演員旁邊(示範的互動點不放) */
  hint?: boolean
  /** 提示放在這裡(小播放器放不下,不要蓋住演員);不寫就在演員上方 */
  hintSlot?: HTMLElement | null
  onAnswer: (a: Answer) => void
}

export function StaticActor({ script, answers, moment, interactive, holdAuto = false, onPress, demo, headRef, hint: withHint = false, hintSlot, onAnswer }: Props) {
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
  /** 載入完成的那個舞台(示範時間線等它) */
  const loadedStage = useRef<Stage | null>(null)
  const demoRef = useRef(demo)
  demoRef.current = demo
  /** 學員正在看別的大段(影片停著);anchor 是停下時的影片時間,影片一動就回到主線 */
  const viewRef = useRef<(DemoView & { anchor: number }) | null>(null)
  /** 畫面上的大段|看別段時影片所在的大段 */
  const [shownDemo, setShownDemo] = useState('')
  const besideStageRef = useRef<Stage | null>(null)
  const toggles = moment.interact ? undefined : moment.stage?.toggles
  // 拖曳(stage.drag):學員拖演員身上的東西(例如樹狀圖的節點),放下去就在靜態舞台上多演一步(例如 put),舞台重載後播放這一步
  const [drops, setDrops] = useState<ScriptStep[]>([])
  const [plan, setPlan] = useState<DragPlan | null>(null)
  const playedDrops = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const interact = moment.interact
  const actor = interact?.cast[0] ?? (moment.stage?.focus ?? '').split(':')[0]
  // stage.split:同一位演員分成兩張卡片,中間只顯示網頁、旁邊只顯示樹;拖曳在旁邊的卡片,放下去兩邊一起演(react)
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
  const locked = !untilReached(interact?.until, counts)

  // 演員自己處理點擊(實例有 press,且腳本沒寫互動腳本):不疊透明按鈕,點擊直接交給演員
  const [self, setSelf] = useState(false)
  // 演員要放在左側的浮空按鈕
  const [controls, setControls] = useState<ActorControl[]>([])
  const readControls = (): void => setControls(stageRef.current?.controls(actor) ?? [])
  const pressActor = (e: { target: EventTarget }): void => {
    const name = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-t]')?.dataset.t : undefined
    if (name) press(name)
  }
  const press = (name: string): void => {
    const stage = stageRef.current
    if (!self || !stage) return
    // 腳本的選項指到的目標是「回答」,交給播放頁;其他的由演員依目前狀態決定
    const option = moment.options.findIndex((o) => o.target === `${actor}:${name}`)
    if (option >= 0) {
      onAnswer({ option })
      return
    }
    touched.current = true
    onPress?.()
    // 有示範時間線:切換鈕交給時間線;學員在演員身上的其他點擊不演、不記
    if (moment.demo) {
      pressDemo(name)
      return
    }
    const steps = stage.press(actor, name)
    if (!steps) return
    light(name)
    runSelf(steps)
  }
  // 示範的切換鈕:別的大段只換檢視位置(影片暫停);正在播的大段與它的階段是時間軸上的位置
  const pressDemo = (name: string): void => {
    const d = demoRef.current
    const shell = d?.shell()
    if (!d || !shell) return
    const { plan, at } = d
    const [what, arg] = name.split(':')
    const main = locate(plan, shell.time - at).index
    const view = viewRef.current
    const lookAt = (segment: string, section?: number): void => {
      shell.pause()
      viewRef.current = { segment, section, offsetMs: 0, anchor: shell.time }
    }
    if (what === 'tab') {
      if (startOf(plan, arg) < 0 || arg === view?.segment) return
      if (arg !== plan.segment[main]) lookAt(arg)
      else if (view) {
        viewRef.current = null
        shell.play()
      }
    } else if (what === 'stage') {
      const section = Number(arg)
      const index = startOf(plan, view?.segment ?? plan.segment[main], section)
      if (index < 0) return
      if (view) lookAt(view.segment, section)
      else if (!plan.sections[main].includes(section)) shell.seek(at + plan.starts[index])
    }
  }
  // 切換鈕按下就先亮起來,不等動作演完
  const light = (name: string): void =>
    setControls((list) => {
      const group = list.find((c) => c.name === name)?.group
      return group ? list.map((c) => (c.group === group ? { ...c, on: c.name === name } : c)) : list
    })
  // 演員自己的回應與自動示範:同時只演一段;演完停一下,問演員下一步要示範什麼
  const selfStop = useRef<() => void>(() => {})
  const autoTimer = useRef<number>(0)
  const runSelf = (steps: unknown): void => {
    const stage = stageRef.current
    if (!stage) return
    window.clearTimeout(autoTimer.current)
    selfStop.current()
    try {
      const run = { stage, ...stage.react(steps as never) }
      selfStop.current = play([run], () => {
        measureRef.current()
        readControls()
        nextAuto()
      })
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    }
  }
  // 示範:每一格照播放器的位置(或正在看的另一段)畫演員;聲音與字幕是播放器的
  useEffect(() => {
    if (!moment.demo) return
    let raf = 0
    let prev = performance.now()
    let drawn: { stage: Stage; key: string; id: number; duration: number; t: number } | null = null
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(250, now - prev)
      prev = now
      const stage = stageRef.current
      const d = demoRef.current
      const shell = d?.shell()
      if (!stage || !d || !shell || loadedStage.current !== stage) return
      const { plan } = d
      const time = shell.time
      let view = viewRef.current
      if (view && (shell.playing || time !== view.anchor)) viewRef.current = view = null
      if (view) view.offsetMs += dt * shell.rate
      const main = plan.segment[locate(plan, time - d.at).index]
      setShownDemo(`${view?.segment ?? main}|${view ? main : ''}`)
      const screen = screenOf(plan, time - d.at, view)
      try {
        const fresh = drawn?.stage !== stage || drawn.key !== screen.key
        if (fresh) {
          stage.unreact()
          drawn = { stage, key: screen.key, ...stage.react(screen.steps as never), t: -1 }
        }
        const shown = drawn!
        const t = Math.min(screen.from, shown.duration)
        if (t === shown.t) return
        shown.t = t
        stage.reactAt(shown.id, t)
        if (fresh || t === shown.duration) {
          measureRef.current()
          readControls()
        }
      } catch (err) {
        cancelAnimationFrame(raf)
        setError(String(err instanceof Error ? err.message : err))
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment])
  // 開場旁白還在講時先不自動示範;學員自己按了就不用再等
  const holdRef = useRef(holdAuto)
  holdRef.current = holdAuto
  const touched = useRef(false)
  const nextAuto = (): void => {
    window.clearTimeout(autoTimer.current)
    // 有示範時間線時畫面全由時間線決定
    if (moment.demo || (holdRef.current && !touched.current)) return
    autoTimer.current = window.setTimeout(() => {
      const steps = stageRef.current?.auto(actor)
      if (steps) runSelf(steps)
    }, AUTO_GAP_MS)
  }
  useLayoutEffect(() => {
    if (self) {
      readControls()
      nextAuto()
    }
    return () => {
      window.clearTimeout(autoTimer.current)
      selfStop.current()
    }
    // 只在舞台準備好(self)時開始
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self])
  // 按鈕反白的是畫面上的大段;學員在看別段時,影片所在的那一段標「播放中」
  const [shownTab, mainTab] = shownDemo.split('|')
  const playingTab = mainTab ? `tab:${mainTab}` : undefined
  useEffect(() => {
    if (self && !holdAuto && !touched.current) nextAuto()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdAuto])
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
      // 回應一開始就重量一次:第一格就消失的目標(例如送出前的選項),它的透明按鈕不要留在原地
      measureRef.current()
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
    if (interact?.until && !doneRef.current && untilReached(interact.until, countsRef.current)) {
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
    // 自己處理點擊的演員當一般網頁排版:限制在好讀的寬度,高度用滿,放不下在演員裡捲動
    const asPage = interactive && !interact && !!ACTORS[script.cast[actor]?.actor]?.page
    if (asPage) {
      host.style.maxHeight = ''
    }
    host.classList.toggle(styles.staticPage, asPage)
    /** 當一般網頁時,寬度跟影片舞台上這位演員一樣,開場和後面才不會一寬一窄;找不到影片舞台(量不到)用 PAGE_WIDTH */
    const matchVideoWidth = (): void => {
      if (!asPage) return
      const layer = host.parentElement
      const video = [...(layer?.parentElement?.querySelectorAll<HTMLElement>('.live-stage') ?? [])].find((el) => !layer?.contains(el))
      const scale = video?.offsetWidth ? video.getBoundingClientRect().width / video.offsetWidth : 0
      const wide = scale ? Math.round(place.w * scale) : PAGE_WIDTH
      const room = (layer?.clientWidth ?? 0) > RAIL_STACK_BELOW ? layer!.clientWidth - RAIL_SPACE * 2 : Infinity
      host.style.maxWidth = `${Math.min(wide, room)}px`
    }
    matchVideoWidth()
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
    // 要在載入前標好:演員掛上去時依它決定畫不畫成按鈕
    if (asPage) canvas.dataset.pressable = '1'
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
      matchVideoWidth()
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
        loadedStage.current = stage
        setSelf(asPage && stage.pressable(actor))
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

  // stage.split 的拖曳:計畫照「互動點的狀態 + 放下過的步驟」算(在旁邊卡片的樹上拖)
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
    <div className={controls.length ? `${styles.staticLayer} ${styles.withRail}` : styles.staticLayer} data-testid="static-actor">
      {controls.length > 0 && (
        <div className={styles.staticRail} role="group">
          {controls.map((c) => (
            <button key={c.name} type="button" className={c.primary ? styles.railPrimary : undefined} aria-pressed={c.group ? (shownTab && c.name.startsWith('tab:') ? c.name === `tab:${shownTab}` : !!c.on) : undefined} data-playing={c.name === playingTab || undefined} aria-label={c.name === playingTab ? L.playingHere(c.label) : undefined} onClick={() => press(c.name)}>
              <b>{c.label}</b>
              {c.sub && <span>{c.name === playingTab ? L.playingMark : c.sub}</span>}
            </button>
          ))}
        </div>
      )}
      <div ref={hostRef} className={styles.staticHost}>
        {!hintSlot && hint}
        <div ref={rootRef} className={styles.staticRoot} data-self={self || undefined} onClick={self ? pressActor : undefined} />
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
            {!self && moment.options.map((o, option) => {
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
      {/* 旁邊一起看的演員(interact.cast 的第二位):浮在主要演員旁邊的卡片,不放進主要演員的框裡 */}
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
