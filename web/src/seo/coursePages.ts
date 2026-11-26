// 課程相關頁面的路由清單。這些頁的 <title>、description、noindex 與結構化資料不在 build 決定:
// Go server 收到請求時讀資料庫組出來(server/cmd/server/courseseo.go,組法只寫在那裡;瀏覽器端換頁讀 GET /api/seo/page 拿同一份)。
// 這裡不放課程內容,也不列課號:
//   - COURSE_PAGES:固定網址的頁(主題頁、全部課程、課程總覽、規劃中章節),build 為每個網址產生一份留好空位的 HTML
//   - EN_COURSE_PAGES:英文版的課程總覽 /en/courses/<課程>,同樣留空位;有沒有英文版由 server 看資料庫的譯文
//   - LESSON_ROUTES:單課頁的路由樣式 /courses/<課程>/<課號>,build 一門課產生一份 HTML,有哪些課由 server 在請求時看資料庫
// build(scripts/seo.mjs)把兩者輸出成 dist/course-pages.json。
import { COURSES, courseMapId, coursePath, plannedChapterPath, plannedLabel, plannedSlug } from '../content/catalog'
import { AI_AGENT_PITCH } from '../content/aiAgent'
import { COURSE_LIST, TOPIC_PATHS } from '../content/topics'
import { EN_PREFIX } from '../i18n/locale'

/** 單課頁的版型(標題、描述、麵包屑的組法,見 courseseo.go):分階段的軟體課、兒童課、網頁與 Claude Code、從做好到上線 */
export type LessonStyle = 'staged' | 'kids' | 'topic' | 'launch'

export interface CoursePageEntry {
  path: string
  /** 課程地圖的課程 id */
  course: string
  coursePath: string
  /** topic:主題頁;list:全部課程(這兩種不屬於任何一門課,course 是空字串) */
  kind: 'overview' | 'chapter' | 'topic' | 'list'
  /** 主題頁讀資料庫的哪一個主題 */
  topic?: string
  /** 主題頁與全部課程的結構化資料列哪些課(課名讀資料庫)與各自的網址 */
  items?: { course: string; path: string }[]
  /** 全部課程頁的標題與描述(資料庫沒有對應的欄位) */
  title?: string
  description?: string
  /** 主題頁另外附一門課的結構化資料(AI Agent 中階課沒有自己的頁面) */
  courseLd?: { course: string; description: string }
  /** 章節頁的課號(sitemap 依資料庫裡這一課的狀態決定收不收) */
  lesson?: string
  /** 總覽頁的結構化資料要不要列出每一課(不分階段的課) */
  listLessons?: boolean
  /** 規劃中章節(只有還沒有單課的進階課):對到資料庫的單元 id 與章節編號 */
  chapter?: { unit: string; label: string }
  /** 先不公開的整門課(catalog.ts 的 hidden);先不公開的單元由 server 依資料庫判斷 */
  noindex?: boolean
  ogType?: 'article'
  /** 英文版的課程總覽(path、coursePath 都帶 /en) */
  lang?: 'en'
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
export const LESSON_ROUTES: LessonRouteEntry[] = COURSES.filter((c) => c.lessonPages).map((c) => ({
  course: courseMapId(c),
  coursePath: coursePath(c),
  style: LESSON_STYLE[c.slug] ?? 'topic',
  ...(c.staged && { ogType: 'article' as const }),
  ...(c.slug === 'launch' && { sitemapPriority: 0.2 }),
  ...(c.hidden && { noindex: true }),
}))

const SOFTWARE_ITEM = { course: 'software', path: '/courses/software' }
// 中階課沒有自己的頁面,課程介紹在主題頁
const AI_APP_ITEMS = [
  { course: 'ai-agent', path: TOPIC_PATHS.aiApps },
  { course: 'advanced', path: '/courses/advanced' },
]

const topicPage = (path: string, extra: Partial<CoursePageEntry>): CoursePageEntry => ({ path, course: '', coursePath: path, kind: 'topic', sitemapPriority: 0.9, ...extra })

/** 主題頁與全部課程:名稱、標題、描述讀資料庫的主題與課程 */
const TOPIC_PAGES: CoursePageEntry[] = [
  topicPage(TOPIC_PATHS.software, { topic: 'software', items: [SOFTWARE_ITEM] }),
  topicPage(TOPIC_PATHS.aiApps, { topic: 'ai-apps', items: AI_APP_ITEMS, courseLd: { course: 'ai-agent', description: AI_AGENT_PITCH } }),
  topicPage(COURSE_LIST.path, { kind: 'list', title: COURSE_LIST.seoTitle, description: COURSE_LIST.description, items: [SOFTWARE_ITEM, ...AI_APP_ITEMS] }),
]

const OVERVIEW_PAGES: CoursePageEntry[] = COURSES.flatMap((c) => {
  const base = { course: courseMapId(c), coursePath: coursePath(c) }
  const overview: CoursePageEntry = {
    ...base,
    path: coursePath(c),
    kind: 'overview',
    ...(!c.staged && { listLessons: true }),
    ...(PAGE_COURSE_PRIORITY[c.slug] !== undefined && { sitemapPriority: PAGE_COURSE_PRIORITY[c.slug] }),
  }
  const chapters: CoursePageEntry[] = c.planned.map((id) => ({
    ...base,
    path: plannedChapterPath(c, { slug: plannedSlug(id) }),
    kind: 'chapter',
    lesson: plannedLabel(id),
    chapter: { unit: id, label: plannedLabel(id) },
    ogType: 'article',
  }))
  // 先不公開的課(整門課):網址還打得開,但不收錄、不列入 sitemap
  return [overview, ...chapters].map((p): CoursePageEntry => (c.hidden ? { ...p, noindex: true } : p))
})

export const COURSE_PAGES: CoursePageEntry[] = [...TOPIC_PAGES, ...OVERVIEW_PAGES]

export const EN_COURSE_PAGES: CoursePageEntry[] = COURSE_PAGES.filter((p) => p.kind === 'overview').map((p) => ({
  ...p,
  path: EN_PREFIX + p.path,
  coursePath: EN_PREFIX + p.coursePath,
  lang: 'en',
  sitemapPriority: 0.8,
}))

const BY_PATH = new Set([...COURSE_PAGES, ...EN_COURSE_PAGES].map((p) => p.path))

/** 是不是課程相關頁面(固定網址含英文課程總覽,或某門課的單課網址;單課存不存在由 server 判斷) */
export function isCoursePage(path: string): boolean {
  if (BY_PATH.has(path)) return true
  const cut = path.lastIndexOf('/')
  const lesson = path.slice(cut + 1)
  return lesson !== '' && !lesson.includes('.') && LESSON_ROUTES.some((r) => r.coursePath === path.slice(0, cut))
}
