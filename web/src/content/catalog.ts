// 學員端的課程路由:有哪些課程網址、哪一門課分階段、哪些課有規劃中章節頁。SEO 的課程頁清單(seo/coursePages.ts)也由這裡產生。
// 這裡不放任何課程內容(課名、簡介、插圖、階段名稱、單元、每一課、開放與否):一律讀資料庫(courseMap.ts、courseList.ts),
// 課程相關頁面的搜尋標題與描述由 server 讀同一個資料庫組出來(server/cmd/server/courseseo.go)。
// 單課路由是參數化的(/courses/<課程>/:lesson,courses/LessonRoute.tsx 照課程地圖找課),所以 CLI 新增的課不用重新部署。
// 新增一門有課程頁的課:在這裡加一筆(沒有自己頁面的課,例如 AI Agent 中階課,不放這裡)。
import { messages } from '../i18n/current'

export interface PlannedChapter {
  /** 網址 /courses/<course>/<slug> */
  slug: string
  /** 顯示用章節編號，例如「4.1」「單元 0」 */
  label: string
  title: string
  summary: string
  /** 完成後會做出的成果 */
  result?: string
  /** 資料庫裡的課號;沒填就是 label */
  id?: string
  /** 麵包屑與標籤顯示的等級名稱(分階段的課是這一課所在的階段,照課程地圖);沒填用課程的 level */
  level?: string
}

export interface Course {
  /** 網址 /courses/<slug>,也是資料庫的課程 id */
  slug: string
  /** 分成幾個階段的課(「做出自己的軟體」):階段是資料庫的單元 */
  staged?: boolean
  /** 有單課頁(規劃中的進階課沒有) */
  lessonPages: boolean
  /** 規劃中章節頁對到的單元 id(只有還沒有單課的進階課用):網址 topic-<id>,名稱讀資料庫的單元 */
  planned: string[]
  /** 章節頁麵包屑的等級名稱(資料庫沒有這個欄位) */
  level?: string
  /** 先不公開：列表與 sitemap 都不列，網址還打得開（noindex） */
  hidden?: boolean
}

export const COURSES: Course[] = [
  { slug: 'software', staged: true, lessonPages: true, planned: [] },
  { slug: 'web', lessonPages: true, planned: [] },
  { slug: 'launch', lessonPages: true, planned: [] },
  { slug: 'kids', lessonPages: true, planned: [] },
  { slug: 'claude-code', lessonPages: true, planned: [] },
  { slug: 'print3d', lessonPages: true, planned: [] },
  { slug: 'advanced', lessonPages: false, planned: ['1', '2', '3', '4'], level: 'AI 互動軟體 進階' },
]

/** 規劃中章節的網址最後一段與章節編號 */
export const plannedSlug = (unitId: string): string => `topic-${unitId}`
export const plannedLabel = (unitId: string): string => `主題 ${unitId}`

export function coursePath(course: Course): string {
  return `/courses/${course.slug}`
}

/** 不用登入就能預覽的單課(序章):做出自己的軟體的 0.intro */
export const PREVIEW_LESSON_ID = '0.intro'
export function isPreviewLesson(lesson: { id: string }): boolean {
  return lesson.id === PREVIEW_LESSON_ID
}

/** 課程地圖 API 用的課程 id:就是網址的 slug */
export const courseMapId = (course: Pick<Course, 'slug'>): string => course.slug

/** 顯示用課號：L0 的「0.1」顯示為「1」（第 1 課），其他課顯示原課號（第 1.1 課） */
export function lessonNumber(lesson: { id: string }): string {
  return lesson.id.startsWith('0.') ? lesson.id.slice(2) : lesson.id
}

/** 顯示用名稱(目前語言)：序章(0.intro)是「序章」，否則「第 N 課」 */
export function lessonLabel(lesson: { id: string }): string {
  const t = messages().courses
  return isPreviewLesson(lesson) ? t.lessonName('序章') : t.lessonN(lessonNumber(lesson))
}

/**
 * 任何一門課的一課的網址(課程總覽依資料庫的課列出連結,用這條規則):網址不用小數點（會被伺服器當成靜態檔副檔名）。
 * 課號 1.2 → /courses/web/1-2、3 → /courses/claude-code/3、0.1 → /courses/launch/0-1;
 * 只有「做出自己的軟體」的起步階段(課號 0.N)網址去掉 0. 前綴(lessonNumber):/courses/software/1、/courses/software/intro,零基礎是 /courses/software/1-0
 */
export function lessonUrl(courseSlug: string, id: string): string {
  const num = courseSlug === 'software' ? lessonNumber({ id }) : id
  return `/courses/${courseSlug}/${num.split('.').join('-')}`
}

/**
 * 單課網址最後一段推回課號(lessonUrl 的反向):只在課程地圖讀不到時給畫面標示用;
 * 地圖讀得到時一律拿地圖上的課比對 lessonUrl(courses/LessonRoute.tsx),不靠這個猜。
 */
export function lessonIdFromSlug(courseSlug: string, slug: string): string {
  const id = slug.split('-').join('.')
  return courseSlug === 'software' && !slug.includes('-') ? `0.${id}` : id
}

export function lessonPath(course: Course, lesson: { id: string }): string {
  return lessonUrl(course.slug, lesson.id)
}

export function plannedChapterPath(course: Course, chapter: Pick<PlannedChapter, 'slug'>): string {
  return `${coursePath(course)}/${chapter.slug}`
}
