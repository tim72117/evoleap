// 路由與前端導覽的回歸測試:首頁 → 課程地圖 → 課程總覽 → 單課的點擊流程;
// 前端換頁後 <title> 與 canonical 要和 server 預先產生的 HTML 一致;
// 每個公開頁與主要內部頁開啟時沒有 console error / 例外 / 失敗的請求。
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { collectErrors, reachMoment, distSitemapPages, distSitemapPaths, ensureLandscape, expectLabel, landscape, mapLessons, ORIGIN, parseHead, loginAsNewStudent } from './support'

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
  await page.getByRole('article', { name: '測試主題甲' }).getByRole('link', { name: '主題課程', exact: true }).click()
  await expectHeadMatches(page, request, '/topics/software')
  // 從首頁進主題頁停在最上方,不直接捲到課程地圖
  await expect(page).not.toHaveURL(/#/)

  // 課程地圖的 L0 卡片
  const card = page.locator('#level-tools')
  await card.getByRole('link', { name: /查看課程內容/ }).click()
  await expectHeadMatches(page, request, '/courses/software')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // 課程總覽 → 第 2 課(清單裡的連結)
  await page.locator('main ol a[href="/courses/software/2"]').click()
  await expectHeadMatches(page, request, '/courses/software/2')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('測試單課 software/0.2')

  // 下一課:連結在播放器控制列(手機是底部工具列)
  await page.getByRole('link', { name: /^下一課/ }).first().dispatchEvent('click')
  await expectHeadMatches(page, request, '/courses/software/3')

  // 第 2、3 課都是互動版,沒有網站頁首與麵包屑:從左上角「← 課程」回課程總覽,再從頁首回首頁
  await page.getByRole('link', { name: /^← 課程|^課程$/ }).first().click()
  await expectHeadMatches(page, request, '/courses/software')
  const back = '/courses/software'
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
  // 主題頁的區塊與課程地圖讀 API,等卡片的連結出現再收
  await expect(page.locator('#map a[href^="/courses/"]').first()).toBeVisible()
  const links = await page.locator('#map a[href^="/courses/"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('href')!),
  )
  expect(links.length).toBeGreaterThanOrEqual(5)
  for (const href of links) {
    await page.goto('/topics/software')
    await page.locator(`#map a[href="${href}"]`).first().click()
    // 連結可以帶階段錨點(/courses/software#stage-tools),頁面本身的網址不含錨點
    await expectHeadMatches(page, request, href.split('#')[0])
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
  // 清單讀 API,等卡片到齊再收連結
  await expect(page.locator('main li h3 a')).toHaveCount(7)
  const links = await page.locator('main li h3 a').evaluateAll((els) => els.map((e) => e.getAttribute('href')!))
  // 起步・零基礎・基礎合併成一門「做出自己的軟體」(一張卡片,先不公開的零基礎階段不另外列),加上 AI Agent 兩門(ai-agent 沒有自己的總覽頁(overview:false),卡片連到主題頁 /topics/ai-apps;進階課連 /courses/advanced),
  // 以及網頁怎麼運作、從做好到上線、給孩子的網頁程式、Claude Code 工作術(都是一般課程卡片,和其他課共用課程總覽頁),所以是 7 門
  expect(links.length).toBe(7)
  for (const href of ['/courses/software', '/courses/web', '/courses/launch', '/courses/kids', '/courses/claude-code', '/topics/ai-apps', '/courses/advanced']) expect(links).toContain(href)
  for (const href of links) {
    await page.goto('/courses')
    await page.locator(`main li h3 a[href="${href}"]`).first().click()
    await expectHeadMatches(page, request, href)
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('找不到頁面')
  }
  expect(errors).toEqual([])
})

test('Claude Code 工作術:首頁卡片進入課程總覽(共用的總覽頁),列出情境,沒有等級', async ({ page, request }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await page.getByRole('article').filter({ hasText: '測試主題辛' }).getByRole('link', { name: /看課程規劃/ }).click()
  await expectHeadMatches(page, request, '/courses/claude-code')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('測試課六')
  // 總覽頁的麵包屑接全部課程,不連回自己
  await expect(page.getByRole('navigation', { name: '麵包屑' }).getByRole('link')).toHaveAttribute('href', '/courses')
  await expect(page.locator('#map li')).toHaveCount(3)
  await expect(page.locator('#main')).not.toContainText('Level')
  // 這門課整門免費:存取標示是「免費」
  await expect(page.locator('#main').getByText('免費', { exact: true }).first()).toBeVisible()
  // 有示範影片的情境整列連到課頁,規劃中的沒有連結
  const rows = page.locator('#map li')
  await expect(rows.filter({ hasText: '測試單課 claude-code/1' }).getByRole('link')).toHaveAttribute('href', '/courses/claude-code/1')
  await expect(rows.filter({ hasText: '測試單課 claude-code/3' })).toContainText('規劃中')
  await expect(rows.filter({ hasText: '測試單課 claude-code/3' }).getByRole('link')).toHaveCount(0)
  // 開始學習 → 第一個有影片的情境
  await page.getByRole('link', { name: '開始學習' }).click()
  await expect(page).toHaveURL(/\/courses\/claude-code\/1$/)
  await expectHeadMatches(page, request, '/courses/claude-code/1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('測試單課 claude-code/1')
  // Fork 的示範影片是公開的腳本,未登入也能載入;下一課是第 2 個情境
  await expect(page.locator('.vp')).toBeVisible()
  await expect(page.getByText('找不到即時教學畫面的腳本')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /下一課：第 2 課/ })).toHaveAttribute('href', '/courses/claude-code/2')
  expect(errors).toEqual([])
})

// 影片錨點:舊網址 /topics/claude-code#<錨點>(錨點 = 腳本檔名,fork、remote)是一頁列出全部情境、展開那一段。
// 現在一個情境一頁:舊錨點轉到那個情境的課頁並保留錨點,網址帶 #錨點就定位到影片開頭
test('Claude Code 工作術:舊的影片錨點轉到情境的課頁,課頁的影片定位在開頭', async ({ page }) => {
  const errors = collectErrors(page)
  const anchors = [
    ['fork', '/courses/claude-code/1'],
    ['remote', '/courses/claude-code/2'],
  ] as const
  for (const [id, to] of anchors) {
    // 整頁載入(伺服器 301 到 /courses/claude-code,保留 #錨點,再由前端轉到課頁)
    await page.goto('about:blank')
    await page.goto(`/topics/claude-code#${id}`)
    await expect(page).toHaveURL(new RegExp(`${to.replace(/\//g, '\/')}#${id}$`))
    const player = page.locator(`#${id}`)
    await expect(player.locator('.vp')).toBeVisible()
    await expect(player).toBeInViewport()
    // 定位在影片的開頭(上緣在畫面上方,不是捲過頭只看到下半部)
    await expect.poll(async () => player.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(0)
    await expect.poll(async () => player.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(200)
  }
  // 沒有影片的錨點(#scenarios)留在總覽頁
  await page.goto('/topics/claude-code#scenarios')
  await expect(page).toHaveURL(/\/courses\/claude-code#map$/)
  await expect(page.locator('#map li')).toHaveCount(3)
  expect(errors).toEqual([])
})

// 主題頁搬到 /courses/<課程>:舊網址轉址(伺服器 301,前端也有轉址路由,查詢字串保留)
test('舊網址 /topics/web、/topics/web/1-2、/topics/launch 轉到 /courses/…', async ({ page }) => {
  const errors = collectErrors(page)
  for (const [from, to] of [
    ['/topics/web', '/courses/web'],
    ['/topics/web/1-2?aspect=landscape', '/courses/web/1-2?aspect=landscape'],
    ['/topics/launch', '/courses/launch'],
    ['/topics/launch/0-1', '/courses/launch/0-1'],
  ] as const) {
    await page.goto('about:blank')
    await page.goto(from)
    await expect(page).toHaveURL(to)
  }
  // 站內導覽(不經伺服器)的舊連結也轉過去
  await page.goto('/')
  await page.evaluate(() => {
    history.pushState({}, '', '/topics/web/1-2')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page).toHaveURL('/courses/web/1-2')
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
  await expect(page.getByRole('article', { name: '測試主題甲' })).toBeVisible()
  // 首頁不放播放器(主打主題的展示影片、兒童課的預覽都拿掉了)
  await expect(page.locator('.vp')).toHaveCount(0)
  // 主打主題與兒童主題各有一個「開始第一課」;主打主題的連到可以免費預覽的序章
  await expect(page.getByRole('article', { name: '測試主題甲' }).getByRole('link', { name: '開始第一課' })).toHaveAttribute('href', '/courses/software/intro')
  const kids = page.getByRole('region', { name: '測試主題丙' })
  await expect(kids.getByRole('link', { name: '開始第一課' })).toHaveAttribute('href', '/courses/kids/0-1')
  await expect(kids.getByRole('link', { name: '課程地圖' })).toHaveAttribute('href', '/courses/kids')
  // 首頁不標「開放中」,只有規劃中的主題標「規劃中」
  await expect(page.getByText('開放中', { exact: true })).toHaveCount(0)
  await expect(page.getByText('規劃中').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('網頁怎麼運作:首頁卡片連到主題,課程清單的標示依資料庫,前五課不用登入就能上', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: '測試主題丁', exact: true }) })
  await expect(card.getByText('測試主題丁的標籤')).toBeVisible()
  await expect(card.getByText('開放中')).toHaveCount(0)
  await expect(card.getByRole('link', { name: '開始第一課' })).toHaveAttribute('href', '/courses/web/0-1')

  // 課程總覽是和其他課共用的頁面(課程內容清單,一個單元一組)
  await page.goto('/courses/web')
  await expect(page.locator('h1')).toHaveText('測試課四')
  await expect(page.getByRole('heading', { name: '課程內容' })).toBeVisible()
  await expect(page.locator('#map details')).toHaveCount(3)
  // 課程說明(資料庫的 about 段落),每個單元都有 #stage-<單元 id> 錨點
  await expect(page.getByRole('heading', { name: '課程說明' })).toBeVisible()
  await expect(page.locator('details#stage-0, details#stage-4')).toHaveCount(2)
  const row = (title: string) => page.locator('#map li').filter({ hasText: title })
  // 每一課的標示(免費預覽、登入後學習、規劃中)依資料庫的課程地圖
  const lessons = await mapLessons(page.request, 'web')
  for (const l of lessons) await expectLabel(row(l.title), l)
  expect(lessons[0]).toMatchObject({ id: '0.1', label: '試看' })

  // 第一課不用登入:直接進到互動舞台,有下一課
  await row('測試單課 web/0.1').getByRole('link').click()
  await expect(page).toHaveURL(/\/courses\/web\/0-1$/)
  await expect(page.locator('.vp')).toBeVisible()
  await expect(page.getByRole('link', { name: '下一課：第 0.2 課 →' }).first()).toHaveAttribute('href', '/courses/web/0-2')
  await expect(page.locator('main').getByRole('link', { name: '登入或註冊' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('展示頁:播序章、從頭開始;開始播放後播放器和卡片同寬放最上面,標題與按鈕移到下面,縮小後恢復', async ({ page }, info) => {
  test.setTimeout(60000)
  test.skip(info.project.name === 'mobile', '手機上播放器本來就是整排寬')
  const errors = collectErrors(page)
  await page.goto('/showcase')
  const card = page.getByRole('article', { name: '測試主題甲' })
  const lede = card.locator('p').nth(1)
  const shrink = page.getByRole('button', { name: '縮小播放器' })

  // 一開始不放大、不自動播放,從 0 秒開始;左欄完整
  await expect(page.locator('.vp.paused')).toBeVisible()
  await expect(page.locator('.vp-time')).toHaveText(/^0:00 /)
  await expect(lede).toBeVisible()
  await expect(shrink).toHaveCount(0)
  await expect(card.getByRole('link', { name: '開始第一課' })).toHaveAttribute('href', '/courses/software/intro')
  const small = (await page.locator('.vp').boundingBox())!

  // 開始播放:播放器和卡片內容同寬、在最上面,標題與按鈕在播放器下面;其他說明收起來
  await page.locator('.vp-big').click()
  await expect(shrink).toBeVisible()
  await expect.poll(async () => (await page.locator('.vp').boundingBox())!.width).toBeGreaterThan(small.width * 1.3)
  const c = (await card.boundingBox())!
  const v = (await page.locator('.vp').boundingBox())!
  const h2 = (await card.getByRole('heading', { name: '測試主題甲' }).boundingBox())!
  expect(c.width - v.width).toBeLessThan(80) // 只差卡片的內距
  expect(h2.y).toBeGreaterThanOrEqual(v.y + v.height)
  await expect(lede).toBeHidden()

  // 縮小:回到原本的大小,次要內容回來
  await shrink.click()
  await expect(shrink).toHaveCount(0)
  await expect(lede).toBeVisible()
  await expect.poll(async () => (await page.locator('.vp').boundingBox())!.width).toBeCloseTo(small.width, 0)

  // 兒童課的預覽捲到附近才載入,環節選單在左欄
  const kids = page.getByRole('region', { name: '測試主題丙' })
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
  // 「做出自己的軟體」的 L1–L4 框成一組(L0 的課全部上架了,已從基地拿掉)
  // 預設收合(不在這一組的頁面時一課都不顯示),按群組名稱展開
  const series = sub.getByRole('group', { name: '做出自己的軟體' })
  await expect(series.getByRole('link')).toHaveCount(0)
  await series.getByRole('button', { name: /做出自己的軟體/ }).click()
  await expect(series.getByRole('button', { name: /做出自己的軟體/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(series.getByRole('link')).toHaveCount(4)
  // 窄視窗只顯示等級代號(「L1」),完整課名藏起來,所以用連結目標找,不靠課名
  await expect(series.getByRole('link').first()).toHaveAttribute('href', '/studio/ai-tools')
  await expect(series.getByRole('link').first()).toHaveAttribute('title', 'L1 AI 工具入門')
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

  // 播到第一個互動點:題目與選項浮在播放器上
  const option = page.getByRole('button', { name: '蛋糕要提前兩天訂，後天可以嗎？' })
  const play = page.locator('.vp-play')
  await expect(page.locator('.vp-bar')).not.toHaveAttribute('aria-valuemax', '0', { timeout: 15_000 })
  await play.dispatchEvent('click')
  await expect(option).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { name: /客人甲明天就要蛋糕/ })).toBeVisible()
  await option.click()
  await expect(page.locator('.A-chat .ch-row.mine').first()).toContainText('後天可以嗎')

  // 自己打字:時間軸拖回開頭收回剛才的回答,再播到互動點
  await page.locator('.vp-bar').press('Home')
  if (await page.locator('.vp').evaluate((el) => el.classList.contains('paused'))) await play.dispatchEvent('click')
  await expect(option).toBeVisible({ timeout: 20_000 })
  await page.getByRole('textbox').fill('蛋糕來不及，<b>改後天</b>好嗎')
  await page.getByRole('button', { name: '送出' }).click()
  await expect(page.locator('.A-chat .ch-row.mine').first()).toHaveText('蛋糕來不及，<b>改後天</b>好嗎')
  expect(errors).toEqual([])
})

test('靜態演員:互動時影片停止,演員畫在舞台外且不受舞台縮放,回答後收起', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(landscape('/studio/actor-interaction/static'))
  await expect(page.getByTestId('static-actor')).toHaveCount(0)
  await reachMoment(page, page.getByTestId('static-actor').getByRole('button', { name: '建立 hello.txt，寫一句問候' }))

  const still = page.getByTestId('static-actor').locator('.A-claude-desktop')
  await expect(still).toBeVisible()
  await expect(still).toContainText('描述你要做的事')
  // 字維持演員原本的大小(--u 是 18px),不跟著舞台縮放
  const scaleOf = (loc: typeof still) => loc.evaluate((el) => el.getBoundingClientRect().width / (el as HTMLElement).offsetWidth)
  // (窄視窗靜態演員可用的寬度變窄,可能為了放得下而縮一點點)
  expect(await scaleOf(still)).toBeCloseTo(1, 1)
  // 畫面上只有一份:影片舞台的同一位演員這時不在 DOM
  await expect(page.locator('.vp .live-stage .A-claude-desktop')).toHaveCount(0)

  // 影片是停著的
  const time = page.locator('.vp-time')
  const before = await time.textContent()
  await page.waitForTimeout(1200)
  expect(await time.textContent()).toBe(before)

  // 直接在演員身上回答,不開詢問框;回答後收起並接著演
  await expect(page.getByRole('button', { name: '建立 hello.txt，寫一句問候' })).toHaveCount(1)
  await page.getByTestId('static-actor').getByRole('button', { name: '建立 hello.txt，寫一句問候' }).click()
  await expect(page.getByTestId('static-actor')).toHaveCount(0)
  await expect(page.locator('.vp .live-stage .A-claude-desktop')).toContainText('建立 hello.txt，寫一句問候', { timeout: 15000 })
  expect(errors).toEqual([])
})

test('靜態演員:直式窄視窗播到互動點時,演員畫在舞台外', async ({ page }, info) => {
  test.setTimeout(60000)
  test.skip(info.project.name !== 'mobile', '只測窄視窗')
  await page.goto('/studio/actor-interaction/static?aspect=portrait')
  await page.locator('.vp-big').click()
  await expect(page.getByTestId('static-actor')).toBeVisible({ timeout: 40000 })
})

test('把演員推到主畫面:直接在 Claude 上選指令與按允許', async ({ page }) => {
  const errors = collectErrors(page)
  // 在開發「演員互動」底下,返回也回到那裡
  await page.goto('/studio/actor-interaction')
  await page.getByRole('navigation', { name: '演員互動頁面' }).getByRole('link', { name: '把演員推到主畫面' }).click()
  await expect(page).toHaveURL('/studio/actor-interaction/push')
  await expect(page.getByRole('link', { name: '← 演員互動' })).toHaveAttribute('href', '/studio/actor-interaction')
  await ensureLandscape(page)

  const send = page.getByRole('button', { name: '建立 hello.txt，寫一句問候' })
  await reachMoment(page, send)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await send.click()
  await expect(page.locator('.A-claude-desktop').first()).toContainText('建立 hello.txt，寫一句問候', { timeout: 15000 })

  // 播到確認提示:推到確認框上,按鈕就是演員自己的按鈕
  await page.getByRole('button', { name: '允許一次', exact: true }).click({ timeout: 25000 })
  await expect(page.locator('.A-claude-desktop').first()).toContainText('已建立', { timeout: 15000 })
  // 時間軸拖回開頭收回回答,可以重新回答
  await page.locator('.vp-bar').press('Home')
  await reachMoment(page, send)
  expect(errors).toEqual([])
})

test('L0 第 1 課是互動版:用原本的腳本,在 Claude 上回答後接著演,控制列有下一課', async ({ page }) => {
  test.setTimeout(90000)
  const errors = collectErrors(page)
  await loginAsNewStudent(page)
  await page.goto(landscape('/courses/software/1'))
  await expect(page.getByRole('link', { name: /第 2 課/ }).first()).toHaveAttribute('href', '/courses/software/2')
  const option = page.getByRole('button', { name: '建立一個檔案', exact: true })
  await reachMoment(page, option)
  await option.click()
  await expect(page.locator('.A-claude-desktop').last()).toContainText('你沒有說檔名和內容', { timeout: 20000 })
  await page.getByRole('button', { name: '拒絕', exact: true }).click({ timeout: 40000 })
  await expect(page.locator('.A-claude-desktop').last()).toContainText('好的，我不會建立這個檔案', { timeout: 20000 })
  expect(errors).toEqual([])
})

test('L0 第 2 課是互動版:選錯路徑時 Claude 會提醒,接著回到正確的指令', async ({ page }) => {
  test.setTimeout(90000)
  const errors = collectErrors(page)
  await loginAsNewStudent(page)
  await page.goto(landscape('/courses/software/2'))
  const option = page.getByRole('button', { name: '在 idea.txt 記下：首頁要有預約按鈕', exact: true })
  await reachMoment(page, option)
  await option.click()
  await expect(page.locator('.A-claude-desktop')).toContainText('這樣檔案會放在工作目錄最外層', { timeout: 20000 })
  await expect(page.locator('.A-claude-desktop')).toContainText('已在 drafts/idea.txt 記下', { timeout: 40000 })
  expect(errors).toEqual([])
})

test('L0 第 3 課是互動版:播到響應式的互動點會停下,選手機後瀏覽器縮成手機寬度並說明,再繼續', async ({ page }) => {
  test.setTimeout(180000)
  const errors = collectErrors(page)
  await loginAsNewStudent(page)
  await page.goto(landscape('/courses/software/3'))
  await expect(page.locator('.vp')).toBeVisible()
  const phone = page.getByRole('button', { name: /手機/ }).first()
  await reachMoment(page, phone)
  for (const name of ['手機', '平板', '桌面']) await expect(page.getByRole('button', { name: new RegExp(name) }).first()).toBeVisible()
  await phone.click({ timeout: 20000 })
  await expect(page.getByText('手機：卡片一欄，導覽擠在一起')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('同一份網頁，依螢幕寬度自動換排版').first()).toBeVisible({ timeout: 30000 })
  expect(errors).toEqual([])
})

// 公開頁 + 主要內部頁:開啟時沒有錯誤、h1 只有一個、hydrate 後 head 沒有重複標籤
// 單課頁不逐課開,每種版型/狀態挑一課(測試資料裡也只有少數幾課)
const LESSON_PAGES = new Set(distSitemapPages().filter((p) => p.lesson).map((p) => p.loc.slice(ORIGIN.length)))
const PAGES = [
  ...distSitemapPaths().filter((p) => !LESSON_PAGES.has(p)),
  '/courses/software/intro',
  '/courses/software/2',
  // 規劃中的課
  '/courses/software/5-2',
  '/courses/web/0-1',
  '/courses/launch/0-1',
  '/courses/claude-code/1',
  '/login',
  '/docs/live',
  '/studio',
  '/studio/kids-web',
  '/studio/web-basics',
  '/studio/vibe-coding/4-1',
  '/studio/vibe-coding/4-2',
  '/studio/vibe-coding/4-3',
  '/studio/portrait',
  '/studio/practice',
  '/studio/scenes',
  '/studio/fable-trial',
  '/studio/kids-family',
  '/studio/kids-web/xray',
  // 兒童課:開放的一課、規劃中的一課
  '/courses/kids/1-1',
  '/courses/kids/4-1',
  '/studio/docs',
  '/materials',
  '/studio/actor-interaction/scene',
  '/studio/actor-interaction/push',
  '/studio/actor-interaction/static',
  '/studio/actor-interaction',
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

    // 單課頁:h1 只放課名(課號、時長放在旁邊);title 是「<課名>｜<課程名稱> · 站名」
    if (/^\/courses\/software\/(\d|[1-3]-\d)$/.test(path)) {
      const title = await serverTitle(request, path)
      const lessonTitle = title.match(/^(.+)｜測試課一 · /)?.[1]
      expect(lessonTitle, `title 格式:${title}`).toBeTruthy()
      await expect(page.locator('h1')).toHaveText(lessonTitle!)
    }
    expect(errors).toEqual([])
  })
}

test('首頁與主題頁的主題、課程名稱讀資料庫;讀不到顯示「無法讀取」,不用寫死的內容頂替', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: '測試主題甲' })).toBeVisible()
  await page.route('**/api/topics', (r) => r.fulfill({ status: 503, body: '{}' }))
  for (const path of ['/', '/topics/software']) {
    await page.goto(path)
    await expect(page.getByText('無法讀取').first()).toBeVisible()
    await expect(page.getByText('測試主題甲', { exact: true })).toHaveCount(0)
  }
})
