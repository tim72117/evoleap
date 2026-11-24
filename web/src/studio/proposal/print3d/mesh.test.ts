import { describe, expect, it } from 'vitest'
import { buildMesh, DEFAULTS, measure, overhangs, sliceAt, toObj, toStl } from './mesh'

describe('簡易 3D 列印的幾何', () => {
  it('方塊的體積、表面積、尺寸', () => {
    const m = measure(buildMesh({ ...DEFAULTS, kind: 'box', width: 10, depth: 20, height: 30 }))
    expect(m.volume).toBeCloseTo(6000)
    expect(m.area).toBeCloseTo(2 * (10 * 20 + 10 * 30 + 20 * 30))
    expect(m.size.map((v) => +v.toFixed(3))).toEqual([10, 20, 30])
  })
  it('正多邊形柱邊數越多,體積越接近圓柱 π r² h', () => {
    const cyl = Math.PI * 10 ** 2 * 20
    const v6 = measure(buildMesh({ ...DEFAULTS, kind: 'prism', sides: 6, radius: 10, height: 20 })).volume
    const v96 = measure(buildMesh({ ...DEFAULTS, kind: 'prism', sides: 96, radius: 10, height: 20 })).volume
    expect(Math.abs(cyl - v96)).toBeLessThan(Math.abs(cyl - v6))
    expect(v96 / cyl).toBeGreaterThan(0.99)
  })
  it('扭轉幾乎不改變體積(三角形近似少約 1%)', () => {
    const a = measure(buildMesh({ ...DEFAULTS, kind: 'twist', sides: 5, twist: 0 })).volume
    const b = measure(buildMesh({ ...DEFAULTS, kind: 'twist', sides: 5, twist: 120 })).volume
    expect(Math.abs(b / a - 1)).toBeLessThan(0.02)
  })
  it('切片:方塊中間切一刀是一個長方形(4 條邊)', () => {
    const segs = sliceAt(buildMesh({ ...DEFAULTS, kind: 'box', width: 10, depth: 20, height: 30 }), 15)
    const total = segs.reduce((s, [a, b]) => s + Math.hypot(a[0] - b[0], a[1] - b[1]), 0)
    expect(total).toBeCloseTo(60)
  })
  it('STL:84 位元組表頭 + 每個三角形 50 位元組', () => {
    const tris = buildMesh(DEFAULTS)
    const buf = toStl(tris)
    expect(buf.byteLength).toBe(84 + tris.length * 50)
    expect(new DataView(buf).getUint32(80, true)).toBe(tris.length)
  })
  it('球:h = 2r 時體積接近 4/3 π r³', () => {
    const m = measure(buildMesh({ ...DEFAULTS, kind: 'sphere', radius: 20, height: 40 }))
    expect(Math.abs(m.volume / ((4 / 3) * Math.PI * 20 ** 3) - 1)).toBeLessThan(0.05)
  })
  it('挖空:體積變小,而且還是封閉的(體積為正)', () => {
    for (const kind of ['box', 'prism', 'vase', 'sphere', 'cone', 'star', 'twist'] as const) {
      const solid = measure(buildMesh({ ...DEFAULTS, kind })).volume
      const hollow = measure(buildMesh({ ...DEFAULTS, kind, wall: 2 })).volume
      expect(hollow).toBeGreaterThan(0)
      expect(hollow).toBeLessThan(solid)
    }
  })
  it('縮放:體積隨比例的三次方', () => {
    const a = measure(buildMesh({ ...DEFAULTS, kind: 'box' })).volume
    const b = measure(buildMesh({ ...DEFAULTS, kind: 'box', scale: 2 })).volume
    expect(b / a).toBeCloseTo(8)
  })
  it('懸空:直柱不需要支撐,球要', () => {
    expect(overhangs(buildMesh({ ...DEFAULTS, kind: 'box' })).area).toBe(0)
    expect(overhangs(buildMesh({ ...DEFAULTS, kind: 'sphere', radius: 20, height: 40 })).area).toBeGreaterThan(0)
  })
  it('OBJ:頂點數 = 三角形 × 3', () => {
    const tris = buildMesh({ ...DEFAULTS, kind: 'box' })
    expect(toObj(tris).split('\n').filter((l) => l.startsWith('v ')).length).toBe(tris.length * 3)
  })
})
