import { describe, expect, it, vi } from 'vitest'

const made = vi.hoisted(() => ({ count: 0 }))
vi.mock('three', async (original) => ({
  ...(await original<typeof import('three')>()),
  WebGLRenderer: class {
    constructor() {
      made.count++
      throw new Error('no webgl')
    }
  },
}))

describe('print3d-layers 沒有 WebGL', () => {
  it('建立失敗後不再每一格重試', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { drawPrinter } = await import('./gl')
    expect(drawPrinter({} as HTMLCanvasElement, {} as never)).toBe(false)
    expect(drawPrinter({} as HTMLCanvasElement, {} as never)).toBe(false)
    expect(made.count).toBe(1)
  })
})
