import type { JSX } from 'react'
import { COURSES, coursePath, lessonLabel, lessonPath, plannedChapterPath, requiresLogin, requiresSubscription, type Course, type PlannedChapter } from '../content/catalog'
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
import { SubscriptionGate } from './SubscriptionGate'

/** 用互動版播放的課:課號 → 把互動點加進課程腳本的函式 */
const INTERACTIVE_LESSONS: Record<string, (script: StageScript) => StageScript> = {
  '0.0': withL0Moments,
  '0.1': withL01Moments,
  '0.2': withL02Moments,
  '0.intro': withL0IntroMoments,
}

function lessonElement(course: Course, lesson: CourseLesson): JSX.Element {
  const page = INTERACTIVE_LESSONS[lesson.id] ? (
    <InteractiveLessonPage key={lesson.id} course={course} lesson={lesson} prepare={INTERACTIVE_LESSONS[lesson.id]} />
  ) : (
    <LessonPage key={lesson.id} course={course} lesson={lesson} />
  )
  if (requiresSubscription(course)) {
    return (
      <SubscriptionGate key={lesson.id} course={course} label={lessonLabel(lesson)} title={lesson.title}>
        {page}
      </SubscriptionGate>
    )
  }
  return requiresLogin(course) ? (
    <LoginGate
      key={lesson.id}
      kicker={`${course.title} · ${lessonLabel(lesson)}`}
      title={lesson.title}
      docTitle={`${lessonLabel(lesson)} ${lesson.title}`}
      back={{ to: coursePath(course), label: '回課程總覽' }}
      note="這門課免費，登入後就能觀看，也會記錄你的播放進度。"
    >
      {page}
    </LoginGate>
  ) : (
    page
  )
}

// 規劃中的章節頁:訂閱課程沒訂閱時點進來是訂閱畫面,章節清單(課程總覽)仍公開
function plannedChapterElement(course: Course, chapter: PlannedChapter): JSX.Element {
  const page = <PlannedChapterPage key={chapter.slug} course={course} chapter={chapter} />
  if (!requiresSubscription(course)) return page
  return (
    <SubscriptionGate key={chapter.slug} course={course} label={chapter.label} title={chapter.title}>
      {page}
    </SubscriptionGate>
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
              <CourseOverviewPage course={course} interactive={Object.keys(INTERACTIVE_LESSONS)} />
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
    element: plannedChapterElement(course, chapter),
  })),
]),
]
