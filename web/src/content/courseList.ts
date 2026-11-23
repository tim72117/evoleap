// 全部課程清單(有哪些課、怎麼分組、課名、簡介、主題名稱與標語):從資料庫讀(GET /api/courses,公開不用登入)。
import { useEffect, useState } from 'react'
import type { CourseAccess, CourseArtKind } from './courseMap'

export type CourseListItem = {
  id: string
  title: string
  summary?: string
  access: CourseAccess
  art?: CourseArtKind
  /** 這門課所屬主題的名稱與標語;同一個主題的課在清單裡是連續的 */
  topicId: string
  topic: string
  topicSlogan: string
  /** 主題頁網址(伺服器一律有給);省略表示主題頁就是課程總覽 /courses/<id> */
  topicPath?: string
  /** false 表示這門課沒有自己的總覽頁 /courses/<id>(卡片連到主題頁);省略視為 true */
  overview?: boolean
}

export type CourseTopicGroup = { topic: string; topicSlogan: string; topicPath: string; courses: CourseListItem[] }

export async function fetchCourseList(): Promise<CourseListItem[]> {
  const res = await fetch('/api/courses', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`課程清單讀取失敗(${res.status})`)
  return ((await res.json()) as { courses: CourseListItem[] }).courses
}

/** 連續同 topic 的課分成一組;主題頁網址沒給就是這組第一門課的總覽頁 */
export function groupByTopic(courses: CourseListItem[]): CourseTopicGroup[] {
  const groups: CourseTopicGroup[] = []
  for (const c of courses) {
    const last = groups[groups.length - 1]
    if (last && last.topic === c.topic) last.courses.push(c)
    else groups.push({ topic: c.topic, topicSlogan: c.topicSlogan, topicPath: c.topicPath ?? `/courses/${c.id}`, courses: [c] })
  }
  return groups
}

export type CourseListState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; courses: CourseListItem[] }

// 讀過的清單記在記憶體(回到上一頁先用記住的,背景再讀一次更新);同時間只打一個請求
let listCache: CourseListItem[] | undefined
let inflight: Promise<CourseListItem[]> | undefined
function loadCourseList(): Promise<CourseListItem[]> {
  if (!inflight) {
    inflight = fetchCourseList()
      .then((list) => {
        listCache = list
        return list
      })
      .finally(() => {
        inflight = undefined
      })
  }
  return inflight
}

/** 清單的記憶體快取(給測試清掉) */
export function resetCourseListCache() {
  listCache = undefined
  inflight = undefined
}

export function useCourseList(): CourseListState {
  const [state, setState] = useState<CourseListState>(() => (listCache ? { status: 'ready', courses: listCache } : { status: 'loading' }))
  useEffect(() => {
    let cancelled = false
    loadCourseList().then(
      (courses) => !cancelled && setState({ status: 'ready', courses }),
      // 已經有記住的就繼續用,沒有才是讀不到
      () => !cancelled && setState((s) => (s.status === 'ready' ? s : { status: 'error' })),
    )
    return () => {
      cancelled = true
    }
  }, [])
  return state
}
