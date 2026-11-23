import { useAuth } from '../auth/AuthContext'
import { useCourseMap } from '../content/courseMap'
import { AdSlot } from '../site/AdSlot'
import { lessonAllowsAds, userSeesAds } from './lessonAds'

/** 單課頁的廣告位;確認登入狀態前和不該看廣告的人都不會出現,也不會載入 AdSense */
export function LessonAd({ course, lesson }: { course: string; lesson: { id: string } }) {
  const { status, user } = useAuth()
  const map = useCourseMap(course)
  if (status !== 'user' || !userSeesAds(user) || !lessonAllowsAds(map.status === 'ready' ? map.map : undefined, lesson)) return null
  return <AdSlot />
}
