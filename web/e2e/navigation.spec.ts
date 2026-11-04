// 路由與前端導覽的回歸測試:首頁 → 課程地圖 → 課程總覽 → 單課的點擊流程;
// 前端換頁後 <title> 與 canonical 要和 server 預先產生的 HTML 一致;
// 每個公開頁與主要內部頁開啟時沒有 console error / 例外 / 失敗的請求。
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { collectErrors, distSitemapPaths, ORIGIN, parseHead } from './support'

/** server 回傳的(預先產生的)HTML 裡的 <title> */
async function serverTitle(request: APIRequestContext, path: string): Promise<string> {
  return parseHead(await (await request.get(path)).text()).titles[0]
}

/** 前端換頁後 head 的狀態:title、canonical 只能有一個且指向目前網址 */
async function expectHeadMatches(page: Page, request: APIRequestContext, path: string) {
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[/]/g, '\\/')}(#.*)?$`))
  await expect(page).toHaveTitle(await serverTitle(request, path))
  const canonical = page.locator('link[rel="canonical"]')
  await expect(canonical).toHaveCount(1)
  await expect(canonical).toHaveAttribute('href', ORIGIN + path)
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', ORIGIN + path)
  await expect(page.locator('title')).toHaveCount(1)
}

test('首頁 → 課程地圖卡片 → 課程總覽 → 單課 → 下一課(前端換頁)', async ({ page, request }, testInfo) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible()
  await expectHeadMatches(page, request, '/')

  // 首頁的主打主題 → 主題頁
  await page.getByRole('link', { name: '看全部課程' }).click()
  await expectHeadMatches(page, request, '/topics/software')

  // 課程地圖的 L0 卡片
  const card = page.locator('#level-tools')
  await card.getByRole('link', { name: /查看課程內容/ }).click()
  await expectHeadMatches(page, request, '/courses/tools')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // 課程總覽 → 第 1 課(清單裡的連結)
  await page.locator('main ol a[href="/courses/tools/1"]').click()
  await expectHeadMatches(page, request, '/courses/tools/1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('認識專案：工作目錄與檔案操作')

  // 下一課
  await page.getByRole('navigation', { name: '上一課與下一課' }).getByRole('link', { name: /下一課/ }).click()
  await expectHeadMatches(page, request, '/courses/tools/2')

  // 第 1、2 課都是互動版,沒有網站頁首與麵包屑:從左上角「← 課程」回課程總覽,再從頁首回首頁
  await page.getByRole('link', { name: /^← 課程|^課程$/ }).first().click()
  await expectHeadMatches(page, request, '/courses/tools')
  const back = '/courses/tools'
  await page.locator('header').getByRole('link', { name: '首頁', exact: true }).click()
  await expectHeadMatches(page, request, '/')

  // 瀏覽器上一頁也要同步 head
  await page.goBack()
  await expectHeadMatches(page, request, back)
  expect(errors).toEqual([])
})

test('課程地圖每張卡片的連結都能開啟(不是 404)', async ({ page, request }) => {
  const errors = collectErrors(page)
  await page.goto('/topics/software')
  const links = await page.locator('#map a[href^="/courses/"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('href')!),
  )
  expect(links.length).toBeGreaterThanOrEqual(5)
  for (const href of links) {
    await page.goto('/topics/software')
    await page.locator(`#map a[href="${href}"]`).first().click()
    await expectHeadMatches(page, request, href)
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('找不到頁面')
  }
  expect(errors).toEqual([])
})

test('舊的首頁錨點導到主題頁:/#map、/#level-tools', async ({ page }) => {
  await page.goto('/#map')
  await expect(page).toHaveURL('/topics/software#map')
  await page.goto('/#level-tools')
  await expect(page).toHaveURL('/topics/software#level-tools')
  await expect(page.locator('#level-tools')).toBeVisible()
})

test('首頁:主打主題可以播放第 0 課,開始第一課連到課程', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page.locator('.vp')).toBeVisible()
  await expect(page.getByRole('link', { name: '開始第一課' })).toHaveAttribute('href', '/courses/tools/0')
  await expect(page.getByText('規劃中').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('前端換到不存在的網址顯示找不到頁面,head 為 noindex 且沒有 canonical', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    history.pushState({}, '', '/courses/nope')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('找不到頁面')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('直接開啟不存在的網址:404 狀態且畫面顯示找不到頁面', async ({ page }) => {
  const res = await page.goto('/courses/nope')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('找不到頁面')
})

test('AI 工具技巧:舞台示範按下才載入,可以播放分岔的腳本', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/studio/ai-tips')
  await expect(page.locator('.st-cast')).toHaveCount(0)
  await page.getByRole('button', { name: /播放即時教學畫面/ }).click()
  await expect(page.locator('.A-claude-desktop, .st-cast').first()).toBeVisible({ timeout: 15_000 })
  expect(errors).toEqual([])
})

test('互動教學場景:回答後演員回應,回答加進時間軸,可以重新回答', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/studio')
  await page.getByRole('link', { name: '構想' }).first().click()
  await page.getByRole('link', { name: '互動教學場景' }).click()
  await expect(page).toHaveURL('/studio/interactive')

  // 從步驟清單跳到第一個互動點
  const panel = page.getByRole('complementary', { name: '課程章節與步驟' })
  await panel.getByRole('button', { name: /客人甲明天就要蛋糕/ }).click()
  await expect(panel.getByRole('heading', { name: /客人甲明天就要蛋糕/ })).toBeVisible()

  await panel.getByRole('button', { name: '蛋糕要提前兩天訂，後天可以嗎？' }).click()
  await expect(page.locator('.A-chat .ch-row.mine').first()).toContainText('後天可以嗎')
  await panel.getByRole('button', { name: '步驟', exact: true }).click()
  await expect(panel.getByRole('button', { name: /你的回答/ })).toBeVisible()

  // 自己打字:先收回剛才的回答
  await panel.getByRole('button', { name: /^互動( \d+)?$/ }).click()
  await panel.getByRole('button', { name: '重新回答' }).click()
  await panel.getByRole('textbox').fill('蛋糕來不及，<b>改後天</b>好嗎')
  await panel.getByRole('button', { name: '送出' }).click()
  await expect(page.locator('.A-chat .ch-row.mine').first()).toHaveText('蛋糕來不及，<b>改後天</b>好嗎')
  expect(errors).toEqual([])
})

test('把演員推到主畫面:側欄讓開,直接在 Claude 上選指令與按允許,側欄維持章節與步驟', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/studio/interactive/l0-claude-stage')
  const panel = page.getByRole('complementary', { name: '課程章節與步驟' })

  await panel.getByRole('button', { name: /你要送出哪一句/ }).click()
  await expect(panel.getByRole('button', { name: /換你下指令/ })).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await page.getByRole('button', { name: '建立 hello.txt，寫一句問候' }).click()
  await expect(page.locator('.A-claude-desktop').first()).toContainText('建立 hello.txt，寫一句問候', { timeout: 15000 })

  // 播到確認提示:推到確認框上,按鈕就是演員自己的按鈕
  await page.getByRole('button', { name: '允許一次', exact: true }).click({ timeout: 25000 })
  await expect(page.locator('.A-claude-desktop').first()).toContainText('已建立', { timeout: 15000 })
  // 側欄可以重新回答
  await panel.getByRole('button', { name: '重新回答' }).first().click()
  await expect(page.getByRole('button', { name: '幫我打個招呼' })).toBeVisible()
  expect(errors).toEqual([])
})

test('L0 第 0 課是互動版:用原本的腳本,在 Claude 上回答後接著演,側欄有下一課與提示詞', async ({ page, context }) => {
  test.setTimeout(90000)
  const errors = collectErrors(page)
  await page.goto('/courses/tools/0')
  const panel = page.getByRole('complementary', { name: '課程章節與步驟' })
  // 原本的章節都在
  await expect(panel.getByRole('button', { name: /安裝並登入/ })).toBeVisible()
  await expect(panel.getByRole('link', { name: /第 1 課/ })).toHaveAttribute('href', '/courses/tools/1')
  // 課程的提示詞可以複製到自己的工具
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await expect(panel.getByText('刪除 hello.txt', { exact: true })).toBeVisible()
  await panel.getByRole('button', { name: '複製', exact: true }).first().click()
  await expect(panel.getByRole('button', { name: '已複製 ✓' })).toBeVisible()

  await panel.getByRole('button', { name: /你要送出哪一句/ }).click()
  await page.getByRole('button', { name: '建立一個檔案', exact: true }).click()
  await expect(page.locator('.A-claude-desktop').last()).toContainText('你沒有說檔名和內容', { timeout: 20000 })
  await page.getByRole('button', { name: '拒絕', exact: true }).click({ timeout: 40000 })
  await expect(page.locator('.A-claude-desktop').last()).toContainText('好的，我不會建立這個檔案', { timeout: 20000 })
  expect(errors).toEqual([])
})

test('L0 第 1 課是互動版:選錯路徑時 Claude 會提醒,接著回到正確的指令', async ({ page }) => {
  test.setTimeout(90000)
  const errors = collectErrors(page)
  await page.goto('/courses/tools/1')
  const panel = page.getByRole('complementary', { name: '課程章節與步驟' })
  await expect(panel.getByRole('button', { name: /建立專案資料夾/ })).toBeVisible()
  await expect(panel.getByText('目前的工作目錄是哪裡？', { exact: true })).toBeVisible()
  // 訪客可以從側欄登入,登入後回到這一課
  await expect(panel.getByRole('link', { name: '登入' })).toHaveAttribute('href', '/login?next=%2Fcourses%2Ftools%2F1')

  await panel.getByRole('button', { name: /哪一句寫對了/ }).click()
  await page.getByRole('button', { name: '在 idea.txt 記下：首頁要有預約按鈕', exact: true }).click()
  await expect(page.locator('.A-claude-desktop')).toContainText('這樣檔案會放在工作目錄最外層', { timeout: 20000 })
  await expect(page.locator('.A-claude-desktop')).toContainText('已在 drafts/idea.txt 記下', { timeout: 40000 })
  expect(errors).toEqual([])
})

test('L0 第 2 課是互動版:播到響應式的互動點會停下,選手機後瀏覽器縮成手機寬度並說明,再繼續', async ({ page }) => {
  test.setTimeout(90000)
  const errors = collectErrors(page)
  await page.goto('/courses/tools/2')
  const panel = page.getByRole('complementary', { name: '課程章節與步驟' })
  await expect(page.locator('.vp')).toBeVisible()
  await expect(panel.getByRole('button', { name: /商品卡片的排列/ })).toBeVisible({ timeout: 15000 })
  await expect(panel.getByText('同一個網頁，換個裝置會變成什麼樣子？')).toBeVisible()

  // 從步驟清單跳到互動點:停下,三個裝置選項與「先看示範」都在
  await panel.getByRole('button', { name: /換個裝置會變成什麼樣子/ }).click()
  for (const name of ['手機', '平板', '桌面']) await expect(page.getByRole('button', { name: new RegExp(name) }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '先看示範' }).first()).toBeVisible()

  await page.getByRole('button', { name: /手機/ }).first().click({ timeout: 20000 })
  // 回應:說明手機版的排法(字幕與標註),瀏覽器視窗變窄
  await expect(page.getByText('手機：卡片一欄，導覽擠在一起')).toBeVisible({ timeout: 20000 })
  await expect(panel.getByRole('button', { name: '重新回答' })).toBeVisible()
  // 回答後自動接著播放:說完結論,視窗放寬回桌面,後面原本的演出照常
  await expect(page.getByText('同一份網頁，依螢幕寬度自動換排版').first()).toBeVisible({ timeout: 30000 })
  expect(errors).toEqual([])
})

// 每個公開頁 + 主要內部頁:開啟時沒有錯誤、h1 只有一個、hydrate 後 head 沒有重複標籤
const PAGES = [
  ...distSitemapPaths(),
  '/login',
  '/docs/live',
  '/studio',
  '/materials',
  '/studio/interactive',
  '/studio/interactive/l0-claude-stage',
  '/studio/actor-interaction',
  '/studio/tools',
  '/studio/ai-agent/structure',
  '/materials/course-map',
  '/materials/cover-designer',
  '/studio/actor-interaction/showcase',
  '/materials/promo',
]

for (const path of PAGES) {
  test(`開啟無錯誤:${path}`, async ({ page, request }) => {
    const errors = collectErrors(page)
    const res = await page.goto(path)
    expect(res?.status()).toBe(200)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1').first()).toBeVisible()
    // hydrate 後 document.title 要和 server 的 <title> 一致(SiteLayout / ProposalLayout 設定)
    await expect(page).toHaveTitle(await serverTitle(request, path))
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
    await expect(page.locator('meta[name="description"]')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1, name: '找不到頁面' })).toHaveCount(0)

    // 單課頁:h1 只放課名(課號、時長放在旁邊);title 是「第 N 課 <課名> · 站名」
    if (/^\/courses\/(tools|ai-tools)\/\d/.test(path)) {
      const title = await serverTitle(request, path)
      const lessonTitle = title.match(/^第 [\d.]+ 課 (.+) · /)?.[1]
      expect(lessonTitle, `title 格式:${title}`).toBeTruthy()
      await expect(page.locator('h1')).toHaveText(lessonTitle!)
    }
    expect(errors).toEqual([])
  })
}
