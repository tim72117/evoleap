import type { JSX } from 'react'
import { COURSES, coursePath, lessonPath, plannedChapterPath } from '../content/catalog'
import { AI_AGENT_COURSE_PATH } from '../content/aiAgent'
import { AiAgentCoursePage } from './AiAgentCoursePage'
import { CourseOverviewPage, LessonPage } from './LessonPage'
import { PlannedChapterPage, PlannedCourseOverviewPage } from './PlannedPages'

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
              <CourseOverviewPage course={course} />
            ) : (
              <PlannedCourseOverviewPage course={course} />
            ),
        },
      ]),
  ...course.lessons.map((lesson) => ({
    path: lessonPath(course, lesson),
    element: <LessonPage key={lesson.id} course={course} lesson={lesson} />,
  })),
  ...course.planned.map((chapter) => ({
    path: plannedChapterPath(course, chapter),
    element: <PlannedChapterPage key={chapter.slug} course={course} chapter={chapter} />,
  })),
]),
]
