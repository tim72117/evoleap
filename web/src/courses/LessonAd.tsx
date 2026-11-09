import { useAuth } from '../auth/AuthContext'
import type { Course } from '../content/catalog'
import type { CourseLesson } from '../content/lessonTypes'
import { AdSlot } from '../site/AdSlot'
import { lessonAllowsAds, userSeesAds } from './lessonAds'

/** 單課頁的廣告位;確認登入狀態前和不該看廣告的人都不會出現,也不會載入 AdSense */
export function LessonAd({ course, lesson }: { course: Course; lesson: CourseLesson }) {
  const { status, user } = useAuth()
  if (status !== 'user' || !userSeesAds(user) || !lessonAllowsAds(course, lesson)) return null
  return <AdSlot />
}
