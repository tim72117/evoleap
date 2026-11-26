import { describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { internalRoutes } from '../studio/StudioApp'
import { isInternalPath } from '../site/internalPaths'
import { SITE_ORIGIN } from '../site/siteInfo'
import { COURSES, courseMapId, coursePath } from '../content/catalog'
import { fixtureCourse as seedCourse } from '../test/courseFixture'
import { hasEnglishPage, localeTarget } from '../i18n/locale'
import { COURSE_PAGES, courseManifest, EN_COURSE_PAGES, EN_PAGES, LESSON_ROUTES, PAGES, renderCourseShell, renderLessonShell, robotsTxt, sitemapPages } from './build'
import { isCoursePage } from './coursePages'
import { findInternalPage } from './internalPages'
import { absoluteUrl, findPage, headTags, NOT_FOUND, PAGES as PUBLIC_PAGES, resolvePage } from './pages'

const indexable = PAGES.filter((p) => !p.noindex)
const INTERNAL_PREFIXES = ['/studio', '/docs', '/materials', '/login', '/admin', '/member']
const isInternal = (path: string) => INTERNAL_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
describe('全部課程', () => {
  it('有 SEO 資料,結構化資料列出每一門有課程頁的課', () => {
    const page = findPage('/courses')!
    expect(page).not.toBe(NOT_FOUND)
    const list = page.jsonLd?.find((x) => x['@type'] === 'ItemList') as { itemListElement: { url: string }[] }
    expect(list.itemListElement.map((x) => x.url)).toContain(absoluteUrl('/topics/ai-apps'))
    expect(list.itemListElement.map((x) => x.url)).toContain(absoluteUrl('/courses/software'))
    // 同一門課的階段只列一次
    const urls = list.itemListElement.map((x) => x.url)
    expect(new Set(urls).size).toBe(urls.length)
  })
})

describe('主題頁', () => {
  const software = findPage('/topics/software')!
  const aiApps = findPage('/topics/ai-apps')!
  const list = (p: typeof software) => p.jsonLd?.find((x) => x['@type'] === 'ItemList') as { itemListElement: { url: string }[] }

  it('每個主題有自己的標題與描述,也和首頁不同', () => {
    const home = findPage('/')!
    expect(new Set([home.title, software.title, aiApps.title]).size).toBe(3)
    expect(new Set([home.description, software.description, aiApps.description]).size).toBe(3)
  })

  it('sitemap 頁面清單列出主題頁與優先度', () => {
    const pages = sitemapPages()
    expect(pages).toContainEqual({ loc: absoluteUrl('/topics/software'), priority: 0.9 })
    expect(pages).toContainEqual({ loc: absoluteUrl('/topics/ai-apps'), priority: 0.9 })
  })

  it('描述不會太長,搜尋結果顯示得完', () => {
    for (const p of [software, aiApps]) expect(p.description.length).toBeLessThanOrEqual(80)
  })

  it('結構化資料列出各自的課程,彼此不重複', () => {
    const urls = (p: typeof software) => list(p).itemListElement.map((x) => x.url)
    expect(urls(software)).toEqual([absoluteUrl('/courses/software')])
    expect(urls(aiApps)).toContain(absoluteUrl('/topics/ai-apps'))
    expect(urls(aiApps)).toContain(absoluteUrl('/courses/advanced'))
    expect(urls(software).filter((u) => urls(aiApps).includes(u))).toEqual([])
  })

  it('AI Agent 中階課沒有自己的頁面:不產生 /courses/ai-agent 與單元頁的 SEO,課程資訊併進主題頁的結構化資料', () => {
    expect(PAGES.some((p) => p.path.startsWith('/courses/ai-agent'))).toBe(false)
    expect(aiApps.jsonLd?.some((x) => x['@type'] === 'Course')).toBe(true)
  })
})

const coursePage = (path: string) => COURSE_PAGES.find((p) => p.path === path)!

describe('課程相關頁面(內容由 server 讀資料庫填,server/cmd/server/courseseo.go)', () => {
  it('不在靜態的 PAGES 裡,網址不重複', () => {
    const paths = COURSE_PAGES.map((p) => p.path)
    expect(new Set(paths).size).toBe(paths.length)
    expect(PAGES.filter((p) => paths.includes(p.path))).toEqual([])
  })

  it('每門課有總覽頁;可以上的課各有一筆單課頁樣板,不列課號', () => {
    for (const c of COURSES) expect(coursePage(coursePath(c))).toMatchObject({ kind: 'overview', course: courseMapId(c), coursePath: coursePath(c) })
    expect(LESSON_ROUTES.map((r) => [r.course, r.coursePath, r.style])).toEqual([
      ['software', '/courses/software', 'staged'],
      ['web', '/courses/web', 'topic'],
      ['launch', '/courses/launch', 'launch'],
      ['kids', '/courses/kids', 'kids'],
      ['claude-code', '/courses/claude-code', 'topic'],
    ])
    // 任何單課網址都算課程頁(有沒有這一課由 server 看資料庫);規劃中的進階課沒有單課頁
    expect(['/courses/web/0-1', '/courses/launch/99-9', '/courses/software/intro'].filter((p) => !isCoursePage(p))).toEqual([])
    expect(['/courses/advanced/nope', '/courses/nope/1', '/courses/web/a/b', '/courses/web/x.png'].filter(isCoursePage)).toEqual([])
  })

  it('單課頁的 HTML 樣板:canonical 與 og:url 留著網址空位', () => {
    const shell = renderLessonShell('<head><title>x</title></head>', LESSON_ROUTES[0])
    expect(shell).toContain(`rel="canonical" href="${absoluteUrl('/courses/software')}/%SEO_SLUG%"`)
    expect(shell).toContain('%SEO_TITLE%')
    expect(shell).toContain('content="article"')
  })

  it('舊網址與 AI Agent 中階課沒有頁面', () => {
    expect(COURSE_PAGES.filter((p) => /^\/courses\/(tools|ai-tools|vibe-coding|ai-agent)(\/|$)/.test(p.path))).toEqual([])
  })

  it('HTML 只留空位,不寫任何課程內容;固定的標籤(canonical、hreflang)照常', () => {
    const shell = renderCourseShell('<html lang="zh-Hant"><head><title>x</title></head></html>', coursePage('/courses/web'))
    expect(shell).toContain('<title>%SEO_TITLE%</title>')
    expect(shell).toMatch(/<meta name="description" content="%SEO_DESCRIPTION%" data-seo><!--seo:robots-->/)
    expect(shell).toContain('<!--seo:jsonld--></head>')
    expect(shell).toContain(`rel="canonical" href="${absoluteUrl('/courses/web')}"`)
    expect(shell).toContain(`href="${absoluteUrl('/en/courses/web')}"`)
    expect(shell).not.toContain('ld+json')
    expect(shell).not.toContain(seedCourse('web').title)
    expect(courseManifest().pages).toEqual([...COURSE_PAGES, ...EN_COURSE_PAGES])
  })

  it('換頁時向 server 讀:沒有這一頁是 NOT_FOUND,讀不到是 null,/en 的單課頁 noindex', async () => {
    const page = { path: '/courses/web/0-1', title: 't', description: 'd' }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(page)))
    vi.stubGlobal('fetch', fetchMock)
    expect(await resolvePage('/courses/web/0-1/')).toEqual(page)
    expect(await resolvePage('/en/courses/web/0-1')).toEqual({ ...page, noindex: true })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/seo/page?path=%2Fcourses%2Fweb%2F0-1', expect.anything())
    fetchMock.mockImplementation(async () => new Response('', { status: 404 }))
    expect(await resolvePage('/courses/web')).toBe(NOT_FOUND)
    fetchMock.mockImplementation(async () => new Response('', { status: 503 }))
    expect(await resolvePage('/courses/web')).toBeNull()
    // 英文課程總覽用自己的網址向 server 讀(有沒有英文版由 server 決定),不另加 noindex
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ...page, path: '/en/courses/web', lang: 'en' })))
    expect(await resolvePage('/en/courses/web')).toEqual({ ...page, path: '/en/courses/web', lang: 'en' })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/seo/page?path=%2Fen%2Fcourses%2Fweb', expect.anything())
    // 不是課程頁(含課程清單的英文頁)不打 API
    fetchMock.mockClear()
    expect((await resolvePage('/en/courses'))?.lang).toBe('en')
    expect(await resolvePage('/privacy')).toBe(findPage('/privacy'))
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('PAGES', () => {
  it('paths are unique', () => {
    const paths = PAGES.map((p) => p.path)
    expect(paths.filter((p, i) => paths.indexOf(p) !== i)).toEqual([])
  })

  it.each(PAGES.map((p) => p.path))('%s is a clean site path', (path) => {
    expect(path.startsWith('/')).toBe(true)
    if (path !== '/') expect(path.endsWith('/')).toBe(false)
    expect(path.split('/').pop()).not.toContain('.')
  })

  it('titles are unique among indexable pages', () => {
    const titles = indexable.map((p) => p.title)
    expect(titles.filter((t, i) => titles.indexOf(t) !== i)).toEqual([])
  })

  it.each(indexable.map((p) => [p.path, p.description] as const))('%s has a 20–160 char description', (_, d) => {
    expect(d.trim()).toBe(d)
    expect(d.length).toBeGreaterThanOrEqual(20)
    expect(d.length).toBeLessThanOrEqual(160)
  })

  it('every page has a non-empty title and description', () => {
    for (const p of PAGES) {
      expect(p.title.trim(), p.path).not.toBe('')
      expect(p.description.trim(), p.path).not.toBe('')
    }
  })

  it('internal prefixes are noindex, public pages are indexable', () => {
    for (const p of PAGES) expect(!!p.noindex, p.path).toBe(isInternal(p.path))
  })

  it('home and the course pages are indexable', () => {
    expect(indexable.map((p) => p.path)).toEqual(expect.arrayContaining(['/', '/courses', '/privacy', '/terms', '/refund']))
  })
})

describe('公開與內部資料分開', () => {
  it('公開的 PAGES 不列研發基地的內部頁', () => {
    expect(PUBLIC_PAGES.filter((p) => isInternalPath(p.path)).map((p) => p.path)).toEqual([])
  })

  it('findInternalPage 找得到內部頁,結尾斜線視為同一頁', () => {
    expect(findInternalPage('/studio').path).toBe('/studio')
    expect(findInternalPage('/studio/').path).toBe('/studio')
    expect(findInternalPage('/studio/no-such-page')).toBe(NOT_FOUND)
  })
})

describe('URL helpers', () => {
  it('absoluteUrl uses https://evoleap.io', () => {
    expect(SITE_ORIGIN).toBe('https://evoleap.io')
    expect(absoluteUrl('/')).toBe('https://evoleap.io/')
    expect(absoluteUrl('/courses/software')).toBe('https://evoleap.io/courses/software')
  })

  it('findPage ignores a trailing slash and falls back to NOT_FOUND', () => {
    expect(findPage('/').path).toBe('/')
    expect(findPage('/courses/').path).toBe('/courses')
    expect(findPage('/no-such-page')).toBe(NOT_FOUND)
  })

  it('canonical / og:url point at the absolute URL; robots noindex only on noindex pages', () => {
    for (const p of PAGES) {
      const tags = headTags(p)
      const canonical = tags.find((t) => t.tag === 'link' && t.attrs.rel === 'canonical')
      expect(canonical?.attrs.href, p.path).toBe(absoluteUrl(p.path))
      expect(canonical?.attrs.href.startsWith('https://evoleap.io')).toBe(true)
      const robots = tags.find((t) => t.tag === 'meta' && t.attrs.name === 'robots')
      expect(!!robots, p.path).toBe(!!p.noindex)
    }
  })

  it('NOT_FOUND has no canonical and is noindex', () => {
    const tags = headTags(NOT_FOUND)
    expect(tags.some((t) => t.tag === 'link' && t.attrs.rel === 'canonical')).toBe(false)
    expect(tags.some((t) => t.tag === 'meta' && t.attrs.name === 'robots')).toBe(true)
  })

  it('JSON-LD is escaped and parses', () => {
    for (const p of PAGES)
      for (const t of headTags(p))
        if (t.tag === 'script') {
          expect(t.text).not.toContain('<')
          expect(() => JSON.parse(t.text)).not.toThrow()
        }
  })
})

describe('sitemap 頁面清單(sitemap-pages.json)', () => {
  const pages = sitemapPages()

  it('只有可收錄的頁面:不含 noindex 與內部頁,網址不重複', () => {
    const fixed = pages.filter((p) => !p.lessonsOf)
    expect(fixed.map((p) => p.loc)).toEqual([...PAGES, ...COURSE_PAGES, ...EN_PAGES, ...EN_COURSE_PAGES].filter((p) => !p.noindex).map((p) => absoluteUrl(p.path)))
    expect(new Set(fixed.map((p) => p.loc)).size).toBe(fixed.length)
    for (const p of pages) expect(isInternal(new URL(p.loc).pathname), p.loc).toBe(false)
  })

  it('單課頁不逐課列出:一門課一筆,由 server 依資料庫展開(開放、且單元沒有先不公開)', () => {
    expect(pages.filter((p) => p.lessonsOf).map((p) => p.lessonsOf!.course)).toEqual(LESSON_ROUTES.filter((r) => !r.noindex).map((r) => r.course))
    expect(pages).toContainEqual({ loc: absoluteUrl('/courses/software'), lessonsOf: { course: 'software', staged: true } })
    expect(pages).toContainEqual({ loc: absoluteUrl('/courses/launch'), priority: 0.2, lessonsOf: { course: 'launch' } })
    expect(pages).toContainEqual(expect.objectContaining({ loc: absoluteUrl('/courses/kids'), priority: 0.8 }))
  })

  it('priorities are within 0–1', () => {
    for (const p of pages) {
      if (p.priority === undefined) continue
      expect(p.priority).toBeGreaterThanOrEqual(0)
      expect(p.priority).toBeLessThanOrEqual(1)
    }
  })
})

describe('robots.txt', () => {
  const txt = robotsTxt()
  it('points at the sitemap and does not block the site', () => {
    expect(txt).toContain('Sitemap: https://evoleap.io/sitemap.xml')
    expect(txt).toContain('User-agent: *')
    expect(txt).not.toMatch(/^Disallow:\s*\/\s*$/m)
  })
})

describe('routes ↔ PAGES', () => {
  const routePaths = [...routes, ...internalRoutes].map((r) => r.path)
  const pagePaths = [...[...PAGES, ...COURSE_PAGES].map((p) => p.path), ...LESSON_ROUTES.map((r) => `${r.coursePath}/:lesson`)]

  it('route paths are unique', () => {
    expect(routePaths.filter((p, i) => routePaths.indexOf(p) !== i)).toEqual([])
  })

  it('every route has a PAGES entry', () => {
    expect(routePaths.filter((p) => !pagePaths.includes(p))).toEqual([])
  })

  it('every PAGES entry has a route', () => {
    expect(pagePaths.filter((p) => !routePaths.includes(p))).toEqual([])
  })
})

describe('英文版(/en/...)', () => {
  const en = sitemapPages().filter((p) => p.loc.startsWith(absoluteUrl('/en/')))

  const enAll = [...EN_PAGES, ...EN_COURSE_PAGES.map((p) => ({ path: p.path, lang: p.lang, title: 't', description: 'd' }))]
  const alternates = (p: Parameters<typeof headTags>[0]) => headTags(p).filter((t) => t.tag === 'link' && t.attrs.rel === 'alternate')

  it('課程清單與每門課的總覽有英文頁,各自有 canonical 與 hreflang(中文頁與英文頁互相指)', () => {
    expect(en.map((p) => p.loc)).toContain(absoluteUrl('/en/courses'))
    expect(en.map((p) => p.loc)).toContain(absoluteUrl('/en/courses/web'))
    for (const p of enAll) expect(alternates(p).map((t) => t.attrs.hreflang), p.path).toEqual(['zh-Hant', 'en', 'x-default'])
    const zh = alternates({ path: '/courses/web', title: 't', description: 'd' })
    expect(zh.map((t) => t.attrs.href)).toContain(absoluteUrl('/en/courses/web'))
    // server 說這門課沒有英文版:不放 hreflang
    expect(alternates({ path: '/courses/web', title: 't', description: 'd', noEnglish: true })).toEqual([])
  })

  it('英文課程總覽不寫任何課程內容:只留空位,哪一課有英文版由 server 看資料庫', () => {
    const entry = EN_COURSE_PAGES.find((p) => p.path === '/en/courses/web')!
    const shell = renderCourseShell('<html lang="zh-Hant"><head><title>x</title></head></html>', entry)
    expect(shell).toContain('<html lang="en">')
    expect(shell).toContain('<title>%SEO_TITLE%</title>')
    expect(shell).toContain(`rel="canonical" href="${absoluteUrl('/en/courses/web')}"`)
    expect(en).toContainEqual(expect.objectContaining({ loc: absoluteUrl('/en/courses/web'), english: 'web', englishOnly: true }))
    expect(sitemapPages()).toContainEqual(expect.objectContaining({ loc: absoluteUrl('/courses/web'), english: 'web' }))
  })

  it('沒有英文版的 /en/... 頁用中文頁的資料並 noindex;英文頁不在中文路由裡', () => {
    expect(findPage('/en/login').noindex).toBe(true)
    expect(findPage('/en/nope')).toBe(NOT_FOUND)
    expect(enAll.every((p) => p.lang === 'en' && !routes.some((r) => r.path === p.path))).toBe(true)
  })
  it('語言切換的判斷(locale.ts)與英文頁清單一致:每個英文頁都換得過去,/en/ 底下不是英文頁的路徑不會被導去', () => {
    for (const p of enAll) {
      const zhPath = p.path.slice('/en'.length)
      expect(hasEnglishPage(zhPath)).toBe(true)
      expect(localeTarget('en', zhPath)).toBe(p.path)
    }
    expect(localeTarget('en', '/login')).toBeNull()
  })
})
