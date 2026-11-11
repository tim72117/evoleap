// 兒童課宣傳片(完整版與短版):疊在平板螢幕上的課程演員,腳本裡的 place 要和 layout.ts 的 PLACE 一致;平板與標籤要在安全區裡
import { describe, expect, it } from 'vitest'
import full from '../../../../content/live/promo/kids-free-reel.json'
import short from '../../../../content/live/promo/kids-free-reel-short.json'
import { CHIP, PLACE, PLACE_SHORT, SAFE, SCREEN, TABLET, type Box } from './layout'

type Cast = Record<string, { actor: string; place?: unknown; hidden?: boolean }>
const inside = (a: Box, b: Box): boolean => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h

describe.each([
  ['kids-free-reel.json', full.cast as Cast],
  ['kids-free-reel-short.json', short.cast as Cast],
])('kid-reel 版面:%s', (_, cast) => {
  it('課程演員的直式 place 是 PLACE 或 PLACE_SHORT,並在螢幕裡', () => {
    const lessons = Object.entries(cast).filter(([, c]) => !c.actor.startsWith('kid-reel'))
    expect(lessons.length).toBeGreaterThanOrEqual(3)
    for (const [, c] of lessons) {
      expect([PLACE, PLACE_SHORT]).toContainEqual((c.place as { portrait: Box }).portrait)
      expect(c.hidden).toBe(true)
    }
    expect(inside(PLACE, SCREEN)).toBe(true)
  })

  it('kid-reel 排在演員表最前面(課程演員疊在它上面),浮空字卡 kid-reel-cards 排在最後(壓在課程演員上面)', () => {
    const order = Object.values(cast).map((c) => c.actor)
    expect(order[0]).toBe('kid-reel')
    expect(order[order.length - 1]).toBe('kid-reel-cards')
  })
})

describe('kid-reel 版面', () => {
  it('平板與亮點標籤在安全區裡,不被 FB 的介面蓋住', () => {
    expect(inside(TABLET, SAFE)).toBe(true)
    expect(inside(CHIP, SAFE)).toBe(true)
    expect(CHIP.y + CHIP.h).toBeLessThanOrEqual(TABLET.y)
  })
})
