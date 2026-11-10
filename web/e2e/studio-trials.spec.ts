// 研發基地的試做頁:全環節課程清單、lab 試做清單、AI 情境清單是研發基地的資料檔(content/live/data/,寫入課程資料時進資料庫),
// 頁面向 GET /api/scripts/data/… 讀;試做頁沒有預先產生的 HTML,伺服器回研發基地首頁的 HTML,由前端路由依清單開那一堂。
// 這台 E2E server 用 -open-studio(每個人都當管理員)。
import { expect, test } from '@playwright/test'
import { collectErrors } from './support'

const pages: { path: string; title: RegExp; data: string }[] = [
  { path: '/studio/full-course/1-1/know', title: /^1\.1 .+（基礎知識）試做 · 課程提案$/, data: 'data/full-course.json' },
  { path: '/studio/web-basics/1-3', title: /網頁運作知識 1\.3/, data: 'data/lab-trials.json' },
  { path: '/studio/kids-web/1-1/live', title: /兒童網頁課 1\.1/, data: 'data/lab-trials.json' },
]

for (const p of pages) {
  test(`試做頁從資料庫的清單打開:${p.path}`, async ({ page }) => {
    const errors = collectErrors(page)
    const data = page.waitForResponse((r) => r.url().endsWith(`/api/scripts/${p.data}`))
    const res = await page.goto(p.path)
    expect(res?.status()).toBe(200)
    expect((await data).status()).toBe(200)
    await expect(page).toHaveTitle(p.title)
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: '找不到頁面' })).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test('清單裡沒有的試做網址顯示找不到頁面', async ({ page }) => {
  await page.goto('/studio/web-basics/9-9')
  await expect(page.getByRole('heading', { level: 1, name: '找不到頁面' })).toBeVisible()
  await page.goto('/studio/full-course/999-1/ai')
  await expect(page.getByRole('heading', { level: 1, name: '找不到頁面' })).toBeVisible()
})

test('清單頁從資料庫讀:全環節課程、試做清單、AI 情境', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/studio/full-course')
  await expect(page.getByText(/共 \d+ 個階段、\d+ 個單元/)).toBeVisible()
  await page.goto('/studio/trials')
  await expect(page.getByText(/共 \d+ 堂/).first()).toBeVisible()
  await page.goto('/studio/ai-scenarios')
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.getByText('讀取中…')).toHaveCount(0)
  expect(errors).toEqual([])
})
