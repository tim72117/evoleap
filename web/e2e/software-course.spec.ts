// 「做出自己的軟體」(/courses/software)是起步・零基礎・基礎三個階段合併成的一門課:
// 課程頁上三個階段是可收合的群組(<details id="stage-…">),起步與零基礎預設展開,基礎(全是規劃中)預設收合,
// 網址帶 #stage-<id> 時展開並捲到該群組;舊的三門課網址(/courses/tools、/courses/ai-tools、/courses/vibe-coding)301 到新網址。
import { expect, test } from '@playwright/test'
import { collectErrors, desktopOnly } from './support'

const STAGES = [
  { id: 'tools', title: '起步・AI 工具介紹', subtitle: '不用先學寫程式', open: true },
  { id: 'ai-tools', title: '零基礎・AI 工具入門', subtitle: '跟著一位店主', open: true },
  { id: 'vibe-coding-basics', title: '基礎・Vibe Coding 入門', subtitle: '建好自己的開發環境', open: false },
] as const

const group = (page: import('@playwright/test').Page, id: string) => page.locator(`details#stage-${id}`)

test('課程頁:三個階段群組(標題、小字、課數),起步與零基礎展開、基礎收合', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/courses/software')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('做出自己的軟體')
  await expect(page.locator('details[id^="stage-"]')).toHaveCount(3)
  for (const s of STAGES) {
    const g = group(page, s.id)
    await expect(g).toBeVisible()
    const summary = g.locator('> summary')
    await expect(summary).toContainText(s.title)
    await expect(summary.locator('small')).toContainText(s.subtitle)
    await expect(summary).toContainText(/\d+ 課/)
    if (s.open) await expect(g).toHaveAttribute('open', '')
    else await expect(g).not.toHaveAttribute('open', '')
  }
  // 展開的群組看得到課;收合的群組裡的課看不到,點標題後展開
  await expect(group(page, 'tools').getByRole('link', { name: /序章/ })).toBeVisible()
  await expect(group(page, 'ai-tools').locator('li').first()).toBeVisible()
  await expect(group(page, 'vibe-coding-basics').locator('li').first()).toBeHidden()
  await group(page, 'vibe-coding-basics').locator('> summary').click()
  await expect(group(page, 'vibe-coding-basics').locator('li').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('課程頁:#stage-vibe-coding-basics 只顯示基礎單元並展開,「看全部單元」回到全部', async ({ page }) => {
  await page.goto('/courses/software#stage-vibe-coding-basics')
  const g = group(page, 'vibe-coding-basics')
  await expect(g).toHaveAttribute('open', '')
  await expect(g.locator('li').first()).toBeVisible()
  await expect(g.locator('> summary')).toBeInViewport()
  await expect(page.locator('details[id^="stage-"]')).toHaveCount(1)
  await page.getByRole('link', { name: /看全部單元/ }).click()
  await expect(page).toHaveURL(/\/courses\/software#map$/)
  await expect(page.locator('details[id^="stage-"]')).toHaveCount(3)
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
    ['/courses/vibe-coding/4-1', '/courses/software/4-1'],
  ]
  for (const [from, to] of cases) {
    const r = await request.get(from, { maxRedirects: 0 })
    expect.soft(r.status(), from).toBe(301)
    expect.soft(r.headers()['location'], from).toBe(to)
  }
})

for (const [from, to, heading] of [
  ['/courses/tools', '/courses/software', '做出自己的軟體'],
  ['/courses/ai-tools/1-1', '/courses/software/1-1', null],
  ['/courses/vibe-coding/4-1', '/courses/software/4-1', null],
] as const) {
  test(`舊網址在瀏覽器裡落到新頁面:${from}`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(from)
    await expect(page).toHaveURL(new RegExp(`${to.replace(/\//g, '\\/')}(#.*)?$`))
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toBeVisible()
    await expect(h1).not.toHaveText('找不到頁面')
    if (heading) await expect(h1).toHaveText(heading)
    if (from === '/courses/tools') {
      // 舊課程頁的階段錨點:起步群組在視窗內
      expect(new URL(page.url()).hash).toBe('#stage-tools')
      await expect(group(page, 'tools')).toHaveAttribute('open', '')
    }
    expect(errors).toEqual([])
  })
}

test('課程頁的單元錨點 #stage-…:每個單元都只顯示自己', async ({ page }) => {
  for (const s of STAGES) {
    await page.goto(`/courses/software#stage-${s.id}`)
    await expect(group(page, s.id)).toBeVisible()
    await expect(group(page, s.id)).toHaveAttribute('open', '')
    await expect(page.locator('details[id^="stage-"]')).toHaveCount(1)
  }
})
