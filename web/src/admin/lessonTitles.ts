// 後台把觀看紀錄的代號(live:<腳本>、kids:<腳本>)對回資料庫的課:「課程名稱 · 課號 課名」。
// 紀錄綁的是腳本路徑:課換了腳本檔名,舊紀錄就對不回來,畫面退回原本的代號。
import { useMemo } from 'react'
import { lessonLabel } from '../content/catalog'
import { useCourseMaps, type CourseMap } from '../content/courseMap'

const COURSES = ['software', 'launch', 'web', 'kids', 'claude-code']

export type LessonTitles = (key: string) => string | undefined

export function lessonTitles(maps: Record<string, CourseMap | undefined>): LessonTitles {
  const byScript = new Map<string, string>()
  for (const [course, map] of Object.entries(maps)) {
    if (!map) continue
    if (map.introScript) byScript.set(map.introScript, `${map.title} · 簡介影片`)
    for (const l of map.units.flatMap((u) => u.lessons)) {
      const label = course === 'software' ? lessonLabel(l) : l.id
      if (l.script) byScript.set(l.script, `${map.title} · ${label} ${l.title}`)
    }
  }
  return (key) => byScript.get(key.replace(/^(live|kids):/, ''))
}

export function useLessonTitles(): LessonTitles {
  const maps = useCourseMaps(COURSES)
  return useMemo(() => lessonTitles(maps), [maps])
}
