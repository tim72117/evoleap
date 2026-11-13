// 學員端課程目錄：課程地圖上每個等級一門課，每門課的章節各有自己的網址（SEO 逐頁產生）。
// - lessons：已有完整內容的章節（目標、步驟、提示詞），用 LessonPage 呈現；與提案頁共用資料。
// - planned：規劃中的章節，只有標題與簡述，用 PlannedChapterPage 呈現；內容完成後改放進 lessons。
// 新增一門課：在這裡加一筆，routes.tsx 與 seo/pages.ts 會自動產生路由與 SEO；課程結構也要寫進 server/internal/store/courses_seed.json（content/courseMap.test.ts 檢查一致）。
// 課程總覽的每一課（一句話、時間、開放與否）從資料庫讀，這裡的資料是單課頁的內容與讀到之前的備用資料。
import { ALL_LEVELS, LEVELS, type CourseLevel } from './levels'
import { L2_MODULES } from './l2Outline'
import { UNITS } from './aiAgent'
import type { CourseLesson } from './lessonTypes'
import { L0_LESSONS } from './l0Lessons'
import { L1_LESSONS } from './l1Lessons'
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
}

export interface Course {
  /** 網址 /courses/<slug> */
  slug: string
  /** 等級標籤，例如「起步」 */
  level: string
  title: string
  summary: string
  status: 'available' | 'planned'
  lessons: CourseLesson[]
  planned: PlannedChapter[]
  /** 課程總覽頁另有專屬頁面（不由 CourseOverviewPage 產生） */
  customOverview?: boolean
}

function level(id: string): CourseLevel {
  const l = ALL_LEVELS.find((x) => x.id === id)
  if (!l) throw new Error(`unknown level: ${id}`)
  return l
}

function fromLevel(id: string, slug: string, levelLabel: string): Pick<Course, 'slug' | 'level' | 'title' | 'summary'> {
  const l = level(id)
  return { slug, level: levelLabel, title: l.title, summary: l.summary }
}

export const COURSES: Course[] = [
  {
    ...fromLevel('tools', 'tools', '起步'),
    status: 'available',
    lessons: L0_LESSONS,
    planned: [],
  },
  {
    ...fromLevel('ai-tools', 'ai-tools', '零基礎'),
    status: 'available',
    lessons: L1_LESSONS,
    planned: [],
  },
  {
    ...fromLevel('vibe-coding-basics', 'vibe-coding', '基礎'),
    status: 'planned',
    lessons: [],
    planned: L2_MODULES.flatMap((m) =>
      m.lessons.map((l, i) => ({
        slug: `${m.num}-${i + 1}`,
        label: `${m.num}.${i + 1}`,
        title: l.title,
        summary: l.objective,
        result: l.result,
      })),
    ),
  },
  {
    ...fromLevel('ai-agent', 'ai-agent', 'AI 互動軟體 中階'),
    status: 'planned',
    lessons: [],
    planned: UNITS.map((u) => ({
      slug: u.num === '★' ? 'capstone' : `unit-${u.num}`,
      label: u.num === '★' ? '期末專案' : `單元 ${u.num}`,
      title: u.title,
      summary: u.goal,
      result: u.practice,
    })),
    customOverview: true,
  },
  {
    ...fromLevel('advanced', 'advanced', 'AI 互動軟體 進階'),
    status: 'planned',
    lessons: [],
    planned: (level('advanced').topics ?? []).map((t, i) => ({
      slug: `topic-${i + 1}`,
      label: `主題 ${i + 1}`,
      title: t,
      summary: `${level('advanced').title}的規劃主題之一：${t}。詳細內容規劃中。`,
    })),
  },
]

export function coursePath(course: Course): string {
  return `/courses/${course.slug}`
}

/** 同一個主題的下一章(下一門課):起步 → 零基礎 → 基礎;中階 → 進階。最後一章回傳 undefined */
export function nextCourse(course: Course): Course | undefined {
  const lv = ALL_LEVELS.find((l) => l.link === coursePath(course))
  if (!lv) return undefined
  const group = LEVELS.includes(lv) ? LEVELS : ALL_LEVELS.filter((l) => !LEVELS.includes(l))
  const nextLevel = group[group.indexOf(lv) + 1]
  return nextLevel && COURSES.find((c) => coursePath(c) === nextLevel.link)
}

/** 不用登入就能預覽的單課:只有序章這類短導覽 */
export function isPreviewLesson(lesson: CourseLesson): boolean {
  return Boolean(lesson.label)
}

/** 課程地圖標示「登入後免費」的課程:預覽課以外的單課頁要登入才能看(LoginGate) */
export function requiresLogin(course: Course, lesson: CourseLesson): boolean {
  return ALL_LEVELS.find((l) => l.link === coursePath(course))?.access === 'login-free' && !isPreviewLesson(lesson)
}

/** 已開放的單課:有可以播放的影片,序章這類短導覽不算 */
export function openLessonsOf(course: Course): CourseLesson[] {
  return course.lessons.filter((l) => !l.label && l.videos.some((v) => v.live))
}

/** 顯示用課號：L0 的「0.1」顯示為「1」（第 1 課），其他課顯示原課號（第 1.1 課） */
export function lessonNumber(lesson: Pick<CourseLesson, 'id'>): string {
  return lesson.id.startsWith('0.') ? lesson.id.slice(2) : lesson.id
}

/** 顯示用名稱(目前語言)：有 label 用 label（例如「序章」），否則「第 N 課」 */
export function lessonLabel(lesson: Pick<CourseLesson, 'id' | 'label'>): string {
  const t = messages().courses
  return lesson.label ? t.lessonName(lesson.label) : t.lessonN(lessonNumber(lesson))
}

/** 網址不用小數點（會被伺服器當成靜態檔副檔名）：L0 /courses/tools/1、L1 /courses/ai-tools/1-1 */
export function lessonPath(course: Course, lesson: Pick<CourseLesson, 'id'>): string {
  return `${coursePath(course)}/${lessonNumber(lesson).split('.').join('-')}`
}

export function plannedChapterPath(course: Course, chapter: PlannedChapter): string {
  return `${coursePath(course)}/${chapter.slug}`
}
