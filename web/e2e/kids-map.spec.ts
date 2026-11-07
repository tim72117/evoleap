// 兒童課的課程地圖從資料庫讀(GET /api/courses/kids/map;資料是 server/internal/store/courses_seed.json):
// 未登入時第一課免費預覽、其他開放的課登入後學習、還沒開放的規劃中;開放的課連到課程頁。
import { expect, test } from '@playwright/test'

test('兒童課程地圖由資料庫讀取', async ({ page }) => {
  const res = page.waitForResponse((r) => r.url().endsWith('/api/courses/kids/map'))
  await page.goto('/topics/kids#map')
  expect((await res).status()).toBe(200)
  const map = page.locator('#map')
  const row = (id: string) => map.locator('li').filter({ hasText: new RegExp(`^${id.replace('.', '\\.')}`) })
  await expect(row('0.1')).toContainText('免費預覽')
  await expect(row('0.1').getByRole('link', { name: '翻到網頁的背面' })).toHaveAttribute('href', '/topics/kids/0-1')
  await expect(row('0.2')).toContainText('登入後學習')
  await expect(row('1.1')).toContainText('規劃中')
  await expect(row('1.1').getByRole('link')).toHaveCount(0)
})
