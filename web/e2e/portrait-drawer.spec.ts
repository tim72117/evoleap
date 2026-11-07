// 直式互動課程頁與課程進度的底部抽屜:手機直拿(窄、直)時預設直式,網址 ?aspect= 可以指定方向;寬視窗不帶參數維持橫式。
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

test('手機直拿不帶參數:自動直式、有抽屜把手;?aspect=landscape 時維持橫式', async ({ page }) => {
  await page.goto('/courses/tools/0')
  await expect(page.locator('.vp.vp-portrait')).toBeVisible()
  await expect(page.locator('.live-stage.portrait')).toBeAttached()
  await expect(page.locator('button[aria-expanded]')).toHaveCount(1)
  await page.goto('/courses/tools/0?aspect=landscape')
  await expect(page.locator('.vp.vp-float')).toBeVisible()
  await expect(page.locator('.vp-portrait')).toHaveCount(0)
})

test.describe('寬視窗', () => {
  test.use({ viewport: { width: 1366, height: 768 } })
  test('不帶參數:橫式,沒有抽屜把手', async ({ page }) => {
    await page.goto('/courses/tools/0')
    await expect(page.locator('.vp.vp-float')).toBeVisible()
    await expect(page.locator('.vp-portrait')).toHaveCount(0)
    await expect(page.locator('button[aria-expanded]')).toHaveCount(0)
    await expect(page.getByRole('complementary', { name: '課程章節與步驟' })).toBeVisible()
  })
})

test('手機直拿:一般課程頁的 LivePlayer 也是直式', async ({ page }) => {
  await page.goto('/topics/claude-code')
  await page.locator('h4 button[aria-expanded="false"]').first().click()
  await expect(page.locator('[data-aspect="portrait"] .vp.vp-portrait')).toBeVisible({ timeout: 15000 })
})

for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }]) {
  test.describe(`兒童課 ${viewport.width}px`, () => {
    test.use({ viewport })
    test('段落收在右上角:按「☰ 段落」才在右上角的側欄打開,播放器下方沒有段落', async ({ page }) => {
      await page.goto('/topics/kids/0-1')
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
