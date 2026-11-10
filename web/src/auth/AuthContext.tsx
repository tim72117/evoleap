import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isInternalPath } from '../site/internalPaths'
import { authApi, type User } from './api'

// 全站登入狀態。啟動時向 /api/me 確認一次;登入/註冊/登出後更新。
// status:'loading' 尚未確認、'guest' 未登入、'user' 已登入、'disabled' 伺服器未開放登入。

/** 管理員模擬的身分:admin 是本人(不模擬)、guest 訪客、member 註冊未訂閱、subscriber 已訂閱 */
export type SimulatedRole = 'admin' | 'guest' | 'member' | 'subscriber'

type Status = 'loading' | 'guest' | 'user' | 'disabled'

type AuthState = {
  /** 全站畫面用的狀態:管理員模擬身分時是模擬的結果,其他情況就是真實狀態 */
  status: Status
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
  /** 真實的登入狀態(不受模擬影響):會員空間、登出、需要真正身分的地方用 */
  real: { status: Status; user: User | null }
  /** 目前模擬的身分;只有管理員會是 admin 以外的值。只改這個瀏覽器看到的畫面,伺服器仍把你當管理員 */
  simulation: SimulatedRole
  setSimulation: (role: SimulatedRole) => void
}

const SIM_KEY = 'auth:simulate'
const readSimulation = (): SimulatedRole => {
  try {
    const v = sessionStorage.getItem(SIM_KEY)
    return v === 'guest' || v === 'member' || v === 'subscriber' ? v : 'admin'
  } catch {
    return 'admin'
  }
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [simulation, setSimulationState] = useState<SimulatedRole>(readSimulation)
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

  const setSimulation = useCallback((role: SimulatedRole) => {
    setSimulationState(role)
    try {
      if (role === 'admin') sessionStorage.removeItem(SIM_KEY)
      else sessionStorage.setItem(SIM_KEY, role)
    } catch {
      /* 私密模式等情況:這次分頁內仍有效,重新整理後回到本人 */
    }
  }, [])

  // 只有管理員能模擬;不是管理員(或登出了)時一律當本人
  const role: SimulatedRole = status === 'user' && user?.isAdmin ? simulation : 'admin'
  const value = useMemo<AuthState>(() => {
    const real = { status, user }
    const base = { checkFailed, setUser, logout, sessionExpired, expired, real, simulation: role, setSimulation }
    if (role === 'guest') return { ...base, status: 'guest', user: null }
    if (role === 'member' || role === 'subscriber') {
      // 一般會員看到的畫面:不是管理員(不顯示研發基地入口、會看到廣告),訂閱與否照選的
      return { ...base, status: 'user', user: { ...user!, isAdmin: false, subscribed: role === 'subscriber' } }
    }
    return { ...base, status, user }
  }, [status, user, role, checkFailed, setUser, logout, sessionExpired, expired, setSimulation])
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
