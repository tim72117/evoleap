// 管理後台 API(server/internal/api/admin.go)。未登入回 401、非管理員回 403。
import { ApiError, type User } from '../auth/api'

export interface AdminUser extends User {
  lessonCount: number
  completed: number
  watchedMs: number
  lastActive: string | null
}

export interface LessonStat {
  lesson: string
  learners: number
  completed: number
  avgPercent: number
  /** 訪客(未登入)打開這一課的次數、不同訪客數、累計播放時間 */
  guestViews: number
  guestVisitors: number
  guestWatchedMs: number
  /** 訪客漏斗(server/internal/store/admin.go):只算有裝置資料的紀錄;爬蟲另外算、不進漏斗 */
  guestBots: number
  /** 真人打開的次數(漏斗第一層) */
  guestTracked: number
  guestReady: number
  guestFailed: number
  guestPlayed: number
  /** 真人打開卻沒播放的,頁面平均在前景多久 */
  guestIdleVisibleMs: number
  guestReadyAvgMs: number
}

export interface Count {
  name: string
  count: number
}

export interface GuestBreakdown {
  devices: Count[]
  sources: Count[]
  errors: Count[]
  /** 真人打開後沒有播放的,依頁面在前景的時間分組:under10s、10to60s、over60s */
  idleVisible: Count[]
  /** 最近沒有播放的真人造訪(含登入門檻),新的在前,最多 30 筆 */
  idleVisits: GuestVisit[]
}

/** 一次沒有播放的造訪與它的足跡 */
export interface GuestVisit {
  lesson: string
  device: string
  source: string
  readyMs: number
  loadError: string
  visibleMs: number
  /** t:打開後第幾毫秒;e:事件代碼(courses/guestActivity.ts) */
  events: { t: number; e: string }[]
  openedAt: string
}

export interface AdminOverview {
  users: number
  activeUsers: number
  /** 保存期間(180 天)內有紀錄的訪客數 */
  guests: number
  lessons: LessonStat[]
  guestStats: GuestBreakdown
}

export interface UserProgress {
  lesson: string
  positionMs: number
  durationMs: number
  updatedAt: string
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown', data.message ?? '發生錯誤，請稍後再試')
  return data as T
}

export const adminApi = {
  me: () => get<{ user: User }>('/api/admin/me').then((r) => r.user),
  overview: () => get<AdminOverview>('/api/admin/overview'),
  users: () => get<{ total: number; users: AdminUser[] }>('/api/admin/users').then((r) => r.users),
  userProgress: (id: string) =>
    get<{ user: User; progress: UserProgress[] }>(`/api/admin/users/${encodeURIComponent(id)}/progress`).then((r) => r.progress),
}
