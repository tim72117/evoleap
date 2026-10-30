import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Google Analytics 4(gtag.js)。
 * 只在 production build 且有設定 VITE_GA_MEASUREMENT_ID 時啟用;否則所有函式皆為 no-op,
 * 不載入任何 script、不發任何網路請求。gtag.js 於首次呼叫時才動態插入。
 */
const MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim()
const ENABLED = import.meta.env.PROD && MEASUREMENT_ID !== ''

/** 內部頁面(提案、文件、素材)不計入流量。 */
const EXCLUDED_PREFIXES = ['/proposal', '/docs', '/materials']

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }

let initialized = false

function gtag(...args: unknown[]) {
  if (!ENABLED || typeof window === 'undefined') return
  const w = window as GtagWindow
  if (!initialized) {
    initialized = true
    w.dataLayer = w.dataLayer || []
    // gtag.js 要求推入的是 arguments 物件本身。
    w.gtag = function () {
      w.dataLayer!.push(arguments)
    }
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`
    document.head.appendChild(s)
    w.gtag('js', new Date())
    // SPA:page_view 由 useAnalyticsPageView 手動送出。
    w.gtag('config', MEASUREMENT_ID, { send_page_view: false })
  }
  w.gtag!(...args)
}

function isExcluded(path: string): boolean {
  const pathname = path.split(/[?#]/)[0]
  return EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export function trackPageView(path: string, title: string = document.title): void {
  if (!ENABLED || isExcluded(path)) return
  gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.origin + path,
    page_title: title,
  })
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!ENABLED) return
  gtag('event', name, params ?? {})
}

/** 在 App 呼叫一次:每次路由切換送出 page_view(延後一個 tick,等各頁更新 document.title)。 */
export function useAnalyticsPageView(): void {
  const { pathname, search } = useLocation()
  useEffect(() => {
    if (!ENABLED) return
    const t = window.setTimeout(() => trackPageView(pathname + search, document.title), 0)
    return () => window.clearTimeout(t)
  }, [pathname, search])
}
