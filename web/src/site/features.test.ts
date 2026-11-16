import { describe, expect, it } from 'vitest'
import { resolveFeatures } from './features'

describe('resolveFeatures', () => {
  it('正式站預設全部關閉', () => {
    expect([...resolveFeatures({ dev: false })]).toEqual([])
  })

  it('本機開發全部開', () => {
    expect(resolveFeatures({ dev: true }).has('practice')).toBe(true)
  })

  it('建置變數全站開;空字串與空白不算', () => {
    expect(resolveFeatures({ dev: false, build: ' practice , ' }).has('practice')).toBe(true)
    expect(resolveFeatures({ dev: false, build: '' }).has('practice')).toBe(false)
  })

  it('瀏覽器記住的與網址的依序蓋過前面的;名稱前面加 - 是關閉', () => {
    expect(resolveFeatures({ dev: false, stored: 'practice' }).has('practice')).toBe(true)
    expect(resolveFeatures({ dev: false, build: 'practice', query: '-practice' }).has('practice')).toBe(false)
    expect(resolveFeatures({ dev: true, query: '-practice' }).has('practice')).toBe(false)
    expect(resolveFeatures({ dev: false, build: '-practice', stored: 'practice' }).has('practice')).toBe(true)
  })
})
