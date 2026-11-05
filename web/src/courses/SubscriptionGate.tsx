import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authApi, type CourseAccessResult } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { coursePath, lessonLabel, levelIdOf, type Course } from '../content/catalog'
import type { CourseLesson } from '../content/lessonTypes'
import { SiteLayout } from '../site/SiteLayout'
import styles from './LoginGate.module.css'
import { gateView } from './courseGate'

// 「訂閱專屬」課程的單課頁:後端確認可以看才顯示內容,查不到一律不放行。課程總覽保持公開。
export function SubscriptionGate({ course, lesson, children }: { course: Course; lesson: CourseLesson; children: ReactNode }) {
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

  const label = lessonLabel(lesson)
  return (
    <SiteLayout title={`${label} ${lesson.title}`}>
      <div className={styles.container}>
        <p className={styles.kicker}>
          {course.title} · {label}
        </p>
        <h1>{lesson.title}</h1>
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
            <p className={styles.note}>這門課要訂閱才能觀看。</p>
            <div className={styles.actions}>
              <Link className={styles.primary} to="/pricing">
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
