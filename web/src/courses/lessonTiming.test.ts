import { describe, expect, it } from 'vitest'
import type { LessonVideo } from '../content/lessonTypes'
import { effectiveCues, mmss, stepAt } from './lessonTiming'

const video = (v: Partial<LessonVideo>): LessonVideo => ({ title: 'v', minutes: 10, steps: [1, 2, 3, 4], wrap: '', ...v })

describe('effectiveCues', () => {
  it('returns [] for no video', () => {
    expect(effectiveCues(undefined)).toEqual([])
  })

  it('spreads steps evenly after an 8% intro when there are no cues', () => {
    // 10 分鐘 = 600 秒,開場 48 秒,剩 552 秒平均分給 4 步
    expect(effectiveCues(video({}))).toEqual([
      { step: 1, at: 48 },
      { step: 2, at: 186 },
      { step: 3, at: 324 },
      { step: 4, at: 462 },
    ])
  })

  it('keeps the video step numbers (not 1..k), ascending, within the duration', () => {
    const cues = effectiveCues(video({ minutes: 7, steps: [3, 5, 6] }))
    expect(cues.map((c) => c.step)).toEqual([3, 5, 6])
    expect(cues[0].at).toBe(Math.round(7 * 60 * 0.08))
    for (let i = 1; i < cues.length; i++) expect(cues[i].at).toBeGreaterThan(cues[i - 1].at)
    expect(cues[cues.length - 1].at).toBeLessThan(7 * 60)
  })

  it('uses explicit cues as-is', () => {
    const cues = [
      { step: 2, at: 5 },
      { step: 1, at: 99 },
    ]
    expect(effectiveCues(video({ cues }))).toBe(cues)
  })
})

describe('stepAt', () => {
  const cues = [
    { step: 1, at: 10 },
    { step: 2, at: 20 },
    { step: 3, at: 30 },
  ]
  it('returns null before the first cue and for empty/undefined cues', () => {
    expect(stepAt(cues, 0)).toBeNull()
    expect(stepAt(cues, 9.99)).toBeNull()
    expect(stepAt([], 100)).toBeNull()
    expect(stepAt(undefined, 100)).toBeNull()
  })
  it('switches exactly at the cue time', () => {
    expect(stepAt(cues, 10)).toBe(1)
    expect(stepAt(cues, 19.99)).toBe(1)
    expect(stepAt(cues, 20)).toBe(2)
    expect(stepAt(cues, 30)).toBe(3)
    expect(stepAt(cues, 1e6)).toBe(3)
  })
})

describe('mmss', () => {
  it('formats seconds as zero-padded mm:ss, flooring fractions', () => {
    expect(mmss(0)).toBe('00:00')
    expect(mmss(5.9)).toBe('00:05')
    expect(mmss(65)).toBe('01:05')
    expect(mmss(600)).toBe('10:00')
    expect(mmss(3599)).toBe('59:59')
    expect(mmss(3600)).toBe('60:00')
  })
})
