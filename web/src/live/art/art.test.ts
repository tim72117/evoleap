import { describe, expect, it } from 'vitest'
import { capsule, capsuleShine, onQuad, solveArm, type Quad } from './geometry'
import { DEFAULT_KB, bokehDots, deskSvg, foreSvg, onKeyboard, raysSvg, roomSvg } from './office'
import { DEFAULT_BOT, manSvg, robotSvg } from './characters'
import { ART, BOT, DESK_Y, KB } from '../actors/agent-office/layout'
import { holoIn, holoStyle } from './fx/hologram'
import { codeHtml, highlight, streamed, totalChars } from './fx/codeStream'
import { dustAt, makeDust, rayOpacity } from './fx/ambient'
import { grainOffset } from './fx/finish'
import { WIDE_CAM, closeness, layerTransform, lerpCam } from './fx/camera'

const sha = async (s: string): Promise<{ len: number; sha1: string }> => ({
  len: s.length,
  sha1: [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join(''),
})

// 輸出指紋(長度 + sha1):預設值要永遠產生一樣的字串。roomSvg、deskSvg、manSvg 在 2026-11-13 改成畫到舞台外(視窗比例不同時背景也要填滿,見 office.ts 的 BLEED)後重取;其他沒變。
const REF = {
  roomSvg: { len: 13746, sha1: '6c21024956831fb5b84e0d1e91e72b32694e600f' },
  raysSvg: { len: 753, sha1: 'fb0682712c30c36d2e274029337431d250e08121' },
  deskSvg: { len: 7917, sha1: '995778116245851bb731b98d49088ff3444ac258' },
  foreSvg: { len: 441, sha1: '9398f3b1c90042c025a7cfefbe9dd1dac88e4c8d' },
  robotSvg: { len: 10926, sha1: 'a4b02de715099b2e5da14fd17c147ead769076ad' },
  manSvg: { len: 7695, sha1: '6ab0c124d05f612c49c8502f282300c25fbd8cdf' },
  bokeh: { len: 1456, sha1: '54448b4f32511ccc36df431256670f1d8acfb3e7' },
}

describe('art/office、characters:預設輸出與抽出前一樣', () => {
  it('預設值的 SVG 字串指紋', async () => {
    expect(await sha(roomSvg())).toEqual(REF.roomSvg)
    expect(await sha(raysSvg())).toEqual(REF.raysSvg)
    expect(await sha(deskSvg())).toEqual(REF.deskSvg)
    expect(await sha(foreSvg())).toEqual(REF.foreSvg)
    expect(await sha(robotSvg())).toEqual(REF.robotSvg)
    expect(await sha(manSvg())).toEqual(REF.manSvg)
    expect(await sha(JSON.stringify(bokehDots()))).toEqual(REF.bokeh)
  })

  it('agent-office 傳進去的版面 = 預設值(兩份常數不會各自跑掉)', () => {
    expect(DESK_Y).toBe(772)
    expect(KB).toEqual(DEFAULT_KB)
    expect(BOT).toEqual(DEFAULT_BOT)
    expect(roomSvg(ART)).toBe(roomSvg())
    expect(raysSvg(ART)).toBe(raysSvg())
    expect(deskSvg(ART)).toBe(deskSvg())
    expect(foreSvg(ART)).toBe(foreSvg())
    expect(robotSvg(ART)).toBe(robotSvg())
    expect(manSvg(ART)).toBe(manSvg())
  })

  it('換前綴:id / class 全換、沒有殘留的 ao-;換版面會動到輸出', () => {
    for (const svg of [roomSvg({ prefix: 'x' }), raysSvg({ prefix: 'x' }), deskSvg({ prefix: 'x' }), foreSvg({ prefix: 'x' }), robotSvg({ prefix: 'x' }), manSvg({ prefix: 'x' })]) {
      expect(svg).not.toContain('ao-')
      expect(svg).toContain('x-')
    }
    expect(deskSvg({ deskY: 700 })).not.toBe(deskSvg())
    expect(deskSvg({ kb: { ...KB, tl: { x: 0, y: 0 } } })).not.toBe(deskSvg())
    expect(robotSvg({ bot: { ...BOT, rx: 50 } })).not.toBe(robotSvg())
    expect(roomSvg({ seed: 1 })).not.toBe(roomSvg())
  })

  it('散景:固定種子、數量與落點', () => {
    const d = bokehDots()
    expect(d).toHaveLength(16)
    expect(bokehDots()).toEqual(d)
    expect(d.slice(0, 9).every((b) => b.x < 760)).toBe(true)
    expect(bokehDots({ count: 4, onWindow: 2 })).toHaveLength(4)
  })
})

describe('art/geometry', () => {
  const Q: Quad = { tl: { x: 10, y: 20 }, tr: { x: 110, y: 10 }, br: { x: 130, y: 90 }, bl: { x: 0, y: 100 } }
  it('onQuad / onKeyboard:四個角對到四邊形的角,中心在平均', () => {
    expect(onQuad(Q, 0, 0)).toEqual(Q.tl)
    expect(onQuad(Q, 1, 0)).toEqual(Q.tr)
    expect(onQuad(Q, 1, 1)).toEqual(Q.br)
    expect(onQuad(Q, 0, 1)).toEqual(Q.bl)
    const c = onQuad(Q, 0.5, 0.5)
    expect(c.x).toBeCloseTo((10 + 110 + 130 + 0) / 4)
    expect(c.y).toBeCloseTo((20 + 10 + 90 + 100) / 4)
    expect(onKeyboard(0, 0)).toEqual(DEFAULT_KB.tl)
    expect(onKeyboard(1, 0)).toEqual(DEFAULT_KB.tr)
    expect(onKeyboard(1, 1)).toEqual(DEFAULT_KB.br)
    expect(onKeyboard(0, 1)).toEqual(DEFAULT_KB.bl)
    expect(onKeyboard(0.5, 0.5)).toEqual({ x: 873.5, y: 831 })
    expect(onKeyboard(1, 1, Q)).toEqual(Q.br)
  })

  it('solveArm:夠得到時手腕就是目標、兩節長度不變;夠不到時拉到最遠', () => {
    const s = { x: 1352, y: 652 }
    for (const t of [
      { x: 1100, y: 760 },
      { x: 1200, y: 700 },
      { x: 1000, y: 500 },
      { x: 1352, y: 900 },
    ]) {
      const { elbow, wrist } = solveArm(s, t, 204, 218)
      expect(wrist.x).toBeCloseTo(t.x, 6)
      expect(wrist.y).toBeCloseTo(t.y, 6)
      expect(Math.hypot(elbow.x - s.x, elbow.y - s.y)).toBeCloseTo(204, 6)
      expect(Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y)).toBeCloseTo(218, 6)
    }
    const far = solveArm(s, { x: 0, y: 0 }, 204, 218)
    expect(Math.hypot(far.wrist.x - s.x, far.wrist.y - s.y)).toBeCloseTo(204 + 218 - 0.5, 6)
    const near = solveArm(s, { x: s.x + 1, y: s.y }, 204, 218)
    expect(Math.hypot(near.wrist.x - s.x, near.wrist.y - s.y)).toBeCloseTo(Math.abs(204 - 218) + 1, 6)
    // bend:1 手肘在連線下方、-1 在上方
    const t = { x: 1100, y: 700 }
    expect(solveArm(s, t, 204, 218, 1).elbow.y).toBeGreaterThan(solveArm(s, t, 204, 218, -1).elbow.y)
    // 已知的數值(抽出前的輸出)
    const ref = solveArm(s, { x: 900, y: 800 }, 204, 218)
    expect(ref.elbow.x).toBeCloseTo(1161.5671786822197, 9)
    expect(ref.elbow.y).toBeCloseTo(725.1528575309978, 9)
  })

  it('capsule / capsuleShine 是 path 字串', () => {
    const c = capsule({ x: 1, y: 2 }, { x: 100, y: 80 }, 30, 20)
    expect(c).toMatch(/^M[\d. -]+L[\d. -]+A20\.0 20\.0 0 0 1 .*Z$/)
    expect(capsuleShine({ x: 1, y: 2 }, { x: 100, y: 80 }, 30, 20)).toMatch(/^M-?[\d.]+ -?[\d.]+ L-?[\d.]+ -?[\d.]+$/)
  })
})

describe('art/fx', () => {
  it('holoIn:p≤0 隱藏、p≥1 全開、中間在 0–1;同一個 p 結果固定', () => {
    expect(holoIn(0, 11)).toEqual({ op: 0, sy: 0.02 })
    expect(holoIn(1, 11)).toEqual({ op: 1, sy: 1 })
    for (let p = 0.05; p < 1; p += 0.05) {
      const h = holoIn(p, 37)
      expect(h.op).toBeGreaterThanOrEqual(0)
      expect(h.op).toBeLessThanOrEqual(1)
      expect(h.sy).toBeGreaterThanOrEqual(0.02)
      expect(h.sy).toBeLessThanOrEqual(1)
      expect(holoIn(p, 37)).toEqual(h)
    }
    expect(holoStyle(0, 1, 'translate(0, 0)')).toEqual({ opacity: '0.000', visibility: 'hidden', transform: 'translate(0, 0) scaleY(0.020)' })
    expect(holoStyle(1, 1, '', 0.5)).toEqual({ opacity: '0.500', visibility: 'visible', transform: ' scaleY(1.000)' })
  })

  it('codeStream:串流、上色、組 HTML', () => {
    const L = ['<a href="x">', 'hi']
    expect(totalChars(L)).toBe(12 + 1 + 2 + 1)
    expect(streamed(L, 0)).toEqual([])
    expect(streamed(L, 5)).toEqual(['<a hr'])
    expect(streamed(L, 14)).toEqual(['<a href="x">', 'h'])
    expect(streamed(L, 999)).toEqual(L)
    expect(highlight('<a href="x">', 'html')).toContain('<b class="art-a">href</b>')
    expect(highlight('/* c */', 'css')).toBe('<b class="art-c">/* c */</b>')
    expect(highlight('a { color: red; }', 'css')).toContain('<b class="art-t">a </b>{')
    const html = codeHtml(['a', 'b', 'c'], { lang: 'html', tail: 2, numbers: true, caret: true })
    expect(html).toBe('<div><em>2</em>b</div><div><em>3</em>c<i class="art-caret"></i></div>')
  })

  it('ambient / finish:固定種子,同一時間結果一樣', () => {
    const d = makeDust()
    expect(d).toHaveLength(34)
    expect(makeDust()).toEqual(d)
    expect(dustAt(d[3], 4000)).toEqual(dustAt(d[3], 4000))
    const p = dustAt(d[3], 4000)
    expect(p.opacity).toBeGreaterThan(0)
    expect(p.opacity).toBeLessThanOrEqual(0.8)
    expect(rayOpacity(1, 1234)).toBeGreaterThanOrEqual(0.5)
    expect(grainOffset(100)).toEqual(grainOffset(150)) // 同一個 83ms 區間
    expect(grainOffset(100)).not.toEqual(grainOffset(1000))
  })

  it('camera:廣角鏡頭沒有位移;推近時前景比遠景動得多', () => {
    expect(layerTransform(WIDE_CAM, 1)).toBe('translate(0.0px, 0.0px) scale(1.0000)')
    const cam = { x: 870, y: 505, z: 1.22 }
    expect(lerpCam(WIDE_CAM, cam, 0)).toEqual(WIDE_CAM)
    expect(lerpCam(WIDE_CAM, cam, 1)).toEqual(cam)
    expect(closeness(WIDE_CAM)).toBe(0)
    expect(closeness(cam)).toBeCloseTo(0.22 / 0.3)
    const sc = (d: number): number => Number(/scale\(([\d.]+)\)/.exec(layerTransform(cam, d))![1])
    expect(sc(0.45)).toBeLessThan(sc(1))
    expect(sc(1)).toBeLessThan(sc(1.3))
  })
})
