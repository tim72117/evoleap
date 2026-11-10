import { describe, expect, it } from 'vitest'
import type { StageScript } from '../../../../live/types'
import lesson from '../../../../content/live/lab/fable/0.1.json'
import actor, { type WorldState, type WorldStep } from './actor'

const STAGE = ['card', 'callout', 'show', 'hide', 'move', 'checkpoint', 'wait', 'parts']

/** 照舞台載入的方式(stage.ts):從 init 開始,依序 apply 演員的每個動作;回傳最後的狀態 */
function run(script: StageScript): WorldState {
  const id = Object.keys(script.cast).find((k) => script.cast[k].actor === 'fable-world')!
  let st = actor.init!(script.cast[id].props ?? {})
  script.steps.forEach((raw, i) => {
    const s = raw as Record<string, unknown>
    if (s.on && s.on !== id) return
    if (STAGE.some((k) => k in s)) return
    const kinds = actor.kinds.filter((k) => k in s)
    if (!kinds.length) return // 其他演員(fable-sky)的動作
    try {
      st = actor.apply!(st, kinds[0], s as WorldStep)
    } catch (e) {
      throw new Error(`第 ${i + 1} 步 ${JSON.stringify(s).slice(0, 60)}:${e instanceof Error ? e.message : e}`)
    }
  })
  return st
}

describe('fable-world', () => {
  it('0.1 的腳本演得完,最後朋友看到了網站', () => {
    const st = run(lesson as unknown as StageScript)
    expect(st.deployed).toBe(true)
    expect(st.server).toBe(true)
    expect(st.visit).toMatchObject({ host: 'domain', result: 'site' })
  })

  it('朋友打開什麼網址會看到什麼,由當時的狀態決定', () => {
    let st = actor.init!({})
    st = actor.apply!(st, 'visit', { visit: 'http://localhost:5173' })
    expect(st.visit?.result).toBe('fail')
    st = actor.apply!(st, 'visit', { visit: 'https://www.example.com' })
    expect(st.visit?.result).toBe('fail') // 還沒上線
    st = actor.apply!(st, 'deploy', { deploy: true })
    st = actor.apply!(st, 'visit', { visit: 'https://www.example.com' })
    expect(st.visit?.result).toBe('site')
    st = actor.apply!(st, 'power', { power: false })
    st = actor.apply!(st, 'visit', { visit: 'https://www.example.com' })
    expect(st.visit?.result).toBe('down')
  })

  it('只有上線後的網域連得到網站;本機位址與別的網址都找不到', () => {
    let st = actor.apply!(actor.init!({ domain: 'shop.example.tw' }), 'deploy', { deploy: true })
    const visit = (url: string): WorldState['visit'] => (st = actor.apply!(st, 'visit', { visit: url })).visit
    expect(visit('https://shop.example.tw/menu')).toMatchObject({ host: 'domain', name: 'shop.example.tw', result: 'site' })
    expect(visit('SHOP.example.tw:443')).toMatchObject({ host: 'domain', result: 'site' })
    expect(visit('https://google.com')).toMatchObject({ host: 'other', name: 'google.com', result: 'fail' })
    expect(visit('https://www.example.com')).toMatchObject({ host: 'other', result: 'fail' }) // 預設網域不是這個網站的
    for (const url of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173', 'http://0.0.0.0:5173', 'http://app.localhost'])
      expect(visit(url)).toMatchObject({ host: 'local', result: 'fail' })
    expect(visit('http://[::1]:5173')?.name).toBe('[::1]')
    expect(visit('https://user@shop.example.tw')).toMatchObject({ host: 'domain', result: 'site' })
    expect(() => visit('https://')).toThrow(/不是網址/)
  })

  it('操作對不上狀態時報錯', () => {
    const st = actor.init!({})
    expect(() => actor.apply!(st, 'open', { open: true })).toThrow(/boot/)
    expect(() => actor.apply!(st, 'stop', { stop: true })).toThrow()
    expect(() => actor.apply!(st, 'doors', { doors: true })).toThrow(/reveal/)
    expect(() => actor.apply!(actor.apply!(st, 'deploy', { deploy: true }), 'deploy', { deploy: true })).toThrow(/上線/)
  })
})
