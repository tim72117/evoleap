import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { loginHref } from './paths'
import { MEMBER_PATH } from '../member/paths'
import styles from './UserMenu.module.css'

// 頁首的登入狀態小工具:未登入顯示「登入」連結,已登入顯示頭像 + 名稱,點開可進會員空間或登出。

export function UserMenu() {
  const { status, user, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  // 換頁時關閉
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    // 開啟後把焦點移到第一個選項
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (status === 'disabled') return null
  if (status === 'loading') return <span className={styles.skeleton} aria-hidden="true" />

  if (status === 'guest' || !user) {
    const here = location.pathname + location.search + location.hash
    return (
      <Link className={styles.login} to={loginHref(here)}>
        登入
      </Link>
    )
  }

  const display = user.name || user.email.split('@')[0]
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase()

  return (
    <div
      className={styles.root}
      ref={rootRef}
      onBlur={(e) => {
        // 焦點移出整個元件時關閉(Tab 離開)
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`帳號選單:${display}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initial}
        </span>
        <span className={styles.name}>{display}</span>
        <svg className={styles.caret} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          ref={menuRef}
          className={styles.menu}
          role="menu"
          aria-label="帳號"
          onKeyDown={(e) => {
            // 選單項目之間用上下鍵、Home／End 移動(WAI-ARIA menu)
            const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
            const i = items.indexOf(document.activeElement as HTMLElement)
            const to = e.key === 'ArrowDown' ? (i + 1) % items.length : e.key === 'ArrowUp' ? (i - 1 + items.length) % items.length : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1
            if (to < 0 || !items.length) return
            e.preventDefault()
            items[to].focus()
          }}
        >
          <div className={styles.identity}>
            {user.name ? <strong>{user.name}</strong> : null}
            <span>{user.email}</span>
          </div>
          {/* 已經在會員空間時網址不變,換頁時關閉的效果不會觸發,點了也要關 */}
          <Link role="menuitem" className={styles.item} to={MEMBER_PATH} onClick={() => setOpen(false)}>
            會員空間
          </Link>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await logout()
              setBusy(false)
              setOpen(false)
            }}
          >
            {busy ? '登出中…' : '登出'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
