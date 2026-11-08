// 訪客上課紀錄(src/courses/guestActivity.ts、server/internal/api/guest.go):
// 未登入打開一課時記一筆、伺服器發 evoleap_guest cookie,播放後暫停會回報播放時間;登入的會員不記。
import { expect, test } from '@playwright/test'
import { desktopOnly, loginAsNewStudent } from './support'

// 訪客能直接看的只有序章
const LESSON = '/courses/tools/intro?aspect=landscape'

test.describe('訪客上課紀錄', () => {
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info), '只在桌面版測一次')
  })

  test('訪客打開一課記一筆,播放再暫停後回報播放時間', async ({ page, context }) => {
    const opened = page.waitForResponse((r) => r.url().endsWith('/api/guest/views') && r.request().method() === 'POST')
    // 播放器載入完成也回報一次(訪客漏斗用):帶 readyMs
    const ready = page.waitForRequest((r) => /\/api\/guest\/views\/[0-9a-f]{32}$/.test(r.url()) && r.method() === 'PUT' && 'readyMs' in JSON.parse(r.postData() ?? '{}'))
    await page.goto(LESSON)
    const res = await opened
    expect(res.status()).toBe(200)
    expect(JSON.parse(res.request().postData() ?? '{}')).toEqual({ lesson: 'live:l0/0.intro.json', from: '' })
    const cookie = (await context.cookies()).find((c) => c.name === 'evoleap_guest')
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.value).toMatch(/^[0-9a-f]{32}$/)

    const player = page.locator('.vp')
    await expect(player.getByRole('slider', { name: '播放進度' })).not.toHaveAttribute('aria-valuemax', '0', { timeout: 15_000 })
    expect((JSON.parse((await ready).postData() ?? '{}') as { readyMs: number }).readyMs).toBeGreaterThan(0)
    const watched = page.waitForRequest((r) => /\/api\/guest\/views\/[0-9a-f]{32}$/.test(r.url()) && r.method() === 'PUT' && (JSON.parse(r.postData() ?? '{}') as { watchedMs: number }).watchedMs > 0)
    await player.getByRole('button', { name: /播放/ }).first().click()
    await expect(player).not.toHaveClass(/paused/)
    await page.waitForTimeout(3500)
    // 播放中控制列會自動隱藏,先移到播放器上叫出來
    await player.hover()
    await player.getByRole('button', { name: '暫停' }).first().click()
    const put = await watched
    const body = JSON.parse(put.postData() ?? '{}') as { watchedMs: number; visibleMs: number }
    const ms = body.watchedMs
    expect(body.visibleMs).toBeGreaterThanOrEqual(ms)
    expect(ms).toBeGreaterThanOrEqual(2000)
    expect(ms).toBeLessThan(10_000)
    expect((await put.response())?.status()).toBe(204)
  })

  test('首頁的展示影片按下播放才記,記成「首頁展示」', async ({ page }) => {
    const lessons: string[] = []
    page.on('request', (r) => {
      if (r.url().endsWith('/api/guest/views') && r.method() === 'POST') lessons.push((JSON.parse(r.postData() ?? '{}') as { lesson: string }).lesson)
    })
    await page.goto('/')
    const player = page.locator('.vp').first()
    await expect(player.getByRole('slider', { name: '播放進度' })).not.toHaveAttribute('aria-valuemax', '0', { timeout: 15_000 })
    await page.waitForTimeout(1500)
    expect(lessons).toEqual([]) // 只打開首頁:不記
    await player.getByRole('button', { name: /播放/ }).first().click()
    await expect.poll(() => lessons).toEqual(['home:live:l0/0.intro.json'])
  })

  test('登入的會員不記訪客紀錄', async ({ page, context }) => {
    await loginAsNewStudent(page, 'guest-skip')
    const calls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/guest/')) calls.push(r.url())
    })
    await page.goto(LESSON)
    await expect(page.locator('.vp')).toBeVisible()
    await page.waitForTimeout(1500)
    expect(calls).toEqual([])
    expect((await context.cookies()).some((c) => c.name === 'evoleap_guest')).toBe(false)
  })
})
