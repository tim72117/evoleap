import { describe, expect, it } from 'vitest'
import actor from './actor'

// 小幫手照卡片改網頁:卡片的做法對不上當時的網頁(要改的部分還不在網頁上)時,沒有做到就不給星星、不說「做好了」

const page = { parts: [{ id: 'p', kind: 'p', text: '小花是一隻橘貓。' }] }
const cards = [
  { id: 'h', text: '把[[標題]]改成紅色', ops: [{ set: 'h1', color: '#e53935' }], reply: '好！標題變成紅色了。', star: 'h1' },
  { id: 'p', text: '把[[段落]]改成藍色', ops: [{ set: 'p', color: '#1f6fd1' }], reply: '好！段落變成藍色了。', star: 'p' },
  { id: 'x', text: '把[[那個]]改成紅色', ops: [{ set: 'h1', color: '#e53935' }], reply: '那個？你說的是哪一個？', mood: 'puzzled' },
]
type St = { stars: string[]; mood: string; chat: { from: string; text: string }[]; page: { parts: { id: string; color?: string }[] } }
const start = () => actor.init!({ page, cards } as never) as unknown as St
const ask = (st: St, id: string) => actor.apply!(st as never, 'ask', { ask: id } as never) as unknown as St
const lastReply = (st: St) => st.chat.filter((m) => m.from === 'bot').at(-1)?.text

describe('lt11-helper 卡片的星星', () => {
  it('做法對得上網頁:改了網頁、給星星、說卡片的回覆', () => {
    const st = ask(start(), 'p')
    expect(st.page.parts.find((x) => x.id === 'p')?.color).toBe('#1f6fd1')
    expect(st.stars).toEqual(['p'])
    expect(st.mood).toBe('happy')
    expect(lastReply(st)).toBe('好！段落變成藍色了。')
  })

  it('要改的部分還不在網頁上:網頁不變、沒有星星,小幫手說找不到', () => {
    const before = start()
    const st = ask(before, 'h')
    expect(st.page).toEqual(before.page)
    expect(st.stars).toEqual([])
    expect(st.mood).toBe('puzzled')
    expect(lastReply(st)).toContain('找不到')
  })

  it('腳本寫好的困惑回覆照用', () => {
    const st = ask(start(), 'x')
    expect(st.mood).toBe('puzzled')
    expect(lastReply(st)).toBe('那個？你說的是哪一個？')
  })
})
