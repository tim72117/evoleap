// 路由與前端導覽的回歸測試:首頁 → 課程地圖 → 課程總覽 → 單課的點擊流程;
// 前端換頁後 <title> 與 canonical 要和 server 預先產生的 HTML 一致;
// 每個公開頁與主要內部頁開啟時沒有 console error / 例外 / 失敗的請求。
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { collectErrors, distSitemapPaths, ORIGIN, parseHead } from './support'

/** server 回傳的(預先產生的)HTML 裡的 <title> */
async function serverTitle(request: APIRequestContext, path: string): Promise<string> {
  return parseHead(await (await request.get(path)).text()).titles[0]
}

/** 前端換頁後 head 的狀態:title、canonical 只能有一個且指向目前網址 */
async function expectHeadMatches(page: Page, request: APIRequestContext, path: string) {
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[/]/g, '\\/')}(#.*)?$`))
  await expect(page).toHaveTitle(await serverTitle(request, path))
  const canonical = page.locator('link[rel="canonical"]')
  await expect(canonical).toHaveCount(1)
  await expect(canonical).toHaveAttribute('href', ORIGIN + path)
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', ORIGIN + path)
  await expect(page.locator('title')).toHaveCount(1)
}

test('首頁 → 課程地圖卡片 → 課程總覽 → 單課 → 下一課(前端換頁)', async ({ page, request }, testInfo) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible()
  await expectHeadMatches(page, request, '/')

  // 課程地圖的 L0 卡片
  const card = page.locator('#level-tools')
  await card.getByRole('link', { name: /查看課程內容/ }).click()
  await expectHeadMatches(page, request, '/courses/tools')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // 課程總覽 → 第 1 課(清單裡的連結)
  await page.locator('main ol a[href="/courses/tools/1"]').click()
  await expectHeadMatches(page, request, '/courses/tools/1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('認識專案：工作目錄與檔案操作')

  // 下一課
  await page.getByRole('navigation', { name: '上一課與下一課' }).getByRole('link', { name: /下一課/ }).click()
  await expectHeadMatches(page, request, '/courses/tools/2')

  // 麵包屑回課程總覽(手機版隱藏麵包屑,改用上一課)
  let back: string
  if (testInfo.project.name === 'desktop') {
    await page.getByRole('navigation', { name: '麵包屑' }).getByRole('link', { name: 'L0 起步' }).click()
    back = '/courses/tools'
  } else {
    await page.getByRole('navigation', { name: '上一課與下一課' }).getByRole('link', { name: /上一課/ }).click()
    back = '/courses/tools/1'
  }
  await expectHeadMatches(page, request, back)
  await page.locator('header').getByRole('link', { name: '首頁', exact: true }).click()
  await expectHeadMatches(page, request, '/')

  // 瀏覽器上一頁也要同步 head
  await page.goBack()
  await expectHeadMatches(page, request, back)
  expect(errors).toEqual([])
})

test('課程地圖每張卡片的連結都能開啟(不是 404)', async ({ page, request }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const links = await page.locator('#map a[href^="/courses/"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('href')!),
  )
  expect(links.length).toBeGreaterThanOrEqual(5)
  for (const href of links) {
    await page.goto('/')
    await page.locator(`#map a[href="${href}"]`).first().click()
    await expectHeadMatches(page, request, href)
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('找不到頁面')
  }
  expect(errors).toEqual([])
})

test('前端換到不存在的網址顯示找不到頁面,head 為 noindex 且沒有 canonical', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    history.pushState({}, '', '/courses/nope')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('找不到頁面')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('直接開啟不存在的網址:404 狀態且畫面顯示找不到頁面', async ({ page }) => {
  const res = await page.goto('/courses/nope')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('找不到頁面')
})

// 每個公開頁 + 主要內部頁:開啟時沒有錯誤、h1 只有一個、hydrate 後 head 沒有重複標籤
const PAGES = [
  ...distSitemapPaths(),
  '/login',
  '/docs',
  '/proposal',
  '/proposal/tools',
  '/proposal/ai-agent/structure',
  '/materials/cover-designer',
]

for (const path of PAGES) {
  test(`開啟無錯誤:${path}`, async ({ page, request }) => {
    const errors = collectErrors(page)
    const res = await page.goto(path)
    expect(res?.status()).toBe(200)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1').first()).toBeVisible()
    // hydrate 後 document.title 要和 server 的 <title> 一致(SiteLayout / ProposalLayout 設定)
    await expect(page).toHaveTitle(await serverTitle(request, path))
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
    await expect(page.locator('meta[name="description"]')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1, name: '找不到頁面' })).toHaveCount(0)

    // 單課頁:h1 只放課名(課號、時長放在旁邊);title 是「第 N 課 <課名> · 站名」
    if (/^\/courses\/(tools|ai-tools)\/\d/.test(path)) {
      const title = await serverTitle(request, path)
      const lessonTitle = title.match(/^第 [\d.]+ 課 (.+) · /)?.[1]
      expect(lessonTitle, `title 格式:${title}`).toBeTruthy()
      await expect(page.locator('h1')).toHaveText(lessonTitle!)
    }
    expect(errors).toEqual([])
  })
}
