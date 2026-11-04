// 演員展示頁 /studio/actor-interaction/showcase:每位演員都能播放,關掉區塊後畫面與腳本設定跟著改。
import { expect, test } from '@playwright/test'

const ACTORS = ['claude-desktop', 'finder', 'browser', 'chat', 'person', 'notes', 'editor', 'macbook']

for (const actor of ACTORS) {
  test(`${actor} 的示範腳本載入成功`, async ({ page }) => {
    await page.goto(`/studio/actor-interaction/showcase?actor=${actor}`)
    await expect(page.locator('[data-testid="actor-player"] .live-stage .slot')).toBeAttached()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}

test('關掉區塊:畫面藏起來,設定寫進腳本片段,再打開就恢復', async ({ page }) => {
  await page.goto('/studio/actor-interaction/showcase?actor=claude-desktop')
  const sidebar = page.locator('[data-testid="actor-player"] .cd-sidebar')
  await expect(sidebar).toBeVisible()
  await page.getByTestId('part-sidebar').uncheck()
  await expect(sidebar).toBeHidden()
  await expect(page.getByTestId('parts-snippet')).toContainText('"sidebar":false')
  await page.getByTestId('part-sidebar').check()
  await expect(sidebar).toBeVisible()
})

test('換演員後區塊清單跟著換', async ({ page }) => {
  await page.goto('/studio/actor-interaction/showcase?actor=claude-desktop')
  await page.getByTestId('actor-notes').click()
  await expect(page).toHaveURL(/actor=notes/)
  await expect(page.getByTestId('part-label')).toBeVisible()
  await expect(page.getByTestId('part-sidebar')).toHaveCount(0)
})

test.describe('靜態展示', () => {
  test('只有舞台沒有播放器,按操作才演出,可以復原與重設', async ({ page }) => {
    await page.goto('/studio/actor-interaction/showcase?actor=notes&mode=static')
    const box = page.getByTestId('actor-static')
    await expect(box.locator('.live-stage')).toBeAttached()
    await expect(page.locator('.vp')).toHaveCount(0)
    await expect(box.locator('.nt-note')).toHaveCount(0)
    await page.getByTestId('actor-op').first().click()
    await expect(box.locator('.nt-note')).toHaveCount(1)
    await page.getByTestId('actor-op').nth(1).click()
    await expect(box.locator('.nt-note')).toHaveCount(2)
    await page.getByTestId('actor-undo').click()
    await expect(box.locator('.nt-note')).toHaveCount(1)
    await page.getByTestId('actor-reset').click()
    await expect(box.locator('.nt-note')).toHaveCount(0)
  })

  test('目前做不了的操作會停用,做完前一步才能按', async ({ page }) => {
    await page.goto('/studio/actor-interaction/showcase?actor=claude-desktop&mode=static')
    const fork = page.getByTestId('actor-op').filter({ hasText: 'fork' })
    await expect(fork).toBeDisabled()
    await page.getByTestId('actor-op').filter({ hasText: 'menu' }).click()
    await expect(page.getByTestId('actor-static').locator('.cd-menu')).toBeVisible()
    await expect(fork).toBeEnabled()
    await fork.click()
    await expect(page.getByTestId('actor-static').locator('.sess-row.nested')).toBeVisible()
  })

  test('自訂動作:可以執行,寫錯會提示且畫面不變', async ({ page }) => {
    await page.goto('/studio/actor-interaction/showcase?actor=notes&mode=static')
    const box = page.getByTestId('actor-static')
    await expect(page.getByTestId('actor-op').first()).toBeVisible()
    await page.getByTestId('actor-custom').fill('{"jot": "自訂便條"}')
    await page.getByRole('button', { name: '執行' }).click()
    await expect(box.locator('.nt-note')).toContainText('自訂便條')
    await page.getByTestId('actor-custom').fill('不是 JSON')
    await page.getByRole('button', { name: '執行' }).click()
    await expect(page.getByRole('alert')).toContainText('JSON')
    await page.getByTestId('actor-custom').fill('{"lose": "沒有這張"}')
    await page.getByRole('button', { name: '執行' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(box.locator('.nt-note')).toHaveCount(1)
  })

  test('關掉區塊在靜態展示也有效,操作之後仍然藏著', async ({ page }) => {
    await page.goto('/studio/actor-interaction/showcase?actor=claude-desktop&mode=static')
    const sidebar = page.getByTestId('actor-static').locator('.cd-sidebar')
    await expect(sidebar).toBeVisible()
    await page.getByTestId('part-sidebar').uncheck()
    await expect(sidebar).toBeHidden()
    await page.getByTestId('actor-op').first().click()
    await expect(page.getByTestId('actor-static').locator('.cd-typed, .user').first()).toBeAttached()
    await expect(sidebar).toBeHidden()
  })
})

test('手機寬度:互動層不出現,提示改用操作按鈕', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', '只有窄視窗')
  await page.goto('/studio/actor-interaction/showcase?actor=claude-desktop&mode=static')
  await expect(page.getByTestId('actor-narrow')).toBeVisible()
  await expect(page.locator('[data-testid="actor-hits"] button')).toHaveCount(0)
})

test.describe('靜態展示的互動層', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'mobile', '手機寬度不提供互動層')
  })

  const stage = (page: import('@playwright/test').Page) => page.getByTestId('actor-static')
  const hit = (page: import('@playwright/test').Page, target: string) => page.locator(`[data-testid="actor-hits"] [data-target="${target}"]`)

  test('claude-desktop:直接點完新增 session、輸入訊息、切換、Fork', async ({ page }) => {
    await page.goto('/studio/actor-interaction/showcase?actor=claude-desktop&mode=static')
    await hit(page, 'new').click()
    await expect(stage(page).locator('.cd-sessTitle')).toHaveText('新的 session')

    await hit(page, 'composer').click()
    await page.getByTestId('actor-hit-input').fill('幫我加上表單')
    await page.getByTestId('actor-hit-input').press('Enter')
    await expect(stage(page).locator('.user')).toHaveText('幫我加上表單')

    await hit(page, 'session:加上訂購表單').click()
    await expect(stage(page).locator('.cd-sessTitle')).toHaveText('加上訂購表單')

    await hit(page, 'more:加上訂購表單').click()
    await expect(stage(page).locator('.cd-menu')).toBeVisible()
    await hit(page, 'menuitem:Fork').click()
    await expect(stage(page).locator('.sess-row.nested')).toContainText('加上訂購表單 (fork)')
    await expect(stage(page).locator('.cd-menu')).toHaveCount(0)
  })

  test('直接點的時候不畫虛擬滑鼠,按操作按鈕時才畫', async ({ page }) => {
    await page.goto('/studio/actor-interaction/showcase?actor=claude-desktop&mode=static')
    await hit(page, 'new').click()
    await expect(stage(page).locator('.st-cursor')).toBeHidden()
    await expect(hit(page, 'new')).toBeVisible()
    await page.getByTestId('actor-op').filter({ hasText: 'newSession' }).click()
    await expect(stage(page).locator('.st-cursor')).toBeVisible()
  })

  test('finder:點資料夾打開,點檔案選取,再點資料夾拖進去', async ({ page }) => {
    await page.goto('/studio/actor-interaction/showcase?actor=finder&mode=static')
    await hit(page, 'file:notes').click()
    await expect(stage(page).locator('.fd-title')).toHaveText('notes')
    await page.getByTestId('actor-undo').click()
    await hit(page, 'file:index.html').click()
    await hit(page, 'file:notes').click()
    await hit(page, 'file:notes').click()
    await expect(stage(page).locator('.fd-row')).toHaveCount(1)
  })

  test('關掉的區塊沒有點擊區,打開後恢復', async ({ page }) => {
    await page.goto('/studio/actor-interaction/showcase?actor=claude-desktop&mode=static')
    await expect(hit(page, 'new')).toBeVisible()
    await page.getByTestId('part-sidebar').uncheck()
    await expect(hit(page, 'new')).toHaveCount(0)
    await page.getByTestId('part-sidebar').check()
    await expect(hit(page, 'new')).toBeVisible()
  })

  for (const [actor, target] of [['browser', 'tab'], ['chat', 'window'], ['notes', 'window'], ['person', 'window'], ['macbook', 'window']]) {
    test(`${actor} 也有可以點的地方`, async ({ page }) => {
      await page.goto(`/studio/actor-interaction/showcase?actor=${actor}&mode=static`)
      await expect(hit(page, target)).toBeVisible()
    })
  }

  test('editor:開檔之後才能打字', async ({ page }) => {
    await page.goto('/studio/actor-interaction/showcase?actor=editor&mode=static')
    await expect(hit(page, 'code')).toHaveCount(0)
    await page.getByTestId('actor-op').filter({ hasText: 'index.html' }).click()
    await hit(page, 'code').click()
    await page.getByTestId('actor-hit-input').fill('<h1>嗨</h1>')
    await page.getByRole('button', { name: '送出' }).click()
    await expect(stage(page).locator('.ed-code')).toContainText('嗨')
  })
})
