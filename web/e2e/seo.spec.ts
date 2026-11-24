// SEO 與 server 回應的回歸測試:sitemap 每一頁的 <head>、內部頁 noindex、robots.txt、
// 404/301、快取標頭。全部是 HTTP 請求(不開瀏覽器頁面),只在 desktop project 跑一次。
import { expect, test } from '@playwright/test'
import { desktopOnly, distPagePaths, distSitemapPages, isInternal, mapLessons, ORIGIN, parseHead, sitemapPaths } from './support'

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

    expect.soft(h.htmlLang, `${path}:<html lang>`).toBe(path === '/en' || path.startsWith('/en/') ? 'en' : 'zh-Hant')
    expect.soft(h.titles.length, `${path}:<title> 數量`).toBe(1)
    expect.soft(h.titles[0]?.trim().length ?? 0, `${path}:<title> 不可為空`).toBeGreaterThan(0)
    expect.soft(h.meta('description').length, `${path}:meta description 數量`).toBe(1)
    expect.soft(h.meta('description')[0]?.trim().length ?? 0, `${path}:description 不可為空`).toBeGreaterThan(0)
    expect.soft(h.canonical, `${path}:canonical`).toEqual([url])
    expect.soft(h.meta('og:url'), `${path}:og:url`).toEqual([url])
    expect.soft(h.meta('og:title'), `${path}:og:title 與 <title> 一致`).toEqual([h.titles[0]])
    expect.soft(h.meta('og:description'), `${path}:og:description`).toEqual(h.meta('description'))
    expect.soft(h.meta('og:image').length, `${path}:og:image 數量`).toBe(1)
    expect.soft(h.meta('og:image')[0] ?? '', `${path}:og:image 須為絕對網址`).toMatch(new RegExp(`^${ORIGIN}/.+`))
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

// 一課或一章的頁面:/courses/<課程>/<課號或章節>、/topics/<主題>/<課號>
// 先不公開的課程(levels.ts 的 hidden)
// 「做出自己的軟體」的零基礎階段(ai-tools,課號 1.x～3.x,網址 /courses/software/1-0…3-3)先不公開;課程頁本身照常收錄
const HIDDEN_COURSE_PREFIXES: string[] = []
const HIDDEN_PAGE = /^\/courses\/software\/[1-3]-\d$/
const LESSON_PAGE = /^\/(courses|topics)\/[^/]+\/[^/]+$/

test('每個預先產生的頁面不是在 sitemap,就是 noindex 的內部頁(還沒開放的課除外)', async ({ request }) => {
  const sitemap = new Set(sitemapPaths(await (await request.get('/sitemap.xml')).text()))
  const pages = distPagePaths()
  for (const p of ['/login', '/admin', '/docs/live', '/studio', '/materials', '/materials/cover-designer', '/materials/promo']) {
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
    } else if (HIDDEN_PAGE.test(path) || HIDDEN_COURSE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) {
      // 先不公開(levels.ts 的 hidden)的課程:網址打得開,但不收錄、不進 sitemap
      expect.soft(sitemap.has(path), `${path}:先不公開的課不可在 sitemap`).toBe(false)
      const h = parseHead(await (await request.get(path)).text())
      expect.soft(h.meta('robots'), `${path}:先不公開的課要 noindex`).toEqual(['noindex, nofollow'])
    } else if (!sitemap.has(path)) {
      // 還沒開放的課(資料庫裡不是 open)可以收錄但不放進 sitemap;其他公開頁都要在 sitemap
      expect.soft(LESSON_PAGE.test(path), `${path}:公開頁應在 sitemap(或改為內部頁)`).toBe(true)
      const h = parseHead(await (await request.get(path)).text())
      expect.soft(h.meta('robots'), `${path}:還沒開放的課仍可收錄,不能 noindex`).toEqual([])
    }
  }
  for (const path of sitemap) expect.soft(pages, `sitemap 的 ${path} 沒有預先產生的 HTML`).toContain(path)
})

// /sitemap.xml 由 server 依資料庫產生:頁面清單(dist/sitemap-pages.json)裡的課頁,在 sitemap 裡就是資料庫裡那一課開放(open)
test('sitemap 的課頁依資料庫:課開放才收錄', async ({ request }) => {
  const sitemap = new Set(sitemapPaths(await (await request.get('/sitemap.xml')).text()))
  const lessonPages = distSitemapPages().filter((p) => p.lesson)
  expect(lessonPages.length).toBeGreaterThan(0)
  const maps = new Map<string, Awaited<ReturnType<typeof mapLessons>>>()
  let inCount = 0
  let outCount = 0
  for (const p of lessonPages) {
    const { course, id } = p.lesson!
    if (!maps.has(course)) maps.set(course, await mapLessons(request, course))
    const open = maps.get(course)!.find((l) => l.id === id)?.status === 'open'
    const path = p.loc.slice(ORIGIN.length)
    expect.soft(sitemap.has(path), `${path}(${course} ${id},資料庫 ${open ? 'open' : '未開放'})`).toBe(open)
    if (open) inCount++
    else outCount++
  }
  expect(inCount, '資料裡要有開放的課').toBeGreaterThan(0)
  expect(outCount, '資料裡要有還沒開放的課').toBeGreaterThan(0)
})

// 主題頁的結構化資料(JSON-LD)裡,課程清單的一課附不附 url 由 server 依資料庫決定:開放(open)的附、沒開放的不附,標記欄位不出現在回應裡
for (const { course, path } of [
  { course: 'kids', path: '/courses/kids' },
  { course: 'web', path: '/courses/web' },
  { course: 'launch', path: '/courses/launch' },
  { course: 'claude-code', path: '/courses/claude-code' },
]) {
  test(`${path} 的結構化資料:課程連結依資料庫`, async ({ request }) => {
    const html = await (await request.get(path)).text()
    expect(html).not.toContain('evoleapLesson')
    const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as { '@type': string })
    const list = blocks.find((b) => b['@type'] === 'ItemList') as unknown as { itemListElement: { name: string; url?: string }[] }
    const lessons = await mapLessons(request, course)
    const withUrl = new Set(list.itemListElement.filter((x) => x.url).map((x) => x.name.split(' ')[0]))
    // 有 url 的一定是資料庫裡開放的課(開放但還沒有課程頁的課不附,所以不要求每個開放的課都有)
    for (const id of withUrl) expect(lessons.find((l) => l.id === id)?.status, `${id} 附了 url`).toBe('open')
    expect(withUrl.size, '至少有一個開放的課附了 url').toBeGreaterThan(0)
    // 沒開放的課都沒有 url
    const notOpen = lessons.filter((l) => l.status !== 'open')
    expect(notOpen.length, '資料裡要有沒開放的課').toBeGreaterThan(0)
    for (const l of notOpen) expect(withUrl.has(l.id), `${l.id} 沒開放卻附了 url`).toBe(false)
  })
}

// 瀏覽器執行 JS 之後(爬蟲轉譯後的 DOM)結構化資料還是 server 依資料庫處理過的版本:開放的課有 url、沒有內部標記
test('/courses/kids 轉譯後的結構化資料仍附資料庫開放的課的 url', async ({ page, request }) => {
  await page.goto('/courses/kids')
  await expect(page.locator('h1').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  const texts = await page.locator('script[type="application/ld+json"][data-seo]').allTextContents()
  expect(texts.join('')).not.toContain('evoleapLesson')
  const list = texts.map((t) => JSON.parse(t) as { '@type': string }).find((b) => b['@type'] === 'ItemList') as unknown as { itemListElement: { url?: string }[] }
  const open = (await mapLessons(request, 'kids')).filter((l) => l.status === 'open')
  expect(open.length).toBeGreaterThan(0)
  expect(list.itemListElement.filter((x) => x.url).length, '轉譯後仍有開放的課的 url').toBeGreaterThan(0)
})

test('所有 /studio 頁都是 noindex', async ({ request }) => {
  const proposal = distPagePaths().filter((p) => p === '/studio' || p.startsWith('/studio/'))
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
  expect(body).toMatch(new RegExp(`^Sitemap: ${ORIGIN}/sitemap\\.xml$`, 'm'))
  expect(body).toMatch(/^User-agent: \*$/m)
  expect(body).not.toMatch(/^Disallow:\s*\/\s*$/m)
})

for (const path of ['/nope', '/courses/nope', '/courses/software/999', '/docs/nope', '/studio/nope']) {
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
    ['/courses/software/', '/courses/software'],
    ['/studio/', '/studio'],
    ['/courses/software/1/', '/courses/software/1'],
    ['/index.html', '/'],
    ['/courses/software/index.html', '/courses/software'],
    ['/courses/software/?a=1', '/courses/software?a=1'],
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
  expect((await request.get('/courses/software')).headers()['cache-control']).toBe('no-cache')
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
  const etag = (await request.get('/courses/software')).headers()['etag']
  const r = await request.get('/courses/software', { headers: { 'If-None-Match': etag } })
  expect(r.status()).toBe(304)
})

test('HEAD 請求:頁面 200、找不到 404,都沒有 body', async ({ request }) => {
  const ok = await request.head('/courses/software')
  expect(ok.status()).toBe(200)
  expect(ok.headers()['content-type']).toContain('text/html')
  expect((await ok.body()).length).toBe(0)
  const nf = await request.head('/nope')
  expect(nf.status()).toBe(404)
  expect(nf.headers()['x-robots-tag']).toBe('noindex, nofollow')
  expect((await nf.body()).length).toBe(0)
  const internal = await request.head('/studio')
  expect(internal.status()).toBe(200)
  expect(internal.headers()['x-robots-tag']).toBe('noindex, nofollow')
})
