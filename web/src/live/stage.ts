// stage.ts — 舞台(導演)。規格見 README.md「舞台與演員」。
//
// 舞台負責「怎麼演」:時間表、旁白長度、字幕、章節、練習點、演員的位置與出場退場,
// 以及所有教學效果(章節卡、聚光燈與說明、鏡頭推近與平移、虛擬滑鼠)。
// 演員(actors/<名稱>/actor.ts)只負責「長什麼樣、每個動作畫成什麼樣子」,並告訴舞台目標在哪裡。
// 所以同一個效果可以用在任何演員身上,同一個演員也可以被安排到任何場景。鏡頭的計算在 camera.ts。
//
//   const stage = createStage(div)  在 div 裡建立 1920×1080 的舞台(由外殼 shell.ts 縮放);
//                                    createStage(div, { aspect: 'portrait' }) 是 1080×1920 的直式舞台(預設 landscape)
//   await stage.load(script)   載入腳本與演員,回傳總長度(毫秒);stage.load(script, { aspect }) 也能在載入時指定方向
//   stage.renderAt(ms)         畫出 ms 時的畫面(純函式:同一個時間點一定畫出同一個畫面)
//   stage.duration / captions / chapters / stops / narrations / steps
//
// 腳本:
//   {
//     "title": "…", "camera": "auto",
//     "cast": {                                     演員表:代號 → 演員與登場設定
//       "claude": { "actor": "claude-desktop", "props": { … }, "place": "window" },
//       "finder": { "actor": "finder", "props": { … }, "place": "right", "hidden": true }
//     },
//     "steps": [ … ]
//   }
//   place:"window"(預設,置中留邊)、"full"、"left"、"right"、"center",或 { x, y, w, h }(畫布的 px,或 "50%" 這種百分比;h 可省略)。
//         語意名稱在直式會換算成直式的位置(left = 上半部、right = 下半部,見 place.ts 的 PLACES);
//         也可以寫成 { "landscape": <上面任一種>, "portrait": <上面任一種> },兩種方向各寫一種。方向不寫在腳本裡,是播放時的參數。
//
// 步驟:
//   演員的動作:{ "user": "…" } — 交給演員表中會這個動作的演員;有多個演員會時必須加 "on": "代號",否則報錯
//   舞台的動作:
//     { "card": "標題", "eyebrow": "小標", "sub": "副標" }         全畫面的章節卡/片尾卡
//     { "callout": "claude:ask", "text": "說明" }                 聚光燈:其他地方變暗,框出目標並顯示說明
//     { "show": "finder", …其他欄位轉給演員 }                     演員出場(淡入);其他欄位會當成給演員的動作
//     { "hide": "finder" }                                        演員退場
//     { "move": "finder", "to": "center" }                        演員移到新位置
//     { "checkpoint": "換你試試", "body": "…" }                   播放器播到這裡會暫停,請學員動手(畫面不變)
//     { "wait": 800 }
//   任何一步都可以加:
//     "narration"(旁白/字幕;時間不夠會自動拉長)、"chapter"(章節名稱)、"lessonStep"(對應課程的第幾步)、
//     "ms"(覆寫長度)、"pause"(之後的停頓,預設 250)、
//     "selectable":true/false 從這一步開始,學員能不能用滑鼠選取舞台上的文字(預設不能;暫停時才選得到,播放中由外殼的手勢層接收點擊)、
//     "focus":"claude:composer" 或 { "target": "claude:ask", "zoom": 1.8 } 鏡頭推近;false 拉回全景。
//   頂層 "camera": "auto" 時,沒寫 focus 的步驟由演員自己建議(例如打字看輸入框),聚光燈看它的目標,其他看全景。
//   目標寫成「演員代號:目標名稱」(目標名稱見各演員 actor.ts 開頭),只寫代號表示整個演員。
//   頂層 "blocking": { "cast": [...], "shot": "depth" } 時,幾位演員共用一塊位置、輪流到前景(調度,見 blocking.ts);
//   步驟可加 "foreground"、"shot"、"transition"。調度只改演員外框的 transform 與濾鏡,鏡頭、聚光燈、滑鼠量位置時會換算進去。
//
// 有狀態的演員(SPEC 2A.5):定義了 init(props)/apply(state, kind, step) 的演員,舞台在 load 時依序推算每一步前後的狀態,
// render 收到 { events, view: { state, prev, ev } };操作對不上狀態時 apply 丟錯,load 會指出是腳本第幾步。演員退場時清空 state.temp。
import { blockingAt, blockingFor, blockPreroll, checkBlocking, planBlocking, scheduleBlocking, type BlockingSpec, type BlockCue, type Mark } from './blocking'
import { cameraPoseAt, planCameraKeys, prerollOf, scheduleCameraKeys, type CameraCue } from './camera'
import { kit, type Rect, type Styles } from './kit'
import { ACTORS } from './actors'
import { placeOf, stageSize } from './place'
import type {
  ActorEvent,
  Aspect,
  ActorInstance,
  ActorView,
  AnyActor,
  CameraKey,
  CastEntry,
  CommonStepFields,
  CursorPlan,
  FocusSpec,
  Place,
  StageCaption,
  StageChapter,
  StageKind,
  StageNarration,
  StageScript,
  StageStepOf,
  StageStop,
} from './types'
import './stage.css'

export type { StageCaption, StageChapter, StageNarration, StageScript, StageStop } from './types'

/** 舞台對外的介面 */
export interface Stage {
  /** 載入腳本與演員,回傳總長度(毫秒);腳本有錯會丟出含「第幾步」的錯誤。opts.voice:{ 旁白文字: 語音長度(毫秒) },有語音時用實際長度排時間;opts.aspect 指定舞台方向(沒給就沿用 createStage 的) */
  load(script: StageScript, opts?: { voice?: Record<string, number>; aspect?: Aspect; cursor?: boolean }): Promise<number>
  /** 舞台目前的方向 */
  readonly aspect: Aspect
  /** 畫出 ms 時的畫面(同一個時間點一定畫出同一個畫面) */
  renderAt(ms: number): void
  /** 換掉演員登場時的區塊設定(演員展示頁用),下一次 renderAt 生效 */
  setParts(id: string, parts: Record<string, boolean>): void
  /** 「演員代號:目標」目前對應的元素(畫面上疊加互動控制項時用);找不到回傳 null */
  element(ref: string): HTMLElement | null
  readonly duration: number
  readonly captions: StageCaption[]
  readonly chapters: StageChapter[]
  readonly stops: StageStop[]
  /** 每段旁白開始的時間(毫秒)與文字 */
  readonly narrations: StageNarration[]
  /** 鏡頭關鍵點(過濾後),除錯與測試用 */
  readonly cameraKeys: CameraKey[]
  readonly steps: { kind: string; actor: string | null; start: number; dur: number; step: Step }[]
}

/** 腳本的一步:舞台只讀共通欄位,其餘欄位依動作種類而定 */
type Step = CommonStepFields & Record<string, unknown>

const STAGE_HTML = `
  <div class="st-cam">
    <div class="st-cast"></div>
    <!-- 跟著鏡頭縮放的效果:聚光燈、說明、滑鼠 -->
    <div class="st-fx">
      <div class="st-spot" hidden></div>
      <div class="st-bubble" hidden></div>
      <div class="st-ripple" hidden></div>
      <div class="st-cursor" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2.5v17.2l4.6-4.3 3 6.6 3-1.4-3-6.4h6.3z"/></svg></div>
    </div>
  </div>
  <!-- 不跟鏡頭縮放的疊加畫面:章節卡 -->
  <div class="st-over">
    <div class="st-card" hidden></div>
  </div>`

const STAGE_KINDS: readonly StageKind[] = ['card', 'callout', 'show', 'hide', 'move', 'checkpoint', 'wait', 'parts']
let stageSeq = 0
// 這幾種疊加畫面有旁白時直接延長到講完,不讓畫面空等
const STRETCH_KINDS: readonly string[] = ['card', 'callout', 'show']
const NARRATION_DELAY = 150 // 字幕與旁白語音在這一步開始後多久出現
// 中文旁白約每秒 4.2 字(與 record.mjs 相同),再留一點換氣
const speakMs = (text: string): number => (String(text).replace(/\s/g, '').length / 4.2) * 1000 + 700

/** 演員表裡的一位演員:定義、掛在畫面上的實例與位置 */
interface Member {
  def: AnyActor
  inst: ActorInstance<unknown>
  slot: HTMLElement
  place: Place
  props: Record<string, unknown>
  hidden: boolean
  /** 登場時的區塊設定(沒寫的區塊照常顯示) */
  parts: Record<string, boolean>
}
/** load 時排出來的一步(尚未決定開始時間) */
interface PlannedStep {
  s: Step
  kind: string
  actor: string | null
  /** 腳本裡的第幾步(從 1 開始,錯誤訊息用) */
  n: number
  prev?: unknown
  state?: unknown
  dur: number
  pause: number
}
/** 鏡頭提示點只需要知道這一步是什麼、誰演(還沒排時間) */
type StepRef = { kind: string; s: Step; actor: string | null }
/** 時間表上的一步 */
interface TimelineEvent {
  kind: string
  s: Step
  actor: string | null
  start: number
  dur: number
  prev: unknown
  state: unknown
}
type Moving = { from: Place; to: Place; e: ActorEvent }
type Visibility = { shown: boolean; ev: ActorEvent | null; place: Place; move: Moving | null }

export function createStage(root: HTMLElement, opts: { aspect?: Aspect } = {}): Stage {
  root.classList.add('live-stage')
  root.innerHTML = STAGE_HTML
  const stageId = String(++stageSeq)
  root.dataset.stageId = stageId
  let aspect: Aspect = 'landscape'
  let W = 1920
  let H = 1080
  // 直式:畫布換成 1080×1920(橫式不加任何內嵌樣式與 class,和一直以來完全相同)
  function setAspect(a: Aspect): void {
    aspect = a
    ;({ w: W, h: H } = stageSize(a))
    root.classList.toggle('portrait', a === 'portrait')
    root.style.width = a === 'portrait' ? `${W}px` : ''
    root.style.height = a === 'portrait' ? `${H}px` : ''
  }
  setAspect(opts.aspect ?? 'landscape')
  const applyPlace = (slot: HTMLElement, r: Place): void => {
    slot.style.left = `${(r.x / W) * 100}%`
    slot.style.top = `${(r.y / H) * 100}%`
    slot.style.width = `${(r.w / W) * 100}%`
    slot.style.height = r.h == null ? 'auto' : `${(r.h / H) * 100}%`
  }
  const $ = <T extends HTMLElement = HTMLElement>(s: string): T => root.querySelector<T>(s)!

  let cast: Record<string, Member> = {}
  let castOrder: string[] = []
  let timeline: TimelineEvent[] = []
  let total = 0
  let captions: StageCaption[] = []
  let chapters: StageChapter[] = []
  /** 腳本的 selectable:從 at 開始能不能選取文字,依時間排序 */
  let selects: { at: number; on: boolean }[] = []
  let stops: StageStop[] = []
  let camKeys: CameraKey[] = []
  let narrations: StageNarration[] = []
  let auto = false
  let showCursor = true // 使用者自己點的時候不畫虛擬滑鼠
  let cast0: Record<string, unknown> = {} // 有狀態的演員:代號 → init(props) 的起始狀態
  let views: Record<string, ActorView<unknown>> = {} // 有狀態的演員:代號 → 目前畫面的 { state, prev, ev }(render 與 target 用)
  let blocking: BlockingSpec | null = null
  let blockCues: BlockCue[] = []
  let slotXform: Record<string, { tx: number; ty: number; s: number }> = {} // 調度:代號 → 外框目前的位移(px)與縮放,量位置時換算

  // ---------- 演員(actors/index.ts 登記的演員) ----------
  function loadActor(name: string): AnyActor {
    const def = ACTORS[name]
    if (!def) throw new Error(`找不到演員:${name}(要在 actors/index.ts 登記)`)
    return def
  }

  // 區塊顯示:用一段 CSS 藏起來,演員重畫內容也不會失效;名稱打錯時載入就報錯
  function checkParts(id: string, parts: Record<string, boolean> | undefined): Record<string, boolean> {
    const known = cast[id]?.def.parts ?? {}
    for (const name of Object.keys(parts ?? {})) {
      if (!(name in known)) throw new Error(`演員「${id}」沒有區塊「${name}」(可用:${Object.keys(known).join('、') || '無'})`)
    }
    return parts ?? {}
  }
  let partsCss = ''
  function applyParts(now: Record<string, Record<string, boolean>>): void {
    const css = castOrder
      .flatMap((id) =>
        Object.entries(now[id] ?? {})
          .filter(([, on]) => !on)
          .map(([name]) => `[data-stage-id="${stageId}"] .slot[data-cast="${id}"] :is(${cast[id].def.parts?.[name]}) { display: none !important; }`),
      )
      .join('\n')
    if (css === partsCss) return
    partsCss = css
    $('.st-parts').textContent = css
  }

  const stageKindOf = (s: Step): StageKind | undefined => STAGE_KINDS.find((k) => k in s)

  // ---------- 載入腳本 ----------
  async function load(script: StageScript, opts: { voice?: Record<string, number>; aspect?: Aspect; cursor?: boolean } = {}): Promise<number> {
    const voice = opts.voice || {}
    showCursor = opts.cursor !== false
    if (opts.aspect && opts.aspect !== aspect) setAspect(opts.aspect)
    auto = script.camera === 'auto'
    const castEl = $('.st-cast')
    castEl.innerHTML = '<style class="st-parts"></style>'
    partsCss = ''
    cast = {}
    castOrder = Object.keys(script.cast || {})
    if (!castOrder.length) throw new Error('腳本需要 cast(演員表)')
    for (const id of castOrder) {
      const c: CastEntry = script.cast[id]
      const def = loadActor(c.actor)
      const slot = document.createElement('div')
      slot.className = 'slot'
      slot.dataset.cast = id
      castEl.appendChild(slot)
      const place = placeOf(c.place, aspect)
      applyPlace(slot, place)
      const inst = def.mount(slot, c.props || {})
      cast[id] = { def, inst, slot, place, props: c.props || {}, hidden: !!c.hidden, parts: {} }
      cast[id].parts = checkParts(id, c.parts)
    }

    // 每一步交給誰:舞台的動作,或演員表中會這個動作的演員
    const steps: PlannedStep[] = []
    const where = (n: number, s: Step): string => `第 ${n} 步 ${JSON.stringify(s).slice(0, 80)}`
    ;(script.steps || []).forEach((raw, i) => {
      const s = raw as Step
      const stageKind = stageKindOf(s)
      if (stageKind) {
        const actor = stageKind === 'show' || stageKind === 'hide' || stageKind === 'move' || stageKind === 'parts' ? (s[stageKind] as string) : null
        if (actor && !cast[actor]) throw new Error(`${where(i + 1, s)}:演員表裡沒有「${actor}」`)
        if (stageKind === 'parts') {
          try {
            checkParts(actor as string, (s as StageStepOf<'parts'>).set)
          } catch (e) {
            throw new Error(`${where(i + 1, s)}:${e instanceof Error ? e.message : e}`)
          }
        }
        steps.push({ s, kind: stageKind, actor, n: i + 1, dur: 0, pause: 0 })
        return
      }
      if (s.on && !cast[s.on]) throw new Error(`${where(i + 1, s)}:演員表裡沒有「${s.on}」`)
      const ids = s.on ? [s.on] : castOrder
      const able = ids.filter((x) => cast[x].def.kinds.some((k) => k in s))
      if (!able.length) throw new Error(`${where(i + 1, s)}:沒有演員會這個動作`)
      if (able.length > 1) throw new Error(`${where(i + 1, s)}:${able.join('、')} 都會這個動作,請用 "on" 指定演員`)
      const id = able[0]
      steps.push({ s, kind: cast[id].def.kinds.find((k) => k in s) as string, actor: id, n: i + 1, dur: 0, pause: 0 })
    })

    // 有狀態的演員(SPEC 2A.5):從 init(props) 開始依序 apply 每個動作,存下每一步前後的狀態。
    // 操作對不上狀態時 apply 丟錯,這裡補上是第幾步。
    cast0 = {}
    for (const id of castOrder) {
      const def = cast[id].def
      if (!def.init) continue
      try {
        cast0[id] = def.init(cast[id].props)
      } catch (e) {
        throw new Error(`演員表「${id}」的 props:${e instanceof Error ? e.message : e}`)
      }
    }
    const states: Record<string, unknown> = { ...cast0 }
    for (const x of steps) {
      if (!x.actor || !(x.actor in states) || x.kind === 'parts') continue
      const def = cast[x.actor].def
      x.prev = states[x.actor]
      let next = x.prev
      try {
        if (x.kind === 'show' || x.kind === 'hide') {
          // show/hide 也可以順便帶一個動作(例如 { "show": "finder", "open": "practice" })
          const ks = def.kinds.filter((kk) => kk in x.s)
          if (ks.length > 1) throw new Error(`${x.kind} 一次只能帶一個動作(這裡有 ${ks.join('、')}),請拆成兩步`)
          if (ks.length) next = def.apply?.(next, ks[0], x.s)
          if (x.kind === 'hide') next = { ...(next as object), temp: {} }
        } else if (x.kind !== 'move') next = def.apply?.(next, x.kind, x.s)
      } catch (e) {
        throw new Error(`${where(x.n, x.s)}:${e instanceof Error ? e.message : e}`)
      }
      x.state = states[x.actor] = next
    }
    for (const x of steps) {
      x.dur = x.s.ms ?? stageDuration(x)
      x.pause = x.s.pause ?? (x.kind === 'parts' ? 0 : 250)
    }

    // 旁白要講得完:從這一步到下一段旁白(或練習點)之前的長度不夠,就補在最後一步的停頓;
    // 帶旁白的這一步本身是章節卡、聚光燈、出場這類畫面時,直接延長它(例如 show 之後接 hide,Finder 會留到講完才退場)
    const bound = (i: number): number => {
      for (let k = i + 1; k < steps.length; k++) if (steps[k].s.narration || steps[k].kind === 'checkpoint') return k
      return steps.length
    }
    const narr = steps.map((x, i) => (x.s.narration ? i : -1)).filter((i) => i >= 0)
    for (const i of narr) {
      const j = bound(i)
      const span = steps.slice(i, j).reduce((m, x) => m + x.dur + x.pause, 0)
      const text = steps[i].s.narration as string
      const need = voice[text] != null ? voice[text] + 500 : speakMs(text)
      if (span >= need) continue
      if (STRETCH_KINDS.includes(steps[i].kind) && steps[i].s.ms == null) steps[i].dur += need - span
      else steps[j - 1].pause += need - span
    }

    // 鏡頭:先規劃哪幾步要換鏡頭;演員動作前面留出鏡頭轉過去的時間,鏡頭到位後才開始演
    // (舞台自己的動作,例如章節卡、出場,不等鏡頭)
    const planned = planCameraKeys(steps.map(cuesOf))
    const preroll = prerollOf(planned.filter((k) => !stageKindOf(steps[k.step].s)))

    // 調度:哪幾步換前景或構圖;演員動作同樣等輪替到位(和鏡頭的預留時間取大的,兩者同時進行)
    blocking = blockingFor(script.blocking, aspect)
    let blocks: ReturnType<typeof planBlocking> = []
    const hiddenAtStart = castOrder.filter((id) => cast[id].hidden)
    if (blocking) {
      checkBlocking(blocking, castOrder)
      try {
        blocks = planBlocking(
          blocking,
          steps.map((x) => ({
            actor: x.actor,
            acts: !!x.actor && (!stageKindOf(x.s) || x.kind === 'show'),
            foreground: x.s.foreground,
            shot: x.s.shot,
            transition: x.s.transition,
            show: x.kind === 'show' ? (x.actor ?? undefined) : undefined,
            hide: x.kind === 'hide' ? (x.actor ?? undefined) : undefined,
          })),
          hiddenAtStart,
        )
      } catch (e) {
        const i = (e as { step?: number }).step
        throw new Error(i != null ? `${where(steps[i].n, steps[i].s)}:${(e as Error).message}` : String(e))
      }
      for (const [i, ms] of blockPreroll(blocks.filter((b) => !stageKindOf(steps[b.step].s)))) preroll.set(i, Math.max(preroll.get(i) ?? 0, ms))
    }

    timeline = []
    let t = 400
    steps.forEach((x, i) => {
      const start = t + (preroll.get(i) ?? 0)
      timeline.push({ kind: x.kind, s: x.s, actor: x.actor, start, dur: x.dur, prev: x.prev, state: x.state })
      t = start + x.dur + x.pause
    })
    total = t + 600

    // 字幕與旁白語音:同一刻開始(這一步開始後 NARRATION_DELAY 毫秒)。
    // 字幕切成不會太長的單行(kit.splitCaption)、按字數分配時間;有語音時分配在語音的長度內,讓字幕跟著念的速度走,沒有語音時分配到下一段旁白之前
    captions = []
    narrations = []
    for (const i of narr) {
      const j = bound(i)
      const text = timeline[i].s.narration as string
      const from = timeline[i].start + NARRATION_DELAY
      const end = (j < timeline.length ? timeline[j].start : total) - NARRATION_DELAY
      const to = voice[text] != null ? Math.min(end, from + voice[text]) : end
      narrations.push({ at: from, text })
      const parts = kit.splitCaption(text)
      const sum = parts.reduce((m, x) => m + x.length, 0)
      let c = from
      for (const part of parts) {
        const l = ((to - from) * part.length) / sum
        captions.push({ from: c, to: c + l, text: part })
        c += l
      }
    }
    chapters = timeline
      .filter((ev) => ev.s.chapter || ev.kind === 'card')
      .map((ev) => ({ at: ev.start, label: (ev.s.chapter || (ev.s as StageStepOf<'card'>).card) as string, ...(ev.s.lessonStep ? { step: ev.s.lessonStep } : {}) }))
    if (chapters[0] && chapters[0].at <= 400) chapters[0].at = 0
    selects = timeline.filter((ev) => typeof ev.s.selectable === 'boolean').map((ev) => ({ at: ev.start, on: ev.s.selectable as boolean }))
    stops = timeline
      .filter((ev) => ev.kind === 'checkpoint')
      .map((ev) => {
        const s = ev.s as StageStepOf<'checkpoint'>
        return { at: ev.start, title: s.checkpoint, body: s.body || '' }
      })

    camKeys = scheduleCameraKeys(planned, (i) => timeline[i].start, preroll)
    blockCues = blocking ? scheduleBlocking(blocking, blocks, (i) => timeline[i].start, preroll, hiddenAtStart) : []
    slotXform = {}
    for (const id of castOrder) kit.css(cast[id].slot, { transformOrigin: '', filter: '', zIndex: '' })
    renderAt(0)
    return total
  }

  function stageDuration(x: PlannedStep): number {
    switch (x.kind) {
      case 'card': return 3000
      case 'callout': return 3000
      case 'show': return 700
      case 'hide': return 400
      case 'move': return 900
      case 'checkpoint': return 400
      case 'wait': return (x.s as StageStepOf<'wait'>).wait
      case 'parts': return 1
    }
    const member = cast[x.actor as string]
    return member.def.duration(x.kind, x.s, member.props, x.prev)
  }

  // 一個步驟的鏡頭提示點:[{ at(相對於步驟開始的毫秒), focus, auto }]。
  // 腳本寫了 focus 就是單一提示點(auto: false);沒寫且 camera 為 auto 時,優先用演員的 cues(kind, step)
  // (多個時間點,at 為毫秒),沒有 cues 就退回 autoFocus 的單一提示點(at: 0)。
  function cuesOf(ev: StepRef): CameraCue[] {
    if ('focus' in ev.s) return [{ at: 0, focus: ev.s.focus, auto: false }]
    if (!auto) return []
    const def = ev.actor ? cast[ev.actor]?.def : undefined
    const list = def?.cues?.(ev.kind, ev.s)
    if (list) return list.map((c) => ({ at: c.at || 0, focus: c.target ? `${ev.actor}:${c.target}` : c.target, auto: true }))
    return [{ at: 0, focus: autoFocus(ev), auto: true }]
  }

  function autoFocus(ev: StepRef): FocusSpec | undefined {
    switch (ev.kind) {
      case 'callout': return (ev.s as StageStepOf<'callout'>).callout
      case 'card': case 'show': case 'move': return false
      case 'hide': case 'checkpoint': case 'wait': case 'parts': return undefined
    }
    const f = cast[ev.actor as string].def.autoFocus?.(ev.kind, ev.s)
    return f ? `${ev.actor}:${f}` : f
  }

  // 「演員代號:目標」→ 元素;只寫代號表示整個演員
  function resolve(ref: string | null | undefined): HTMLElement | null {
    if (!ref) return null
    const [id, name] = ref.includes(':') ? ref.split(/:(.*)/s) : [ref, null]
    const c = cast[id]
    if (!c) return null
    return name ? c.inst.target(name, views[id] ?? null) : c.slot
  }
  // 量位置(舞台座標)。調度把外框縮放、位移過時,換算成畫面上實際的位置
  const rectOf = (el: HTMLElement): Rect => {
    const cam = $('.st-cam')
    const r = kit.rectIn(el, cam)
    const slot = el.closest<HTMLElement>('.slot')
    const xf = slot?.dataset.cast ? slotXform[slot.dataset.cast] : undefined
    if (!slot || !xf) return r
    const o = kit.rectIn(slot, cam)
    return { x: o.x + xf.tx + (r.x - o.x) * xf.s, y: o.y + xf.ty + (r.y - o.y) * xf.s, w: r.w * xf.s, h: r.h * xf.s }
  }
  const measure = (target: string): Rect | null => {
    const el = resolve(target)
    return el ? rectOf(el) : null
  }

  // ---------- renderAt ----------
  function renderAt(ms: number): void {
    // 0. 能不能選取文字:最後一個已經開始、寫了 selectable 的步驟決定;沒寫過就不能選取
    const sel = selects.reduce((on, x) => (x.at <= ms ? x.on : on), false)
    if (root.dataset.selectable !== String(sel)) root.dataset.selectable = String(sel)
    // 1. 演員:每個演員拿到「已經開始的、屬於自己的動作」,自己畫
    const byActor: Record<string, ActorEvent[]> = Object.fromEntries(castOrder.map((id) => [id, []]))
    const fx: { card: ActorEvent | null; callout: ActorEvent | null; cursor: { plan: CursorPlan; local: number; actor: string } | null } = {
      card: null,
      callout: null,
      cursor: null,
    }
    const vis: Record<string, Visibility> = Object.fromEntries(
      castOrder.map((id) => [id, { shown: !cast[id].hidden, ev: null, place: cast[id].place, move: null }]),
    )
    // 有狀態的演員:最後一個已經開始的動作決定 prev/state;還在進行中就帶上 ev
    const partsNow: Record<string, Record<string, boolean>> = Object.fromEntries(castOrder.map((id) => [id, cast[id].parts]))
    views = {}
    for (const id in cast0) views[id] = { state: cast0[id], prev: cast0[id], ev: null }
    for (const ev of timeline) {
      if (ms < ev.start) break
      const local = ms - ev.start
      const e: ActorEvent = { kind: ev.kind, step: ev.s, start: ev.start, dur: ev.dur, local, p: kit.clamp(local / ev.dur) }
      if (ev.actor && ev.actor in views && ev.state) {
        const going = local < ev.dur
        // 退場淡出的過程中照退場前的樣子畫(temp 在退場完成後才清掉)
        views[ev.actor] = { state: going && ev.kind === 'hide' ? ev.prev : ev.state, prev: ev.prev, ev: going ? e : null }
      }
      if (ev.kind === 'show' || ev.kind === 'hide') {
        const id = ev.actor as string
        vis[id] = { ...vis[id], shown: ev.kind === 'show', ev: e }
        // show/hide 帶的其他欄位當成給演員的動作(例如 Finder 的 files)
        byActor[id].push({ ...e, kind: 'props' })
      } else if (ev.kind === 'move') {
        const id = ev.actor as string
        const to = placeOf((ev.s as StageStepOf<'move'>).to, aspect)
        vis[id] = { ...vis[id], move: { from: vis[id].place, to, e } }
        vis[id].place = to
      } else if (ev.kind === 'parts') {
        const id = ev.actor as string
        partsNow[id] = { ...partsNow[id], ...(ev.s as StageStepOf<'parts'>).set }
      } else if (ev.actor) {
        byActor[ev.actor].push(e)
        const plan = cast[ev.actor].def.cursor?.(ev.kind, ev.s, ev.prev)
        if (plan && local < ev.dur) fx.cursor = { plan, local, actor: ev.actor }
      } else if (ev.kind === 'card' || ev.kind === 'callout') {
        if (local < ev.dur) fx[ev.kind] = e
      }
    }
    const marks: Record<string, Mark> = blocking ? blockingAt(blockCues, ms, aspect) : {}
    for (const id of castOrder) {
      const c = cast[id]
      const v = vis[id]
      // 出場/退場/移動
      let placed: Place = v.place
      if (v.move) {
        const { from, to, e } = v.move
        const p = kit.ease.inOutCubic(e.p)
        const lerp = (k: keyof Place): number | null => (from[k] == null || to[k] == null ? to[k] : kit.lerp(from[k] as number, to[k] as number, p))
        placed = { x: lerp('x') as number, y: lerp('y') as number, w: lerp('w') as number, h: lerp('h') }
      }
      applyPlace(c.slot, placed)
      let style: Styles
      if (!v.ev) style = { opacity: v.shown ? '1' : '0', transform: 'none' }
      else if (v.shown) style = kit.enter(kit.progress(v.ev.local, 0, 420), { dist: '1.5em', scale: 0.96 })
      else style = kit.enter(1 - kit.progress(v.ev.local, 0, 320), { dist: '1.5em', scale: 0.96 })
      const mark = marks[id]
      if (mark) applyMark(id, c.slot, placed, mark, style)
      style.visibility = Number(style.opacity) > 0 ? 'visible' : 'hidden'
      kit.css(c.slot, style)
      c.inst.render({ events: byActor[id], view: views[id] ?? null }, ms)
    }

    applyParts(partsNow)

    // 2. 鏡頭(要在演員排版完成後才能量位置)
    renderCamera(ms)
    // 3. 教學效果
    renderCard(fx.card)
    renderCallout(fx.callout)
    renderCursor(showCursor ? fx.cursor : null)
  }

  // 調度的站位疊在出場/退場的效果上:位移與縮放放在前面(以外框左上角為原點),透明度相乘
  // 外框大小直接用位置(舞台 px)算,不量版面;只有依內容高度(h 是 null)時才量
  function applyMark(id: string, slot: HTMLElement, placed: Place, mark: Mark, style: Styles): void {
    const tx = mark.tx * placed.w
    const ty = mark.ty * (placed.h ?? slot.offsetHeight)
    slotXform[id] = { tx, ty, s: mark.s }
    style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${mark.s.toFixed(4)}) ${style.transform === 'none' ? '' : style.transform}`.trim()
    style.transformOrigin = '0 0'
    style.opacity = (Number(style.opacity) * mark.opacity).toFixed(3)
    style.zIndex = String(Math.round(mark.z))
    const fx: string[] = []
    if (mark.bright < 0.999) fx.push(`brightness(${mark.bright.toFixed(3)})`)
    if (mark.blur > 0.05) fx.push(`blur(${mark.blur.toFixed(2)}px)`)
    if (mark.shadow > 0.01) fx.push(`drop-shadow(0 18px 36px rgba(0,0,0,${(0.28 * mark.shadow).toFixed(3)}))`)
    style.filter = fx.join(' ') || 'none'
  }

  function renderCamera(ms: number): void {
    const cam = $('.st-cam')
    kit.css(cam, kit.cameraStyle(cameraPoseAt(camKeys, ms, { w: cam.clientWidth, h: cam.clientHeight }, measure)))
  }

  function renderCard(e: ActorEvent | null): void {
    const card = $('.st-card')
    if (!e) {
      card.hidden = true
      return
    }
    const s = e.step as StageStepOf<'card'>
    card.hidden = false
    card.style.opacity = Math.min(kit.progress(e.local, 0, 380), kit.progress(e.dur - e.local, 0, 380)).toFixed(3)
    const html = `<div class="card-in">${s.eyebrow ? `<div class="eyebrow">${kit.rich(s.eyebrow)}</div>` : ''}<h1>${kit.rich(s.card)}</h1>${s.sub ? `<p>${kit.rich(s.sub)}</p>` : ''}</div>`
    kit.setIf(card, 'html', html)
    kit.css(card.firstElementChild as HTMLElement, kit.enter(kit.progress(e.local, 120, 600), { dist: '1.2em' }))
  }

  function renderCallout(e: ActorEvent | null): void {
    const spot = $('.st-spot')
    const bubble = $('.st-bubble')
    const step = e?.step as StageStepOf<'callout'> | undefined
    const target = e && step ? resolve(step.callout) : null
    if (!e || !step || !target) {
      spot.hidden = true
      bubble.hidden = true
      return
    }
    const o = Math.min(kit.progress(e.local, 0, 320), kit.progress(e.dur - e.local, 0, 320))
    const r = rectOf(target)
    spot.hidden = false
    kit.css(spot, { ...kit.spotlight(o, r, { dim: 0.55, pad: 10, radius: 12 }), outline: `3px solid rgba(217,119,87,${o.toFixed(3)})` })
    bubble.hidden = false
    kit.setIf(bubble, 'text', step.text || '')
    // 目標下方放得下就放下方,否則放上方;水平對齊目標並夾在舞台內
    const sw = $('.st-cam').clientWidth
    const sh = $('.st-cam').clientHeight
    const below = r.y + r.h + 24 + bubble.offsetHeight < sh
    const bs = kit.enter(kit.progress(e.local, 150, 400), { dir: below ? 'up' : 'down', dist: '0.6em' })
    bs.opacity = Math.min(Number(bs.opacity), o).toFixed(3)
    bs.left = `${kit.clamp(r.x, 16, sw - bubble.offsetWidth - 16)}px`
    bs.top = `${below ? r.y + r.h + 22 : r.y - bubble.offsetHeight - 22}px`
    kit.css(bubble, bs)
  }

  function renderCursor(c: { plan: CursorPlan; local: number; actor: string } | null): void {
    const cur = $('.st-cursor')
    const rip = $('.st-ripple')
    if (!c) {
      cur.hidden = true
      rip.hidden = true
      return
    }
    const points = c.plan.moves.map((m) => {
      const el = resolve(`${c.actor}:${m.target}`)
      if (!el) return null
      const r = rectOf(el)
      return [r.x + r.w * 0.55, r.y + r.h * 0.6] as const
    })
    if (points.some((p) => !p)) {
      cur.hidden = true
      rip.hidden = true
      return
    }
    const sw = $('.st-cam').clientWidth
    const sh = $('.st-cam').clientHeight
    const moves = c.plan.moves.map((m, i) => ({ at: m.at, ms: 550, to: points[i] as readonly [number, number], click: i === c.plan.moves.length - 1 }))
    const k = kit.cursor(c.local, moves, { from: [sw * 0.78, sh * 0.95], clickMs: 220 })
    cur.hidden = false
    cur.style.transform = `translate(${k.x.toFixed(1)}px, ${k.y.toFixed(1)}px) scale(${k.down ? 0.88 : 1})`
    cur.style.opacity = kit.progress(c.local, 0, 200).toFixed(3)
    if (k.ripple) {
      rip.hidden = false
      rip.style.transform = `translate(${k.ripple.x}px, ${k.ripple.y}px) scale(${(0.3 + k.ripple.r * 1.2).toFixed(3)})`
      rip.style.opacity = (k.ripple.o * 0.6).toFixed(3)
    } else rip.hidden = true
  }

  return {
    load,
    renderAt,
    setParts(id, parts) {
      cast[id].parts = checkParts(id, parts)
    },
    element: resolve,
    get aspect() {
      return aspect
    },
    get duration() {
      return total
    },
    get captions() {
      return captions
    },
    get chapters() {
      return chapters
    },
    get stops() {
      return stops
    },
    get narrations() {
      return narrations
    },
    get cameraKeys() {
      return camKeys
    },
    get steps() {
      return timeline.map(({ kind, s, start, dur, actor }) => ({ kind, actor, start, dur, step: s }))
    },
  }
}

// 開發時引擎的程式一改就整頁重新載入:舞台、外殼、演員是掛上去就一直在跑的物件,不是 React 元件,
// 交給 LivePlayer 熱更新的話它的 effect 不會重跑,畫面仍是舊程式建出來的舊物件,看起來像沒有熱重載。
// 必須直接寫 import.meta.hot.accept(Vite 靠這段文字判斷模組會自己處理更新,包成函式它就認不得)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
