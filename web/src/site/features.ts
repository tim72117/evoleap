// Feature flag:還沒要對所有人開放的功能先包起來,預設在正式站關閉。
//   - 本機開發(npm run dev):全部開
//   - 全站開:建置時設 VITE_FEATURES=practice(逗號分隔;Dockerfile 的 build arg、部署用的 GitHub 變數 FEATURES)
//   - 個別開來測試:網址加 ?feature=practice(記在這個瀏覽器的 localStorage,之後不用再帶);?feature=-practice 關掉
// 名稱前面加 - 代表關閉;後面的來源蓋過前面的(建置 → 瀏覽器記住的 → 網址)。
import { useMemo } from 'react'

/** 目前有的功能;新增功能時在這裡加一個名稱 */
export const FEATURES = ['practice'] as const
export type Feature = (typeof FEATURES)[number]

const STORAGE_KEY = 'evoleap.features'

const parse = (s: string | null | undefined): string[] =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

/** 把各來源的名稱清單依序套用,回傳開啟的功能(純函式) */
export function resolveFeatures(src: { dev: boolean; build?: string; stored?: string; query?: string }): Set<string> {
  const on = new Set<string>(src.dev ? FEATURES : [])
  for (const list of [src.build, src.stored, src.query]) {
    for (const name of parse(list)) {
      if (name.startsWith('-')) on.delete(name.slice(1))
      else on.add(name)
    }
  }
  return on
}

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

/** 網址的 ?feature=…(可以重複)串成一個清單;有的話併進瀏覽器記住的清單 */
function applyQuery(search: string): { stored: string; query: string } {
  const query = new URLSearchParams(search).getAll('feature').join(',')
  const stored = readStored()
  if (!query) return { stored, query }
  const merged = [...resolveFeatures({ dev: false, stored, query })].join(',')
  try {
    localStorage.setItem(STORAGE_KEY, merged)
  } catch {
    // 無痕模式等讀寫不了:只有這一頁有效
  }
  return { stored, query }
}

/** 這個功能有沒有開 */
export function useFeature(name: Feature): boolean {
  return useMemo(() => {
    const { stored, query } = applyQuery(typeof location === 'undefined' ? '' : location.search)
    return resolveFeatures({ dev: import.meta.env.DEV, build: import.meta.env.VITE_FEATURES, stored, query }).has(name)
  }, [name])
}
