import { Link, useLocation } from 'react-router-dom'
import { loginHref } from '../auth/paths'
import { useT } from '../i18n/I18nProvider'
import { isLoginRequired } from './scripts'

/** 播放器載不到腳本時的訊息;要登入的情況加上登入連結(登入後回到這一頁) */
export function ScriptError({ className, prefix, error }: { className?: string; prefix: string; error: string }) {
  const { pathname } = useLocation()
  const t = useT()
  return (
    <p className={className} role="alert">
      {prefix}
      {error}
      {isLoginRequired(error) && (
        <>
          {' '}
          <Link to={loginHref(pathname)}>{t.common.signIn}</Link>
        </>
      )}
    </p>
  )
}
