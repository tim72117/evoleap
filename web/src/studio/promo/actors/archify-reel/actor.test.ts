import { describe, expect, it } from 'vitest'
import actor, { apply, frameSvg, SCENES, T, type ReelState } from './actor'
import { counter, curve, fmt, REPOS } from './growth'
import { BAD_LINE, JSON_LINES, clipTokens, tokens } from './flow'
import { hash } from './draw'

const init = actor.init!({}) as ReelState

describe('archify-reel 動作', () => {
  it('scene 要是已知的段落', () => {
    expect(() => apply(init, 'scene', { scene: 'nope' as never })).toThrow(/scene/)
    expect(() => apply(init, 'scene', {})).toThrow()
    expect(apply(init, 'scene', { scene: 'ir' })).toEqual({ scene: 'ir', prev: null })
    expect(apply({ scene: 'ir', prev: null }, 'scene', { scene: 'style' })).toEqual({ scene: 'style', prev: 'ir' })
  })
})

describe('archify-reel 畫面是時間的純函式', () => {
  for (const sc of SCENES) {
    it(`${sc}:同一個時間點同一個畫面,沒有 NaN,結束後仍有內容`, () => {
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
  it('換景時舊畫面與新畫面交叉淡化', () => {
    const st: ReelState = { scene: 'assist', prev: 'growth' }
    expect(frameSvg(st, 100, 9000)).toContain('opacity="0.69"')
    expect(frameSvg(st, 600, 9000)).not.toContain('96,093')
  })
  it('不用任何 CSS 動畫或 Math.random', () => {
    const svg = SCENES.map((s) => frameSvg({ scene: s, prev: null }, 3000, 9000)).join('')
    expect(svg).not.toMatch(/animation|transition/)
  })
})

describe('archify-reel 成長(終點數字是真的,過程是示意)', () => {
  it('計數器單調上升,終點停在真實星數', () => {
    let last = -1
    for (let p = 0; p <= 1; p += 0.02) {
      const v = counter(p, REPOS[0].stars)
      expect(v).toBeGreaterThanOrEqual(last)
      last = v
    }
    expect(counter(1, 96093)).toBe(96093)
    expect(counter(1, 66821)).toBe(66821)
    expect(counter(0, 96093)).toBe(0)
  })
  it('曲線是上升且越來越陡', () => {
    expect(curve(0)).toBe(0)
    expect(curve(1)).toBeCloseTo(1)
    expect(curve(0.5)).toBeLessThan(0.3)
  })
  it('只用已查證的數字', () => {
    expect(REPOS.map((r) => [r.stars, r.forks])).toEqual([[96093, 6572], [66821, 4449]])
    expect(fmt(96093)).toBe('96,093')
  })
  it('結尾畫面有兩個專案的星數與 fork 數', () => {
    const svg = frameSvg({ scene: 'repos', prev: null }, 100000, 4500)
    for (const t of ['96,093', '66,821', '6,572', '4,449', 'Apache-2.0', 'MIT']) expect(svg).toContain(t)
  })
})

describe('archify-reel 結構化描述與驗證', () => {
  it('被擋下的那一行引用了沒宣告的節點', () => {
    expect(JSON_LINES[BAD_LINE]).toContain('"cache"')
    expect(JSON_LINES.join('')).not.toContain('"id": "cache"')
  })
  it('上色的片段合起來還是原本的文字,可以只露出前 n 個字', () => {
    for (const line of JSON_LINES) expect(tokens(line).map((t) => t.t).join('')).toBe(line)
    expect(clipTokens('{ "id": "web" }', 4).replace(/<[^>]+>/g, '')).toBe('{ &quot;i')
  })
  it('驗證時出現紅色提示,修正後變綠', () => {
    const red = frameSvg({ scene: 'ir', prev: null }, 8600 * 0.64, 8600)
    expect(red).toContain('unknown node')
    const green = frameSvg({ scene: 'ir', prev: null }, 8600 * 0.85, 8600)
    expect(green).toContain('valid')
    expect(green).not.toContain('"cache"')
  })
})

describe('hash', () => {
  it('同一個 seed 同一個值,範圍 0–1', () => {
    for (let i = 0; i < 50; i++) {
      expect(hash(i)).toBe(hash(i))
      expect(hash(i)).toBeGreaterThanOrEqual(0)
      expect(hash(i)).toBeLessThan(1)
    }
  })
})
