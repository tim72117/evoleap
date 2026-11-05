import type { CourseAccessResult } from '../auth/api'

export type GateView = 'checking' | 'allowed' | 'login' | 'subscribe' | 'failed'

/**
 * 訂閱課程的單課頁該顯示什麼。只有後端明確回 allowed 才放行,
 * 查詢失敗或看不懂的回應都不放行(和「登入後免費」在伺服器沒開放登入時放行不同)。
 */
export function gateView(result: CourseAccessResult | null, failed: boolean): GateView {
  if (failed) return 'failed'
  if (!result) return 'checking'
  if (result.allowed) return 'allowed'
  return result.reason === 'login_required' ? 'login' : 'subscribe'
}
