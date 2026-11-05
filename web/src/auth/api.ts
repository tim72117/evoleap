// 登入相關 API(server/internal/api/auth.go)。登入狀態存在 HttpOnly cookie,前端不保存 token。

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
  /** 只用來決定要不要顯示研發基地的入口;真正的權限由伺服器判定 */
  isAdmin?: boolean
}

/** 方案在 Paddle 的價格;金額由 Paddle 依買家所在地回傳 */
export interface PlanPrice {
  id: string
  period: 'monthly' | 'yearly'
}

/** 有效的訂閱。past_due = 上次扣款失敗,金流商還在重試 */
export interface PlanSubscription {
  status: 'active' | 'past_due'
  currentPeriodEnd?: string
  cancelAt?: string
}

export interface PlanMe {
  currentTier: string
  subscribed: boolean
  subscription?: PlanSubscription
}

/** 管理訂閱的連結是暫時的,每次要用才取得,不要存 */
export interface PlanManageLinks {
  url: string
  updatePaymentUrl?: string
}

export interface CourseAccessResult {
  access: 'free' | 'login-free' | 'subscription'
  allowed: boolean
  reason?: 'login_required' | 'subscription_required'
}

/** API 回傳的錯誤;message 是可以直接顯示給使用者的中文訊息 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? 'unknown', data.message ?? '發生錯誤，請稍後再試')
  }
  return data as T
}

export const authApi = {
  /** enabled:伺服器是否開放登入(未設定資料庫時為 false) */
  config: () => request<{ enabled: boolean; googleClientId: string }>('GET', '/api/auth/config'),
  /** 目前登入的使用者;未登入回傳 null */
  me: () => request<{ user: User | null }>('GET', '/api/me').then((r) => r.user),
  register: (email: string, password: string, name: string) =>
    request<{ user: User }>('POST', '/api/auth/register', { email, password, name }).then((r) => r.user),
  login: (email: string, password: string) =>
    request<{ user: User }>('POST', '/api/auth/login', { email, password }).then((r) => r.user),
  google: (credential: string) =>
    request<{ user: User }>('POST', '/api/auth/google', { credential }).then((r) => r.user),
  logout: () => request<void>('POST', '/api/auth/logout'),
  /** 金流未設定時回空清單;client 是載入 Paddle.js 需要的公開設定 */
  plans: () =>
    request<{ plans: { tier: string; prices?: PlanPrice[] }[]; client?: { token: string; environment: string } }>('GET', '/api/plan/plans'),
  planMe: () => request<PlanMe>('GET', '/api/plan/me'),
  planCheckout: (priceId: string) => request<{ url: string; sessionId: string }>('POST', '/api/plan/checkout', { priceId }),
  planManage: () => request<PlanManageLinks>('POST', '/api/plan/manage'),
  /** 目前的使用者能不能看這門課;未登入也能問。id 是 levels.ts 的等級 id */
  courseAccess: (id: string) => request<CourseAccessResult>('GET', `/api/courses/${encodeURIComponent(id)}/access`),
}
