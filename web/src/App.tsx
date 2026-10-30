import { Route, Routes } from 'react-router-dom'
import { articleRoutes } from './studio/articles/routes'
import { authRoutes } from './auth/routes'
import { courseRoutes } from './courses/routes'
import { docsRoutes } from './studio/docs/routes'
import { homeRoutes } from './home/routes'
import { legalRoutes } from './legal/routes'
import { materialsRoutes } from './studio/materials/routes'
import { NotFoundPage } from './site/NotFoundPage'
import { proposalRoutes } from './studio/proposal/routes'
import { usePageMeta } from './seo/usePageMeta'
import { useAnalyticsPageView } from './site/analytics'

// scripts/seo.mjs 會檢查這裡的每個路由在 seo/pages.ts 都有 SEO 資料。
export const routes = [...homeRoutes, ...courseRoutes, ...proposalRoutes, ...materialsRoutes, ...docsRoutes, ...articleRoutes, ...legalRoutes, ...authRoutes]

export function App() {
  usePageMeta()
  useAnalyticsPageView()
  return (
    <Routes>
      {routes.map((r) => (
        <Route key={r.path} path={r.path} element={r.element} />
      ))}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
