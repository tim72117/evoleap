// 公開網址的 SEO 資料(title、description、canonical、robots、JSON-LD)。
// 課程相關頁面(主題頁、全部課程、課程總覽、單課、規劃中章節)例外:它們的資料來自資料庫,由 Go server 在請求時組出來
// (server/cmd/server/courseseo.go),這裡只有路由清單(coursePages.ts)與換頁時向 server 讀資料(resolvePage)。
// 其他頁面的唯一來源是這裡;研發基地的內部頁在 internalPages.ts(這個檔案會打包進公開的 JS,不能列內部頁)。
// - build:scripts/seo.mjs 透過 build.ts 用它產生每個路由的 HTML(dist/<路由>/index.html)、404.html、
//   sitemap-pages.json、robots.txt;並檢查 App.tsx 的每個路由都有對應的一筆,漏了會 build 失敗。
// - 瀏覽器:usePageMeta(App.tsx)在切換頁面時套用同一份資料。
// 文章、文件從既有的目錄資料推導;新增其他類型的頁面時,在下方 PAGES 加一筆(內部頁加在 internalPages.ts)。
import { documentTitle, SITE_NAME, SITE_ORIGIN, SITE_TAGLINE } from '../site/siteInfo'
import { HOME_INTRO } from '../content/topics'
import { isCoursePage } from './coursePages'
import { EN_ALTERNATES, EN_PAGES, EN_PREFIX } from './enPages'
import { MEMBER_SECTIONS, memberSectionTitle } from '../member/sections'

type JsonLd = Record<string, unknown>

export interface PageMeta {
  /** 站內路徑,不含結尾斜線(首頁為 /) */
  path: string
  /** 完整的 <title>(與頁面元件設定的 document.title 一致) */
  title: string
  description: string
  /** 不收錄的頁面(登入、後台、研發基地):noindex,且不列入 sitemap */
  noindex?: boolean
  ogType?: 'website' | 'article'
  /** 頁面語言;英文版(/en/...,見 enPages.ts)是 'en',其餘是中文 */
  lang?: 'en'
  /** 這門課沒有英文版(server 看資料庫):不放 hreflang */
  noEnglish?: boolean
  /** sitemap 的 <priority>(0–1);不填則不輸出,搜尋引擎視為 0.5 */
  sitemapPriority?: number
  jsonLd?: JsonLd[]
}

/** 預設分享圖(1200×630),原始檔 scripts/og-image.html */
export const OG_IMAGE = { path: '/og-default.png', width: 1200, height: 630 }

export const absoluteUrl = (path: string) => SITE_ORIGIN + path

// ---- JSON-LD ----

const ORGANIZATION: JsonLd = {
  '@type': 'Organization',
  '@id': `${SITE_ORIGIN}/#organization`,
  name: SITE_NAME,
  url: `${SITE_ORIGIN}/`,
  logo: absoluteUrl('/favicon.svg'),
}

function ld(data: JsonLd): JsonLd {
  return { '@context': 'https://schema.org', ...data }
}

// ---- 頁面 ----

const HOME: PageMeta = {
  path: '/',
  sitemapPriority: 1,
  title: documentTitle(),
  description: HOME_INTRO.description,
  jsonLd: [
    ld({
      '@graph': [
        ORGANIZATION,
        {
          '@type': 'WebSite',
          '@id': `${SITE_ORIGIN}/#website`,
          name: SITE_NAME,
          alternateName: `${SITE_NAME}：${SITE_TAGLINE}`,
          url: `${SITE_ORIGIN}/`,
          inLanguage: 'zh-Hant',
          publisher: { '@id': ORGANIZATION['@id'] },
        },
      ],
    }),
  ],
}

// 法律頁:公開、可收錄,但在 sitemap 標為低優先。
const LEGAL_PAGES: PageMeta[] = [
  {
    path: '/privacy',
    title: documentTitle('隱私權政策'),
    description: 'evoleap.io 的隱私權政策：瀏覽本網站時會處理哪些資料、為什麼處理、交給誰，以及您依個資法享有的權利。',
    sitemapPriority: 0.3,
  },
  {
    path: '/terms',
    title: documentTitle('服務條款'),
    description: '瀏覽與使用 evoleap.io 網站及其中課程的服務條款。',
    sitemapPriority: 0.3,
  },
  {
    path: '/refund',
    title: documentTitle('退款政策'),
    description: 'evoleap.io 付費訂閱的取消方式、退款條件，以及 Paddle 如何處理訂單與退款。',
    sitemapPriority: 0.3,
  },
]

// 登入頁:公開但不需要被收錄。
const LOGIN_PAGE: PageMeta = {
  path: '/login',
  title: documentTitle('登入'),
  description: '登入 evoleap.io，使用 Google 帳號或 Email 登入以記錄播放進度。',
  noindex: true,
}

// evoleap CLI 的登入核准頁(auth/CliAuthPage.tsx):只給管理員,不收錄
const CLI_AUTH_PAGE: PageMeta = {
  path: '/login/cli',
  title: documentTitle('核准 evoleap CLI 登入'),
  description: '核准 evoleap CLI 用你的管理員帳號登入（內部使用）。',
  noindex: true,
}

// 會員空間(member/):要登入才看得到自己的資料,不收錄;每個分頁一筆,跟著 MEMBER_SECTIONS 產生
const MEMBER_PAGES: PageMeta[] = MEMBER_SECTIONS.map((s) => ({
  path: s.path,
  title: documentTitle(memberSectionTitle(s)),
  description: s.description,
  noindex: true,
}))

// 管理後台的舊網址:現在轉到研發基地的「會員」標籤(/studio/members),noindex、不列入 sitemap。
const ADMIN_PAGE: PageMeta = {
  path: '/admin',
  title: documentTitle('管理後台'),
  description: '會員與播放進度管理（內部使用）。',
  noindex: true,
}

/** 展示頁(home/ShowcasePage.tsx):首頁拿掉的影片預覽搬到這裡當行銷頁;站內沒有連結,公開頁一律收錄(pages.test.ts) */
const SHOWCASE_PAGE: PageMeta = {
  path: '/showcase',
  title: documentTitle('課程展示'),
  description: '不用登入，直接播放 evoleap 的互動課程：做出自己的軟體的序章，以及給孩子的網頁程式第一課試做。',
  sitemapPriority: 0.3,
}

export const PAGES: PageMeta[] = [
  HOME,
  SHOWCASE_PAGE,
  ...LEGAL_PAGES,
  LOGIN_PAGE,
  CLI_AUTH_PAGE,
  ...MEMBER_PAGES,
  ADMIN_PAGE,
]

/** 找不到頁面(server 以 404 狀態回應 dist/404.html) */
export const NOT_FOUND: PageMeta = {
  path: '/404',
  title: documentTitle('找不到頁面'),
  description: '找不到這個頁面。網址可能打錯了，或頁面已經移動。',
  noindex: true,
}

const BY_PATH = new Map([...PAGES, ...EN_PAGES].map((p) => [p.path, p]))

/** 依網址找 SEO 資料;結尾斜線視為同一頁。找不到回傳 NOT_FOUND。 */
export function findPage(pathname: string): PageMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const hit = BY_PATH.get(path)
  if (hit) return hit
  // 沒有英文版的 /en/... 頁:伺服器回對應的中文頁(標 noindex),meta 也用中文頁的、不收錄
  if (path === EN_PREFIX || path.startsWith(EN_PREFIX + '/')) {
    const base = BY_PATH.get(path.slice(EN_PREFIX.length) || '/')
    if (base) return { ...base, noindex: true }
  }
  return NOT_FOUND
}

/** 要向 server 讀資料的網址:課程相關頁面(含英文課程總覽);其他 /en/... 課程頁沒有英文版,讀中文的並標 noindex。不是就回 undefined */
function coursePathOf(pathname: string): { path: string; fallback: boolean } | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (BY_PATH.has(path)) return undefined
  if (isCoursePage(path)) return { path, fallback: false }
  if (!path.startsWith(EN_PREFIX + '/')) return undefined
  const base = path.slice(EN_PREFIX.length)
  return isCoursePage(base) ? { path: base, fallback: true } : undefined
}

/**
 * 換頁時要套用的 SEO 資料:課程相關頁面向 server 讀(GET /api/seo/page,和 server 回傳的 HTML 同一份、讀資料庫),
 * 其他頁用上面的靜態資料。server 說沒有這一頁回 NOT_FOUND;讀不到(資料庫或網路有問題)回 null,由呼叫端拿掉上一頁的標籤。
 */
export async function resolvePage(pathname: string): Promise<PageMeta | null> {
  const hit = coursePathOf(pathname)
  if (!hit) return findPage(pathname)
  try {
    const res = await fetch(`/api/seo/page?path=${encodeURIComponent(hit.path)}`, { credentials: 'same-origin' })
    if (res.status === 404) return NOT_FOUND
    if (!res.ok) return null
    const page = (await res.json()) as PageMeta
    return hit.fallback ? { ...page, noindex: true } : page
  } catch {
    return null
  }
}

/** 這一頁的各語言網址(有英文版的頁才有,含自己;hreflang 與 sitemap 用);沒有就空陣列 */
export function languageAlternates(path: string, lang?: 'en'): { lang: string; path: string }[] {
  const zh = lang === 'en' ? path.slice(EN_PREFIX.length) : path
  const en = EN_ALTERNATES.get(zh)
  return en ? [{ lang: 'zh-Hant', path: zh }, { lang: 'en', path: en }, { lang: 'x-default', path: zh }] : []
}

// ---- <head> 標籤:build 時序列化成 HTML,瀏覽器端由 usePageMeta 套用到 DOM ----

export type HeadTag =
  | { tag: 'meta'; attrs: Record<string, string> }
  | { tag: 'link'; attrs: Record<string, string> }
  | { tag: 'script'; attrs: Record<string, string>; text: string }

export function headTags(page: PageMeta): HeadTag[] {
  const isNotFound = page === NOT_FOUND
  const url = absoluteUrl(page.path)
  const image = absoluteUrl(OG_IMAGE.path)
  const meta = (key: 'name' | 'property', name: string, content: string): HeadTag => ({
    tag: 'meta',
    attrs: { [key]: name, content },
  })

  const tags: HeadTag[] = [meta('name', 'description', page.description)]
  if (page.noindex) tags.push(meta('name', 'robots', 'noindex, nofollow'))
  if (!isNotFound) tags.push({ tag: 'link', attrs: { rel: 'canonical', href: url } })
  if (!page.noindex && !page.noEnglish) for (const a of languageAlternates(page.path, page.lang)) tags.push({ tag: 'link', attrs: { rel: 'alternate', hreflang: a.lang, href: absoluteUrl(a.path) } })
  tags.push(
    meta('property', 'og:type', page.ogType ?? 'website'),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:locale', page.lang === 'en' ? 'en_US' : 'zh_TW'),
    meta('property', 'og:title', page.title),
    meta('property', 'og:description', page.description),
    ...(isNotFound ? [] : [meta('property', 'og:url', url)]),
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', String(OG_IMAGE.width)),
    meta('property', 'og:image:height', String(OG_IMAGE.height)),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', page.title),
    meta('name', 'twitter:description', page.description),
    meta('name', 'twitter:image', image),
  )
  for (const data of page.jsonLd ?? []) {
    // 避免內容裡的 "</script>" 提早結束 script 元素。
    tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, text: JSON.stringify(data).replace(/</g, '\\u003c') })
  }
  return tags
}
