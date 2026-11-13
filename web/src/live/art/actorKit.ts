// art/actorKit:有狀態演員(agent-office、manual-office)共用的小零件 —— 動作種類判斷、apply 的檢查、render 開頭的時間換算。
// 都是純函式;只描述「這一格的時間在哪個動作的第幾 ms」,場景邏輯留在各自的 actor.ts。
import { kit } from '../kit'
import type { ActorView } from '../types'

/** 由動作種類清單做出 kindIn:show / hide / props 這幾個舞台動作沒有自己的種類,改看步驟裡寫的是哪個欄位 */
export const makeKindIn =
  <K extends string>(kinds: readonly K[]) =>
  (kind: string, step: object): K | null =>
    (kinds as readonly string[]).includes(kind) ? (kind as K) : kind === 'show' || kind === 'hide' || kind === 'props' ? (kinds.find((k) => k in step) ?? null) : null

/** apply 的檢查:必須是 boolean(回傳它) */
export const flag = (v: unknown, name: string): boolean => {
  if (typeof v !== 'boolean') throw new Error(`${name} 要寫 true 或 false`)
  return v
}
/** apply 的檢查:必須是 true */
export const yes = (v: unknown, name: string): void => {
  if (v !== true) throw new Error(`${name} 要寫 true`)
}

/** render 開頭的時間換算:目前進行中的動作(kind)、它的自然長度換成腳本實際長度的比例後,動作內經過的 ms(l)、狀態(st / prev)、進度函式 */
export function frameClock<K extends string, St>(view: ActorView<St>, kindIn: (kind: string, step: object) => K | null, naturalOf: (kind: K, step: unknown) => number) {
  const ev = view.ev
  const kind = ev ? kindIn(ev.kind, ev.step) : null
  const natural = kind && ev ? naturalOf(kind, ev.step ?? {}) : 0
  const scaleT = natural > 0 && ev && ev.dur > 0 ? natural / ev.dur : 1
  const l = (ev?.local ?? 0) * scaleT
  const dur = natural || (ev?.dur ?? 1)
  const st = ev?.kind === 'hide' ? view.prev : view.state
  const P = (start: number, d: number): number => kit.progress(l, start, d)
  return {
    kind,
    l,
    dur,
    st,
    prev: view.prev,
    P,
    E: (start: number, d: number): number => kit.ease.inOutCubic(P(start, d)),
    O: (start: number, d: number): number => kit.ease.outCubic(P(start, d)),
    is: (k: K): boolean => kind === k,
  }
}
