import { useId, useState, type FormEvent } from 'react'
import { ApiError, authApi } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { formatDate, useLocale, useT } from '../i18n/I18nProvider'
import { isLocale, LOCALES, type Locale } from '../i18n/locale'
import { nameProblem, NAME_MAX } from './name'
import styles from './member.module.css'

// 會員空間「帳號」分頁:帳號資訊與可修改的個人資料(顯示名稱)放在同一個區塊,另有登出。Email 是登入用的帳號,不在這裡改。

function joinedText(createdAt: string, locale: Locale): string {
  const d = new Date(createdAt)
  return Number.isNaN(d.getTime()) ? '—' : formatDate(d, locale)
}

/** 語言選單:每個語言用它自己的寫法顯示(不跟著介面語言翻) */
const LOCALE_NAMES: Record<Locale, string> = { 'zh-Hant': '繁體中文', en: 'English' }

export function ProfileSection() {
  const { real, setUser, logout, sessionExpired } = useAuth()
  const user = real.user
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const ids = useId()
  const t = useT()
  const p = t.member.profile
  const { locale, setLocale } = useLocale()

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
      setError(p.nameRequired)
      return
    }
    if (tooLong) {
      setError(p.nameTooLong(NAME_MAX))
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
      setError(err instanceof ApiError ? err.message : t.member.networkError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className={styles.panel} aria-labelledby={`${ids}-account`}>
        <h2 id={`${ids}-account`} className={styles.panelTitle}>
          {p.title}
        </h2>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor={`${ids}-name`}>{p.displayName}</label>
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
              {p.nameHint(NAME_MAX, length)}
            </p>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.formActions}>
            <button type="submit" className={styles.primary} disabled={saving || !changed}>
              {saving ? p.saving : p.save}
            </button>
            {saved ? (
              <span className={styles.saved} role="status">
                {p.saved}
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
            <dt>{p.signInMethod}</dt>
            <dd>{user.google ? p.google : p.emailPassword}</dd>
          </div>
          <div className={styles.fact}>
            <dt>{p.joined}</dt>
            <dd>{joinedText(user.createdAt, locale)}</dd>
          </div>
        </dl>
        {/* 介面語言:選了馬上換,記在這個瀏覽器並存進帳號(I18nProvider 的 setLocale) */}
        <div className={`${styles.field} ${styles.language}`}>
          <label htmlFor={`${ids}-locale`}>{p.language}</label>
          <select
            id={`${ids}-locale`}
            value={locale}
            aria-describedby={`${ids}-locale-hint`}
            onChange={(e) => {
              if (isLocale(e.target.value)) setLocale(e.target.value)
            }}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </select>
          <p id={`${ids}-locale-hint`} className={styles.hint}>
            {p.languageHint}
          </p>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby={`${ids}-session`}>
        <h2 id={`${ids}-session`} className={styles.panelTitle}>
          {p.signOutTitle}
        </h2>
        <p className={styles.muted}>{p.signOutText}</p>
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
            {loggingOut ? p.signingOut : p.signOut}
          </button>
        </div>
      </section>
    </>
  )
}
