// 研發基地內部頁的 SEO 資料。只由 StudioApp 與 build 使用,不會打包進公開的 JS。
import { articles } from '../studio/articles/registry'
import { FULL_TRIAL_ROUTE } from '../studio/proposal/fullCourse'
import { NOT_FOUND, type PageMeta } from './pages'

// 以下都是研發基地用的內部頁(文件、課程提案、素材工具):noindex、不列入 sitemap。
// 標題保留各頁實際的 document.title,description 用頁面既有的摘要。
const internal = (path: string, title: string, description = '研發基地（內部使用）。'): PageMeta => ({
  path,
  title,
  description,
  noindex: true,
})

const DOCS_PAGES: PageMeta[] = [
  // Markdown 文件(live、recorder)的標題與摘要也登記在 articles,所以這裡一次涵蓋
  ...articles.map((a) => internal(`/docs/${a.slug}`, `${a.title} · 課程提案`, a.summary)),
]

// 標題對應各頁 ProposalLayout 的 title(document.title = 「<title> · 課程提案」)。
const PROPOSAL_PAGES: PageMeta[] = (
  [
    ['/studio', '總覽'],
    ['/studio/todo', '待辦'],
    ['/studio/members', '會員'],
    ['/studio/docs', '文件'],
    ['/studio/tools', 'L0 AI 工具介紹'],
    ['/studio/ai-tools', 'L1 AI 工具入門'],
    ['/studio/life-tools', 'L1 生活小工具'],
    ['/studio/l1-ideas', 'L1 構想區'],
    ['/studio/vibe-coding', 'L2 Vibe Coding 入門'],
    ['/studio/ai-agent/fields', 'L3 提案內容'],
    ['/studio/ai-agent/structure', 'L3 課程架構'],
    ['/studio/ai-agent/cover', 'L3 封面圖'],
    ['/studio/advanced', 'L4 進階'],
    ['/studio/mcp', '課程 MCP'],
    ['/studio/live-script-mcp', '即時腳本 MCP'],
    ['/studio/member', '會員空間'],
    ['/studio/kids-family', '兒童課家長模式'],
    ['/studio/resources', '資源系統'],
    ['/studio/news-feed', '科技新知動態牆'],
    ['/studio/extensions', '延伸課程'],
    ['/studio/ai-scenarios', 'AI 自動化情境'],
    ['/studio/full-course', '全環節課程清單'],
    ['/studio/actor-interaction', '演員互動'],
    ['/studio/actor-interaction/showcase', '演員展示'],
    ['/studio/ai-tips', 'AI 工具技巧'],
    ['/studio/kids-web', '兒童網頁課'],
    ['/studio/web-basics', '網頁運作知識'],
    ['/studio/ops-course', '從上線到維運'],
    ['/studio/web-basics/5-1', '網頁運作知識 5.1 試做'],
    ['/studio/vibe-coding/4-1', 'L2 基礎 4.1 試做'],
    ['/studio/vibe-coding/4-2', 'L2 基礎 4.2 試做'],
    ['/studio/vibe-coding/4-3', 'L2 基礎 4.3 試做'],
    ['/studio/vibe-coding/15-1', 'L2 基礎 15.1 試做'],
    ['/studio/vibe-coding/15-2', 'L2 基礎 15.2 試做'],
    ['/studio/vibe-coding/15-3', 'L2 基礎 15.3 試做'],
    ['/studio/kids-web/0-1', '兒童網頁課 0.1 試做'],
    ['/studio/kids-web/0-1/live', '兒童網頁課 0.1 live 試做'],
    ['/studio/kids-web/0-2/live', '兒童網頁課 0.2 試做'],
    ['/studio/kids-web/0-3/live', '兒童網頁課 0.3 試做'],
    ['/studio/kids-web/xray', '兒童網頁課 X 光眼鏡草稿'],
    ['/studio/visuals', '即時教學影像'],
    ['/studio/portrait', '直式舞台'],
    ['/studio/fable-trial', '畫面試作：本機與網路上'],
    ['/studio/scenes', '場景'],
    ['/studio/actor-interaction/scene', '互動教學場景'],
    ['/studio/actor-interaction/push', '互動場景：把演員推到主畫面'],
    ['/studio/actor-interaction/static', '互動場景：靜態演員'],
    ['/materials', '工具'],
    ['/materials/course-map', '課程編排'],
  ] as const
).map(([path, name]) => internal(path, `${name} · 課程提案`))

const MATERIALS_PAGES: PageMeta[] = [
  internal('/materials/cover-designer', '課程封面'),
  internal('/materials/cover-cropper', '封面裁切工具'),
  internal('/materials/promo', '宣傳影片 · 課程提案'),
]

// 全環節課程清單與 lab 試做清單是研發基地的資料(進資料庫,studio/studioData.ts),build 時不知道有哪幾堂:
// 全環節課程的試做頁用一條帶參數的路由(FULL_TRIAL_ROUTE),這裡放同一個樣式,findInternalPage 依樣式比對;
// lab 試做頁沒有自己的路由(StudioApp 找不到路由時依網址在清單裡找),也沒有逐頁的 SEO 資料。標題由頁面自己設定。
const FULL_COURSE_PAGES: PageMeta[] = [
  internal('/studio/full-course/check', '全環節課程腳本檢查 · 課程提案'),
  internal('/studio/trials', '課程試做清單 · 課程提案'),
  internal(FULL_TRIAL_ROUTE, '全環節課程試做 · 課程提案'),
]

export const INTERNAL_PAGES: PageMeta[] = [...DOCS_PAGES, ...PROPOSAL_PAGES, ...MATERIALS_PAGES, ...FULL_COURSE_PAGES]

/** 路由樣式(帶 :參數,例如 /studio/full-course/:item/:kind)的頁面:不預先產生 HTML,開頁時依樣式比對 */
export const isRoutePattern = (path: string): boolean => path.includes('/:')

const BY_PATH = new Map(INTERNAL_PAGES.filter((p) => !isRoutePattern(p.path)).map((p) => [p.path, p]))
const PATTERNS = INTERNAL_PAGES.filter((p) => isRoutePattern(p.path)).map((p) => ({
  re: new RegExp(`^${p.path.replace(/:[^/]+/g, '[^/]+')}$`),
  page: p,
}))

/** 依網址找內部頁的 SEO 資料;結尾斜線視為同一頁,帶參數的路由依樣式比對。找不到回傳 NOT_FOUND。 */
export function findInternalPage(pathname: string): PageMeta {
  const path = pathname.replace(/\/+$/, '')
  return BY_PATH.get(path) ?? PATTERNS.find((x) => x.re.test(path))?.page ?? NOT_FOUND
}
