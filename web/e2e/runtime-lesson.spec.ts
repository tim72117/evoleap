// 執行中用管理 API 新增的課(evoleap lesson add 走的端點):不重新 build、不重開 server,單課頁就打得開。
// 用自己的 server 與資料庫(playwright.config.ts 的第三台,-open-studio 時管理 API 不檢查登入),不影響其他測試。
import { expect, test, type APIRequestContext } from '@playwright/test'
import { collectErrors, desktopOnly, sitemapPaths } from './support'

const BASE = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 8198) + 2}`
test.use({ baseURL: BASE })

test.beforeEach(({}, testInfo) => {
  test.skip(desktopOnly(testInfo), '會改課程資料,只在 desktop project 跑一次')
})

async function admin(request: APIRequestContext, method: 'post' | 'patch' | 'delete', path: string, data?: object) {
  const res = await request[method](`/api/admin/courses/${path}`, data ? { data } : {})
  expect(res.status(), `${method} ${path}: ${await res.text()}`).toBe(200)
}

const unitOf = async (request: APIRequestContext, course: string): Promise<string> =>
  ((await (await request.get(`/api/courses/${course}/map`)).json()) as { units: { id: string; hidden?: boolean }[] }).units.find((u) => !u.hidden)!.id

/** 新的一課掛上自己的腳本並開放(一個腳本檔只能屬於一課:拿現成腳本的內容另存一份),和 evoleap CLI 的步驟相同 */
async function openWithScript(request: APIRequestContext, course: string, lesson: string, source: string) {
  const script = `e2e/${course}-${lesson}.json`
  const content = await (await request.get(`/api/scripts/${source}`)).json()
  await admin(request, 'patch', `${course}/lessons/${lesson}`, { status: 'draft', access: 'free' })
  const put = await request.put(`/api/admin/scripts/${script}?course=${course}&lesson=${lesson}`, { data: content })
  expect(put.status(), await put.text()).toBe(200)
  await admin(request, 'patch', `${course}/lessons/${lesson}`, { status: 'open', script })
}

// server 的課程資料快取一分鐘:重跑時課程可能剛讀過,等到新資料生效
const served = (request: APIRequestContext, path: string) =>
  expect.poll(async () => (await request.get(path)).status(), { timeout: 70_000, message: path }).toBe(200)

test('新增並開放的課:單課頁 200、進 sitemap、總覽頁點得進去;刪掉後找不到', async ({ page, request }) => {
  test.setTimeout(120_000)
  const errors = collectErrors(page)
  const n = Date.now() % 100000
  const id = `9.${n}`
  const path = `/courses/web/9-${n}`
  const title = `執行中新增的一課 ${n}`
  await admin(request, 'post', 'web/lessons', { id, unitId: await unitOf(request, 'web'), title })
  await openWithScript(request, 'web', id, 'web/0.1.json')

  await served(request, path)
  expect(await (await request.get(path)).text()).toContain(`<title>${title}｜`)
  await expect.poll(async () => sitemapPaths(await (await request.get('/sitemap.xml')).text()), { timeout: 70_000 }).toContain(path)

  // 瀏覽器:從課程總覽點進去,播放器載入
  await page.goto('/courses/web')
  await page.locator(`a[href="${path}"]`).first().click()
  await expect(page).toHaveURL(new RegExp(`${path}$`))
  await expect(page.locator('h1')).toHaveText(title)
  await expect(page.locator('.vp').first()).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://evoleap.io${path}`)
  // 直接打開(server 的樣板)也一樣
  await page.goto(path)
  await expect(page.locator('h1')).toHaveText(title)
  expect(errors).toEqual([])

  // 刪掉:畫面照課程地圖顯示找不到(server 的狀態碼最多晚一分鐘,快取到期的 404 由 Go 測試涵蓋)
  await admin(request, 'patch', `web/lessons/${id}`, { status: 'planned', script: '' })
  await admin(request, 'delete', `web/lessons/${id}`)
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1, name: '找不到頁面' })).toBeVisible()
})

test('沒有手寫內容的課用該課程的通用版型;規劃中的課顯示規劃中章節頁', async ({ page, request }) => {
  test.setTimeout(120_000)
  const n = Date.now() % 100000
  // Claude Code:沒有手寫情境的課,標題與一句話用資料庫的
  await admin(request, 'post', 'claude-code/lessons', { id: `8.${n}`, unitId: await unitOf(request, 'claude-code'), title: `新情境 ${n}`, summary: '資料庫寫的一句話' })
  await openWithScript(request, 'claude-code', `8.${n}`, 'claude-code/fork.json')
  const scenario = `/courses/claude-code/8-${n}`
  await served(request, scenario)
  await page.goto(scenario)
  await expect(page.locator('h1')).toHaveText(`新情境 ${n}`)
  await expect(page.getByText('資料庫寫的一句話')).toBeVisible()
  await expect(page.locator('.vp').first()).toBeVisible()

  // 軟體課:規劃中的章節頁,麵包屑是所在階段
  await admin(request, 'post', 'software/lessons', { id: `20.${n}`, unitId: 'vibe-coding-basics', title: `規劃的新課 ${n}`, summary: '之後會做的事' })
  const planned = `/courses/software/20-${n}`
  await served(request, planned)
  await page.goto(planned)
  await expect(page.locator('h1')).toHaveText(`規劃的新課 ${n}`)
  await expect(page.getByText('之後會做的事')).toBeVisible()
  await expect(page.getByText('基礎').first()).toBeVisible()

  // 資料庫沒有的課:404,畫面是找不到頁面
  const res = await page.goto('/courses/web/no-such-lesson')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: '找不到頁面' })).toBeVisible()
})
