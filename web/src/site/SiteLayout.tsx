import { useEffect, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { UserMenu } from '../auth/UserMenu'
import styles from './SiteLayout.module.css'
import { documentTitle, SITE_NAME, SITE_TAGLINE } from './siteInfo'
import { SOFTWARE_TOPIC } from '../content/topics'

type NavItem = { label: string; to: string | { pathname: string; hash: string }; end?: boolean }

const NAV: NavItem[] = [
  { label: '首頁', to: '/', end: true },
  { label: '課程地圖', to: { pathname: SOFTWARE_TOPIC.path, hash: 'map' } },
]

type Props = {
  /** Page name for the document title ("<title> · Vibe Coding 實戰"); omit on the home page. */
  title?: string
  /** Constrain main content to a readable column (docs). Home page uses full width sections. */
  narrow?: boolean
  children: ReactNode
}

export function SiteLayout({ title, narrow = false, children }: Props) {
  useEffect(() => {
    document.title = documentTitle(title)
  }, [title])

  return (
    <div className={styles.site} lang="zh-Hant">
      <a className={styles.skip} href="#main">
        跳到主要內容
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} to="/">
            <span className={styles.brandMark} aria-hidden="true">
              VC
            </span>
            <span className={styles.brandText}>
              {SITE_NAME}
              <small>{SITE_TAGLINE}</small>
            </span>
          </Link>
          <nav className={styles.nav} aria-label="主要導覽">
            {NAV.map((item) =>
              typeof item.to === 'string' ? (
                <NavLink key={item.label} to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              ) : (
                // Hash link: not an active route of its own, so a plain Link.
                <Link key={item.label} to={item.to}>
                  {item.label}
                </Link>
              ),
            )}
          </nav>
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
            <Link className={styles.devLink} to="/proposal">
              課程提案
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
