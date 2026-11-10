import type { User } from '../auth/api'
import { isPreviewLesson, stageOf, type Course } from '../content/catalog'
import type { CourseLesson } from '../content/lessonTypes'

// 哪些人在哪些課看到廣告:序章和每門課(分階段的課是每個階段)的第一堂正課(第 0 課)沒有廣告,之後的課只對登入、沒訂閱的人顯示。
// 訪客不顯示:正式課要登入才看得到,序章也不放。兒童課不走這裡,不放廣告。

/** 這一堂課可以放廣告嗎:序章與第一堂正課以外 */
export function lessonAllowsAds(course: Course, lesson: CourseLesson): boolean {
  if (isPreviewLesson(lesson)) return false
  // 分階段的課(做出自己的軟體)每個階段各自的第一堂正課沒有廣告
  const lessons = stageOf(course, lesson)?.lessons ?? course.lessons
  return lessons.find((l) => !isPreviewLesson(l)) !== lesson
}

/** 這位使用者要看廣告嗎:管理員不算(AdSense 禁止站方點擊或灌自己的曝光),訂閱者免廣告 */
export function userSeesAds(user: User | null): boolean {
  return !!user && !user.isAdmin && !user.subscribed
}
