import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { coursePath, lessonLabel, type Course } from '../content/catalog'
import type { CourseLesson } from '../content/lessonTypes'
import { SiteLayout } from '../site/SiteLayout'
import styles from './LoginGate.module.css'

// 「登入後免費」課程的單課頁:登入後才顯示內容。課程總覽保持公開,讓人登入前看得到課程內容。
// 只擋畫面,課程資料仍在公開的 bundle 裡。伺服器沒開放登入(disabled)時沒有辦法登入,直接顯示內容。
export function LoginGate({ course, lesson, children }: { course: Course; lesson: CourseLesson; children: ReactNode }) {
  const { status, checkFailed } = useAuth()
  const { pathname, search } = useLocation()
  if (status === 'user' || status === 'disabled') return <>{children}</>

  const label = lessonLabel(lesson)
  return (
    <SiteLayout title={`${label} ${lesson.title}`}>
      <div className={styles.container}>
        <p className={styles.kicker}>
          {course.title} · {label}
        </p>
        <h1>{lesson.title}</h1>
        {/* 確認登入狀態前只留標題,已登入的人不會閃過登入提示 */}
        {checkFailed && (
          <>
            <p className={styles.note}>暫時無法確認登入狀態，請重新整理再試一次。</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
                重新整理
              </button>
              <Link to={coursePath(course)}>回課程總覽</Link>
            </div>
          </>
        )}
        {status === 'guest' && !checkFailed && (
          <>
            <p className={styles.note}>這門課免費，登入後就能觀看，也會記錄你的播放進度。</p>
            <div className={styles.actions}>
              <Link className={styles.primary} to={loginHref(pathname + search)}>
                登入或註冊
              </Link>
              <Link to={coursePath(course)}>回課程總覽</Link>
            </div>
          </>
        )}
      </div>
    </SiteLayout>
  )
}
