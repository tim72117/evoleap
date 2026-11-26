// 「做出自己的軟體」(/courses/software)是起步・零基礎・基礎三個階段合併成的一門課:
// 課程頁每個公開階段是一組可收合的清單(<details id="stage-…">),先不公開的零基礎(ai-tools)階段不列、但各課網址還打得開;
// 舊的三門課網址(/courses/tools、/courses/ai-tools、/courses/vibe-coding)301 到新網址(server/cmd/server/static.go),站內舊連結也由前端轉址。
import { expect, test, type Page } from '@playwright/test'
import { collectErrors, desktopOnly } from './support'

const group = (page: Page, id: string) => page.locator(`details#stage-${id}`)

test('課程頁:公開階段各一組清單(標題、課數),先不公開的零基礎階段不列', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/courses/software')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('測試課一')
  await expect(page.locator('details[id^="stage-"]')).toHaveCount(2)
  // 課程說明(資料庫的 about 段落)在課程內容上方
  await expect(page.getByRole('heading', { name: '課程說明' })).toBeVisible()
  await expect(group(page, 'ai-tools')).toHaveCount(0)
  for (const [id, title] of [
    ['tools', '起步・測試單元甲'],
    ['vibe-coding-basics', '基礎・測試單元丙'],
  ]) {
    const summary = group(page, id).locator('> summary')
    await expect(summary).toContainText(title)
    await expect(summary).toContainText(/\d+ 課/)
    await expect(group(page, id).locator('li').first()).toBeVisible()
  }
  // 起步階段的課連到 /courses/software/<課號>;基礎階段是規劃中、也有規劃中章節頁的連結
  await expect(group(page, 'tools').getByRole('link', { name: /序章/ })).toHaveAttribute('href', '/courses/software/intro')
  await expect(group(page, 'tools').locator('a[href="/courses/software/0"]')).toHaveCount(1)
  await expect(group(page, 'vibe-coding-basics').locator('a[href^="/courses/software/"]').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('課程頁:網址帶 #stage-vibe-coding-basics 時捲到基礎階段', async ({ page }) => {
  await page.goto('/courses/software#stage-vibe-coding-basics')
  await expect(group(page, 'vibe-coding-basics').locator('> summary')).toBeInViewport()
})

test('先不公開的零基礎階段:課的網址打得開、noindex,但不在課程頁清單', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/courses/software/1-0')
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('找不到頁面')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  expect(errors).toEqual([])
})

test('舊網址 301 到 /courses/software(帶上階段錨點或課的 slug)', async ({ request }, info) => {
  test.skip(desktopOnly(info), '純 HTTP 檢查,只在桌面版跑一次')
  const cases: [string, string][] = [
    ['/courses/tools', '/courses/software#stage-tools'],
    ['/courses/ai-tools', '/courses/software#stage-ai-tools'],
    ['/courses/vibe-coding', '/courses/software#stage-vibe-coding-basics'],
    ['/courses/tools/intro', '/courses/software/intro'],
    ['/courses/tools/0', '/courses/software/0'],
    ['/courses/ai-tools/1-1', '/courses/software/1-1'],
    ['/courses/vibe-coding/5-2', '/courses/software/5-2'],
  ]
  for (const [from, to] of cases) {
    const r = await request.get(from, { maxRedirects: 0 })
    expect.soft(r.status(), from).toBe(301)
    expect.soft(r.headers()['location'], from).toBe(to)
  }
})

for (const [from, to] of [
  ['/courses/tools', '/courses/software'],
  ['/courses/ai-tools/3-3', '/courses/software/3-3'],
  ['/courses/vibe-coding/5-2', '/courses/software/5-2'],
] as const) {
  test(`舊網址在瀏覽器裡落到新頁面:${from}`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(from)
    await expect(page).toHaveURL(new RegExp(`${to.replace(/\//g, '\/')}(#.*)?$`))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('找不到頁面')
    expect(errors).toEqual([])
  })
}

test('sitemap 只列新網址,不列舊的三門課網址', async ({ request }, info) => {
  test.skip(desktopOnly(info), '純 HTTP 檢查,只在桌面版跑一次')
  const xml = await (await request.get('/sitemap.xml')).text()
  expect(xml).toContain('/courses/software</loc>')
  expect(xml).not.toMatch(/\/courses\/(tools|ai-tools|vibe-coding)(\/|<)/)
})
