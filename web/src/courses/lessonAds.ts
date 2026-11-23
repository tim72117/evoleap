import type { User } from '../auth/api'
import { isPreviewLesson } from '../content/catalog'
import type { CourseMap } from '../content/courseMap'

// 哪些人在哪些課看到廣告:序章和每門課的第一堂正課(照課程地圖的課順序;草稿與還沒開放的課不算)沒有廣告,之後的課只對登入、沒訂閱的人顯示。
// 訪客不顯示:正式課要登入才看得到,序章也不放。兒童課不走這裡,不放廣告。

/**
 * 這一堂課可以放廣告嗎:序章與第一堂正課以外。第一堂正課照課程地圖(資料庫,執行時讀 API,CLI 改狀態立即生效)找:序章以外第一個 open 的課。
 * 草稿只有管理員看得到(管理員不看廣告),還沒開放的課沒有人在上,所以都不算第一堂正課。地圖還沒讀到時不放廣告
 */
export function lessonAllowsAds(map: CourseMap | undefined, lesson: { id: string }): boolean {
  if (isPreviewLesson(lesson) || !map) return false
  const first = map.units.flatMap((u) => u.lessons).find((l) => !isPreviewLesson(l) && l.status === 'open')
  return !!first && first.id !== lesson.id
}

/** 這位使用者要看廣告嗎:管理員不算(AdSense 禁止站方點擊或灌自己的曝光),訂閱者免廣告 */
export function userSeesAds(user: User | null): boolean {
  return !!user && !user.isAdmin && !user.subscribed
}
