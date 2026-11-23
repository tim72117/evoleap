// 互動腳本的觸發點(interact.spots):網頁怎麼運作 1.1 的「點點看」。
// 點網頁上的元素顯示它的框與標籤,再點一次隱藏;要點到網頁裡真正的元素(不是定位用的替身),網頁的 script.js 才會切換。
import { expect, test } from '@playwright/test'
import { desktopOnly, loginAsNewStudent, openCoursePanel } from './support'

test('點點看:點一下顯示元素的框,再點一下隱藏,按繼續接著播', async ({ page }, info) => {
  test.skip(desktopOnly(info), '只在桌面版測一次')
  test.setTimeout(60_000)
  await loginAsNewStudent(page)
  await page.goto('/courses/web/1-1?aspect=landscape')
  const player = page.locator('.vp')
  await expect(player.getByRole('slider', { name: '播放進度' })).not.toHaveAttribute('aria-valuemax', '0', { timeout: 15_000 })
  await openCoursePanel(page) // 側欄預設收合
  await page.getByText('點點看', { exact: true }).click()
  await player.getByRole('button', { name: /播放/ }).first().click()
  const photo = page.getByRole('button', { name: '照片', exact: true })
  await expect(photo).toBeVisible({ timeout: 30_000 })
  // 靜態舞台的網頁(最後一個瀏覽器演員)裡,照片外框的 class
  const photoClass = () =>
    page.evaluate(() => {
      const hosts = [...document.querySelectorAll<HTMLElement>('.bw-frame')].filter((h) => h.shadowRoot)
      return hosts.at(-1)!.shadowRoot!.querySelector('[data-x=photo]')!.className
    })
  expect(await photoClass()).not.toMatch(/\bon\b/)
  await photo.click()
  await expect(photo).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(photoClass).toMatch(/\bon\b/)
  await photo.click()
  await expect(photo).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(photoClass).not.toMatch(/\bon\b/)
  await page.getByRole('button', { name: '看完了，繼續' }).click()
  await expect(photo).toHaveCount(0)
})
