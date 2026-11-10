import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { SiteLayout } from '../site/SiteLayout'
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

  useEffect(() => {
    if (!id) return setState({ kind: 'error', message: '網址少了登入要求的代碼，請在終端機重新執行 evoleap login --web。' })
    authApi
      .cliAuthName(id)
      .then((name) => setState({ kind: 'ready', name }))
      .catch((e: unknown) => setState({ kind: 'error', message: e instanceof ApiError ? e.message : '讀不到登入要求，請稍後再試。' }))
  }, [id])

  const approve = () => {
    setState({ kind: 'approving' })
    authApi
      .cliAuthApprove(id)
      .then((redirect) => window.location.assign(redirect))
      .catch((e: unknown) => setState({ kind: 'error', message: e instanceof ApiError ? e.message : '核准失敗，請稍後再試。' }))
  }

  let body
  if (state.kind === 'error') body = <p className={styles.error}>{state.message}</p>
  else if (state.kind === 'loading' || status === 'loading') body = <p className={styles.loading}>讀取中…</p>
  else if (!user)
    body = (
      <p className={styles.subtitle}>
        要先<Link to={loginHref(pathname + search)}>登入</Link>，才能核准。
      </p>
    )
  else if (!user.isAdmin) body = <p className={styles.error}>只有管理員可以核准 evoleap CLI 登入。</p>
  else
    body = (
      <>
        <p className={styles.subtitle}>
          {state.kind === 'ready' ? state.name : 'evoleap CLI'} 想用你的帳號（{user.email}）登入，之後可以修改正式環境的課程資料。
          如果這不是你剛剛在終端機執行的，請關掉這一頁。
        </p>
        <button type="button" className={styles.submit} disabled={state.kind === 'approving'} onClick={approve}>
          {state.kind === 'approving' ? '核准中…' : '核准'}
        </button>
      </>
    )

  return (
    <SiteLayout title="核准 evoleap CLI 登入">
      <div className={styles.wrap}>
        <section className={styles.card}>
          <h1 className={styles.title}>核准 evoleap CLI 登入</h1>
          {body}
        </section>
      </div>
    </SiteLayout>
  )
}
