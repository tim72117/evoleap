import type { JSX } from 'react'
import { COURSES, coursePath, lessonPath, plannedChapterPath } from '../content/catalog'
import { AI_AGENT_COURSE_PATH } from '../content/aiAgent'
import { withL0Moments } from '../studio/interactive/l0-0.0'
import { withL01Moments } from '../studio/interactive/l0-0.1'
import { withL0IntroMoments } from '../studio/interactive/l0-intro'
import type { StageScript } from '../live/stage'
import { AiAgentCoursePage } from './AiAgentCoursePage'
import { InteractiveLessonPage } from './InteractiveLessonPage'
import { CourseOverviewPage } from './CourseOverviewPage'
import { LessonPage } from './LessonPage'
import { PlannedChapterPage, PlannedCourseOverviewPage } from './PlannedPages'

/** 用互動版播放的課:課號 → 把互動點加進課程腳本的函式 */
const INTERACTIVE_LESSONS: Record<string, (script: StageScript) => StageScript> = {
  '0.0': withL0Moments,
  '0.1': withL01Moments,
  '0.intro': withL0IntroMoments,
}

// 依 catalog.ts 產生每門課的總覽頁、上課頁與規劃中章節頁的路由。
export const courseRoutes: { path: string; element: JSX.Element }[] = [
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
    element: INTERACTIVE_LESSONS[lesson.id] ? (
      <InteractiveLessonPage key={lesson.id} course={course} lesson={lesson} prepare={INTERACTIVE_LESSONS[lesson.id]} />
    ) : (
      <LessonPage key={lesson.id} course={course} lesson={lesson} />
    ),
  })),
  ...course.planned.map((chapter) => ({
    path: plannedChapterPath(course, chapter),
    element: <PlannedChapterPage key={chapter.slug} course={course} chapter={chapter} />,
  })),
]),
]
