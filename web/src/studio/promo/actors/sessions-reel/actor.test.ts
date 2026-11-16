import { describe, expect, it } from 'vitest'
import actor, { apply, frameSvg, SCENES, T, type ReelState } from './actor'

const init = actor.init!({}) as ReelState
const at = (scene: ReelState['scene'], l: number) => frameSvg({ scene, prev: null }, l, 9000)

describe('sessions-reel 動作', () => {
  it('scene 要是已知的段落', () => {
    expect(() => apply(init, 'scene', { scene: 'nope' as never })).toThrow(/scene/)
    expect(() => apply(init, 'scene', {})).toThrow()
    expect(apply({ scene: 'hook', prev: null }, 'scene', { scene: 'pain' })).toEqual({ scene: 'pain', prev: 'hook' })
  })
})

describe('sessions-reel 畫面是時間的純函式', () => {
  for (const sc of SCENES) {
    it(`${sc}:同一時間點同一畫面,沒有 NaN,結束後仍有內容`, () => {
      const st: ReelState = { scene: sc, prev: null }
      const D = T[sc]
      for (let l = 0; l <= D; l += D / 40) {
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

describe('sessions-reel 內容', () => {
  it('結尾箭頭指向左下角的粉絲團頭像', () => {
    expect(at('follow', 3000)).toContain('粉絲團')
    expect(at('follow', 3000)).toContain('點左下角追蹤')
    expect(at('follow', 3000)).toContain('<polygon points="0,0 -46,-44')
  })
  it('三張牌:先扇形攤開(牌背),再一張一張翻開,前一張翻回去;牌面只有圖示和一句重點', () => {
    expect(at('fetch', 200)).not.toContain('取資料')
    expect(at('fetch', 100000)).toContain('先問清楚規格')
    expect(at('send', 100000)).toContain('有問題就通知')
    expect(at('send', 100000)).not.toContain('先問清楚規格')
    expect(at('coord', 100000)).toContain('修好發布再通知')
    expect(at('coord', 100000)).not.toContain('有問題就通知')
  })
})
