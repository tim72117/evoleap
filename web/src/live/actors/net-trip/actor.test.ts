import { describe, expect, it } from 'vitest'
import actor, { fileOf, parseUrl } from './actor'

const start = () => actor.init!({})

describe('net-trip 的操作', () => {
  const resolved = () => ['type', 'enter', 'lookup', 'answer'].reduce((st, k) => actor.apply!(st, k as 'type', k === 'type' ? { type: 'www.example.com' } : { [k]: true }), start())

  it('照順序走完會畫出首頁,記得 IP', () => {
    let st = actor.apply!(resolved(), 'request', { request: true })
    st = actor.apply!(st, 'respond', { respond: true })
    expect(st.response).toEqual({ status: 200, file: 'index.html' })
    st = actor.apply!(st, 'render', { render: true })
    expect(st.shown?.kind).toBe('page')
    expect(st.cache['www.example.com']).toBe('93.184.216.34')
  })

  it('順序不對時報錯', () => {
    expect(() => actor.apply!(start(), 'respond', { respond: true })).toThrow('先用 request')
    expect(() => actor.apply!(start(), 'enter', { enter: true })).toThrow('先用 type')
    expect(() => actor.apply!(start(), 'render', { render: true })).toThrow('先用 respond')
    const entered = actor.apply!(actor.apply!(start(), 'type', { type: 'www.example.com' }), 'enter', { enter: true })
    expect(() => actor.apply!(entered, 'request', { request: true })).toThrow('還不知道')
    expect(() => actor.apply!(entered, 'answer', { answer: true })).toThrow('先用 lookup')
  })

  it('查不到網域、伺服器關機、找不到頁面', () => {
    const other = ['type', 'enter', 'lookup', 'answer'].reduce((st, k) => actor.apply!(st, k as 'type', k === 'type' ? { type: 'shop.example.org' } : { [k]: true }), start())
    expect(other.shown).toMatchObject({ kind: 'error', error: 'dns' })
    const down = actor.apply!(actor.apply!(resolved(), 'power', { power: false }), 'request', { request: true })
    expect(down.shown).toMatchObject({ kind: 'error', error: 'down' })
    expect(() => actor.apply!(start(), 'power', { power: true })).toThrow('已經開機')
    let st = actor.apply!(actor.apply!(resolved(), 'type', { type: 'www.example.com/menu' }), 'enter', { enter: true })
    st = actor.apply!(actor.apply!(st, 'request', { request: true }), 'respond', { respond: true })
    expect(st.response).toEqual({ status: 404, file: 'menu.html' })
  })

  it('重開瀏覽器會忘了 IP,要重新問 DNS', () => {
    let st = actor.apply!(resolved(), 'restart', { restart: true })
    st = actor.apply!(actor.apply!(st, 'type', { type: 'www.example.com' }), 'enter', { enter: true })
    expect(() => actor.apply!(st, 'request', { request: true })).toThrow('還不知道')
  })

  it('請求送到後伺服器關機:可點的是開機,不是回應', () => {
    let st = actor.apply!(resolved(), 'request', { request: true })
    expect(actor.hotspots!(st, {})[0].step).toEqual({ respond: true })
    st = actor.apply!(st, 'power', { power: false })
    expect(actor.hotspots!(st, {})[0].step).toEqual({ power: true })
  })

  it('網址拆成網域與路徑', () => {
    expect(parseUrl('https://WWW.Example.com/menu')).toEqual({ domain: 'www.example.com', path: '/menu' })
    expect(parseUrl('www.example.com')).toEqual({ domain: 'www.example.com', path: '/' })
    // 查詢字串與錨點不是路徑
    expect(parseUrl('www.example.com/#top')).toEqual({ domain: 'www.example.com', path: '/' })
    expect(parseUrl('www.example.com/menu?a=1')).toEqual({ domain: 'www.example.com', path: '/menu' })
    expect(parseUrl('www.example.com?a=1')).toEqual({ domain: 'www.example.com', path: '/' })
    expect(() => parseUrl('hello')).toThrow('不是有效的網址')
    expect(fileOf('/')).toBe('index.html')
    expect(fileOf('/about.html')).toBe('about.html')
  })
})
