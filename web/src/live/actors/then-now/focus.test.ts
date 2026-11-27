import { describe, expect, it } from 'vitest'
import { chatArea, chatPart, share } from './focus'

describe('then-now:直式版面放大目前在看的區塊', () => {
  it('打開網頁、人工測試看預覽;聊天、貼上看工作區', () => {
    expect([chatArea(1, 0), chatArea(2, 100), chatArea(2, 5000), chatArea(3, 1000), chatArea(3, 5000)]).toEqual(['work', 'work', 'view', 'view', 'work'])
    expect([chatPart(2, 100), chatPart(2, 2000), chatPart(3, 3000), chatPart(3, 7000)]).toEqual(['chat', 'editor', 'chat', 'editor'])
  })

  it('切換是漸進的,而且只看時間', () => {
    const is = (t: number) => t >= 1000
    expect(share(is, 900, false)).toBe(0)
    expect(share(is, 1250, false)).toBeGreaterThan(0.2)
    expect(share(is, 1250, false)).toBeLessThan(0.8)
    expect(share(is, 2000, false)).toBe(1)
    expect(share(() => false, 0, true)).toBeGreaterThan(0.9)
  })
})
