import { describe, expect, it } from 'vitest'
import { safeDecodeURIComponent } from './safeDecode'

describe('safeDecodeURIComponent', () => {
  it('正常的編碼照解', () => expect(safeDecodeURIComponent('%E4%B8%AD%E6%96%87')).toBe('中文'))
  it('沒有編碼的字串原樣回傳', () => expect(safeDecodeURIComponent('remote')).toBe('remote'))
  it('壞掉的編碼不丟錯,回原字串', () => {
    expect(safeDecodeURIComponent('%E0%A4%A')).toBe('%E0%A4%A')
    expect(safeDecodeURIComponent('%')).toBe('%')
  })
})
