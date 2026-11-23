import { describe, expect, it } from 'vitest'
import { routes } from '../App'
import { internalRoutes } from '../studio/StudioApp'
import { isInternalPath } from '../site/internalPaths'
import { KIDS_LESSON_PAGES } from '../content/kidsCourse'
import { SITE_ORIGIN } from '../site/siteInfo'
import { COURSES, courseMapId, coursePath, lessonUrl } from '../content/catalog'
import { seedCourse } from '../content/courseSeed'
import { documentTitle } from '../site/siteInfo'
import { PAGES, robotsTxt, sitemapPages } from './build'
import { findInternalPage } from './internalPages'
import { absoluteUrl, findPage, headTags, NOT_FOUND, PAGES as PUBLIC_PAGES } from './pages'

const indexable = PAGES.filter((p) => !p.noindex)
const INTERNAL_PREFIXES = ['/studio', '/docs', '/materials', '/login', '/admin', '/member']
const isInternal = (path: string) => INTERNAL_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
// 先不公開(hidden)的課,或先不公開的階段(software 的零基礎 ai-tools)底下的課:網址打得開但 noindex
const HIDDEN_COURSE_PATHS = COURSES.filter((c) => c.hidden).map(coursePath)
const HIDDEN_STAGE_PATHS = COURSES.flatMap((c) => (c.stages ?? []).filter((st) => st.hidden).flatMap((st) => seedCourse(c.slug).units.find((u) => u.id === st.id)!.lessons.map((l) => lessonUrl(c.slug, l.id))))
const isHiddenCourse = (path: string) => HIDDEN_COURSE_PATHS.some((p) => path === p || path.startsWith(p + '/')) || HIDDEN_STAGE_PATHS.includes(path)

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

  it('課程的麵包屑掛在所屬主題底下', () => {
    const crumbs = (path: string) => JSON.stringify(findPage(path)!.jsonLd?.find((x) => x['@type'] === 'BreadcrumbList'))
    expect(crumbs('/courses/software/1')).toContain('/topics/software')
    expect(crumbs('/courses/advanced')).toContain('/topics/ai-apps')
  })

  it('AI Agent 中階課沒有自己的頁面:不產生 /courses/ai-agent 與單元頁的 SEO,課程資訊併進主題頁的結構化資料', () => {
    expect(PAGES.some((p) => p.path.startsWith('/courses/ai-agent'))).toBe(false)
    expect(aiApps.jsonLd?.some((x) => x['@type'] === 'Course')).toBe(true)
  })
})

describe('網頁怎麼運作、從做好到上線、Claude Code 工作術:課程總覽頁在 /courses/<課程>', () => {
  const cases = [
    { slug: 'web', priority: 0.8, lesson: '/courses/web/1-2', id: '1.2' },
    { slug: 'launch', priority: 0.3, lesson: '/courses/launch/0-1', id: '0.1' },
    { slug: 'claude-code', priority: 0.9, lesson: '/courses/claude-code/2', id: '2' },
  ]

  it('總覽頁各有 SEO 資料,沿用主題頁的標題與描述;/topics/ 底下沒有頁面(舊網址由伺服器與前端轉址)', () => {
    for (const c of cases) {
      const page = findPage(`/courses/${c.slug}`)
      expect(page, c.slug).not.toBe(NOT_FOUND)
      expect(page.noindex).toBeFalsy()
      expect(page.sitemapPriority).toBe(c.priority)
      expect(PAGES.filter((p) => p.path === `/courses/${c.slug}`)).toHaveLength(1)
    }
    expect(findPage('/courses/web').title).toContain('網頁怎麼運作：AI 時代的網頁基礎課')
    expect(PAGES.filter((p) => /^\/topics\/(web|launch|claude-code)(\/|$)/.test(p.path))).toEqual([])
  })

  it('總覽頁的麵包屑接全部課程(不連回自己),課頁的麵包屑是全部課程 → 課程 → 這一課;結構化資料列出每一課', () => {
    type Item = { name: string; evoleapLesson?: { course: string; id: string; url: string } }
    const crumb = (path: string) => JSON.stringify(findPage(path).jsonLd?.find((x) => x['@type'] === 'BreadcrumbList'))
    for (const c of cases) {
      expect(crumb(`/courses/${c.slug}`)).toContain(absoluteUrl('/courses'))
      expect(crumb(c.lesson)).toContain(absoluteUrl(`/courses/${c.slug}`))
      expect(findPage(c.lesson).lesson).toEqual({ course: c.slug, id: c.id })
      const list = findPage(`/courses/${c.slug}`).jsonLd?.find((x) => x['@type'] === 'ItemList') as { itemListElement: Item[] }
      expect(list.itemListElement.find((x) => x.evoleapLesson?.id === c.id)?.evoleapLesson?.url).toBe(absoluteUrl(c.lesson))
    }
  })
})

describe('兒童課(給孩子的網頁程式)', () => {
  const topic = findPage('/courses/kids')!
  const lesson = findPage('/courses/kids/0-1')!

  it('主題頁與課程頁都有 SEO 資料,標題、描述和其他主題不同', () => {
    expect(topic).not.toBe(NOT_FOUND)
    expect(lesson).not.toBe(NOT_FOUND)
    const others = ['/', '/topics/software', '/topics/ai-apps', '/courses/claude-code'].map((p) => findPage(p)!)
    expect(others.map((p) => p.title)).not.toContain(topic.title)
    expect(others.map((p) => p.description)).not.toContain(topic.description)
    expect(topic.description.length).toBeLessThanOrEqual(80)
  })

  it('sitemap 頁面清單列出主題頁與課頁(課頁標著是哪一課,開放與否由後端依資料庫決定)', () => {
    const pages = sitemapPages()
    expect(pages).toContainEqual({ loc: absoluteUrl('/courses/kids'), priority: 0.8 })
    expect(pages.find((p) => p.loc === absoluteUrl('/courses/kids/0-1'))?.lesson).toEqual({ course: 'kids', id: '0.1' })
  })

  it('主題頁的結構化資料列出每一課,有課程頁的課標出網址(附不附 url 由 server 依資料庫決定);課程頁的麵包屑掛在主題底下', () => {
    type Item = { name: string; url?: string; evoleapLesson?: { course: string; id: string; url: string } }
    const list = topic.jsonLd?.find((x) => x['@type'] === 'ItemList') as { itemListElement: Item[] }
    const item = (id: string) => list.itemListElement.find((x) => x.name.startsWith(id))!
    // build 不判斷開放與否:不直接寫 url,只標這一課與課程頁網址
    for (const x of list.itemListElement) expect(x.url, x.name).toBeUndefined()
    expect(item('0.1').evoleapLesson).toEqual({ course: 'kids', id: '0.1', url: absoluteUrl('/courses/kids/0-1') })
    expect(item('3.1').evoleapLesson).toEqual({ course: 'kids', id: '3.1', url: absoluteUrl('/courses/kids/3-1') })
    // 標記的是種子有掛腳本的課(4.1 起課程頁寫好了,但正式機是規劃中、種子沒有腳本,不標);都有課程頁(KIDS_LESSON_PAGES)
    const marked = list.itemListElement.filter((x) => x.evoleapLesson)
    expect(marked.length).toBeGreaterThan(0)
    for (const x of marked) expect(Object.keys(KIDS_LESSON_PAGES), x.name).toContain(x.evoleapLesson!.id)
    expect(item('4.1').evoleapLesson).toBeUndefined()
    expect(JSON.stringify(lesson.jsonLd?.find((x) => x['@type'] === 'BreadcrumbList'))).toContain('/courses/kids')
    expect(lesson.jsonLd?.some((x) => x['@type'] === 'Course')).toBe(true)
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
    for (const p of PAGES) expect(!!p.noindex, p.path).toBe(isInternal(p.path) || isHiddenCourse(p.path))
  })

  it('home and the course pages are indexable', () => {
    expect(indexable.map((p) => p.path)).toEqual(expect.arrayContaining(['/', '/courses/software', '/privacy', '/terms', '/refund']))
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
    expect(findPage('/courses/software/').path).toBe('/courses/software')
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
    expect(pages.map((p) => p.loc)).toEqual(PAGES.filter((p) => !p.noindex).map((p) => absoluteUrl(p.path)))
    expect(new Set(pages.map((p) => p.loc)).size).toBe(pages.length)
    for (const p of pages) expect(isInternal(new URL(p.loc).pathname), p.loc).toBe(false)
  })

  it('software:總覽頁與起步、基礎階段的課可收錄,零基礎(先不公開)階段的課 noindex、不列 sitemap', () => {
    const locs = pages.map((p) => p.loc)
    expect(locs).toContain(absoluteUrl('/courses/software'))
    expect(locs).toContain(absoluteUrl('/courses/software/1'))
    expect(locs).toContain(absoluteUrl('/courses/software/5-2'))
    expect(locs).not.toContain(absoluteUrl('/courses/software/1-0'))
    expect(PAGES.find((p) => p.path === '/courses/software/1-1')?.noindex).toBe(true)
    expect(PAGES.find((p) => p.path === '/courses/software')?.noindex).toBeFalsy()
  })

  it('課頁標著是哪一課(後端依資料庫決定收不收);還沒開放的課頁本身不加 noindex', () => {
    const lessons = pages.filter((p) => p.lesson)
    expect(lessons.length).toBeGreaterThan(0)
    for (const p of lessons) expect(p.lesson, p.loc).toEqual({ course: expect.any(String), id: expect.any(String) })
    expect(PAGES.find((p) => p.path === '/courses/launch/2-1')?.noindex).toBeFalsy()
    // AI 工具介紹第 0 課(原 Vibe Coding 入門 4.2)已上架;原本的第 0～2 課往後成為第 1～3 課,沒有第 4 課
    // 三門課合併成 software:課程 id 是 software,課號不變
    expect(PAGES.find((p) => p.path === '/courses/software/0')?.lesson).toEqual({ course: 'software', id: '0.0' })
    expect(PAGES.find((p) => p.path === '/courses/software/3')?.lesson).toEqual({ course: 'software', id: '0.3' })
    expect(PAGES.find((p) => p.path === '/courses/software/1-0')?.lesson).toEqual({ course: 'software', id: '1.0' })
    expect(PAGES.find((p) => p.path === '/courses/software/5-2')?.lesson).toEqual({ course: 'software', id: '5.2' })
    expect(PAGES.some((p) => p.path === '/courses/software/4')).toBe(false)
    // 舊網址不是頁面(伺服器 301、前端轉址),SEO 資料與 sitemap 不列
    expect(PAGES.filter((p) => /^\/courses\/(tools|ai-tools|vibe-coding)(\/|$)/.test(p.path))).toEqual([])
    // Vibe Coding 入門拿掉的章節沒有頁面
    expect(['/courses/software/4-1', '/courses/software/4-2', '/courses/software/4-4', '/courses/software/5-1'].map((p) => PAGES.some((x) => x.path === p))).toEqual([false, false, false, false])
    // 兒童課 4.1 起課程頁寫好了、正式機是規劃中:頁面標著是哪一課,本身不加 noindex(收不收由後端依資料庫決定)
    expect(PAGES.find((p) => p.path === '/courses/kids/4-1')?.lesson).toEqual({ course: 'kids', id: '4.1' })
    expect(PAGES.find((p) => p.path === '/courses/kids/4-1')?.noindex).toBeFalsy()
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
  const pagePaths = PAGES.map((p) => p.path)

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

// build 時沒有 API:課程總覽頁的搜尋標題、描述與先不公開的單元,讀資料庫種子(courses_seed.json);執行時畫面讀 API,是同一份資料
describe('課程總覽頁的 SEO 來自種子', () => {
  it('每一門有通用總覽頁的課:標題是 seoTitle(沒有就課名)、描述是 description(沒有就簡介)', () => {
    for (const c of COURSES) {
      const seed = seedCourse(courseMapId(c))
      const page = findPage(coursePath(c))
      expect(page, c.slug).not.toBe(NOT_FOUND)
      expect(page.title, c.slug).toBe(documentTitle(seed.seoTitle || seed.title))
      expect(page.description, c.slug).toBe(seed.description || seed.summary || seed.title)
    }
  })

  it('先不公開(hidden)的單元底下的課 noindex,其他單元的課收錄', () => {
    const software = COURSES.find((c) => c.slug === 'software')!
    const hiddenIds = seedCourse('software').units.filter((u) => u.hidden).flatMap((u) => u.lessons.map((l) => l.id))
    expect(hiddenIds.length).toBeGreaterThan(0)
    const seedLessons = seedCourse('software').units.flatMap((u) => u.lessons)
    // 每個種子課都有一頁 SEO 資料(不論開放與否)
    for (const l of seedLessons) {
      const page = findPage(lessonUrl('software', l.id))
      expect(page, l.id).not.toBe(NOT_FOUND)
      expect(Boolean(page.noindex), l.id).toBe(hiddenIds.includes(l.id))
      expect(page.lesson, l.id).toEqual({ course: 'software', id: l.id })
      // 一句話太短(序章)的接上課程名稱與課名
      expect(page.description, l.id).toBe(l.summary.length >= 20 ? l.summary : `${l.summary}${software.title}：${l.title}。`)
    }
    expect(software.stages!.length).toBeGreaterThan(0)
    // 總覽頁本身照常收錄
    expect(findPage('/courses/software').noindex).toBeFalsy()
  })

  it('沒有分階段、有課頁的課(web、launch、claude-code):結構化資料的清單是種子的每一課,有腳本的課帶課頁網址', () => {
    for (const slug of ['web', 'launch', 'claude-code']) {
      const list = findPage(`/courses/${slug}`).jsonLd?.find((x) => x['@type'] === 'ItemList') as { itemListElement: { name: string; evoleapLesson?: { id: string; url: string } }[] }
      const lessons = seedCourse(slug).units.flatMap((u) => u.lessons)
      expect(list.itemListElement.map((x) => x.name)).toEqual(lessons.map((l) => `${l.id} ${l.title}`))
      expect(list.itemListElement.filter((x) => x.evoleapLesson).map((x) => x.evoleapLesson!.id)).toEqual(lessons.filter((l) => l.script).map((l) => l.id))
    }
  })
})

describe('單課頁的課名與描述讀課程種子', () => {
  it('兒童課、網頁怎麼運作、從做好到上線的單課頁:標題含種子課名,描述是種子的一句話(太短的接上主題與課名)', () => {
    for (const course of ['kids', 'web', 'launch']) {
      const lessons = seedCourse(course).units.flatMap((u) => u.lessons)
      const pages = PUBLIC_PAGES.filter((p) => p.lesson?.course === course)
      expect(pages.length, course).toBeGreaterThan(0)
      for (const p of pages) {
        const s = lessons.find((l) => l.id === p.lesson!.id)!
        expect(s, `${course} ${p.lesson!.id} 種子有這一課`).toBeDefined()
        expect(p.title, p.path).toContain(s.title)
        expect(p.description, p.path).toContain(s.summary)
      }
    }
  })
})
