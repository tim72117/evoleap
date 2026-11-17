import { describe, expect, it } from 'vitest'
import actor, { apply, drawFit, frameSvg, SCENES, T, type ReelState } from './actor'

const init = actor.init!({}) as ReelState
const at = (scene: ReelState['scene'], l: number) => frameSvg({ scene, prev: null }, l, 9000)

describe('remote-reel 動作', () => {
  it('scene 要是已知的段落', () => {
    expect(() => apply(init, 'scene', { scene: 'nope' as never })).toThrow(/scene/)
    expect(() => apply(init, 'scene', {})).toThrow()
    expect(apply({ scene: 'hook', prev: null }, 'scene', { scene: 'pain' })).toEqual({ scene: 'pain', prev: 'hook' })
  })
})

describe('remote-reel 畫面是時間的純函式', () => {
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

describe('remote-reel 內容', () => {
  it('開場是下班、辦公室電腦還在跑;痛點卡在等允許', () => {
    expect(at('hook', 3000)).toContain('辦公室電腦')
    expect(at('hook', 100000)).toContain('你先回家了')
    expect(at('pain', 100000)).toContain('在等你按下去')
  })
  it('轉折:辦公室電腦與家裡的手機是同一個 session', () => {
    const s = at('link', 100000)
    expect(s).toContain('遠端使用 session')
    expect(s).toContain('同一個 session')
    expect(s).toContain('家裡的手機')
  })
  it('手機操作:按下允許之前是詢問,按下之後已允許、辦公室電腦開始執行', () => {
    expect(at('phone', 2500)).toContain('要允許執行嗎？')
    expect(at('phone', 2500)).not.toContain('已允許')
    expect(at('phone', 3600)).toContain('已允許')
    expect(at('phone', 4100)).toContain('$ npm run fix')
    expect(at('phone', 100000)).toContain('已修正，全部通過')
  })
  it('三個好處與結尾', () => {
    const b = at('benefits', 100000)
    for (const t of ['手機看進度', '手機按允許', '留在原本那台電腦']) expect(b).toContain(t)
    expect(at('follow', 3000)).toContain('點左下角追蹤')
  })
  it('段落比設計長度短時動畫等比例加快:在實際長度內演完,和設計長度的最後一格相同', () => {
    for (const scene of SCENES) {
      const D = Math.round(T[scene] * 0.6)
      expect(drawFit(scene, D, D)).toEqual(drawFit(scene, T[scene], T[scene]))
    }
  })
})
