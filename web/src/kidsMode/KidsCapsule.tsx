import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MEMBER_PATH } from '../member/paths'
import styles from '../auth/UserMenu.module.css'
import kids from './KidsCapsule.module.css'
import { SimulationMenuItems } from '../auth/SimulationMenuItems'
import { useKidsMode } from './KidsModeContext'
import { useT } from '../i18n/I18nProvider'

// 兒童模式時,頁首右上角的膠囊頭像換成兒童(暱稱);按下後可以離開兒童模式,回到家長的會員空間。
// 外觀沿用帳號選單(auth/UserMenu)。粗略版離開不用家長確認(待決定,見研發基地 /studio/kids-family)。

export function KidsCapsule({ name, avatar }: { name: string; avatar: string }) {
  const { stop } = useKidsMode()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const k = useT().kidsMode

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={k.capsuleLabel(name)}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`${styles.avatar} ${kids.emoji}`} aria-hidden="true">
          {avatar || ([...name][0] ?? k.avatarFallback)}
        </span>
        <span className={styles.name}>{name}</span>
        <svg className={styles.caret} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div id={menuId} className={styles.menu} role="menu" aria-label={k.menuLabel}>
          <div className={styles.identity}>
            <strong>
              {avatar} {name}
            </strong>
            <span>{k.active}</span>
          </div>
          {/* 管理員模擬兒童模式時:可以直接換成別的身分 */}
          <SimulationMenuItems onPick={() => setOpen(false)} />
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await stop()
                navigate(`${MEMBER_PATH}/kids`)
              } finally {
                setBusy(false)
                setOpen(false)
              }
            }}
          >
            {busy ? k.leaving : k.leave}
          </button>
        </div>
      ) : null}
    </div>
  )
}
