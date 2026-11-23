// 公開網址的 SEO 資料(title、description、canonical、robots、JSON-LD)——唯一來源。
// 研發基地的內部頁在 internalPages.ts(這個檔案會打包進公開的 JS,不能列內部頁)。
// - build:scripts/seo.mjs 透過 build.ts 用它產生每個路由的 HTML(dist/<路由>/index.html)、404.html、
//   sitemap.xml、robots.txt;並檢查 App.tsx 的每個路由都有對應的一筆,漏了會 build 失敗。
// - 瀏覽器:usePageMeta(App.tsx)在切換頁面時套用同一份資料。
// 課程、單課、文章、文件都從既有的目錄資料推導,新增課程/文章不用改這裡;
// 新增其他類型的頁面時,在下方 PAGES 加一筆(內部頁加在 internalPages.ts)。
import { COURSE } from '../content/aiAgent'
import { COURSES, courseOfLevel, coursePath, courseMapId, lessonUrl, plannedChapterPath } from '../content/catalog'
import { seedCourse, type SeedLesson } from '../content/courseSeed'
import { lessonDocTitle, lessonLabelOf } from '../content/lessonDisplay'
import { AI_APP_LEVELS, ALL_LEVELS, LEVELS, levelPath, shownLevels, type CourseLevel } from '../content/levels'
import { documentTitle, SITE_NAME, SITE_ORIGIN, SITE_TAGLINE } from '../site/siteInfo'
import { KIDS_LESSON_PAGES } from '../content/kidsCourse'
import { AI_APPS_TOPIC, CLAUDE_CODE_LESSON_PAGES, CLAUDE_CODE_SCENARIOS, CLAUDE_CODE_TOPIC, COURSE_LIST, HOME_INTRO, KIDS_TOPIC, LAUNCH_TOPIC, SOFTWARE_TOPIC, topicOfCourse, WEB_TOPIC } from '../content/topics'
import { LAUNCH_LESSON_PAGES, launchLessonPath } from '../content/launchCourse'
import { WEB_LESSON_PAGES } from '../content/webCourse'
import { MEMBER_SECTIONS, memberSectionTitle } from '../member/sections'

type JsonLd = Record<string, unknown>

/**
 * 結構化資料裡課程清單的一課:標出課程頁網址,但開放了沒有不在 build 判斷(不讀種子)。
 * server 回傳頁面時(server/cmd/server/seo_ld.go)依資料庫:那一課已開放就把 url 寫成 ListItem 的 "url",
 * 並一律拿掉 evoleapLesson,所以這個欄位不會出現在回應裡。
 */
const lessonLink = (course: string, id: string, path: string) => ({ evoleapLesson: { course, id, url: absoluteUrl(path) } })

export interface PageMeta {
  /** 站內路徑,不含結尾斜線(首頁為 /) */
  path: string
  /** 完整的 <title>(與頁面元件設定的 document.title 一致) */
  title: string
  description: string
  /** 不收錄的頁面(登入、後台、研發基地):noindex,且不列入 sitemap */
  noindex?: boolean
  ogType?: 'website' | 'article'
  /** 這一頁是哪一課(courses_seed.json 的課程 id 與課號);課還沒開放時仍可收錄,但不列入 sitemap(server 依資料庫決定,見 server/cmd/server/sitemap.go) */
  lesson?: { course: string; id: string }
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

/** 主題頁清單裡的課程:等級連到的課程頁(同一門課的幾個階段只列一次,用課程名稱、不帶 #stage-…) */
function courseItems(levels: CourseLevel[]): { name: string; url: string }[] {
  const items = shownLevels(levels)
    .filter((level) => level.link)
    .map((level) => {
      const course = courseOfLevel(level)
      return course?.stages ? { name: course.title, url: absoluteUrl(levelPath(level)!) } : { name: level.title, url: absoluteUrl(levelPath(level)!) }
    })
  return items.filter((it, i) => items.findIndex((x) => x.url === it.url) === i)
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
        itemListElement: courseItems(levels).map((it, i) => ({ '@type': 'ListItem', position: i + 1, ...it })),
      }),
    ],
  }
}

const SOFTWARE_TOPIC_PAGE = topicPage(SOFTWARE_TOPIC, LEVELS)

// 中階課(打造你的第一個 AI Agent 整合應用)沒有自己的頁面,課程介紹在主題頁:課程資訊併進主題頁的結構化資料
const AI_APPS_BASE = topicPage(AI_APPS_TOPIC, AI_APP_LEVELS)
const AI_APPS_TOPIC_PAGE: PageMeta = { ...AI_APPS_BASE, jsonLd: [...(AI_APPS_BASE.jsonLd ?? []), course(COURSE.fullTitle, COURSE.pitch, AI_APPS_TOPIC.path)] }

const COURSE_LIST_PAGE = topicPage(COURSE_LIST, ALL_LEVELS)

/** 種子裡某門課的某一課(頁面註冊了但種子沒有時回 undefined,課名退回課號、描述退回主題描述) */
const seedLesson = (courseId: string, id: string): SeedLesson | undefined => seedCourse(courseId).units.flatMap((u) => u.lessons).find((x) => x.id === id)

/** 單課頁的 <title>:`課名｜課程名稱 · evoleap`(頁名與執行期 document.title 同一個函式 lessonDocTitle,content/lessonDisplay.ts) */
const lessonTitle = (title: string, courseTitle: string): string => documentTitle(lessonDocTitle(title, courseTitle))

/** 兒童課已經可以上的課:一課一頁(課名、描述讀課程種子的 title、summary) */
const KIDS_LESSON_METAS: PageMeta[] = Object.entries(KIDS_LESSON_PAGES).map(([id, l]) => {
  const lesson = seedLesson('kids', id)
  const title = lesson?.title ?? id
  const learn = lesson?.summary
  // 課程地圖上的一句話有些太短,接上主題與課名
  const description = learn ? (learn.length >= 20 ? learn : `${learn}${KIDS_TOPIC.name}：${title}。`) : KIDS_TOPIC.description
  return {
    path: l.path,
    title: lessonTitle(title, seedCourse('kids').title),
    description,
    lesson: { course: 'kids', id },
    jsonLd: [breadcrumb([COURSE_LIST.name, COURSE_LIST.path], [KIDS_TOPIC.name, KIDS_TOPIC.path], [title, l.path]), course(`${KIDS_TOPIC.name}：${title}`, description, l.path)],
  }
})

/** 網頁怎麼運作已經可以上的課:一課一頁 */
const WEB_LESSON_METAS: PageMeta[] = Object.entries(WEB_LESSON_PAGES).map(([id, l]) => {
  const lesson = seedLesson('web', id)
  const title = lesson?.title ?? id
  const description = lesson?.summary ?? WEB_TOPIC.description
  return {
    path: l.path,
    title: lessonTitle(title, seedCourse('web').title),
    description,
    lesson: { course: 'web', id },
    jsonLd: [breadcrumb([COURSE_LIST.name, COURSE_LIST.path], [WEB_TOPIC.name, WEB_TOPIC.path], [title, l.path]), course(`${WEB_TOPIC.name}：${title}`, description, l.path)],
  }
})

/** Claude Code 工作術有示範影片的情境:一個情境一頁 */
const CLAUDE_CODE_LESSON_METAS: PageMeta[] = Object.entries(CLAUDE_CODE_LESSON_PAGES).map(([id, l]) => {
  const s = CLAUDE_CODE_SCENARIOS[Number(id) - 1]
  return {
    path: l.path,
    title: lessonTitle(s.title, seedCourse('claude-code').title),
    description: s.summary,
    lesson: { course: 'claude-code', id },
    jsonLd: [breadcrumb([COURSE_LIST.name, COURSE_LIST.path], [CLAUDE_CODE_TOPIC.name, CLAUDE_CODE_TOPIC.path], [s.title, l.path]), course(`${CLAUDE_CODE_TOPIC.name}：${s.title}`, s.summary, l.path)],
  }
})

/** 這幾門課原本是主題頁,沿用當時 sitemap 的優先度 */
const PAGE_COURSE_PRIORITY: Record<string, number> = { web: 0.8, launch: 0.3, 'claude-code': 0.9, kids: 0.8 }

const COURSE_PAGES: PageMeta[] = COURSES.flatMap((c) => {
  const courseName = c.title
  const topic = topicOfCourse(coursePath(c))
  const seedId = courseMapId(c)
  // 主題就是這門課自己(網頁怎麼運作等):麵包屑的上一層是全部課程,不連回自己
  const topicCrumb: [string, string] = topic.path === coursePath(c) ? [COURSE_LIST.name, COURSE_LIST.path] : [topic.name, topic.path]
  // 課程總覽頁的搜尋標題、描述、課名與課程清單:build 時沒有 API,讀種子檔 courses_seed.json(資料庫就是從它同步的);
  // 畫面執行時(CourseOverviewPage)讀 API,同一份資料,所以 document.title 與這裡的 <title> 一致
  const seed = seedCourse(seedId)
  const seedLessons = seed.units.flatMap((u) => u.lessons)
  const overviewTitle = seed.title
  const overviewDescription = seed.description || seed.summary || seed.title
  const overview: PageMeta[] = [
        {
          path: coursePath(c),
          title: documentTitle(seed.seoTitle || seed.title),
          description: overviewDescription,
          ...(PAGE_COURSE_PRIORITY[c.slug] !== undefined && { sitemapPriority: PAGE_COURSE_PRIORITY[c.slug] }),
          jsonLd: [
            course(overviewTitle, overviewDescription, coursePath(c)),
            breadcrumb(topicCrumb, [overviewTitle, coursePath(c)]),
            // 課頁在別處產生的課(沒有分階段、前端沒有 lessons:網頁怎麼運作、從做好到上線、Claude Code 工作術):列出每一課
            // (有腳本的課標出課程頁網址,開放了沒有由 server 依資料庫決定)
            ...(!c.stages && seedLessons.length > 0
              ? [
                  ld({
                    '@type': 'ItemList',
                    name: overviewTitle,
                    itemListElement: seedLessons.map((l, i) => ({
                      '@type': 'ListItem',
                      position: i + 1,
                      name: `${l.id} ${l.title}`,
                      ...(l.script && lessonLink(seedId, l.id, lessonUrl(c.slug, l.id))),
                    })),
                  }),
                ]
              : []),
          ],
        },
      ]
  // 分階段的課(做出自己的軟體)的單課:種子裡每一課一頁,不論開放與否(開放與否在執行時由資料庫決定,sitemap 由 server 依資料庫列,build 不判斷);
  // 種子狀態是規劃中的課是規劃中章節頁(標題與執行時 PlannedChapterPage 一致),其餘是單課頁。先不公開(hidden)單元底下的課 noindex
  const seedPages: PageMeta[] = c.stages
    ? seed.units.flatMap((u) =>
        u.lessons.map((lesson): PageMeta => {
          const path = lessonUrl(c.slug, lesson.id)
          const planned = lesson.status === 'planned'
          const name = `${planned ? lesson.id : lessonLabelOf(c.slug, lesson.id)} ${lesson.title}`
          return {
            path,
            title: planned ? documentTitle(name) : lessonTitle(lesson.title, overviewTitle),
            // 課程地圖上的一句話有些太短(序章),接上課程名稱與課名
            description: lesson.summary ? (lesson.summary.length >= 20 ? lesson.summary : `${lesson.summary}${courseName}：${lesson.title}。`) : overviewDescription,
            lesson: { course: seedId, id: lesson.id },
            ogType: 'article',
            ...(u.hidden && { noindex: true }),
            jsonLd: [breadcrumb(topicCrumb, [courseName, coursePath(c)], [name, path])],
          }
        }),
      )
    : []
  // 前端還有的規劃中章節(只有還沒有課程地圖的進階課)
  const planned: PageMeta[] = c.planned.map((ch) => {
    const name = `${ch.label} ${ch.title}`
    return {
      path: plannedChapterPath(c, ch),
      title: documentTitle(name),
      description: ch.summary,
      lesson: { course: seedId, id: ch.id ?? ch.label },
      ogType: 'article' as const,
      jsonLd: [breadcrumb(topicCrumb, [courseName, coursePath(c)], [name, plannedChapterPath(c, ch)])],
    }
  })
  // 先不公開的課(整門課):網址還打得開,但不收錄、不列入 sitemap
  return [...overview, ...seedPages, ...planned].map((p) => (c.hidden ? { ...p, noindex: true } : p))
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

/** 主題「從做好到上線」有課程頁的課(課程總覽頁 /courses/launch 在 COURSE_PAGES);課還沒開放時訪客看到「還沒開放」 */
const LAUNCH_PAGES: PageMeta[] = LAUNCH_LESSON_PAGES.map((id) => {
  const lesson = seedLesson('launch', id)
  const title = lesson?.title ?? id
  return {
    path: launchLessonPath(id),
    title: lessonTitle(title, seedCourse('launch').title),
    // 課程地圖上的一句話有些太短,接上主題與課名
    description: lesson ? `${lesson.summary}${LAUNCH_TOPIC.name}：${title}。` : LAUNCH_TOPIC.description,
    lesson: { course: 'launch', id },
    sitemapPriority: 0.2,
    jsonLd: [breadcrumb([COURSE_LIST.name, COURSE_LIST.path], [LAUNCH_TOPIC.name, LAUNCH_TOPIC.path], [title, launchLessonPath(id)])],
  }
})

/** 展示頁(home/ShowcasePage.tsx):首頁拿掉的影片預覽搬到這裡當行銷頁;站內沒有連結,公開頁一律收錄(pages.test.ts) */
const SHOWCASE_PAGE: PageMeta = {
  path: '/showcase',
  title: documentTitle('課程展示'),
  description: '不用登入，直接播放 evoleap 的互動課程：做出自己的軟體的序章，以及給孩子的網頁程式第一課試做。',
  sitemapPriority: 0.3,
}

export const PAGES: PageMeta[] = [
  HOME,
  SOFTWARE_TOPIC_PAGE,
  AI_APPS_TOPIC_PAGE,
  COURSE_LIST_PAGE,
  ...KIDS_LESSON_METAS,
  ...WEB_LESSON_METAS,
  ...CLAUDE_CODE_LESSON_METAS,
  ...LAUNCH_PAGES,
  SHOWCASE_PAGE,
  ...COURSE_PAGES,
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

export function headTags(page: PageMeta, opts: { keepLessonLinks?: boolean } = {}): HeadTag[] {
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
    tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, text: JSON.stringify(data, opts.keepLessonLinks === false ? (k, v) => (k === 'evoleapLesson' ? undefined : v) : undefined).replace(/</g, '\\u003c') })
  }
  return tags
}
