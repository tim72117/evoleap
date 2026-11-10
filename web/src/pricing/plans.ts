// 方案頁的課程分組與網址工具。課程內容的來源是 content/levels.ts。
import type { PlanKind } from '../auth/api'
import { ALL_LEVELS, type CourseLevel } from '../content/levels'

export const PRICING_PATH = '/pricing'

/** 免費課程(免登入或登入後免費) */
export const FREE_LEVELS: CourseLevel[] = ALL_LEVELS.filter((level) => level.access === 'free' || level.access === 'login-free')

/** 要方案才能看的課程;'tbd'(還沒決定)不列 */
export const SUBSCRIPTION_LEVELS: CourseLevel[] = ALL_LEVELS.filter((level) => level.access === 'subscription')

export const PLAN_LABEL: Record<PlanKind, string> = {
  free: '免費',
  ads: '廣告方案',
  subscription: '訂閱方案',
}

/** 選完方案要回去的站內路徑:只接受 '/' 開頭、不是 '//' 或 '/\' 的路徑,其他(含沒帶)回傳 null */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  return next
}

/** 方案頁網址;next 是選完方案要回去的站內路徑(例如被擋下的單課頁) */
export function pricingHref(next?: string): string {
  const safe = safeNext(next)
  return safe ? `${PRICING_PATH}?next=${encodeURIComponent(safe)}` : PRICING_PATH
}
