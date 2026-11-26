// build 時把 pages.ts、coursePages.ts 的資料轉成檔案內容(只有字串處理,檔案讀寫在 scripts/seo.mjs)。
import { COURSE_LIST } from '../content/topics'
import { SITE_NAME, SITE_ORIGIN } from '../site/siteInfo'
import { COURSE_PAGES, LESSON_ROUTES, type CoursePageEntry, type LessonRouteEntry } from './coursePages'
import { INTERNAL_PAGES } from './internalPages'
import { EN_PAGES } from './enPages'
import { absoluteUrl, headTags, languageAlternates, NOT_FOUND, PAGES as PUBLIC_PAGES, type HeadTag, type PageMeta } from './pages'

export { COURSE_PAGES, EN_PAGES, LESSON_ROUTES, NOT_FOUND }

/** 內容在 build 就決定的頁面(公開頁 + 內部頁);課程相關頁面另在 COURSE_PAGES */
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
  let out = template.replace(/<title>[\s\S]*?<\/title>/, () => head)
  if (page.lang === 'en') out = out.replace('<html lang="zh-Hant">', '<html lang="en">')
  if (out === template) throw new Error('index.html 缺少 <title>,無法插入 SEO 標籤')
  return out
}

// 課程相關頁面 HTML 的空位:server(courseseo.go)用資料庫的資料填入,兩邊的字串要一致
const TITLE_SLOT = '%SEO_TITLE%'
const DESCRIPTION_SLOT = '%SEO_DESCRIPTION%'
const ROBOTS_SLOT = '<!--seo:robots-->'
const JSONLD_SLOT = '<!--seo:jsonld-->'

/** 課程相關頁面的 HTML:固定的標籤(canonical、og:image…)在這裡產生,課程資料的部分留空位,不寫任何課程內容 */
export function renderCourseShell(template: string, entry: Pick<CoursePageEntry, 'path' | 'ogType' | 'noindex'>): string {
  const out = renderPage(template, { path: entry.path, title: TITLE_SLOT, description: DESCRIPTION_SLOT, ogType: entry.ogType, noindex: entry.noindex })
  return out.replace(/<meta name="description"[^>]*>/, (m) => `${m}${ROBOTS_SLOT}`).replace('</head>', () => `${JSONLD_SLOT}</head>`)
}

// 單課網址最後一段的空位(canonical、og:url),和 server 的 courseseo.go 一致
const SLUG_SLOT = '%SEO_SLUG%'

/** 一門課所有單課頁共用的 HTML */
export function renderLessonShell(template: string, route: LessonRouteEntry): string {
  return renderCourseShell(template, { path: `${route.coursePath}/${SLUG_SLOT}`, ogType: route.ogType, noindex: route.noindex })
}

/** 單課頁 HTML 在 dist 內的位置(不叫 index.html:不是固定網址的頁,server 也不直接對外提供) */
export const lessonShellFile = (route: LessonRouteEntry): string => `lesson-shells/${route.course}.html`

/** dist/course-pages.json:server 依它知道哪些網址是課程相關頁面、要讀哪一課 */
export function courseManifest() {
  return { site: SITE_NAME, origin: SITE_ORIGIN, courseList: { name: COURSE_LIST.name, path: COURSE_LIST.path }, pages: COURSE_PAGES, lessons: LESSON_ROUTES }
}

/** dist 內的輸出路徑:/ → index.html、/courses/software → courses/software/index.html */
export function outputFile(page: Pick<PageMeta, 'path'>): string {
  return page === NOT_FOUND ? '404.html' : `${page.path.slice(1)}${page.path === '/' ? '' : '/'}index.html`
}

/** sitemap-pages.json 的一筆:build 只輸出「可收錄的頁面清單」,不判斷課開放了沒有 */
export interface SitemapPage {
  loc: string
  priority?: number
  /** 各語言版本(含自己);server 輸出成 xhtml:link hreflang */
  alternates?: { lang: string; loc: string }[]
  /** 這一頁是哪一課;server 的 /sitemap.xml 依資料庫裡那一課的狀態,只收錄已開放(open)的課 */
  lesson?: { course: string; id: string }
  /** 這一筆不是一頁,而是一門課的單課頁(loc 是課程網址):server 依資料庫展開成每個已開放的課;staged 是軟體課的網址規則 */
  lessonsOf?: { course: string; staged?: boolean }
}

/** 可收錄的頁面(不含內部頁、noindex 的頁);單課頁只列「哪些課要展開」,有哪些課、收不收由 server 依資料庫決定(開放、且單元沒有先不公開,server/cmd/server/sitemap.go) */
export function sitemapPages(): SitemapPage[] {
  const entry = (p: PageMeta | CoursePageEntry): SitemapPage => {
    const alternates = languageAlternates(p.path, 'lang' in p ? p.lang : undefined)
    return {
      loc: absoluteUrl(p.path),
      ...(alternates.length ? { alternates: alternates.map((a) => ({ lang: a.lang, loc: absoluteUrl(a.path) })) } : {}),
      ...(p.sitemapPriority === undefined ? {} : { priority: p.sitemapPriority }),
      ...('lesson' in p && p.lesson ? { lesson: { course: p.course, id: p.lesson } } : {}),
    }
  }
  const lessons: SitemapPage[] = LESSON_ROUTES.filter((r) => !r.noindex).map((r) => ({
    loc: absoluteUrl(r.coursePath),
    ...(r.sitemapPriority === undefined ? {} : { priority: r.sitemapPriority }),
    lessonsOf: { course: r.course, ...(r.style === 'staged' && { staged: true }) },
  }))
  return [...[...PAGES, ...COURSE_PAGES, ...EN_PAGES].filter((p) => !p.noindex).map(entry), ...lessons]
}

export function robotsTxt(): string {
  // 內部頁(/studio、/docs、/materials)不在這裡 Disallow:被 Disallow 的頁面爬蟲不會抓取,
  // 就看不到頁面上的 noindex,反而可能只憑外部連結把網址列進搜尋結果。
  // 內部頁改由 meta robots noindex + X-Robots-Tag 排除收錄。
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${absoluteUrl('/sitemap.xml')}`, ''].join('\n')
}
