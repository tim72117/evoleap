// 課程編排工具的資料與操作(純函式;畫面在 CourseMapPage.tsx,測試見 courseMap.test.ts)。
// 這份資料是「編排草稿」,存在 course-map.json:課程內容的正本仍是 src/content/ 的單課資料,
// 拖曳不會改到正本;確定後由 Claude 依 JSON 的 changes 改寫單課資料。
import type { Course as CatalogCourse } from '../../content/catalog'

export type MapSegment = {
  /** 「課號#步驟序號」,對應單課資料的 steps(1 起算) */
  id: string
  title: string
  /** 原本所在課程的 id */
  from: string
}

export type MapCourse = {
  id: string
  /** 顯示用課號,例如「0.1」「單元 3」 */
  code: string
  title: string
  /** 原本所在程度的 id */
  from: string
  segments: MapSegment[]
}

export type MapLevel = {
  id: string
  /** 例如「L0 起步」 */
  label: string
  title: string
  courses: MapCourse[]
}

/** 跨課程或跨程度的移動(同一層內的排序不算,看陣列順序) */
export type MapChange = { type: 'segment' | 'course'; id: string; title: string; from: string; to: string }

export type CourseMap = {
  note: string
  updatedAt: string
  changes: MapChange[]
  levels: MapLevel[]
}

const NOTE =
  '課程編排草稿。levels → courses → segments 的順序就是目前的編排;from 是原本的位置,changes 列出跨課程與跨程度的移動。段落 id 為「課號#步驟序號」,對應 src/content/ 單課資料的 steps。正本仍是單課資料,套用後刪除這個檔案,工具會依新的單課資料重建。'

/** 依課程目錄產生初始編排:每個等級一個程度,單課與規劃中的章節都是課程,單課的步驟是段落 */
export function buildSeed(courses: CatalogCourse[]): CourseMap {
  return {
    note: NOTE,
    updatedAt: '',
    changes: [],
    levels: courses.map((c) => ({
      id: c.slug,
      label: c.level,
      title: c.title,
      courses: [
        ...c.lessons.map((l) => ({
          id: l.id,
          code: l.id,
          title: l.title,
          from: c.slug,
          segments: l.steps.map((s, i) => ({ id: `${l.id}#${i + 1}`, title: s.title, from: l.id })),
        })),
        ...c.planned.map((p) => ({ id: `${c.slug}/${p.slug}`, code: p.label, title: p.title, from: c.slug, segments: [] })),
      ],
    })),
  }
}

/** 重新計算跨課程與跨程度的移動 */
export function computeChanges(map: CourseMap): MapChange[] {
  const changes: MapChange[] = []
  for (const level of map.levels) {
    for (const course of level.courses) {
      if (course.from !== level.id) changes.push({ type: 'course', id: course.id, title: course.title, from: course.from, to: level.id })
      for (const seg of course.segments) {
        if (seg.from !== course.id) changes.push({ type: 'segment', id: seg.id, title: seg.title, from: seg.from, to: course.id })
      }
    }
  }
  return changes
}

const allCourses = (map: CourseMap) => map.levels.flatMap((l) => l.courses)
const allSegments = (map: CourseMap) => allCourses(map).flatMap((c) => c.segments)

/** 把單課資料的新內容併進編排:標題跟著正本更新,新增的程度、課程、段落放回原本的位置;已有的位置不動。 */
export function reconcile(map: CourseMap, seed: CourseMap): CourseMap {
  const next = structuredClone(map)
  next.note = seed.note
  const courseIds = new Set(allCourses(next).map((c) => c.id))
  const segmentIds = new Set(allSegments(next).map((s) => s.id))
  for (const seedLevel of seed.levels) {
    let level = next.levels.find((l) => l.id === seedLevel.id)
    if (!level) {
      level = { ...seedLevel, courses: [] }
      next.levels.push(level)
    }
    level.label = seedLevel.label
    level.title = seedLevel.title
    for (const seedCourse of seedLevel.courses) {
      if (!courseIds.has(seedCourse.id)) level.courses.push({ ...seedCourse, segments: [] })
    }
  }
  const seedCourses = new Map(allCourses(seed).map((c) => [c.id, c]))
  const seedSegments = new Map(allSegments(seed).map((s) => [s.id, s]))
  for (const course of allCourses(next)) {
    const seedCourse = seedCourses.get(course.id)
    if (!seedCourse) continue
    course.title = seedCourse.title
    for (const s of seedCourse.segments) {
      if (!segmentIds.has(s.id)) course.segments.push(s)
    }
  }
  for (const seg of allSegments(next)) {
    const seedSeg = seedSegments.get(seg.id)
    if (seedSeg) seg.title = seedSeg.title
  }
  next.changes = computeChanges(next)
  return next
}

/** 正本裡已經沒有的項目(單課資料改過之後,舊編排可能留下) */
export function staleIds(map: CourseMap, seed: CourseMap): Set<string> {
  const ids = (m: CourseMap) => [...allCourses(m).map((c) => c.id), ...allSegments(m).map((s) => s.id)]
  const known = new Set(ids(seed))
  return new Set(ids(map).filter((id) => !known.has(id)))
}

/** 通用的移動:index 是目的清單「移動前」的插入位置 */
function moveItem<T>(from: T[], at: number, to: T[], index: number) {
  const [item] = from.splice(at, 1)
  to.splice(from === to && at < index ? index - 1 : index, 0, item)
}

function finish(map: CourseMap): CourseMap {
  map.changes = computeChanges(map)
  return map
}

export function moveSegment(map: CourseMap, segmentId: string, toCourseId: string, index: number): CourseMap {
  const next = structuredClone(map)
  const from = allCourses(next).find((c) => c.segments.some((s) => s.id === segmentId))
  const to = allCourses(next).find((c) => c.id === toCourseId)
  if (!from || !to) return map
  moveItem(from.segments, from.segments.findIndex((s) => s.id === segmentId), to.segments, index)
  return finish(next)
}

export function moveCourse(map: CourseMap, courseId: string, toLevelId: string, index: number): CourseMap {
  const next = structuredClone(map)
  const from = next.levels.find((l) => l.courses.some((c) => c.id === courseId))
  const to = next.levels.find((l) => l.id === toLevelId)
  if (!from || !to) return map
  moveItem(from.courses, from.courses.findIndex((c) => c.id === courseId), to.courses, index)
  return finish(next)
}

/** 鍵盤操作:往上或往下移一格;到清單邊緣就跨到相鄰的課程(段落)或程度(課程) */
export function nudge(map: CourseMap, kind: 'segment' | 'course', id: string, dir: -1 | 1): CourseMap {
  const parents: { id: string; items: { id: string }[] }[] =
    kind === 'segment' ? allCourses(map).map((c) => ({ id: c.id, items: c.segments })) : map.levels.map((l) => ({ id: l.id, items: l.courses }))
  const move = kind === 'segment' ? moveSegment : moveCourse
  const p = parents.findIndex((x) => x.items.some((i) => i.id === id))
  if (p < 0) return map
  const at = parents[p].items.findIndex((i) => i.id === id)
  if (at + dir >= 0 && at + dir < parents[p].items.length) return move(map, id, parents[p].id, dir < 0 ? at - 1 : at + 2)
  const neighbor = parents[p + dir]
  if (!neighbor) return map
  return move(map, id, neighbor.id, dir < 0 ? neighbor.items.length : 0)
}
