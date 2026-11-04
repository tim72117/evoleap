import { Route, Routes } from 'react-router-dom'
import { registerScripts } from '../live/scripts'
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

// 實驗與宣傳影片的腳本只有研發基地用,不放進公開的腳本清單(live/scripts.ts)。
registerScripts(
  import.meta.glob(['../content/live/lab/**/*.json', '../content/live/promo/**/*.json'], { import: 'default' }),
)

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
