// 示範清單併進主時間軸:互動點那一步拉長成整條示範的長度,每一項的旁白、字幕就是時間軸上的旁白與字幕。
// 所以播放條、拖曳、章節、播放暫停、速度、靜音、字幕、AI 頭像、進度紀錄全是播放器的同一個位置,沒有第二套時鐘。
import { ACTORS } from '../../live/actors'
import type { ScriptStep, StageCaption, StageNarration, StageScript } from '../../live/types'
import { planDemo, simulateDemo, type DemoItem, type DemoPlan } from './demoEngine'

/** 沒有語音時,字幕停多久(毫秒) */
export const captionMs = (text: string): number => 800 + text.length * 190

/**
 * 把每個有 demo 的互動點那一步換成「長度 = 整條示範」(它自己的 narration 拿掉:開場白寫在 demo 第一項),
 * 下一步緊接在示範之後。腳本檔不變,只在載入舞台前換。
 */
export function withDemoTimeline(script: StageScript, demos: { id: string; demo?: DemoItem[] }[], durations: Record<string, number> | undefined): { script: StageScript; plans: Record<string, DemoPlan> } {
  const plans: Record<string, DemoPlan> = {}
  for (const m of demos) if (m.demo) plans[m.id] = planDemo(m.demo, (line) => durations?.[line] ?? captionMs(line))
  if (!Object.keys(plans).length) return { script, plans }
  const steps = script.steps.map((raw) => {
    const id = (raw as { id?: string }).id
    const plan = id ? plans[id] : undefined
    if (!plan) return raw
    const { narration: _opening, ...rest } = raw as Record<string, unknown>
    return { ...rest, ms: plan.total, pause: 0 } as unknown as ScriptStep
  })
  return { script: { ...script, steps }, plans }
}

/** 從時間軸的 at 開始的示範:每一句旁白與它的字幕時間 */
export function demoSpeech(plan: DemoPlan, at: number, durations: Record<string, number> | undefined): { narrations: StageNarration[]; captions: StageCaption[] } {
  const narrations: StageNarration[] = []
  const captions: StageCaption[] = []
  plan.items.forEach((item, i) => {
    if (!item.say) return
    const from = at + plan.starts[i]
    narrations.push({ at: from, text: item.say })
    captions.push({ from, to: from + Math.min(plan.lengths[i], durations?.[item.say] ?? captionMs(item.say)), text: item.say })
  })
  return { narrations, captions }
}

/** 照清單順序把動作套到演員的狀態上,演員不會的、狀態對不上的在載入時就報出來(指出項目 id) */
export function checkDemoActions(demo: DemoItem[], script: StageScript, actor: string, where: string): void {
  const cast = script.cast?.[actor]
  const def = cast && ACTORS[cast.actor]
  if (!def?.init || !def.apply) throw new Error(`${where}:demo 的演員「${actor}」不能示範(要有狀態)`)
  simulateDemo<unknown>(
    demo,
    () => def.init!((cast.props ?? {}) as never),
    (state, step) => {
      const kind = def.kinds.find((k) => k in step)
      if (!kind) throw new Error(`「${actor}」沒有這個動作`)
      return def.apply!(state as never, kind as never, step as never)
    },
    where,
  )
}
