import { describe, expect, it } from 'vitest'
import type { StageScript } from '../../types'
import { expandAnswers, momentsOf, type Answers } from '../../../studio/interactive/scene'
import lesson from '../../../content/live/web/0.1.json'
import demo from '../../../content/live/lab/actors/net-trip.json'
import actor, { fileOf, parseUrl, type NetState, type NetStep } from './actor'

const STAGE = ['card', 'callout', 'show', 'hide', 'move', 'checkpoint', 'wait', 'parts']
const start = () => actor.init!({})

/** 照舞台載入的方式(stage.ts):從 init 開始,依序 apply 演員的每個動作;回傳最後的狀態 */
function run(script: StageScript): NetState {
  const id = Object.keys(script.cast)[0]
  let st = actor.init!(script.cast[id].props ?? {})
  script.steps.forEach((raw, i) => {
    const s = raw as Record<string, unknown>
    const stage = STAGE.find((k) => k in s)
    if (stage && stage !== 'show' && stage !== 'hide') return
    const kinds = actor.kinds.filter((k) => k in s)
    if (!stage && kinds.length !== 1) throw new Error(`第 ${i + 1} 步:動作要剛好一個(${kinds.join('、') || '沒有'})`)
    try {
      if (kinds.length) st = actor.apply!(st, kinds[0], s as NetStep)
      if (stage === 'hide') st = { ...st, temp: {} }
    } catch (e) {
      throw new Error(`第 ${i + 1} 步 ${JSON.stringify(s).slice(0, 60)}:${e instanceof Error ? e.message : e}`)
    }
  })
  return st
}

describe('net-trip 的腳本', () => {
  it('演員展示的示範腳本演得完', () => {
    const st = run(demo as unknown as StageScript)
    expect(st.phase).toBe('failed')
    expect(st.shown).toMatchObject({ kind: 'error', error: 'down' })
  })

  const script = lesson as unknown as StageScript
  const moments = momentsOf(script)

  it('0.1 課沒回答(演示範)時演得完', () => {
    expect(moments.map((m) => m.id)).toEqual(['first', 'notfound'])
    const st = run(expandAnswers(script, {}))
    expect(st.phase).toBe('rendered')
    expect(st.shown).toEqual({ kind: 'notfound', path: '/menu' })
  })

  // 每個互動點的每個選項(含略過)都要接得上後面的步驟:列出所有組合逐一推算
  const combos: Answers[] = moments.reduce<Answers[]>(
    (acc, m) => acc.flatMap((a) => [{ ...a, [m.id]: { skipped: true } }, ...m.options.map((_, i) => ({ ...a, [m.id]: { option: i } }))]),
    [{}],
  )
  it.each(combos.map((a) => [JSON.stringify(a), a] as const))('0.1 課回答 %s 時演得完', (_, answers) => {
    expect(() => run(expandAnswers(script, answers))).not.toThrow()
  })
})

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
