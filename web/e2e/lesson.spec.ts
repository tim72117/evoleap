// 單課頁(/courses/ai-tools/3-3 = L1 第 3.3 課,2 支影片、5 個步驟,影片未上架 → 預覽大綱播放器)的回歸測試:
// (L0 第 0、1、2 課已改用即時教學畫面,一課一支影片;這裡測多支影片的預覽大綱播放器,
//  要找一門還沒有即時影片、且有多支影片的課:L0 全部上架後改用 L1。)
// 第一屏同時看得到播放器、播放中的步驟提示詞與複製鈕;播放進度驅動「播放中」;
// ▶ 跳轉、跨影片、←/→ 鍵、複製提示詞、影片分頁。
import { expect, test, type Locator, type Page } from '@playwright/test'
import { collectErrors } from './support'

const LESSON = '/courses/ai-tools/3-3'

const player = (page: Page) => page.getByRole('group', { name: /^預覽大綱：/ })
const step = (page: Page, n: number) => page.locator(`#step-${n}`)
/** 目前標著「播放中」的步驟 */
const playingSteps = (page: Page) => page.locator('li[id^="step-"]').filter({ hasText: '播放中' })
const progress = (page: Page) => page.getByRole('complementary', { name: '跟著步驟做' }).locator('[aria-live="polite"]').first()
const tabs = (page: Page) => page.getByRole('tablist', { name: '本課影片' }).getByRole('tab')

/** 元素完整位於視窗內(不捲動頁面就看得到) */
async function expectInViewport(page: Page, loc: Locator, what: string) {
  await expect(loc, what).toBeVisible()
  await expect
    .poll(
      async () => {
        const box = await loc.boundingBox()
        const vh = page.viewportSize()!.height
        const vw = page.viewportSize()!.width
        return !!box && box.y >= 0 && box.y + box.height <= vh + 0.5 && box.x >= 0 && box.x + box.width <= vw + 0.5
      },
      { message: `${what} 應完整顯示在第一屏(viewport ${JSON.stringify(page.viewportSize())})` },
    )
    .toBe(true)
}

let errors: string[]
test.beforeEach(async ({ page }) => {
  errors = collectErrors(page)
  // L1 登入後才能看
  const email = `e2e-lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  expect((await page.request.post('/api/auth/register', { data: { email, password: 'secret-pass-123', name: '' } })).status()).toBe(200)
  await page.goto(LESSON)
  await expect(player(page)).toBeVisible()
  await expect(progress(page)).toContainText('共 5 步')
})
test.afterEach(() => {
  expect(errors).toEqual([])
})

test('第一屏:播放器、播放中步驟的提示詞與複製鈕都不用捲動就看得到', async ({ page }) => {
  // 用鍵盤跳到第 2 步(有提示詞);鍵盤不會捲動整頁(Playwright 點擊會自動捲動,這裡刻意不用)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(step(page, 2)).toContainText('播放中')
  await expect(progress(page)).toContainText('第 2 步')

  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expectInViewport(page, player(page), '播放器')
  await expectInViewport(page, step(page, 2).getByRole('button', { name: /播放中/ }), '播放中步驟的標題')
  await expectInViewport(page, step(page, 2).locator('pre'), '提示詞')
  await expectInViewport(page, step(page, 2).getByRole('button', { name: '複製' }), '複製鈕')
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('預覽大綱 10×:播放進度推進「播放中」的步驟', async ({ page }) => {
  await expect(playingSteps(page)).toHaveCount(0)
  await player(page).getByRole('button', { name: '10×' }).click()
  await expect(player(page).getByRole('button', { name: '10×' })).toHaveAttribute('aria-pressed', 'true')
  await player(page).getByRole('button', { name: '播放', exact: true }).click()
  await expect(player(page).getByRole('button', { name: '暫停' })).toBeVisible()

  // 第 1 步的 cue 在 43 秒(10× ≈ 4.3 秒)
  await expect(step(page, 1)).toContainText('播放中', { timeout: 10_000 })
  await expect(playingSteps(page)).toHaveCount(1)
  await expect(step(page, 1).getByRole('button', { name: /播放中/ })).toHaveAttribute('aria-expanded', 'true')

  // 拉進度條到第 2 步的 cue(209 秒)之前一點,繼續播放就進到第 2 步
  await player(page).getByRole('slider', { name: '播放進度' }).fill('206')
  await expect(step(page, 2)).toContainText('播放中', { timeout: 10_000 })
  await expect(playingSteps(page)).toHaveCount(1)
  await expect(progress(page)).toContainText('第 2 步')
  // 前一步自動收起,並標為已完成
  await expect(step(page, 1).getByRole('button', { name: /播放中/ })).toHaveCount(0)
  await expect(step(page, 1).locator('[aria-expanded]')).toHaveAttribute('aria-expanded', 'false')
  await expect(step(page, 1).locator('[aria-expanded]')).toContainText('✓')

  await player(page).getByRole('button', { name: '暫停' }).click()
  await expect(player(page).getByRole('button', { name: '播放', exact: true })).toBeVisible()
})

test('▶ 跳轉按鈕:跳到該步並開始播放;其他影片的步驟切換影片', async ({ page }) => {
  // 影片 1 示範第 1–3 步:有 ▶ mm:ss;第 4、5 步在影片 2
  await expect(page.getByRole('button', { name: /^▶ \d\d:\d\d$/ })).toHaveCount(3)
  await expect(step(page, 4).getByRole('button', { name: '影片 2' })).toBeVisible()
  await expect(step(page, 5).getByRole('button', { name: '影片 2' })).toBeVisible()

  const seek2 = step(page, 2).getByRole('button', { name: /^▶ / })
  const label = (await seek2.textContent())!.replace('▶', '').trim() // 例如 03:29
  await seek2.click()
  await expect(step(page, 2)).toContainText('播放中')
  await expect(step(page, 2).locator('pre')).toBeVisible()
  await expect(player(page).getByRole('button', { name: '暫停' })).toBeVisible()
  const [mm, ss] = label.split(':').map(Number)
  const cue = mm * 60 + ss
  // 播放器時間(m:ss / 7:00)從 cue 開始走(1× 速度,允許幾秒誤差)
  await expect
    .poll(async () => {
      const m = (await player(page).textContent())!.match(/(\d+):(\d\d) \/ 9:00/)
      return m ? Number(m[1]) * 60 + Number(m[2]) - cue : NaN
    })
    .toBeGreaterThanOrEqual(0)
  const m = (await player(page).textContent())!.match(/(\d+):(\d\d) \/ 9:00/)!
  expect(Number(m[1]) * 60 + Number(m[2]) - cue).toBeLessThan(10)

  await step(page, 4).getByRole('button', { name: '影片 2' }).click()
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(step(page, 4)).toContainText('播放中')
  await expect(step(page, 4).locator('pre')).toBeVisible()
  // 影片 2 的 ▶ 換成第 4、5 步
  await expect(step(page, 4).getByRole('button', { name: /^▶ / })).toBeVisible()
  await expect(step(page, 5).getByRole('button', { name: /^▶ / })).toBeVisible()
  await expect(step(page, 1).getByRole('button', { name: '影片 1' })).toBeVisible()
})

test('← / → 鍵切換上一步與下一步(跨影片)', async ({ page }) => {
  await page.keyboard.press('ArrowRight')
  await expect(step(page, 1)).toContainText('播放中')
  await expect(progress(page)).toContainText('第 1 步')
  await page.keyboard.press('ArrowRight')
  await expect(step(page, 2)).toContainText('播放中')
  await page.keyboard.press('ArrowRight')
  await expect(step(page, 3)).toContainText('播放中')
  await expect(tabs(page).nth(0)).toHaveAttribute('aria-selected', 'true')
  // 第 4 步在影片 2:自動切到影片 2
  await page.keyboard.press('ArrowRight')
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(step(page, 4)).toContainText('播放中')
  await expect(progress(page)).toContainText('第 4 步')
  await page.keyboard.press('ArrowLeft')
  await expect(tabs(page).nth(0)).toHaveAttribute('aria-selected', 'true')
  await expect(step(page, 3)).toContainText('播放中')
  await expect(playingSteps(page)).toHaveCount(1)

  // ‹ › 按鈕與鍵盤同步;第 1 步時「上一步」停用
  await page.getByRole('button', { name: '上一步' }).click()
  await expect(step(page, 2)).toContainText('播放中')
  await page.getByRole('button', { name: '上一步' }).click()
  await expect(step(page, 1)).toContainText('播放中')
  await expect(page.getByRole('button', { name: '上一步' })).toBeDisabled()

  // 在輸入欄位(進度條)裡按方向鍵不切換步驟
  await player(page).getByRole('slider', { name: '播放進度' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(step(page, 1)).toContainText('播放中')
})

test('複製鈕:把提示詞複製到剪貼簿', async ({ page, context }, testInfo) => {
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  const s2 = step(page, 2)
  await expect(s2).toContainText('播放中')
  const prompt = (await s2.locator('pre').textContent())!.trim()
  expect(prompt.length).toBeGreaterThan(0)

  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await s2.getByRole('button', { name: '複製' }).click()
  await expect(s2.getByRole('button', { name: '已複製 ✓' })).toBeVisible()
  // 手機模擬環境的剪貼簿讀取不穩定,只在 desktop 驗證剪貼簿內容
  if (testInfo.project.name === 'desktop') {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(prompt)
  }
  // 1.6 秒後回到「複製」
  await expect(s2.getByRole('button', { name: '複製' })).toBeVisible({ timeout: 5_000 })
})

test('影片分頁:切換影片會換播放器、進度歸零、▶ 換成該影片的步驟', async ({ page }) => {
  await expect(tabs(page)).toHaveCount(2)
  await expect(tabs(page).nth(0)).toHaveAttribute('aria-selected', 'true')
  const firstName = await player(page).getAttribute('aria-label')

  await page.keyboard.press('ArrowRight')
  await expect(step(page, 1)).toContainText('播放中')

  await tabs(page).nth(1).click()
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(tabs(page).nth(0)).toHaveAttribute('aria-selected', 'false')
  await expect(player(page)).not.toHaveAttribute('aria-label', firstName!)
  await expect(player(page)).toContainText('0:00 /')
  await expect(playingSteps(page)).toHaveCount(0)
  await expect(progress(page)).toContainText('共 5 步')
  // 影片 2 示範第 4、5 步
  await expect(step(page, 4).getByRole('button', { name: /^▶ / })).toBeVisible()
  await expect(step(page, 5).getByRole('button', { name: /^▶ / })).toBeVisible()
  await expect(step(page, 1).getByRole('button', { name: '影片 1' })).toBeVisible()

  // 點步驟標題可以手動展開/收合
  const toggle = step(page, 2).locator('[aria-expanded]')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(step(page, 2).locator('pre')).toBeVisible()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
})
