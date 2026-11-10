import { describe, expect, it } from 'vitest'
import courseSeed from '../../../server/internal/store/courses_seed.json'
import topicSeed from '../../../server/internal/store/topics_seed.json'
import { topicSeedRows } from './topicSeed'

// 主題的種子(server/internal/store/topics_seed.json)要和 topics.ts 的主題一致;文案改了之後執行 npm run export:topics 重新產生。

describe('主題種子', () => {
  it('topics_seed.json 和 topics.ts 一致(不一致時執行 npm run export:topics)', () => {
    expect(topicSeed).toEqual(topicSeedRows())
  })

  it('每個主題有課程頁與主題頁網址,順序與網址不重複', () => {
    const rows = topicSeedRows()
    for (const r of rows) {
      expect(r.coursePath, r.id).toBe(`/courses/${r.id}`)
      expect(r.topicPath, r.id).toBe(`/topics/${r.id}`)
    }
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    expect(rows.map((r) => r.position)).toEqual(rows.map((_, i) => i))
  })

  it('courses_seed.json 的每門課都指到存在的主題,每個主題至少有一門課', () => {
    const topics = new Set(topicSeedRows().map((r) => r.id))
    const courses = courseSeed as { id: string; topic?: string }[]
    for (const c of courses) expect(topics.has(c.topic ?? ''), `課程 ${c.id} 的 topic`).toBe(true)
    for (const t of topics) expect(courses.some((c) => c.topic === t), `主題 ${t} 沒有課程`).toBe(true)
  })
})
