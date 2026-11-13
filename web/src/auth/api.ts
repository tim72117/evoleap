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
}
