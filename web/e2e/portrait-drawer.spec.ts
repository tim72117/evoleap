// 互動課程頁的直式與寬視窗版面:手機直拿(窄、直)時預設直式,網址 ?aspect= 可以指定方向;寬視窗不帶參數維持橫式。
import { expect, test } from '@playwright/test'
import { loginAsNewStudent, reachMoment } from './support'

test.use({ viewport: { width: 390, height: 844 } })
// 先登入(前五課免登入預覽,其他課要登入;這裡用的 0.1 是免費預覽,登入後一樣看得到)
test.beforeEach(async ({ page }) => loginAsNewStudent(page))

test('直式:舞台是直式,下面是圖示工具列(播放、下一課)', async ({ page }) => {
  await page.goto('/courses/software/1?aspect=portrait')
  await expect(page.locator('.vp.vp-portrait')).toBeVisible()
  await expect(page.locator('.live-stage.portrait')).toBeAttached()
  await expect(page.getByRole('link', { name: /^下一課/ })).toBeVisible()
  await expect(page.locator('h1')).toHaveCount(1)
})

test('直式:播到互動點直接浮出題目與選項,選完收起並繼續', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/courses/software/1?aspect=portrait')
  const option = page.getByRole('button', { name: '幫我打個招呼' })
  await reachMoment(page, option)
  await option.click()
  await expect(option).toHaveCount(0)
})

test('手機直拿不帶參數:自動直式;?aspect=landscape 時維持橫式', async ({ page }) => {
  await page.goto('/courses/software/1')
  await expect(page.locator('.vp.vp-portrait')).toBeVisible()
  await expect(page.locator('.live-stage.portrait')).toBeAttached()
  await page.goto('/courses/software/1?aspect=landscape')
  await expect(page.locator('.vp.vp-float')).toBeVisible()
  await expect(page.locator('.vp-portrait')).toHaveCount(0)
})

test.describe('寬視窗', () => {
  test.use({ viewport: { width: 1366, height: 768 } })
  test('不帶參數:橫式;上一課、下一課在播放器控制列', async ({ page }) => {
    await page.goto('/courses/software/1')
    await expect(page.locator('.vp.vp-float')).toBeVisible()
    await expect(page.locator('.vp-portrait')).toHaveCount(0)
    await expect(page.locator('.vp').getByRole('link', { name: /^下一課/ })).toBeAttached()
  })
})

test('手機直拿:一般課程頁的 LivePlayer 也是直式', async ({ page }) => {
  await page.goto('/courses/claude-code/1')
  await expect(page.locator('[data-aspect="portrait"] .vp.vp-portrait')).toBeVisible({ timeout: 15000 })
})

for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }]) {
  test.describe(`兒童課 ${viewport.width}px`, () => {
    test.use({ viewport })
    test('段落收在右上角:按「☰ 段落」才在右上角的側欄打開,播放器下方沒有段落', async ({ page }) => {
      await page.goto('/courses/kids/0-1')
      const side = page.getByRole('complementary', { name: '這一課' })
      const toggle = side.getByRole('button', { name: '打開段落' })
      await expect(toggle).toBeVisible()
      const box = await toggle.boundingBox()
      expect(box!.x + box!.width).toBeGreaterThan(viewport.width * 0.7)
      expect(box!.y).toBeLessThan(120)
      await expect(side.locator('li button').first()).toBeHidden()
      await toggle.click()
      await expect(side.locator('li button').first()).toBeVisible()
      await expect(side.getByRole('button', { name: '收起段落' })).toBeVisible()
    })
  })
}
