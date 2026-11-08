// 課程地圖(一門課 → 單元 → 一堂一堂的課):從資料庫讀(GET /api/courses/{id}/map,伺服器的 courses、course_units、lessons 表)。
// 資料來源是 server/internal/store/courses_seed.json,伺服器啟動時同步進資料表;courseMap.test.ts 檢查它和前端的課程內容一致。
import { useEffect, useState } from 'react'

export type CourseAccess = 'free' | 'login-free' | 'subscription'

export type MapLesson = {
  id: string
  title: string
  /** 這一堂學會什麼 */
  summary: string
  /** 實際的存取方式(伺服器已套用這門課的預設) */
  access: CourseAccess
  /** open:已開放;planned:規劃中 */
  status: 'open' | 'planned'
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

/** 讀一門課的課程地圖;讀不到時是 error(畫面提示稍後再試) */
export function useCourseMap(id: string): CourseMapState {
  const [state, setState] = useState<CourseMapState>({ status: 'loading' })
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
  return state
}
