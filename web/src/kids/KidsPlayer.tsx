import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ACTORS } from '../live/actors'
import { loadScript, loadVoice, type ScriptVoice } from '../live/scripts'
import { createStage, type Stage, type StageScript } from '../live/stage'
import type { AnyActor, Hotspot, ScriptStep } from '../live/types'
import { expandAnswers, momentsOf, type Answers, type Moment } from '../studio/interactive/scene'
import s from './KidsPlayer.module.css'
import { dragPlan, type DragPlan, type DropSlot } from './drag'
import { Say as SayChips } from './say'
import { hush, playClip, speak } from './speech'

// 兒童版播放器殼層(試做):給 9 歲孩子用,不用 live/shell.ts 的外殼,舞台與腳本引擎照舊。
// - 只有大按鈕:播放／暫停、上一段、下一段、重來、旁白、全螢幕;沒有時間軸、倍速與快捷鍵選單。
// - 字幕是整句旁白、字放大,句子裡的 <h1> 這類標籤畫成彩色小積木。
// - 互動點一定要回答(不能略過):選項是疊在演員目標上的透明大按鈕,孩子直接點網頁或積木。
// - 選項寫了 "retry": true(答錯)時,演完回應後回到同一題再答一次;再答會換掉前一次的回答。
// 回答照 interactive/scene.ts 的做法插進時間軸、重新載入舞台,畫面仍是時間的純函式。
//
// 子腳本:主腳本的 checkpoint 寫 "sub": "<腳本路徑>"(不寫 id)時,播到這裡就換上子腳本自己的舞台,
// 子腳本演完自己的步驟後進入自由互動,滿足條件(或孩子按「下一段」)就回到主腳本,從 checkpoint 接著播。
// 子腳本的 interact 欄位:
//   on      要互動的演員代號(until 看的是它的狀態;步驟沒寫 on 就交給它)
//   prompt  上方指引的題目;body 是第二行說明
//   spots   [{ "target": "kid:part:h1", "id": "h1", "label": "…", "steps": [...], "again": [...] }]:
//           能點什麼、點了演哪些步驟都由子腳本決定,可以一直點;id 相同算同一個,點過的再點演 again。
//           沒寫 spots 才問演員的 hotspots(演員依目前狀態決定,點一下接一步)
//   until   { "count": "<狀態欄位>", "atLeast": N }:演員狀態的這個欄位(陣列看長度)到 N 就結束
//   done    { "steps": [...] }:結束前演的步驟(例如稱讚)
// 子腳本的起始狀態寫在自己的 cast props 裡,不會自動帶入主腳本的狀態;子腳本裡的變化也不會帶回主腳本。

const W = 1920
const H = 1080

type Rect = { x: number; y: number; w: number; h: number }
/** 殼層畫的說明框:步驟上的 "guide": { "target": "kid:page", "text": "…" },從這一步開始顯示到下一步開始(舞台不看這個欄位) */
type GuideSpec = { target: string; text: string }
/** 量好的說明框:rect 是頁面上的實際像素(相對於播放畫面),不受舞台縮放影響 */
type Guide = { text: string; rect: Rect }
type AskOption = { label: string; target?: string }
/** 停下來等孩子點:題目、可以點的地方,點了做什麼 */
type Ask = {
  title: string
  body: string
  again: boolean
  focus?: string
  quiz: boolean
  options: AskOption[]
  pick: (i: number) => void
  /** 子腳本的拖曳(interact.drag):可以拖的東西、可以放的位置,放下去演哪一步 */
  drag?: { plan: DragPlan; drop: (step: ScriptStep) => void }
}
type Retry = { id: string; at: number; from: number }
/** 子腳本列出的可點區:點 target 演 steps;點過的再點,有 again 就演 again。id 相同的可點區算同一個(例如網頁上的標題和 <h1> 積木) */
type Spot = { target: string; id?: string; label?: string; steps: ScriptStep[]; again?: ScriptStep[] }
/** 子腳本的拖曳:say 是完成某個任務時念的話(任務 id → 旁白),else 是移動了但沒有完成新任務時念的話 */
type DragSpec = { say?: Record<string, string>; else?: string }
type Interact = { on: string; prompt: string; body?: string; spots?: Spot[]; drag?: DragSpec; until?: { count: string; atLeast: number }; done?: { steps: ScriptStep[] } }
type SubScript = StageScript & { interact?: Interact }
type Sub = {
  title: string
  script: SubScript
  interact: Interact
  def: AnyActor
  props: object
  extra: ScriptStep[]
  /** 點過的可點區(target) */
  picked: Set<string>
  returnAt: number
  finished: boolean
  /** 子腳本的語音(子腳本旁的 .voice.json) */
  voice: ScriptVoice | null
}

/** 把句子裡的「<h1>」畫成彩色小積木(配色在 ./tags.ts) */
const Say = ({ text }: { text: string }) => <SayChips text={text} chip={s.chip} />

/**
 * 舞台載入後才會變的資料,載入時算一次,每一格畫面直接拿來用(stage.steps 每讀一次都會重建整個陣列):
 * starts 是每一步開始的時間(和腳本的步驟一一對應),guides 是帶 guide 的步驟與它顯示的時間範圍。
 */
type Plan = { starts: number[]; guides: { start: number; end: number; guide: GuideSpec }[] }
const PLANS = new WeakMap<Stage, Plan>()
const planOf = (st: Stage): Plan => {
  const steps = st.steps
  return {
    starts: steps.map((x) => x.start),
    guides: steps.flatMap((x, i) => {
      const g = (x.step as { guide?: GuideSpec }).guide
      return g ? [{ start: x.start, end: i + 1 < steps.length ? steps[i + 1].start : st.duration, guide: g }] : []
    }),
  }
}
/** 每個舞台目前用的語音(腳本旁的 .voice.json;還沒產生時是 null,改用瀏覽器的語音念) */
const VOICES = new WeakMap<Stage, ScriptVoice | null>()
/**
 * 載入舞台,並算好這次載入的 Plan;舞台的 load 都要經過這裡。
 * 有語音時用每段語音的實際長度排時間(舞台的 voice 參數),旁白念完才接下一段
 */
async function loadStage(st: Stage, script: StageScript, voice: ScriptVoice | null) {
  await st.load(script, { voice: voice?.durations })
  PLANS.set(st, planOf(st))
  VOICES.set(st, voice)
}

/** 念一句:這個舞台的語音有這句就播音檔,沒有才用瀏覽器的語音 */
function sayOn(st: Stage | null, text: string) {
  const url = st && VOICES.get(st)?.urls[text]
  if (url) playClip(url)
  else speak(text)
}

/** 字幕一次最多出現幾個字(兒童版:字放大,一次不要太多字) */
const CAPTION_MAX = 14
/** 字幕的字數單位:<h1> 這類標籤算一個(畫成一塊小積木,不能從中間切開) */
const units = (text: string): string[] => text.match(/<[a-z0-9]+>|./gsu) ?? []
/** 把一段旁白照標點切成幾小句;一小句太長再從中間切開,太短就和下一句併在一起 */
function captionParts(text: string): string[] {
  const pieces = text.split(/(?<=[，。！？；：、])/).filter(Boolean)
  const out: string[] = []
  for (const p of pieces) {
    const last = out[out.length - 1]
    if (last && units(last).length + units(p).length <= CAPTION_MAX) out[out.length - 1] = last + p
    else out.push(p)
  }
  return out.flatMap((p) => {
    const us = units(p)
    if (us.length <= CAPTION_MAX) return [p]
    const n = Math.ceil(us.length / CAPTION_MAX)
    const size = Math.ceil(us.length / n)
    return Array.from({ length: n }, (_, i) => us.slice(i * size, (i + 1) * size).join(''))
  })
}

/** 說明框外框比目標四周各大幾 px */
const RING = 10

const sameGuides = (a: Guide[], b: Guide[]) =>
  a.length === b.length && a.every((x, i) => x.text === b[i].text && x.rect.x === b[i].rect.x && x.rect.y === b[i].rect.y && x.rect.w === b[i].rect.w && x.rect.h === b[i].rect.h)
const NO_GUIDES: Guide[] = []

type Side = 'above' | 'below' | 'right' | 'left' | 'inside'
const GAP = 16
const EDGE = 8

/**
 * 自動決定說明框放哪裡:依序試目標的上、下、右、左,第一個整個放得進播放畫面的就用它;都放不下就放在目標裡面靠上。
 * 上下時左右移到畫面裡,左右時上下移到畫面裡;回傳說明框左上角、放在哪一邊,以及小三角要對準的位置(相對於說明框)。
 */
function placeGuide(t: Rect, size: { w: number; h: number }, box: { w: number; h: number }): { x: number; y: number; side: Side; arrow: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  const fits = (x: number, y: number) => x >= EDGE && y >= EDGE && x + size.w <= box.w - EDGE && y + size.h <= box.h - EDGE
  const hx = clamp(cx - size.w / 2, EDGE, box.w - size.w - EDGE)
  const vy = clamp(cy - size.h / 2, EDGE, box.h - size.h - EDGE)
  const tries: { side: Side; x: number; y: number }[] = [
    { side: 'above', x: hx, y: t.y - GAP - size.h },
    { side: 'below', x: hx, y: t.y + t.h + GAP },
    { side: 'right', x: t.x + t.w + GAP, y: vy },
    { side: 'left', x: t.x - GAP - size.w, y: vy },
  ]
  const hit = tries.find((c) => fits(c.x, c.y)) ?? { side: 'inside' as const, x: hx, y: clamp(t.y + GAP, EDGE, box.h - size.h - EDGE) }
  const arrow = hit.side === 'left' || hit.side === 'right' ? clamp(cy - hit.y, 16, size.h - 16) : clamp(cx - hit.x, 20, size.w - 20)
  return { ...hit, arrow }
}

/** 一個說明框:先畫出來量大小,再決定放哪裡。文字換了、播放畫面大小變了(字級跟著視窗寬度與全螢幕變)時重量 */
function GuideBubble({ guide, box }: { guide: Guide; box: { w: number; h: number } }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) setSize({ w: el.offsetWidth, h: el.offsetHeight })
  }, [guide.text, box.w, box.h])
  const p = size ? placeGuide(guide.rect, size, box) : null
  return (
    <span
      ref={ref}
      className={s.guide}
      data-side={p?.side ?? 'above'}
      style={{ left: p?.x ?? 0, top: p?.y ?? 0, visibility: p ? 'visible' : 'hidden', ['--arrow' as string]: `${p?.arrow ?? 0}px` }}
    >
      <Say text={guide.text} />
    </span>
  )
}

/** 圓角的胖星星:找到了是黃色、有笑臉和腮紅;還沒找到是淡淡的空心 */
const STAR_PATH =
  'M32 6.5c1.6 0 3 .9 3.7 2.3l5.6 11.4 12.6 1.8c3.4.5 4.7 4.6 2.3 7l-9.1 8.9 2.2 12.5c.6 3.4-3 5.9-6 4.3L32 48.8l-11.3 5.9c-3 1.6-6.6-.9-6-4.3l2.2-12.5-9.1-8.9c-2.4-2.4-1.1-6.5 2.3-7l12.6-1.8 5.6-11.4c.7-1.4 2.1-2.3 3.7-2.3z'
function Star({ on }: { on: boolean }) {
  return (
    <svg className={s.star} data-on={on} viewBox="0 0 64 64" aria-hidden="true">
      <path d={STAR_PATH} />
      {on && (
        <g className={s.face}>
          <circle cx="25.5" cy="32" r="2.6" />
          <circle cx="38.5" cy="32" r="2.6" />
          <path d="M27.5 38.5q4.5 4 9 0" />
          <ellipse className={s.blush} cx="20.5" cy="38" rx="3.2" ry="2" />
          <ellipse className={s.blush} cx="43.5" cy="38" rx="3.2" ry="2" />
        </g>
      )}
    </svg>
  )
}

/** 選項裡兒童版殼層才看的欄位 */
const retries = (moment: Moment, option: number): boolean => !!(moment.options[option] as { retry?: boolean }).retry

/** 子腳本目前的步驟:原本的步驟 + 孩子點出來的步驟 */
const subSteps = (sub: Sub): StageScript => ({ ...sub.script, steps: [...sub.script.steps, ...sub.extra] })

/**
 * 在殼層重算演員的狀態(演員的 init/apply 是純函式;舞台沒有對外提供演員狀態)。
 * 有 starts 與 ms 時只算到 ms 已經開始的步驟(Plan 的 starts 與腳本的步驟一一對應)。
 */
function actorState(sub: Sub, at?: { starts: number[]; ms: number }): unknown {
  const { def, props, interact } = sub
  if (!def.init || !def.apply) throw new Error(`演員 ${def.name} 沒有狀態,不能自由互動`)
  let st = def.init(props)
  subSteps(sub).steps.forEach((raw, i) => {
    if (at && !(at.starts[i] !== undefined && at.starts[i] <= at.ms)) return
    const step = raw as Record<string, unknown>
    if (step.on && step.on !== interact.on) return
    const kind = def.kinds.find((k) => k in step)
    if (kind) st = def.apply!(st, kind, step)
  })
  return st
}

/** 集星星的進度:until 的欄位目前有幾個(陣列看長度) */
function countOf(state: unknown, until: NonNullable<Interact['until']>): number {
  const v = (state as Record<string, unknown>)[until.count]
  return Array.isArray(v) ? v.length : Number(v) || 0
}

function reached(state: unknown, until: Interact['until']): boolean {
  return !!until && countOf(state, until) >= until.atLeast
}

/**
 * 拖曳層(舞台座標,跟著舞台縮放):可以拖的東西疊上透明的握把;拖的時候畫出所有可以放的位置,
 * 離指標最近的那一條變亮,放開就交給 drop。滑鼠與手指都用 Pointer Events。
 */
function DragLayer({
  drag,
  rects,
  toStage,
  onGrab,
  elementOf,
}: {
  drag: NonNullable<Ask['drag']>
  rects: Record<string, Rect>
  toStage: (cx: number, cy: number) => { x: number; y: number }
  /** 開始拖的時候(收起提示) */
  onGrab?: () => void
  /** 目標(「演員代號:目標」)現在對應的元素:拖的時候複製一份跟著指標走 */
  elementOf?: (target: string) => HTMLElement | null
}) {
  const [held, setHeld] = useState<{ id: string; label: string; x: number; y: number; slot: DropSlot | null } | null>(null)
  // 拖的時候整個節點跟著指標走:複製一份放進演員裡(才有演員的樣式),原本的先藏起來;放開就拿掉複製的、原本的顯示回來。
  // 這只在停下來等孩子操作時存在,不屬於舞台的時間軸,放開後演員照新的狀態重畫
  const lift = useRef<{ clone: HTMLElement; orig: HTMLElement; host: HTMLElement; dx: number; dy: number } | null>(null)
  const follow = (cx: number, cy: number) => {
    const l = lift.current
    if (!l) return
    const hr = l.host.getBoundingClientRect()
    const k = hr.width / (l.host.offsetWidth || 1) || 1
    l.clone.style.left = `${(cx - l.dx - hr.left) / k}px`
    l.clone.style.top = `${(cy - l.dy - hr.top) / k}px`
  }
  const drop = () => {
    const l = lift.current
    if (!l) return
    l.clone.remove()
    l.orig.style.visibility = ''
    lift.current = null
  }
  useEffect(() => drop, [])
  const slots = held ? drag.plan.slotsFor(held.id).filter((d) => rects[d.target]) : []
  /** 離指標最近的放置位置:指標要在那條縫的左端右邊一點以內(越往右拖越進到裡面一層),上下距離最近的 */
  const nearest = (id: string, x: number, y: number): DropSlot | null => {
    let best: DropSlot | null = null
    let dist = 90
    for (const d of drag.plan.slotsFor(id)) {
      const r = rects[d.target]
      if (!r || x < r.x - 70) continue
      const dy = Math.abs(y - (r.y + r.h / 2))
      // 同樣近時,選比較靠右(比較深)而且指標已經越過它左端的
      if (dy < dist || (dy === dist && best && r.x > rects[best.target].x)) {
        best = d
        dist = dy
      }
    }
    return best
  }
  return (
    <>
      {drag.plan.items.map((it) => {
        const r = rects[it.target]
        if (!r) return null
        return (
          <button
            key={it.id}
            type="button"
            className={`${s.hit} ${s.grab}`}
            aria-label={`拖動「${it.label}」`}
            style={{ left: r.x - 10, top: r.y - 10, width: r.w + 20, height: r.h + 20 }}
            onPointerDown={(e) => {
              e.preventDefault()
              e.currentTarget.setPointerCapture(e.pointerId)
              const p = toStage(e.clientX, e.clientY)
              setHeld({ id: it.id, label: it.label, ...p, slot: null })
              onGrab?.()
              const el = elementOf?.(it.target)
              const host = el?.closest<HTMLElement>('[class^="A-"], [class*=" A-"]')
              if (el && host) {
                drop()
                const er = el.getBoundingClientRect()
                const hr = host.getBoundingClientRect()
                const k = hr.width / (host.offsetWidth || 1) || 1
                const clone = el.cloneNode(true) as HTMLElement
                Object.assign(clone.style, {
                  position: 'absolute',
                  margin: '0',
                  width: `${er.width / k}px`,
                  zIndex: '60',
                  pointerEvents: 'none',
                  opacity: '1',
                  filter: 'none',
                  translate: 'none',
                  transform: 'scale(1.08) rotate(-3deg)',
                  boxShadow: '0 18px 30px rgba(0, 0, 0, 0.28)',
                })
                host.appendChild(clone)
                el.style.visibility = 'hidden'
                lift.current = { clone, orig: el, host, dx: e.clientX - er.left, dy: e.clientY - er.top }
                follow(e.clientX, e.clientY)
              }
            }}
            onPointerMove={(e) => {
              if (!held || held.id !== it.id) return
              const p = toStage(e.clientX, e.clientY)
              follow(e.clientX, e.clientY)
              setHeld({ ...held, ...p, slot: nearest(it.id, p.x, p.y) })
            }}
            onPointerUp={() => {
              const slot = held?.slot
              drop()
              setHeld(null)
              if (slot) drag.drop(slot.step)
            }}
            onPointerCancel={() => {
              drop()
              setHeld(null)
            }}
          />
        )
      })}
      {held &&
        slots.map((d) => {
          const r = rects[d.target]
          // 可以放的位置:平常是一顆小小的「+」;最靠近的那個變成一個虛線的空位,大小和拿著的節點一樣,寫著「放這裡」
          const on = held.slot?.target === d.target
          const size = rects[drag.plan.items.find((x) => x.id === held.id)?.target ?? '']
          const w = Math.max(220, size?.w ?? 220)
          const h = Math.max(70, size?.h ?? 70)
          return on ? (
            <span key={d.target} className={s.dropZone} style={{ left: r.x, top: r.y + r.h / 2 - h / 2, width: w, height: h }}>
              放這裡
            </span>
          ) : (
            <span key={d.target} className={s.dropDot} style={{ left: r.x, top: r.y + r.h / 2 }} aria-hidden="true">
              +
            </span>
          )
        })}
      {/* 找不到可以複製的元素時,才用一個寫著名稱的小牌子跟著指標 */}
      {held && !lift.current && (
        <span className={s.ghost} style={{ left: held.x, top: held.y }} aria-hidden="true">
          {held.label}
        </span>
      )}
    </>
  )
}

type Props = {
  /** src/content/live/ 底下的腳本路徑 */
  script: string
  /** 段落選單要放在播放器外面的哪裡;放在外面時一段一列,可以附上說明(chapterInfo) */
  chaptersSlot?: HTMLElement | null
  /** 段落名稱 → 說明與是否可互動(給段落選單用) */
  chapterInfo?: Record<string, { note?: string; interactive?: boolean }>
  /** compact:給大人看的預覽(例如首頁),按鈕和播放鍵改成一般大小;不寫是給孩子用的大按鈕 */
  size?: 'kids' | 'compact'
  /** 不鎖段落:隨時都能跳到任何一段(給大人看的預覽用);不寫時不能跳過還沒回答的題目 */
  freeJump?: boolean
  /** page:全頁版,播放器撐滿外層的高度,舞台在剩下的空間裡等比例放到最大(正式課程頁);不寫是跟著寬度排在頁面裡 */
  layout?: 'inline' | 'page'
  /** 研發用:畫面下方多一條可以拉的時間軸,拉到哪裡就看哪裡(題目、子腳本都不擋) */
  scrub?: boolean
  /** 浮動版(搭配 layout="page"):舞台撐滿整個播放器,上方指引、字幕、按鈕都浮在舞台上(參考一般版的互動課程頁) */
  floating?: boolean
}

export function KidsPlayer({ script: path, chaptersSlot, chapterInfo, size = 'kids', freeJump = false, layout = 'inline', scrub = false, floating = false }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const fsRef = useRef<HTMLDivElement>(null)
  const stage = useRef<Stage | null>(null)
  const subStage = useRef<Stage | null>(null)
  const base = useRef<StageScript | null>(null)
  /** 主腳本的語音 */
  const mainVoice = useRef<ScriptVoice | null>(null)
  const moments = useRef<Moment[]>([])
  /** 主腳本裡進入子腳本的 checkpoint:標題 → 子腳本路徑 */
  const subEntries = useRef<Record<string, string>>({})
  const subsDone = useRef<Set<string>>(new Set())
  const sub = useRef<Sub | null>(null)
  const answers = useRef<Answers>({})
  /** 每個互動點還沒回答時的總長度:用來算回答插進去的步驟演到哪裡結束 */
  const plainDur = useRef<Record<string, number>>({})
  const retry = useRef<Retry | null>(null)
  const time = useRef(0)
  const voiceOn = useRef(true)

  const [scale, setScale] = useState(0.5)
  /** 全頁版時舞台在播放畫面裡置中的位移(px) */
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [now, setNow] = useState(0)
  /** 在子腳本裡時,主腳本停在哪裡(段落與指引用) */
  const [inSub, setInSub] = useState<number | null>(null)
  const [ask, setAsk] = useState<Ask | null>(null)
  const [rects, setRects] = useState<Record<string, Rect>>({})
  const [voice, setVoice] = useState(true)
  const [done, setDone] = useState(false)
  /** 停在互動點太久沒點,出現提示手指 */
  const [hint, setHint] = useState(false)
  /** 這段拖曳裡孩子開始拖過了沒(開始拖就收起提示,之後也不再出現;進到別的題目才重算) */
  const grabbed = useRef(false)

  // 全螢幕時段落選單要搬回播放器裡面(放在外面的話全螢幕看不到)
  const [nativeFull, setNativeFull] = useState(false)
  useEffect(() => {
    const on = () => setNativeFull(!!fsRef.current && document.fullscreenElement === fsRef.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  // iPhone 的 Safari 不能把頁面裡的元素放到全螢幕(只有影片可以):改成蓋滿整個視窗的「頁內全螢幕」,頁面不能捲動
  const [pageFull, setPageFull] = useState(false)
  useEffect(() => {
    if (!pageFull) return
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prev
    }
  }, [pageFull])
  const isFullscreen = nativeFull || pageFull
  /** 全螢幕時一律用全頁版的排法(舞台在剩下的空間裡等比例放到最大) */
  const fit = isFullscreen ? 'page' : layout

  const active = useCallback((): Stage | null => (sub.current ? subStage.current : stage.current), [])

  // 舞台縮放到容器寬度
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const ro = new ResizeObserver(() => {
      // 一般版跟著寬度縮放;全頁版在寬、高兩邊都放得下的最大倍率,置中
      const k = fit === 'page' ? Math.min(box.clientWidth / W, box.clientHeight / H) : box.clientWidth / W
      setScale(k)
      setOffset(fit === 'page' ? { x: (box.clientWidth - W * k) / 2, y: (box.clientHeight - H * k) / 2 } : { x: 0, y: 0 })
    })
    ro.observe(box)
    return () => ro.disconnect()
  }, [fit])

  const [guides, setGuides] = useState<Guide[]>(NO_GUIDES)

  const draw = useCallback(
    (ms: number) => {
      time.current = ms
      const st = active()
      st?.renderAt(ms)
      setNow(ms)
      // 說明框:找出這個時間點正在演、帶 guide 的步驟,量出目標在播放畫面上的實際位置。
      // 帶 guide 的步驟在載入時就列好了(Plan);這個時間點沒有說明框時不量版面
      const box = boxRef.current
      const plan = st && PLANS.get(st)
      const live = plan ? plan.guides.filter((x) => ms >= x.start && ms < x.end) : []
      if (!st || !box || !live.length) return setGuides((prev) => (prev.length ? NO_GUIDES : prev))
      const b = box.getBoundingClientRect()
      const found: Guide[] = []
      for (const { guide: g } of live) {
        const el = st.element(g.target)
        if (!el) continue
        const r = el.getBoundingClientRect()
        found.push({ text: g.text, rect: { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height } })
      }
      setGuides((prev) => (sameGuides(prev, found) ? prev : found))
    },
    [active],
  )

  // 播放畫面大小改變時重畫一次,說明框(頁面像素)才會跟著目標的新位置
  useEffect(() => {
    if (ready) draw(time.current)
  }, [scale, ready, draw])

  const reload = useCallback(async () => {
    const st = stage.current
    if (!st || !base.current) return
    await loadStage(st, expandAnswers(base.current, answers.current), mainVoice.current)
  }, [])

  // 載入腳本
  useEffect(() => {
    let alive = true
    stage.current = createStage(stageRef.current!)
    subStage.current = createStage(subRef.current!)
    loadScript(path)
      .then(async (sc) => {
        base.current = sc
        mainVoice.current = await loadVoice(path)
        moments.current = momentsOf(sc)
        subEntries.current = Object.fromEntries(
          sc.steps.flatMap((raw) => {
            const x = raw as { checkpoint?: string; sub?: string }
            return x.checkpoint && x.sub ? [[x.checkpoint, x.sub]] : []
          }),
        )
        await document.fonts?.ready
        await reload()
        if (!alive) return
        draw(0)
        setReady(true)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
      hush()
    }
  }, [path, reload, draw])

  // 停下來等孩子點時,量出各選項目標(與要聚焦的地方)在舞台上的位置
  useLayoutEffect(() => {
    const st = active()
    const root = sub.current ? subRef.current : stageRef.current
    if (!ask || !st || !root) return setRects({})
    const box = root.getBoundingClientRect()
    const k = box.width / W
    const found: Record<string, Rect> = {}
    // 拖曳時也要量可以拖的東西與每一個放置位置
    const dragRefs = ask.drag ? [...ask.drag.plan.items.map((x) => x.target), ...new Set(ask.drag.plan.items.flatMap((x) => ask.drag!.plan.slotsFor(x.id).map((d) => d.target)))] : []
    for (const ref of [ask.focus, ...ask.options.map((o) => o.target), ...dragRefs]) {
      const el = ref ? st.element(ref) : null
      if (!el || !ref) continue
      const r = el.getBoundingClientRect()
      found[ref] = { x: (r.left - box.left) / k, y: (r.top - box.top) / k, w: r.width / k, h: r.height / k }
    }
    setRects(found)
  }, [ask, scale, active])

  // 停下來等孩子點:念出題目;4 秒沒點就出現提示手指
  useEffect(() => {
    setHint(false)
    if (!ask) return
    // 題目有錄好的語音就念題目(畫面上的「再試一次」與說明不另外念);沒有就用瀏覽器的語音念整句
    if (voiceOn.current) {
      const url = VOICES.get(active()!)?.urls[ask.title]
      if (url) playClip(url)
      else speak(`${ask.again ? '再試一次。' : ''}${ask.title}${ask.body ? `。${ask.body}` : ''}`)
    }
    // 孩子在這段拖曳裡已經開始動手(拖過一次)就不再出現提示;不是拖曳的題目照常
    if (!ask.drag) grabbed.current = false
    const t = window.setTimeout(() => !grabbed.current && setHint(true), 4000)
    return () => window.clearTimeout(t)
  }, [ask])

  // 繼續播放:除了 playing,也遞增 run,讓時鐘的 effect 一定重新開始。
  // 時鐘在 tick 裡停下(例如子腳本演完)後又馬上要繼續時,playing 的 false→true 會被 React 合併成「沒變」,
  // effect 不會重跑,舊的 rAF 迴圈已經結束,時鐘就停住了。
  const [run, setRun] = useState(0)
  const resume = useCallback(() => {
    setPlaying(true)
    setRun((n) => n + 1)
  }, [])

  const pauseAt = useCallback(
    (ms: number, next: Ask | null) => {
      draw(ms)
      setPlaying(false)
      setAsk(next)
    },
    [draw],
  )

  // 非同步的操作(回答、點子腳本的可點區、進入子腳本)都要等舞台載入完。等待期間孩子可能又點了一次,
  // 或按了跳段、從頭開始:
  // - busy:同一時間只處理一個回答,連點的第二下不理
  // - gen:每次跳段、從頭開始、離開子腳本就加一;等待結束時 gen 變了,表示畫面已經換了,這次的結果丟掉不用
  const busy = useRef(false)
  const gen = useRef(0)
  /** 正在下載、載入子腳本:這段時間播放鍵沒有作用,時鐘也不會再進同一個子腳本 */
  const entering = useRef(false)
  const bump = () => {
    busy.current = false
    entering.current = false
    return ++gen.current
  }
  /** 等待中先處理一個回答;回傳 false 表示有別的回答還在處理(連點) */
  const take = (): boolean => {
    if (busy.current) return false
    busy.current = true
    return true
  }

  /** 換回主舞台的顯示(進入子腳本時直接改了 DOM 的 hidden,React 的 hidden 屬性沒變時不會改回來) */
  const showMain = () => {
    if (stageRef.current) stageRef.current.hidden = false
    if (subRef.current) subRef.current.hidden = true
  }

  // ── 主腳本的互動點 ──

  const answer = useCallback(
    async (moment: Moment, at: number, option: number) => {
      if (!take()) return
      const g = gen.current
      try {
        answers.current = { ...answers.current, [moment.id]: { option } }
        await reload()
      } finally {
        busy.current = false
      }
      if (g !== gen.current) return
      const st = stage.current!
      // 插進去的步驟演完的時間 = 互動點 + 多出來的長度
      retry.current = retries(moment, option) ? { id: moment.id, at: at + st.duration - plainDur.current[moment.id], from: at } : null
      setAsk(null)
      draw(at)
      resume()
    },
    [reload, draw, resume],
  )

  const askMoment = useCallback(
    (moment: Moment, at: number, again: boolean): Ask => ({
      title: moment.title,
      body: moment.body,
      again,
      focus: moment.stage?.focus,
      quiz: moment.options.some((o) => (o as { retry?: boolean }).retry),
      options: moment.options,
      pick: (i) => void answer(moment, at, i),
    }),
    [answer],
  )

  // ── 子腳本 ──

  const exitSub = useCallback(() => {
    const cur = sub.current
    if (!cur) return
    bump()
    hush()
    subsDone.current.add(cur.title)
    sub.current = null
    showMain()
    setInSub(null)
    setAsk(null)
    draw(cur.returnAt)
    resume()
  }, [draw, resume])

  /** 子腳本演完目前的步驟:條件達成就演結尾、回主腳本;還沒就停下來讓孩子點 */
  const subEnded = useCallback(async () => {
    const cur = sub.current
    if (!cur) return
    const st = subStage.current!
    let state: unknown
    try {
      state = actorState(cur)
    } catch (e) {
      return setError(e instanceof Error ? e.message : String(e))
    }
    if (reached(state, cur.interact.until)) {
      if (!cur.finished && cur.interact.done?.steps.length) {
        cur.finished = true
        const g = gen.current
        const from = st.duration
        cur.extra = [...cur.extra, ...cur.interact.done.steps]
        await loadStage(st, subSteps(cur), cur.voice)
        if (g !== gen.current) return
        draw(from)
        resume()
        return
      }
      return exitSub()
    }
    // 能點什麼、點了演什麼:子腳本有寫 spots 就照子腳本,沒寫才問演員的 hotspots
    const options: { label: string; target: string; id: string; steps: ScriptStep[] }[] = cur.interact.spots
      ? cur.interact.spots.map((p) => ({
          label: p.label ?? p.target,
          target: p.target,
          id: p.id ?? p.target,
          steps: cur.picked.has(p.id ?? p.target) && p.again ? p.again : p.steps,
        }))
      : ((cur.def.hotspots?.(state, cur.props) ?? []) as Hotspot[])
          .filter((h) => h.step)
          .map((h) => ({ label: h.label, target: `${cur.interact.on}:${h.target}`, id: h.target, steps: [h.step as ScriptStep] }))
    /** 把孩子做的操作接到子腳本後面,從原本的結尾接著播 */
    const perform = (steps: ScriptStep[], before?: () => void) =>
      void (async () => {
        if (!take()) return
        const g = gen.current
        const from = st.duration
        try {
          before?.()
          // 沒寫 on 的步驟交給互動的演員(子腳本有多個演員時才需要自己寫 on)
          cur.extra = [...cur.extra, ...steps.map((x) => ({ on: cur.interact.on, ...x }) as ScriptStep)]
          await loadStage(st, subSteps(cur), cur.voice)
        } catch (e) {
          return setError(e instanceof Error ? e.message : String(e))
        } finally {
          busy.current = false
        }
        if (g !== gen.current) return
        setAsk(null)
        draw(from)
        resume()
      })()
    // 拖曳(interact.drag):放下去演那一步操作;完成新的任務就念 say 裡那個任務的話,沒有就念 else
    const spec = cur.interact.drag
    const plan = spec ? dragPlan(cur.def.name, cur.interact.on, state) : null
    const drop = (step: ScriptStep) => {
      const kind = cur.def.kinds.find((k) => k in step)
      let said = spec?.else
      try {
        const after = kind ? (cur.def.apply!(state, kind, step) as { achieved?: string[] }) : null
        const before = (state as { achieved?: string[] }).achieved ?? []
        const fresh = after?.achieved?.find((id) => !before.includes(id))
        if (fresh && spec?.say?.[fresh]) said = spec.say[fresh]
      } catch {
        // 演員不接受這個操作:照樣交給舞台,載入時會顯示錯誤
      }
      perform([step, ...(said ? [{ wait: 300, narration: said } as ScriptStep] : [])])
    }
    pauseAt(st.duration, {
      title: cur.interact.prompt,
      body: cur.interact.body ?? '',
      again: false,
      quiz: false,
      options: plan ? [] : options,
      pick: (i) => perform(options[i].steps, () => cur.picked.add(options[i].id)),
      drag: plan ? { plan, drop } : undefined,
    })
  }, [draw, exitSub, pauseAt, resume])

  const enterSub = useCallback(
    async (title: string, file: string, at: number) => {
      pauseAt(at, null)
      const g = gen.current
      entering.current = true
      let script: SubScript
      let voice: ScriptVoice | null
      try {
        const [loaded, v] = await Promise.all([loadScript(file), loadVoice(file)])
        script = loaded as SubScript
        voice = v
      } finally {
        if (g === gen.current) entering.current = false
      }
      if (g !== gen.current) return
      const interact = script.interact
      if (!interact) throw new Error(`子腳本 ${file} 沒有 interact`)
      const cast = script.cast[interact.on]
      const def = cast && ACTORS[cast.actor]
      if (!def) throw new Error(`子腳本 ${file}:interact.on「${interact.on}」不在演員表裡`)
      sub.current = { title, script, interact, def, props: cast.props ?? {}, extra: [], picked: new Set(), returnAt: at, finished: false, voice }
      // 每次進到子腳本都重新算「拖過了沒」:跳回同一段或下一段拖曳時,停太久還是會出現提示
      grabbed.current = false
      // 先讓子舞台顯示出來再載入(載入時要量得到版面);React 下一次畫面也會是這樣
      stageRef.current!.hidden = true
      subRef.current!.hidden = false
      entering.current = true
      try {
        await loadStage(subStage.current!, subSteps(sub.current), sub.current.voice)
      } finally {
        if (g === gen.current) entering.current = false
      }
      // 載入期間跳段或從頭開始了:那邊已經把 sub 清掉、換回主舞台,這裡不再進去
      if (g !== gen.current) return
      setInSub(at)
      draw(0)
      resume()
    },
    [draw, pauseAt, resume],
  )

  // 時鐘:往前推進時間;經過還沒回答的互動點(或答錯要再試的地方)就停下來,經過子腳本入口就進去
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      const st = active()!
      const from = time.current
      const to = from + (t - last)
      last = t
      if (!sub.current) {
        const r = retry.current
        if (r && r.at > from && r.at <= to) {
          const m = moments.current.find((x) => x.id === r.id)!
          retry.current = null
          return pauseAt(r.at, askMoment(m, r.from, true))
        }
        // 含剛好停在互動點上(>=):用「下一段」跳到的段落開頭就是互動點時,也要進去。
        // 已經回答過、子腳本走完的互動點下面會略過,所以回到這個時間點不會再停一次
        const stop = st.stops.find((x) => x.at >= from && x.at <= to)
        const file = stop && subEntries.current[stop.title]
        if (stop && file && !subsDone.current.has(stop.title) && !entering.current) {
          return void enterSub(stop.title, file, stop.at).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
        }
        const m = stop && moments.current.find((x) => x.title === stop.title)
        if (stop && m && !answers.current[m.id]) {
          plainDur.current[m.id] = st.duration
          return pauseAt(stop.at, askMoment(m, stop.at, false))
        }
      }
      // 旁白:播放經過一段旁白的開頭就念出來(拖曳、跳段不念)
      if (voiceOn.current) {
        const n = st.narrations.find((x) => x.at > from && x.at <= to)
        if (n) sayOn(st, n.text)
      }
      if (to >= st.duration) {
        draw(st.duration)
        setPlaying(false)
        if (sub.current) void subEnded()
        else setDone(true)
        return
      }
      draw(to)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, run, active, draw, pauseAt, askMoment, enterSub, subEnded])

  const play = () => {
    if (ask || entering.current) return
    if (!sub.current && (done || time.current >= (stage.current?.duration ?? 0))) return restart()
    setPlaying((p) => !p)
    if (playing) hush()
  }

  const restart = async () => {
    const g = bump()
    setPlaying(false)
    hush()
    answers.current = {}
    retry.current = null
    plainDur.current = {}
    sub.current = null
    showMain()
    subsDone.current = new Set()
    setInSub(null)
    await reload()
    if (g !== gen.current) return
    setDone(false)
    setAsk(null)
    draw(0)
    resume()
  }

  // 上一段、下一段:跳到章節開頭;不能跳過還沒回答的互動點。在子腳本裡時,下一段 = 離開子腳本
  const mainNow = inSub ?? now
  const chapters = (stage.current?.chapters ?? []).filter((c) => c.label !== '你的回答')
  const curChapter = chapters.reduce((k, c, i) => (c.at <= mainNow + 1 ? i : k), 0)
  const firstOpen = (): number => {
    const st = stage.current
    if (!st) return 0
    // 子腳本可以跳過(不改主腳本的演員狀態);還沒回答的題目不能跳過
    const stop = st.stops.find((x) => {
      const m = moments.current.find((y) => y.title === x.title)
      return m && !answers.current[m.id]
    })
    return stop ? stop.at : st.duration
  }
  // 不鎖段落(freeJump):隨時都能跳到任何一段,在子腳本裡、停在題目上也可以。
  // 跳到的段落之後的回答都收回(重新載入主腳本),跳回題目時會重新問。
  // 研發用的時間軸:拉到主腳本的任何時間點。原本在播放就從那裡繼續播,原本暫停就停在那裡。
  // 在子腳本裡就先離開;那個時間點之後的回答都收回,經過的子腳本入口算走過,剛好停在入口上會在按播放時進去
  const seekTo = async (ms: number) => {
    // 停在子腳本裡等孩子操作時 playing 是 false,算暫停
    const wasPlaying = playing
    const g = bump()
    setPlaying(false)
    hush()
    retry.current = null
    setDone(false)
    setAsk(null)
    if (sub.current) {
      sub.current = null
      showMain()
      setInSub(null)
    }
    const st = stage.current!
    const later = new Set(st.stops.filter((x) => x.at >= ms).map((x) => x.title))
    const kept = Object.fromEntries(Object.entries(answers.current).filter(([id]) => !later.has(moments.current.find((m) => m.id === id)?.title ?? '')))
    if (Object.keys(kept).length !== Object.keys(answers.current).length) {
      answers.current = kept
      await reload()
      if (g !== gen.current) return
    }
    for (const x of st.stops) {
      if (!subEntries.current[x.title]) continue
      if (x.at < ms) subsDone.current.add(x.title)
      else subsDone.current.delete(x.title)
    }
    draw(Math.max(0, Math.min(ms, st.duration)))
    if (wasPlaying) resume()
  }

  const jumpFree = async (i: number) => {
    const target = chapters[i]
    if (!target) return
    const g = bump()
    setPlaying(false)
    hush()
    retry.current = null
    setDone(false)
    setAsk(null)
    if (sub.current) {
      sub.current = null
      showMain()
      setInSub(null)
    }
    const st = stage.current!
    const later = new Set(st.stops.filter((x) => x.at >= target.at).map((x) => x.title))
    answers.current = Object.fromEntries(Object.entries(answers.current).filter(([id]) => !later.has(moments.current.find((m) => m.id === id)?.title ?? '')))
    await reload()
    if (g !== gen.current) return
    // 收回回答後時間軸變了,用段落名稱重新找時間
    const to = st.chapters.find((c) => c.label === target.label)?.at ?? target.at
    for (const x of st.stops) {
      if (!subEntries.current[x.title]) continue
      if (x.at < to) subsDone.current.add(x.title)
      else subsDone.current.delete(x.title)
    }
    draw(to)
    resume()
  }

  const jump = async (i: number) => {
    if (freeJump) return jumpFree(i)
    if (sub.current) return i > curChapter ? exitSub() : undefined
    if (ask || i < 0 || i >= chapters.length) return
    const g = bump()
    hush()
    setDone(false)
    // 答錯、還沒重問就跳走:收回那個錯的回答,這題之後照樣會問(不然會被當成答過,永遠跳過)
    const pending = retry.current
    retry.current = null
    if (pending) {
      setPlaying(false)
      const { [pending.id]: _wrong, ...rest } = answers.current
      answers.current = rest
      await reload()
      if (g !== gen.current) return
    }
    const to = Math.min(chapters[i].at, firstOpen())
    // 跳過去的路上經過的子腳本入口算走過了,播放時不會再進去;剛好跳到入口(to)就照常進去
    // (之前走過的子腳本,點它的段落再跳回來時重新進去)
    for (const x of stage.current?.stops ?? []) {
      if (!subEntries.current[x.title]) continue
      if (x.at < to) subsDone.current.add(x.title)
      else if (x.at === to) subsDone.current.delete(x.title)
    }
    draw(to)
    // 跳過去就開始播:段落開頭是子腳本入口時馬上切換過去,是題目時馬上停下來問
    resume()
  }

  const toggleVoice = () => {
    voiceOn.current = !voice
    setVoice(!voice)
    if (voice) hush()
  }

  const fullscreen = () => {
    const el = fsRef.current
    if (!el) return
    if (pageFull) return setPageFull(false)
    if (document.fullscreenElement) return void document.exitFullscreen()
    // 支援元素全螢幕就用瀏覽器的全螢幕;不支援(iPhone)或被拒絕時改用頁內全螢幕
    if (el.requestFullscreen && document.fullscreenEnabled) void el.requestFullscreen().catch(() => setPageFull(true))
    else setPageFull(true)
  }

  // 提示手指指哪裡:有正確答案的題目只指要點的區域,不洩漏答案;自由探索指第一個選項
  // 題目(有正確答案)不用手指指某一塊,免得看起來像在暗示答案:改成在作答區上緣放提示、所有選項一起閃
  const hintAt = (() => {
    if (!ask) return null
    const ref = ask.quiz ? ask.focus : ask.drag ? ask.drag.plan.items.find((x) => rects[x.target])?.target : ask.options.find((o) => o.target && rects[o.target])?.target
    const r = ref ? rects[ref] : undefined
    if (!r) return null
    return ask.quiz ? { x: r.x + r.w / 2, y: r.y + 8, quiz: true } : { x: r.x + r.w / 2, y: r.y + r.h / 2, quiz: false }
  })()

  // 集星星:在子腳本裡、有 until 時,依目前時間的演員狀態顯示在上方指引的右邊。
  // 演員狀態只在「已經開始的步驟」變了才會變:開始了幾步(started)沒變就沿用上次算的,不用每一格畫面從 init 重演一遍
  const cur = sub.current
  const subPlan = cur && subStage.current ? PLANS.get(subStage.current) : undefined
  const started = subPlan ? subPlan.starts.reduce((n, x) => (x <= now ? n + 1 : n), 0) : 0
  const stars = useMemo(() => {
    const until = cur?.interact.until
    if (!cur || !until || !subPlan) return null
    // 演員狀態算不出來(演員沒有 init/apply、步驟不合法)時不顯示星星,不讓整個頁面因為畫面更新丟錯而當掉
    try {
      return { got: Math.min(countOf(actorState(cur, { starts: subPlan.starts, ms: now }), until), until.atLeast), of: until.atLeast }
    } catch {
      return null
    }
    // now 只透過 started 影響結果:開始的步驟一樣時,演員狀態一樣
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, subPlan, started])

  // 目前的字幕:一段旁白切成幾小句(照標點切,每句最多約 CAPTION_MAX 個字),照字數分配這段旁白的時間,一次只出現一小句
  const st = sub.current ? subStage.current : stage.current
  const narration = (() => {
    if (!st || ask) return ''
    const list = st.narrations
    const idx = list.reduce((k, n, i) => (n.at <= now ? i : k), -1)
    if (idx < 0) return ''
    const n = list[idx]
    const end = Math.max(...st.captions.filter((c) => c.from >= n.at - 1 && (idx + 1 >= list.length || c.from < list[idx + 1].at)).map((c) => c.to), n.at)
    if (now > end) return ''
    const parts = captionParts(n.text)
    const total = parts.reduce((s, p) => s + units(p).length, 0) || 1
    let at = n.at
    for (const p of parts) {
      at += ((end - n.at) * units(p).length) / total
      if (now < at) return p
    }
    return parts[parts.length - 1]
  })()

  const menuOutside = !!chaptersSlot && !isFullscreen
  // 段落按鈕鎖住:停在題目上、在子腳本裡時不能跳(freeJump 時都不鎖)
  const locked = !freeJump && (!!ask || inSub !== null)
  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
  const total = stage.current?.duration ?? 0
  const controls = (
    <div className={s.controlsBox} data-size={size}>
      <div className={s.controls}>
        <button type="button" onClick={() => void jump(curChapter - 1)} disabled={!ready || locked || curChapter === 0}>
          ⏮ 上一段
        </button>
        <button type="button" className={s.primary} onClick={play} disabled={!ready || !!ask}>
          {playing ? '⏸ 暫停' : done ? '↺ 再看一次' : '▶ 播放'}
        </button>
        <button type="button" onClick={() => void jump(curChapter + 1)} disabled={!ready || (freeJump ? curChapter >= chapters.length - 1 : (!!ask && inSub === null) || (inSub === null && curChapter >= chapters.length - 1))}>
          下一段 ⏭
        </button>
        <button type="button" onClick={() => void restart()} disabled={!ready}>
          ↺ 從頭開始
        </button>
        <button type="button" className={s.icon} aria-pressed={voice} aria-label={voice ? '旁白開' : '旁白關'} title={voice ? '旁白開' : '旁白關'} onClick={toggleVoice}>
          {voice ? '🔊' : '🔇'}
        </button>
        <button type="button" aria-pressed={isFullscreen} onClick={fullscreen}>
          {isFullscreen ? '✕ 離開全螢幕' : '⛶ 全螢幕'}
        </button>
      </div>

      {scrub && ready && (
        <label className={s.scrub}>
          <span>{fmt(mainNow)}</span>
          <input type="range" min={0} max={Math.round(total)} step={100} value={Math.round(mainNow)} aria-label="拉到要看的地方" onChange={(e) => void seekTo(Number(e.target.value))} />
          <span>{fmt(total)}</span>
        </label>
      )}
      {!menuOutside && (
        <ol className={s.chapters} aria-label="段落">
          {chapters.map((c, i) => (
            <li key={c.at} aria-current={i === curChapter ? 'step' : undefined}>
              <button type="button" onClick={() => void jump(i)} disabled={!ready || locked}>
                <span>{i + 1}</span>
                {c.label}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )

  // 段落選單放在播放器外面(chaptersSlot)時:一段一列,附上說明與「可互動」標籤,樣式融入外面的版面
  const menu = (
    <ol className={s.menu} aria-label="段落">
      {chapters.map((c, i) => {
        const info = chapterInfo?.[c.label]
        return (
          <li key={c.at} aria-current={i === curChapter ? 'step' : undefined}>
            <button type="button" onClick={() => void jump(i)} disabled={!ready || locked}>
              <span className={s.menuNo}>{i + 1}</span>
              <span className={s.menuText}>
                <strong>
                  {c.label}
                  {info?.interactive && <em className={s.menuTag}>可互動</em>}
                </strong>
                {info?.note && <small>{info.note}</small>}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )

  return (
    <div className={s.player} ref={fsRef} data-size={size} data-layout={fit} data-float={floating && fit === 'page' ? 'true' : undefined} data-full={pageFull ? 'page' : nativeFull ? 'native' : undefined} data-ready={ready ? 'true' : 'false'}>
      {/* 上方的指引一直都在(高度固定),只換內容:停下來等孩子點時是題目,其他時候說現在在做什麼 */}
      <p className={s.ask} data-asking={ask ? 'true' : 'false'} data-stars={stars ? 'true' : 'false'} role="status">
        {stars && (
          <span className={s.stars} aria-label={`找到 ${stars.got} / ${stars.of}`}>
            {Array.from({ length: stars.of }, (_, i) => (
              <Star key={i} on={i < stars.got} />
            ))}
          </span>
        )}
        {ask ? (
          <>
            👉 {ask.again ? '再試一次：' : ''}
            {ask.title}
            <small>{ask.body || ' '}</small>
          </>
        ) : (
          <>
            {/* 還沒開始時不寫「按播放開始」(畫面中間已經有大播放鍵),直接顯示第一段 */}
            {done ? '🎉 看完了！' : `${playing || (now === 0 && inSub === null) ? '👀' : '⏸'} ${chapters[curChapter]?.label ?? ''}`}
            <small>{done ? '可以按「再看一次」，或回到前面的段落。' : playing || now === 0 ? '先看，等一下換你動手。' : '按播放繼續。'}</small>
          </>
        )}
      </p>
      <div className={s.box} ref={boxRef} style={fit === 'page' ? undefined : { height: H * scale }} data-sub={inSub !== null ? 'true' : 'false'}>
        <div className={s.scaler} style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}>
          <div ref={stageRef} className={s.stage} hidden={inSub !== null} />
          <div ref={subRef} className={s.stage} hidden={inSub === null} />
          {ask && (
            <div className={s.hits} data-nudge={hint && ask.quiz ? 'true' : 'false'}>
              {ask.options.map((o, i) => {
                const r = o.target ? rects[o.target] : undefined
                if (!r) return null
                return (
                  <button
                    key={i}
                    type="button"
                    className={s.hit}
                    aria-label={o.label}
                    title={o.label}
                    style={{ left: r.x - 14, top: r.y - 14, width: r.w + 28, height: r.h + 28 }}
                    onClick={() => ask.pick(i)}
                  />
                )
              })}
              {ask.drag && (
                <DragLayer
                  onGrab={() => {
                    grabbed.current = true
                    setHint(false)
                  }}
                  drag={ask.drag}
                  rects={rects}
                  elementOf={(target) => active()?.element(target) ?? null}
                  toStage={(cx, cy) => {
                    const r = (sub.current ? subRef.current : stageRef.current)!.getBoundingClientRect()
                    const k = r.width / W
                    return { x: (cx - r.left) / k, y: (cy - r.top) / k }
                  }}
                />
              )}
              {/* 沒有對應演員目標的選項(例如是非題):在舞台下方排成一列大按鈕 */}
              {ask.options.some((o) => !o.target) && (
                <div className={s.choices} data-nudge={hint ? 'true' : 'false'}>
                  {ask.options.map((o, i) =>
                    o.target ? null : (
                      <button key={i} type="button" className={s.choice} onClick={() => ask.pick(i)}>
                        <Say text={o.label} />
                      </button>
                    ),
                  )}
                </div>
              )}
              {hint && hintAt && !hintAt.quiz && (
                <span className={s.hand} style={{ left: hintAt.x, top: hintAt.y }} aria-hidden="true">
                  👆<em>{ask.drag ? '按住拉動這裡' : '點這裡試試看'}</em>
                </span>
              )}
              {hint && hintAt?.quiz && (
                <span className={s.quizHint} style={{ left: hintAt.x, top: hintAt.y }} aria-hidden="true">
                  點一塊你覺得對的積木
                </span>
              )}
            </div>
          )}
          {!playing && !ask && ready && (
            <button type="button" className={s.bigPlay} aria-label={done ? '再看一次' : '播放'} onClick={play}>
              {done ? '↺' : '▶'}
            </button>
          )}
        </div>
        {/* 說明框畫在縮放層外面(頁面的實際像素):字的大小固定,位置跟著量到的目標走 */}
        {!ask && guides.length > 0 && (
          <div className={s.guides} aria-live="polite">
            {guides.map((g, i) => (
              <div key={`${i}:${g.text}`}>
                {/* 外框比目標四周各大 RING px,位置與大小都直接算好(不靠 margin/padding,盒模型不同時才不會偏) */}
                <span className={s.ring} style={{ left: g.rect.x - RING, top: g.rect.y - RING, width: g.rect.w + RING * 2, height: g.rect.h + RING * 2 }} />
                <GuideBubble guide={g} box={{ w: boxRef.current?.clientWidth ?? 0, h: boxRef.current?.clientHeight ?? 0 }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <p className={s.error}>腳本有錯：{error}</p>
      ) : (
        <p className={s.say} aria-live="polite">
          <Say text={narration} />
        </p>
      )}

      {controls}
      {chaptersSlot && menuOutside ? createPortal(menu, chaptersSlot) : null}
    </div>
  )
}
