import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useCourseMap, type MapLesson } from '../content/courseMap'
import { LoginGate } from './LoginGate'

// 單課頁共用的把關(軟體課、網頁、上線、兒童、Claude Code 都用這個),全部照課程地圖 API(GET /api/courses/{id}/map):
// 能上的是 status open 或 draft(草稿只有管理員拿得到)的課(requireScript 時還要有腳本);
// access free 的不用登入,其他要登入(LoginGate)。通過後把這一課與前後能上的課交給 children;上一課、下一課跳過先不公開(unit.hidden)單元的課(不會從起步直接帶進零基礎),本身就在那個單元的課照原順序。
// 地圖讀取中、讀不到、這一課不能上(沒有這一課、還沒開放)由呼叫端用 blocked 決定畫什麼(提示頁或規劃中的章節頁)。
// 腳本檔本身由伺服器依同樣的規則把關(GET /api/scripts,見 live/scripts.ts)。

export type LessonBlock = 'loading' | 'error' | 'closed'

type Props = {
  /** 課程地圖 id(資料庫),例如 web */
  course: string
  /** 這一課的課號 */
  id: string
  /** 一定要有腳本才算能上(腳本在地圖裡) */
  requireScript?: boolean
  /** 要登入時 LoginGate 的文字 */
  login: { kicker: string; title: string; docTitle: string; back: { to: string; label: string }; note: string }
  /** 讀取中、讀不到、不能上時畫什麼 */
  blocked: (reason: LessonBlock) => ReactNode
  children: (lesson: MapLesson, prev?: MapLesson, next?: MapLesson) => ReactNode
}

export function LessonGate({ course, id, requireScript, login, blocked, children }: Props) {
  const { status: auth } = useAuth()
  const map = useCourseMap(course)
  // 等登入狀態確定後才判斷,免得管理員先閃過「還沒開放」
  if (map.status === 'loading' || auth === 'loading') return <>{blocked('loading')}</>
  // 讀不到不代表課沒開放(資料庫或網路暫時有問題),不要說成還沒開放
  if (map.status === 'error') return <>{blocked('error')}</>
  const hiddenIds = new Set(map.map.units.filter((u) => u.hidden).flatMap((u) => u.lessons.map((l) => l.id)))
  const playable = map.map.units
    .flatMap((u) => u.lessons)
    .filter((l) => (l.status === 'open' || l.status === 'draft') && (!requireScript || l.script))
  const lesson = playable.find((l) => l.id === id)
  if (!lesson) return <>{blocked('closed')}</>
  // 上一課、下一課:先不公開單元的課不列給公開單元的人;本身就在先不公開的單元則照原順序
  const neighbors = hiddenIds.has(id) ? playable : playable.filter((l) => l === lesson || !hiddenIds.has(l.id))
  const index = neighbors.indexOf(lesson)
  const content = children(lesson, neighbors[index - 1], neighbors[index + 1])
  if (lesson.access === 'free') return <>{content}</>
  return (
    <LoginGate key={id} {...login}>
      {content}
    </LoginGate>
  )
}
