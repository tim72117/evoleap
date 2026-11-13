import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
import { useT } from '../i18n/I18nProvider'
import { ApiError, authApi } from './api'
import { useAuth } from './AuthContext'
import { loginHref } from './paths'
import styles from './LoginPage.module.css'

// evoleap CLI 的登入核准頁(/login/cli?id=…,evoleap login --web 會打開這裡;流程見 server/internal/store/cliauth.go)。
// 只有管理員能核准:按下核准後伺服器簽發 token,瀏覽器被導回 CLI 在本機開的網址,CLI 再用同一個 id 換 token。
// 網址上只有這個一次性的 id,沒有 token,也沒有要導去哪裡(那是 CLI 登記時伺服器記下的本機網址)。

type State = { kind: 'loading' } | { kind: 'ready'; name: string } | { kind: 'error'; message: string } | { kind: 'approving' }

export function CliAuthPage() {
  const [params] = useSearchParams()
  const id = params.get('id') ?? ''
  const { status, user } = useAuth()
  const { pathname, search } = useLocation()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const t = useT()
  const c = t.auth.cli

  useEffect(() => {
    if (!id) return setState({ kind: 'error', message: c.missingId })
    authApi
      .cliAuthName(id)
      .then((name) => setState({ kind: 'ready', name }))
      .catch((e: unknown) => setState({ kind: 'error', message: e instanceof ApiError ? e.message : c.loadFailed }))
    // 只在換了要求的代碼時重讀;語言切換不重讀
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const approve = () => {
    setState({ kind: 'approving' })
    authApi
      .cliAuthApprove(id)
      .then((redirect) => window.location.assign(redirect))
      .catch((e: unknown) => setState({ kind: 'error', message: e instanceof ApiError ? e.message : c.approveFailed }))
  }

  let body
  if (state.kind === 'error') body = <p className={styles.error}>{state.message}</p>
  else if (state.kind === 'loading' || status === 'loading') body = <p className={styles.loading}>{c.loading}</p>
  else if (!user)
    body = (
      <p className={styles.subtitle}>
        {c.loginFirstPrefix}
        <Link to={loginHref(pathname + search)}>{c.loginLink}</Link>
        {c.loginFirstSuffix}
      </p>
    )
  else if (!user.isAdmin) body = <p className={styles.error}>{c.adminOnly}</p>
  else
    body = (
      <>
        <p className={styles.subtitle}>
          {c.request(state.kind === 'ready' ? state.name : 'evoleap CLI', user.email)}
        </p>
        <button type="button" className={styles.submit} disabled={state.kind === 'approving'} onClick={approve}>
          {state.kind === 'approving' ? c.approving : c.approve}
        </button>
      </>
    )

  return (
    <SiteLayout title={c.title}>
      <div className={styles.wrap}>
        <section className={styles.card}>
          <h1 className={styles.title}>{c.title}</h1>
          {body}
        </section>
      </div>
    </SiteLayout>
  )
}
