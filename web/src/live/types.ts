// types.ts — 即時教學畫面引擎共用的型別:腳本格式、演員介面、舞台與演員之間傳遞的資料。
// 規格見 README.md「舞台與演員」。演員一律用 defineActor 宣告,缺少必要成員或型別不符時 tsc 會報錯。
import type { Point, Rect } from './kit'

// ---------- 腳本(JSON) ----------

export type PlaceName = 'window' | 'full' | 'left' | 'right' | 'center'
/** 舞台方向:landscape 是 1920×1080、portrait 是 1080×1920(方向是播放時的參數,不寫在腳本裡,同一支腳本兩種方向都能播) */
export type Aspect = 'landscape' | 'portrait'
/** 單一方向的位置:名稱,或畫布的 px / "50%" 這種百分比(百分比相對於該方向的畫布;h 可省略,依內容高度) */
export type PlaceBase = PlaceName | { x?: number | string; y?: number | string; w?: number | string; h?: number | string | null }
/** 位置:同一個寫法兩種方向共用,或 { landscape, portrait } 各寫一種(缺的方向沿用另一個) */
export type PlaceSpec = PlaceBase | { landscape?: PlaceBase; portrait?: PlaceBase }
export type Place = { x: number; y: number; w: number; h: number | null }

/** 演員表的一筆:代號 → 演員與登場設定 */
export interface CastEntry {
  actor: string
  props?: Record<string, unknown>
  place?: PlaceSpec
  hidden?: boolean
}

/** 目標:「演員代號:目標名稱」,只寫代號表示整個演員 */
export type TargetRef = string
/** 鏡頭:推近目標(可指定倍率);false 拉回全景 */
export type FocusSpec = false | TargetRef | { target: TargetRef; zoom?: number }

/** 每一步都能加的欄位(用 type 而不是 interface:型別別名才有隱含的索引簽章,各演員的步驟才能和寬鬆的 Step 互相轉換) */
export type CommonStepFields = {
  narration?: string
  chapter?: string
  lessonStep?: number
  /** 覆寫這一步的長度(毫秒) */
  ms?: number
  /** 這一步之後的停頓(預設 250) */
  pause?: number
  focus?: FocusSpec
  /** 有多個演員都會這個動作時,指定由誰演 */
  on?: string
}

/** 舞台自己的動作 */
export type StageStep = CommonStepFields &
  (
    | { card: string; eyebrow?: string; sub?: string }
    | { callout: TargetRef; text?: string }
    | { show: string; [action: string]: unknown }
    | { hide: string; [action: string]: unknown }
    | { move: string; to: PlaceSpec }
    | { checkpoint: string; body?: string }
    | { wait: number }
  )
export type StageKind = 'card' | 'callout' | 'show' | 'hide' | 'move' | 'checkpoint' | 'wait'
export type StageStepOf<K extends StageKind> = Extract<StageStep, Record<K, unknown>>

/** 演員的動作:鍵名就是動作種類,其餘欄位依演員而定 */
export type ActorStepLoose = CommonStepFields & { [action: string]: unknown }
export type ScriptStep = StageStep | ActorStepLoose

/** 舞台腳本(JSON) */
export interface StageScript {
  title: string
  lesson?: string
  camera?: 'auto'
  cast: Record<string, CastEntry>
  steps: ScriptStep[]
}

// ---------- 舞台 → 演員 ----------

/** 演員拿到的「已經開始的動作」:local 是這個動作開始後的毫秒、p 是進度 0–1 */
export interface ActorEvent<S = ActorStepLoose, K extends string = string> {
  kind: K
  step: S
  start: number
  dur: number
  local: number
  p: number
}

/** 有狀態的演員:最後一個已經開始的動作決定 prev/state;還在進行中就帶上 ev */
export interface ActorView<St> {
  state: St
  prev: St
  ev: ActorEvent | null
}
/** 一格畫面交給演員的資料:events 是屬於它、已經開始的動作;view 只有有狀態的演員才有 */
export interface ActorFrame<St = undefined> {
  events: ActorEvent[]
  view: ActorView<St> | null
}

/** 虛擬滑鼠:要移動的時間表(時間相對於動作開始),最後一點到達後點擊 */
export interface CursorPlan {
  moves: { at: number; target: string }[]
  clickAt: number
}

/** 鏡頭提示點:at 是相對於動作開始的毫秒;target 同 autoFocus 的回傳值 */
export interface Cue<T extends string = string> {
  at?: number
  target: T | false | undefined
}

// ---------- 演員介面 ----------

export interface ActorInstance<St = undefined> {
  /** 畫出 ms 時的畫面(只用 frame 與 ms 決定,不依賴上一次) */
  render(frame: ActorFrame<St>, ms: number): void
  /** 目標名稱 → 元素(給鏡頭、聚光燈、滑鼠用);找不到回傳 null */
  target(name: string, view: ActorView<St> | null): HTMLElement | null
}

/**
 * 演員:只負責「自己長什麼樣、每個動作畫成什麼樣子」。
 * K 是動作種類、S 是步驟、P 是登場設定、St 是狀態(無狀態的演員是 undefined)、T 是目標名稱。
 * 用 method 語法宣告,讓登記表可以放不同型別的演員。
 */
export interface Actor<K extends string = string, S extends object = object, P extends object = object, St = undefined, T extends string = string> {
  readonly name: string
  readonly kinds: readonly K[]
  /** 這個動作要多久(毫秒) */
  duration(kind: K, step: S, props: P, prev: St | undefined): number
  /** camera 為 auto 時建議看哪裡;false = 全景,undefined = 沿用上一個鏡頭 */
  autoFocus?(kind: K, step: S): T | false | undefined
  /** 一個動作需要多次運鏡時才寫(有 cues 就不用 autoFocus) */
  cues?(kind: K, step: S): Cue<T>[]
  /** 需要虛擬滑鼠的動作回傳時間表 */
  cursor?(kind: K, step: S, prev: St | undefined): CursorPlan | null
  /** 有狀態的演員:起始狀態(props 不合法就丟錯) */
  init?(props: P): St
  /** 有狀態的演員:純函式,回傳新狀態;操作對不上狀態時丟錯 */
  apply?(state: St, kind: K, step: S): St
  mount(root: HTMLElement, props: P): ActorInstance<St>
}

/** 宣告一個演員:只做型別檢查與推論,不改內容 */
export function defineActor<K extends string, S extends object, P extends object, St = undefined, T extends string = string>(
  actor: Actor<K, S, P, St, T>,
): Actor<K, S, P, St, T> {
  return actor
}

/** 登記表裡的演員(各自的型別被抹掉;method 語法讓具體的演員可以放進來) */
export type AnyActor = Actor<string, object, object, unknown, string>

// ---------- 舞台 → 外殼 ----------

/** 章節;step 是腳本裡標的 lessonStep(對應課程的第幾步) */
export type StageChapter = { at: number; label: string; step?: number }
export type StageCaption = { from: number; to: number; text: string }
export type StageStop = { at: number; title: string; body: string }
export type StageNarration = { at: number; text: string }

/** 鏡頭關鍵點:從 at 開始過渡到 target(null 是全景)。auto 表示由演員建議(不是腳本明寫) */
export type CameraKey = { at: number; target: string | null; zoom: number; auto: boolean }

export type { Point, Rect }

// 開發時引擎的程式一改就整頁重新載入:舞台、外殼、演員是掛上去就一直在跑的物件,不是 React 元件,
// 交給 LivePlayer 熱更新的話它的 effect 不會重跑,畫面仍是舊程式建出來的舊物件,看起來像沒有熱重載。
// 必須直接寫 import.meta.hot.accept(Vite 靠這段文字判斷模組會自己處理更新,包成函式它就認不得)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
