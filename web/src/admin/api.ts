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
}

export interface AdminOverview {
  users: number
  activeUsers: number
  /** 保存期間(180 天)內有紀錄的訪客數 */
  guests: number
  lessons: LessonStat[]
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
