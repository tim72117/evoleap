import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { ApiError, authApi, type User } from './api'
import { useAuth } from './AuthContext'
import { safeNextPath } from './paths'
import styles from './LoginPage.module.css'

// 登入／註冊頁:Google 登入(有設定 client ID 時)+ Email 密碼。

type Mode = 'login' | 'register'

const GSI_SRC = 'https://accounts.google.com/gsi/client'
let gsiPromise: Promise<void> | null = null

/** 第一次需要時才載入 Google Identity Services script */
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!gsiPromise) {
    gsiPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = GSI_SRC
      s.async = true
      s.defer = true
      s.onload = () => resolve()
      s.onerror = () => {
        gsiPromise = null
        s.remove()
        reject(new Error('gsi load failed'))
      }
      document.head.appendChild(s)
    })
  }
  return gsiPromise
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return '連線失敗，請檢查網路後再試一次'
}

export function LoginPage() {
  const { status, user, setUser, logout } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNextPath(params.get('next'))
  // 剛在本頁完成登入時不顯示「你已登入」畫面,直接導頁
  const [justSignedIn, setJustSignedIn] = useState(false)

  const onSignedIn = (u: User) => {
    setJustSignedIn(true)
    setUser(u)
    navigate(next, { replace: true })
  }

  return (
    <SiteLayout title="登入" narrow>
      <div className={styles.wrap}>
        {status === 'loading' || justSignedIn ? (
          <div className={styles.card} aria-busy="true">
            <p className={styles.loading}>載入中…</p>
          </div>
        ) : status === 'disabled' ? (
          <div className={styles.card}>
            <h1 className={styles.title}>登入功能尚未開放</h1>
            <p className={styles.subtitle}>目前所有公開課程都不需要登入，可以直接開始學習。</p>
            <Link className={styles.submit} to="/#map">
              前往課程地圖
            </Link>
          </div>
        ) : status === 'user' && user ? (
          <SignedIn user={user} next={next} onLogout={logout} />
        ) : (
          <AuthForm onSignedIn={onSignedIn} />
        )}
      </div>
    </SiteLayout>
  )
}

function SignedIn({ user, next, onLogout }: { user: User; next: string; onLogout: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className={styles.card}>
      <div className={styles.avatar} aria-hidden="true">
        {(user.name || user.email).trim().charAt(0).toUpperCase()}
      </div>
      <h1 className={styles.title}>你已登入</h1>
      <p className={styles.signedInText}>
        你已登入為 <strong>{user.name || user.email}</strong>
        {user.name ? <span className={styles.signedInEmail}>{user.email}</span> : null}
      </p>
      <div className={styles.actions}>
        {next === '/' ? (
          <Link className={styles.primary} to={{ pathname: '/', hash: 'map' }}>
            前往課程地圖
          </Link>
        ) : (
          <Link className={styles.primary} to={next}>
            繼續前往
          </Link>
        )}
        <button
          type="button"
          className={styles.secondary}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onLogout()
            setBusy(false)
          }}
        >
          {busy ? '登出中…' : '登出'}
        </button>
      </div>
    </div>
  )
}

function AuthForm({ onSignedIn }: { onSignedIn: (u: User) => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [googleClientId, setGoogleClientId] = useState('')
  const ids = useId()
  const isRegister = mode === 'register'

  useEffect(() => {
    let cancelled = false
    authApi
      .config()
      .then((c) => {
        if (!cancelled) setGoogleClientId(c.googleClientId ?? '')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const switchMode = (m: Mode) => {
    setMode(m)
    setError('')
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    if (!email.trim()) {
      setError('請輸入 Email')
      return
    }
    if (isRegister && password.length < 8) {
      setError('密碼至少需要 8 個字元')
      return
    }
    if (!password) {
      setError('請輸入密碼')
      return
    }
    setSubmitting(true)
    try {
      const u = isRegister
        ? await authApi.register(email.trim(), password, name.trim())
        : await authApi.login(email.trim(), password)
      onSignedIn(u)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  const onGoogleCredential = async (credential: string) => {
    setError('')
    setSubmitting(true)
    try {
      onSignedIn(await authApi.google(credential))
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{isRegister ? '建立帳號' : '登入'}</h1>
      <p className={styles.subtitle}>{isRegister ? '註冊後即可記錄你的學習進度。' : '歡迎回來，登入以繼續你的課程。'}</p>

      <div className={styles.tabs} role="tablist" aria-label="登入或註冊">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`${ids}-tab-${m}`}
            aria-selected={mode === m}
            aria-controls={`${ids}-panel`}
            tabIndex={mode === m ? 0 : -1}
            className={styles.tab}
            onClick={() => switchMode(m)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault()
                const other: Mode = m === 'login' ? 'register' : 'login'
                switchMode(other)
                document.getElementById(`${ids}-tab-${other}`)?.focus()
              }
            }}
          >
            {m === 'login' ? '登入' : '註冊'}
          </button>
        ))}
      </div>

      <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-tab-${mode}`}>
        {googleClientId ? (
          <>
            <GoogleButton
              clientId={googleClientId}
              text={isRegister ? 'signup_with' : 'signin_with'}
              onCredential={onGoogleCredential}
              onError={() => setError('無法載入 Google 登入，請改用 Email 或稍後再試')}
            />
            <div className={styles.divider}>
              <span>或使用 Email</span>
            </div>
          </>
        ) : null}

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          {isRegister ? (
            <div className={styles.field}>
              <label htmlFor={`${ids}-name`}>
                名稱 <span className={styles.optional}>(選填)</span>
              </label>
              <input
                id={`${ids}-name`}
                name="name"
                type="text"
                autoComplete="name"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="想怎麼稱呼你？"
              />
            </div>
          ) : null}

          <div className={styles.field}>
            <label htmlFor={`${ids}-email`}>Email</label>
            <input
              id={`${ids}-email`}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor={`${ids}-password`}>密碼</label>
            <div className={styles.passwordRow}>
              <input
                id={`${ids}-password`}
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={isRegister ? 8 : undefined}
                aria-describedby={isRegister ? `${ids}-pwhint` : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className={styles.reveal}
                aria-pressed={showPassword}
                aria-controls={`${ids}-password`}
                aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? '隱藏' : '顯示'}
              </button>
            </div>
            {isRegister ? (
              <p id={`${ids}-pwhint`} className={styles.hint}>
                至少 8 個字元
              </p>
            ) : null}
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? (isRegister ? '註冊中…' : '登入中…') : isRegister ? '建立帳號' : '登入'}
          </button>
        </form>

        <p className={styles.switch}>
          {isRegister ? '已經有帳號了？' : '還沒有帳號？'}
          <button type="button" className={styles.linkButton} onClick={() => switchMode(isRegister ? 'login' : 'register')}>
            {isRegister ? '登入' : '免費註冊'}
          </button>
        </p>
      </div>

      <p className={styles.legal}>
        登入即表示你同意<Link to="/terms">服務條款</Link>與<Link to="/privacy">隱私權政策</Link>
      </p>
    </div>
  )
}

function GoogleButton({
  clientId,
  text,
  onCredential,
  onError,
}: {
  clientId: string
  text: 'signin_with' | 'signup_with'
  onCredential: (credential: string) => void
  onError: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // GSI 會保存 callback;透過 ref 取得最新的處理函式
  const handlers = useRef({ onCredential, onError })
  useEffect(() => {
    handlers.current = { onCredential, onError }
  })

  useEffect(() => {
    let cancelled = false
    loadGsi()
      .then(() => {
        const el = ref.current
        const gid = window.google?.accounts.id
        if (cancelled || !el || !gid) return
        gid.initialize({
          client_id: clientId,
          callback: (res) => handlers.current.onCredential(res.credential),
          cancel_on_tap_outside: true,
        })
        el.replaceChildren()
        // GSI 按鈕寬度上限 400px
        const width = Math.max(200, Math.min(400, Math.floor(el.getBoundingClientRect().width)))
        gid.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          width,
          locale: 'zh-TW',
          logo_alignment: 'center',
        })
      })
      .catch(() => {
        if (!cancelled) handlers.current.onError()
      })
    return () => {
      cancelled = true
    }
  }, [clientId, text])

  return <div ref={ref} className={styles.google} />
}
