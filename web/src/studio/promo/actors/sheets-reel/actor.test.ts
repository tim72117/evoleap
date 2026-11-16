import { describe, expect, it } from 'vitest'
import actor, { apply, frameSvg, SCENES, T, type ReelState } from './actor'
import { ROWS, money, sum } from './scenes'

const init = actor.init!({}) as ReelState

describe('sheets-reel 動作', () => {
  it('scene 要是已知的段落', () => {
    expect(() => apply(init, 'scene', { scene: 'nope' as never })).toThrow(/scene/)
    expect(() => apply(init, 'scene', {})).toThrow()
    expect(apply({ scene: 'open', prev: null }, 'scene', { scene: 'ask' })).toEqual({ scene: 'ask', prev: 'open' })
  })
})

describe('sheets-reel 畫面是時間的純函式', () => {
  for (const sc of SCENES) {
    it(`${sc}:同一時間點同一畫面,沒有 NaN,結束後仍有內容`, () => {
      const st: ReelState = { scene: sc, prev: null }
      const D = T[sc]
      for (let l = 0; l <= D; l += D / 25) {
        const a = frameSvg(st, l, D)
        expect(a).toBe(frameSvg(st, l, D))
        expect(a).not.toMatch(/NaN|undefined|Infinity/)
        expect(a.length).toBeGreaterThan(100)
      }
      expect(frameSvg(st, 100000, 1000)).not.toMatch(/NaN|undefined/)
    })
  }
  it('不用 CSS 動畫', () => {
    expect(SCENES.map((s) => frameSvg({ scene: s, prev: null }, 3000, 9000)).join('')).not.toMatch(/animation|transition/)
  })
})

describe('sheets-reel 內容', () => {
  it('合計是真的加總', () => {
    expect(sum(ROWS)).toBe(31500)
    expect(money(31500)).toBe('31,500')
  })
  it('修改:框起 2 格、合計同步,按復原後還原', () => {
    const at = (l: number) => frameSvg({ scene: 'edit', prev: null }, l, 5800)
    expect(at(1000)).toContain('31,500')
    expect(at(3000)).toContain('33,500')
    expect(at(3000)).toContain('已更新 2 個儲存格')
    expect(at(5500)).toContain('31,500')
    expect(at(5500)).not.toContain('33,500')
  })
  it('步驟標示與收尾', () => {
    expect(frameSvg({ scene: 'open', prev: null }, 100000, 6000)).toContain('步驟 1')
    expect(frameSvg({ scene: 'export', prev: null }, 100000, 4500)).toContain('.xlsx')
    expect(frameSvg({ scene: 'outro', prev: null }, 100000, 4500)).toContain('基本功能')
  })
})
