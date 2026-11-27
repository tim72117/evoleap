import { describe, expect, it } from 'vitest'
import { handFrame, handMs } from './handEdit'
import { CHUNKS } from './sample'

const final = CHUNKS[0].lines
const frames = Array.from({ length: 1001 }, (_, i) => handFrame(final, i / 1000))

describe('手寫程式的橋段', () => {
  it('每個段落打完停一下;速度和停頓由參數決定', () => {
    const still = frames.filter((f, i) => i > 0 && !f.mouse && JSON.stringify(f.lines) === JSON.stringify(frames[i - 1].lines))
    expect(still.length).toBeGreaterThan(100)
    expect(frames.some((f) => f.blink)).toBe(true)
    expect(handMs(final, 92, 600) - handMs(final, 92, 0)).toBeCloseTo(3000)
    expect(handMs(final, 46, 0)).toBeCloseTo(handMs(final, 92, 0) * 2)
  })

  it('打完就是完整的程式', () => {
    expect(handFrame(final, 1).lines).toEqual(final)
    expect(handFrame(final, 0).lines).toEqual([''])
  })

  it('中途有漏行、寫錯,之後用滑鼠點回去改', () => {
    expect(frames.some((f) => f.lines.includes('  s.left = s.left + 1'))).toBe(true)
    expect(frames.some((f) => f.mouse && f.caret.line < f.lines.length - 5)).toBe(true)
    expect(frames.filter((f) => f.mouse?.press).length).toBeGreaterThan(0)
  })
})
