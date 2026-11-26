import { describe, expect, it } from 'vitest'
import { lessonDocTitle, lessonKicker, lessonLabelOf } from './lessonDisplay'

describe('lessonLabelOf', () => {
  it('軟體課:序章、第 N 課(起步階段 0.N 顯示為第 N 課)', () => {
    expect(lessonLabelOf('software', '0.intro')).toBe('序章')
    expect(lessonLabelOf('software', '0.3')).toBe('第 3 課')
    expect(lessonLabelOf('software', '1.2')).toBe('第 1.2 課')
  })
  it('其他課:第 <課號> 課', () => {
    expect(lessonLabelOf('web', '0.2')).toBe('第 0.2 課')
    expect(lessonLabelOf('launch', '1.1')).toBe('第 1.1 課')
    expect(lessonLabelOf('kids', '0.1')).toBe('第 0.1 課')
    expect(lessonLabelOf('claude-code', '1')).toBe('第 1 課')
  })
})

describe('單課頁標題', () => {
  it('document.title 頁名是「課名｜課程名稱」,登入把關 kicker 是「課程名稱 · 標籤」', () => {
    expect(lessonDocTitle('提出需求', '做出自己的軟體')).toBe('提出需求｜做出自己的軟體')
    expect(lessonKicker('網頁怎麼運作', '第 1 課')).toBe('網頁怎麼運作 · 第 1 課')
    // 課程名稱讀資料庫,還沒讀到時不列
    expect(lessonDocTitle('提出需求', '')).toBe('提出需求')
    expect(lessonKicker('', '第 1 課')).toBe('第 1 課')
  })
})
