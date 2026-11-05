// 收費頁的課程分組。課程內容的來源是 content/levels.ts。
import type { PlanManageLinks, PlanSubscription } from '../auth/api'
import { ALL_LEVELS, type CourseLevel } from '../content/levels'

export const FREE_LEVELS: CourseLevel[] = ALL_LEVELS.filter((level) => level.access === 'free' || level.access === 'login-free')

/** 其他課程都要訂閱,不單門販售 */
export const SUBSCRIPTION_LEVELS: CourseLevel[] = ALL_LEVELS.filter((level) => level.access === 'subscription')

export const BILLING_PERIODS = [
  { key: 'monthly', label: '月繳' },
  { key: 'yearly', label: '年繳' },
] as const

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

/** ISO 時間 → 「2026年12月5日」(本機時區);無法解析回空字串 */
export function formatPlanDate(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** 已訂閱時要顯示的狀態:扣款失敗最優先,其次是排定的結束日,最後才是續訂日 */
export function subscriptionNotice(subscription: PlanSubscription | undefined): { pastDue: boolean; text: string } {
  if (!subscription) return { pastDue: false, text: '' }
  if (subscription.status === 'past_due') return { pastDue: true, text: '上次扣款失敗，請更新付款方式。' }
  const cancelAt = formatPlanDate(subscription.cancelAt)
  if (cancelAt) return { pastDue: false, text: `訂閱將在 ${cancelAt} 結束` }
  const renewsAt = formatPlanDate(subscription.currentPeriodEnd)
  return { pastDue: false, text: renewsAt ? `下次續訂日：${renewsAt}` : '' }
}

/** 按鈕要前往的網址:換卡優先用換卡連結,沒有就到總覽 */
export function manageTarget(links: PlanManageLinks, updatePayment: boolean): string {
  return (updatePayment && links.updatePaymentUrl) || links.url
}
