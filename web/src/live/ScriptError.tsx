import { Link, useLocation } from 'react-router-dom'
import { loginHref } from '../auth/paths'
import { LOGIN_REQUIRED } from './scripts'

/** 播放器載不到腳本時的訊息;要登入的情況加上登入連結(登入後回到這一頁) */
export function ScriptError({ className, prefix, error }: { className?: string; prefix: string; error: string }) {
  const { pathname } = useLocation()
  return (
    <p className={className} role="alert">
      {prefix}
      {error}
      {error === LOGIN_REQUIRED && (
        <>
          {' '}
          <Link to={loginHref(pathname)}>登入</Link>
        </>
      )}
    </p>
  )
}
