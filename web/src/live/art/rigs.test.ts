import { describe, expect, it } from 'vitest'
import { STAND_POSE, poseCss, poseMap, lerpPose, manArmsSvg } from './manRig'
import { clockAngles, clockText, dayOf, nightOf, todOf } from './fx/clock'
import { ROW_H, editorHtml, rowTop, scribbleCircle } from './fx/editor'
import { botBlink } from './robotRig'

describe('art/manRig、clock、editor、robotRig', () => {
  it('poseMap:站姿不動;平移、旋轉、縮放以腰為支點', () => {
    const p = { x: 1664, y: 302 }
    expect(poseMap(STAND_POSE, p)).toEqual(p)
    expect(poseCss(STAND_POSE)).toBe('none')
    expect(poseMap({ tx: -402, ty: 122, rot: 0, k: 1 }, p)).toEqual({ x: 1262, y: 424 })
    const r = poseMap({ tx: 0, ty: 0, rot: 90, k: 1 }, { x: 1690, y: 800 })
    expect(r.x).toBeCloseTo(1790, 6)
    expect(r.y).toBeCloseTo(900, 6)
    expect(poseMap({ tx: 0, ty: 0, rot: 0, k: 2 }, { x: 1690, y: 800 }).y).toBe(700)
    expect(lerpPose(STAND_POSE, { tx: 10, ty: 20, rot: 4, k: 1 }, 0.5)).toEqual({ tx: 5, ty: 10, rot: 2, k: 1 })
    expect(manArmsSvg({ prefix: 'x' })).not.toContain('ao-')
  })
  it('clock:時間換算、第幾天、天色', () => {
    expect(todOf(0)).toBe(9)
    expect(dayOf(0)).toBe(1)
    expect(dayOf(14)).toBe(1)
    expect(dayOf(15)).toBe(2)
    expect(dayOf(49)).toBe(3)
    expect(clockText(3.5)).toBe('12:30')
    expect(clockAngles(3)).toEqual({ hour: 0, min: 0 })
    expect(nightOf(0)).toBe(0)
    expect(nightOf(14)).toBe(1)
    expect(nightOf(49)).toBe(0)
    expect(nightOf(10.5)).toBeGreaterThan(0)
    expect(nightOf(10.5)).toBeLessThan(1)
  })
  it('editor:每行有行號與上色,圈是固定的 path', () => {
    const html = editorHtml([{ text: '<p>', caret: true }, { text: 'x', hot: 0.5, flash: 1 }])
    expect(html).toContain('<em>1</em>')
    expect(html).toContain('art-caret')
    expect(html).toContain('art-ed-hot')
    expect(html).toContain('art-ed-flash')
    expect(rowTop(2)).toBe(8 + 2 * ROW_H)
    expect(scribbleCircle(100, 50, 60, 15, 3)).toBe(scribbleCircle(100, 50, 60, 15, 3))
    expect(scribbleCircle(100, 50, 60, 15, 3)).toMatch(/^M[\d. -]+( L[\d. -]+)+$/)
  })
  it('robotRig:眨眼的時間點', () => {
    expect(botBlink(50)).toBe(0.15)
    expect(botBlink(500)).toBe(1)
  })
})
