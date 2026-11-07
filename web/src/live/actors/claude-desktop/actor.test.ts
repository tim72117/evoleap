import { describe, expect, it } from 'vitest'
import actor from './actor'

const start = () => actor.init!({ title: 'A', sessions: ['B'] })

describe('claude-desktop 的 session 操作', () => {
  it('新增與 fork 之後名字可以被切換', () => {
    let st = actor.apply!(start(), 'newSession', { newSession: 'C' })
    st = actor.apply!(st, 'menu', { menu: 'A' })
    expect(st.menu).toBe('A')
    st = actor.apply!(st, 'fork', { fork: 'A (fork)' })
    expect(st.menu).toBeNull()
    expect(() => actor.apply!(st, 'session', { session: 'A (fork)' })).not.toThrow()
  })

  it('名稱對不上、名稱重複時報錯', () => {
    expect(() => actor.apply!(start(), 'session', { session: '沒有' })).toThrow('沒有叫')
    expect(() => actor.apply!(start(), 'newSession', { newSession: 'B' })).toThrow('已經有')
    expect(() => actor.apply!(start(), 'user', { user: '嗨', in: '沒有' })).toThrow('沒有叫')
  })

  it('fork 要先開選單,選單開著不能做別的事', () => {
    expect(() => actor.apply!(start(), 'fork', { fork: 'X' })).toThrow('先用 menu')
    const open = actor.apply!(start(), 'menu', { menu: 'A' })
    expect(() => actor.apply!(open, 'user', { user: '嗨' })).toThrow('選單還開著')
  })

  it('滑鼠操作不能加 in,背景動作不佔時間', () => {
    expect(() => actor.apply!(start(), 'session', { session: 'B', in: 'A' })).toThrow('不能加')
    expect(actor.duration('say', { say: '很長的一段話', in: 'B' }, {}, undefined)).toBe(1)
    expect(actor.cursor!('session', { session: 'B' }, undefined)?.moves[0].target).toBe('session:B')
  })
})

describe('claude-desktop 的可點區', () => {
  const targets = (st: ReturnType<typeof start>) => actor.hotspots!(st, {}).map((h) => h.target)

  it('平常可以新增、切換其他 session、開選單、輸入', () => {
    expect(targets(start())).toEqual(['new', 'session:B', 'more:A', 'more:B', 'composer'])
  })

  it('選單開著時只剩 Fork,名字不會和現有的重複', () => {
    const open = actor.apply!(start(), 'menu', { menu: 'A' })
    expect(targets(open)).toEqual(['menuitem:Fork'])
    expect(actor.hotspots!(open, {})[0].step).toEqual({ fork: 'A (fork)' })
    const forked = actor.apply!(open, 'fork', { fork: 'A (fork)' })
    const again = actor.apply!(forked, 'menu', { menu: 'A' })
    expect(actor.hotspots!(again, {})[0].step).toEqual({ fork: 'A (fork) 2' })
  })

  it('等待確認時可以點選項,選完就回到輸入框', () => {
    const asking = actor.apply!(start(), 'ask', { ask: 'npm test' })
    expect(targets(asking)).toContain('option:2')
    expect(targets(asking)).not.toContain('composer')
    expect(targets(actor.apply!(asking, 'choose', { choose: 1 }))).toContain('composer')
  })

  it('輸入框用打的字產生 user 動作', () => {
    const composer = actor.hotspots!(start(), {}).find((h) => h.target === 'composer')!
    expect(composer.input?.step('你好')).toEqual({ user: '你好' })
  })
})

describe('claude-desktop 的介面語言(lang/<語言>.json)', () => {
  it('預設繁體中文;lang: en 換成英文的預設名稱、選項與熱點標籤', () => {
    expect(actor.init!({}).names).toEqual(['新的 session'])
    const en = actor.init!({ lang: 'en' })
    expect(en.names).toEqual(['New session'])
    const asking = actor.apply!(en, 'ask', { ask: 'hello.txt' })
    expect(asking.asking).toEqual(['Deny', 'Allow once', 'Always allow'])
    expect(actor.hotspots!(en, { lang: 'en' }).map((h) => h.label)).toEqual(['New session', 'Menu for “New session”', 'Type a message'])
  })

  it('沒有這個語言的文字檔時報錯', () => {
    expect(() => actor.init!({ lang: 'fr' })).toThrow('lang/fr.json')
  })
})
