// 全部課程清單(有哪些課、怎麼分組、課名、簡介、主題名稱與標語):從資料庫讀(GET /api/courses,公開不用登入)。
import { langQuery } from '../i18n/current'
import { useLocale } from '../i18n/I18nProvider'
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
  const res = await fetch(`/api/courses${langQuery()}`, { credentials: 'same-origin' })
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
const listCache = new Map<string, CourseListItem[]>()
const inflight = new Map<string, Promise<CourseListItem[]>>()
function loadCourseList(locale: string): Promise<CourseListItem[]> {
  let p = inflight.get(locale)
  if (!p) {
    p = fetchCourseList()
      .then((list) => {
        listCache.set(locale, list)
        return list
      })
      .finally(() => inflight.delete(locale))
    inflight.set(locale, p)
  }
  return p
}

/** 清單的記憶體快取(給測試清掉) */
export function resetCourseListCache() {
  listCache.clear()
  inflight.clear()
}

export function useCourseList(): CourseListState {
  // 快取依語言分開:切換語言(頁面不重載時)要重讀,課程名稱才會換
  const { locale } = useLocale()
  const [res, setRes] = useState<{ locale: string; state: CourseListState } | null>(null)
  const hit = listCache.get(locale)
  const state: CourseListState = res?.locale === locale ? res.state : hit ? { status: 'ready', courses: hit } : { status: 'loading' }
  useEffect(() => {
    let cancelled = false
    loadCourseList(locale).then(
      (courses) => !cancelled && setRes({ locale, state: { status: 'ready', courses } }),
      // 已經有記住的就繼續用,沒有才是讀不到
      () => !cancelled && setRes((r) => (r?.locale === locale && r.state.status === 'ready') || listCache.has(locale) ? r : { locale, state: { status: 'error' } }),
    )
    return () => {
      cancelled = true
    }
  }, [locale])
  return state
}
