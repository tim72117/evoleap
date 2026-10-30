import { describe, expect, it } from 'vitest'
import { routes } from '../App'
import { SITE_ORIGIN } from '../site/siteInfo'
import { robotsTxt, sitemapXml } from './build'
import { absoluteUrl, findPage, headTags, NOT_FOUND, PAGES } from './pages'

const indexable = PAGES.filter((p) => !p.noindex)
const INTERNAL_PREFIXES = ['/proposal', '/docs', '/materials', '/login']
const isInternal = (path: string) => INTERNAL_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))

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
    expect(indexable.map((p) => p.path)).toEqual(expect.arrayContaining(['/', '/courses/tools', '/privacy', '/terms']))
  })
})

describe('URL helpers', () => {
  it('absoluteUrl uses https://shuttle.tools', () => {
    expect(SITE_ORIGIN).toBe('https://shuttle.tools')
    expect(absoluteUrl('/')).toBe('https://shuttle.tools/')
    expect(absoluteUrl('/courses/tools')).toBe('https://shuttle.tools/courses/tools')
  })

  it('findPage ignores a trailing slash and falls back to NOT_FOUND', () => {
    expect(findPage('/').path).toBe('/')
    expect(findPage('/courses/tools/').path).toBe('/courses/tools')
    expect(findPage('/no-such-page')).toBe(NOT_FOUND)
  })

  it('canonical / og:url point at the absolute URL; robots noindex only on noindex pages', () => {
    for (const p of PAGES) {
      const tags = headTags(p)
      const canonical = tags.find((t) => t.tag === 'link' && t.attrs.rel === 'canonical')
      expect(canonical?.attrs.href, p.path).toBe(absoluteUrl(p.path))
      expect(canonical?.attrs.href.startsWith('https://shuttle.tools')).toBe(true)
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

  it('contains exactly the indexable pages', () => {
    expect(locs).toEqual(indexable.map((p) => absoluteUrl(p.path)))
    expect(new Set(locs).size).toBe(locs.length)
    for (const loc of locs) expect(isInternal(new URL(loc).pathname), loc).toBe(false)
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
    expect(txt).toContain('Sitemap: https://shuttle.tools/sitemap.xml')
    expect(txt).toContain('User-agent: *')
    expect(txt).not.toMatch(/^Disallow:\s*\/\s*$/m)
  })
})

describe('routes ↔ PAGES', () => {
  const routePaths = routes.map((r) => r.path)
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
