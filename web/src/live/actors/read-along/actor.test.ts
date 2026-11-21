import { describe, expect, it } from 'vitest'
import actor, { audioTime, talking, ICONS, LEAD, keysAt, orbPos, skyColors } from './actor'
import script from '../../../content/live/lab/read-along/u8-foods.json'
import voice from '../../../content/live/lab/read-along/u8-foods.voice.json'
import girl from '../../../content/live/lab/read-along/u8-foods-girl.json'
import girlVoice from '../../../content/live/lab/read-along/u8-foods-girl.voice.json'

describe('read-along 對齊錄音', () => {
  it('畫面裡的錄音時間 = at + (local − 旁白延遲)', () => {
    expect(audioTime({ at: 9.5 }, LEAD)).toBe(9.5)
    expect(audioTime({ at: 9.5 }, LEAD + 480)).toBeCloseTo(9.98)
  })
  it('小熊只在有聲音的區間張嘴', () => {
    const speech: [number, number][] = [[1, 2]]
    expect(talking(0.5, speech, [])).toBe(false)
    expect([1.0, 1.15, 1.3, 1.45].some((t) => talking(t, speech, []))).toBe(true)
  })
  type S = { at: number; ms: number; pause: number; words: [string, number][]; pics?: [string, number][]; narration?: string; read: string }
  const clipsOf = (v: unknown) => (v as { clips: Record<string, { ms: number }> }).clips
  it.each([
    ['u8-foods', script.steps as unknown as S[]],
    ['u8-foods-girl', girl.steps as unknown as S[]],
  ] as const)('%s:每一步接著上一步(錄音連續)、字在這一步的範圍裡、圖示都存在', (_name, steps) => {
    let at = 0
    for (const s of steps) {
      expect(s.at).toBeCloseTo(at)
      expect(s.pause).toBe(0)
      for (const [, w] of s.words) expect(w).toBeGreaterThanOrEqual(s.at)
      for (const [, w] of s.words) expect(w).toBeLessThan(s.at + s.ms / 1000)
      for (const [name] of s.pics ?? []) expect(ICONS[name]).toBeTruthy()
      at += s.ms / 1000
    }
    expect(actor.kinds).toEqual(['read'])
  })
  it('u8-foods:錄音切成每一句,每一步的旁白就是這一句', () => {
    for (const s of script.steps as unknown as S[]) {
      expect(s.narration).toBe(s.read)
      // 舞台會替旁白多留 500ms:清單裡的長度比這一句短 500,這一步才剛好等於錄音的長度
      expect(clipsOf(voice)[s.narration!].ms).toBe(s.ms - 500)
    }
  })
  it('u8-foods-girl:整段錄音不切,只有第一步帶旁白(全文),長度涵蓋所有步驟', () => {
    const steps = girl.steps as unknown as S[]
    expect(steps[0].narration).toBe(steps.map((s) => s.read).join(' '))
    expect(steps.slice(1).every((s) => s.narration === undefined)).toBe(true)
    const total = steps.reduce((m, s) => m + s.ms, 0)
    expect(clipsOf(girlVoice)[steps[0].narration!].ms).toBe(total - 500)
  })
})

describe('read-along 天空', () => {
  const sky: [number, number][] = [[0, 0], [10, 0], [12, 1]]
  it('時間點之間平順過渡,前後維持不變', () => {
    expect(keysAt(sky, -1)).toBe(0)
    expect(keysAt(sky, 11)).toBeCloseTo(0.5)
    expect(keysAt(sky, 99)).toBe(1)
    expect(keysAt(undefined, 3)).toBe(0)
  })
  it('白天太陽在高處、月亮在地平線下;夜晚相反', () => {
    const day = orbPos(0, 0, false)
    const night = orbPos(1, 0, false)
    expect(day.sun[1]).toBeLessThan(0.5)
    expect(day.moon[1]).toBeGreaterThan(1.3)
    expect(night.sun[1]).toBeGreaterThan(1.3)
    expect(night.moon[1]).toBeLessThan(0.5)
    expect(night.sun[0]).toBeGreaterThan(day.sun[0])
  })
  it('月亮探頭時移到太陽旁邊,不重疊', () => {
    const a = orbPos(0, 1, false)
    expect(a.moon[1]).toBeLessThan(0.5)
    expect(Math.abs(a.moon[0] - a.sun[0])).toBeGreaterThan(0.12)
    const b = orbPos(0, 1, true)
    expect(Math.abs(b.moon[0] - b.sun[0])).toBeGreaterThan(0.3)
  })
  it('顏色由白天的藍、黃昏的橘到夜晚的深藍', () => {
    expect(skyColors(0).top).toBe('rgb(110,193,240)')
    expect(skyColors(0.5).bottom).toBe('rgb(255,178,122)')
    expect(skyColors(1).top).toBe('rgb(20,27,69)')
  })
})
