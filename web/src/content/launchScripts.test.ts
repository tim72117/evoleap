import { describe, expect, it } from 'vitest'
import { ACTORS } from '../live/actors'
import type { StageScript } from '../live/types'
import { expandAnswers, momentsOf, type Answers } from '../studio/interactive/scene'

// 「從做好到上線」的腳本(content/live/launch/,不含 .voice.json):每一種回答組合都照順序交給演員的 init/apply 推算一遍,
// 寫錯的操作在這裡就會丟錯,不用等到畫面播到才發現。這裡只推算狀態,沒有真的載入舞台,鏡頭與版面要看畫面才知道。

type Step = Record<string, unknown>

const SCRIPTS = import.meta.glob(['./live/launch/*.json', '!./live/launch/*.voice.json'], { eager: true, import: 'default' }) as Record<string, StageScript>

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
  for (const raw of expandAnswers(script, answers).steps) {
    const step = raw as Step
    const owners = cast.filter((c) => c.def.kinds.some((k) => k in step) && (!step.on || step.on === c.id) && (!(step.show ?? step.hide) || (step.show ?? step.hide) === c.id))
    const kind = (o: (typeof cast)[number]) => o.def.kinds.find((k) => k in step)!
    if (!owners.length) {
      expect(STAGE_KINDS.some((k) => k in step), JSON.stringify(step).slice(0, 120)).toBe(true)
      continue
    }
    expect(owners.length, `要寫 on:${JSON.stringify(step).slice(0, 120)}`).toBe(1)
    const o = owners[0]
    if (o.def.apply) o.state = o.def.apply(o.state, kind(o), step)
  }
}

describe('從做好到上線的腳本', () => {
  it.each(Object.keys(SCRIPTS))('%s:每種回答都演得完,章節以「學會」結尾', (file) => {
    const script = SCRIPTS[file]
    for (const c of Object.values(script.cast)) expect(ACTORS[c.actor], c.actor).toBeDefined()
    for (const answers of answerSets(script)) replay(script, answers)
    const chapters = script.steps.map((s) => (s as Step).chapter).filter(Boolean)
    expect(chapters.at(-1)).toBe('學會')
    for (const s of script.steps as Step[]) {
      const target = typeof s.callout === 'string' ? s.callout : null
      if (target) expect(Object.keys(script.cast), target).toContain(target.split(':')[0])
    }
  })
})
