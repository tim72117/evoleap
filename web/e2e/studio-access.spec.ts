// 研發基地限管理員:對照正式設定跑的 server(8199,沒有 -open-studio)測試未登入與一般會員。
// 管理員必須用 Google 登入,E2E 做不到;管理員能進入由 Go 測試涵蓋(TestInternalAccess、TestStaticHandlerInternalAccess),
// 內部頁本身的功能在其他 spec 用 8198 測。
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type APIRequestContext } from '@playwright/test'
import { DIST } from './support'

const GATED = 'http://127.0.0.1:8199'
const PAGES = ['/studio', '/studio/tools', '/materials', '/studio/actor-interaction/showcase', '/materials/promo', '/docs/live', '/docs/course-goals', '/studio/no-such-page']
const internalAssets = () => readdirSync(join(DIST, 'assets/internal')).map((f) => `/assets/internal/${f}`)

test.use({ baseURL: GATED })

async function registerMember(request: APIRequestContext) {
  const email = `member-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const r = await request.post('/api/auth/register', { data: { email, password: 'secret-pass-123', name: '一般會員' } })
  expect(r.status()).toBe(200)
  const body = await r.json()
  expect(body.user.isAdmin).toBe(false)
}

test.describe('HTTP', () => {
  test.skip(({ isMobile }) => isMobile, '純 HTTP 檢查,不需要每個 viewport 重跑')

  test('未登入:內部頁導向登入頁,內部檔案回 404', async ({ request }) => {
    for (const p of PAGES) {
      const r = await request.get(p, { maxRedirects: 0 })
      expect(r.status(), p).toBe(302)
      expect(r.headers().location, p).toBe(`/login?next=${encodeURIComponent(p)}`)
    }
    const assets = internalAssets()
    expect(assets.some((a) => /StudioApp-.*\.js$/.test(a))).toBe(true)
    for (const a of assets) expect((await request.get(a)).status(), a).toBe(404)
  })

  test('一般會員:內部頁與內部檔案都回 404', async ({ request }) => {
    await registerMember(request)
    for (const p of PAGES) expect((await request.get(p, { maxRedirects: 0 })).status(), p).toBe(404)
    for (const a of internalAssets()) expect((await request.get(a)).status(), a).toBe(404)
  })

  test('公開的 HTML 與打包檔不含內部內容,也不參照內部檔案', async ({ request }) => {
    const res = await request.get('/')
    expect(res.status()).toBe(200)
    expect(await res.text()).not.toContain('assets/internal/StudioApp')

    // 取自內部頁的標題與內文:任何一個出現在公開檔案,就是內容外流。
    const SENTINELS = ['靜態互動', '科技新知動態牆', '課程編排', '課程設計方法論', 'interactive-bakery', 'multi-session']
    const publicFiles = readdirSync(join(DIST, 'assets')).filter((f) => /\.(js|css)$/.test(f))
    expect(publicFiles.length).toBeGreaterThan(0)
    for (const f of publicFiles) {
      const text = readFileSync(join(DIST, 'assets', f), 'utf8')
      for (const s of SENTINELS) expect(text.includes(s), `${f} 含有「${s}」`).toBe(false)
    }
  })
})

test('未登入開內部頁:進到登入頁,網址記住要回去的地方', async ({ page }) => {
  await page.goto('/studio/actor-interaction/showcase?actor=notes')
  await expect(page).toHaveURL(/\/login\?next=%2Fstudio%2Factor-interaction%2Fshowcase%3Factor%3Dnotes$/)
  await expect(page.getByRole('tab', { name: '登入' })).toBeVisible()
})

test('一般會員開內部頁:顯示找不到頁面;頁尾沒有研發基地入口', async ({ page }) => {
  await registerMember(page.request)
  const res = await page.goto('/studio')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('找不到頁面')
  await expect(page.getByRole('link', { name: '研發基地' })).toHaveCount(0)
})

test('一般會員在站內切到內部網址:拿不到內容,顯示找不到頁面', async ({ page }) => {
  await registerMember(page.request)
  await page.goto('/')
  await page.evaluate(() => {
    history.pushState({}, '', '/studio/tools')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('找不到頁面')
})

test('公開課程頁沒有連到內部文件的連結', async ({ page }) => {
  await page.goto('/courses/ai-agent')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('a[href^="/docs"], a[href^="/studio"], a[href^="/materials"]')).toHaveCount(0)
})
