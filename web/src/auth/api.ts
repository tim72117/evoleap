// 登入相關 API(server/internal/api/auth.go)。登入狀態存在 HttpOnly cookie,前端不保存 token。
import { errorText } from '../i18n/errorText'

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
  /** 只用來決定要不要顯示研發基地的入口;真正的權限由伺服器判定 */
  isAdmin?: boolean
  /** 有效訂閱,訂閱者不看廣告。訂閱功能合併前伺服器不會回傳,視為沒訂閱 */
  subscribed?: boolean
  /** 帳號綁定了 Google 登入(會員空間顯示登入方式用) */
  google?: boolean
  /** 介面語言偏好("zh-Hant"、"en");空字串是沒選過 */
  locale?: string
}

/** 使用者選的方案:'free' 還沒選、'ads' 廣告方案(看基礎訂閱課程,每課開始前播一段廣告)、'subscription' 訂閱(全部課程、免廣告) */
export type PlanKind = 'free' | 'ads' | 'subscription'

/** GET /api/plan/me、POST /api/plan/ads 的回傳;tier 是方案涵蓋到哪一級課程('free' | 'basic' | 'advanced') */
export interface PlanMe {
  plan: PlanKind
  tier: string
}

/** GET /api/courses/{courseId}/access 的回傳:這一課現在能不能看(伺服器判定) */
export interface CourseAccessResult {
  access: 'free' | 'login-free' | 'subscription'
  allowed: boolean
  /** allowed 為 false 時的原因 */
  reason?: 'login_required' | 'plan_required'
  /** 廣告方案:要先看完這一課的開課廣告(還沒有這一課的有效通行) */
  ad?: boolean
}

/** POST /api/plan/ads/start 的回傳:token 交給 finish;seconds 是廣告要播放的秒數 */
export interface AdStart {
  token: string
  seconds: number
}

/** API 回傳的錯誤;message 是依錯誤代碼翻成目前語言、可以直接顯示給使用者的訊息 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

/**
 * 管理員在會員空間「模擬身分」時(AuthContext 存在 sessionStorage 的 auth:simulate),請求帶上 X-Simulate-Role,
 * 伺服器的課程權限與方案狀態才會照模擬的身分回答(不然伺服器一律把你當管理員)。只有真的管理員送的才算數,一般使用者不會有這個值。
 */
function simulatedRole(): string | null {
  try {
    const v = sessionStorage.getItem('auth:simulate')
    return v === 'guest' || v === 'member' || v === 'subscriber' ? v : null
  } catch {
    return null
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const role = simulatedRole()
  if (role) headers['X-Simulate-Role'] = role
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? 'unknown', errorText(data))
  }
  return data as T
}

export const authApi = {
  /** evoleap CLI 登入要求要顯示的名稱(核准頁用,見 CliAuthPage) */
  cliAuthName: (id: string) => request<{ name: string }>('GET', `/api/cli-auth/${encodeURIComponent(id)}`).then((r) => r.name),
  /** 管理員核准 CLI 登入;回傳要把瀏覽器導回去的 CLI 本機網址 */
  cliAuthApprove: (id: string) => request<{ redirect: string }>('POST', `/api/cli-auth/${encodeURIComponent(id)}/approve`).then((r) => r.redirect),
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
  /** 會員空間改自己的資料;沒帶的欄位不改,回傳更新後的使用者 */
  updateProfile: (fields: { name?: string; locale?: string }) => request<{ user: User }>('PATCH', '/api/me', fields).then((r) => r.user),
  /** 目前的方案(要登入) */
  planMe: () => request<PlanMe>('GET', '/api/plan/me'),
  /** 選擇廣告方案(要登入);重複選擇沒有副作用,回傳選完的方案 */
  chooseAdsPlan: () => request<PlanMe>('POST', '/api/plan/ads'),
  /** 這一課能不能看;courseId 是課程種子的 id(levels.ts 的等級 id),lessonId 是課號(例如 '4.1');不用登入 */
  courseAccess: (courseId: string, lessonId: string) =>
    request<CourseAccessResult>('GET', `/api/courses/${encodeURIComponent(courseId)}/access?lesson=${encodeURIComponent(lessonId)}`),
  /** 開始播放開課廣告(廣告方案,要登入) */
  adsStart: (course: string, lesson: string) => request<AdStart>('POST', '/api/plan/ads/start', { course, lesson }),
  /** 廣告播完:伺服器發這一課的短期通行 cookie;秒數還沒到回 409 too_early */
  adsFinish: (token: string) => request<void>('POST', '/api/plan/ads/finish', { token }),
}
