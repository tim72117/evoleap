import { describe, expect, it } from 'vitest'
import { BEST, FENCE, MAX_W, shapeOf } from './MathAreaPage'

describe('圍籬與面積', () => {
  it('圍籬長度固定:每種形狀的周長都是 24', () => {
    for (let w = 1; w <= MAX_W; w++) {
      const sh = shapeOf(w)
      expect((sh.w + sh.h) * 2).toBe(FENCE)
      expect(sh.area).toBe(sh.w * sh.h)
    }
  })
  it('周長一樣,面積不一樣;正方形(6×6)最大 = 36', () => {
    expect(shapeOf(3).area).not.toBe(shapeOf(5).area)
    expect(BEST).toBe(36)
    expect(shapeOf(6).area).toBe(BEST)
  })
  it('寬和高對調面積一樣(4×8 = 8×4)', () => {
    expect(shapeOf(4).area).toBe(shapeOf(8).area)
  })
})
