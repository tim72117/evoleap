import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isInternalPath } from '../site/internalPaths'
import { authApi, type User } from './api'

// 全站登入狀態。啟動時向 /api/me 確認一次;登入/註冊/登出後更新。
// status:'loading' 尚未確認、'guest' 未登入、'user' 已登入、'disabled' 伺服器未開放登入。

type AuthState = {
  status: 'loading' | 'guest' | 'user' | 'disabled'
  user: User | null
  /** 啟動時的登入檢查失敗(API 或網路錯誤),status 是 'guest' 但不確定是不是真的沒登入 */
  checkFailed: boolean
  /** 登入、註冊或 Google 登入成功後呼叫 */
  setUser: (user: User) => void
  logout: () => Promise<void>
  /** API 回 401(登入過期、在別處登出):把狀態設回訪客,expired 設為 true,頁面可以導去登入頁再回來 */
  sessionExpired: () => void
  /** 這次變成訪客是因為登入過期(sessionExpired),不是自己按登出 */
  expired: boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthState['status']>('loading')
  const [checkFailed, setCheckFailed] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([authApi.config(), authApi.me()])
      .then(([config, u]) => {
        if (cancelled) return
        if (!config.enabled) {
          setStatus('disabled')
          return
        }
        setUserState(u)
        setStatus(u ? 'user' : 'guest')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('guest')
        setCheckFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setUser = useCallback((u: User) => {
    setUserState(u)
    setStatus('user')
    setCheckFailed(false)
    setExpired(false)
  }, [])

  const sessionExpired = useCallback(() => {
    setUserState(null)
    setStatus((s) => (s === 'user' ? 'guest' : s))
    setCheckFailed(false)
    setExpired(true)
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {})
    // 內部頁在畫面上不能留著:重新載入,交給伺服器導向登入頁。
    if (isInternalPath(window.location.pathname)) {
      window.location.reload()
      return
    }
    setUserState(null)
    setStatus('guest')
    setCheckFailed(false)
    setExpired(false)
  }, [])

  const value = useMemo(
    () => ({ status, user, checkFailed, setUser, logout, sessionExpired, expired }),
    [status, user, checkFailed, setUser, logout, sessionExpired, expired],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** 要不要顯示研發基地的入口:管理員才顯示 */
export function useCanSeeStudio(): boolean {
  return !!useAuth().user?.isAdmin
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
