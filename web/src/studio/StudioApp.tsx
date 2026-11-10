import { Route, Routes } from 'react-router-dom'
import { findInternalPage } from '../seo/internalPages'
import { usePageMeta } from '../seo/usePageMeta'
import { NotFoundPage } from '../site/NotFoundPage'
import { articleRoutes } from './articles/routes'
import { docsRoutes } from './docs/routes'
import { materialsRoutes } from './materials/routes'
import { proposalRoutes } from './proposal/routes'

// 研發基地的入口,整包是獨立 chunk(由 App.tsx 延遲載入),Go server 限管理員下載。

/** 內部頁的所有路由;scripts/seo.mjs 與 pages.test 用來和 SEO 資料對照 */
export const internalRoutes = [...proposalRoutes, ...materialsRoutes, ...docsRoutes, ...articleRoutes]


export default function StudioApp() {
  usePageMeta(findInternalPage)
  return (
    <Routes>
      {internalRoutes.map((r) => (
        <Route key={r.path} path={r.path} element={r.element} />
      ))}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
