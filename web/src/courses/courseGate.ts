import type { CourseAccessResult } from '../auth/api'

// 訂閱課程單課頁(SubscriptionGate)要顯示什麼,依伺服器回傳的權限決定。
// 只有伺服器明確回 allowed:true 才放行;查詢失敗、還沒查完或看不懂的回傳都不顯示內容。

export type GateView = 'checking' | 'allowed' | 'ad' | 'login' | 'pricing' | 'failed'

/**
 * result:GET /api/courses/{id}/access 的回傳,null = 還沒查到;failed:查詢失敗(API 或網路錯誤)。
 * - allowed + ad:廣告方案,先看開課廣告
 * - allowed:直接看
 * - login_required:登入提示;plan_required:導去方案頁
 */
export function gateView(result: CourseAccessResult | null, failed: boolean): GateView {
  if (failed) return 'failed'
  if (!result) return 'checking'
  if (result.allowed === true) return result.ad === true ? 'ad' : 'allowed'
  if (result.reason === 'login_required') return 'login'
  if (result.reason === 'plan_required') return 'pricing'
  return 'failed'
}
