// 課程相關頁面的路由清單。這些頁的 <title>、description、noindex 與結構化資料不在 build 決定:
// Go server 收到請求時讀資料庫組出來(server/cmd/server/courseseo.go,組法只寫在那裡;瀏覽器端換頁讀 GET /api/seo/page 拿同一份)。
// 這裡不放課程內容,也不列課號:
//   - COURSE_PAGES:固定網址的頁(課程總覽、規劃中章節),build 為每個網址產生一份留好空位的 HTML
//   - LESSON_ROUTES:單課頁的路由樣式 /courses/<課程>/<課號>,build 一門課產生一份 HTML,有哪些課由 server 在請求時看資料庫
// build(scripts/seo.mjs)把兩者輸出成 dist/course-pages.json。
import { COURSES, courseMapId, coursePath, plannedChapterPath } from '../content/catalog'

/** 單課頁的版型(標題、描述、麵包屑的組法,見 courseseo.go):分階段的軟體課、兒童課、網頁與 Claude Code、從做好到上線 */
export type LessonStyle = 'staged' | 'kids' | 'topic' | 'launch'

export interface CoursePageEntry {
  path: string
  /** 課程地圖的課程 id */
  course: string
  coursePath: string
  kind: 'overview' | 'chapter'
  /** 章節頁的課號(sitemap 依資料庫裡這一課的狀態決定收不收) */
  lesson?: string
  /** 總覽頁的結構化資料要不要列出每一課(不分階段的課) */
  listLessons?: boolean
  /** 規劃中章節(只有還沒有課程地圖的進階課):內容是前端的(levels.ts),資料庫沒有對應的課 */
  chapter?: { name: string; summary: string }
  /** 先不公開的整門課(levels.ts 的 hidden);先不公開的單元由 server 依資料庫判斷 */
  noindex?: boolean
  ogType?: 'article'
  sitemapPriority?: number
}

/** 一門課的單課頁(所有課號共用一筆) */
export interface LessonRouteEntry {
  course: string
  coursePath: string
  style: LessonStyle
  noindex?: boolean
  ogType?: 'article'
  sitemapPriority?: number
}

/** 這幾門課原本是主題頁,沿用當時 sitemap 的優先度 */
const PAGE_COURSE_PRIORITY: Record<string, number> = { web: 0.8, launch: 0.3, 'claude-code': 0.9, kids: 0.8 }

/** 各課程單課頁的版型;沒列的課用 topic */
const LESSON_STYLE: Record<string, LessonStyle> = { software: 'staged', kids: 'kids', launch: 'launch' }

/** 有單課頁的課:已經可以上的課(規劃中的進階課只有章節頁) */
export const LESSON_ROUTES: LessonRouteEntry[] = COURSES.filter((c) => c.status === 'available').map((c) => ({
  course: courseMapId(c),
  coursePath: coursePath(c),
  style: LESSON_STYLE[c.slug] ?? 'topic',
  ...(c.stages && { ogType: 'article' as const }),
  ...(c.slug === 'launch' && { sitemapPriority: 0.2 }),
  ...(c.hidden && { noindex: true }),
}))

export const COURSE_PAGES: CoursePageEntry[] = COURSES.flatMap((c) => {
  const base = { course: courseMapId(c), coursePath: coursePath(c) }
  const overview: CoursePageEntry = {
    ...base,
    path: coursePath(c),
    kind: 'overview',
    ...(!c.stages && { listLessons: true }),
    ...(PAGE_COURSE_PRIORITY[c.slug] !== undefined && { sitemapPriority: PAGE_COURSE_PRIORITY[c.slug] }),
  }
  const chapters: CoursePageEntry[] = c.planned.map((ch) => ({
    ...base,
    path: plannedChapterPath(c, ch),
    kind: 'chapter',
    lesson: ch.id ?? ch.label,
    chapter: { name: `${ch.label} ${ch.title}`, summary: ch.summary },
    ogType: 'article',
  }))
  // 先不公開的課(整門課):網址還打得開,但不收錄、不列入 sitemap
  return [overview, ...chapters].map((p): CoursePageEntry => (c.hidden ? { ...p, noindex: true } : p))
})

const BY_PATH = new Set(COURSE_PAGES.map((p) => p.path))

/** 是不是課程相關頁面(固定網址,或某門課的單課網址;單課存不存在由 server 判斷) */
export function isCoursePage(path: string): boolean {
  if (BY_PATH.has(path)) return true
  const cut = path.lastIndexOf('/')
  const lesson = path.slice(cut + 1)
  return lesson !== '' && !lesson.includes('.') && LESSON_ROUTES.some((r) => r.coursePath === path.slice(0, cut))
}
