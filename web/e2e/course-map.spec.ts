// 主題頁的課程地圖從資料庫讀(GET /api/courses/{id}/map;資料是 server/internal/store/courses_seed.json):
// 未登入時第一課免費預覽、其他開放的課登入後學習、還沒開放的規劃中;開放的課連到課程頁。
import { expect, test } from '@playwright/test'
import { collectErrors, desktopOnly, loginAsNewStudent } from './support'

test('兒童課程地圖由資料庫讀取', async ({ page }) => {
  // 照正式設定跑的 server:訪客看到的狀態和正式站一樣(這台 -open-studio 的 server 把每個人當管理員)
  const gated = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 8198) + 1}`
  const res = page.waitForResponse((r) => r.url().endsWith('/api/courses/kids/map'))
  await page.goto(`${gated}/topics/kids#map`)
  expect((await res).status()).toBe(200)
  const map = page.locator('#map')
  const row = (id: string) => map.locator('li').filter({ hasText: new RegExp(`^${id.replace('.', '\\.')}`) })
  await expect(row('0.1')).toContainText('免費預覽')
  await expect(row('0.1').getByRole('link', { name: '翻到網頁的背面' })).toHaveAttribute('href', '/topics/kids/0-1')
  // 依順序前兩課(0.1、0.2)免費預覽,第三課(0.3)起登入後學習
  await expect(row('0.2')).toContainText('免費預覽')
  await expect(row('0.3').getByRole('img', { name: '登入後學習' })).toBeVisible()
  // 單元 1 已開放:訪客看到可以點的課
  await expect(row('1.1').getByRole('link')).toHaveAttribute('href', '/topics/kids/1-1')
  // 2.1 起是草稿:訪客看到規劃中、沒有連結,直接打開課程頁是「還沒開放」
  await expect(row('2.1')).toContainText('規劃中')
  await expect(row('2.1').getByRole('link')).toHaveCount(0)
  await page.goto(`${gated}/topics/kids/2-1`)
  await expect(page.getByText('這一課還沒開放')).toBeVisible()

  // 管理員看到草稿,整列連到課程頁(等 API 回來再看:前端內建的備援地圖一開始也畫了草稿,不等就測不到伺服器)
  const adminMap = page.waitForResponse((r) => r.url().endsWith('/api/courses/kids/map'))
  await page.goto('/topics/kids#map')
  const body = (await (await adminMap).json()) as { units: { lessons: { id: string; status: string }[] }[] }
  expect(body.units.flatMap((u) => u.lessons).find((l) => l.id === '2.1')?.status).toBe('draft')
  await expect(row('2.1')).toContainText('草稿')
  await expect(row('2.1').getByRole('link')).toHaveAttribute('href', '/topics/kids/2-1')
})

test('網頁怎麼運作的課程地圖由資料庫讀取', async ({ page }) => {
  const res = page.waitForResponse((r) => r.url().endsWith('/api/courses/web/map'))
  await page.goto('/topics/web#map')
  expect((await res).status()).toBe(200)
  const map = page.locator('#map')
  const row = (id: string) => map.locator('li').filter({ hasText: new RegExp(`^${id.replace('.', '\\.')}`) })
  await expect(map.getByRole('heading', { name: /序章：網頁從哪裡來/ })).toContainText('在網址列按下 Enter 之後')
  await expect(row('0.1')).toContainText('免費預覽')
  await expect(row('0.1').getByRole('link', { name: '輸入網址之後發生的事' })).toHaveAttribute('href', '/topics/web/0-1')
  await expect(row('1.2').getByRole('img', { name: '登入後學習' })).toBeVisible()
  await expect(row('1.3')).toContainText('規劃中')
  await expect(row('1.3').getByRole('link')).toHaveCount(0)
})

// 序章三課已開放:前兩課不用登入,第三課登入後能上;腳本載入後整課拖到底都不出錯
test('從做好到上線:序章前兩課免費預覽、第三課要登入,三課都播得動', async ({ page }, info) => {
  test.skip(desktopOnly(info), '只在桌面版測一次')
  const errors = collectErrors(page)
  const slider = () => page.getByRole('slider', { name: '播放進度' }).first()
  const playToEnd = async (path: string) => {
    await page.goto(path)
    await expect(slider()).not.toHaveAttribute('aria-valuemax', '0', { timeout: 15_000 })
    await slider().focus()
    await page.keyboard.press('End')
    await expect(page.getByText('找不到')).toHaveCount(0)
  }
  await playToEnd('/topics/launch/0-1')
  await playToEnd('/topics/launch/0-2')
  await page.goto('/topics/launch/0-3')
  await expect(page.getByRole('dialog', { name: '登入' })).toBeVisible()
  await loginAsNewStudent(page)
  await playToEnd('/topics/launch/0-3')
  expect(errors).toEqual([])
})
