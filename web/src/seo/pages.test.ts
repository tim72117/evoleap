import { describe, expect, it } from 'vitest'
import { routes } from '../App'
import { internalRoutes } from '../studio/StudioApp'
import { isInternalPath } from '../site/internalPaths'
import { SITE_ORIGIN } from '../site/siteInfo'
import { inSitemap, PAGES, robotsTxt, sitemapXml } from './build'
import { findInternalPage } from './internalPages'
import { absoluteUrl, findPage, headTags, NOT_FOUND, PAGES as PUBLIC_PAGES } from './pages'

const indexable = PAGES.filter((p) => !p.noindex)
const INTERNAL_PREFIXES = ['/studio', '/docs', '/materials', '/login', '/admin', '/member']
const isInternal = (path: string) => INTERNAL_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))

describe('全部課程', () => {
  it('有 SEO 資料,結構化資料列出每一門有課程頁的課', () => {
    const page = findPage('/courses')!
    expect(page).not.toBe(NOT_FOUND)
    const list = page.jsonLd?.find((x) => x['@type'] === 'ItemList') as { itemListElement: { url: string }[] }
    // 「做出自己的軟體」的三個階段連到同一頁的階段錨點(#stage-<id>),比對時去掉錨點
    const urls = list.itemListElement.map((x) => x.url.split('#')[0])
    expect(urls).toContain(absoluteUrl('/courses/ai-agent'))
    expect(urls).toContain(absoluteUrl('/courses/software'))
  })
})

describe('主題頁', () => {
  const software = findPage('/courses/software')!
  const aiApps = findPage('/courses/ai-apps')!
  const list = (p: typeof software) => p.jsonLd?.find((x) => x['@type'] === 'ItemList') as { itemListElement: { url: string }[] }

  it('每個主題有自己的標題與描述,也和首頁不同', () => {
    const home = findPage('/')!
    expect(new Set([home.title, software.title, aiApps.title]).size).toBe(3)
    expect(new Set([home.description, software.description, aiApps.description]).size).toBe(3)
  })

  it('sitemap 列出主題頁與優先度', () => {
    const xml = sitemapXml()
    expect(xml).toContain(`<loc>${absoluteUrl('/courses/software')}</loc><priority>0.9</priority>`)
    expect(xml).toContain(`<loc>${absoluteUrl('/courses/ai-apps')}</loc><priority>0.9</priority>`)
  })

  it('描述不會太長,搜尋結果顯示得完', () => {
    for (const p of [software, aiApps]) expect(p.description.length).toBeLessThanOrEqual(80)
  })

  it('結構化資料列出各自的課程,彼此不重複', () => {
    const urls = (p: typeof software) => list(p).itemListElement.map((x) => x.url.split('#')[0])
    expect(urls(software)).toContain(absoluteUrl('/courses/software'))
    expect(urls(aiApps)).toContain(absoluteUrl('/courses/ai-agent'))
    expect(urls(software).filter((u) => urls(aiApps).includes(u))).toEqual([])
  })

  it('課程的麵包屑掛在所屬主題底下', () => {
    const crumbs = (path: string) => JSON.stringify(findPage(path)!.jsonLd?.find((x) => x['@type'] === 'BreadcrumbList'))
    expect(crumbs('/courses/software/1')).toContain('/topics/software')
    expect(crumbs('/courses/ai-agent')).toContain('/courses/ai-apps')
  })
})

describe('兒童課(給孩子的網頁程式)', () => {
  const topic = findPage('/courses/kids')!
  const lesson = findPage('/courses/kids/0-1')!

  it('主題頁與課程頁都有 SEO 資料,標題、描述和其他主題不同', () => {
    expect(topic).not.toBe(NOT_FOUND)
    expect(lesson).not.toBe(NOT_FOUND)
    const others = ['/', '/courses/software', '/courses/ai-apps', '/courses/claude-code'].map((p) => findPage(p)!)
    expect(others.map((p) => p.title)).not.toContain(topic.title)
    expect(others.map((p) => p.description)).not.toContain(topic.description)
    expect(topic.description.length).toBeLessThanOrEqual(80)
  })

  it('sitemap 列出主題頁與已經可以上的課', () => {
    const xml = sitemapXml()
    expect(xml).toContain(`<loc>${absoluteUrl('/courses/kids')}</loc><priority>0.8</priority>`)
    expect(xml).toContain(`<loc>${absoluteUrl('/courses/kids/0-1')}</loc>`)
  })

  it('主題頁的結構化資料列出每一課,可以上的課附網址;課程頁的麵包屑掛在主題底下', () => {
    const list = topic.jsonLd?.find((x) => x['@type'] === 'ItemList') as { itemListElement: { name: string; url?: string }[] }
    expect(list.itemListElement.find((x) => x.name.startsWith('0.1'))?.url).toBe(absoluteUrl('/courses/kids/0-1'))
    expect(list.itemListElement.find((x) => x.name.startsWith('0.2'))?.url).toBe(absoluteUrl('/courses/kids/0-2'))
    expect(list.itemListElement.find((x) => x.name.startsWith('0.3'))?.url).toBe(absoluteUrl('/courses/kids/0-3'))
    expect(list.itemListElement.find((x) => x.name.startsWith('1.1'))?.url).toBe(absoluteUrl('/courses/kids/1-1'))
    // 草稿的課(2.1 起,管理員才看得到)不附網址
    expect(list.itemListElement.find((x) => x.name.startsWith('2.1'))?.url).toBeUndefined()
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
    for (const p of PAGES) expect(!!p.noindex, p.path).toBe(isInternal(p.path))
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

describe('sitemap.xml', () => {
  const xml = sitemapXml()
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1])

  it('is well-formed', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true)
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
    expect((xml.match(/<url>/g) ?? []).length).toBe((xml.match(/<\/url>/g) ?? []).length)
    // 沒有未跳脫的 &
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/)
  })

  it('contains exactly the indexable pages, except lessons that are not open yet', () => {
    expect(locs).toEqual(PAGES.filter(inSitemap).map((p) => absoluteUrl(p.path)))
    expect(new Set(locs).size).toBe(locs.length)
    for (const loc of locs) expect(isInternal(new URL(loc).pathname), loc).toBe(false)
  })

  // 還沒開放的課(courses_seed.json 的 draft、planned)可以收錄,但不放進 sitemap
  it('leaves out lessons that are not open yet, without noindex', () => {
    const has = (path: string) => locs.includes(absoluteUrl(path))
    expect([has('/courses/launch/0-1'), has('/courses/launch/1-1'), has('/courses/launch/2-1'), has('/courses/software/1'), has('/courses/software/1-1'), has('/courses/software/4-1')]).toEqual([true, true, false, true, false, false])
    expect(PAGES.find((p) => p.path === '/courses/launch/2-1')?.noindex).toBeFalsy()
    // 兒童課:序章與單元 1 開放,2.1 起是草稿
    expect([has('/courses/kids/0-1'), has('/courses/kids/1-1'), has('/courses/kids/2-1'), has('/courses/kids/4-5')]).toEqual([true, true, false, false])
    expect(PAGES.find((p) => p.path === '/courses/kids/2-1')?.noindex).toBeFalsy()
  })

  it('priorities are within 0–1', () => {
    for (const m of xml.matchAll(/<priority>([^<]*)<\/priority>/g)) {
      const v = Number(m[1])
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
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
