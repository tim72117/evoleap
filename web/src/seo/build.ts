// build 時把 pages.ts 的資料轉成檔案內容(只有字串處理,檔案讀寫在 scripts/seo.mjs)。
import { INTERNAL_PAGES } from './internalPages'
import { absoluteUrl, headTags, NOT_FOUND, PAGES as PUBLIC_PAGES, type HeadTag, type PageMeta } from './pages'

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

/** dist 內的輸出路徑:/ → index.html、/courses/software → courses/software/index.html */
export function outputFile(page: PageMeta): string {
  return page === NOT_FOUND ? '404.html' : `${page.path.slice(1)}${page.path === '/' ? '' : '/'}index.html`
}

/** sitemap-pages.json 的一筆:build 只輸出「可收錄的頁面清單」,不判斷課開放了沒有 */
export interface SitemapPage {
  loc: string
  priority?: number
  /** 這一頁是哪一課;server 的 /sitemap.xml 依資料庫裡那一課的狀態,只收錄已開放(open)的課 */
  lesson?: { course: string; id: string }
}

/** 可收錄的頁面(不含內部頁、noindex 的頁);課頁是否收錄由 server 依資料庫決定(server/cmd/server/sitemap.go) */
export function sitemapPages(): SitemapPage[] {
  return PAGES.filter((p) => !p.noindex).map((p) => ({
    loc: absoluteUrl(p.path),
    ...(p.sitemapPriority === undefined ? {} : { priority: p.sitemapPriority }),
    ...(p.lesson ? { lesson: p.lesson } : {}),
  }))
}

export function robotsTxt(): string {
  // 內部頁(/studio、/docs、/materials)不在這裡 Disallow:被 Disallow 的頁面爬蟲不會抓取,
  // 就看不到頁面上的 noindex,反而可能只憑外部連結把網址列進搜尋結果。
  // 內部頁改由 meta robots noindex + X-Robots-Tag 排除收錄。
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${absoluteUrl('/sitemap.xml')}`, ''].join('\n')
}
