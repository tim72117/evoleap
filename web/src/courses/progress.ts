// 播放進度:只有登入的會員才會儲存(存到伺服器,見 server/internal/api/progress.go),訪客完全不存。
import { ApiError } from '../auth/api'
import { messages } from '../i18n/current'
import type { ProgressStore } from '../live/shell'

export interface LessonProgress {
  lesson: string
  positionMs: number
  durationMs: number
  updatedAt: string
}

export const progressApi = {
  /** 這位會員所有課的進度,最近看的在前(會員空間用);失敗時丟出 ApiError(未登入或登入過期是 401) */
  list: async (): Promise<LessonProgress[]> => {
    const res = await fetch('/api/progress', { credentials: 'same-origin' })
    if (!res.ok) throw new ApiError(res.status, 'progress_list', messages().courses.progressLoadFailed)
    return ((await res.json()) as { progress: LessonProgress[] }).progress ?? []
  },
  get: async (lesson: string): Promise<LessonProgress | null> => {
    const res = await fetch(`/api/progress?lesson=${encodeURIComponent(lesson)}`, { credentials: 'same-origin' })
    if (!res.ok) return null
    return ((await res.json()) as { progress: LessonProgress | null }).progress
  },
  /** keepalive:離開頁面時送出的請求不會被瀏覽器中斷 */
  put: (lesson: string, positionMs: number, durationMs: number): Promise<Response> =>
    fetch('/api/progress', {
      method: 'PUT',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson, positionMs, durationMs }),
    }),
}

/** 會員用的進度存取:讀不到或存不進去都不影響播放(靜默略過) */
export function memberProgress(lesson: string): ProgressStore {
  return {
    load: () =>
      progressApi
        .get(lesson)
        .then((p) => p?.positionMs ?? null)
        .catch(() => null),
    save: (ms, durationMs) => void progressApi.put(lesson, ms, durationMs).catch(() => {}),
  }
}

/** 以前訪客也會把進度記在瀏覽器(vp:t:*);現在訪客不存,順手清掉舊的 */
export function clearGuestProgress(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('vp:t:')) localStorage.removeItem(k)
  } catch {
    /* 私密模式等情況 */
  }
}
