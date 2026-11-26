import { describe, expect, it } from 'vitest'
import actor, { type WorldState } from './actor'

describe('fable-world', () => {

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
