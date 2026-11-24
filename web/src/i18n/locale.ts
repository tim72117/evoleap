// 網站介面語言:支援哪些、第一次來怎麼決定、記在哪裡。
//
// 決定順序(I18nProvider):會員帳號存的偏好(換裝置也一樣) > 這個瀏覽器記的選擇 > 瀏覽器語言(中文→繁中,其他→英文)。
// 課程內容(課名、教學畫面、旁白)目前只有中文,只有介面跟著語言換。

export type Locale = 'zh-Hant' | 'en'
export const LOCALES: readonly Locale[] = ['zh-Hant', 'en']
export const DEFAULT_LOCALE: Locale = 'zh-Hant'

export const isLocale = (v: unknown): v is Locale => v === 'zh-Hant' || v === 'en'

const KEY = 'site:locale'

export function readStoredLocale(): Locale | null {
  try {
    const v = localStorage.getItem(KEY)
    return isLocale(v) ? v : null
  } catch {
    return null
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(KEY, locale)
  } catch {
    /* 私密模式等情況:這次瀏覽仍有效 */
  }
}

/** 依瀏覽器語言猜:清單裡第一個是中文(任何地區)就用繁中,否則英文 */
export function browserLocale(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]): Locale {
  const first = languages.find(Boolean)
  if (!first) return DEFAULT_LOCALE
  return first.toLowerCase().startsWith('zh') ? 'zh-Hant' : 'en'
}

// 英文網址:/en/... 是英文版(路徑決定語言,搜尋引擎才收得到)。App 把 /en 當 router 的 basename,
// 所以頁面與站內連結都不用自己處理前綴;中文版維持原本的網址(沒有前綴)。
export const EN_PREFIX = '/en'
export const hasEnPrefix = (pathname: string) => pathname === EN_PREFIX || pathname.startsWith(EN_PREFIX + '/')
export const stripEnPrefix = (pathname: string) => (hasEnPrefix(pathname) ? pathname.slice(EN_PREFIX.length) || '/' : pathname)
const atEnPath = () => typeof location !== 'undefined' && hasEnPrefix(location.pathname)

/** BrowserRouter 的 basename:在 /en 底下是 '/en',否則沒有 */
export const routerBasename = (): string | undefined => (atEnPath() ? EN_PREFIX : undefined)

/** 有預先產生英文頁、收錄英文版的頁面(課程清單與課程總覽);build 的 SEO 資料(seo/enPages.ts)與這裡一致 */
export const hasEnglishPage = (pathname: string) => /^\/courses(\/[a-z0-9-]+)?$/.test(pathname)

/** 換語言時要換去的網址(中英文是不同網址);不用換網址(這一頁沒有英文版)就回 null */
export function localeTarget(next: Locale, pathname: string, search = '', hash = ''): string | null {
  if (next === 'en' && !hasEnPrefix(pathname) && hasEnglishPage(pathname)) return EN_PREFIX + pathname + search + hash
  if (next !== 'en' && hasEnPrefix(pathname)) return stripEnPrefix(pathname) + search + hash
  return null
}

/** 第一次渲染用的語言(還不知道會員偏好時):網址有 /en 就是英文,其次是這個瀏覽器記的選擇 */
export const initialLocale = (): Locale => (atEnPath() ? 'en' : readStoredLocale() ?? browserLocale())
