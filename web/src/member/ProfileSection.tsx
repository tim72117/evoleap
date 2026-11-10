import { useId, useState, type FormEvent } from 'react'
import { ApiError, authApi } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { nameProblem, NAME_MAX } from './name'
import styles from './member.module.css'

// 會員空間「帳號」分頁:帳號資訊與可修改的個人資料(顯示名稱)放在同一個區塊,另有登出。Email 是登入用的帳號,不在這裡改。

const joinedFormat = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })

function joinedText(createdAt: string): string {
  const d = new Date(createdAt)
  return Number.isNaN(d.getTime()) ? '—' : joinedFormat.format(d)
}

export function ProfileSection() {
  const { real, setUser, logout, sessionExpired } = useAuth()
  const user = real.user
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const ids = useId()

  if (!user) return null

  const trimmed = name.trim()
  const length = [...trimmed].length
  const changed = trimmed !== user.name
  const tooLong = length > NAME_MAX

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving || !changed) return
    setSaved(false)
    if (!trimmed) {
      setError('請輸入名稱')
      return
    }
    if (tooLong) {
      setError(`名稱最多 ${NAME_MAX} 個字`)
      return
    }
    const invalid = nameProblem(trimmed)
    if (invalid) {
      setError(invalid)
      return
    }
    setError('')
    setSaving(true)
    try {
      const updated = await authApi.updateProfile({ name: trimmed })
      setUser(updated)
      // 儲存中輸入框是唯讀的,這裡換成伺服器整理過的名稱(去掉前後空白)
      setName(updated.name)
      setSaved(true)
    } catch (err) {
      // 登入過期或在別處登出:回到訪客狀態,會員空間會導去登入頁,登入後回到這裡
      if (err instanceof ApiError && err.status === 401) {
        sessionExpired()
        return
      }
      setError(err instanceof ApiError ? err.message : '連線失敗，請檢查網路後再試一次')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className={styles.panel} aria-labelledby={`${ids}-account`}>
        <h2 id={`${ids}-account`} className={styles.panelTitle}>
          帳號與個人資料
        </h2>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor={`${ids}-name`}>顯示名稱</label>
            <input
              id={`${ids}-name`}
              type="text"
              autoComplete="nickname"
              value={name}
              readOnly={saving}
              aria-invalid={!!error || tooLong || undefined}
              aria-describedby={`${ids}-name-hint`}
              onChange={(e) => {
                setName(e.target.value)
                setSaved(false)
                setError('')
              }}
            />
            <p id={`${ids}-name-hint`} className={tooLong ? styles.hintError : styles.hint}>
              顯示在頁首的帳號選單，最多 {NAME_MAX} 個字（{length}/{NAME_MAX}）
            </p>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.formActions}>
            <button type="submit" className={styles.primary} disabled={saving || !changed}>
              {saving ? '儲存中…' : '儲存'}
            </button>
            {saved ? (
              <span className={styles.saved} role="status">
                已儲存
              </span>
            ) : null}
          </div>
        </form>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className={styles.fact}>
            <dt>登入方式</dt>
            <dd>{user.google ? 'Google 帳號' : 'Email 與密碼'}</dd>
          </div>
          <div className={styles.fact}>
            <dt>加入日期</dt>
            <dd>{joinedText(user.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.panel} aria-labelledby={`${ids}-session`}>
        <h2 id={`${ids}-session`} className={styles.panelTitle}>
          登出
        </h2>
        <p className={styles.muted}>在這台裝置上登出。之後要記錄播放進度時再登入即可。</p>
        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true)
              await logout()
            }}
          >
            {loggingOut ? '登出中…' : '登出'}
          </button>
        </div>
      </section>
    </>
  )
}
