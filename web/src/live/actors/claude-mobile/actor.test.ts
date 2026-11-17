import { describe, expect, it } from 'vitest'
import actor from './actor'

const start = () => actor.init!({})

describe('claude-mobile 動作檢查', () => {
  it('allow 要先有 ask;按完就不再等待', () => {
    expect(() => actor.apply!(start(), 'allow', { allow: true })).toThrow('ask')
    let st = actor.apply!(start(), 'ask', { ask: '要允許嗎?', cmd: 'npm run fix' })
    st = actor.apply!(st, 'allow', { allow: true })
    expect(st.blocks.at(-1)).toMatchObject({ t: 'ask', chosen: 'allow' })
    expect(() => actor.apply!(st, 'allow', { allow: true })).toThrow('ask')
  })

  it('拒絕會記成 deny;文字空白會報錯', () => {
    let st = actor.apply!(start(), 'ask', { ask: '要允許嗎?', cmd: 'rm -rf x' })
    st = actor.apply!(st, 'allow', { allow: false })
    expect(st.blocks.at(-1)).toMatchObject({ chosen: 'deny' })
    expect(() => actor.apply!(start(), 'say', { say: '' })).toThrow('say')
  })
})
