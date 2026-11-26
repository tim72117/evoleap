// 學員端課程目錄：課程地圖上每個等級一門課，每門課有自己的總覽頁網址（SEO 逐頁產生）。
// 「做出自己的軟體」(software)的單課:課程結構(課號、課名、一句話、腳本、開放與否、階段)的來源是資料庫(課程頁的 SEO 由 server 讀資料庫組出來,server/cmd/server/courseseo.go);
// 執行期主程式只帶小骨架(softwareOutline.ts:階段),單課路由是參數化的(/courses/<課程>/:lesson,courses/LessonRoute.tsx 照課程地圖找課),所以 CLI 新增的課不用重新部署;課號、課名、開放與否、hidden 都讀 API,這裡不放前端寫死的課程內容。
// 其他課的單課頁在別處產生(home/TopicScenePage 等);planned 只剩還沒有課程地圖的進階課用。
// 新增一門課：在這裡加一筆（還沒有自己頁面的課，例如打造 AI 互動軟體的中階課，只寫進種子、介紹放在主題頁，不放這裡），routes.tsx 與 seo/coursePages.ts 會自動產生路由與課程頁清單；課程結構也要寫進 資料庫（content/courseMap.test.ts 檢查一致）。
// 課程總覽與課程列表的內容(標題、簡介、說明段落、插圖、單元、每一課的一句話、時間、開放與否)全部從資料庫讀(courseMap.ts),這裡只留路由需要的資料。
import { ALL_LEVELS, LEVELS, levelPath, type CourseLevel } from './levels'
import { SOFTWARE_OUTLINE } from './softwareOutline'
import type { CourseMap, MapLesson } from './courseMap'
import { messages } from '../i18n/current'
import { CLAUDE_CODE_TOPIC, KIDS_TOPIC, LAUNCH_TOPIC, WEB_TOPIC } from './topics'

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

/** 一門課的一個階段(「做出自己的軟體」的起步、零基礎、基礎):資料庫裡是這門課的一個單元,id 與等級 id(levels.ts)、單元 id 相同 */
export interface CourseStage {
  /** 等級 id,也是資料庫的單元 id:tools、ai-tools、vibe-coding-basics */
  id: string
  /** 階段名稱:起步、零基礎、基礎 */
  label: string
  /** 先不公開（資料庫 的單元 hidden）：課程頁、課程地圖、sitemap 都不列這個階段，各課的網址還打得開（noindex） */
  hidden?: boolean
}

export interface Course {
  /** 網址 /courses/<slug> */
  slug: string
  /** 等級標籤，例如「起步」 */
  level: string
  title: string
  status: 'available' | 'planned'
  /** 規劃中的章節(只有還沒有課程地圖的進階課用) */
  planned: PlannedChapter[]
  /** 先不公開：列表與 sitemap 都不列，網址還打得開（noindex） */
  hidden?: boolean
  /** 分成幾個階段的課程(「做出自己的軟體」):各階段是種子的單元;各階段的存取方式在 levels.ts 的同 id 等級 */
  stages?: CourseStage[]
}

function level(id: string): CourseLevel {
  const l = ALL_LEVELS.find((x) => x.id === id)
  if (!l) throw new Error(`unknown level: ${id}`)
  return l
}

function fromLevel(id: string, slug: string, levelLabel: string): Pick<Course, 'slug' | 'level' | 'title' | 'hidden'> {
  const l = level(id)
  return { slug, level: levelLabel, title: l.title, ...(l.hidden ? { hidden: true } : {}) }
}

// 階段名稱與先不公開占位來自小骨架(softwareOutline.ts);課程總覽頁與首頁讀 API 的單元 label、hidden
const stage = (id: string): CourseStage => {
  const unit = SOFTWARE_OUTLINE.find((u) => u.id === id)
  if (!unit) throw new Error(`softwareOutline.ts 沒有單元 ${id}`)
  return { id, label: unit.label, ...(unit.hidden ? { hidden: true } : {}) }
}

/** 「做出自己的軟體」:一門課,起步(tools)、零基礎(ai-tools)、基礎(vibe-coding-basics)是它的三個階段(資料庫的三個單元) */
const SOFTWARE_STAGES: CourseStage[] = ['tools', 'ai-tools', 'vibe-coding-basics'].map(stage)

export const COURSES: Course[] = [
  {
    slug: 'software',
    level: '起步・零基礎・基礎',
    title: '做出自己的軟體',
    status: 'available',
    planned: [],
    stages: SOFTWARE_STAGES,
  },
  {
    // 網頁怎麼運作:課程總覽頁和其他課共用(CourseOverviewPage,照資料庫的課程地圖),一課一頁由 home/TopicScenePage 產生(網址在 WEB_LESSON_PAGES)
    slug: 'web',
    level: WEB_TOPIC.name,
    title: WEB_TOPIC.name,
    status: 'available',
    planned: [],
  },
  {
    // 從做好到上線:同樣共用課程總覽頁;草稿的課也有頁面(只有管理員進得來),總覽頁照資料庫的 status 對一般訪客當規劃中、不連
    slug: 'launch',
    level: LAUNCH_TOPIC.name,
    title: LAUNCH_TOPIC.name,
    status: 'available',
    planned: [],
  },
  {
    // 給孩子的網頁程式:同樣共用課程總覽頁(兒童模式中顯示家長排好的本週課程);一課一頁由 home/KidsLessonPage 產生(網址在 KIDS_LESSON_PAGES)
    slug: 'kids',
    level: KIDS_TOPIC.name,
    title: KIDS_TOPIC.name,
    status: 'available',
    planned: [],
  },
  {
    // Claude Code 工作術:使用情境一個情境一課(課號 1–7),有示範影片的情境才有頁面
    slug: 'claude-code',
    level: CLAUDE_CODE_TOPIC.name,
    title: CLAUDE_CODE_TOPIC.name,
    status: 'available',
    planned: [],
  },
  {
    ...fromLevel('advanced', 'advanced', 'AI 互動軟體 進階'),
    status: 'planned',
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

/** 同一個主題的下一章(下一門課):中階 → 進階。最後一章回傳 undefined。分階段的課(做出自己的軟體)在課內依序上,沒有下一門 */
export function nextCourse(course: Course): Course | undefined {
  if (course.stages) return undefined
  const lv = ALL_LEVELS.find((l) => levelPath(l) === coursePath(course))
  if (!lv) return undefined
  // 先不公開(hidden)的等級跳過,不當成下一章
  const group = (LEVELS.includes(lv) ? LEVELS : ALL_LEVELS.filter((l) => !LEVELS.includes(l))).filter((l) => l === lv || !l.hidden)
  const nextLevel = group[group.indexOf(lv) + 1]
  return nextLevel && COURSES.find((c) => coursePath(c) === levelPath(nextLevel))
}

/** 不用登入就能預覽的單課(序章):做出自己的軟體的 0.intro */
export const PREVIEW_LESSON_ID = '0.intro'
export function isPreviewLesson(lesson: { id: string }): boolean {
  return lesson.id === PREVIEW_LESSON_ID
}

/** 課程地圖 API 用的課程 id(資料庫 的 id;網址的 slug 不一定相同,例如 ai-agent 的等級 id)。分階段的課就是課程自己的 slug(software) */
export const courseMapId = (course: Course): string => (course.stages ? course.slug : (ALL_LEVELS.find((l) => levelPath(l) === coursePath(course))?.id ?? course.slug))

/** 等級(levels.ts)對到的課程:「做出自己的軟體」的三個等級都是 software 課程的階段 */
export const courseOfLevel = (level: Pick<CourseLevel, 'link'>): Course | undefined => COURSES.find((c) => coursePath(c) === levelPath(level))

/** 等級要讀的課程地圖 id:有對到課程就是那門課的地圖 id(software),否則是等級 id */
export const levelMapId = (level: Pick<CourseLevel, 'id' | 'link'>): string => {
  const c = courseOfLevel(level)
  return c ? courseMapId(c) : level.id
}

/** 等級在課程地圖裡的課:分階段的課只取同 id 的單元(階段),其他課是整張地圖。地圖還沒讀到是 undefined */
export function levelMapLessons(map: CourseMap | undefined, level: Pick<CourseLevel, 'id' | 'link'>): MapLesson[] | undefined {
  if (!map) return undefined
  const staged = courseOfLevel(level)?.stages !== undefined
  return map.units.filter((u) => !staged || u.id === level.id).flatMap((u) => u.lessons)
}

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

export function plannedChapterPath(course: Course, chapter: PlannedChapter): string {
  return `${coursePath(course)}/${chapter.slug}`
}
