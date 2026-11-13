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

/** 第一次渲染用的語言(還不知道會員偏好時) */
export const initialLocale = (): Locale => readStoredLocale() ?? browserLocale()
