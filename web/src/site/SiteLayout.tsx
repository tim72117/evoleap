import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useCanSeeStudio } from '../auth/AuthContext'
import { UserMenu } from '../auth/UserMenu'
import styles from './SiteLayout.module.css'
import { documentTitle, SITE_NAME, SITE_TAGLINE } from './siteInfo'
import { COURSE_LIST, SOFTWARE_TOPIC } from '../content/topics'

type NavItem = { label: string; to: string; end?: boolean }

const NAV: NavItem[] = [
  { label: '首頁', to: '/', end: true },
  { label: COURSE_LIST.name, to: COURSE_LIST.path, end: true },
  // 訂閱方案的入口直接顯示,不用環境變數開關;還沒設定 Paddle 時收費頁會顯示「即將開放訂閱」
  { label: '訂閱方案', to: '/pricing', end: true },
]

type Props = {
  /** Page name for the document title ("<title> · evoleap"); omit on the home page. */
  title?: string
  /** Constrain main content to a readable column (docs). Home page uses full width sections. */
  narrow?: boolean
  children: ReactNode
}

const THEME_KEY = 'site:theme'
const readDark = (): boolean => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark'
  } catch {
    return false
  }
}

const SUN = 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'
const MOON = 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'

export function SiteLayout({ title, narrow = false, children }: Props) {
  // 亮/暗色是全站共用的偏好:每一頁都讀同一個設定,換頁不會閃回亮色
  const [dark, setDark] = useState(readDark)
  const canSeeStudio = useCanSeeStudio()

  useEffect(() => {
    document.title = documentTitle(title)
  }, [title])

  // <html> 也跟著換底色與 color-scheme,捲過頭露出的底和捲軸才不會是亮的;離開學員頁(例如 /studio)時拿掉
  useEffect(() => {
    const root = document.documentElement
    root.dataset.siteTheme = dark ? 'dark' : 'light'
    return () => {
      delete root.dataset.siteTheme
    }
  }, [dark])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
    } catch {
      /* 私密模式等情況 */
    }
  }

  return (
    <div className={dark ? `${styles.site} ${styles.dark}` : styles.site} lang="zh-Hant">
      <a className={styles.skip} href="#main">
        跳到主要內容
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} to="/">
            <img className={styles.brandLogo} src={dark ? '/brand/evoleap-logo-dark.svg' : '/brand/evoleap-logo.svg'} alt="evoleap" width="110" height="32" />
            <span className={styles.brandTagline}>{SITE_TAGLINE}</span>
          </Link>
          <nav className={styles.nav} aria-label="主要導覽">
            {NAV.map((item) => (
              <NavLink key={item.label} to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={dark ? '切換成亮色' : '切換成暗色'}
            title={dark ? '切換成亮色' : '切換成暗色'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={dark ? SUN : MOON} />
            </svg>
          </button>
          <UserMenu />
        </div>
      </header>

      <main id="main" className={narrow ? `${styles.main} ${styles.narrow}` : styles.main}>
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <strong>{SITE_NAME}</strong>：{SITE_TAGLINE}
          </div>
          <nav className={styles.footerNav} aria-label="頁尾導覽">
            <Link to={`${SOFTWARE_TOPIC.path}#map`}>課程地圖</Link>
            <Link to="/courses/ai-agent">AI Agent 整合應用</Link>
          </nav>
          <div className={styles.domain}>
            <Link className={styles.devLink} to="/privacy">
              隱私權政策
            </Link>
            <Link className={styles.devLink} to="/terms">
              服務條款
            </Link>
            <Link className={styles.devLink} to="/refund">
              退款政策
            </Link>
            {canSeeStudio && (
              <Link className={styles.devLink} to="/studio">
                研發基地
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
