import { describe, expect, it } from 'vitest'
import { splitTimedCaption } from './captionSplit'

const texts = (text: string, max: number) => splitTimedCaption(text, 6000, max).map((s) => s.text)

describe('短字幕切分', () => {
  it('優先在標點斷開,每段不超過上限', () => {
    expect(texts('以前要自己寫程式，現在只要說出需求。', 12)).toEqual(['以前要自己寫程式', '現在只要說出需求。'])
    const long = texts('這是一句完全沒有任何標點符號而且長度明顯超過上限的旁白', 10)
    expect(long.join('')).toBe('這是一句完全沒有任何標點符號而且長度明顯超過上限的旁白')
    expect(long.every((l) => l.length <= 10 && l.length >= 5)).toBe(true)
  })

  it('不拆開英文詞組', () => {
    const lines = texts('接下來我們要認識的是 AI Agent 這個新幫手', 12)
    expect(lines.some((l) => l.includes('AI Agent'))).toBe(true)
  })

  it('時間依長度分配、首尾相接', () => {
    expect(splitTimedCaption('一二三四，五六七八九十甲乙。', 1300, 10)).toEqual([
      { from: 0, to: 400, text: '一二三四' },
      { from: 400, to: 1300, text: '五六七八九十甲乙。' },
    ])
  })

  it('分界吸附到附近的停頓', () => {
    const levels = '5'.repeat(40) + '0000' + '5'.repeat(56)
    const [a, b] = splitTimedCaption('一二三四五六，七八九十甲乙。', 5000, 8, levels)
    expect([a.to, b.from, b.to]).toEqual([2100, 2100, 5000])
  })

  it('停頓少於段數時仍沒有空段', () => {
    const segs = splitTimedCaption('一二。三四。五六。七八。', 1000, 4, '5550055555' + '5555555555')
    expect(segs).toHaveLength(4)
    expect(segs.every((s, i) => s.to > s.from && s.from === (i ? segs[i - 1].to : 0))).toBe(true)
    expect(segs[3].to).toBe(1000)
  })

  it('空字串不產生段落', () => {
    expect(splitTimedCaption('  ', 1000, 10)).toEqual([])
  })
})
