// 兒童模式的 API(server/internal/api/kids.go):家長的孩子與每週時段、這台裝置的兒童模式。
import { ApiError } from '../auth/api'
import type { Slot } from './schedule'

export interface Child {
  id: string
  name: string
  /** 頭像(emoji,從伺服器給的清單選) */
  avatar: string
  slots: Slot[]
  /** 每次上課多久(分鐘,最長 60):時段從開始時間起開放這麼久 */
  minutes: number
  createdAt: string
}

/** 某個時間點的上課狀態(伺服器照台灣時間算) */
export interface KidsSchedule {
  open: boolean
  current?: Slot
  endsAt?: string
  next?: Slot
  nextAt?: string
}

/** 一筆上課紀錄:孩子看完哪一課(kids:<腳本>)、什麼時候看完 */
export interface ChildLesson {
  lesson: string
  finishedAt: string
}

export type KidsMode = { active: false } | { active: true; child: Child; schedule: KidsSchedule }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? '發生錯誤，請稍後再試')
  return data as T
}

export const kidsApi = {
  children: () => request<{ children: Child[]; maxSlots: number; maxMinutes: number; avatars: string[] }>('GET', '/api/kids/children'),
  createChild: (name: string) => request<{ child: Child }>('POST', '/api/kids/children', { name }).then((r) => r.child),
  updateChild: (id: string, patch: { name?: string; slots?: Slot[]; minutes?: number; avatar?: string }) => request<{ child: Child }>('PATCH', `/api/kids/children/${encodeURIComponent(id)}`, patch).then((r) => r.child),
  lessons: (id: string) => request<{ lessons: ChildLesson[] }>('GET', `/api/kids/children/${encodeURIComponent(id)}/lessons`).then((r) => r.lessons),
  deleteChild: (id: string) => request<void>('DELETE', `/api/kids/children/${encodeURIComponent(id)}`),
  mode: () => request<KidsMode>('GET', '/api/kids/mode'),
  start: (childId: string) => request<KidsMode>('POST', '/api/kids/mode', { childId }),
  stop: () => request<void>('DELETE', '/api/kids/mode'),
}
