// 「動手試試」按鈕有功能旗標(web/src/site/features.ts):正式站預設關閉,網址 ?feature=practice 打開(記在瀏覽器裡),?feature=-practice 關掉。
// 腳本要有 practice 欄位(l0/0.0-tools.json)按鈕才會出現。
import { expect, test } from '@playwright/test'

const PAGE = '/courses/software/1?aspect=landscape'
const button = (page: import('@playwright/test').Page) => page.getByRole('button', { name: '動手試試' })

test('動手試試:預設不顯示;網址 ?feature=practice 打開並記住,?feature=-practice 關掉', async ({ page }) => {
  await page.goto(PAGE)
  await expect(page.locator('.vp').first()).toBeVisible()
  await expect(button(page)).toHaveCount(0)

  // 帶旗標:出現按鈕,能打開、Esc 關閉
  await page.goto(`${PAGE}&feature=practice`)
  await expect(button(page)).toBeVisible()
  await button(page).click()
  await expect(page.getByTestId('claude-practice')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('claude-practice')).toHaveCount(0)

  // 記住了:不帶旗標的網址也還在
  await page.goto(PAGE)
  await expect(button(page)).toBeVisible()

  // 關掉
  await page.goto(`${PAGE}&feature=-practice`)
  await expect(page.locator('.vp').first()).toBeVisible()
  await expect(button(page)).toHaveCount(0)
  await page.goto(PAGE)
  await expect(button(page)).toHaveCount(0)
})
