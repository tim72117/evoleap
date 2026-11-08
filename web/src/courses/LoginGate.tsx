import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { GATE_PREFIX, useGuestView } from './guestActivity'
import { loginHref } from '../auth/paths'
import { SiteLayout } from '../site/SiteLayout'
import styles from './LoginGate.module.css'

// 要登入才能看的單課頁:登入後才顯示內容。「登入後免費」的課程與兒童課第二課以後都用它;課程總覽、課程地圖保持公開。
// 只擋畫面,課程資料仍在公開的 bundle 裡。伺服器沒開放登入(disabled)時沒有辦法登入,直接顯示內容。
type Props = {
  /** 標題上方的小字,例如「課程名稱 · 第 1 課」 */
  kicker: string
  title: string
  /** 頁面標題(document.title 的頁面名稱) */
  docTitle: string
  /** 「回課程總覽」這類返回連結 */
  back: { to: string; label: string }
  /** 未登入時的說明 */
  note: string
  children: ReactNode
}

export function LoginGate({ kicker, title, docTitle, back, note, children }: Props) {
  const { status, checkFailed } = useAuth()
  const { pathname, search } = useLocation()
  // 訪客看到登入門檻也記一筆(gate:<網址>),後台看得出有多少人卡在這裡
  useGuestView(status === 'guest' && !checkFailed ? GATE_PREFIX + pathname : null, () => false)
  if (status === 'user' || status === 'disabled') return <>{children}</>

  return (
    <SiteLayout title={docTitle}>
      <div className={styles.container}>
        <p className={styles.kicker}>{kicker}</p>
        <h1>{title}</h1>
        {/* 確認登入狀態前只留標題,已登入的人不會閃過登入提示 */}
        {checkFailed && (
          <>
            <p className={styles.note}>暫時無法確認登入狀態，請重新整理再試一次。</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
                重新整理
              </button>
              <Link to={back.to}>{back.label}</Link>
            </div>
          </>
        )}
        {status === 'guest' && !checkFailed && (
          <>
            <p className={styles.note}>{note}</p>
            <div className={styles.actions}>
              <Link className={styles.primary} to={loginHref(pathname + search)}>
                登入或註冊
              </Link>
              <Link to={back.to}>{back.label}</Link>
            </div>
          </>
        )}
      </div>
    </SiteLayout>
  )
}
