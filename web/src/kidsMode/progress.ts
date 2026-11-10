import { useEffect, useState } from 'react'
import { KIDS_OPEN_LESSONS, KIDS_RELEASED_LESSONS } from '../content/kidsCourse'
import { progressApi } from '../courses/progress'
import { isFinished } from '../member/memberCourses'

// 兒童模式的進度(播放進度 GET /api/progress;兒童模式時伺服器回這個孩子自己的進度 child_progress):看完了哪幾課、接下來要上哪一課。
// 「這週的課」(KidsSchedulePanel)排最近一次的課、課程頁擋還沒到的課(KidsLessonPage)都用這一份;伺服器的 store.KidsLessonOpen 是同一套規則。

export type KidsProgress = {
  /** 看完的課號 */
  finished: Set<string>
  /** 接下來要上的課:已開放的課裡第一個還沒看完的;都看完了是 null */
  next: string | null
}

export const kidsProgressOf = (finished: Set<string>): KidsProgress => ({ finished, next: KIDS_RELEASED_LESSONS.find((id) => !finished.has(id)) ?? null })

/** 還沒到的課:不是看完的,也不是接下來要上的那一課 */
export const isLockedLesson = (p: KidsProgress, id: string): boolean => !p.finished.has(id) && id !== p.next

/** 讀進度;讀到之前是 null */
export function useKidsProgress(enabled = true): KidsProgress | null {
  const [progress, setProgress] = useState<KidsProgress | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    progressApi.list().then(
      (list) => {
        if (cancelled) return
        const done = new Set<string>()
        for (const [id, l] of Object.entries(KIDS_OPEN_LESSONS)) {
          const p = list.find((x) => x.lesson === `kids:${l.script}`)
          if (p && isFinished(p)) done.add(id)
        }
        setProgress(kidsProgressOf(done))
      },
      // 讀不到進度:當作都還沒看,只有第一課打得開
      () => !cancelled && setProgress(kidsProgressOf(new Set())),
    )
    return () => {
      cancelled = true
    }
  }, [enabled])
  return progress
}
