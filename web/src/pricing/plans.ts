// 收費頁的課程分組。課程內容的來源是 content/levels.ts。
import type { PlanManageLinks, PlanSubscription } from '../auth/api'
import { safeNextPath } from '../auth/paths'
import { COURSES, coursePath } from '../content/catalog'
import { ALL_LEVELS, planTierOf, type CourseLevel } from '../content/levels'

export const FREE_LEVELS: CourseLevel[] = ALL_LEVELS.filter((level) => level.access === 'free' || level.access === 'login-free')

/** 其他課程都要訂閱,不單門販售 */
export const SUBSCRIPTION_LEVELS: CourseLevel[] = ALL_LEVELS.filter((level) => level.access === 'subscription')

export type PaidTier = 'basic' | 'advanced'

/** 各訂閱方案新增的階段;進階方案包含基礎方案,收費頁另外註明 */
export const TIER_LEVELS: Record<PaidTier, CourseLevel[]> = {
  basic: SUBSCRIPTION_LEVELS.filter((level) => planTierOf(level.id) === 'basic'),
  advanced: SUBSCRIPTION_LEVELS.filter((level) => planTierOf(level.id) === 'advanced'),
}

/** 年繳比 12 個月月繳省多少百分比(四捨五入到整數);金額是幣別的最小單位,看不懂或沒有比較便宜時回傳 0 */
export function yearlySavingPercent(monthlyAmount: string | undefined, yearlyAmount: string | undefined): number {
  const monthly = Number(monthlyAmount)
  const yearly = Number(yearlyAmount)
  if (!(monthly > 0) || !(yearly > 0)) return 0
  const percent = Math.round((1 - yearly / (monthly * 12)) * 100)
  return percent > 0 ? percent : 0
}

/** 幣別最小單位的金額 → 「NT$150.00」;小數位數依幣別(Intl 決定),看不懂時回傳空字串。
 *  用 en-US 格式:zh-TW 會把台幣顯示成「$」,和美元分不出來 */
export function formatAmount(amount: string, currency: string): string {
  const value = Number(amount)
  if (!Number.isFinite(value) || !currency) return ''
  try {
    const format = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2
    return format.format(value / 10 ** digits)
  } catch {
    return ''
  }
}

/** 收費頁只列階段名稱(例如「L2 基礎」),不列課名;課程目錄沒有這門課時用等級名稱 */
export function stageLabel(level: CourseLevel): string {
  return COURSES.find((course) => coursePath(course) === level.link)?.level ?? level.levelLabel
}

export const BILLING_PERIODS = [
  { key: 'monthly', label: '月繳' },
  { key: 'yearly', label: '年繳' },
] as const

export type BillingPeriod = (typeof BILLING_PERIODS)[number]['key']

export type PriceStatus = 'unavailable' | 'loading' | 'ready' | 'error'

export type SubscribeAction = 'subscribed' | 'soon' | 'wait' | 'login' | 'subscribe'

/** 訂閱按鈕該做什麼:要等 Paddle 和登入狀態都確定;沒有價格是「即將開放」;必須登入才能把訂閱記到帳號上。 */
export function subscribeAction(
  priceId: string | undefined,
  priceStatus: PriceStatus,
  authStatus: 'loading' | 'guest' | 'user' | 'disabled',
  /** 是否有有效的訂閱;null = 還不知道(不能讓人重複訂閱) */
  subscribed: boolean | null = false,
): SubscribeAction {
  if (subscribed) return 'subscribed'
  if (priceStatus === 'unavailable' || authStatus === 'disabled') return 'soon'
  if (priceStatus !== 'ready') return 'wait'
  if (!priceId) return 'soon'
  if (authStatus === 'loading') return 'wait'
  if (authStatus === 'guest') return 'login'
  return subscribed === null ? 'wait' : 'subscribe'
}

export type CardAction = SubscribeAction | 'error'

/**
 * 一張方案卡(一個方案的一個計費週期)的按鈕狀態。每張卡各自判斷:
 * 這個方案還沒在 Paddle 設定價格(沒有價格 ID,或 Paddle 沒回這個價格)就是「即將開放」,不影響其他方案;
 * Paddle 連不上是 error;其他情況同 subscribeAction。
 */
export function cardAction(
  priceId: string | undefined,
  priced: boolean,
  priceStatus: PriceStatus,
  authStatus: 'loading' | 'guest' | 'user' | 'disabled',
  subscribed: boolean | null = false,
): CardAction {
  if (!priceId || priceStatus === 'unavailable') return 'soon'
  if (priceStatus === 'loading') return 'wait'
  if (priceStatus === 'error') return 'error'
  if (!priced) return 'soon'
  return subscribeAction(priceId, priceStatus, authStatus, subscribed)
}

/** ISO 時間 → 「2026年12月5日」(本機時區);無法解析回空字串 */
export function formatPlanDate(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** 已訂閱時要顯示的狀態:扣款失敗最優先,其次是排定的結束日(ending,用提示色),最後才是續訂日 */
export function subscriptionNotice(subscription: PlanSubscription | undefined): { pastDue: boolean; ending: boolean; text: string } {
  if (!subscription) return { pastDue: false, ending: false, text: '' }
  if (subscription.status === 'past_due') return { pastDue: true, ending: false, text: '上次扣款失敗，請更新付款方式。' }
  const cancelAt = formatPlanDate(subscription.cancelAt)
  if (cancelAt) return { pastDue: false, ending: true, text: `訂閱將在 ${cancelAt} 結束，到期前仍可使用。` }
  const renewsAt = formatPlanDate(subscription.currentPeriodEnd)
  return { pastDue: false, ending: false, text: renewsAt ? `下次續訂日：${renewsAt}` : '' }
}

export const PRICING_PATH = '/pricing'

/**
 * 收費頁連結。returnTo 是訂閱完成後要回到的站內頁面(例如被擋下的課程);
 * checkout 是登入後要直接開啟結帳的方案與計費週期(未登入時按了訂閱)。
 */
export function pricingHref(returnTo?: string, checkout?: { tier: PaidTier; period: BillingPeriod }): string {
  const params = new URLSearchParams()
  const next = returnTo ? safeNextPath(returnTo) : '/'
  if (next !== '/' && !next.startsWith(PRICING_PATH)) params.set('next', next)
  if (checkout) {
    params.set('plan', checkout.tier)
    params.set('checkout', checkout.period)
  }
  const query = params.toString()
  return query ? `${PRICING_PATH}?${query}` : PRICING_PATH
}

/** 網址上的 plan → 要結帳的方案;不認得就回傳 undefined */
export function paidTierOf(value: string | null): PaidTier | undefined {
  return value === 'basic' || value === 'advanced' ? value : undefined
}

/** 網址上的 checkout → 要直接開啟結帳的計費週期;不認得就回傳 undefined */
export function checkoutPeriodOf(value: string | null): BillingPeriod | undefined {
  return BILLING_PERIODS.find((period) => period.key === value)?.key
}

/** 收費頁網址上的 next → 訂閱後要回到的頁面;沒有或不是站內路徑時回傳空字串 */
export function returnPathOf(next: string | null): string {
  const path = safeNextPath(next)
  return path === '/' || path.startsWith(PRICING_PATH) ? '' : path
}

/** 按鈕要前往的網址:換卡優先用換卡連結,沒有就到總覽 */
export function manageTarget(links: PlanManageLinks, updatePayment: boolean): string {
  return (updatePayment && links.updatePaymentUrl) || links.url
}
