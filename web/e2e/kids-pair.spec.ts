// 配對已經有帳號的孩子:孩子產生配對碼 → 家長輸入 → 孩子用自己的帳號登入就是兒童模式(不能離開,只能登出)→ 家長解除配對。
import { expect, test } from '@playwright/test'
import { desktopOnly, loginAsNewStudent } from './support'

test('家長用配對碼配對孩子的帳號;孩子本人登入就是兒童模式,解除配對後恢復', async ({ browser, baseURL }, info) => {
  test.skip(desktopOnly(info), '只在桌面版測一次')
  const kidCtx = await browser.newContext({ baseURL })
  const parentCtx = await browser.newContext({ baseURL })
  const kid = await kidCtx.newPage()
  const parent = await parentCtx.newPage()
  await loginAsNewStudent(kid, 'kidacct')
  await loginAsNewStudent(parent, 'momacct')

  // 孩子:在「兒童」分頁產生配對碼(沒有自己的孩子才看得到這一塊)
  await kid.goto('/member/kids')
  await kid.getByRole('button', { name: '產生配對碼' }).click()
  const code = (await kid.locator('p[role="status"] strong').innerText()).trim()
  expect(code).toMatch(/^\d{6}$/)

  // 家長:輸入錯的碼會被擋;輸入對的碼配成新的孩子
  await parent.goto('/member/kids')
  const pair = parent.getByRole('region', { name: '配對已經有帳號的孩子' })
  await pair.getByLabel('配對碼').fill('000000')
  await pair.getByRole('button', { name: '配對' }).click()
  await expect(pair.getByRole('alert')).toContainText('配對碼不對或已經過期')
  await pair.getByLabel('配對碼').fill(code)
  await pair.getByRole('button', { name: '配對' }).click()
  await expect(pair.getByRole('status')).toContainText('已配對')
  const card = parent.getByRole('region', { name: /的上課時間/ })
  await expect(card).toContainText('已配對孩子的帳號')
  // 家長替孩子排時段(週一 16:00),孩子的帳號才有課可以上
  await card.getByRole('button', { name: '週一 16:00' }).click()
  await card.getByRole('button', { name: '儲存上課設定' }).click()
  await expect(card.getByText('已儲存')).toBeVisible()

  // 孩子本人(沒有開過兒童模式)打開兒童課:兒童模式自己就開著;頭像選單沒有「離開兒童模式」,只有「登出」
  await kid.goto('/topics/kids')
  const capsule = kid.locator('header').getByRole('button', { name: /^兒童模式:/ })
  await expect(capsule).toBeVisible()
  await capsule.click()
  await expect(kid.getByRole('menuitem', { name: '登出' })).toBeVisible()
  await expect(kid.getByRole('menuitem', { name: '離開兒童模式' })).toHaveCount(0)
  // 伺服器也不讓本人離開
  expect(await kid.evaluate(() => fetch('/api/kids/mode', { method: 'DELETE' }).then((r) => r.status))).toBe(403)
  // 配對之後這個帳號不能再產生配對碼
  expect(await kid.evaluate(() => fetch('/api/kids/pair-code', { method: 'POST' }).then((r) => r.status))).toBe(403)

  // 家長解除配對:孩子檔案還在,孩子的帳號回到一般帳號(不在兒童模式)
  parent.on('dialog', (d) => void d.accept())
  await card.getByRole('button', { name: '解除配對' }).click()
  await expect(card).not.toContainText('已配對孩子的帳號')
  await expect(parent.getByRole('region', { name: /的上課時間/ })).toBeVisible()
  expect(await kid.evaluate(() => fetch('/api/kids/mode').then((r) => r.json()).then((b: { active: boolean }) => b.active))).toBe(false)

  await kidCtx.close()
  await parentCtx.close()
})
