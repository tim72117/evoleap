// 學員端課程目錄：課程地圖上每個等級一門課，每門課的章節各有自己的網址（SEO 逐頁產生）。
// - lessons：已有完整內容的章節（目標、步驟、提示詞），用 LessonPage 呈現；與提案頁共用資料。
// - planned：規劃中的章節，只有標題與簡述，用 PlannedChapterPage 呈現；內容完成後改放進 lessons。
// 新增一門課：在這裡加一筆，routes.tsx 與 seo/pages.ts 會自動產生路由與 SEO；課程結構也要寫進 server/internal/store/courses_seed.json（content/courseMap.test.ts 檢查一致）。
// 課程總覽的每一課（一句話、時間、開放與否）從資料庫讀，這裡的資料是單課頁的內容與讀到之前的備用資料。
import { ALL_LEVELS, LEVELS, levelPath, SOFTWARE_LEDE, type CourseLevel } from './levels'
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

/** 一門課的一個階段(「做出自己的軟體」的起步、零基礎、基礎):資料庫裡是這門課的一個單元,id 與等級 id(levels.ts)、單元 id 相同 */
export interface CourseStage {
  /** 等級 id,也是資料庫的單元 id:tools、ai-tools、vibe-coding-basics */
  id: string
  /** 階段名稱:起步、零基礎、基礎 */
  label: string
  lessons: CourseLesson[]
  planned: PlannedChapter[]
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
  /** 分成幾個階段的課程(「做出自己的軟體」):lessons、planned 是各階段依序合起來的;各階段的存取方式在 levels.ts 的同 id 等級 */
  stages?: CourseStage[]
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

/** 規劃中的基礎階段(Vibe Coding 入門):還沒有單課頁,每個章節一頁 */
const VIBE_PLANNED: PlannedChapter[] = L2_MODULES.flatMap((m) =>
  m.lessons.map((l, i) => ({
    slug: `${m.num}-${i + 1}`,
    label: `${m.num}.${i + 1}`,
    title: l.title,
    summary: l.objective,
    result: l.result,
  })),
)

/** 「做出自己的軟體」:一門課,起步(tools)、零基礎(ai-tools)、基礎(vibe-coding-basics)是它的三個階段(資料庫的三個單元) */
const SOFTWARE_STAGES: CourseStage[] = [
  { id: 'tools', label: level('tools').levelLabel, lessons: L0_LESSONS, planned: [] },
  { id: 'ai-tools', label: level('ai-tools').levelLabel, lessons: L1_LESSONS, planned: [] },
  { id: 'vibe-coding-basics', label: level('vibe-coding-basics').levelLabel, lessons: [], planned: VIBE_PLANNED },
]

export const COURSES: Course[] = [
  {
    slug: 'software',
    level: '起步・零基礎・基礎',
    title: '做出自己的軟體',
    summary: SOFTWARE_LEDE,
    status: 'available',
    lessons: SOFTWARE_STAGES.flatMap((st) => st.lessons),
    planned: SOFTWARE_STAGES.flatMap((st) => st.planned),
    stages: SOFTWARE_STAGES,
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

/** 課程對應的等級:分階段的課照這一課(或章節)所在的階段,其他課照課程頁路徑對到的等級 */
function levelOf(course: Course, item?: Pick<CourseLesson, 'id'> | Pick<PlannedChapter, 'slug'>): CourseLevel | undefined {
  if (course.stages) {
    const stage = item ? stageOf(course, item) : undefined
    return ALL_LEVELS.find((l) => l.id === stage?.id)
  }
  return ALL_LEVELS.find((l) => levelPath(l) === coursePath(course))
}

/** 一課(或一個規劃中的章節)所在的階段;不分階段的課回傳 undefined */
export function stageOf(course: Course, item: Pick<CourseLesson, 'id'> | Pick<PlannedChapter, 'slug'>): CourseStage | undefined {
  return course.stages?.find((st) => st.lessons.some((l) => 'id' in item && l.id === item.id) || st.planned.some((c) => 'slug' in item && c.slug === item.slug))
}

/** 顯示用的等級名稱:分階段的課是這一課所在階段(起步、零基礎、基礎),其他課是課程的 level */
export function levelLabelOf(course: Course, item?: Pick<CourseLesson, 'id'> | Pick<PlannedChapter, 'slug'>): string {
  return (item && stageOf(course, item)?.label) || course.level
}

/** 同一個主題的下一章(下一門課):中階 → 進階。最後一章回傳 undefined。分階段的課(做出自己的軟體)在課內依序上,沒有下一門 */
export function nextCourse(course: Course): Course | undefined {
  if (course.stages) return undefined
  const lv = levelOf(course)
  if (!lv) return undefined
  const group = LEVELS.includes(lv) ? LEVELS : ALL_LEVELS.filter((l) => !LEVELS.includes(l))
  const nextLevel = group[group.indexOf(lv) + 1]
  return nextLevel && COURSES.find((c) => coursePath(c) === levelPath(nextLevel))
}

/** 不用登入就能預覽的單課:只有序章這類短導覽 */
export function isPreviewLesson(lesson: CourseLesson): boolean {
  return Boolean(lesson.label)
}

/** 課程地圖標示「登入後免費」的課程(分階段的課看這一課所在的階段):預覽課以外的單課頁要登入才能看(LoginGate) */
export function requiresLogin(course: Course, lesson: CourseLesson): boolean {
  return levelOf(course, lesson)?.access === 'login-free' && !isPreviewLesson(lesson)
}

/** 課程對應的資料庫課程 id(courses_seed.json):分階段的課是課程自己的 slug(software),其他課是等級 id(例如 'ai-agent');找不到回傳 undefined */
export function levelIdOf(course: Course): string | undefined {
  return course.stages ? course.slug : levelOf(course)?.id
}

/** 課程地圖標示「訂閱」的課程(分階段的課看這一課所在的階段):單課頁要過 SubscriptionGate(廣告方案或訂閱)。'tbd' 還沒決定,不算 */
export function requiresSubscription(course: Course, lesson?: Pick<CourseLesson, 'id'>): boolean {
  return levelOf(course, lesson)?.access === 'subscription'
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

/** 網址不用小數點（會被伺服器當成靜態檔副檔名）：起步 /courses/software/1、零基礎 /courses/software/1-1 */
export function lessonPath(course: Course, lesson: Pick<CourseLesson, 'id'>): string {
  return `${coursePath(course)}/${lessonNumber(lesson).split('.').join('-')}`
}

export function plannedChapterPath(course: Course, chapter: PlannedChapter): string {
  return `${coursePath(course)}/${chapter.slug}`
}
