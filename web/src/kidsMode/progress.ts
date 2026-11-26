import { useEffect, useState } from 'react'
import { fetchCourseMap, type CourseMap } from '../content/courseMap'
import { progressApi } from '../courses/progress'
import { isFinished } from '../member/memberCourses'

// 兒童模式的進度(播放進度 GET /api/progress;兒童模式時伺服器回這個孩子自己的進度 child_progress):看完了哪幾課、接下來要上哪一課。
// 哪幾課已開放照資料庫的課程地圖(和伺服器同一份,用 evoleap CLI 開課後不用重新部署;但下次部署會照種子同步,種子也要一起改);讀不到時沒有開放的課(進度與這週的課先不顯示),不用前端寫死的清單頂替。
// 「這週的課」(KidsSchedulePanel)排最近一次的課、課程頁擋還沒到的課(KidsLessonPage)都用這一份;伺服器的 store.KidsLessonOpen 是同一套規則。

export type KidsProgress = {
  /** 看完的課號 */
  finished: Set<string>
  /** 接下來要上的課:已開放的課裡第一個還沒看完的;都看完了是 null */
  next: string | null
}

/** released:已開放的課(依課程順序) */
export const kidsProgressOf = (finished: Set<string>, released: string[]): KidsProgress => ({
  finished,
  next: released.find((id) => !finished.has(id)) ?? null,
})

/** 課程地圖裡已開放而且有腳本的課(依課程順序,和伺服器的 store.KidsLessonOpen 同一套);草稿只有管理員拿得到,也不算 */
export const releasedOf = (map: CourseMap): string[] =>
  map.units.flatMap((u) => u.lessons).filter((l) => l.status === 'open' && l.script).map((l) => l.id)

/** 上課紀錄的 kids:<腳本> → 課號(腳本照課程地圖) */
export const lessonByKeyOf = (map: CourseMap): Map<string, string> =>
  new Map(map.units.flatMap((u) => u.lessons).flatMap((l) => (l.script ? [[`kids:${l.script}`, l.id] as const] : [])))

// 同一次瀏覽只讀一次;讀不到時丟出錯誤(下次再試)
let mapReq: Promise<CourseMap> | null = null
function loadKidsMap(): Promise<CourseMap> {
  mapReq ??= fetchCourseMap('kids').catch((err) => {
    mapReq = null
    throw err
  })
  return mapReq
}
export const loadKidsReleased = (): Promise<string[]> => loadKidsMap().then(releasedOf)

/** 已開放的兒童課:讀到之前是 'loading',讀不到是 'error'(畫面要說明,不能當成沒有課) */
export function useKidsReleasedState(): string[] | 'loading' | 'error' {
  const [released, setReleased] = useState<string[] | 'loading' | 'error'>('loading')
  useEffect(() => {
    let cancelled = false
    loadKidsReleased().then(
      (r) => !cancelled && setReleased(r),
      () => !cancelled && setReleased('error'),
    )
    return () => {
      cancelled = true
    }
  }, [])
  return released
}

/** 已開放的兒童課;讀到之前、讀不到都是 null */
export function useKidsReleased(): string[] | null {
  const r = useKidsReleasedState()
  return Array.isArray(r) ? r : null
}

/** 還沒到的課:不是看完的,也不是接下來要上的那一課 */
export const isLockedLesson = (p: KidsProgress, id: string): boolean => !p.finished.has(id) && id !== p.next

/** 讀進度;讀到之前是 null */
export function useKidsProgress(enabled = true): KidsProgress | null {
  const [progress, setProgress] = useState<KidsProgress | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    // 讀不到進度:當作都還沒看,只有第一課打得開
    const list = progressApi.list().catch(() => [])
    // 開放的課讀不到時進度不算(維持 null),不用前端的清單猜
    Promise.all([list, loadKidsMap()]).then(
      ([records, map]) => {
        if (cancelled) return
        const done = new Set<string>()
        for (const [key, id] of lessonByKeyOf(map)) {
          const p = records.find((x) => x.lesson === key)
          if (p && isFinished(p)) done.add(id)
        }
        setProgress(kidsProgressOf(done, releasedOf(map)))
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [enabled])
  return progress
}
