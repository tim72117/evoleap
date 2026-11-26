// 兒童課宣傳片的版面:平板與亮點標籤要在安全區裡
import { describe, expect, it } from 'vitest'
import { CHIP, SAFE, TABLET, type Box } from './layout'

const inside = (a: Box, b: Box): boolean => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h

describe('kid-reel 版面', () => {
  it('平板與亮點標籤在安全區裡,不被 FB 的介面蓋住', () => {
    expect(inside(TABLET, SAFE)).toBe(true)
    expect(inside(CHIP, SAFE)).toBe(true)
    expect(CHIP.y + CHIP.h).toBeLessThanOrEqual(TABLET.y)
  })
})
