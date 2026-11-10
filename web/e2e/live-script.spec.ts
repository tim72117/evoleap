// 即時腳本(/studio/live-script):後端的臨時腳本一改(MCP 的 evoleap mcp 就是呼叫這些 API),頁面透過 SSE 收到新版本、重新載入舞台,
// 並把載入結果回報回去。這台 E2E server 用 -open-studio(每個人都當管理員),API 不用登入。
// 頁面有一直連著的 SSE,所以不放在 navigation.spec.ts 的「開啟無錯誤」清單(那裡會等網路完全閒置)。
import { expect, test } from '@playwright/test'
import { collectErrors, desktopOnly } from './support'

test('改臨時腳本,頁面即時收到新版本並回報載入結果', async ({ page, request }, info) => {
  // 臨時腳本是伺服器上的同一份(每位管理員一份),桌面與手機同時跑會互相改到
  test.skip(desktopOnly(info), '只在桌面版測一次')
  const errors = collectErrors(page)
  await page.goto('/studio/live-script')
  const status = page.getByRole('status').first()
  await expect(status).toContainText('已連線')

  const script = {
    title: '小森烘焙的早上',
    cast: { phone: { actor: 'chat', props: { title: '小森烘焙' }, place: { x: 640, y: 110, w: 640, h: 860 }, hidden: true } },
    steps: [{ show: 'phone' }, { receive: '我要訂一個生日蛋糕', from: '客人甲' }],
  }
  const put = await request.put('/api/live-script', { data: { script } })
  expect(put.status()).toBe(200)
  const { version } = (await put.json()) as { version: number }
  await expect(status).toContainText(`第 ${version} 版 · 2 步`)
  await expect(status).toContainText('已載入')
  // 播放器停在開頭(第 0 秒訊息還沒進來),看得到手機的標題就代表舞台換成新腳本
  await expect(page.locator('[data-testid=live-script-player]')).toContainText('小森烘焙')
  await expect.poll(async () => ((await (await request.get('/api/live-script')).json()) as { report: { version: number } | null }).report?.version).toBe(version)

  // 寫錯的一步:頁面顯示錯誤並回報,舞台留在上一個能演的版本
  const bad = await request.post('/api/live-script/steps', { data: { step: { show: 'boss' } } })
  const badVersion = ((await bad.json()) as { version: number }).version
  await expect(page.getByRole('alert')).toContainText('演員表裡沒有「boss」')
  await expect
    .poll(async () => ((await (await request.get('/api/live-script')).json()) as { report: { version: number; error?: string } | null }).report)
    .toMatchObject({ version: badVersion, error: expect.stringContaining('boss') })
  await expect(page.locator('[data-testid=live-script-player]')).toContainText('小森烘焙')
  expect(errors).toEqual([])
})
