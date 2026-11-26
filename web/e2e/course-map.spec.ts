// 主題頁的課程地圖從資料庫讀(GET /api/courses/{id}/map;資料在資料庫,測試用的資料庫由 server/internal/store/fixture 的假資料建立):
// 未登入時每門課的前五課免費預覽、其他開放的課登入後學習、還沒開放的規劃中;開放的課連到課程頁。
import { expect, test } from '@playwright/test'
import { GATED, collectErrors, desktopOnly, expectLabel, loginAsNewStudent, mapLessons } from './support'

test('兒童課程地圖由資料庫讀取', async ({ page }) => {
  // 照正式設定跑的 server:訪客看到的狀態和正式站一樣(這台 -open-studio 的 server 把每個人當管理員)
  const gated = GATED
  const res = page.waitForResponse((r) => r.url().endsWith('/api/courses/kids/map'))
  await page.goto(`${gated}/courses/kids#map`)
  expect((await res).status()).toBe(200)
  const map = page.locator('#map')
  const row = (id: string) => map.locator('li').filter({ hasText: new RegExp(`^${id.replace('.', '\\.')}(?![\\d.])`) })
  await expect(row('0.1').getByRole('link', { name: '測試單課 kids/0.1' })).toHaveAttribute('href', '/courses/kids/0-1')
  // 每一課的標示(免費預覽、登入後學習、規劃中)依資料庫的課程地圖
  for (const l of await mapLessons(page.request, 'kids', gated)) await expectLabel(row(l.id), l)
  // 沒寫 access 的開放課(照課程的登入後免費)訪客一樣看到可以點的課
  await expect(row('3.1').getByRole('link')).toHaveAttribute('href', '/courses/kids/3-1')
  // 4.1 起是規劃中:訪客看到規劃中、沒有連結,直接打開課程頁是「還沒開放」
  await expect(row('4.1')).toContainText('規劃中')
  await expect(row('4.1').getByRole('link')).toHaveCount(0)
  await page.goto(`${gated}/courses/kids/4-1`)
  await expect(page.getByText('這一課還沒開放')).toBeVisible()

  // 4.1 起課程頁與腳本寫好了,但正式機是規劃中(種子沒有掛腳本):管理員看到的也是規劃中,不連到課程頁
  const adminMap = page.waitForResponse((r) => r.url().endsWith('/api/courses/kids/map'))
  await page.goto('/courses/kids#map')
  const body = (await (await adminMap).json()) as { units: { lessons: { id: string; status: string }[] }[] }
  expect(body.units.flatMap((u) => u.lessons).find((l) => l.id === '4.1')?.status).toBe('planned')
  await expect(row('4.1')).toContainText('規劃中')
  await expect(row('4.1').getByRole('link')).toHaveCount(0)
})

test('網頁怎麼運作的課程地圖由資料庫讀取', async ({ page }) => {
  const res = page.waitForResponse((r) => r.url().endsWith('/api/courses/web/map'))
  await page.goto('/courses/web#map')
  expect((await res).status()).toBe(200)
  const map = page.locator('#map')
  const row = (id: string) => map.locator('li').filter({ hasText: new RegExp(`^${id.replace('.', '\\.')}(?![\\d.])`) })
  await expect(map.getByRole('heading', { name: /測試單元零/ })).toContainText('測試單元零的副標')
  await expect(row('0.1').getByRole('link', { name: '測試單課 web/0.1' })).toHaveAttribute('href', '/courses/web/0-1')
  // 每一課的標示依資料庫的課程地圖
  for (const l of await mapLessons(page.request, 'web')) await expectLabel(row(l.id), l)
})

// 開放的課:免費預覽的直接播、其他要登入(各挑一課);腳本載入後整課拖到底都不出錯
test('從做好到上線:免費預覽的直接播、其他要登入,兩種課都播得動', async ({ page }, info) => {
  test.skip(desktopOnly(info), '只在桌面版測一次')
  const errors = collectErrors(page)
  const slider = () => page.getByRole('slider', { name: '播放進度' }).first()
  const playToEnd = async (path: string) => {
    await page.goto(path)
    await expect(slider()).not.toHaveAttribute('aria-valuemax', '0', { timeout: 15_000 })
    await slider().focus()
    await page.keyboard.press('End')
    await expect(page.getByText('找不到')).toHaveCount(0)
  }
  // 用照正式設定跑的 server:訪客的存取方式和正式站一樣
  const open = (await mapLessons(page.request, 'launch', GATED)).filter((l) => l.status === 'open')
  const free = open.find((l) => l.access === 'free')!
  const gated = open.find((l) => l.access !== 'free')!
  const pathOf = (id: string) => `/courses/launch/${id.replace('.', '-')}`
  await playToEnd(`${GATED}${pathOf(free.id)}`)
  await page.goto(`${GATED}${pathOf(gated.id)}`)
  await expect(page.getByRole('dialog', { name: '登入' })).toBeVisible()
  await loginAsNewStudent(page)
  await playToEnd(pathOf(gated.id))
  expect(errors).toEqual([])
})

// 課程資訊只用資料庫:讀取中是佔位卡,讀不到是「無法讀取」,不用前端寫死的課程資料頂替
test('課程清單:讀取中顯示佔位卡,讀到之後換成課程', async ({ page }) => {
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => (release = r))
  await page.route('**/api/courses/web/map', async (route) => {
    await gate
    await route.continue()
  })
  await page.goto('/courses/web#map')
  await expect(page.getByTestId('lesson-list-loading')).toBeVisible()
  await expect(page.locator('#map li')).toHaveCount(0)
  release()
  await expect(page.getByTestId('lesson-list-loading')).toHaveCount(0)
  await expect(page.locator('#map li').first()).toBeVisible()
})

for (const [name, path, scope] of [
  ['網頁怎麼運作', '/courses/web#map', '#map'],
  ['從做好到上線', '/courses/launch#map', '#map'],
  ['Claude Code 工作術', '/courses/claude-code#map', '#map'],
  ['兒童課程地圖', '/courses/kids#map', '#map'],
  ['課程總覽(做出自己的軟體)', '/courses/software', '#course-content'],
] as const) {
  test(`課程清單讀不到:${name}顯示無法讀取,沒有前端的課程頂替`, async ({ page }) => {
    await page.route(/\/api\/courses\/[^/]+\/map$/, (route) => route.abort())
    await page.goto(path)
    await expect(page.getByTestId('lesson-list-error')).toBeVisible()
    await expect(page.getByText('無法讀取課程資訊')).toBeVisible()
    await expect(page.locator(`${scope} li`)).toHaveCount(0)
  })
}

// 全部課程頁的課程清單也只用資料庫(GET /api/courses):讀取中是佔位卡,讀不到是「無法讀取」,不用前端寫死的課程頂替
test('全部課程:讀取中顯示佔位卡,讀到之後換成課程,兒童課也是一般卡片', async ({ page }) => {
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => (release = r))
  await page.route(/\/api\/courses$/, async (route) => {
    await gate
    await route.continue()
  })
  await page.goto('/courses')
  await expect(page.getByTestId('lesson-list-loading')).toBeVisible()
  await expect(page.locator('main li')).toHaveCount(0)
  release()
  await expect(page.getByTestId('lesson-list-loading')).toHaveCount(0)
  await expect(page.locator('main li a[href="/courses/kids"]')).toBeVisible()
  await expect(page.locator('main li a[href="/courses/software"]')).toBeVisible()
})

test('全部課程:清單讀不到顯示無法讀取,沒有前端的課程頂替', async ({ page }) => {
  await page.route(/\/api\/courses$/, (route) => route.abort())
  await page.goto('/courses')
  await expect(page.getByTestId('lesson-list-error')).toBeVisible()
  await expect(page.getByText('無法讀取課程資訊')).toBeVisible()
  await expect(page.locator('main li')).toHaveCount(0)
})

test('單課頁:讀不到課程資訊時顯示無法讀取,不是直接放行', async ({ page }) => {
  await page.route(/\/api\/courses\/[^/]+\/map$/, (route) => route.abort())
  await page.goto('/courses/software/1')
  await expect(page.getByTestId('lesson-list-error')).toBeVisible()
  await expect(page.locator('.vp')).toHaveCount(0)
})
