import { Component, lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { adminRoutes } from './admin/routes'
import { authRoutes } from './auth/routes'
import { courseRoutes } from './courses/routes'
import { homeRoutes } from './home/routes'
import { legalRoutes } from './legal/routes'
import { memberRoutes } from './member/routes'
import { findPage } from './seo/pages'
import { usePageMeta } from './seo/usePageMeta'
import { useAnalyticsPageView } from './site/analytics'
import { isInternalPath } from './site/internalPaths'
import { NotFoundPage } from './site/NotFoundPage'

// 研發基地(/studio、/docs、/materials)是獨立的 chunk,放在 assets/internal/,由 Go server 限管理員下載。
// 不要從公開頁面靜態 import src/studio/ 底下的東西(studio/interactive 除外),vite.config.ts 會讓 build 失敗。
const StudioApp = lazy(() => import('./studio/StudioApp'))

// scripts/seo.mjs 會檢查這裡與 studio/StudioApp 的 internalRoutes 的每個路由在 SEO 資料裡都有一筆。
export const routes = [...homeRoutes, ...courseRoutes, ...legalRoutes, ...authRoutes, ...memberRoutes, ...adminRoutes]

// 內部頁的 SEO 資料在 StudioApp 裡,公開的打包內容不包含內部頁清單。
const publicPageMeta = (pathname: string) => (isInternalPath(pathname) ? null : findPage(pathname))

/** 下載不到內部 chunk(沒有權限,例如在頁面裡登出後按上一頁):和伺服器一樣顯示找不到頁面。 */
class StudioBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <NotFoundPage /> : this.props.children
  }
}

function Fallback() {
  const { pathname } = useLocation()
  if (!isInternalPath(pathname)) return <NotFoundPage />
  return (
    <StudioBoundary>
      <Suspense fallback={null}>
        <StudioApp />
      </Suspense>
    </StudioBoundary>
  )
}

export function App() {
  usePageMeta(publicPageMeta)
  useAnalyticsPageView()
  return (
    <Routes>
      {routes.map((r) => (
        <Route key={r.path} path={r.path} element={r.element} />
      ))}
      <Route path="*" element={<Fallback />} />
    </Routes>
  )
}
