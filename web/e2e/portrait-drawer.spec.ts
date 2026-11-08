// 直式互動課程頁與課程進度的底部抽屜:手機直拿(窄、直)時預設直式,網址 ?aspect= 可以指定方向;寬視窗不帶參數維持橫式。
import { expect, test } from '@playwright/test'
import { loginAsNewStudent, openCoursePanel } from './support'

test.use({ viewport: { width: 390, height: 844 } })
// 第 1 課以後要登入
test.beforeEach(async ({ page }) => loginAsNewStudent(page))

test('直式:舞台是直式,步驟與下一課直接列在播放窗下方,沒有側欄', async ({ page }) => {
  await page.goto('/courses/tools/0?aspect=portrait')
  await expect(page.locator('.vp.vp-portrait')).toBeVisible()
  await expect(page.locator('.live-stage.portrait')).toBeAttached()
  await expect(page.getByRole('complementary', { name: '課程章節與步驟' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^課程進度:/ })).toHaveCount(0)
  const info = page.getByRole('region', { name: '課程資訊' })
  await expect(info.getByRole('button', { name: /常見的工具/ })).toBeVisible()
  await expect(info.getByRole('navigation', { name: '上一課與下一課' })).toBeVisible()
  // 頁面只有一個標題(課程名稱在資訊區)
  await expect(page.locator('h1')).toHaveCount(1)
})

test('直式:播到互動點抽屜自動展開,選一個選項後收合並繼續', async ({ page }) => {
  await page.goto('/courses/tools/0?aspect=portrait')
  const info = page.getByRole('region', { name: '課程資訊' })
  await info.getByRole('button', { name: /互動/ }).first().click()
  // 互動點停下來:抽屜展開、題目與選項在抽屜裡
  const panel = page.getByRole('complementary', { name: '課程章節與步驟' })
  await expect(panel.locator('button[aria-expanded]')).toHaveAttribute('aria-expanded', 'true')
  await expect(panel.getByText('換你回答').first()).toBeVisible()
  await panel.getByRole('button', { name: '幫我打個招呼' }).click()
  // 回答後收合
  await expect(panel).toHaveCount(0)
  await expect(page.locator('.vp')).not.toHaveClass(/paused/)
})

test('手機直拿不帶參數:自動直式、步驟在下方;?aspect=landscape 時維持橫式', async ({ page }) => {
  await page.goto('/courses/tools/0')
  await expect(page.locator('.vp.vp-portrait')).toBeVisible()
  await expect(page.locator('.live-stage.portrait')).toBeAttached()
  await expect(page.getByRole('region', { name: '課程資訊' })).toBeVisible()
  await page.goto('/courses/tools/0?aspect=landscape')
  await expect(page.locator('.vp.vp-float')).toBeVisible()
  await expect(page.locator('.vp-portrait')).toHaveCount(0)
})

test('手機直拿:播到一半捲動下方的步驟清單時,播放器不會被捲走', async ({ page }) => {
  await page.goto('/topics/web/0-1')
  await expect(page.locator('.vp.vp-portrait')).toBeVisible()
  // 跳到中段:清單上有「目前這一步」
  const track = page.locator('.vp-track')
  const box = (await track.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.72, box.y + box.height / 2)
  const info = page.getByRole('region', { name: '課程資訊' })
  await expect(info.locator('[aria-current="step"]')).toBeVisible()
  const tops = await page.evaluate(async () => {
    const vp = document.querySelector('.vp')!
    const list = document.querySelector('section[aria-label="課程資訊"]')!
    const seen: number[] = []
    for (let i = 0; i < 10; i++) {
      list.scrollTop += 20
      seen.push(Math.round(vp.getBoundingClientRect().top))
      await new Promise((r) => setTimeout(r, 30))
    }
    return seen
  })
  expect(new Set(tops)).toEqual(new Set([0]))
})

test.describe('寬視窗', () => {
  test.use({ viewport: { width: 1366, height: 768 } })
  test('不帶參數:橫式,側欄預設收合,打開後沒有抽屜把手', async ({ page }) => {
    await page.goto('/courses/tools/0')
    await expect(page.locator('.vp.vp-float')).toBeVisible()
    await expect(page.locator('.vp-portrait')).toHaveCount(0)
    const panel = await openCoursePanel(page)
    await expect(panel.locator('button[aria-expanded]')).toHaveCount(0)
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
