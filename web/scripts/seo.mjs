// vite build 之後執行(npm run build):依 src/seo/pages.ts 產生
//   dist/<路由>/index.html(各頁的 <title>、description、canonical、og:*、JSON-LD)
//   dist/404.html、dist/sitemap-pages.json(可收錄的頁面清單)、dist/robots.txt
// 課程相關頁面(src/seo/coursePages.ts)的 index.html 只是留好空位的殼,不含課程內容;單課頁一門課一份(dist/lesson-shells/),
// 有哪些課由 server 看資料庫;英文課程總覽(/en/courses/<課程>)同樣是空殼。資料庫新增課不用重新 build。另輸出 dist/course-pages.json,
// Go server 依它在請求時讀資料庫填入(server/cmd/server/courseseo.go)。
// /sitemap.xml 由 Go server 即時產生:依資料庫裡每一課的狀態決定課頁收不收(server/cmd/server/sitemap.go)
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
const lessonPaths = seo.LESSON_ROUTES.map((r) => `${r.coursePath}/:lesson`)
const pagePaths = new Set([...[...seo.PAGES, ...seo.COURSE_PAGES].map((p) => p.path), ...lessonPaths])
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
for (const page of [...seo.PAGES.filter((p) => !p.path.includes('/:')), ...seo.EN_PAGES, seo.NOT_FOUND]) {
  await write(seo.outputFile(page), seo.renderPage(template, page))
}
for (const entry of [...seo.COURSE_PAGES, ...seo.EN_COURSE_PAGES]) {
  await write(seo.outputFile(entry), seo.renderCourseShell(template, entry))
}
for (const route of seo.LESSON_ROUTES) {
  await write(seo.lessonShellFile(route), seo.renderLessonShell(template, route))
}
await write('course-pages.json', JSON.stringify(seo.courseManifest()))
await write('sitemap-pages.json', JSON.stringify(seo.sitemapPages()))
await write('robots.txt', seo.robotsTxt())

console.log(`seo: ${seo.PAGES.length} 頁 + ${seo.COURSE_PAGES.length} 個課程頁 + ${seo.EN_COURSE_PAGES.length} 個英文課程總覽 + ${seo.LESSON_ROUTES.length} 門課的單課頁樣板(內容由 server 填)+ ${seo.EN_PAGES.length} 個英文頁 + 404.html、course-pages.json、sitemap-pages.json、robots.txt`)
