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
 * 伺服器仍把他當管理員,畫面要照模擬的身分(useCourseMap)。
 */
export function hideDrafts<T extends { lessons: MapLesson[] }>(units: T[], isAdmin: boolean): T[] {
  if (isAdmin) return units
  return units.map((u) => ({ ...u, lessons: u.lessons.map((l) => (l.status === 'draft' ? { ...l, status: 'planned' as const, script: undefined } : l)) }))
}

// 讀過的課程地圖記在記憶體裡(依課程與登入的人分開:管理員拿到的有草稿,不能給別人看):換課、回到上一頁時先用記住的,背景再讀一次更新,
// 不用每次都先顯示讀取中(單課頁要等地圖才知道要不要登入,不記的話每一課都先空白一下)。
// 同一份地圖正在讀的時候共用同一個請求(同一頁上好幾個元件讀同一門課,只打一次 API)。
const mapCache = new Map<string, CourseMap>()
const inflight = new Map<string, Promise<CourseMap>>()
function loadCourseMap(key: string, id: string): Promise<CourseMap> {
  let p = inflight.get(key)
  if (!p) {
    p = fetchCourseMap(id)
      .then((map) => {
        mapCache.set(key, map)
        return map
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, p)
  }
  return p
}

/** 讀一門課的課程地圖;讀不到時是 error(畫面提示稍後再試)。草稿的課只有管理員看得到(伺服器依登入的人決定,畫面另外照模擬的身分,見 hideDrafts) */
export function useCourseMap(id: string): CourseMapState {
  // 登入的人換了(登入、登出)就重讀:地圖內容依人而不同
  const who = useAuth().user?.id ?? 'guest'
  const key = `${who}:${id}`
  // 結果記著是哪一組(key)讀到的:課程或登入的人換了的那一個 render,不能拿上一組的結果(例如管理員登出後還看到草稿)
  const [res, setRes] = useState<{ key: string; state: CourseMapState } | null>(null)
  const hit = mapCache.get(key)
  const state: CourseMapState = res?.key === key ? res.state : hit ? { status: 'ready', map: hit } : { status: 'loading' }
  // 模擬其他身分時(simulation 不是 admin),畫面照模擬的身分:看不到草稿
  const simulating = useAuth().simulation !== 'admin'
  useEffect(() => {
    let cancelled = false
    loadCourseMap(key, id).then(
      (map) => !cancelled && setRes({ key, state: { status: 'ready', map } }),
      // 已經有記住的就繼續用,沒有才是讀不到
      () => !cancelled && setRes((r) => (r?.key === key && r.state.status === 'ready') || mapCache.has(key) ? r : { key, state: { status: 'error' } }),
    )
    return () => {
      cancelled = true
    }
  }, [id, key])
  return useMemo(() => (state.status === 'ready' && simulating ? { status: 'ready', map: { ...state.map, units: hideDrafts(state.map.units, false) } } : state), [state, simulating])
}

/**
 * 一次讀好幾門課的課程地圖(首頁、課程列表、等級卡片只要知道各課開放了沒):同一份快取與請求,讀到的先放進去;還沒讀到或讀不到的是 undefined,
 * 呼叫的畫面不顯示開放狀態(不用前端的課程資料頂替)。只看開放狀態,所以不處理模擬身分(草稿本來就不算開放)。
 */
export function useCourseMaps(ids: string[]): Record<string, CourseMap | undefined> {
  const who = useAuth().user?.id ?? 'guest'
  const idsKey = ids.join(',')
  const [maps, setMaps] = useState<Record<string, CourseMap | undefined>>({})
  useEffect(() => {
    let cancelled = false
    setMaps(Object.fromEntries(idsKey.split(',').map((id) => [id, mapCache.get(`${who}:${id}`)])))
    for (const id of idsKey.split(',')) {
      loadCourseMap(`${who}:${id}`, id).then(
        (map) => !cancelled && setMaps((m) => ({ ...m, [id]: map })),
        () => {},
      )
    }
    return () => {
      cancelled = true
    }
  }, [idsKey, who])
  return maps
}
