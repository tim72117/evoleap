import { describe, expect, it } from 'vitest'
import type { StageScript } from '../../types'
import demo from '../../../content/live/lab/actors/agent-office.json'
import actor, { dollyOf, questionOf, type OfficeState, type OfficeStep } from './actor'

const STAGE = ['card', 'callout', 'show', 'hide', 'move', 'checkpoint', 'wait', 'parts']

/** 照舞台載入的方式(stage.ts):從 init 開始,依序 apply 演員的每個動作;回傳最後的狀態 */
function run(script: StageScript): OfficeState {
  const id = Object.keys(script.cast).find((k) => script.cast[k].actor === 'agent-office')!
  let st = actor.init!(script.cast[id].props ?? {})
  script.steps.forEach((raw, i) => {
    const s = raw as Record<string, unknown>
    if (STAGE.some((k) => k in s)) return
    const kinds = actor.kinds.filter((k) => k in s)
    if (!kinds.length) return
    try {
      st = actor.apply!(st, kinds[0], s as OfficeStep)
    } catch (e) {
      throw new Error(`第 ${i + 1} 步 ${JSON.stringify(s).slice(0, 60)}:${e instanceof Error ? e.message : e}`)
    }
  })
  return st
}
const steps = (st: OfficeState, list: OfficeStep[]): OfficeState =>
  list.reduce((s, x) => actor.apply!(s, actor.kinds.find((k) => k in x)!, x), st)

describe('agent-office', () => {
  it('示範腳本演得完,最後完成、權限是第二次問才允許', () => {
    const st = run(demo as unknown as StageScript)
    expect(st).toMatchObject({ built: true, checked: true, fixed: true, done: true })
    expect(st.ask).toMatchObject({ status: 'allowed', n: 2 })
  })

  it('動作名稱不跟舞台的動作撞名', () => {
    for (const k of actor.kinds) expect(STAGE).not.toContain(k)
  })

  it('順序不對時報錯', () => {
    const st = actor.init!({})
    expect(() => actor.apply!(st, 'plan', { plan: true })).toThrow(/need/)
    expect(() => actor.apply!(st, 'need', { need: '  ' })).toThrow(/字串/)
    const said = steps(st, [{ need: '做網站' }])
    expect(() => actor.apply!(said, 'need', { need: '再一次' })).toThrow(/說一次/)
    expect(() => actor.apply!(said, 'ask', { ask: '建立 index.html' })).toThrow(/plan/)
    const planned = steps(said, [{ plan: true }])
    expect(() => actor.apply!(planned, 'allow', { allow: true })).toThrow(/ask/)
    expect(() => actor.apply!(planned, 'build', { build: true })).toThrow(/允許/)
    const asked = steps(planned, [{ ask: '建立 index.html' }])
    expect(() => actor.apply!(asked, 'ask', { ask: '再問' })).toThrow(/還沒回答/)
    expect(() => actor.apply!(asked, 'allow', { allow: 'yes' as unknown as boolean })).toThrow(/true 或 false/)
    const denied = steps(asked, [{ allow: false }])
    expect(denied.ask?.status).toBe('denied')
    expect(() => actor.apply!(denied, 'build', { build: true })).toThrow(/允許/)
    const built = steps(denied, [{ ask: '換個方式' }, { allow: true }, { build: true }])
    expect(() => actor.apply!(built, 'fix', { fix: true })).toThrow(/check/)
    expect(() => actor.apply!(built, 'done', { done: true })).toThrow(/fix/)
    expect(() => actor.apply!(built, 'build', { build: true })).toThrow(/做過/)
  })

  it('hotspots 依狀態給下一步,而且每一步都套用得上', () => {
    let st = actor.init!({})
    const seen: string[] = []
    for (let i = 0; i < 20 && !st.done; i++) {
      const spots = actor.hotspots!(st, {})
      expect(spots.length).toBeGreaterThan(0)
      // 有允許/拒絕時,第一次按拒絕、之後按允許,把「換個方式再問」也走一遍
      const pick = spots.find((s) => s.target === 'deny' && !seen.includes('deny')) ?? spots.find((s) => s.target !== 'deny') ?? spots[0]
      seen.push(pick.target)
      st = steps(st, [pick.step!])
    }
    expect(st.done).toBe(true)
    expect(seen).toEqual(['human', 'robot', 'plan', 'deny', 'plan', 'allow', 'monitor', 'monitor', 'issue', 'human'])
    expect(actor.hotspots!(st, {})).toEqual([])
  })

  it('權限問題的句子與鏡頭', () => {
    expect(questionOf('建立 index.html')).toBe('可以建立 index.html 嗎？')
    expect(questionOf('刪掉舊檔案')).toBe('可以刪掉舊檔案嗎？')
    expect(questionOf('要繼續嗎？')).toBe('要繼續嗎？')
    const st = actor.init!({})
    expect(dollyOf(st).z).toBe(1)
    expect(dollyOf({ ...st, built: true }).z).toBeGreaterThan(1)
    expect(dollyOf({ ...st, built: true, checked: true, fixed: true, done: true }).z).toBe(1)
  })
})
