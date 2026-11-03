// SEO 與 server 回應的回歸測試:sitemap 每一頁的 <head>、內部頁 noindex、robots.txt、
// 404/301、快取標頭。全部是 HTTP 請求(不開瀏覽器頁面),只在 desktop project 跑一次。
import { expect, test } from '@playwright/test'
import { desktopOnly, distPagePaths, isInternal, ORIGIN, parseHead, sitemapPaths } from './support'

test.beforeEach(({}, testInfo) => {
  test.skip(desktopOnly(testInfo), 'HTTP 檢查只在 desktop project 跑')
})

test('sitemap 的每個網址:200、head 標籤完整且正確', async ({ request }) => {
  const res = await request.get('/sitemap.xml')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('xml')
  const paths = sitemapPaths(await res.text())
  expect(paths.length, 'sitemap 至少要有首頁與課程頁').toBeGreaterThan(10)
  expect(new Set(paths).size, 'sitemap 不可有重複網址').toBe(paths.length)

  const titles = new Map<string, string>()
  for (const path of paths) {
    expect.soft(path, 'sitemap 只能有站內絕對網址').toMatch(/^\//)
    expect.soft(path === '/' || !path.endsWith('/'), `${path}:不應以斜線結尾`).toBe(true)
    expect.soft(isInternal(path), `${path}:內部頁不應在 sitemap`).toBe(false)

    const r = await request.get(path, { maxRedirects: 0 })
    expect.soft(r.status(), `${path}:狀態碼`).toBe(200)
    expect.soft(r.headers()['content-type'], `${path}:content-type`).toContain('text/html')
    expect.soft(r.headers()['x-robots-tag'], `${path}:公開頁不應有 X-Robots-Tag`).toBeUndefined()
    const h = parseHead(await r.text())
    const url = ORIGIN + path

    expect.soft(h.htmlLang, `${path}:<html lang>`).toBe('zh-Hant')
    expect.soft(h.titles.length, `${path}:<title> 數量`).toBe(1)
    expect.soft(h.titles[0]?.trim().length ?? 0, `${path}:<title> 不可為空`).toBeGreaterThan(0)
    expect.soft(h.meta('description').length, `${path}:meta description 數量`).toBe(1)
    expect.soft(h.meta('description')[0]?.trim().length ?? 0, `${path}:description 不可為空`).toBeGreaterThan(0)
    expect.soft(h.canonical, `${path}:canonical`).toEqual([url])
    expect.soft(h.meta('og:url'), `${path}:og:url`).toEqual([url])
    expect.soft(h.meta('og:title'), `${path}:og:title 與 <title> 一致`).toEqual([h.titles[0]])
    expect.soft(h.meta('og:description'), `${path}:og:description`).toEqual(h.meta('description'))
    expect.soft(h.meta('og:image').length, `${path}:og:image 數量`).toBe(1)
    expect.soft(h.meta('og:image')[0] ?? '', `${path}:og:image 須為絕對網址`).toMatch(/^https:\/\/shuttle\.tools\/.+/)
    expect.soft(h.meta('twitter:card'), `${path}:twitter:card`).toEqual(['summary_large_image'])
    expect.soft(h.meta('robots').join(' '), `${path}:不可 noindex`).not.toContain('noindex')
    for (const ld of h.jsonLd) {
      let data: Record<string, unknown> | undefined
      expect.soft(() => (data = JSON.parse(ld)), `${path}:JSON-LD 須為合法 JSON`).not.toThrow()
      expect.soft(data?.['@context'], `${path}:JSON-LD @context`).toBe('https://schema.org')
    }
    if (path === '/' || path.startsWith('/courses/')) expect.soft(h.jsonLd.length, `${path}:應有 JSON-LD(組織/課程/麵包屑)`).toBeGreaterThan(0)

    const title = h.titles[0]
    if (title) {
      expect.soft(titles.get(title), `${path}:<title> 與 ${titles.get(title)} 重複`).toBeUndefined()
      titles.set(title, path)
    }
  }
})

test('og:image 檔案存在', async ({ request }) => {
  const h = parseHead(await (await request.get('/')).text())
  const img = h.meta('og:image')[0]
  const r = await request.get(new URL(img).pathname)
  expect(r.status()).toBe(200)
  expect(r.headers()['content-type']).toContain('image/')
})

test('每個預先產生的頁面不是在 sitemap,就是 noindex 的內部頁', async ({ request }) => {
  const sitemap = new Set(sitemapPaths(await (await request.get('/sitemap.xml')).text()))
  const pages = distPagePaths()
  for (const p of ['/login', '/admin', '/docs/live', '/proposal', '/materials', '/materials/cover-designer']) {
    expect(pages, `dist 應有內部頁 ${p}`).toContain(p)
  }
  for (const path of pages) {
    if (isInternal(path)) {
      expect.soft(sitemap.has(path), `${path}:內部頁不可在 sitemap`).toBe(false)
      const r = await request.get(path, { maxRedirects: 0 })
      expect.soft(r.status(), `${path}:狀態碼`).toBe(200)
      expect.soft(r.headers()['x-robots-tag'], `${path}:X-Robots-Tag`).toBe('noindex, nofollow')
      const h = parseHead(await r.text())
      expect.soft(h.meta('robots'), `${path}:meta robots`).toEqual(['noindex, nofollow'])
      expect.soft(h.titles.length, `${path}:<title> 數量`).toBe(1)
    } else {
      expect.soft(sitemap.has(path), `${path}:公開頁應在 sitemap(或改為內部頁)`).toBe(true)
    }
  }
  for (const path of sitemap) expect.soft(pages, `sitemap 的 ${path} 沒有預先產生的 HTML`).toContain(path)
})

test('所有 /proposal 頁都是 noindex', async ({ request }) => {
  const proposal = distPagePaths().filter((p) => p === '/proposal' || p.startsWith('/proposal/'))
  expect(proposal.length).toBeGreaterThanOrEqual(9)
  for (const path of proposal) {
    const r = await request.get(path)
    expect.soft(r.headers()['x-robots-tag'], path).toBe('noindex, nofollow')
    expect.soft(parseHead(await r.text()).meta('robots'), path).toEqual(['noindex, nofollow'])
  }
})

test('robots.txt 有 Sitemap、沒有封鎖全站', async ({ request }) => {
  const r = await request.get('/robots.txt')
  expect(r.status()).toBe(200)
  expect(r.headers()['content-type']).toContain('text/plain')
  const body = await r.text()
  expect(body).toMatch(/^Sitemap: https:\/\/shuttle\.tools\/sitemap\.xml$/m)
  expect(body).toMatch(/^User-agent: \*$/m)
  expect(body).not.toMatch(/^Disallow:\s*\/\s*$/m)
})

for (const path of ['/nope', '/courses/nope', '/courses', '/courses/tools/999', '/docs/nope', '/proposal/nope']) {
  test(`不存在的頁面回 404 + noindex:${path}`, async ({ request }) => {
    const r = await request.get(path, { maxRedirects: 0 })
    expect(r.status()).toBe(404)
    expect(r.headers()['content-type']).toContain('text/html')
    expect(r.headers()['x-robots-tag']).toBe('noindex, nofollow')
    const h = parseHead(await r.text())
    expect(h.meta('robots')).toEqual(['noindex, nofollow'])
    expect(h.canonical, '404 頁不應有 canonical').toEqual([])
    expect(h.titles).toHaveLength(1)
  })
}

test('結尾斜線與 /index.html 以 301 導向正式網址(保留 query)', async ({ request }) => {
  const cases: [string, string][] = [
    ['/courses/tools/', '/courses/tools'],
    ['/proposal/', '/proposal'],
    ['/courses/tools/1/', '/courses/tools/1'],
    ['/index.html', '/'],
    ['/courses/tools/index.html', '/courses/tools'],
    ['/courses/tools/?a=1', '/courses/tools?a=1'],
  ]
  for (const [from, to] of cases) {
    const r = await request.get(from, { maxRedirects: 0 })
    expect.soft(r.status(), from).toBe(301)
    expect.soft(r.headers()['location'], from).toBe(to)
  }
  // 不存在的頁面加斜線不導向,直接 404
  expect((await request.get('/nope/', { maxRedirects: 0 })).status()).toBe(404)
})

test('靜態檔:找不到回 404 而不是 HTML;/assets 長期快取、頁面 no-cache', async ({ request }) => {
  const missing = await request.get('/assets/does-not-exist.js')
  expect(missing.status()).toBe(404)
  expect(missing.headers()['content-type'] ?? '').not.toContain('text/html')
  expect((await request.get('/nope.css')).status()).toBe(404)

  const home = await request.get('/')
  expect(home.headers()['cache-control']).toBe('no-cache')
  expect(home.headers()['etag']).toBeTruthy()
  expect((await request.get('/courses/tools')).headers()['cache-control']).toBe('no-cache')
  expect((await request.get('/nope')).headers()['cache-control']).toBe('no-cache')

  const html = await home.text()
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
  expect(assets.length, 'index.html 應引用 /assets/ 下的 JS/CSS').toBeGreaterThan(0)
  for (const a of assets) {
    const r = await request.get(a)
    expect.soft(r.status(), a).toBe(200)
    expect.soft(r.headers()['cache-control'], a).toBe('public, max-age=31536000, immutable')
  }
  const fav = await request.get('/favicon.svg')
  expect(fav.status()).toBe(200)
  expect(fav.headers()['cache-control']).toBe('public, max-age=3600')
})

test('條件式請求:帶 ETag 回 304', async ({ request }) => {
  const etag = (await request.get('/courses/tools')).headers()['etag']
  const r = await request.get('/courses/tools', { headers: { 'If-None-Match': etag } })
  expect(r.status()).toBe(304)
})

test('HEAD 請求:頁面 200、找不到 404,都沒有 body', async ({ request }) => {
  const ok = await request.head('/courses/tools')
  expect(ok.status()).toBe(200)
  expect(ok.headers()['content-type']).toContain('text/html')
  expect((await ok.body()).length).toBe(0)
  const nf = await request.head('/nope')
  expect(nf.status()).toBe(404)
  expect(nf.headers()['x-robots-tag']).toBe('noindex, nofollow')
  expect((await nf.body()).length).toBe(0)
  const internal = await request.head('/proposal')
  expect(internal.status()).toBe(200)
  expect(internal.headers()['x-robots-tag']).toBe('noindex, nofollow')
})
