// 主題頁的區塊(GET /api/topics/{id}/page,資料庫的 topic_sections、topic_blocks;公開不用登入),用 `evoleap topic section-*`、`block-*` 修改。
// 前端沒有備援:讀取中顯示佔位、讀不到(或還沒有區塊)顯示「無法讀取」。各欄位的意思見 server/internal/store/topicpage.go。
import { useEffect, useState } from 'react'
import { langQuery } from '../i18n/current'
import { useLocale } from '../i18n/I18nProvider'

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
  kind: 'hero' | 'levels' | 'cards' | 'lists' | 'units' | 'features'
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
  const res = await fetch(`/api/topics/${encodeURIComponent(id)}/page${langQuery()}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`主題頁讀取失敗(${res.status})`)
  const sections = ((await res.json()) as { sections?: PageSection[] }).sections ?? []
  if (!sections.length) throw new Error('主題頁還沒有區塊')
  return sections
}

const cache = new Map<string, PageSection[]>()
const inflight = new Map<string, Promise<PageSection[]>>()
/** key 是「語言:主題」,讀過的內容依語言分開記 */
function load(key: string, id: string): Promise<PageSection[]> {
  let p = inflight.get(key)
  if (!p) {
    p = fetchTopicPage(id)
      .then((sections) => {
        cache.set(key, sections)
        return sections
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, p)
  }
  return p
}

export function useTopicPage(id: string): TopicPageState {
  const { locale } = useLocale()
  const key = `${locale}:${id}`
  const [res, setRes] = useState<{ key: string; state: TopicPageState } | null>(null)
  const hit = cache.get(key)
  const state: TopicPageState = res?.key === key ? res.state : hit ? { status: 'ready', sections: hit } : { status: 'loading' }
  useEffect(() => {
    let cancelled = false
    load(key, id).then(
      (sections) => !cancelled && setRes({ key, state: { status: 'ready', sections } }),
      () => !cancelled && setRes(cache.has(key) ? null : { key, state: { status: 'error' } }),
    )
    return () => {
      cancelled = true
    }
  }, [key, id])
  return state
}
