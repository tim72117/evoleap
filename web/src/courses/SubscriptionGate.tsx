import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authApi, type CourseAccessResult } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { coursePath, levelIdOf, type Course } from '../content/catalog'
import { SiteLayout } from '../site/SiteLayout'
import styles from './LoginGate.module.css'
import { gateView } from './courseGate'
import { pricingHref } from '../pricing/plans'

// 「訂閱專屬」課程的單課頁與章節頁:後端確認可以看才顯示內容,查不到一律不放行。課程總覽與章節清單保持公開。
// label 是「第 1.1 課」「4.1」這類編號,title 是頁面標題,沒權限時只顯示這兩項。
export function SubscriptionGate({ course, label, title, children }: { course: Course; label: string; title: string; children: ReactNode }) {
  const { status, user } = useAuth()
  const { pathname, search } = useLocation()
  const [result, setResult] = useState<CourseAccessResult | null>(null)
  const [failed, setFailed] = useState(false)
  const levelId = levelIdOf(course)
  const userId = user?.id

  useEffect(() => {
    setResult(null)
    setFailed(false)
    if (status === 'loading') return
    if (!levelId) {
      setFailed(true)
      return
    }
    let cancelled = false
    authApi
      .courseAccess(levelId)
      .then((next) => {
        if (!cancelled) setResult(next)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [levelId, status, userId])

  const view = gateView(result, failed)
  if (view === 'allowed') return <>{children}</>

  return (
    <SiteLayout title={`${label} ${title}`}>
      <div className={styles.container}>
        <p className={styles.kicker}>
          {course.title} · {label}
        </p>
        <h1>{title}</h1>
        {/* 確認前只留標題,已訂閱的人不會閃過訂閱提示 */}
        {view === 'failed' && (
          <>
            <p className={styles.note}>暫時無法確認你的訂閱狀態，請重新整理再試一次。</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
                重新整理
              </button>
              <Link to={coursePath(course)}>回課程總覽</Link>
            </div>
          </>
        )}
        {view === 'login' && (
          <>
            <p className={styles.note}>這門課要訂閱才能觀看，請先登入。</p>
            <div className={styles.actions}>
              <Link className={styles.primary} to={loginHref(pathname + search)}>
                登入或註冊
              </Link>
              <Link to={coursePath(course)}>回課程總覽</Link>
            </div>
          </>
        )}
        {view === 'subscribe' && (
          <>
            <p className={styles.note}>{result?.plan ? `這門課要訂閱${result.plan}才能觀看。` : '這門課要訂閱才能觀看。'}</p>
            <div className={styles.actions}>
              <Link className={styles.primary} to={pricingHref(pathname + search)}>
                查看訂閱方案
              </Link>
              <Link to={coursePath(course)}>回課程總覽</Link>
            </div>
          </>
        )}
      </div>
    </SiteLayout>
  )
}
