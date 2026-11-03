// 每個網址的 SEO 資料(title、description、canonical、robots、JSON-LD)——唯一來源。
// - build:scripts/seo.mjs 用它產生每個路由的 HTML(dist/<路由>/index.html)、404.html、
//   sitemap.xml、robots.txt;並檢查 App.tsx 的每個路由都有對應的一筆,漏了會 build 失敗。
// - 瀏覽器:usePageMeta(App.tsx)在切換頁面時套用同一份資料。
// 課程、單課、文章、文件都從既有的目錄資料推導,新增課程/文章不用改這裡;
// 新增其他類型的頁面時,在下方 PAGES 加一筆。
import { articles } from '../studio/articles/registry'
import { AI_AGENT_COURSE_PATH, COURSE } from '../content/aiAgent'
import { COURSES, coursePath, lessonLabel, lessonPath, plannedChapterPath } from '../content/catalog'
import { AI_APP_LEVELS, LEVELS, type CourseLevel } from '../content/levels'
import { documentTitle, SITE_NAME, SITE_ORIGIN, SITE_TAGLINE } from '../site/siteInfo'
import { AI_APPS_TOPIC, HOME_INTRO, SOFTWARE_TOPIC, topicOfCourse } from '../content/topics'

type JsonLd = Record<string, unknown>

export interface PageMeta {
  /** 站內路徑,不含結尾斜線(首頁為 /) */
  path: string
  /** 完整的 <title>(與頁面元件設定的 document.title 一致) */
  title: string
  description: string
  /** 內部頁(課程研發、工具頁):noindex,且不列入 sitemap */
  noindex?: boolean
  ogType?: 'website' | 'article'
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

/** 麵包屑:首頁 → …(最後一項為目前頁面) */
function breadcrumb(...items: [name: string, path: string][]): JsonLd {
  return ld({
    '@type': 'BreadcrumbList',
    itemListElement: [['首頁', '/'] as const, ...items].map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: absoluteUrl(path),
    })),
  })
}

function course(name: string, description: string, path: string): JsonLd {
  return ld({
    '@type': 'Course',
    name,
    description,
    url: absoluteUrl(path),
    inLanguage: 'zh-Hant',
    provider: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_ORIGIN}/` },
  })
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

/** 主題頁:各自的標題與描述,結構化資料列出這個主題底下的課程 */
function topicPage(topic: { name: string; path: string; seoTitle: string; description: string }, levels: CourseLevel[]): PageMeta {
  return {
    path: topic.path,
    title: documentTitle(topic.seoTitle),
    sitemapPriority: 0.9,
    description: topic.description,
    jsonLd: [
      breadcrumb([topic.name, topic.path]),
      ld({
        '@type': 'ItemList',
        name: topic.name,
        itemListElement: levels
          .filter((level) => level.link)
          .map((level, i) => ({ '@type': 'ListItem', position: i + 1, name: level.title, url: absoluteUrl(level.link!) })),
      }),
    ],
  }
}

const SOFTWARE_TOPIC_PAGE = topicPage(SOFTWARE_TOPIC, LEVELS)

const AI_APPS_TOPIC_PAGE = topicPage(AI_APPS_TOPIC, AI_APP_LEVELS)

const AI_AGENT_COURSE: PageMeta = {
  path: AI_AGENT_COURSE_PATH,
  title: documentTitle(COURSE.title),
  description: COURSE.pitch,
  jsonLd: [
    course(COURSE.fullTitle, COURSE.pitch, AI_AGENT_COURSE_PATH),
    breadcrumb([AI_APPS_TOPIC.name, AI_APPS_TOPIC.path], [COURSE.title, AI_AGENT_COURSE_PATH]),
  ],
}

const COURSE_PAGES: PageMeta[] = COURSES.flatMap((c) => {
  // L3 的總覽頁是專屬頁面(AI_AGENT_COURSE),麵包屑沿用它的標題。
  const courseName = c.customOverview ? COURSE.title : c.title
  const topic = topicOfCourse(coursePath(c))
  const topicCrumb: [string, string] = [topic.name, topic.path]
  const overview: PageMeta[] = c.customOverview
    ? []
    : [
        {
          path: coursePath(c),
          title: documentTitle(c.title),
          description: c.summary,
          jsonLd: [course(c.title, c.summary, coursePath(c)), breadcrumb(topicCrumb, [c.title, coursePath(c)])],
        },
      ]
  const lessons: PageMeta[] = c.lessons.map((lesson) => {
    const name = `${lessonLabel(lesson)} ${lesson.title}`
    return {
      path: lessonPath(c, lesson),
      title: documentTitle(name),
      description: lesson.goal,
      ogType: 'article' as const,
      jsonLd: [breadcrumb(topicCrumb, [courseName, coursePath(c)], [name, lessonPath(c, lesson)])],
    }
  })
  const planned: PageMeta[] = c.planned.map((ch) => {
    const name = `${ch.label} ${ch.title}`
    return {
      path: plannedChapterPath(c, ch),
      title: documentTitle(name),
      description: ch.summary,
      ogType: 'article' as const,
      jsonLd: [breadcrumb(topicCrumb, [courseName, coursePath(c)], [name, plannedChapterPath(c, ch)])],
    }
  })
  return [...overview, ...lessons, ...planned]
})

// 法律頁:公開、可收錄,但在 sitemap 標為低優先。
const LEGAL_PAGES: PageMeta[] = [
  {
    path: '/privacy',
    title: documentTitle('隱私權政策'),
    description: 'shuttle.tools 的隱私權政策：瀏覽本網站時會處理哪些資料、為什麼處理、交給誰，以及您依個資法享有的權利。',
    sitemapPriority: 0.3,
  },
  {
    path: '/terms',
    title: documentTitle('服務條款'),
    description: '瀏覽與使用 shuttle.tools 網站及其中課程的服務條款。',
    sitemapPriority: 0.3,
  },
]

// 登入頁:公開但不需要被收錄。
const LOGIN_PAGE: PageMeta = {
  path: '/login',
  title: documentTitle('登入'),
  description: '登入 shuttle.tools，使用 Google 帳號或 Email 登入以學習需要登入的課程。',
  noindex: true,
}

// 管理後台:僅管理員使用(權限由伺服器判定),noindex、不列入 sitemap。
const ADMIN_PAGE: PageMeta = {
  path: '/admin',
  title: documentTitle('管理後台'),
  description: '會員與播放進度管理（內部使用）。',
  noindex: true,
}

// 以下都是課程研發用的內部頁(文件、課程提案、素材工具):noindex、不列入 sitemap。
// 標題保留各頁實際的 document.title,description 用頁面既有的摘要。
const internal = (path: string, title: string, description = '課程研發工作區（內部使用）。'): PageMeta => ({
  path,
  title,
  description,
  noindex: true,
})

const DOCS_PAGES: PageMeta[] = [
  // Markdown 文件(live、recorder)的標題與摘要也登記在 articles,所以這裡一次涵蓋
  ...articles.map((a) => internal(`/docs/${a.slug}`, documentTitle(a.title), a.summary)),
]

// 標題對應各頁 ProposalLayout 的 title(document.title = 「<title> · 課程提案」)。
const PROPOSAL_PAGES: PageMeta[] = (
  [
    ['/proposal', '總覽'],
    ['/proposal/tools', 'L0 AI 工具介紹'],
    ['/proposal/ai-tools', 'L1 AI 工具入門'],
    ['/proposal/life-tools', 'L1 生活小工具'],
    ['/proposal/l1-ideas', 'L1 構想區'],
    ['/proposal/vibe-coding', 'L2 Vibe Coding 入門'],
    ['/proposal/ai-agent/fields', 'L3 提案內容'],
    ['/proposal/ai-agent/structure', 'L3 課程架構'],
    ['/proposal/ai-agent/cover', 'L3 封面圖'],
    ['/proposal/advanced', 'L4 進階'],
    ['/proposal/mcp', '課程 MCP'],
    ['/proposal/member', '會員空間'],
    ['/proposal/visuals', '即時教學影像'],
    ['/proposal/interactive', '互動教學場景'],
    ['/proposal/interactive/l0-claude', '互動場景：L0 對 Claude 下指令'],
    ['/proposal/interactive/l0-claude-stage', '互動場景：把演員推到主畫面'],
    ['/materials', '工具'],
    ['/materials/course-map', '課程編排'],
  ] as const
).map(([path, name]) => internal(path, `${name} · 課程提案`))

const MATERIALS_PAGES: PageMeta[] = [
  internal('/materials/cover-designer', '課程封面'),
  internal('/materials/cover-cropper', '封面裁切工具'),
]

export const PAGES: PageMeta[] = [
  HOME,
  SOFTWARE_TOPIC_PAGE,
  AI_APPS_TOPIC_PAGE,
  AI_AGENT_COURSE,
  ...COURSE_PAGES,
  ...LEGAL_PAGES,
  LOGIN_PAGE,
  ADMIN_PAGE,
  ...DOCS_PAGES,
  ...PROPOSAL_PAGES,
  ...MATERIALS_PAGES,
]

/** 找不到頁面(server 以 404 狀態回應 dist/404.html) */
export const NOT_FOUND: PageMeta = {
  path: '/404',
  title: documentTitle('找不到頁面'),
  description: '找不到這個頁面。網址可能打錯了，或頁面已經移動。',
  noindex: true,
}

const BY_PATH = new Map(PAGES.map((p) => [p.path, p]))

/** 依網址找 SEO 資料;結尾斜線視為同一頁。找不到回傳 NOT_FOUND。 */
export function findPage(pathname: string): PageMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return BY_PATH.get(path) ?? NOT_FOUND
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
  tags.push(
    meta('property', 'og:type', page.ogType ?? 'website'),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:locale', 'zh_TW'),
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
