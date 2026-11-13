import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { kidsApi, type KidsMode } from './api'
import { taipeiNow } from './plan'
import { sortSlots, type Slot } from './schedule'
import { messages } from '../i18n/current'

// 這台裝置的兒童模式(伺服器用 cookie 記,GET /api/kids/mode 讀):開啟後全站只顯示兒童課程,右上角是兒童的膠囊頭像(KidsCapsule)。
// 上課時段的狀態(現在能不能上、下一堂幾點)每分鐘重新問一次伺服器,時段到了畫面自己更新;真正的把關在伺服器(腳本 API)。
// 管理員從頭像選單「開啟模擬」、在底部的模擬膠囊選「兒童模式」時,用模擬的孩子(simulatedKidsMode),只改畫面,伺服器仍把你當管理員。

type KidsModeState = {
  /** 讀到之前是 null */
  mode: KidsMode | null
  start: (childId: string) => Promise<void>
  stop: () => Promise<void>
  refresh: () => void
}

const KidsModeContext = createContext<KidsModeState | null>(null)

const REFRESH_MS = 60_000
/** 讀不到兒童模式時隔多久再問一次 */
const RETRY_MS = 10_000

// 上一次讀到的兒童模式(這台裝置):讀不到伺服器時沿用,不要因為一次連線失敗就把孩子放出兒童模式(fail-closed)。
// 兒童模式的 cookie 是 HttpOnly,前端看不到,所以另外記一份;伺服器說沒開、離開兒童模式、登出時清掉。
const LAST_KEY = 'kids:mode'
function readLast(): KidsMode | null {
  try {
    const raw = localStorage.getItem(LAST_KEY)
    const m = raw ? (JSON.parse(raw) as KidsMode) : null
    return m?.active ? m : null
  } catch {
    return null
  }
}
function writeLast(m: KidsMode | null) {
  try {
    if (m?.active) localStorage.setItem(LAST_KEY, JSON.stringify(m))
    else localStorage.removeItem(LAST_KEY)
  } catch {
    /* 私密模式等情況:只是少了這層保護,伺服器仍會把關 */
  }
}

/** 模擬的兒童模式:一個模擬的孩子,正在上課(這個整點開始、60 分鐘),後天 16:00 還有一堂 */
export function simulatedKidsMode(now: Date): KidsMode {
  const t = taipeiNow(now)
  const hour = t.time.slice(0, 2)
  const current: Slot = { day: t.day, time: `${hour}:00` as Slot['time'] }
  const later: Slot = { day: (t.day + 2) % 7, time: '16:00' }
  const start = new Date(now.getTime() - Number(t.time.slice(3)) * 60_000)
  start.setSeconds(0, 0)
  const endsAt = new Date(start.getTime() + 60 * 60_000).toISOString()
  return {
    active: true,
    child: { id: 'simulated', name: messages().kidsMode.simulatedChild, avatar: '🐣', slots: sortSlots([current, later]), minutes: 60, createdAt: now.toISOString() },
    schedule: { open: true, current, endsAt, next: later },
  }
}

export function KidsModeProvider({ children }: { children: ReactNode }) {
  const { real, simulation, closeSimulation } = useAuth()
  const simulated = simulation === 'kids'
  const loggedIn = real.status === 'user'
  const [mode, setMode] = useState<KidsMode | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    if (real.status === 'loading') return
    if (!loggedIn) {
      writeLast(null)
      setMode({ active: false })
      return
    }
    let cancelled = false
    let retry = 0
    kidsApi.mode().then(
      (m) => {
        if (cancelled) return
        writeLast(m)
        setMode(m)
      },
      () => {
        if (cancelled) return
        // 讀不到:沿用目前的或上一次記下的兒童模式(不要因為連線失敗就離開兒童模式),過一會兒再問
        setMode((cur) => (cur?.active ? cur : (readLast() ?? { active: false })))
        retry = window.setTimeout(refresh, RETRY_MS)
      },
    )
    return () => {
      cancelled = true
      window.clearTimeout(retry)
    }
  }, [real.status, loggedIn, tick, refresh])

  // 兒童模式中:每分鐘更新上課狀態
  const active = mode?.active === true
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(refresh, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [active, refresh])

  const start = useCallback(async (childId: string) => {
    const m = await kidsApi.start(childId)
    writeLast(m)
    setMode(m)
  }, [])
  const stop = useCallback(async () => {
    // 模擬的兒童模式:離開就是結束模擬,回到本人
    if (simulated) {
      closeSimulation()
      return
    }
    await kidsApi.stop()
    writeLast(null)
    setMode({ active: false })
  }, [simulated, closeSimulation])

  const shown = useMemo(() => (simulated ? simulatedKidsMode(new Date()) : mode), [simulated, mode])
  const value = useMemo(() => ({ mode: shown, start, stop, refresh }), [shown, start, stop, refresh])
  return <KidsModeContext.Provider value={value}>{children}</KidsModeContext.Provider>
}

export function useKidsMode(): KidsModeState {
  const ctx = useContext(KidsModeContext)
  if (!ctx) throw new Error('useKidsMode 要在 KidsModeProvider 裡面')
  return ctx
}

/** 兒童模式中可以停留的網址:兒童課的課程地圖與每一課(其他網址都帶回課程地圖) */
export const KIDS_MODE_HOME = '/topics/kids'
export const isKidsModePath = (pathname: string): boolean => pathname === KIDS_MODE_HOME || pathname.startsWith(`${KIDS_MODE_HOME}/`)
