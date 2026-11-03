import { describe, expect, it } from 'vitest'
import { PLACES, placeFor, placeOf, stageSize } from './place'

describe('stageSize', () => {
  it('橫式 1920×1080、直式 1080×1920,預設橫式', () => {
    expect(stageSize()).toEqual({ w: 1920, h: 1080 })
    expect(stageSize('landscape')).toEqual({ w: 1920, h: 1080 })
    expect(stageSize('portrait')).toEqual({ w: 1080, h: 1920 })
  })
})

describe('placeOf:語意名稱 × 方向', () => {
  const names = ['window', 'full', 'left', 'right', 'center'] as const
  it.each(names)('橫式 %s 與原本的表一致(預設方向就是橫式)', (n) => {
    expect(placeOf(n)).toEqual(PLACES.landscape[n])
    expect(placeOf(n, 'landscape')).toEqual(PLACES.landscape[n])
  })
  it('橫式的數值沒有變(零差異的依據)', () => {
    expect(placeOf('window')).toEqual({ x: 96, y: 76, w: 1728, h: 928 })
    expect(placeOf('right')).toEqual({ x: 1190, y: 150, w: 620, h: null })
    expect(placeOf('center')).toEqual({ x: 560, y: 240, w: 800, h: null })
    expect(placeOf(undefined)).toEqual(placeOf('window'))
  })
  it('直式:full 滿版、left 上半、right 下半、center 垂直置中、window 留邊', () => {
    expect(placeOf('full', 'portrait')).toEqual({ x: 0, y: 0, w: 1080, h: 1920 })
    const l = placeOf('left', 'portrait')
    const r = placeOf('right', 'portrait')
    expect(l.y + (l.h as number)).toBeLessThanOrEqual(r.y)
    expect(l.y).toBeLessThan(r.y)
    const c = placeOf('center', 'portrait')
    expect(c.y + (c.h as number) / 2).toBe(960)
    expect(c.x + c.w / 2).toBe(540)
    const w = placeOf('window', 'portrait')
    expect(w.x).toBeGreaterThan(0)
    expect(w.x + w.w).toBeLessThan(1080)
    expect(w.y + (w.h as number)).toBeLessThan(1920)
  })
  it('所有直式位置都在 1080×1920 畫布內', () => {
    for (const n of names) {
      const p = PLACES.portrait[n]
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x + p.w).toBeLessThanOrEqual(1080)
      expect(p.y + (p.h ?? 0)).toBeLessThanOrEqual(1920)
    }
  })
  it('不認得的名稱丟錯', () => {
    expect(() => placeOf('nope' as never)).toThrow('不認得')
  })
})

describe('placeOf:{x,y,w,h} 與百分比', () => {
  it('px 原樣,缺的欄位用該方向 window 補', () => {
    expect(placeOf({ x: 10, y: 20, w: 300 })).toEqual({ x: 10, y: 20, w: 300, h: 928 })
    expect(placeOf({ x: 10, y: 20, w: 300 }, 'portrait')).toEqual({ x: 10, y: 20, w: 300, h: 1560 })
    expect(placeOf({ x: 0, y: 0, w: 100, h: null }, 'portrait').h).toBeNull()
  })
  it('百分比相對於該方向的畫布', () => {
    expect(placeOf({ x: '50%', y: '50%', w: '25%', h: '10%' })).toEqual({ x: 960, y: 540, w: 480, h: 108 })
    expect(placeOf({ x: '50%', y: '50%', w: '25%', h: '10%' }, 'portrait')).toEqual({ x: 540, y: 960, w: 270, h: 192 })
  })
})

describe('placeOf:{ landscape, portrait }', () => {
  const spec = { landscape: 'right', portrait: { x: 40, y: 900, w: 1000, h: 800 } } as const
  it('依方向挑寫法,名稱再依方向換算', () => {
    expect(placeOf(spec)).toEqual(PLACES.landscape.right)
    expect(placeOf(spec, 'portrait')).toEqual({ x: 40, y: 900, w: 1000, h: 800 })
    expect(placeOf({ landscape: 'left', portrait: 'left' }, 'portrait')).toEqual(PLACES.portrait.left)
  })
  it('只寫一個方向時,另一個方向沿用它', () => {
    expect(placeFor({ landscape: 'full' }, 'portrait')).toBe('full')
    expect(placeOf({ portrait: { x: 1, y: 2, w: 3, h: 4 } })).toEqual({ x: 1, y: 2, w: 3, h: 4 })
  })
  it('沒有指定方向的值兩種方向共用', () => {
    expect(placeFor('right', 'portrait')).toBe('right')
    expect(placeFor(undefined, 'portrait')).toBeUndefined()
    const o = { x: 1, y: 2, w: 3 }
    expect(placeFor(o, 'landscape')).toBe(o)
  })
})
