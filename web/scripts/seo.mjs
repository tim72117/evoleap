// vite build 之後執行(npm run build):依 src/seo/pages.ts 產生
//   dist/<路由>/index.html(各頁的 <title>、description、canonical、og:*、JSON-LD)
//   dist/404.html、dist/sitemap.xml、dist/robots.txt
// 讓爬蟲與連結預覽不執行 JS 也看得到每頁的資料。Go server(server/cmd/server/static.go)
// 依路徑回傳對應的 index.html,找不到就以 404 狀態回傳 404.html。
//
// TS 模組透過 Vite 的 ssrLoadModule 載入(與前端共用同一套 import 處理,含 ?raw、CSS module),
// 不需要另外的 TS 執行工具;不會監聽任何 port。
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const vite = await createServer({
  root,
  logLevel: 'warn',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
})
let seo, routes
try {
  seo = await vite.ssrLoadModule('/src/seo/build.ts')
  const { routes: publicRoutes } = await vite.ssrLoadModule('/src/App.tsx')
  const { internalRoutes } = await vite.ssrLoadModule('/src/studio/StudioApp.tsx')
  routes = [...publicRoutes, ...internalRoutes]
} finally {
  await vite.close()
}

// App.tsx、StudioApp.tsx 的路由與 SEO 資料必須一一對應:漏了 SEO 資料的頁面在正式站會變成 404。
const routePaths = new Set(routes.map((r) => r.path))
const pagePaths = new Set(seo.PAGES.map((p) => p.path))
const missing = [...routePaths].filter((p) => !pagePaths.has(p))
const extra = [...pagePaths].filter((p) => !routePaths.has(p))
if (missing.length || extra.length) {
  if (missing.length) console.error('這些路由在 src/seo/pages.ts、internalPages.ts 沒有 SEO 資料:', missing)
  if (extra.length) console.error('SEO 資料有、App.tsx 與 StudioApp.tsx 沒有的路由:', extra)
  process.exit(1)
}

const template = await readFile(join(dist, 'index.html'), 'utf8')
const write = async (file, content) => {
  const target = join(dist, file)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content)
}

// 帶參數的路由(例如 /studio/full-course/:item/:kind)沒有固定網址,不預先產生 HTML:伺服器對內部頁沒有對應 HTML 的網址回研發基地首頁的 HTML,由前端路由處理
for (const page of [...seo.PAGES.filter((p) => !p.path.includes('/:')), seo.NOT_FOUND]) {
  await write(seo.outputFile(page), seo.renderPage(template, page))
}
await write('sitemap.xml', seo.sitemapXml())
await write('robots.txt', seo.robotsTxt())

console.log(`seo: ${seo.PAGES.length} 頁 + 404.html、sitemap.xml、robots.txt`)
