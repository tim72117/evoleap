// 主題(首頁卡片、主題頁、展示頁):名稱、標語、網址、搜尋標題與描述、卡片內容都在資料庫(GET /api/topics,公開不用登入),
// 用 `evoleap topic set` 修改;前端沒有備援,讀取中顯示佔位、讀不到顯示「無法讀取」。
// 這裡只有:路由用的網址、讀取主題的程式,以及資料庫沒有欄位的設定(全部課程頁的標題、Claude Code 情境用到的功能)。
import { useEffect, useState } from 'react'
import { langQuery, messages } from '../i18n/current'
import { useLocale } from '../i18n/I18nProvider'

/** 主題頁(課程地圖或課程總覽)的網址:路由寫在程式裡,和資料庫的 topics.path 一致 */
export const TOPIC_PATHS = {
  software: '/topics/software',
  aiApps: '/topics/ai-apps',
  web: '/courses/web',
  launch: '/courses/launch',
  kids: '/courses/kids',
  claudeCode: '/courses/claude-code',
} as const

/** 主題卡片「開始第一課」這顆固定按鈕的文字:是這句就依目前語言換成字典的 home.startFirstLesson(topicStartLabel) */
export const START_FIRST_LESSON = '開始第一課'
export const topicStartLabel = (start: { label: string }): string => (start.label === START_FIRST_LESSON ? messages().home.startFirstLesson : start.label)

export const HOME_INTRO = {
  title: '善用 AI，把時間用在真正想做的事',
  pitch: '選一個主題，跟著實際操作，做出看得見的成果。',
  description: '善用 AI，把時間用在真正想做的事：選一個主題，跟著實際操作，從免費的入門課開始，做出看得見的成果。',
}

/** 主題的卡片與主題頁內容(資料庫 topics.content) */
export type TopicContent = {
  /** 主題名稱旁的圖示(HomePage 的 TOPIC_ICONS) */
  icon?: 'terminal'
  /** 一句話說明(「做出自己的軟體」的首頁卡片、展示頁) */
  lede?: string
  /** 首頁卡片的主色標籤:有標籤時取代「開放中/規劃中」 */
  tag?: string
  /** 首頁卡片標語下的一段說明 */
  intro?: string
  /** 預計會做出的成果 */
  outcomes?: string[]
  /** 這個主題解決的痛點(首頁卡片的「你是不是也卡在這裡」) */
  pains?: string[]
  /** 只整理使用情境、沒有實作的主題:列出涵蓋的情境(取代 outcomes) */
  scenarios?: string[]
  /** 過程的步驟(沒有 sample 時顯示) */
  flow?: string[]
  /** 整理前後的示意 */
  sample?: { caption: string; before: string[]; after: string[] }
  /**
   * 課程預覽:資料庫的腳本,用兒童版播放器(kids/KidsPlayer.tsx)播。
   * intro 放在環節清單上方;sections 是腳本的段落名稱 → 給家長看的說明、是不是要孩子動手(可互動)
   */
  preview?: { script: string; intro?: string; sections?: Record<string, { note?: string; interactive?: boolean }> }
  /** 學完你會:一句一項;「做出自己的軟體」是依階段各一項 */
  learn?: (string | { level: string; text: string })[]
  /** learn 的標題(預設「學完你會」) */
  learnTitle?: string
  /** 已經開放的主題:首頁卡片用實線外框;不寫就是規劃中,標題旁標「規劃中」(首頁不標「開放中」) */
  open?: boolean
  /** 首頁卡片的「開始」按鈕:已經可以上的第一課 */
  start?: { label: string; path: string }
}

export type Topic = {
  id: string
  name: string
  slogan: string
  /** 已有主題頁的主題:首頁卡片連到這裡 */
  path?: string
  seoTitle?: string
  description?: string
  content?: TopicContent
}

export type TopicsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; topics: Topic[] }

const str = (v: unknown) => typeof v === 'string'
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const strs = (v: unknown) => Array.isArray(v) && v.every(str)
const CONTENT_CHECKS: Record<string, (v: unknown) => boolean> = {
  icon: str, lede: str, tag: str, intro: str, learnTitle: str,
  open: (v) => typeof v === 'boolean',
  outcomes: strs, pains: strs, scenarios: strs, flow: strs,
  sample: (v) => obj(v) && str(v.caption) && strs(v.before) && strs(v.after),
  preview: (v) => obj(v) && str(v.script) && (v.sections === undefined || (obj(v.sections) && Object.values(v.sections).every(obj))),
  learn: (v) => Array.isArray(v) && v.every((x) => str(x) || (obj(x) && str(x.level) && str(x.text))),
  start: (v) => obj(v) && str(v.label) && str(v.path),
}
/** content 是資料庫裡手動寫的 JSON:格式不對的欄位略過,不讓一個打錯的值弄壞整頁 */
export function cleanTopicContent(content: unknown): TopicContent {
  if (!obj(content)) return {}
  return Object.fromEntries(Object.entries(content).filter(([k, v]) => CONTENT_CHECKS[k]?.(v))) as TopicContent
}

export async function fetchTopics(): Promise<Topic[]> {
  const res = await fetch(`/api/topics${langQuery()}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`主題讀取失敗(${res.status})`)
  return ((await res.json()) as { topics: Topic[] }).topics.map((t) => ({ ...t, content: cleanTopicContent(t.content) }))
}

// 讀過的主題記在記憶體(依語言分開;回到首頁先用記住的,背景再讀一次更新);同時間只打一個請求
const cache = new Map<string, Topic[]>()
const inflight = new Map<string, Promise<Topic[]>>()
function load(locale: string): Promise<Topic[]> {
  let p = inflight.get(locale)
  if (!p) {
    p = fetchTopics()
      .then((topics) => {
        cache.set(locale, topics)
        return topics
      })
      .finally(() => inflight.delete(locale))
    inflight.set(locale, p)
  }
  return p
}

/** 主題的記憶體快取(給測試清掉) */
export function resetTopicsCache() {
  cache.clear()
  inflight.clear()
}

/** 全部主題,照資料庫的順序 */
export function useTopics(): TopicsState {
  const { locale } = useLocale()
  const [res, setRes] = useState<{ locale: string; state: TopicsState } | null>(null)
  const hit = cache.get(locale)
  const state: TopicsState = res?.locale === locale ? res.state : hit ? { status: 'ready', topics: hit } : { status: 'loading' }
  useEffect(() => {
    let cancelled = false
    load(locale).then(
      (topics) => !cancelled && setRes({ locale, state: { status: 'ready', topics } }),
      () => !cancelled && setRes((r) => (r?.locale === locale && r.state.status === 'ready') || cache.has(locale) ? r : { locale, state: { status: 'error' } }),
    )
    return () => {
      cancelled = true
    }
  }, [locale])
  return state
}

export const findTopic = (state: TopicsState, id: string): Topic | undefined => (state.status === 'ready' ? state.topics.find((t) => t.id === id) : undefined)

/** 課程所在主題的主題頁網址(依課程頁路徑):麵包屑、「課程地圖」連結用 */
export function topicPathOfCourse(coursePath: string): string {
  if (coursePath === '/courses/advanced') return TOPIC_PATHS.aiApps
  return coursePath === '/courses/software' ? TOPIC_PATHS.software : coursePath
}

/** 全部課程的清單頁(不是主題,資料庫沒有對應的欄位):跨主題列出每一門課 */
export const COURSE_LIST = {
  name: '全部課程',
  path: '/courses',
  seoTitle: '全部課程：從零基礎到 AI 互動軟體',
  description: '依主題列出所有 AI 課程：從零基礎做出自己的網站與小工具、看懂網頁怎麼運作、給孩子的網頁程式課，到打造會查資料、跑分析的 AI 互動軟體，也整理 Claude Code 的常見使用情境。可以看到每門課目前開放與規劃中的狀態。',
}

/** Claude Code 工作術各情境(資料庫的課號)資料庫沒有的欄位:會用到的功能(以官方文件為準,改版時要更新)、示範影片的標題 */
export const CLAUDE_CODE_EXTRAS: Record<string, { tools: string[]; videoTitle?: string }> = {
  '1': { tools: ['/fork', '/branch', 'Worktree'], videoTitle: 'Fork：帶著對話另開一條路' },
  '2': { tools: ['/remote-control'], videoTitle: 'Remote Control：出門了，用手機接著做' },
  '3': { tools: ['多個 session', 'Worktree'] },
  '4': { tools: ['/resume', 'claude --continue'] },
  '5': { tools: ['/compact', '/clear'] },
  '6': { tools: ['CLAUDE.md', '/init'] },
  '7': { tools: ['/background', 'claude agents'] },
}

/** 舊網址 /topics/claude-code#<錨點> 的影片錨點 → 情境的課號(舊網址的轉址,不隨課程資料改) */
export const CLAUDE_CODE_ANCHORS: Record<string, string> = { fork: '1', remote: '2' }

/** 影片的錨點:腳本檔名去掉資料夾與副檔名(claude-code/remote.json → remote) */
export const scenarioAnchor = (script: string): string => script.replace(/^.*\//, '').replace(/\.json$/, '')
