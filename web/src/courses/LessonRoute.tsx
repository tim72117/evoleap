import { Fragment, type JSX } from 'react'
import { useParams } from 'react-router-dom'
import { courseMapId, lessonIdFromSlug, lessonUrl, type Course } from '../content/catalog'
import { useCourseMap } from '../content/courseMap'
import { NotFoundPage } from '../site/NotFoundPage'

// 參數化的單課路由 /courses/<課程>/:lesson:這個網址是哪一課照課程地圖 API(和 server 的 courseseo.go 同一個規則,見 lessonUrl),
// 前端不列課號,CLI 新增的課不用重新 build。地圖裡沒有這一課顯示「找不到頁面」;
// 地圖還在讀、讀不到時交給該課程的單課頁畫讀取中/讀不到(它用同一份地圖),課號先照網址推回。

export function LessonRoute({ course, render }: { course: Course; render: (id: string) => JSX.Element }) {
  const slug = useParams().lesson!
  const state = useCourseMap(courseMapId(course))
  const path = `/courses/${course.slug}/${slug}`
  const found = state.status === 'ready' ? state.map.units.flatMap((u) => u.lessons).find((l) => lessonUrl(course.slug, l.id) === path) : undefined
  if (state.status === 'ready' && !found) return <NotFoundPage />
  const id = found?.id ?? lessonIdFromSlug(course.slug, slug)
  // key:換課時整頁重新掛載(播放器、面板的狀態不沿用上一課)
  return <Fragment key={slug}>{render(id)}</Fragment>
}
