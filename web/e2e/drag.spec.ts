// 靜態互動的拖曳(stage.drag):網頁怎麼運作 1.2 的「拖拖看」。
// 互動時分成兩張卡片(stage.split):中間是網頁、旁邊的側欄是 DOM 樹。拖樹上的節點放到新的位置,網頁照新的樹重畫,任務打勾;按繼續接著播。
import { expect, test, type Locator, type Page } from '@playwright/test'
import { desktopOnly, loginAsNewStudent, openCoursePanel } from './support'

async function dragTo(page: Page, from: Locator, to: { x: number; y: number }) {
  const a = (await from.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

test('拖拖看:把節點拖到新的位置,任務打勾,按繼續接著播', async ({ page }, info) => {
  test.skip(desktopOnly(info), '只在桌面版測一次')
  test.setTimeout(60_000)
  await loginAsNewStudent(page)
  await page.goto('/courses/web/1-2?aspect=landscape')
  const player = page.locator('.vp')
  await expect(player.getByRole('slider', { name: '播放進度' })).not.toHaveAttribute('aria-valuemax', '0', { timeout: 15_000 })
  await openCoursePanel(page) // 側欄預設收合
  await page.getByText('拖拖看', { exact: true }).click()
  await player.getByRole('button', { name: /播放/ }).first().click()
  const layer = page.getByTestId('static-actor')
  const pour = layer.getByRole('button', { name: '拖動「<div> 手沖 NT$ 150」' })
  await expect(pour).toBeVisible({ timeout: 30_000 })
  const side = layer.locator('[class*=staticBeside]')
  const goal = (id: string) => side.locator(`.kt-goals li[data-goal="${id}"]`)
  await expect(goal('pour-in')).toHaveAttribute('data-done', '0')
  // 放到 section 的 h2 下面(那條縫的位置:h2 節點的左下角往下一點)
  const h2 = (await side.locator('.kt-node[data-id="picks-title"]').boundingBox())!
  await dragTo(page, pour, { x: h2.x + 4, y: h2.y + h2.height + 3 })
  await expect(goal('pour-in')).toHaveAttribute('data-done', '1')
  // 網頁也照新的樹重畫:手沖的卡片在 section 裡面
  await expect(layer.locator('[class*=staticHost] .kt-part[data-id="picks"] .kt-part[data-id="pour"]')).toHaveCount(1)
  await page.getByRole('button', { name: '做完了，繼續' }).click()
  await expect(layer).toHaveCount(0)
})
