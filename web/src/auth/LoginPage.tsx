import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { ApiError, authApi, type User } from './api'
import { useAuth } from './AuthContext'
import { LOGIN_PATH, safeNextPath } from './paths'
import { PAGE_PREFIX, useGuestView } from '../courses/guestActivity'
import styles from './LoginPage.module.css'
import { SOFTWARE_TOPIC } from '../content/topics'

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

  // 訪客打開登入頁也記一筆(page:/login):從哪一課被帶過來(next)、登入失敗的訊息;登入成功由伺服器記(store.NoteGuestLogin)
  const guest = useGuestView(PAGE_PREFIX + LOGIN_PATH, () => false)
  useEffect(() => {
    if (next !== '/') guest.note(`next:${next}`)
  }, [guest, next])

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
            <Link className={styles.submit} to={`${SOFTWARE_TOPIC.path}#map`}>
              前往課程地圖
            </Link>
          </div>
        ) : status === 'user' && user ? (
          <SignedIn user={user} next={next} onLogout={logout} />
        ) : (
          <AuthForm
            onSignedIn={onSignedIn}
            onFail={(message) => guest.note(`fail:${message}`)}
            // Google 登入按鈕從打開登入頁到畫好花了多久、載入失敗的原因(記在這筆紀錄的載入時間與載入錯誤)
            onGoogleReady={guest.ready}
            onGoogleError={guest.fail}
          />
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
          <Link className={styles.primary} to={`${SOFTWARE_TOPIC.path}#map`}>
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

/** onFail:登入或註冊失敗時顯示的訊息(訪客紀錄用,不含輸入的內容);onGoogleReady／onGoogleError:Google 登入按鈕畫好／載入失敗 */
export function AuthForm({
  onSignedIn,
  onFail,
  onGoogleReady,
  onGoogleError,
  subtitle,
  titleAs: Title = 'h1',
}: {
  /** 標題的標籤(登入視窗開在別的頁面上,頁面本身已有 h1,視窗裡用 h2) */
  titleAs?: 'h1' | 'h2'
  /** 說明文字(換掉預設的「歡迎回來…」,登入視窗用來說明為什麼要登入) */
  subtitle?: string
  onSignedIn: (u: User) => void
  onFail: (message: string) => void
  onGoogleReady: () => void
  onGoogleError: (message: string) => void
}) {
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
      onFail('請輸入 Email')
      return
    }
    if (isRegister && password.length < 8) {
      setError('密碼至少需要 8 個字元')
      onFail('密碼至少需要 8 個字元')
      return
    }
    if (!password) {
      setError('請輸入密碼')
      onFail('請輸入密碼')
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
      onFail(errorMessage(err))
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
      onFail(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.card}>
      <Title className={styles.title}>{isRegister ? '建立帳號' : '登入'}</Title>
      <p className={styles.subtitle}>{subtitle ?? (isRegister ? '註冊後即可記錄你的學習進度。' : '歡迎回來，登入以繼續你的課程。')}</p>

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
              onReady={onGoogleReady}
              onError={(reason) => {
                setError('無法載入 Google 登入，請改用 Email 或稍後再試')
                onGoogleError(reason)
              }}
              // 只是太久沒偵測到按鈕畫好:記下來就好,不在畫面上顯示錯誤(按鈕可能其實是好的)
              onSlow={onGoogleError}
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
  onReady,
  onError,
  onSlow,
}: {
  clientId: string
  text: 'signin_with' | 'signup_with'
  onCredential: (credential: string) => void
  /** 按鈕畫好(Google 的按鈕 iframe 載入完成) */
  onReady: () => void
  /** 載入失敗(Google 登入程式載不到);reason 是原因 */
  onError: (reason: string) => void
  /** 20 秒內沒偵測到按鈕畫好(只記錄,不當成載入失敗顯示給使用者) */
  onSlow: (reason: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // GSI 會保存 callback;透過 ref 取得最新的處理函式
  const handlers = useRef({ onCredential, onReady, onError, onSlow })
  useEffect(() => {
    handlers.current = { onCredential, onReady, onError, onSlow }
  })

  // 按鈕畫好的時間:renderButton 之後 Google 會放進 iframe,任一個 iframe 載入完成就算畫好
  // (每個新出現的 iframe 都聽:切換登入／註冊時按鈕重畫,原本的 iframe 會被換掉);20 秒內沒偵測到只記錄
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let done = false
    const finish = (ok: boolean): void => {
      if (done) return
      done = true
      mo.disconnect()
      window.clearTimeout(timer)
      if (ok) handlers.current.onReady()
      else handlers.current.onSlow('Google 登入按鈕 20 秒內沒有偵測到畫好')
    }
    const seen = new WeakSet<HTMLIFrameElement>()
    const watch = (): void => {
      for (const frame of el.querySelectorAll('iframe')) {
        if (seen.has(frame)) continue
        seen.add(frame)
        frame.addEventListener('load', () => finish(true), { once: true })
      }
    }
    const mo = new MutationObserver(watch)
    mo.observe(el, { childList: true, subtree: true })
    const timer = window.setTimeout(() => finish(false), 20_000)
    return () => {
      done = true
      mo.disconnect()
      window.clearTimeout(timer)
    }
  }, [])

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
        if (!cancelled) handlers.current.onError('Google 登入程式載入失敗')
      })
    return () => {
      cancelled = true
    }
  }, [clientId, text])

  return <div ref={ref} className={styles.google} />
}
