import { describe, expect, it } from 'vitest'
import { barLevel, BARS, barsPath, placeVoiceOrb, ribbonPath } from './voiceOrb'

describe('AI 頭像(語音圓)', () => {
  it('同一時間畫出同樣的形狀,時間往前會脈動', () => {
    for (const draw of [(t: number) => barsPath(t).bars, (t: number) => ribbonPath(t, 1)]) {
      expect(draw(1000)).toBe(draw(1000))
      expect(draw(1000)).not.toBe(draw(1200))
      expect(draw(1000)).not.toContain('NaN')
    }
  })

  it('有實際音量時,安靜就收起來、大聲就伸長', () => {
    expect(barsPath(1000, 0).bars).not.toBe(barsPath(1000, 1).bars)
  })

  it('長條高度在 0 到 1 之間,左右對稱', () => {
    for (let i = 1; i < BARS; i++) {
      expect(barLevel(1234, i)).toBeGreaterThanOrEqual(0)
      expect(barLevel(1234, i)).toBeLessThanOrEqual(1)
      expect(barLevel(1234, i)).toBe(barLevel(1234, BARS - i))
    }
  })
})

describe('AI 頭像不蓋到字幕', () => {
  const place = (capLeft: number, capWidth: number) => {
    const style = new Map<string, string>()
    const rect = (r: object) => ({ getBoundingClientRect: () => r })
    const el = {
      ...rect({ left: 10, right: 54 }),
      parentElement: rect({ bottom: 693 }),
      style: { setProperty: (k: string, v: string) => style.set(k, v), removeProperty: (k: string) => style.delete(k) },
    }
    placeVoiceOrb(el as unknown as HTMLElement, rect({ left: capLeft, right: capLeft + capWidth, width: capWidth, top: 520 }) as unknown as HTMLElement)
    return style.get('--vp-voice-min')
  }

  it('左右重疊時墊到字幕上方,沒重疊或沒字幕時不動', () => {
    expect(place(20, 350)).toBe('179px')
    expect(place(120, 150)).toBeUndefined()
    expect(place(0, 0)).toBeUndefined()
  })
})
