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
  /** 從首頁進來的造訪走過的路徑(最常見的 20 條)與從首頁進來的造訪次數 */
  homePaths: HomePath[]
  homeVisits: number
  /** 每個真人訪客在首頁停留多久(頁面在前景的時間),最近來過的在前,最多 50 人 */
  homeStays?: HomeStay[]
  /** 訪客打開登入／註冊頁的次數與結果 */
  login: LoginStats
}

/** 登入／註冊頁:outcomes 的 name 是 signin、register、google(成功)、failed(試過但失敗)、left(沒有登入就離開) */
export interface LoginStats {
  visits: number
  outcomes: Count[]
  /** 登入後要回到哪裡(next 參數;直接打開登入頁是 /) */
  next: Count[]
  /** 登入或註冊失敗時看到的訊息 */
  fails: Count[]
  /** Google 登入按鈕:畫好幾次、從打開登入頁到畫好的平均毫秒、載入失敗幾次與原因 */
  googleReady: number
  googleReadyAvgMs: number
  googleFailed: number
  googleErrors: Count[]
}

/** 一條路徑:每一站是 guest_views 的 lesson(page:/…、live:…、kids:…、home:…、gate:…),最後可能是 exit(關掉頁面)或 leave:<網址>(換到沒有記錄的頁面) */
export interface HomePath {
  steps: { lesson: string; played: boolean }[]
  count: number
  /** 其中有播放過任何東西的次數 */
  played: number
}

/** 一個訪客在首頁的停留(server/internal/store/admin.go 的 HomeStay) */
export interface HomeStay {
  /** 訪客代號的前 8 碼 */
  guest: string
  device: string
  source: string
  visits: number
  totalMs: number
  longestMs: number
  /** 捲到最深的百分比(25 的倍數) */
  maxScroll: number
  lastOpened: string
}

/** 後台的時間篩選:空字串是全部 */
export type AdminRange = '' | '30m' | '12h' | '1d' | '7d'

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

const rangeQuery = (range: AdminRange): string => (range ? `?range=${range}` : '')

export const adminApi = {
  me: () => get<{ user: User }>('/api/admin/me').then((r) => r.user),
  overview: (range: AdminRange = '') => get<AdminOverview>(`/api/admin/overview${rangeQuery(range)}`),
  users: (range: AdminRange = '') => get<{ total: number; users: AdminUser[] }>(`/api/admin/users${rangeQuery(range)}`).then((r) => r.users),
  userProgress: (id: string) =>
    get<{ user: User; progress: UserProgress[] }>(`/api/admin/users/${encodeURIComponent(id)}/progress`).then((r) => r.progress),
}
