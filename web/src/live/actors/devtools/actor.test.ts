import { describe, expect, it } from 'vitest'
import actor from './actor'

describe('devtools 的操作', () => {
  const start = (props = {}) => actor.init!(props)
  const opened = () => actor.apply!(start(), 'open', { open: 'title' })

  it('右鍵檢查會打開並選中那一行;選取模式點網頁會切回 Elements', () => {
    const st = opened()
    expect(st).toMatchObject({ open: true, tab: 'elements', selected: 'title' })
    let s2 = actor.apply!(st, 'tab', { tab: 'Network' })
    s2 = actor.apply!(s2, 'pick', { pick: true })
    s2 = actor.apply!(s2, 'hover', { hover: 'nav' })
    expect(s2.expanded).toContain('header')
    s2 = actor.apply!(s2, 'inspect', { inspect: 'cart' })
    expect(s2).toMatchObject({ tab: 'elements', selected: 'cart', temp: {} })
  })

  it('操作對不上狀態時報錯', () => {
    expect(() => actor.apply!(start(), 'tab', { tab: 'network' })).toThrow('還沒打開')
    expect(() => actor.apply!(opened(), 'tab', { tab: 'sources' })).toThrow('沒有「sources」')
    expect(() => actor.apply!(opened(), 'inspect', { inspect: 'banner' })).toThrow('沒有叫')
    expect(() => actor.apply!(opened(), 'open', { open: true })).toThrow('已經打開')
    expect(() => actor.apply!(opened(), 'inspect', { inspect: 'logo' })).toThrow('收合')
    const picking = actor.apply!(opened(), 'pick', { pick: true })
    expect(() => actor.apply!(picking, 'hover', { hover: 'meta' })).toThrow('網頁上看不到')
    expect(() => actor.apply!(picking, 'click', { click: 'buy' })).toThrow('inspect')
  })

  it('Network 要在開著時重新整理才有紀錄,request 可以用名稱或第幾列', () => {
    const closedReload = actor.apply!(start(), 'reload', { reload: true })
    expect(closedReload.recorded).toBe(false)
    let st = actor.apply!(opened(), 'tab', { tab: 'network' })
    expect(() => actor.apply!(st, 'request', { request: 1 })).toThrow('還沒有紀錄')
    st = actor.apply!(st, 'reload', { reload: true })
    expect(actor.apply!(st, 'request', { request: 'app.js' }).request).toBe(2)
    expect(actor.apply!(st, 'request', { request: 1 }).request).toBe(0)
    expect(() => actor.apply!(st, 'request', { request: 99 })).toThrow('沒有「99」')
  })

  it('重新整理會清空 Console;收合會改選上層', () => {
    let st = actor.apply!(opened(), 'error', { error: '壞了' })
    expect(st.console.at(-1)).toMatchObject({ level: 'error', src: 'app.js' })
    expect(actor.apply!(st, 'reload', { reload: true }).console).toEqual([])
    st = actor.apply!(st, 'inspect', { inspect: 'price' })
    st = actor.apply!(st, 'collapse', { collapse: 'card' })
    expect(st.selected).toBe('card')
  })

  it('長度與虛擬滑鼠', () => {
    expect(actor.duration('reload', { reload: true }, {}, undefined)).toBeGreaterThan(2000)
    expect(actor.cursor!('inspect', { inspect: 'buy' }, actor.apply!(opened(), 'pick', { pick: true }))?.moves[0].target).toBe('el:buy')
    expect(actor.cursor!('inspect', { inspect: 'buy' }, opened())?.moves[0].target).toBe('node:buy')
  })
})
