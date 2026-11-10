import type { JSX } from 'react'
import { COURSES, coursePath, lessonLabel, lessonPath, plannedChapterPath, requiresLogin, type Course } from '../content/catalog'
import type { CourseLesson } from '../content/lessonTypes'
import { AI_AGENT_COURSE_PATH } from '../content/aiAgent'
import { withL0Moments } from '../studio/interactive/l0-0.0'
import { withL01Moments } from '../studio/interactive/l0-0.1'
import { withL02Moments } from '../studio/interactive/l0-0.2'
import { withL0IntroMoments } from '../studio/interactive/l0-intro'
import type { StageScript } from '../live/stage'
import { AiAgentCoursePage } from './AiAgentCoursePage'
import { InteractiveLessonPage } from './InteractiveLessonPage'
import { CourseListPage } from './CourseListPage'
import { CourseOverviewPage } from './CourseOverviewPage'
import { COURSE_LIST } from '../content/topics'
import { LessonPage } from './LessonPage'
import { LoginGate } from './LoginGate'
import { PlannedChapterPage, PlannedCourseOverviewPage } from './PlannedPages'

/** 用互動版播放的課:課號 → 把互動點加進課程腳本的函式 */
const INTERACTIVE_LESSONS: Record<string, (script: StageScript) => StageScript> = {
  '0.0': withL0Moments,
  '0.1': withL01Moments,
  '0.2': withL02Moments,
  '0.intro': withL0IntroMoments,
}

/** 有即時教學影片的課都用滿版播放器(InteractiveLessonPage);有互動點的課再把互動點加進腳本 */
const hasLive = (lesson: CourseLesson) => Boolean(lesson.videos[0]?.live)
const asIs = (script: StageScript) => script

function lessonElement(course: Course, lesson: CourseLesson): JSX.Element {
  const page = hasLive(lesson) ? (
    <InteractiveLessonPage key={lesson.id} course={course} lesson={lesson} prepare={INTERACTIVE_LESSONS[lesson.id] ?? asIs} />
  ) : (
    <LessonPage key={lesson.id} course={course} lesson={lesson} />
  )
  return requiresLogin(course, lesson) ? (
    <LoginGate
      key={lesson.id}
      kicker={`${course.title} · ${lessonLabel(lesson)}`}
      title={lesson.title}
      docTitle={`${lessonLabel(lesson)} ${lesson.title}`}
      back={{ to: coursePath(course), label: '回課程總覽' }}
      note="序章可以直接預覽；第 0 課登入後免費觀看，之後的課程需要訂閱。登入後也會記錄你的播放進度。"
    >
      {page}
    </LoginGate>
  ) : (
    page
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
