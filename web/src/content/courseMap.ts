// 課程地圖(一門課 → 單元 → 一堂一堂的課):從資料庫讀(GET /api/courses/{id}/map,伺服器的 courses、course_units、lessons 表)。
// 資料來源是 server/internal/store/courses_seed.json,部署時(正式環境的同步工作)或本機後端啟動時同步進資料表;courseMap.test.ts 檢查它和前端的課程內容一致。
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export type CourseAccess = 'free' | 'login-free' | 'subscription'

export type MapLesson = {
  id: string
  title: string
  /** 這一堂學會什麼 */
  summary: string
  /** 實際的存取方式(伺服器已套用這門課的預設) */
  access: CourseAccess
  /** open:已開放;draft:草稿(只有管理員會拿到,其他人看到的是 planned);planned:規劃中 */
  status: 'open' | 'draft' | 'planned'
  /** 課程頁要播的腳本(src/content/live/ 底下的路徑);看得到這一課的人才有,暫時記在課程資料裡 */
  script?: string
  /** 預估的學習時間(分鐘,含影片與跟做);還沒估的課沒有 */
  minutes?: number
}
export type MapUnit = {
  id: string
  title: string
  /** 單元標題下的小字(兒童課是比喻,網頁怎麼運作是這個單元回答的問題) */
  subtitle: string
  lessons: MapLesson[]
}
export type CourseMap = { id: string; title: string; access: CourseAccess; tier?: string; units: MapUnit[] }

export async function fetchCourseMap(id: string): Promise<CourseMap> {
  const res = await fetch(`/api/courses/${encodeURIComponent(id)}/map`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`課程地圖讀取失敗(${res.status})`)
  return (await res.json()) as CourseMap
}

export type CourseMapState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; map: CourseMap }

/**
 * 草稿的課當成規劃中(沒有腳本、不能點)。伺服器本來就只把草稿給管理員,但管理員在會員空間「模擬身分」時
 * 伺服器仍把他當管理員,畫面要照模擬的身分(useCourseMap);前端內建的備援地圖不是管理員時也這樣處理(CourseMapUnits)。
 */
export function hideDrafts<T extends { lessons: MapLesson[] }>(units: T[], isAdmin: boolean): T[] {
  if (isAdmin) return units
  return units.map((u) => ({ ...u, lessons: u.lessons.map((l) => (l.status === 'draft' ? { ...l, status: 'planned' as const, script: undefined } : l)) }))
}

/** 讀一門課的課程地圖;讀不到時是 error(畫面提示稍後再試)。草稿的課只有管理員看得到(伺服器依登入的人決定,畫面另外照模擬的身分,見 hideDrafts) */
export function useCourseMap(id: string): CourseMapState {
  const [state, setState] = useState<CourseMapState>({ status: 'loading' })
  // 模擬其他身分時(simulation 不是 admin),畫面照模擬的身分:看不到草稿
  const simulating = useAuth().simulation !== 'admin'
  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchCourseMap(id)
      .then((map) => !cancelled && setState({ status: 'ready', map }))
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [id])
  return useMemo(() => (state.status === 'ready' && simulating ? { status: 'ready', map: { ...state.map, units: hideDrafts(state.map.units, false) } } : state), [state, simulating])
}
