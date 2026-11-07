// 公開網址的 SEO 資料(title、description、canonical、robots、JSON-LD)——唯一來源。
// 研發基地的內部頁在 internalPages.ts(這個檔案會打包進公開的 JS,不能列內部頁)。
// - build:scripts/seo.mjs 透過 build.ts 用它產生每個路由的 HTML(dist/<路由>/index.html)、404.html、
//   sitemap.xml、robots.txt;並檢查 App.tsx 的每個路由都有對應的一筆,漏了會 build 失敗。
// - 瀏覽器:usePageMeta(App.tsx)在切換頁面時套用同一份資料。
// 課程、單課、文章、文件都從既有的目錄資料推導,新增課程/文章不用改這裡;
// 新增其他類型的頁面時,在下方 PAGES 加一筆(內部頁加在 internalPages.ts)。
import { AI_AGENT_COURSE_PATH, COURSE } from '../content/aiAgent'
import { COURSES, coursePath, lessonLabel, lessonPath, plannedChapterPath } from '../content/catalog'
import { AI_APP_LEVELS, ALL_LEVELS, LEVELS, type CourseLevel } from '../content/levels'
import { documentTitle, SITE_NAME, SITE_ORIGIN, SITE_TAGLINE } from '../site/siteInfo'
import { KIDS_OPEN_LESSONS, KIDS_UNITS, kidsLessonTitle } from '../content/kidsCourse'
import { AI_APPS_TOPIC, CLAUDE_CODE_SCENARIOS, CLAUDE_CODE_TOPIC, COURSE_LIST, HOME_INTRO, KIDS_TOPIC, kidsLessonDocTitle, SOFTWARE_TOPIC, topicOfCourse, WEB_TOPIC, webLessonDocTitle } from '../content/topics'
import { WEB_OPEN_LESSONS, WEB_UNITS, webLesson } from '../content/webCourse'

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

const COURSE_LIST_PAGE = topicPage(COURSE_LIST, ALL_LEVELS)

/** 不分等級、沒有課程頁的主題:結構化資料只列情境名稱 */
const CLAUDE_CODE_TOPIC_PAGE: PageMeta = {
  path: CLAUDE_CODE_TOPIC.path,
  title: documentTitle(CLAUDE_CODE_TOPIC.seoTitle),
  sitemapPriority: 0.9,
  description: CLAUDE_CODE_TOPIC.description,
  jsonLd: [
    breadcrumb([CLAUDE_CODE_TOPIC.name, CLAUDE_CODE_TOPIC.path]),
    ld({
      '@type': 'ItemList',
      name: CLAUDE_CODE_TOPIC.name,
      itemListElement: CLAUDE_CODE_SCENARIOS.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.title })),
    }),
  ],
}

/** 主題「給孩子的網頁程式」的課程地圖頁:結構化資料列出每一課 */
const KIDS_TOPIC_PAGE: PageMeta = {
  path: KIDS_TOPIC.path,
  title: documentTitle(KIDS_TOPIC.seoTitle),
  sitemapPriority: 0.8,
  description: KIDS_TOPIC.description,
  jsonLd: [
    breadcrumb([KIDS_TOPIC.name, KIDS_TOPIC.path]),
    ld({
      '@type': 'ItemList',
      name: KIDS_TOPIC.name,
      // 已經可以上的課附上課程頁網址
      itemListElement: KIDS_UNITS.flatMap((u) => u.lessons).map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `${l.id} ${l.title}`,
        ...(KIDS_OPEN_LESSONS[l.id] && { url: absoluteUrl(KIDS_OPEN_LESSONS[l.id].path) }),
      })),
    }),
  ],
}

/** 兒童課已經可以上的課:一課一頁 */
const KIDS_LESSON_PAGES: PageMeta[] = Object.entries(KIDS_OPEN_LESSONS).map(([id, l]) => {
  const description = KIDS_UNITS.flatMap((u) => u.lessons).find((x) => x.id === id)?.learn ?? KIDS_TOPIC.description
  return {
    path: l.path,
    title: documentTitle(kidsLessonDocTitle(id)),
    description,
    jsonLd: [breadcrumb([KIDS_TOPIC.name, KIDS_TOPIC.path], [kidsLessonTitle(id), l.path]), course(`${KIDS_TOPIC.name}：${kidsLessonTitle(id)}`, description, l.path)],
  }
})

/** 主題「網頁怎麼運作」的課程地圖頁:結構化資料列出每一課 */
const WEB_TOPIC_PAGE: PageMeta = {
  path: WEB_TOPIC.path,
  title: documentTitle(WEB_TOPIC.seoTitle),
  sitemapPriority: 0.8,
  description: WEB_TOPIC.description,
  jsonLd: [
    breadcrumb([WEB_TOPIC.name, WEB_TOPIC.path]),
    ld({
      '@type': 'ItemList',
      name: WEB_TOPIC.name,
      // 已經可以上的課附上課程頁網址
      itemListElement: WEB_UNITS.flatMap((u) => u.lessons).map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `${l.id} ${l.title}`,
        ...(WEB_OPEN_LESSONS[l.id] && { url: absoluteUrl(WEB_OPEN_LESSONS[l.id].path) }),
      })),
    }),
  ],
}

/** 網頁怎麼運作已經可以上的課:一課一頁 */
const WEB_LESSON_PAGES: PageMeta[] = Object.entries(WEB_OPEN_LESSONS).map(([id, l]) => {
  const lesson = webLesson(id)
  const title = lesson?.title ?? id
  const description = lesson?.learn ?? WEB_TOPIC.description
  return {
    path: l.path,
    title: documentTitle(webLessonDocTitle(id)),
    description,
    jsonLd: [breadcrumb([WEB_TOPIC.name, WEB_TOPIC.path], [title, l.path]), course(`${WEB_TOPIC.name}：${title}`, description, l.path)],
  }
})

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

// 管理後台的舊網址:現在轉到研發基地的「會員」標籤(/studio/members),noindex、不列入 sitemap。
const ADMIN_PAGE: PageMeta = {
  path: '/admin',
  title: documentTitle('管理後台'),
  description: '會員與播放進度管理（內部使用）。',
  noindex: true,
}

export const PAGES: PageMeta[] = [
  HOME,
  SOFTWARE_TOPIC_PAGE,
  AI_APPS_TOPIC_PAGE,
  COURSE_LIST_PAGE,
  CLAUDE_CODE_TOPIC_PAGE,
  KIDS_TOPIC_PAGE,
  ...KIDS_LESSON_PAGES,
  WEB_TOPIC_PAGE,
  ...WEB_LESSON_PAGES,
  AI_AGENT_COURSE,
  ...COURSE_PAGES,
  ...LEGAL_PAGES,
  LOGIN_PAGE,
  ADMIN_PAGE,
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
