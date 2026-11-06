// 直式互動課程頁(?aspect=portrait)與課程進度的底部抽屜:手機視窗(窄視窗)才有抽屜,不帶參數維持橫式。
import { expect, test } from '@playwright/test'
import { loginAsNewStudent } from './support'

test.use({ viewport: { width: 390, height: 844 } })
// 第 1 課以後要登入
test.beforeEach(async ({ page }) => loginAsNewStudent(page))

test('直式:舞台是直式、抽屜把手預設收合、點開看得到步驟', async ({ page }) => {
  await page.goto('/courses/tools/0?aspect=portrait')
  await expect(page.locator('.vp.vp-portrait')).toBeVisible()
  await expect(page.locator('.live-stage.portrait')).toBeAttached()
  const handle = page.getByRole('button', { expanded: false }).filter({ hasText: /\d+\/\d+|課程進度/ })
  await expect(handle).toBeVisible()
  await handle.click()
  const panel = page.getByRole('complementary', { name: '課程章節與步驟' })
  await expect(panel.getByRole('button', { name: /常見的工具/ })).toBeVisible()
})

test('直式:播到互動點抽屜自動展開,選一個選項後收合並繼續', async ({ page }) => {
  await page.goto('/courses/tools/0?aspect=portrait')
  const panel = page.getByRole('complementary', { name: '課程章節與步驟' })
  await page.locator('button[aria-expanded]').click()
  await panel.getByRole('button', { name: /互動/ }).first().click()
  // 互動點停下來:抽屜展開、題目與選項在抽屜裡
  await expect(page.locator('button[aria-expanded]')).toHaveAttribute('aria-expanded', 'true')
  await expect(panel.getByText('換你回答').first()).toBeVisible()
  await panel.getByRole('button', { name: '幫我打個招呼' }).click()
  await expect(page.locator('button[aria-expanded]')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.vp')).not.toHaveClass(/paused/)
})

test('切換橫/直:網址同步、保留時間', async ({ page }) => {
  await page.goto('/courses/tools/0?aspect=portrait')
  await page.getByRole('button', { name: '切換橫式或直式' }).click()
  await expect(page).not.toHaveURL(/aspect=/)
  await expect(page.locator('.vp.vp-portrait')).toHaveCount(0)
  await page.getByRole('button', { name: '切換橫式或直式' }).click()
  await expect(page).toHaveURL(/aspect=portrait/)
})

test('不帶參數:橫式,沒有抽屜把手', async ({ page }) => {
  await page.goto('/courses/tools/0')
  await expect(page.locator('.vp.vp-float')).toBeVisible()
  await expect(page.locator('.vp-portrait')).toHaveCount(0)
  await expect(page.locator('button[aria-expanded]')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: '課程章節與步驟' })).toBeVisible()
})
