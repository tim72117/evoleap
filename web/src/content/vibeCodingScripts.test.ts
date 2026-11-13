import { describe, expect, it } from 'vitest'
import { ACTORS } from '../live/actors'
import { withTeacher } from '../live/teacher'
import type { StageScript } from '../live/types'
import { expandAnswers, momentsOf, type Answers } from '../studio/interactive/scene'
import { L2_LESSONS } from './l2Lessons'

// 「Vibe Coding 入門」的腳本(content/live/vibe-coding/,不含 .voice.json、.mix.json):每一種回答組合都照順序交給演員的 init/apply 推算一遍,
// 寫錯的操作在這裡就會丟錯,不用等到畫面播到才發現。這裡只推算狀態,沒有真的載入舞台,鏡頭與版面要看畫面才知道。
// 這門課的腳本不用文字圖卡(card):沒有介面的觀念用寫實情境的場景(例如 desk 演員)演出。

type Step = Record<string, unknown>

const SCRIPTS = import.meta.glob(['./live/vibe-coding/*.json', '!./live/vibe-coding/*.voice.json', '!./live/vibe-coding/*.mix.json'], { eager: true, import: 'default' }) as Record<string, StageScript>

/** 舞台自己的動作(live/stage.ts) */
const STAGE_KINDS = ['card', 'callout', 'show', 'hide', 'move', 'checkpoint', 'wait', 'parts']

/** 每個互動點回答每個選項或略過的所有組合(加上都沒回答) */
function answerSets(script: StageScript): Answers[] {
  let sets: Answers[] = [{}]
  for (const m of momentsOf(script)) {
    const choices: Answers[string][] = [...m.options.map((_, option) => ({ option })), { skipped: true as const }]
    sets = sets.flatMap((a) => [a, ...choices.map((c) => ({ ...a, [m.id]: c }))])
  }
  return sets
}

function replay(script: StageScript, answers: Answers) {
  const cast = Object.entries(script.cast).map(([id, c]) => ({ id, def: ACTORS[c.actor], state: ACTORS[c.actor].init?.(c.props ?? {}) }))
  for (const [n, raw] of expandAnswers(script, answers).steps.entries()) {
    const step = raw as Step
    const named = (step.show ?? step.hide) as string | undefined
    if (named) expect(cast.map((c) => c.id), `第 ${n + 1} 步`).toContain(named)
    const owners = cast.filter((c) => c.def.kinds.some((k) => k in step) && (!step.on || step.on === c.id) && (!named || named === c.id))
    const kind = (o: (typeof cast)[number]) => o.def.kinds.find((k) => k in step)!
    if (!owners.length) {
      expect(STAGE_KINDS.some((k) => k in step), JSON.stringify(step).slice(0, 120)).toBe(true)
      // 退場時舞台清掉暫時狀態(stage.ts)
      const o = named && 'hide' in step ? cast.find((c) => c.id === named) : undefined
      if (o?.state && typeof o.state === 'object') o.state = { ...(o.state as object), temp: {} }
      continue
    }
    expect(owners.length, `要寫 on:${JSON.stringify(step).slice(0, 120)}`).toBe(1)
    const o = owners[0]
    try {
      if (o.def.apply) o.state = o.def.apply(o.state, kind(o), step)
    } catch (e) {
      throw new Error(`第 ${n + 1} 步 ${JSON.stringify(step).slice(0, 80)}:${e instanceof Error ? e.message : e}`)
    }
  }
}

/** 腳本的每一步,連同互動點各個選項與略過的步驟 */
const allSteps = (steps: Step[]): Step[] =>
  steps.flatMap((s) => [
    s,
    ...allSteps(((s.options as { steps: Step[] }[] | undefined) ?? []).flatMap((o) => o.steps)),
    ...allSteps((s.skip as { steps: Step[] } | undefined)?.steps ?? []),
  ])

describe('Vibe Coding 入門的腳本', () => {
  it.each(Object.keys(SCRIPTS))('%s:演員都存在、每種回答都演得完,章節以「學會」結尾', (file) => {
    const script = withTeacher(SCRIPTS[file])
    for (const c of Object.values(script.cast)) expect(ACTORS[c.actor], c.actor).toBeDefined()
    const sets = answerSets(script)
    expect(sets.length).toBeGreaterThan(1)
    for (const answers of sets) replay(script, answers)
    const chapters = script.steps.map((s) => (s as Step).chapter).filter(Boolean)
    expect(chapters.at(-1)).toBe('學會')
    for (const s of allSteps(script.steps as Step[])) {
      const target = typeof s.callout === 'string' ? s.callout : null
      if (target) expect(Object.keys(script.cast), target).toContain(target.split(':')[0])
    }
  })

  it.each(Object.keys(SCRIPTS))('%s:不用文字圖卡(card),聚光燈的說明是短句', (file) => {
    const steps = allSteps(SCRIPTS[file].steps as Step[])
    expect(steps.filter((s) => 'card' in s)).toEqual([])
    for (const s of steps.filter((x) => 'callout' in x)) expect((s.text as string | undefined)?.length ?? 0, s.text as string).toBeLessThanOrEqual(30)
  })

  it('課程頁的每一步都對應到腳本的 lessonStep,有提示詞的步驟在腳本裡照樣送出', () => {
    for (const lesson of L2_LESSONS) {
      const live = lesson.videos[0].live!
      const script = SCRIPTS[`./live/${live}`]
      expect(script, live).toBeDefined()
      const marks = (script.steps as Step[]).map((s) => s.lessonStep).filter((x) => x !== undefined)
      expect(marks, lesson.id).toEqual(lesson.steps.map((_, i) => i + 1))
      const sent = allSteps(script.steps as Step[]).map((s) => s.user)
      for (const s of lesson.steps) if (s.prompt) expect(sent, s.title).toContain(s.prompt)
    }
  })
})
