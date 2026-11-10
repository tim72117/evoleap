// build 時把 pages.ts 的資料轉成檔案內容(只有字串處理,檔案讀寫在 scripts/seo.mjs)。
import { INTERNAL_PAGES } from './internalPages'
import { absoluteUrl, headTags, NOT_FOUND, PAGES as PUBLIC_PAGES, type HeadTag, type PageMeta } from './pages'
// 種子只在建置時讀(這個檔不會打包進前端),免得草稿課的腳本路徑出現在公開的 JS;Docker 建置前端時也會複製這份檔案(見 Dockerfile)
import courseSeed from '../../../server/internal/store/courses_seed.json'

export { NOT_FOUND }

/** 所有頁面(公開頁 + 內部頁);build 要為每一頁產生 HTML */
export const PAGES: PageMeta[] = [...PUBLIC_PAGES, ...INTERNAL_PAGES]

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function renderTag(t: HeadTag): string {
  const attrs = Object.entries({ ...t.attrs, 'data-seo': '' })
    .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${escapeHtml(v)}"`))
    .join('')
  return t.tag === 'script' ? `<script${attrs}>${t.text}</script>` : `<${t.tag}${attrs}>`
}

/** 把 vite build 產生的 index.html 換成這一頁的 <title> 與 SEO 標籤。 */
export function renderPage(template: string, page: PageMeta): string {
  const head = [`<title>${escapeHtml(page.title)}</title>`, ...headTags(page).map(renderTag)].join('\n    ')
  const out = template.replace(/<title>[\s\S]*?<\/title>/, () => head)
  if (out === template) throw new Error('index.html 缺少 <title>,無法插入 SEO 標籤')
  return out
}

/** dist 內的輸出路徑:/ → index.html、/courses/tools → courses/tools/index.html */
export function outputFile(page: PageMeta): string {
  return page === NOT_FOUND ? '404.html' : `${page.path.slice(1)}${page.path === '/' ? '' : '/'}index.html`
}

const SEED: { id: string; units?: { lessons: { id: string; status: string }[] }[] }[] = courseSeed

/** 列入 sitemap 的頁面:可收錄,而且如果是一課的頁面,那一課在種子裡是已開放(open);草稿、規劃中的課不列入 */
export function inSitemap(p: PageMeta): boolean {
  if (p.noindex) return false
  if (!p.lesson) return true
  const { course, id } = p.lesson
  return SEED.find((c) => c.id === course)?.units?.flatMap((u) => u.lessons).find((l) => l.id === id)?.status === 'open'
}

export function sitemapXml(): string {
  const urls = PAGES.filter(inSitemap).map((p) => {
    const priority = p.sitemapPriority === undefined ? '' : `<priority>${p.sitemapPriority.toFixed(1)}</priority>`
    return `  <url><loc>${escapeHtml(absoluteUrl(p.path))}</loc>${priority}</url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function robotsTxt(): string {
  // 內部頁(/studio、/docs、/materials)不在這裡 Disallow:被 Disallow 的頁面爬蟲不會抓取,
  // 就看不到頁面上的 noindex,反而可能只憑外部連結把網址列進搜尋結果。
  // 內部頁改由 meta robots noindex + X-Robots-Tag 排除收錄。
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${absoluteUrl('/sitemap.xml')}`, ''].join('\n')
}
