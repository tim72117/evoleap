import { Link } from 'react-router-dom'
import { useT } from '../i18n/I18nProvider'
import { SiteLayout } from './SiteLayout'
import './NotFoundPage.css'

export function NotFoundPage() {
  const t = useT()
  return (
    <SiteLayout title={t.home.notFound.title}>
      <div className="not-found">
        <p className="not-found-code">404</p>
        <h1>{t.home.notFound.title}</h1>
        <p>{t.home.notFound.body}</p>
        <Link to="/">{t.home.notFound.home}</Link>
      </div>
    </SiteLayout>
  )
}
