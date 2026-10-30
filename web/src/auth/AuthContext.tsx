import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, type User } from './api'

// 全站登入狀態。啟動時向 /api/me 確認一次;登入/註冊/登出後更新。
// status:'loading' 尚未確認、'guest' 未登入、'user' 已登入、'disabled' 伺服器未開放登入。

type AuthState = {
  status: 'loading' | 'guest' | 'user' | 'disabled'
  user: User | null
  /** 登入、註冊或 Google 登入成功後呼叫 */
  setUser: (user: User) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthState['status']>('loading')

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
        if (!cancelled) setStatus('guest')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setUser = useCallback((u: User) => {
    setUserState(u)
    setStatus('user')
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {})
    setUserState(null)
    setStatus('guest')
  }, [])

  const value = useMemo(() => ({ status, user, setUser, logout }), [status, user, setUser, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
