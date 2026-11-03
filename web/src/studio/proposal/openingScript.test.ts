import { describe, expect, it } from 'vitest'
import { L0_LESSONS } from '../../content/l0Lessons'
import { L1_LESSONS } from '../../content/l1Lessons'
import { L1T_LESSONS } from '../../content/l1ToolsLessons'
import { openingScript, sceneBeats } from './openingScript'

const ALL = [...L0_LESSONS, ...L1_LESSONS, ...L1T_LESSONS]

describe('sceneBeats', () => {
  it('splits on 。 and ；, keeping punctuation', () => {
    expect(sceneBeats('甲來了；乙走了。丙在哪')).toEqual(['甲來了；', '乙走了。', '丙在哪'])
  })
  it('keeps a closing quote with its sentence', () => {
    expect(sceneBeats('老闆說：「再問一次。」店員點頭。')).toEqual(['老闆說：「再問一次。」', '店員點頭。'])
  })
})

describe('openingScript', () => {
  it.each(ALL.map((c) => [c.id, c] as const))('%s has scene beats, a task card and a payoff', (_, c) => {
    const s = openingScript(c)
    const beats = sceneBeats(c.opening.scene)
    expect(beats.length).toBeGreaterThan(0)
    expect(beats.every((b) => !/^[」』）)]/.test(b))).toBe(true)
    expect(s.steps.map((x) => x.chapter).filter(Boolean)).toEqual(['情境開場', '任務卡', '回到情境'])
    expect(s.steps.every((x) => 'card' in x && x.narration)).toBe(true)
  })
})
