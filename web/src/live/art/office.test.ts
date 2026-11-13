import { describe, expect, it } from 'vitest'
import * as agent from '../actors/agent-office/layout'
import * as manual from '../actors/manual-office/layout'
import { MAN_HEAD } from './manRig'
import { BARS_N, WAVE_N, barScale, decoLine, layerMarkup, officeMarkup } from './backdrop'
import { agentWindowMarkup, browserMarkup, dashMarkup, decoMarkup, needMarkup } from './panels'

describe('兩個辦公室場景的版面只有一份(交接靠它們一模一樣)', () => {
  it('manual-office 的桌子、螢幕、鍵盤、機器人、人的座標都是 agent-office 的同一個物件', () => {
    for (const k of ['ARM', 'BOT', 'DESK_Y', 'KB', 'MAN', 'MON', 'onKb'] as const) expect(Object.is(manual[k], agent[k])).toBe(true)
  })
  it('傳給 art/ 的選項除了前綴完全相同(引用同一份)', () => {
    const { prefix: pa, ...a } = agent.ART
    const { prefix: pm, ...m } = manual.ART
    expect([pa, pm]).toEqual(['ao', 'mo'])
    expect(m.bot).toBe(a.bot)
    expect(m.kb).toBe(a.kb)
    expect(m).toEqual(a)
  })
  it('人的頭在 manRig 與版面裡是同一個點', () => {
    expect(MAN_HEAD).toEqual(agent.MAN.head)
  })
})

describe('art/backdrop 與 art/panels', () => {
  it('officeMarkup:room、rays 在最底,中間是場景的層,fore 與調色在最上', () => {
    const html = officeMarkup(agent.ART, layerMarkup('x-mid', 'MID'))
    const at = (s: string): number => html.indexOf(s)
    expect(at('art-room')).toBeLessThan(at('art-rays'))
    expect(at('art-rays')).toBeLessThan(at('x-mid'))
    expect(at('x-mid')).toBeLessThan(at('art-fore'))
    expect(at('art-fore')).toBeLessThan(at('art-grain'))
    expect(html).toContain('class="art-L x-mid">MID</div>')
    expect(html).toContain('ao-ray')
    expect(officeMarkup(manual.ART, '')).toContain('mo-ray')
  })
  it('長條與聲波的數量、barScale 在 0.25–0.95', () => {
    expect(dashMarkup().match(/<i><\/i>/g)).toHaveLength(BARS_N)
    expect(needMarkup().match(/<i><\/i>/g)).toHaveLength(WAVE_N)
    for (let i = 0; i < BARS_N; i++) {
      for (const ms of [0, 1234, 99999]) {
        expect(barScale(i, ms)).toBeGreaterThanOrEqual(0.25 - 1e-9)
        expect(barScale(i, ms)).toBeLessThanOrEqual(0.95 + 1e-9)
      }
    }
  })
  it('decoLine:31 個點、x 從 0 到 300,同一個 ms 結果固定', () => {
    const pts = decoLine(91, 18, 40, 500).split(' ')
    expect(pts).toHaveLength(31)
    expect(pts[0].startsWith('0,')).toBe(true)
    expect(pts[30].startsWith('300,')).toBe(true)
    expect(decoLine(91, 18, 40, 500)).toBe(decoLine(91, 18, 40, 500))
  })
  it('面板 markup 帶著 actor 要查的 class,網站名稱會跳脫', () => {
    expect(agentWindowMarkup('<b>', 'MSG')).toContain('AI Agent · ~/&lt;b&gt;')
    expect(agentWindowMarkup('x', 'MSG')).toContain('<div class="art-msgs">MSG</div>')
    expect(browserMarkup('PAGE')).toContain('<div class="art-page">PAGE</div>')
    expect(browserMarkup('')).toContain('art-url')
    expect(decoMarkup()).toContain('art-deco-l2')
    expect(needMarkup('mo-say')).toContain('art-need mo-say')
    expect(dashMarkup('EXTRA')).toContain('EXTRA</div>')
  })
})
