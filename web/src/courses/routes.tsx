import type { JSX } from 'react'
import { COURSES, coursePath, lessonLabel, lessonPath, plannedChapterPath, requiresLogin, type Course } from '../content/catalog'
import type { CourseLesson } from '../content/lessonTypes'
import { AI_AGENT_COURSE_PATH } from '../content/aiAgent'
import { AiAgentCoursePage } from './AiAgentCoursePage'
import { CourseListPage } from './CourseListPage'
import { CourseOverviewPage } from './CourseOverviewPage'
import { COURSE_LIST } from '../content/topics'
import { useT } from '../i18n/I18nProvider'
import { lazyPage } from '../site/lazyPage'
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
  return requiresLogin(course, lesson) ? (
    <GatedLesson key={lesson.id} course={course} lesson={lesson}>
      {page}
    </GatedLesson>
  ) : (
    page
  )
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
