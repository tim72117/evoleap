import type { JSX } from 'react'
import { COURSES, coursePath, courseMapId, lessonLabel, lessonPath, plannedChapterPath, type Course } from '../content/catalog'
import type { CourseLesson } from '../content/lessonTypes'
import { AI_AGENT_COURSE_PATH } from '../content/aiAgent'
import { useCourseMap, type MapLesson } from '../content/courseMap'
import { AiAgentCoursePage } from './AiAgentCoursePage'
import { CourseListPage } from './CourseListPage'
import { CourseOverviewPage } from './CourseOverviewPage'
import { COURSE_LIST } from '../content/topics'
import { useT } from '../i18n/I18nProvider'
import { lazyPage } from '../site/lazyPage'
import { SiteLayout } from '../site/SiteLayout'
import { LessonListStatus } from './LessonGroup'
import { LoginGate } from './LoginGate'
import { PlannedChapterPage, PlannedCourseOverviewPage } from './PlannedPages'

// 上課頁(播放器、舞台引擎與演員)用到才下載,不放進課程總覽、課程地圖就要下載的主程式
const InteractiveLessonPage = lazyPage(() => import('./InteractiveLessonPage').then((m) => m.InteractiveLessonPage))
const LessonPage = lazyPage(() => import('./LessonPage').then((m) => m.LessonPage))

/** 有即時教學影片的課都用滿版播放器(InteractiveLessonPage);有互動點的課,互動點在 InteractiveLessonPage 裡加進腳本 */
const hasLive = (lesson: CourseLesson) => Boolean(lesson.videos[0]?.live)

function lessonElement(course: Course, lesson: CourseLesson): JSX.Element {
  const page = hasLive(lesson) ? (
    <InteractiveLessonPage key={lesson.id} course={course} lesson={lesson} />
  ) : (
    <LessonPage key={lesson.id} course={course} lesson={lesson} />
  )
  if (lesson.draft) return <DraftLessonGate key={lesson.id} course={course} lesson={lesson} page={page} />
  return <AccessLessonGate key={lesson.id} course={course} lesson={lesson} page={page} />
}

/** 課程地圖還在讀、讀不到時的單課頁:一張佔位卡或「無法讀取」(不用前端寫死的課程資料頂替) */
function LessonInfoStatus({ state }: { state: 'loading' | 'error' }) {
  return (
    <SiteLayout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px', minHeight: '60vh' }}>
        <LessonListStatus state={state} />
      </div>
    </SiteLayout>
  )
}

/** 這一課在課程地圖裡的資料;地圖裡沒有這一課(不在資料庫)是 undefined */
const lessonInMap = (map: { map: { units: { lessons: MapLesson[] }[] } }, id: string) => map.map.units.flatMap((u) => u.lessons).find((l) => l.id === id)

/**
 * 要不要登入照資料庫(課程地圖 API 的這一課 access,和伺服器把關腳本的規則同一份;用 evoleap lesson set -access 改了就跟著變):
 * free 直接給看,其他(登入後免費、訂閱)要登入(LoginGate)。讀取中顯示佔位卡、讀不到顯示「無法讀取」;
 * 地圖裡沒有這一課(資料庫沒有)當成還沒開放,顯示規劃中的章節頁。沒有前端的備援規則。
 */
function AccessLessonGate({ course, lesson, page }: { course: Course; lesson: CourseLesson; page: JSX.Element }) {
  const map = useCourseMap(courseMapId(course))
  if (map.status !== 'ready') return <LessonInfoStatus state={map.status} />
  const entry = lessonInMap(map, lesson.id)
  if (!entry) return <PlannedLesson course={course} lesson={lesson} />
  return entry.access !== 'free' ? (
    <GatedLesson course={course} lesson={lesson}>
      {page}
    </GatedLesson>
  ) : (
    page
  )
}

/** 還沒開放的單課:規劃中的章節頁(不載入播放器) */
function PlannedLesson({ course, lesson }: { course: Course; lesson: CourseLesson }) {
  return <PlannedChapterPage course={course} chapter={{ slug: lessonPath(course, lesson).split('/').pop()!, label: lesson.id, title: lesson.title, summary: lesson.goal }} />
}

/**
 * 草稿的課(lesson.draft):照課程地圖 API 決定給不給看。伺服器只把草稿給管理員(腳本檔也一樣把關),
 * 其他人(含模擬其他身分的管理員)拿到的是規劃中,這時顯示規劃中的章節頁,不載入播放器。
 */
function DraftLessonGate({ course, lesson, page }: { course: Course; lesson: CourseLesson; page: JSX.Element }) {
  const map = useCourseMap(courseMapId(course))
  if (map.status !== 'ready') return <LessonInfoStatus state={map.status} />
  const status = lessonInMap(map, lesson.id)?.status
  return status === 'draft' || status === 'open' ? page : <PlannedLesson course={course} lesson={lesson} />
}

/** 要登入的單課頁:文字在渲染時取目前語言(路由表是模組層級建好的) */
function GatedLesson({ course, lesson, children }: { course: Course; lesson: CourseLesson; children: JSX.Element }) {
  const t = useT().courses
  const label = lessonLabel(lesson)
  return (
    <LoginGate
      kicker={`${course.title} · ${label}`}
      title={lesson.title}
      docTitle={`${label} ${lesson.title}`}
      back={{ to: coursePath(course), label: t.backToOverview }}
      note={t.gate.note}
    >
      {children}
    </LoginGate>
  )
}

// 依 catalog.ts 產生每門課的總覽頁、上課頁與規劃中章節頁的路由。
export const courseRoutes: { path: string; element: JSX.Element }[] = [
  { path: COURSE_LIST.path, element: <CourseListPage /> },
  // L3 的課程總覽是專屬頁面(catalog 裡標記 customOverview)
  { path: AI_AGENT_COURSE_PATH, element: <AiAgentCoursePage /> },
  ...COURSES.flatMap((course) => [
  ...(course.customOverview
    ? []
    : [
        {
          path: coursePath(course),
          element:
            course.lessons.length > 0 ? (
              <CourseOverviewPage course={course} />
            ) : (
              <PlannedCourseOverviewPage course={course} />
            ),
        },
      ]),
  ...course.lessons.map((lesson) => ({
    path: lessonPath(course, lesson),
    element: lessonElement(course, lesson),
  })),
  ...course.planned.map((chapter) => ({
    path: plannedChapterPath(course, chapter),
    element: <PlannedChapterPage key={chapter.slug} course={course} chapter={chapter} />,
  })),
]),
]
