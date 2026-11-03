// macbook 演員的純計算:鍵盤配置、字元對應按鍵、打字的按鍵時間表、開蓋角度、狀態推算與視角。
// 全部是純函式(沒有 DOM、沒有時鐘、沒有 Math.random),給 actor.ts 畫面使用,也方便單元測試。
// 亂數一律用 kit.rand(字串種子),同一段文字永遠按同一串鍵,拖曳、倒轉、逐格截圖都一樣。
import { kit } from '../../kit'

// ---------- 鍵盤配置 ----------

/** 一個鍵:x、y、w、h 的單位是「鍵距」(1 = 一般字母鍵的寬度) */
export interface KeySpec {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  /** 字母、數字、符號鍵(打字時會用到) */
  main: boolean
}

/** 每列:[id, 顯示的淡淡符號, 寬度];列高(鍵距)依列而定 */
type RowDef = { h: number; keys: [id: string, label: string, w: number][] }

const lowerRow = (ids: string, first: [string, string, number][], last: [string, string, number][]): [string, string, number][] => [
  ...first,
  ...[...ids].map((c): [string, string, number] => [c, c.toUpperCase(), 1]),
  ...last,
]

const ROWS: RowDef[] = [
  {
    h: 0.66,
    keys: [
      ['esc', 'esc', 1.5],
      ...Array.from({ length: 12 }, (_, i): [string, string, number] => [`f${i + 1}`, `F${i + 1}`, 1]),
      ['power', '', 1.5],
    ],
  },
  { h: 1, keys: lowerRow('1234567890-=', [['`', '~', 1]], [['delete', '⌫', 2]]) },
  { h: 1, keys: lowerRow('qwertyuiop[]', [['tab', '⇥', 1.5]], [['\\', '\\', 1.5]]) },
  { h: 1, keys: lowerRow("asdfghjkl;'", [['caps', '', 1.75]], [['return', '⏎', 2.25]]) },
  { h: 1, keys: lowerRow('zxcvbnm,./', [['shiftL', '⇧', 2.25]], [['shiftR', '⇧', 2.75]]) },
  {
    h: 1,
    keys: [
      ['fn', 'fn', 1],
      ['ctrl', '⌃', 1],
      ['optL', '⌥', 1],
      ['cmdL', '⌘', 1.25],
      [' ', '', 5.5],
      ['cmdR', '⌘', 1.25],
      ['optR', '⌥', 1],
    ],
  },
]

/** 鍵盤總寬(鍵距) */
export const KB_W = 15
/** 鍵盤總高(鍵距):功能鍵列 0.66 + 五列 */
export const KB_H = 0.66 + 5

/** 整個鍵盤的所有按鍵(含方向鍵):位置以鍵距表示,左上角為 (0, 0) */
export function buildKeys(): KeySpec[] {
  const out: KeySpec[] = []
  let y = 0
  ROWS.forEach((row, r) => {
    let x = 0
    for (const [id, label, w] of row.keys) {
      out.push({ id, label, x, y, w, h: row.h, main: r > 0 && r < 5 && w <= 1 })
      x += w
    }
    y += row.h
  })
  // 方向鍵:左右各一個全高,上下各半高疊在中間(接在最後一列右側,共 3 鍵距寬)
  const by = KB_H - 1
  out.push({ id: 'left', label: '◀', x: 12, y: by, w: 1, h: 1, main: false })
  out.push({ id: 'up', label: '▲', x: 13, y: by, w: 1, h: 0.5, main: false })
  out.push({ id: 'down', label: '▼', x: 13, y: by + 0.5, w: 1, h: 0.5, main: false })
  out.push({ id: 'right', label: '▶', x: 14, y: by, w: 1, h: 1, main: false })
  return out
}

const KEYS: KeySpec[] = buildKeys()
export const KEY_SPECS: readonly KeySpec[] = KEYS
const KEY_BY_ID: ReadonlyMap<string, KeySpec> = new Map(KEYS.map((k) => [k.id, k]))
/** 字母、數字、符號鍵的 id(隨機打字從這裡挑) */
export const MAIN_KEY_IDS: readonly string[] = KEYS.filter((k) => k.main && k.id.length === 1).map((k) => k.id)

/** 需要 Shift 才打得出來的符號 → 底下的那個鍵 */
const SHIFTED: Record<string, string> = { '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', _: '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`' }

/** 字元對應的鍵:英數與符號有自己的鍵,空白是空白鍵,換行是 return;其他(中文…)回傳 null */
export function keyForChar(ch: string): string | null {
  if (ch === ' ') return ' '
  if (ch === '\n') return 'return'
  const low = ch.toLowerCase()
  const base = SHIFTED[ch] ?? low
  return KEY_BY_ID.has(base) && base.length === 1 ? base : null
}

// ---------- 打字 ----------

export interface TypeStep {
  /** 要打的字(英數字照鍵位按;其他字按隨機但固定的字母鍵) */
  type?: unknown
  /** 沒有文字時,指定按幾個鍵 */
  keys?: unknown
  /** 每秒幾下(預設 7) */
  cps?: unknown
}
export interface Stroke {
  key: string
  /** 按下的時間(相對動作開始,毫秒) */
  at: number
  /** 按下去再放開的長度 */
  dur: number
}
export const PRESS_MS = 130
export const TYPE_LEAD = 350
export const TYPE_TAIL = 450
const DEFAULT_CPS = 7

/** 打字的按鍵時間表:節奏有固定亂數造成的快慢(±30%),每個字元一個鍵(空白也算) */
export function strokesOf(step: TypeStep): Stroke[] {
  const cps = typeof step.cps === 'number' && step.cps > 0 ? step.cps : DEFAULT_CPS
  const base = 1000 / cps
  const text = typeof step.type === 'string' ? step.type : null
  const n = text !== null ? [...text].length : Math.max(0, Math.floor(Number(step.keys) || 0))
  const seed = text !== null ? `type:${text}` : `keys:${n}`
  const rnd = kit.rand(seed)
  const chars = text !== null ? [...text] : []
  const out: Stroke[] = []
  let at = TYPE_LEAD
  for (let i = 0; i < n; i++) {
    const r = rnd()
    const pick = rnd()
    const key = (text !== null ? keyForChar(chars[i]) : null) ?? MAIN_KEY_IDS[Math.floor(pick * MAIN_KEY_IDS.length)]
    out.push({ key, at, dur: PRESS_MS })
    // 空白後略停一下,像真的在換字
    at += base * (0.7 + r * 0.6) * (key === ' ' ? 1.25 : 1)
  }
  return out
}

/** 打字動作的總長度 */
export function typeDuration(step: TypeStep): number {
  const s = strokesOf(step)
  return s.length ? s[s.length - 1].at + PRESS_MS + TYPE_TAIL : TYPE_LEAD + TYPE_TAIL
}

/** 一次按鍵的下沉量 0–1:快速按下、慢慢彈回 */
export function pressEnvelope(local: number, s: Stroke): number {
  const t = local - s.at
  if (t < 0 || t >= s.dur) return 0
  const p = t / s.dur
  return p < 0.3 ? kit.ease.outQuad(p / 0.3) : 1 - kit.ease.inOutQuad((p - 0.3) / 0.7)
}
/** 按過之後鍵帽的餘光 0–1(按下後約 0.5 秒淡去) */
export function glowEnvelope(local: number, s: Stroke): number {
  const t = local - s.at
  if (t < 0 || t > 520) return 0
  return t < 40 ? t / 40 : 1 - kit.ease.outQuad((t - 40) / 480)
}
/** local 時各鍵的 { 下沉, 餘光 }(只含有值的鍵) */
export function keyLevels(strokes: readonly Stroke[], local: number): Map<string, { press: number; glow: number }> {
  const out = new Map<string, { press: number; glow: number }>()
  for (const s of strokes) {
    if (s.at > local) break
    const press = pressEnvelope(local, s)
    const glow = glowEnvelope(local, s)
    if (press <= 0 && glow <= 0) continue
    const cur = out.get(s.key) ?? { press: 0, glow: 0 }
    out.set(s.key, { press: Math.max(cur.press, press), glow: Math.max(cur.glow, glow) })
  }
  return out
}

// ---------- 狀態 ----------

export const DEFAULT_ANGLE = 105
export const MIN_ANGLE = 90
export const MAX_ANGLE = 135
export interface MbState {
  opened: boolean
  awake: boolean
  /** 開蓋角度(度),只在 opened 時有意義 */
  angle: number
  /** 俯視角(度)、水平旋轉(度) */
  pitch: number
  yaw: number
}

export const PITCH_RANGE = [0, 70] as const
export const YAW_RANGE = [-60, 60] as const

export type MbKind = 'open' | 'close' | 'wake' | 'sleep' | 'type' | 'tilt'
export interface TiltSpec {
  pitch?: unknown
  yaw?: unknown
}
export interface MbStep {
  open?: unknown
  angle?: unknown
  close?: unknown
  wake?: unknown
  sleep?: unknown
  type?: unknown
  keys?: unknown
  cps?: unknown
  tilt?: unknown
}

const inRange = (v: unknown, [a, b]: readonly [number, number]): v is number => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b

export function parseTilt(v: unknown): { pitch?: number; yaw?: number } {
  if (typeof v !== 'object' || v === null) throw new Error('tilt 要寫成 { "pitch": 度數, "yaw": 度數 }(至少一個)')
  const t = v as TiltSpec
  const out: { pitch?: number; yaw?: number } = {}
  if (t.pitch !== undefined) {
    if (!inRange(t.pitch, PITCH_RANGE)) throw new Error(`tilt.pitch 要在 ${PITCH_RANGE[0]}–${PITCH_RANGE[1]} 度之間`)
    out.pitch = t.pitch
  }
  if (t.yaw !== undefined) {
    if (!inRange(t.yaw, YAW_RANGE)) throw new Error(`tilt.yaw 要在 ${YAW_RANGE[0]}–${YAW_RANGE[1]} 度之間`)
    out.yaw = t.yaw
  }
  if (out.pitch === undefined && out.yaw === undefined) throw new Error('tilt 至少要有 pitch 或 yaw')
  return out
}

/** 套用一個動作(純函式);操作對不上狀態時丟錯 */
export function applyMb(st: MbState, kind: MbKind, step: MbStep): MbState {
  switch (kind) {
    case 'open': {
      if (st.opened) throw new Error('open:已經開蓋了')
      const angle = step.angle === undefined ? DEFAULT_ANGLE : step.angle
      if (!inRange(angle, [MIN_ANGLE, MAX_ANGLE])) throw new Error(`open 的 angle 要在 ${MIN_ANGLE}–${MAX_ANGLE} 度之間`)
      return { ...st, opened: true, angle }
    }
    case 'close':
      if (!st.opened) throw new Error('close:已經闔上了')
      return { ...st, opened: false, awake: false }
    case 'wake':
      if (!st.opened) throw new Error('wake:要先 open 開蓋才能亮螢幕')
      if (st.awake) throw new Error('wake:螢幕已經亮著')
      return { ...st, awake: true }
    case 'sleep':
      if (!st.awake) throw new Error('sleep:螢幕本來就是熄的')
      return { ...st, awake: false }
    case 'type': {
      if (!st.opened) throw new Error('type:要先 open 開蓋才能打字')
      const text = typeof step.type === 'string' ? step.type : null
      if (text === null && !(Number(step.keys) >= 1)) throw new Error('type 要給文字,或用 keys 指定按幾個鍵')
      if (text !== null && !text) throw new Error('type 的文字不能是空的')
      return st
    }
    case 'tilt':
      return { ...st, ...parseTilt(step.tilt) }
  }
}

/** 開蓋角度(度):from → to 依進度 p 緩動;0 = 閉合 */
export function lidAngleAt(from: number, to: number, p: number, ease: (p: number) => number = kit.ease.inOutCubic): number {
  return kit.lerp(from, to, ease(kit.clamp(p)))
}
/** 狀態的有效開蓋角度 */
export const lidOf = (st: MbState): number => (st.opened ? st.angle : 0)

/** 開蓋的程度 0–1(0 = 闔上、1 = 已經是使用角度),用來移動機身位置與陰影 */
export const openness = (angle: number): number => kit.clamp(angle / DEFAULT_ANGLE)

export const DUR = { open: 1700, close: 1300, wake: 900, sleep: 600, tilt: 2400 } as const

export function durationOf(kind: MbKind, step: MbStep): number {
  if (kind === 'type') return typeDuration(step)
  return DUR[kind]
}
