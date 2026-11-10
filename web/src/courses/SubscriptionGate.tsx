import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { authApi, type CourseAccessResult } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { useT } from '../i18n/I18nProvider'
import { pricingHref } from '../pricing/plans'
import { lazyPage } from '../site/lazyPage'
import { SiteLayout } from '../site/SiteLayout'
import { gateView } from './courseGate'
import styles from './PrerollAd.module.css'

// 訂閱課程的單課頁:伺服器說可以看才顯示內容(GET /api/courses/{id}/access)。
// 未登入 → 登入提示;登入但沒有涵蓋這門課的方案 → 導去方案頁(/pricing?next=這一課);
// 廣告方案 → 先播開課廣告(PrerollAd);訂閱者或這一課的廣告通行還有效 → 直接看。
// 只擋畫面,課程資料仍在公開的 bundle 裡。伺服器沒開放登入(disabled)時沒有方案可選,不顯示內容。

// 開課廣告只有廣告方案的人會看到,用到才下載
const PrerollAd = lazyPage(() => import('./PrerollAd').then((m) => m.PrerollAd))

type Props = {
  /** 課程種子 id(levels.ts 的等級 id);找不到時一律不放行 */
  courseId: string | undefined
  /** 課號,例如 '4.1' */
  lessonId: string
  /** 標題上方的小字,例如「課程名稱 · 第 1 課」 */
  kicker: string
  title: string
  docTitle: string
  back: { to: string; label: string }
  children: ReactNode
}

export function SubscriptionGate({ courseId, lessonId, kicker, title, docTitle, back, children }: Props) {
  const { status, user, checkFailed, simulation } = useAuth()
  const { pathname, search } = useLocation()
  const c = useT().courses
  const ready = status === 'user' || status === 'guest'
  // 查詢結果綁著「哪個使用者、哪一課」:換了使用者(登入、登出)、管理員切換模擬身分或換課,舊結果立刻作廢,不會先閃過內容再重查
  const key = ready ? `${user?.id ?? 'guest'}|${simulation}|${courseId ?? ''}|${lessonId}` : null
  const [state, setState] = useState<{ key: string; result: CourseAccessResult | null; failed: boolean; passed: boolean } | null>(null)
  const current = key !== null && state?.key === key ? state : null
  const result = current?.result ?? null
  const failed = !courseId || (current?.failed ?? false)
  /** 這一次已經看完開課廣告(伺服器發了通行) */
  const passed = current?.passed ?? false

  // 登入狀態確定後才查
  useEffect(() => {
    if (key === null || !courseId) return
    let cancelled = false
    authApi
      .courseAccess(courseId, lessonId)
      .then((r) => {
        if (!cancelled) setState({ key, result: r, failed: false, passed: false })
      })
      .catch(() => {
        if (!cancelled) setState({ key, result: null, failed: true, passed: false })
      })
    return () => {
      cancelled = true
    }
  }, [key, courseId, lessonId])

  const onAdDone = useCallback(() => {
    setState((s) => (s && s.key === key ? { ...s, passed: true } : s))
  }, [key])

  if (status === 'disabled') {
    return (
      <Frame kicker={kicker} title={title} docTitle={docTitle}>
        <p className={styles.note}>{c.subscriptionGate.notOpen}</p>
        <div className={styles.actions}>
          <Link className={styles.secondary} to={back.to}>
            {back.label}
          </Link>
        </div>
      </Frame>
    )
  }

  // 登入檢查失敗:不確定是不是訪客,先不顯示登入提示
  const view = checkFailed ? 'failed' : status === 'loading' ? 'checking' : gateView(result, failed)

  if (view === 'allowed' || (view === 'ad' && passed)) return <>{children}</>
  if (view === 'pricing') return <Navigate replace to={pricingHref(pathname + search)} />
  if (view === 'ad' && courseId) {
    return <PrerollAd kicker={kicker} title={title} docTitle={docTitle} courseId={courseId} lessonId={lessonId} onDone={onAdDone} />
  }

  return (
    <Frame kicker={kicker} title={title} docTitle={docTitle}>
      {/* 確認權限前只留標題,可以看的人不會閃過提示 */}
      {view === 'login' && (
        <>
          <p className={styles.note}>{c.subscriptionGate.needPlan}</p>
          <div className={styles.actions}>
            <Link className={styles.primary} to={loginHref(pathname + search)}>
              {c.gate.signInOrUp}
            </Link>
            <Link className={styles.secondary} to={back.to}>
              {back.label}
            </Link>
          </div>
        </>
      )}
      {view === 'failed' && (
        <>
          <p className={styles.note}>{c.subscriptionGate.checkFailed}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
              {c.gate.reload}
            </button>
            <Link className={styles.secondary} to={back.to}>
              {back.label}
            </Link>
          </div>
        </>
      )}
    </Frame>
  )
}

function Frame({ kicker, title, docTitle, children }: { kicker: string; title: string; docTitle: string; children: ReactNode }) {
  return (
    <SiteLayout title={docTitle}>
      <div className={styles.container}>
        <p className={styles.kicker}>{kicker}</p>
        <h1>{title}</h1>
        {children}
      </div>
    </SiteLayout>
  )
}
