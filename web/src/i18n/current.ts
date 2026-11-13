// 目前的語言與字典,給 React 以外的程式用(API 錯誤訊息、模組層級的工具函式、課程資料的標籤)。
//
// 獨立成檔、不 import React 與任何會員、課程程式:content/、kidsMode/、live/ 這些底層模組要取字典時 import 這裡,
// 不要 import I18nProvider(它會經由 auth/api 再引用回來,形成循環)。
// 更新時機:I18nProvider 在「新語言的字典已經就緒、要換語言」的那一刻(事件、不是 render)呼叫 setCurrent,
// 所以畫面重畫時,React 以外的程式讀到的一定是和畫面同一個語言。
import type { Locale } from './locale'
import { zh, type Messages } from './zh'

let current: { locale: Locale; messages: Messages } = { locale: 'zh-Hant', messages: zh }
// 英文字典是另外打包、切到英文才下載;下載過就記在這裡
let en: Messages | null = null

/** 目前語言的字典;給 React 以外的程式用。元件裡請用 useT() */
export const messages = (): Messages => current.messages
/** 目前語言;給 React 以外的程式用 */
export const currentLocale = (): Locale => current.locale

/** 換成這個語言(字典已經就緒);只有 I18nProvider 呼叫 */
export function setCurrent(locale: Locale, m: Messages): void {
  if (locale === 'en') en = m
  current = { locale, messages: m }
}

/** 英文字典(下載過才有) */
export const loadedEnglish = (): Messages | null => en

/** 所有已經載入的語言的字典:判斷「某句訊息是不是某個固定訊息」時,訊息可能是切換語言之前產生的,要和每一種語言比 */
export const loadedMessages = (): Messages[] => (en ? [zh, en] : [zh])

/** 日期(年月日),依目前語言的格式 */
export function formatDate(date: Date | string, locale: Locale = current.locale, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, opts).format(d)
}
