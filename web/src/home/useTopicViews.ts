import { useEffect, useState } from 'react'

// 首頁主題卡片的觀看次數(GET /api/topics/views:每個主題底下各課的訪客打開次數加會員看過的課數)。
// 同一份在這個分頁裡只讀一次;讀不到就不顯示(回 null),不影響卡片的其他內容。
// 讀不到的結果不記住(例如部署中的短暫 503),下次再進首頁或課程列表會重試。
let cache: Promise<Record<string, number> | null> | undefined

function loadTopicViews(): Promise<Record<string, number> | null> {
  if (!cache) {
    const p: Promise<Record<string, number> | null> = fetch('/api/topics/views')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { views?: Record<string, number> } | null) => body?.views ?? null)
      .catch(() => null)
    cache = p
    void p.then((v) => {
      if (v === null && cache === p) cache = undefined
    })
  }
  return cache
}

/** 主題 id → 觀看次數;還沒讀到或讀不到是 null */
export function useTopicViews(): Record<string, number> | null {
  const [views, setViews] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    let cancelled = false
    loadTopicViews().then((v) => !cancelled && setViews(v))
    return () => {
      cancelled = true
    }
  }, [])
  return views
}

/** 主題卡片的網址(/topics/kids、/courses/launch…)最後一段就是主題 id */
export const topicIdOfPath = (path: string | undefined): string | undefined => path?.split('/').filter(Boolean).pop()

/** 依觀看次數由多到少排;次數一樣(或還沒讀到次數)照原本的順序 */
export function sortByViews<T>(items: T[], idOf: (item: T) => string | undefined, views: Record<string, number> | null): T[] {
  if (!views) return items
  const n = (item: T) => views[idOf(item) ?? ''] ?? 0
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => n(b.item) - n(a.item) || a.i - b.i)
    .map((x) => x.item)
}
