import { describe, expect, it } from 'vitest'
import { COURSES } from '../../content/catalog'
import { buildSeed, computeChanges, moveCourse, moveSegment, nudge, reconcile, staleIds, type CourseMap } from './courseMap'

const segments = (map: CourseMap, courseId: string) =>
  map.levels
    .flatMap((l) => l.courses)
    .find((c) => c.id === courseId)!
    .segments.map((s) => s.id)
const courses = (map: CourseMap, levelId: string) => map.levels.find((l) => l.id === levelId)!.courses.map((c) => c.id)

describe('課程編排', () => {
  const seed = buildSeed(COURSES)

  it('初始資料涵蓋每個等級、單課與步驟,id 不重複', () => {
    expect(seed.levels.map((l) => l.id)).toEqual(COURSES.map((c) => c.slug))
    expect(segments(seed, '0.0')).toEqual(['0.0#1', '0.0#2', '0.0#3', '0.0#4', '0.0#5'])
    const ids = seed.levels.flatMap((l) => l.courses.flatMap((c) => [c.id, ...c.segments.map((s) => s.id)]))
    expect(new Set(ids).size).toBe(ids.length)
    expect(computeChanges(seed)).toEqual([])
  })

  it('段落移到別的課程:記下來源,原資料不變', () => {
    const next = moveSegment(seed, '0.0#5', '0.1', 1)
    expect(segments(next, '0.1').slice(0, 3)).toEqual(['0.1#1', '0.0#5', '0.1#2'])
    expect(segments(next, '0.0')).not.toContain('0.0#5')
    expect(next.changes).toEqual([{ type: 'segment', id: '0.0#5', title: '練習拒絕', from: '0.0', to: '0.1' }])
    expect(segments(seed, '0.0')).toContain('0.0#5')
  })

  it('同一課內排序:插入位置以移動前為準,不算跨課移動', () => {
    expect(segments(moveSegment(seed, '0.0#1', '0.0', 3), '0.0')).toEqual(['0.0#2', '0.0#3', '0.0#1', '0.0#4', '0.0#5'])
    expect(segments(moveSegment(seed, '0.0#4', '0.0', 1), '0.0')).toEqual(['0.0#1', '0.0#4', '0.0#2', '0.0#3', '0.0#5'])
    expect(moveSegment(seed, '0.0#1', '0.0', 3).changes).toEqual([])
  })

  it('課程移到別的程度,段落跟著走;移回原處就沒有移動紀錄', () => {
    const next = moveCourse(seed, '0.2', 'ai-agent', 0)
    expect(courses(next, 'ai-agent')[0]).toBe('0.2')
    expect(segments(next, '0.2')).toHaveLength(9)
    expect(next.changes).toEqual([{ type: 'course', id: '0.2', title: expect.any(String), from: 'software', to: 'ai-agent' }])
    expect(moveCourse(next, '0.2', 'software', 2).changes).toEqual([])
  })

  it('鍵盤移動:清單內換位,到邊緣跨到相鄰的課程或程度,最外層不動', () => {
    expect(segments(nudge(seed, 'segment', '0.0#2', 1), '0.0').slice(0, 3)).toEqual(['0.0#1', '0.0#3', '0.0#2'])
    expect(segments(nudge(seed, 'segment', '0.0#2', -1), '0.0').slice(0, 2)).toEqual(['0.0#2', '0.0#1'])
    expect(segments(nudge(seed, 'segment', '0.0#5', 1), '0.1')[0]).toBe('0.0#5')
    expect(segments(nudge(seed, 'segment', '0.1#1', -1), '0.0').at(-1)).toBe('0.1#1')
    expect(nudge(seed, 'segment', '0.intro#1', -1)).toEqual(seed)
    // 「做出自己的軟體」的最後一項往後移,跨到下一個程度(AI 互動軟體 中階)的最前面
    const last = courses(seed, 'software').at(-1)!
    expect(courses(nudge(seed, 'course', last, 1), 'ai-agent')[0]).toBe(last)
    expect(courses(nudge(seed, 'course', '0.2', 1), 'software').slice(0, 4)).toEqual(['0.intro', '0.0', '0.1', '1.0'])
    expect(nudge(seed, 'course', '0.intro', -1)).toEqual(seed)
  })

  it('併入正本的新內容:保留已移動的位置,補上新增的項目,標題跟著更新', () => {
    const moved = moveSegment(seed, '0.0#5', '0.1', 0)
    const newer = structuredClone(seed)
    const c0 = newer.levels[0].courses.find((c) => c.id === '0.0')!
    c0.segments.push({ id: '0.0#6', title: '新步驟', from: '0.0' })
    c0.segments[4].title = '改過的標題'
    newer.levels[0].courses.push({ id: '0.3', code: '0.3', title: '新課', from: 'software', segments: [{ id: '0.3#1', title: '第一步', from: '0.3' }] })
    const out = reconcile(moved, newer)
    expect(segments(out, '0.1')[0]).toBe('0.0#5')
    expect(out.levels[0].courses.find((c) => c.id === '0.1')!.segments[0].title).toBe('改過的標題')
    expect(segments(out, '0.0')).toContain('0.0#6')
    expect(segments(out, '0.3')).toEqual(['0.3#1'])
    expect(reconcile(out, newer)).toEqual(out)
  })

  it('正本已經沒有的項目會被標出來,不會被默默刪掉', () => {
    const newer = structuredClone(seed)
    newer.levels[0].courses.find((c) => c.id === '0.0')!.segments.pop()
    const out = reconcile(seed, newer)
    expect(segments(out, '0.0')).toContain('0.0#5')
    expect([...staleIds(out, newer)]).toEqual(['0.0#5'])
  })
})
