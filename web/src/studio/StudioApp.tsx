import { Route, Routes } from 'react-router-dom'
import { registerSites } from '../live/actors/browser/actor'
import { findInternalPage } from '../seo/internalPages'
import { usePageMeta } from '../seo/usePageMeta'
import { articleRoutes } from './articles/routes'
import { docsRoutes } from './docs/routes'
import { materialsRoutes } from './materials/routes'
import { proposalRoutes } from './proposal/routes'
import { LabTrialOrNotFound } from './proposal/TrialRoutes'

// 研發基地的入口,整包是獨立 chunk(由 App.tsx 延遲載入),Go server 限管理員下載。

/** 內部頁的所有路由;scripts/seo.mjs 與 pages.test 用來和 SEO 資料對照 */
export const internalRoutes = [...proposalRoutes, ...materialsRoutes, ...docsRoutes, ...articleRoutes]

// 研發基地試做用的網頁素材(content/live/lab/site/<版本>/)不打包進公開的 browser 演員,只在研發基地這包加進去
registerSites(import.meta.glob('../content/live/lab/site/*/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)

export default function StudioApp() {
  usePageMeta(findInternalPage)
  return (
    <Routes>
      {internalRoutes.map((r) => (
        <Route key={r.path} path={r.path} element={r.element} />
      ))}
      {/* lab 試做頁沒有逐頁的路由,依網址在試做清單裡找,不是試做就顯示找不到頁面 */}
      <Route path="*" element={<LabTrialOrNotFound />} />
    </Routes>
  )
}
