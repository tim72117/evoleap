import { useEffect, useState } from 'react'

// 研發基地的資料檔(全課程清單、lab 試做清單、AI 情境清單…):放在 src/content/live/data/,和腳本一樣不打包進前端,
// 寫入課程資料時讀進資料庫的研發基地檔案(studio_files;正式環境是部署時,本機是後端啟動時,本機也直接讀檔),
// 由 GET /api/scripts/data/<檔名> 取得,只有管理員拿得到。

/** 研發基地的資料檔路徑(相對於 content/live/) */
export const STUDIO_DATA = {
  fullCourse: 'data/full-course.json',
  labTrials: 'data/lab-trials.json',
  aiScenarios: 'data/ai-scenarios.json',
} as const

const cache = new Map<string, Promise<unknown>>()

/** 讀一個資料檔;同一份在這個分頁裡只讀一次(讀失敗不記住,下次再試) */
export function loadStudioData<T>(path: string): Promise<T> {
  let p = cache.get(path)
  if (!p) {
    p = fetch(`/api/scripts/${path}`).then(async (res) => {
      if (res.status === 404) throw new Error(`找不到研發基地的資料檔 ${path}(要以管理員登入；本機要先啟動後端)`)
      if (!res.ok) throw new Error(`讀不到研發基地的資料檔 ${path}(${res.status})`)
      return res.json()
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p as Promise<T>
}

export type StudioData<T> = { data: T; error: null } | { data: null; error: string | null }

/** 讀資料檔:讀到之前 data、error 都是 null;讀不到時 error 是可以直接顯示的訊息 */
export function useStudioData<T>(path: string): StudioData<T> {
  const [state, setState] = useState<StudioData<T>>({ data: null, error: null })
  useEffect(() => {
    let cancelled = false
    setState({ data: null, error: null })
    loadStudioData<T>(path).then(
      (data) => !cancelled && setState({ data, error: null }),
      (e: unknown) => !cancelled && setState({ data: null, error: e instanceof Error ? e.message : String(e) }),
    )
    return () => {
      cancelled = true
    }
  }, [path])
  return state
}
