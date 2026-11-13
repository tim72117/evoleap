import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { GATE_PREFIX, useGuestView } from './guestActivity'
import { LoginDialog } from '../auth/LoginDialog'
import { loginHref } from '../auth/paths'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from '../site/SiteLayout'
import styles from './LoginGate.module.css'

// 要登入才能看的單課頁:登入後才顯示內容。訪客不轉到登入頁,直接在原頁面彈出小的登入視窗(LoginDialog),登入成功後頁面自己換成內容;
// 關掉視窗後頁面上還有「登入或註冊」可以再打開(仍是連到登入頁的連結,不開 JS 或在新分頁開也能用)。「登入後免費」的課程與兒童課第二課以後都用它;課程總覽、課程地圖保持公開。
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
  const { status, checkFailed, setUser } = useAuth()
  const { pathname, search } = useLocation()
  // 登入視窗:訪客一到門檻就打開;關掉後按「登入或註冊」再開
  const [dialog, setDialog] = useState(true)
  const t = useT().courses.gate
  // 訪客看到登入門檻也記一筆(gate:<網址>),後台看得出有多少人卡在這裡
  const guest = useGuestView(status === 'guest' && !checkFailed ? GATE_PREFIX + pathname : null, () => false)
  if (status === 'user' || status === 'disabled') return <>{children}</>

  return (
    <SiteLayout title={docTitle}>
      <div className={styles.container}>
        <p className={styles.kicker}>{kicker}</p>
        <h1>{title}</h1>
        {/* 確認登入狀態前只留標題,已登入的人不會閃過登入提示 */}
        {checkFailed && (
          <>
            <p className={styles.note}>{t.checkFailed}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
                {t.reload}
              </button>
              <Link to={back.to}>{back.label}</Link>
            </div>
          </>
        )}
        {status === 'guest' && !checkFailed && (
          <>
            <p className={styles.note}>{note}</p>
            <div className={styles.actions}>
              <Link
                className={styles.primary}
                to={loginHref(pathname + search)}
                onClick={(e) => {
                  e.preventDefault()
                  setDialog(true)
                }}
              >
                {t.signInOrUp}
              </Link>
              <Link to={back.to}>{back.label}</Link>
            </div>
            <LoginDialog open={dialog} onClose={() => setDialog(false)} onSignedIn={setUser} subtitle={note} guest={guest} />
          </>
        )}
      </div>
    </SiteLayout>
  )
}
