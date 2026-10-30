// 登入/註冊的回歸測試(資料庫是每次測試新建的暫存 SQLite;每個測試用自己的隨機 Email)。
import { expect, test, type Page } from '@playwright/test'
import { collectErrors } from './support'

const PASSWORD = 'secret-pass-123'
const randomEmail = (tag: string) =>
  `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

const form = (page: Page) => page.locator('main form')
const emailInput = (page: Page) => form(page).getByLabel('Email')
const passwordInput = (page: Page) => form(page).getByLabel('密碼', { exact: true })
const userMenu = (page: Page, name: string) => page.locator('header').getByRole('button', { name: `帳號選單:${name}` })
const headerLogin = (page: Page) => page.locator('header').getByRole('link', { name: '登入', exact: true })

async function register(page: Page, email: string, name: string, password = PASSWORD) {
  await page.getByRole('tab', { name: '註冊' }).click()
  await form(page).getByLabel(/名稱/).fill(name)
  await emailInput(page).fill(email)
  await passwordInput(page).fill(password)
  await form(page).getByRole('button', { name: '建立帳號' }).click()
}

async function login(page: Page, email: string, password = PASSWORD) {
  await expect(page.getByRole('tab', { name: '登入' })).toHaveAttribute('aria-selected', 'true')
  await emailInput(page).fill(email)
  await passwordInput(page).fill(password)
  await form(page).getByRole('button', { name: '登入', exact: true }).click()
}

/** 用 API 註冊(快速建立帳號;cookie 會存進這個 context) */
async function registerViaApi(page: Page, email: string, name = '') {
  const r = await page.request.post('/api/auth/register', { data: { email, password: PASSWORD, name } })
  expect(r.status()).toBe(200)
}

test('註冊 → 已登入 → 重新整理仍登入 → 登出 → 再登入', async ({ page }) => {
  const errors = collectErrors(page)
  const email = randomEmail('flow')
  const name = '測試學員'

  await page.goto('/login')
  await expect(page).toHaveTitle(/^登入 · /)
  await expect(headerLogin(page)).toBeVisible()
  await register(page, email, name)

  // 註冊完回首頁,頁首顯示名稱
  await expect(page).toHaveURL(/\/$/)
  await expect(userMenu(page, name)).toBeVisible()
  await expect(headerLogin(page)).toHaveCount(0)

  // 重新整理:登入狀態保留(cookie)
  await page.reload()
  await expect(userMenu(page, name)).toBeVisible()
  const me = await (await page.request.get('/api/me')).json()
  expect(me.user).toMatchObject({ email, name })

  // 從頁首選單登出
  await userMenu(page, name).click()
  const menu = page.getByRole('menu', { name: '帳號' })
  await expect(menu).toContainText(email)
  await menu.getByRole('menuitem', { name: '登出' }).click()
  await expect(headerLogin(page)).toBeVisible()
  expect((await (await page.request.get('/api/me')).json()).user).toBeNull()
  await page.reload()
  await expect(headerLogin(page)).toBeVisible()

  // 再登入
  await headerLogin(page).click()
  await expect(page).toHaveURL(/\/login$/)
  await login(page, email)
  await expect(page).toHaveURL(/\/$/)
  await expect(userMenu(page, name)).toBeVisible()

  // 已登入時開登入頁:顯示「你已登入」,可在這裡登出
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '你已登入' })).toBeVisible()
  await expect(page.locator('main')).toContainText(name)
  await page.locator('main').getByRole('button', { name: '登出' }).click()
  await expect(page.getByRole('tab', { name: '登入' })).toBeVisible()
  await expect(headerLogin(page)).toBeVisible()
  expect(errors.filter((e) => !e.includes('/api/auth/'))).toEqual([])
})

test('密碼錯誤、帳號不存在、重複註冊、密碼太短都顯示錯誤', async ({ page }) => {
  const email = randomEmail('err')
  await registerViaApi(page, email)
  await page.request.post('/api/auth/logout')

  await page.goto('/login')
  await login(page, email, 'wrong-password')
  await expect(page.getByRole('alert')).toHaveText('Email 或密碼不正確')
  await expect(page).toHaveURL(/\/login$/)

  await emailInput(page).fill(randomEmail('nobody'))
  await passwordInput(page).fill(PASSWORD)
  await form(page).getByRole('button', { name: '登入', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Email 或密碼不正確')

  await register(page, email, '')
  await expect(page.getByRole('alert')).toHaveText('這個 Email 已經註冊過，請直接登入')

  await passwordInput(page).fill('short')
  await form(page).getByRole('button', { name: '建立帳號' }).click()
  await expect(page.getByRole('alert')).toHaveText('密碼至少需要 8 個字元')

  // 切換分頁清掉錯誤
  await page.getByRole('tab', { name: '登入' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect((await (await page.request.get('/api/me')).json()).user).toBeNull()
})

test('?next= 登入後回到原頁;頁首「登入」連結帶上目前頁面', async ({ page }) => {
  const email = randomEmail('next')
  await registerViaApi(page, email)
  await page.request.post('/api/auth/logout')

  await page.goto('/courses/tools/1')
  await expect(headerLogin(page)).toHaveAttribute('href', '/login?next=%2Fcourses%2Ftools%2F1')
  await headerLogin(page).click()
  await login(page, email)
  await expect(page).toHaveURL(/\/courses\/tools\/1$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('認識專案：工作目錄與檔案操作')

  // 已登入時帶 next:顯示「繼續前往」
  await page.goto('/login?next=/courses/ai-agent')
  await expect(page.getByRole('link', { name: '繼續前往' })).toHaveAttribute('href', '/courses/ai-agent')
})

for (const evil of ['//evil.com', '/\\evil.com', 'https://evil.com', '//evil.com/courses']) {
  test(`?next= 不接受站外網址(open redirect):${evil}`, async ({ page, baseURL }) => {
    const email = randomEmail('evil')
    await registerViaApi(page, email)
    await page.request.post('/api/auth/logout')

    await page.goto(`/login?next=${encodeURIComponent(evil)}`)
    await login(page, email)
    await expect(page).toHaveURL(`${baseURL}/`)

    await page.goto(`/login?next=${encodeURIComponent(evil)}`)
    await expect(page.getByRole('link', { name: '前往課程地圖' })).toHaveAttribute('href', '/#map')
  })
}

test('API:訪客 /api/me 回 {user:null};登入 cookie 是 HttpOnly + SameSite=Lax', async ({ page, context }) => {
  const guest = await page.request.get('/api/me')
  expect(guest.status()).toBe(200)
  expect(await guest.json()).toEqual({ user: null })

  const email = randomEmail('cookie')
  const r = await page.request.post('/api/auth/register', { data: { email, password: PASSWORD, name: '' } })
  expect(r.status()).toBe(200)
  const body = await r.json()
  expect(body.user).toMatchObject({ email, name: email.split('@')[0] })
  expect(body.user).not.toHaveProperty('passwordHash')
  expect(JSON.stringify(body)).not.toContain(PASSWORD)

  const cookie = (await context.cookies()).find((c) => c.name === 'shuttle_session')
  expect(cookie, 'shuttle_session cookie').toBeTruthy()
  expect(cookie!.httpOnly).toBe(true)
  expect(cookie!.sameSite).toBe('Lax')
  expect(cookie!.path).toBe('/')
  // JS 讀不到
  await page.goto('/')
  expect(await page.evaluate(() => document.cookie)).not.toContain('shuttle_session')

  // 重複註冊 409、密碼錯誤 401、格式錯誤 400、非 JSON 415
  expect((await page.request.post('/api/auth/register', { data: { email, password: PASSWORD } })).status()).toBe(409)
  expect((await page.request.post('/api/auth/login', { data: { email, password: 'nope-nope' } })).status()).toBe(401)
  expect((await page.request.post('/api/auth/register', { data: { email: 'bad', password: PASSWORD } })).status()).toBe(400)
  expect(
    (await page.request.post('/api/auth/login', { data: 'x', headers: { 'Content-Type': 'text/plain' } })).status(),
  ).toBe(415)

  // 登出清掉 cookie
  expect((await page.request.post('/api/auth/logout')).status()).toBe(204)
  expect((await context.cookies()).find((c) => c.name === 'shuttle_session')).toBeUndefined()
  expect(await (await page.request.get('/api/me')).json()).toEqual({ user: null })
})
