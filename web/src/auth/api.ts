// 登入相關 API(server/internal/api/auth.go)。登入狀態存在 HttpOnly cookie,前端不保存 token。

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
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
}
