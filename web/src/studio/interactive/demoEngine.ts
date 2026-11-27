// 互動點的旁白示範(腳本的 "demo",格式見 live/README.md):一條扁平的項目清單。
// 載入時併進主時間軸(demoTimeline.ts),播放、暫停、拖曳、速度都是播放器的;這裡是純函式,不認得演員、畫面與瀏覽器:
// 清單的檢查,以及「示範裡的第幾毫秒,演員該做過哪些動作」。
import type { ScriptStep } from '../../live/types'
export type DemoAction = ScriptStep & { at?: number }
export type DemoItem = {
  /** 固定的代號(學員看到哪裡靠它記) */
  id: string
  /** 從這一項起是哪一個大段;沒寫沿用前面的 */
  segment?: string
  /** 從這一項起是哪一階段(可以一次好幾個);沒寫沿用前面的,換大段時清掉 */
  section?: number | number[]
  /** 寫了 segment 的項目,演員的狀態預設重新開始;false 接著前面的 */
  reset?: boolean
  /** 這一項念的一句(字幕;voice.json 有同一句就有聲音) */
  say?: string
  /** 這一項至少多長(毫秒);旁白更長就等旁白念完 */
  ms?: number
  /** 觸發的動作;at 是這一項開始後的毫秒(不寫就是一開始) */
  do?: DemoAction | DemoAction[]
}

const FIELDS = ['id', 'segment', 'section', 'reset', 'say', 'ms', 'do']
const isMs = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isText = (v: unknown): boolean => typeof v === 'string' && !!v.trim()

export const actionsOf = (item: DemoItem): { at: number; step: ScriptStep }[] =>
  [item.do ?? []]
    .flat()
    .map((a) => {
      const { at = 0, ...step } = a as DemoAction
      return { at, step: step as ScriptStep }
    })
    .sort((a, b) => a.at - b.at)

/** 檢查寫法;不對就丟錯,訊息指出是哪一項(id) */
export function checkDemo(demo: unknown, where: string): DemoItem[] {
  if (!Array.isArray(demo) || !demo.length) throw new Error(`${where}:demo 要是至少一項的清單`)
  const ids = new Set<string>()
  const segments = new Set<string>()
  demo.forEach((raw, i) => {
    const item = raw as DemoItem
    const fail = (why: string): never => {
      throw new Error(`${where}:demo ${isText(item?.id) ? `項目「${item.id}」` : `第 ${i + 1} 項`}${why}`)
    }
    if (!item || typeof item !== 'object') fail('要是物件')
    const unknown = Object.keys(item).filter((k) => !FIELDS.includes(k))
    if (unknown.length) fail(`有不認得的欄位 ${unknown.join('、')}`)
    if (!isText(item.id)) fail('要寫 id')
    if (ids.has(item.id)) fail('的 id 重複')
    ids.add(item.id)
    if (item.segment !== undefined) {
      if (!isText(item.segment)) fail('的 segment 要是文字')
      if (segments.has(item.segment)) fail(`的 segment「${item.segment}」前面開始過了(每個大段只能寫一次)`)
      segments.add(item.segment)
    } else if (i === 0) fail('是第一項,要寫 segment')
    if (item.section !== undefined && ![item.section].flat().every((n) => Number.isInteger(n) && n >= 1)) fail('的 section 要是 1 以上的整數(或整數清單)')
    if (item.reset !== undefined && (typeof item.reset !== 'boolean' || item.segment === undefined)) fail('的 reset 要是 true 或 false,而且只能寫在有 segment 的項目')
    if (item.say !== undefined && !isText(item.say)) fail('的 say 要是一句話')
    if (item.ms !== undefined && !isMs(item.ms)) fail('的 ms 要是 0 以上的毫秒數')
    for (const a of [item.do ?? []].flat() as DemoAction[]) {
      if (!a || typeof a !== 'object') fail('的 do 要是動作(或動作清單)')
      if (a.at !== undefined && !isMs(a.at)) fail('的 do.at 要是 0 以上的毫秒數')
    }
  })
  return demo as DemoItem[]
}

/** 照播放時的狀態把每一段從它的起點走一遍(重設的地方重新 init);動作不會、順序不對時丟錯,訊息指出項目 id */
export function simulateDemo<S>(items: DemoItem[], init: () => S, apply: (state: S, step: ScriptStep) => S, where: string): void {
  let state = init()
  for (const item of items) {
    if (item.segment !== undefined && item.reset !== false) state = init()
    for (const { step } of actionsOf(item)) {
      try {
        state = apply(state, step)
      } catch (e) {
        throw new Error(`${where}:demo 項目「${item.id}」${JSON.stringify(step)}:${e instanceof Error ? e.message : e}`)
      }
    }
  }
}

export type DemoPlan = {
  items: DemoItem[]
  /** 每一項的長度、起點與總長(毫秒) */
  lengths: number[]
  starts: number[]
  total: number
  /** 每一項屬於哪個大段、哪些階段(沿用之後的結果) */
  segment: string[]
  sections: number[][]
  /** 每一項的畫面要從哪一項開始算(最近一個重設的地方) */
  resetAt: number[]
}

/** sayMs:一句旁白多長(語音長度;沒語音依字數)。項目長度取 ms、旁白、最晚的 do.at 裡最長的 */
export function planDemo(items: DemoItem[], sayMs: (line: string) => number): DemoPlan {
  const plan: DemoPlan = { items, lengths: [], starts: [], total: 0, segment: [], sections: [], resetAt: [] }
  let segment = ''
  let sections: number[] = []
  let reset = 0
  items.forEach((item, i) => {
    if (item.segment !== undefined) {
      segment = item.segment
      sections = []
      if (item.reset !== false) reset = i
    }
    if (item.section !== undefined) sections = [item.section].flat()
    const length = Math.max(item.ms ?? 0, item.say ? sayMs(item.say) : 0, ...actionsOf(item).map((a) => a.at))
    plan.segment.push(segment)
    plan.sections.push(sections)
    plan.resetAt.push(reset)
    plan.lengths.push(length)
    plan.starts.push(plan.total)
    plan.total += length
  })
  return plan
}

export type Position = { index: number; offsetMs: number }

/** 示範的第 ms 毫秒落在哪一項(開頭之前算第一項,超過結尾停在最後一項的結尾) */
export function locate(plan: DemoPlan, ms: number): Position {
  const at = Math.max(0, ms)
  for (let index = 0; index < plan.items.length; index++) if (at < plan.starts[index] + plan.lengths[index]) return { index, offsetMs: at - plan.starts[index] }
  const index = plan.items.length - 1
  return { index, offsetMs: plan.lengths[index] }
}

/** 某個大段(的某一階段)從哪一項開始;沒有是 -1 */
export const startOf = (plan: DemoPlan, segment: string, section?: number): number =>
  plan.items.findIndex((_, i) => plan.segment[i] === segment && (section === undefined || plan.sections[i].includes(section)))

/** 學員正在看另一個大段(影片停著,只是另一個檢視位置);section 是從那一段的哪一階段看起 */
export type DemoView = { segment: string; section?: number; offsetMs: number }

/**
 * 這一刻的畫面:演員從初始狀態依序做 steps,畫在第 from 毫秒。前面做完的動作各 1ms,所以 from = 做完幾個 + 目前這個演到第幾毫秒。
 * key 一樣代表 steps 一樣(只有時間往前走)。完全由 plan、示範裡的時間 ms 與檢視位置算出,和之前畫過什麼無關
 */
export function screenOf(plan: DemoPlan, ms: number, view?: DemoView | null): { key: string; steps: ScriptStep[]; from: number } {
  const instant = (list: ScriptStep[]) => list.map((step) => ({ ...step, ms: 1 }) as ScriptStep)
  const stepsIn = (from: number, to: number) => plan.items.slice(from, to).flatMap((item) => actionsOf(item).map((a) => a.step))
  if (view) {
    // 看別段:之前的瞬間做完,那一段的動作接連演一遍(用演員自己的速度,不照旁白的長短)
    const { segment, section, offsetMs } = view
    const first = startOf(plan, segment, section)
    const segmentStart = startOf(plan, segment)
    const end = plan.segment.lastIndexOf(segment) + 1
    const base = stepsIn(plan.resetAt[segmentStart], first)
    const shown = stepsIn(first, end).map((step) => {
      const copy = { ...step } as ScriptStep & { ms?: number }
      delete copy.ms
      return copy as ScriptStep
    })
    return { key: `view:${segment}:${section ?? ''}`, steps: [...instant(base), ...shown], from: base.length + offsetMs }
  }
  const { index, offsetMs } = locate(plan, ms)
  const reset = plan.resetAt[index]
  const now = plan.starts[index] + offsetMs
  const done: { start: number; step: ScriptStep }[] = []
  for (let i = reset; i <= index; i++) {
    for (const a of actionsOf(plan.items[i])) if (plan.starts[i] + a.at <= now) done.push({ start: plan.starts[i] + a.at, step: a.step })
  }
  const last = done.at(-1)
  if (!last) return { key: `main:${reset}:0`, steps: [], from: 0 }
  // 同一刻開始的動作一起演
  const group = done.findIndex((a) => a.start === last.start)
  return {
    key: `main:${reset}:${done.length}`,
    steps: [...instant(done.slice(0, group).map((a) => a.step)), ...done.slice(group).map((a) => a.step)],
    from: group + (now - last.start),
  }
}
