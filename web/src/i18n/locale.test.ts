import { describe, expect, it } from 'vitest'
import { browserLocale } from './locale'
import { en } from './en'
import { zh } from './zh'

describe('browserLocale', () => {
  it('中文(任何地區)用繁中,其他用英文', () => {
    expect(browserLocale(['zh-TW', 'en'])).toBe('zh-Hant')
    expect(browserLocale(['zh-CN'])).toBe('zh-Hant')
    expect(browserLocale(['en-US', 'zh-TW'])).toBe('en')
    expect(browserLocale(['ja'])).toBe('en')
    expect(browserLocale([])).toBe('zh-Hant')
  })
})

describe('字典', () => {
  // 型別已經保證鍵一樣;這裡再擋「英文字典忘了翻,直接貼中文」。函式用假參數呼叫一次檢查結果
  it('英文字典沒有中文字', () => {
    const walk = (v: unknown, path: string): string[] => {
      if (typeof v === 'string') return /[一-鿿]/.test(v) ? [path] : []
      if (typeof v === 'function') return walk(String((v as (...a: unknown[]) => unknown)(1, '1', 1, 1)), path)
      if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => walk(x, `${path}.${k}`))
      return []
    }
    // 語言切換鈕在英文版要顯示「中文」
    expect(walk(en, 'en').filter((p) => !p.startsWith('en.common.switchTo'))).toEqual([])
    expect(Object.keys(en)).toEqual(Object.keys(zh))
  })
})
