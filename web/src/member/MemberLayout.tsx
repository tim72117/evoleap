import { useRef, type ReactNode } from 'react'
import { Link, Navigate, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { loginHref } from '../auth/paths'
import { SOFTWARE_TOPIC } from '../content/topics'
import { SiteLayout } from '../site/SiteLayout'
import { useT } from '../i18n/I18nProvider'
import { MEMBER_SECTIONS, memberSectionLabel, memberSectionTitle, type MemberSection } from './sections'
import styles from './member.module.css'

// 會員空間的外框:沒登入導去登入頁(登入後回到這裡),在會員空間裡登出則回首頁;已登入顯示會員卡與分頁列,內容由各分頁提供。

export function MemberLayout({ section, children }: { section: MemberSection; children: ReactNode }) {
  // 會員空間一律看真實的登入狀態:管理員模擬訪客時,這裡仍要讓他看到自己的資料與切換身分的膠囊
  const { real, checkFailed, expired } = useAuth()
  const { status, user } = real
  const location = useLocation()
  const t = useT()
  const m = t.member
  // 在這裡按登出(本來是會員、後來變訪客)回首頁;登入過期(API 回 401)或一開始就沒登入才導去登入頁,登入後回到這裡
  const wasUser = useRef(false)
  if (status === 'user') wasUser.current = true
  const here = location.pathname + location.search

  // 啟動時確認登入狀態失敗(網路或 API 暫時錯誤):不確定是不是真的沒登入,先不導頁,讓人重試
  const unsure = status === 'guest' && checkFailed && !wasUser.current
  if (status === 'guest' && !unsure) return <Navigate to={wasUser.current && !expired ? '/' : loginHref(here)} replace />

  return (
    <SiteLayout title={memberSectionTitle(section, t)} narrow>
      {unsure ? (
        <div className={styles.panel}>
          <h1 className={styles.panelTitle}>{m.unsureTitle}</h1>
          <p className={styles.muted}>{m.unsureText}</p>
          <div className={styles.formActions}>
            <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
              {m.reload}
            </button>
            <Link className={styles.secondary} to={loginHref(here)}>
              {m.toLogin}
            </Link>
          </div>
        </div>
      ) : status === 'loading' ? (
        <div className={styles.panel} aria-busy="true">
          <p className={styles.muted}>{m.loading}</p>
        </div>
      ) : status === 'disabled' || !user ? (
        <div className={styles.panel}>
          <h1 className={styles.panelTitle}>{m.disabledTitle}</h1>
          <p className={styles.muted}>{m.disabledText}</p>
          <Link className={styles.primary} to={`${SOFTWARE_TOPIC.path}#map`}>
            {m.toCourseMap}
          </Link>
        </div>
      ) : (
        <div className={styles.wrap}>
          <header className={styles.hero}>
            <span className={styles.avatar} aria-hidden="true">
              {(user.name || user.email).trim().charAt(0).toUpperCase()}
            </span>
            <div className={styles.heroText}>
              <h1 className={styles.heroTitle}>{m.title}</h1>
              <p className={styles.heroName}>{user.name || user.email.split('@')[0]}</p>
            </div>
          </header>

          {MEMBER_SECTIONS.length > 1 ? (
            <nav className={styles.tabs} aria-label={m.title}>
              {MEMBER_SECTIONS.map((s) => (
                <NavLink key={s.id} to={s.path} end className={({ isActive }) => (isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab)}>
                  {memberSectionLabel(s, t)}
                </NavLink>
              ))}
            </nav>
          ) : null}

          {children}
        </div>
      )}
    </SiteLayout>
  )
}
