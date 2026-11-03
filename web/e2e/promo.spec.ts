// 宣傳影片頁 /materials/promo:播放器出現、會播放、提供逐格輸出的掛鉤(給 scripts/record-live.mjs 用)。
import { expect, test } from '@playwright/test'
import { collectErrors } from './support'

test('宣傳影片頁:播放器會播放,逐格輸出掛鉤可用', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/materials/promo?script=promo/0.promo-intro.json')
  await expect(page.getByTestId('promo-player')).toBeVisible()
  await page.waitForFunction(() => window.__promoReady === true, null, { timeout: 30000 })

  const hook = await page.evaluate(() => {
    window.__promo!.renderAt(1000)
    return { duration: window.__promo!.duration, fps: window.__promo!.fps }
  })
  expect(hook.duration).toBeGreaterThan(20000)
  expect(hook.fps).toBe(30)

  const cur = page.locator('.vp-cur')
  await expect(cur).toHaveText('0:00')
  await page.getByRole('button', { name: '播放', exact: true }).first().click()
  await expect(cur).not.toHaveText('0:00', { timeout: 10000 })
  expect(errors).toEqual([])
})
