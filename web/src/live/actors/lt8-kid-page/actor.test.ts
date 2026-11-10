import { describe, expect, it } from 'vitest'
import actor from './actor'

// 積木盒(tools)的積木是拿來把一段文字換成標題或段落的:清單、圖片、連結沒有對應的內容,放進去會在載入腳本時就報錯

const base = { title: '小花的一天', items: [{ id: 'c1', kind: 'raw', text: '小花的一天', want: 'h1' }] }

describe('lt8-kid-page 積木盒', () => {
  it('只能放文字的積木(h1、h2、p)', () => {
    expect(() => actor.init!({ ...base, tools: ['h1', 'h2', 'p'] } as never)).not.toThrow()
    for (const t of ['ul', 'ol', 'img', 'a', 'raw']) expect(() => actor.init!({ ...base, tools: [t] } as never), t).toThrow(/只能放文字的積木/)
    expect(() => actor.init!({ ...base, tools: ['xx'] } as never)).toThrow(/不是積木種類/)
  })
})
