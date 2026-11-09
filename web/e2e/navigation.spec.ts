// 路由與前端導覽的回歸測試:首頁 → 課程地圖 → 課程總覽 → 單課的點擊流程;
// 前端換頁後 <title> 與 canonical 要和 server 預先產生的 HTML 一致;
// 每個公開頁與主要內部頁開啟時沒有 console error / 例外 / 失敗的請求。
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { collectErrors, distSitemapPaths, ensureLandscape, landscape, ORIGIN, openCoursePanel, parseHead, loginAsNewStudent } from './support'

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
  await loginAsNewStudent(page)
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible()
  await expectHeadMatches(page, request, '/')

  // 首頁的主打主題 → 主題頁(兒童主題的卡片也有「課程地圖」,限定在主打主題裡找)
  await page.getByRole('article', { name: '做出自己的軟體' }).getByRole('link', { name: '課程地圖', exact: true }).click()
  await expectHeadMatches(page, request, '/topics/software')
  await expect(page).toHaveURL(/#map$/)

  // 課程地圖的 L0 卡片
  const card = page.locator('#level-tools')
  await card.getByRole('link', { name: /查看課程內容/ }).click()
  await expectHeadMatches(page, request, '/courses/tools')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // 課程總覽 → 第 1 課(清單裡的連結)
  await page.locator('main ol a[href="/courses/tools/1"]').click()
  await expectHeadMatches(page, request, '/courses/tools/1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('認識專案：工作目錄與檔案操作')

  // 下一課(側欄預設收合,先點右上角的章節膠囊打開)
  await openCoursePanel(page)
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

test('全部課程:導覽列可以進入,每張卡片的連結都能開啟(不是 404)', async ({ page, request }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await page.locator('header').getByRole('link', { name: '全部課程', exact: true }).click()
  await expectHeadMatches(page, request, '/courses')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('全部課程')
  const links = await page.locator('main li a[href^="/courses/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')!))
  expect(links.length).toBe(5)
  for (const href of links) {
    await page.goto('/courses')
    await page.locator(`main li a[href="${href}"]`).click()
    await expectHeadMatches(page, request, href)
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('找不到頁面')
  }
  expect(errors).toEqual([])
})

test('Claude Code 工作術:首頁卡片進入主題頁,列出情境,沒有等級', async ({ page, request }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await page.getByRole('article').filter({ hasText: 'Claude Code 工作術' }).getByRole('link', { name: /看課程規劃/ }).click()
  await expectHeadMatches(page, request, '/topics/claude-code')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Claude Code 工作術')
  const rows = page.locator('#scenarios ul > li h4')
  await expect(rows).toHaveCount(7)
  await expect(page.locator('#main')).not.toContainText('Level')
  // Fork 的示範影片是公開的腳本,未登入也能載入
  await expect(page.locator('#scenarios .vp')).toHaveCount(0)
  const row = page.getByRole('button', { name: '拿不定主意，想同時試好幾版' })
  await expect(row).toHaveAttribute('aria-expanded', 'false')
  await row.click()
  await expect(row).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#scenarios .vp')).toBeVisible()
  await expect(page.getByText('找不到即時教學畫面的腳本')).toHaveCount(0)
  // 收合影片列:播放器隱藏但不卸載,再展開時不會重新載入
  await page.locator('#scenarios .vp').evaluate((el) => el.setAttribute('data-e2e-same', '1'))
  await row.click()
  await expect(page.locator('#scenarios .vp')).toBeHidden()
  await row.click()
  await expect(page.locator('#scenarios .vp[data-e2e-same]')).toBeVisible()
  // 收合整組:同樣只是隱藏
  await page.getByRole('button', { name: /全部情境/ }).click()
  await expect(rows.first()).toBeHidden()
  await page.getByRole('button', { name: /全部情境/ }).click()
  await expect(page.locator('#scenarios .vp[data-e2e-same]')).toBeVisible()
  expect(errors).toEqual([])
})

test('舊的首頁錨點導到主題頁:/#map、/#level-tools', async ({ page }) => {
  await page.goto('/#map')
  await expect(page).toHaveURL('/topics/software#map')
  await page.goto('/#level-tools')
  await expect(page).toHaveURL('/topics/software#level-tools')
  await expect(page.locator('#level-tools')).toBeVisible()
})

test('首頁:不放影片預覽,開始第一課連到序章', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page.getByRole('article', { name: '做出自己的軟體' })).toBeVisible()
  // 首頁不放播放器(主打主題的展示影片、兒童課的預覽都拿掉了)
  await expect(page.locator('.vp')).toHaveCount(0)
  // 主打主題與兒童主題各有一個「開始第一課」;主打主題的連到可以免費預覽的序章
  await expect(page.getByRole('article', { name: '做出自己的軟體' }).getByRole('link', { name: '開始第一課' })).toHaveAttribute('href', '/courses/tools/intro')
  const kids = page.getByRole('region', { name: '給孩子的網頁程式' })
  await expect(kids.getByRole('link', { name: '開始第一課' })).toHaveAttribute('href', '/topics/kids/0-1')
  await expect(kids.getByRole('link', { name: '課程地圖' })).toHaveAttribute('href', '/topics/kids#map')
  // 首頁不標「開放中」,只有規劃中的主題標「規劃中」
  await expect(page.getByText('開放中', { exact: true })).toHaveCount(0)
  await expect(page.getByText('規劃中').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('網頁怎麼運作:首頁卡片連到主題,第一課免費預覽、其他開放的課登入後學習,第一課不用登入就能上', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: '網頁怎麼運作', exact: true }) })
  await expect(card.getByText('AI 寫程式，我還需要知道什麼？')).toBeVisible()
  await expect(card.getByText('開放中')).toHaveCount(0)
  await expect(card.getByRole('link', { name: '開始第一課' })).toHaveAttribute('href', '/topics/web/0-1')

  await page.goto('/topics/web')
  await expect(page.locator('h1')).toHaveText('網頁怎麼運作')
  await expect(page.getByRole('heading', { name: '課程說明' })).toBeVisible()
  const row = (title: string) => page.locator('#map li').filter({ hasText: title })
  await expect(row('輸入網址之後發生的事').getByText('免費預覽')).toBeVisible()
  await expect(row('HTML、CSS、JavaScript 的分工').getByRole('img', { name: '登入後學習' })).toBeVisible()
  await expect(row('元素與標籤').getByRole('img', { name: '登入後學習' })).toBeVisible()
  await expect(row('有意義的區塊').getByText('規劃中')).toBeVisible()
  await expect(row('有意義的區塊').getByRole('link')).toHaveCount(0)

  // 第一課不用登入:直接進到互動舞台,側欄有下一課
  await row('輸入網址之後發生的事').getByRole('link').click()
  await expect(page).toHaveURL(/\/topics\/web\/0-1$/)
  await expect(page.locator('.vp')).toBeVisible()
  await openCoursePanel(page)
  await expect(page.getByRole('link', { name: '下一課：0.2 →' })).toHaveAttribute('href', '/topics/web/0-2')
  await expect(page.locator('main').getByRole('link', { name: '登入或註冊' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('展示頁:播序章、從頭開始;開始播放後播放器和卡片同寬放最上面,標題與按鈕移到下面,縮小後恢復', async ({ page }, info) => {
  test.setTimeout(60000)
  test.skip(info.project.name === 'mobile', '手機上播放器本來就是整排寬')
  const errors = collectErrors(page)
  await page.goto('/showcase')
  const card = page.getByRole('article', { name: '做出自己的軟體' })
  const lede = card.locator('p').nth(1)
  const shrink = page.getByRole('button', { name: '縮小播放器' })

  // 一開始不放大、不自動播放,從 0 秒開始;左欄完整
  await expect(page.locator('.vp.paused')).toBeVisible()
  await expect(page.locator('.vp-time')).toHaveText(/^0:00 /)
  await expect(lede).toBeVisible()
  await expect(shrink).toHaveCount(0)
  await expect(card.getByRole('link', { name: '開始第一課' })).toHaveAttribute('href', '/courses/tools/intro')
  const small = (await page.locator('.vp').boundingBox())!

  // 開始播放:播放器和卡片內容同寬、在最上面,標題與按鈕在播放器下面;其他說明收起來
  await page.locator('.vp-big').click()
  await expect(shrink).toBeVisible()
  await expect.poll(async () => (await page.locator('.vp').boundingBox())!.width).toBeGreaterThan(small.width * 1.3)
  const c = (await card.boundingBox())!
  const v = (await page.locator('.vp').boundingBox())!
  const h2 = (await card.getByRole('heading', { name: '做出自己的軟體' }).boundingBox())!
  expect(c.width - v.width).toBeLessThan(80) // 只差卡片的內距
  expect(h2.y).toBeGreaterThanOrEqual(v.y + v.height)
  await expect(lede).toBeHidden()

  // 縮小:回到原本的大小,次要內容回來
  await shrink.click()
  await expect(shrink).toHaveCount(0)
  await expect(lede).toBeVisible()
  await expect.poll(async () => (await page.locator('.vp').boundingBox())!.width).toBeCloseTo(small.width, 0)

  // 兒童課的預覽捲到附近才載入,環節選單在左欄
  const kids = page.getByRole('region', { name: '給孩子的網頁程式' })
  await kids.scrollIntoViewIfNeeded()
  await expect(kids.getByRole('heading', { name: '課程環節' })).toBeVisible()
  expect(errors).toEqual([])
})

test('首頁與導覽列都沒有連到展示頁', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('a[href="/showcase"]')).toHaveCount(0)
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

test('研發基地:AI 工具技巧與兒童網頁課在「課程」,直式舞台在「開發」', async ({ page }) => {
  await page.goto('/studio/ai-tips')
  const sub = page.getByRole('navigation', { name: '課程頁面' })
  await expect(sub.getByRole('link', { name: '兒童網頁課' })).toHaveAttribute('href', '/studio/kids-web')
  await expect(sub.getByRole('link', { name: '網頁運作知識' })).toHaveAttribute('href', '/studio/web-basics')
  // 「做出自己的軟體」的 L0–L4 框成一組
  // 預設收合(不在這一組的頁面時一課都不顯示),按群組名稱展開
  const series = sub.getByRole('group', { name: '做出自己的軟體' })
  await expect(series.getByRole('link')).toHaveCount(0)
  await series.getByRole('button', { name: /做出自己的軟體/ }).click()
  await expect(series.getByRole('button', { name: /做出自己的軟體/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(series.getByRole('link')).toHaveCount(5)
  await expect(series.getByRole('link', { name: '兒童網頁課' })).toHaveCount(0)
  await page.goto('/studio/portrait')
  await expect(page.locator('h1')).toContainText('直式舞台')
  const dev = page.getByRole('navigation', { name: '開發頁面' })
  await expect(dev.getByRole('link', { name: '直式舞台' })).toHaveAttribute('aria-current', 'page')
  await expect(dev.getByRole('link', { name: '演員互動' })).toBeVisible()
  await expect(dev.getByRole('link', { name: '即時教學影像' })).toBeVisible()
  await page.getByRole('navigation', { name: '研發基地' }).getByRole('link', { name: '構想' }).click()
  const ideas = page.getByRole('navigation', { name: '構想頁面' })
  await expect(ideas.getByRole('link', { name: '直式舞台' })).toHaveCount(0)
  await expect(ideas.getByRole('link', { name: 'AI 工具技巧' })).toHaveCount(0)
  await expect(ideas.getByRole('link', { name: '兒童網頁課' })).toHaveCount(0)
})

test('直式舞台:試做按下才載入,可換腳本與方向', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/studio/portrait')
  const player = page.getByTestId('promo-player')
  await expect(player).toHaveCount(0)
  await page.getByRole('button', { name: '▶ 載入直式試做' }).click()
  await expect(player).toHaveAttribute('data-aspect', 'portrait')
  await expect(player.locator('.live-stage')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('group', { name: '試做腳本' }).getByRole('button', { name: /序章/ }).click()
  await page.getByRole('group', { name: '舞台方向' }).getByRole('button', { name: '橫式 16:9' }).click()
  await expect(player).toHaveAttribute('data-aspect', 'landscape')
  await expect(player.locator('.live-stage')).toBeVisible({ timeout: 15_000 })
  expect(errors).toEqual([])
})

test('直式舞台:調度試做,演員動作時輪到前景,後景變小、失焦', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/studio/portrait')
  await page.getByRole('button', { name: '▶ 載入直式試做' }).click()
  await page.getByRole('group', { name: '試做腳本' }).getByRole('button', { name: '調度：前後景輪替' }).click()
  await page.waitForFunction(() => window.__promoReady === true)
  const zAt = (at: number) =>
    page.evaluate((ms) => {
      window.__promo!.renderAt(ms)
      const z = (id: string) => {
        const el = document.querySelector<HTMLElement>(`[data-testid=promo-player] .slot[data-cast="${id}"]`)!
        return { z: Number(el.style.zIndex), filter: el.style.filter }
      }
      return { claude: z('claude'), browser: z('browser') }
    }, at)
  const at = (text: string) => page.evaluate((t) => window.__promo!.captions.find((c) => c.text.includes(t))!.from, text)
  // 一開始 Claude 在前景;瀏覽器動作時換到前景,Claude 退到後面、失焦
  const first = await zAt(await at('誰在動作'))
  expect(first.claude.z).toBeGreaterThan(first.browser.z)
  expect(first.browser.filter).toContain('blur')
  const swapped = await zAt((await at('換瀏覽器動作')) + 1500)
  expect(swapped.browser.z).toBeGreaterThan(swapped.claude.z)
  expect(swapped.claude.filter).toContain('blur')
  expect(errors).toEqual([])
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
  await page.getByRole('link', { name: '開發' }).first().click()
  await page.getByRole('link', { name: '演員互動' }).first().click()
  await page.getByRole('navigation', { name: '演員互動頁面' }).getByRole('link', { name: '互動教學場景' }).click()
  await expect(page).toHaveURL('/studio/actor-interaction/scene')
  await expect(page.getByRole('link', { name: '← 演員互動' })).toHaveAttribute('href', '/studio/actor-interaction')
  await ensureLandscape(page)

  // 從步驟清單跳到第一個互動點
  const panel = await openCoursePanel(page)
  await panel.getByRole('button', { name: /客人甲明天就要蛋糕/ }).click()
  await expect(panel.getByRole('heading', { name: /客人甲明天就要蛋糕/ })).toBeVisible()

  await panel.getByRole('button', { name: '蛋糕要提前兩天訂，後天可以嗎？' }).click()
  await expect(page.locator('.A-chat .ch-row.mine').first()).toContainText('後天可以嗎')
  // 回答後側欄收合,再打開
  await openCoursePanel(page)
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

test('靜態演員:互動時影片停止,演員畫在舞台外且不受舞台縮放,回答後收起', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(landscape('/studio/actor-interaction/static'))
  const panel = await openCoursePanel(page)
  await expect(page.getByTestId('static-actor')).toHaveCount(0)
  await panel.getByRole('button', { name: /你要送出哪一句/ }).click()

  const still = page.getByTestId('static-actor').locator('.A-claude-desktop')
  await expect(still).toBeVisible()
  await expect(still).toContainText('描述你要做的事')
  // 字維持演員原本的大小(--u 是 18px),舞台裡的同一位演員則跟著縮放
  const scaleOf = (loc: typeof still) => loc.evaluate((el) => el.getBoundingClientRect().width / (el as HTMLElement).offsetWidth)
  // (窄視窗打開側欄時靜態演員可用的寬度變窄,可能為了放得下而縮一點點)
  expect(await scaleOf(still)).toBeCloseTo(1, 1)
  expect(await scaleOf(page.locator('.vp .live-stage .A-claude-desktop'))).toBeLessThan(1)

  // 影片是停著的
  const time = page.locator('.vp-time')
  const before = await time.textContent()
  await page.waitForTimeout(1200)
  expect(await time.textContent()).toBe(before)

  // 直接在演員身上回答,不開詢問框;回答後收起並接著演
  await expect(panel.getByRole('button', { name: '建立 hello.txt，寫一句問候' })).toHaveCount(0)
  await page.getByTestId('static-actor').getByRole('button', { name: '建立 hello.txt，寫一句問候' }).click()
  await expect(page.getByTestId('static-actor')).toHaveCount(0)
  await expect(page.locator('.vp .live-stage .A-claude-desktop')).toContainText('建立 hello.txt，寫一句問候', { timeout: 15000 })
  expect(errors).toEqual([])
})

test('靜態演員:直式窄視窗播到互動點時,抽屜不展開,不擋住演員', async ({ page }, info) => {
  test.setTimeout(60000)
  test.skip(info.project.name !== 'mobile', '抽屜只在窄視窗出現')
  await page.goto('/studio/actor-interaction/static?aspect=portrait')
  await page.locator('.vp-big').click()
  await expect(page.getByTestId('static-actor')).toBeVisible({ timeout: 40000 })
  // 抽屜不展開:步驟照樣列在播放窗下方
  await expect(page.getByRole('region', { name: '課程資訊' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: '課程章節與步驟' })).toHaveCount(0)
})

test('把演員推到主畫面:側欄讓開,直接在 Claude 上選指令與按允許,側欄維持章節與步驟', async ({ page }) => {
  const errors = collectErrors(page)
  // 在開發「演員互動」底下,返回也回到那裡
  await page.goto('/studio/actor-interaction')
  await page.getByRole('navigation', { name: '演員互動頁面' }).getByRole('link', { name: '把演員推到主畫面' }).click()
  await expect(page).toHaveURL('/studio/actor-interaction/push')
  await expect(page.getByRole('link', { name: '← 演員互動' })).toHaveAttribute('href', '/studio/actor-interaction')
  await ensureLandscape(page)
  const panel = await openCoursePanel(page)

  await panel.getByRole('button', { name: /你要送出哪一句/ }).click()
  await expect(panel.getByRole('button', { name: /換你下指令/ })).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await page.getByRole('button', { name: '建立 hello.txt，寫一句問候' }).click()
  await expect(page.locator('.A-claude-desktop').first()).toContainText('建立 hello.txt，寫一句問候', { timeout: 15000 })

  // 播到確認提示:推到確認框上,按鈕就是演員自己的按鈕
  await page.getByRole('button', { name: '允許一次', exact: true }).click({ timeout: 25000 })
  await expect(page.locator('.A-claude-desktop').first()).toContainText('已建立', { timeout: 15000 })
  // 側欄可以重新回答(回答後側欄收合,再打開)
  await openCoursePanel(page)
  await panel.getByRole('button', { name: '重新回答' }).first().click()
  await expect(page.getByRole('button', { name: '幫我打個招呼' })).toBeVisible()
  expect(errors).toEqual([])
})

test('L0 第 0 課是互動版:用原本的腳本,在 Claude 上回答後接著演,側欄有下一課與提示詞', async ({ page, context }) => {
  test.setTimeout(90000)
  const errors = collectErrors(page)
  await loginAsNewStudent(page)
  await page.goto(landscape('/courses/tools/0'))
  const panel = await openCoursePanel(page)
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
  await loginAsNewStudent(page)
  await page.goto(landscape('/courses/tools/1'))
  const panel = await openCoursePanel(page)
  await expect(panel.getByRole('button', { name: /建立專案資料夾/ })).toBeVisible()
  await expect(panel.getByText('目前的工作目錄是哪裡？', { exact: true })).toBeVisible()

  await panel.getByRole('button', { name: /哪一句寫對了/ }).click()
  await page.getByRole('button', { name: '在 idea.txt 記下：首頁要有預約按鈕', exact: true }).click()
  await expect(page.locator('.A-claude-desktop')).toContainText('這樣檔案會放在工作目錄最外層', { timeout: 20000 })
  await expect(page.locator('.A-claude-desktop')).toContainText('已在 drafts/idea.txt 記下', { timeout: 40000 })
  expect(errors).toEqual([])
})

test('L0 第 2 課是互動版:播到響應式的互動點會停下,選手機後瀏覽器縮成手機寬度並說明,再繼續', async ({ page }) => {
  test.setTimeout(90000)
  const errors = collectErrors(page)
  await loginAsNewStudent(page)
  await page.goto(landscape('/courses/tools/2'))
  const panel = await openCoursePanel(page)
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
  await openCoursePanel(page)
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
  '/studio/todo',
  '/studio/kids-web',
  '/studio/web-basics',
  '/studio/ops-course',
  '/studio/vibe-coding/4-1',
  '/studio/vibe-coding/4-2',
  '/studio/vibe-coding/4-3',
  '/studio/vibe-coding/15-1',
  '/studio/vibe-coding/15-2',
  '/studio/vibe-coding/15-3',
  '/studio/portrait',
  '/studio/scenes',
  '/studio/fable-trial',
  '/studio/kids-family',
  '/studio/extensions',
  '/studio/live-script-mcp',
  '/studio/ai-scenarios',
  '/studio/full-course',
  '/studio/kids-web/0-1',
  '/studio/kids-web/0-1/live',
  '/studio/kids-web/0-2/live',
  '/studio/kids-web/0-3/live',
  '/studio/kids-web/xray',
  // 兒童課草稿(這台 server 把每個人當管理員,看得到):新演員 lt8–lt11 的課各挑一課
  '/topics/kids/1-1',
  '/topics/kids/2-1',
  '/topics/kids/3-1',
  '/topics/kids/4-5',
  '/studio/docs',
  '/materials',
  '/studio/actor-interaction/scene',
  '/studio/actor-interaction/push',
  '/studio/actor-interaction/static',
  '/studio/actor-interaction',
  '/studio/tools',
  '/studio/ai-agent/structure',
  '/materials/course-map',
  '/materials/cover-designer',
  '/studio/actor-interaction/showcase',
  '/materials/promo',
]

// 清單裡手寫的網址可能已經在 sitemap 裡(課程開放後):去掉重複,Playwright 不允許同名測試
for (const path of new Set(PAGES)) {
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
