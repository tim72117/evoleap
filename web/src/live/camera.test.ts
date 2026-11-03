import { describe, expect, it } from 'vitest'
import { cameraPoseAt, poseFor, safeBottomOf, SAFE_BOTTOM, SAFE_BOTTOM_PORTRAIT } from './camera'
import type { CameraKey } from './types'

const LAND = { w: 1920, h: 1080 }
const PORT = { w: 1080, h: 1920 }
const key = (zoom: number): CameraKey => ({ at: 0, target: 't', zoom, auto: false })

describe('safeBottomOf', () => {
  it('橫式 68%、直式 84%', () => {
    expect(safeBottomOf(LAND)).toBe(SAFE_BOTTOM)
    expect(safeBottomOf(PORT)).toBe(SAFE_BOTTOM_PORTRAIT)
    expect(SAFE_BOTTOM).toBe(0.68)
  })
})

describe('poseFor 吃舞台寬高', () => {
  it('沒有鏡頭或量不到目標是全景', () => {
    expect(poseFor(undefined, LAND, () => null)).toEqual({ x: 0, y: 0, zoom: 1 })
    expect(poseFor(key(2), PORT, () => null)).toEqual({ x: 0, y: 0, zoom: 1 })
  })
  it('橫式:目標下緣不超過畫面 68% 高', () => {
    const r = { x: 800, y: 700, w: 300, h: 200 }
    const p = poseFor(key(1.6), LAND, () => r)
    expect((r.y + r.h) * p.zoom + p.y).toBeLessThanOrEqual(1080 * 0.68 + 0.001)
  })
  it('直式:下緣用 84% 的安全線,不會把目標推到畫面上半', () => {
    const r = { x: 300, y: 1300, w: 400, h: 300 }
    const p = poseFor(key(1.6), PORT, () => r)
    expect((r.y + r.h) * p.zoom + p.y).toBeLessThanOrEqual(1920 * 0.84 + 0.001)
    expect(p.zoom).toBeCloseTo(1.6)
  })
  it('倍率不會讓目標超出寬度的 92%', () => {
    const p = poseFor(key(3), PORT, () => ({ x: 100, y: 100, w: 800, h: 300 }))
    expect(p.zoom).toBeCloseTo((1080 * 0.92) / 800)
  })
  it('目標在畫面內時,推近後不露出舞台外的空白', () => {
    const p = poseFor(key(1.6), PORT, () => ({ x: 0, y: 0, w: 300, h: 300 }))
    expect(p.x).toBeLessThanOrEqual(0)
    expect(p.y).toBeLessThanOrEqual(0)
  })
})

describe('cameraPoseAt', () => {
  it('過渡結束後等於 poseFor 的結果', () => {
    const r = { x: 300, y: 600, w: 400, h: 300 }
    const keys: CameraKey[] = [{ at: 1000, target: 't', zoom: 1.6, auto: false }]
    expect(cameraPoseAt(keys, 5000, PORT, () => r)).toEqual(poseFor(keys[0], PORT, () => r))
    expect(cameraPoseAt(keys, 0, PORT, () => r)).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})
