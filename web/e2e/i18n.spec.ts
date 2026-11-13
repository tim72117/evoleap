// 英文版介面:瀏覽器語言是英文時第一次就顯示英文;切換鈕換語言、記在瀏覽器;會員的選擇存進帳號。
import { expect, test } from '@playwright/test'
import { desktopOnly, loginAsNewStudent } from './support'

test.describe('英文瀏覽器', () => {
  test.use({ locale: 'en-US' })

  test('第一次來顯示英文,切換鈕換成中文並記住', async ({ page }, info) => {
    test.skip(desktopOnly(info), '只在桌面版測一次')
    await page.goto('/')
    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Courses' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await header.getByRole('button', { name: '切換成中文' }).click()
    await expect(header.getByRole('link', { name: '全部課程' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    await page.reload()
    await expect(page.locator('header').getByRole('link', { name: '全部課程' })).toBeVisible()
  })

  test('法律頁英文版有「以中文版為準」的提醒', async ({ page }, info) => {
    test.skip(desktopOnly(info), '只在桌面版測一次')
    await page.goto('/terms')
    await expect(page.getByText(/Traditional Chinese version prevails/)).toBeVisible()
  })
})

test('會員選的語言存進帳號,換一個瀏覽器也一樣', async ({ page, browser }, info) => {
  test.skip(desktopOnly(info), '只在桌面版測一次')
  await loginAsNewStudent(page)
  await page.goto('/')
  await page.locator('header').getByRole('button', { name: 'Switch to English' }).click()
  await expect(page.locator('header').getByRole('link', { name: 'Courses' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => fetch('/api/me').then((r) => r.json()).then((b) => b.user?.locale))).toBe('en')

  // 另一個繁中瀏覽器(沒有記過語言)帶同一個登入 cookie:照帳號顯示英文
  const other = await browser.newContext({ locale: 'zh-TW', storageState: { cookies: await page.context().cookies(), origins: [] } })
  const p2 = await other.newPage()
  await p2.goto(new URL('/', page.url()).href)
  await expect(p2.locator('header').getByRole('link', { name: 'Courses' })).toBeVisible()
  await other.close()
})

// 第一次切到英文(字典要先下載):語言與字典一起換,播放器的控制列也是英文,不會停在中文
test('第一次切到英文:播放器控制列也換成英文', async ({ page }, info) => {
  test.skip(desktopOnly(info), '只在桌面版測一次')
  await page.goto('/showcase')
  const player = page.locator('.vp').first()
  await expect(player.getByRole('button', { name: /播放/ }).first()).toBeVisible()
  await page.locator('header').getByRole('button', { name: 'Switch to English' }).click()
  await expect(page.locator('header').getByRole('link', { name: 'Courses' })).toBeVisible()
  await expect(player.getByRole('button', { name: /^Play/ }).first()).toBeVisible()
  await expect(player.getByRole('button', { name: /播放/ })).toHaveCount(0)
})

// 連按切換:先送出的語言回應比較慢,晚到時不能把畫面改回舊的語言;帳號最後存的是最後的選擇
test('連按切換語言:慢的舊回應不會蓋掉最後的選擇', async ({ page }, info) => {
  test.skip(desktopOnly(info), '只在桌面版測一次')
  await loginAsNewStudent(page)
  await page.goto('/')
  const header = page.locator('header')
  // 先切到英文一次(下載英文字典),之後的切換都是即時的
  await header.getByRole('button', { name: 'Switch to English' }).click()
  await expect(header.getByRole('link', { name: 'Courses' })).toBeVisible()
  // 存成英文的請求故意拖慢
  await page.route('**/api/me', async (route) => {
    const req = route.request()
    if (req.method() === 'PATCH' && (req.postDataJSON() as { locale?: string }).locale === 'en') await new Promise((r) => setTimeout(r, 800))
    await route.continue()
  })
  await header.getByRole('button', { name: '切換成中文' }).click()
  await expect(header.getByRole('button', { name: 'Switch to English' })).toBeVisible()
  await header.getByRole('button', { name: 'Switch to English' }).click() // 存 en(慢)
  await expect(header.getByRole('button', { name: '切換成中文' })).toBeVisible()
  await header.getByRole('button', { name: '切換成中文' }).click() // 最後的選擇:中文
  await expect(header.getByRole('link', { name: '全部課程' })).toBeVisible()
  // 之後語言不能再變(慢的 en 回應晚到也不行)
  await page.evaluate(() => {
    const w = window as unknown as { __langs: string[] }
    w.__langs = []
    new MutationObserver(() => w.__langs.push(document.documentElement.lang)).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  })
  await page.waitForTimeout(1800)
  expect(await page.evaluate(() => (window as unknown as { __langs: string[] }).__langs)).toEqual([])
  await expect(header.getByRole('link', { name: '全部課程' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => fetch('/api/me').then((r) => r.json()).then((b) => b.user?.locale))).toBe('zh-Hant')
})
