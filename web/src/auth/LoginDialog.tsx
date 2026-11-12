import { useLayoutEffect, useRef } from 'react'
import type { GuestReporter } from '../courses/guestActivity'
import type { User } from './api'
import { AuthForm } from './LoginPage'
import styles from './LoginDialog.module.css'

// 小的登入視窗:要登入才能看的頁面(LoginGate)不轉到登入頁,直接在原頁面上登入;登入成功後呼叫 onSignedIn,頁面自己換成內容。
// 用原生 <dialog>(showModal):背景不能操作、焦點留在視窗裡、Esc 關閉;點視窗外或右上角的 ✕ 也能關。
// 只在打開時才畫表單(不先載入 Google 登入程式)。
export function LoginDialog({
  open,
  onClose,
  onSignedIn,
  subtitle,
  guest,
}: {
  open: boolean
  onClose: () => void
  onSignedIn: (u: User) => void
  subtitle?: string
  /** 訪客紀錄:登入失敗的訊息、Google 登入程式載入失敗記成備註(不記載入時間:門檻那筆紀錄的載入時間照舊不算) */
  guest?: Pick<GuestReporter, 'note'>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  // layout effect:要在表單裡的 Google 按鈕量寬度之前就已經顯示出來
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      // 有滑鼠的裝置直接停在 Email 欄(手機不聚焦,免得鍵盤一跳出來就蓋住視窗)
      if (window.matchMedia('(pointer: fine)').matches) el.querySelector<HTMLInputElement>('input[type="email"]')?.focus()
    }
    if (!open && el.open) el.close()
  }, [open])
  // 在視窗裡按下、拖到視窗外才放開(例如選取輸入框的文字)時,click 的目標會變成 dialog 本身:要按下和放開都在背景上才算點背景
  const downOnBackdrop = useRef(false)

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label="登入"
      onClose={onClose}
      // 點到視窗外(背景)才關:點視窗裡面的目標不是 dialog 本身
      onMouseDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => e.target === e.currentTarget && downOnBackdrop.current && onClose()}
    >
      {open && (
        <div className={styles.body}>
          <AuthForm
            titleAs="h2"
            subtitle={subtitle}
            onSignedIn={onSignedIn}
            onFail={(message) => guest?.note(`fail:${message}`)}
            onGoogleReady={() => {}}
            onGoogleError={(message) => guest?.note(`google:${message}`)}
          />
          {/* 關閉鈕放在表單後面(用 CSS 定位在右上角):開啟時焦點不會落在它身上,按 Enter 也不會不小心關掉 */}
          <button type="button" className={styles.close} aria-label="關閉" onClick={onClose}>
            ✕
          </button>
        </div>
      )}
    </dialog>
  )
}
