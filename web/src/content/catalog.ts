// 學員端課程目錄：課程地圖上每個等級一門課，每門課的章節各有自己的網址（SEO 逐頁產生）。
// - lessons：已有完整內容的章節（目標、步驟、提示詞），用 LessonPage 呈現；與提案頁共用資料。
// - planned：規劃中的章節，只有標題與簡述，用 PlannedChapterPage 呈現；內容完成後改放進 lessons。
// 新增一門課：在這裡加一筆，routes.tsx 與 seo/pages.ts 會自動產生路由與 SEO。
import { LEVELS, type CourseLevel } from './levels'
import { L2_MODULES } from './l2Outline'
import { UNITS } from './aiAgent'
import type { CourseLesson } from './lessonTypes'
import { L0_LESSONS } from './l0Lessons'
import { L1_LESSONS } from './l1Lessons'

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
  /** 等級標籤，例如「L0 起步」 */
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
  const l = LEVELS.find((x) => x.id === id)
  if (!l) throw new Error(`unknown level: ${id}`)
  return l
}

function fromLevel(id: string, slug: string, levelLabel: string): Pick<Course, 'slug' | 'level' | 'title' | 'summary'> {
  const l = level(id)
  return { slug, level: levelLabel, title: l.title, summary: l.summary }
}

export const COURSES: Course[] = [
  {
    ...fromLevel('tools', 'tools', 'L0 起步'),
    status: 'available',
    lessons: L0_LESSONS,
    planned: [],
  },
  {
    ...fromLevel('ai-tools', 'ai-tools', 'L1 零基礎'),
    status: 'available',
    lessons: L1_LESSONS,
    planned: [],
  },
  {
    ...fromLevel('vibe-coding-basics', 'vibe-coding', 'L2 基礎'),
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
    ...fromLevel('ai-agent', 'ai-agent', 'L3 中階'),
    status: 'available',
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
    ...fromLevel('advanced', 'advanced', 'L4 進階'),
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

/** 顯示用課號：L0 的「0.1」顯示為「1」（第 1 課），其他課顯示原課號（第 1.1 課） */
export function lessonNumber(lesson: CourseLesson): string {
  return lesson.id.startsWith('0.') ? lesson.id.slice(2) : lesson.id
}

/** 網址不用小數點（會被伺服器當成靜態檔副檔名）：L0 /courses/tools/1、L1 /courses/ai-tools/1-1 */
export function lessonPath(course: Course, lesson: CourseLesson): string {
  return `${coursePath(course)}/${lessonNumber(lesson).split('.').join('-')}`
}

export function plannedChapterPath(course: Course, chapter: PlannedChapter): string {
  return `${coursePath(course)}/${chapter.slug}`
}
