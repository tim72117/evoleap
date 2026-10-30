import { Link } from 'react-router-dom'
import { SiteLayout } from './SiteLayout'
import './NotFoundPage.css'

export function NotFoundPage() {
  return (
    <SiteLayout title="找不到頁面">
      <div className="not-found">
        <p className="not-found-code">404</p>
        <h1>找不到頁面</h1>
        <p>網址可能打錯了，或頁面已經移動。</p>
        <Link to="/">回首頁</Link>
      </div>
    </SiteLayout>
  )
}
