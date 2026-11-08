import { describe, expect, it } from 'vitest'
import { resumeChapter, toPlain } from './resume'

const plain = [
  { label: '開場', at: 0 },
  { label: '認識標題', at: 20_000 },
  { label: '動手改', at: 50_000 },
]

describe('toPlain', () => {
  it('沒有回答時位置不變', () => {
    expect(toPlain(30_000, plain, plain, 80_000)).toBe(30_000)
  })
  it('前面插了回應:用同名段落換回沒有回答的時間', () => {
    const expanded = [
      { label: '開場', at: 0 },
      { label: '認識標題', at: 26_000 },
      { label: '動手改', at: 56_000 },
    ]
    expect(toPlain(60_000, expanded, plain, 80_000)).toBe(54_000)
  })
  it('這一段裡插了回應:不超過下一段的開頭', () => {
    const expanded = [
      { label: '開場', at: 0 },
      { label: '認識標題', at: 20_000 },
      { label: '動手改', at: 58_000 },
    ]
    expect(toPlain(55_000, expanded, plain, 80_000)).toBe(49_999)
  })
})

describe('resumeChapter', () => {
  it('從那一段的開頭接著看', () => {
    expect(resumeChapter(54_000, plain, 80_000)).toEqual(plain[2])
  })
  it('第一段、太靠近開頭或結尾、沒有紀錄:從頭開始', () => {
    expect(resumeChapter(10_000, plain, 80_000)).toBeNull()
    expect(resumeChapter(3000, plain, 80_000)).toBeNull()
    expect(resumeChapter(78_000, plain, 80_000)).toBeNull()
    expect(resumeChapter(null, plain, 80_000)).toBeNull()
  })
})
