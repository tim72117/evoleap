import { describe, expect, it } from 'vitest'
import type { CourseMap } from '../content/courseMap'
import { lessonTitles } from './lessonTitles'

const map = { title: '網頁課', units: [{ id: '1', title: 'u', subtitle: '', lessons: [{ id: '1.1', title: '元素', summary: '', access: 'free', status: 'open', script: 'web/1.1.json' }] }] } as unknown as CourseMap

describe('觀看紀錄的課名', () => {
  it('代號依腳本路徑對回資料庫的課;對不到回 undefined', () => {
    const of = lessonTitles({ web: map, kids: undefined })
    expect(of('live:web/1.1.json')).toBe('網頁課 · 1.1 元素')
    expect(of('live:web/9.9.json')).toBeUndefined()
  })
})
