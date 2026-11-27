// 主題頁的區塊(GET /api/topics/{id}/page,資料庫的 topic_sections、topic_blocks;公開不用登入),用 `evoleap topic section-*`、`block-*` 修改。
// 前端沒有備援:讀取中顯示佔位、讀不到(或還沒有區塊)顯示「無法讀取」。各欄位的意思見 server/internal/store/topicpage.go。
import { useEffect, useState } from 'react'

export type PageBlock = {
  id: string
  title?: string
  text?: string
  note?: string
  ref?: string
  variant?: string
  label?: string
  children?: PageBlock[]
}

export type PageSection = {
  /** 也是頁面上的錨點 */
  id: string
  kind: 'hero' | 'levels' | 'cards' | 'lists' | 'units'
  /** eyebrow、title、lead 空的用介面內建的區塊標題 */
  eyebrow?: string
  title?: string
  lead?: string
  source?: string
  variant?: string
  blocks?: PageBlock[]
}

export type TopicPageState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; sections: PageSection[] }

export async function fetchTopicPage(id: string): Promise<PageSection[]> {
  const res = await fetch(`/api/topics/${encodeURIComponent(id)}/page`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`主題頁讀取失敗(${res.status})`)
  const sections = ((await res.json()) as { sections?: PageSection[] }).sections ?? []
  if (!sections.length) throw new Error('主題頁還沒有區塊')
  return sections
}

const cache = new Map<string, PageSection[]>()
const inflight = new Map<string, Promise<PageSection[]>>()
function load(id: string): Promise<PageSection[]> {
  let p = inflight.get(id)
  if (!p) {
    p = fetchTopicPage(id)
      .then((sections) => {
        cache.set(id, sections)
        return sections
      })
      .finally(() => inflight.delete(id))
    inflight.set(id, p)
  }
  return p
}

export function useTopicPage(id: string): TopicPageState {
  const [res, setRes] = useState<{ id: string; state: TopicPageState } | null>(null)
  const hit = cache.get(id)
  const state: TopicPageState = res?.id === id ? res.state : hit ? { status: 'ready', sections: hit } : { status: 'loading' }
  useEffect(() => {
    let cancelled = false
    load(id).then(
      (sections) => !cancelled && setRes({ id, state: { status: 'ready', sections } }),
      () => !cancelled && setRes(cache.has(id) ? null : { id, state: { status: 'error' } }),
    )
    return () => {
      cancelled = true
    }
  }, [id])
  return state
}
