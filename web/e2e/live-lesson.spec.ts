// 即時教學畫面(LivePlayer)的回歸測試:L0 第 0、1 課各只有一支影片,不是影片檔,
// 而是直接掛在課程頁上的播放器外殼(src/live/shell.ts,根元素 .vp)+ 舞台(src/live/stage.ts,根元素 .live-stage),
// 依 src/content/live/ 的腳本即時畫出。沒有 iframe,也沒有 /live/ 路由。
// 腳本裡標了 lessonStep 的章節成為右側步驟的 cue:出現「▶ mm:ss」、播到那裡就標「播放中」並展開。
// 這裡測:播放器載入後每一步都有 ▶(時間遞增、對得到時間軸上的章節刻度)、▶ 跳轉並播放、
// ←/→ 在頁面上切換步驟(焦點在播放器裡時不切換)、舊的 /live/ 網址回 404、腳本 lessonStep 與課程步驟數一致。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { collectErrors, desktopOnly } from './support'

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'live')

type Case = { path: string; script: string; steps: number }

const LESSONS: Case[] = [
  { path: '/courses/tools/0', script: 'l0/0.0-tools.json', steps: 5 },
  { path: '/courses/tools/1', script: 'l0/0.1-project.json', steps: 6 },
]

/** 腳本(Node 端直接讀原始檔)裡出現過的 lessonStep(去重、排序) */
function scriptLessonSteps(script: string): number[] {
  const json = JSON.parse(readFileSync(join(SCRIPTS, script), 'utf8')) as { steps: { lessonStep?: number }[] }
  return [...new Set(json.steps.map((s) => s.lessonStep).filter((n): n is number => typeof n === 'number'))].sort((a, b) => a - b)
}

const player = (page: Page) => page.locator('.vp')
const stage = (page: Page) => page.locator('.live-stage')
const slider = (page: Page) => player(page).getByRole('slider', { name: '播放進度' })
const step = (page: Page, n: number) => page.locator(`#step-${n}`)
const steps = (page: Page) => page.locator('li[id^="step-"]')
const playingSteps = (page: Page) => steps(page).filter({ hasText: '播放中' })
const seekButtons = (page: Page) => page.getByRole('button', { name: /^▶ \d\d:\d\d$/ })
const progress = (page: Page) => page.getByRole('complementary', { name: '跟著步驟做' }).locator('[aria-live="polite"]').first()

/** 第 n 步 ▶ 標籤上的秒數(標籤取整秒,實際 cue 在 [sec, sec+1) 之間) */
async function cueSec(page: Page, n: number): Promise<number> {
  const text = await step(page, n).getByRole('button', { name: /^▶ / }).textContent()
  const [mm, ss] = text!.replace('▶', '').trim().split(':').map(Number)
  return mm * 60 + ss
}

/** 播放器的時間文字「m:ss / m:ss」 → 目前秒數 */
async function playerSec(page: Page): Promise<number> {
  const text = (await player(page).locator('.vp-time').textContent()) ?? ''
  const m = text.match(/^\s*(\d+):(\d\d)\s*\/\s*\d+:\d\d\s*$/)
  expect(m, `播放器時間文字:${text}`).toBeTruthy()
  return Number(m![1]) * 60 + Number(m![2])
}

const isPlaying = (page: Page) => player(page).evaluate((el) => !el.classList.contains('paused'))

for (const c of LESSONS) {
  test.describe(`${c.path}(${c.script})`, () => {
    let errors: string[]
    test.beforeEach(async ({ page }) => {
      errors = collectErrors(page)
      await page.goto(c.path)
      await expect(player(page)).toBeVisible()
      await expect(player(page)).toHaveAttribute('role', 'region')
      await expect(player(page)).toHaveAttribute('aria-label', /^影片播放器:/)
      await expect(progress(page)).toContainText(`共 ${c.steps} 步`)
      // 播放器載入腳本、回報 cues 後才會出現 ▶
      await expect(seekButtons(page)).toHaveCount(c.steps, { timeout: 15_000 })
    })
    test.afterEach(() => {
      expect(errors).toEqual([])
    })

    test('播放器直接掛在頁面上:每一步都有 ▶ mm:ss,時間遞增並對得到章節刻度', async ({ page }) => {
      await expect(stage(page)).toHaveCount(1)
      await expect(player(page).locator('.live-stage')).toHaveCount(1)
      await expect(page.locator('iframe')).toHaveCount(0)
      await expect(steps(page)).toHaveCount(c.steps)

      const cues: number[] = []
      for (let n = 1; n <= c.steps; n++) {
        await expect(step(page, n).getByRole('button', { name: /^▶ / })).toHaveText(/^▶ \d\d:\d\d$/)
        cues.push(await cueSec(page, n))
      }
      expect(cues[0], '第 1 步不會在 0 秒(影片以目標與步驟拆解開場)').toBeGreaterThan(0)
      for (let i = 1; i < cues.length; i++) expect(cues[i], `第 ${i + 1} 步晚於第 ${i} 步`).toBeGreaterThan(cues[i - 1])

      // 時間軸上的章節刻度(left% × 總長)換算成秒:每個 ▶ 時間附近都要有一個刻度(▶ 取整秒、總長四捨五入,容許 1.5 秒)
      const durSec = Number(await slider(page).getAttribute('aria-valuemax'))
      expect(durSec).toBeGreaterThan(cues.at(-1)!)
      const ticks = await player(page)
        .locator('.vp-ticks i')
        .evaluateAll((els) => els.map((el) => parseFloat((el as HTMLElement).style.left)))
      const tickSecs = ticks.map((pct) => (pct / 100) * durSec)
      for (const [i, cue] of cues.entries()) {
        expect(
          tickSecs.some((t) => Math.abs(t - (cue + 0.5)) < 1.5),
          `第 ${i + 1} 步 ▶ ${cue}s 對得到章節刻度 ${tickSecs.map((t) => t.toFixed(1)).join(', ')}`,
        ).toBe(true)
      }
      // 還沒播放:沒有「播放中」,播放器停在開頭
      await expect(playingSteps(page)).toHaveCount(0)
      expect(await isPlaying(page)).toBe(false)
    })

    test('點第 3 步的 ▶:第 3 步播放中並展開,播放器從該 cue 開始播放', async ({ page }) => {
      const cue = await cueSec(page, 3)
      await step(page, 3).getByRole('button', { name: /^▶ / }).click()

      await expect(step(page, 3)).toContainText('播放中')
      await expect(playingSteps(page)).toHaveCount(1)
      await expect(step(page, 3).getByRole('button', { name: /播放中/ })).toHaveAttribute('aria-expanded', 'true')
      await expect(progress(page)).toContainText('第 3 步')

      // 播放器正在播放,時間從 cue 開始往前走(1× 速度,允許幾秒誤差)
      await expect.poll(() => isPlaying(page)).toBe(true)
      await expect.poll(() => playerSec(page)).toBeGreaterThanOrEqual(cue)
      const first = await playerSec(page)
      expect(first - cue).toBeLessThan(10)
      await expect.poll(() => playerSec(page), { timeout: 5_000 }).toBeGreaterThan(first)
    })

    test('焦點在頁面上時 ← / → 切換步驟並跳轉;焦點在播放器裡時 → 不切換步驟', async ({ page }) => {
      // 還沒播放時 → 跳到第 1 步
      await page.keyboard.press('ArrowRight')
      await expect(step(page, 1)).toContainText('播放中')
      await page.keyboard.press('ArrowRight')
      await expect(step(page, 2)).toContainText('播放中')
      await page.keyboard.press('ArrowRight')
      await expect(step(page, 3)).toContainText('播放中')
      await expect(playingSteps(page)).toHaveCount(1)
      await expect(progress(page)).toContainText('第 3 步')
      await page.keyboard.press('ArrowLeft')
      await expect(step(page, 2)).toContainText('播放中')
      await expect(playingSteps(page)).toHaveCount(1)
      await expect(step(page, 2).getByRole('button', { name: /播放中/ })).toHaveAttribute('aria-expanded', 'true')
      // 跳轉真的進了播放器:播放中,時間落在第 2 步的 cue 之後、第 3 步的 cue 之前
      const [cue2, cue3] = [await cueSec(page, 2), await cueSec(page, 3)]
      await expect.poll(() => isPlaying(page)).toBe(true)
      await expect
        .poll(async () => {
          const t = await playerSec(page)
          return t >= cue2 && t <= cue3
        })
        .toBe(true)

      // 焦點移到播放器(.vp)裡:→ 交給播放器(快轉 5 秒),課程頁不切換步驟。
      // 挑一個和下一步相距夠遠的步驟,快轉後仍在同一步,才能區分「切換步驟」與「時間走到下一步」。
      const cues: number[] = []
      for (let n = 1; n <= c.steps; n++) cues.push(await cueSec(page, n))
      const k = cues.findIndex((at, i) => i < cues.length - 1 && cues[i + 1] - at >= 12) + 1
      expect(k, `要有一步和下一步相距 12 秒以上:${cues.join(', ')}`).toBeGreaterThan(0)
      await step(page, k).getByRole('button', { name: /^▶ / }).click()
      await expect(step(page, k)).toContainText('播放中')
      await expect.poll(() => playerSec(page)).toBeGreaterThanOrEqual(cues[k - 1])
      await player(page).focus()
      const before = await playerSec(page)
      await page.keyboard.press('ArrowRight')
      // 播放器收到 →:時間往前跳了好幾秒
      await expect.poll(() => playerSec(page)).toBeGreaterThanOrEqual(before + 4)
      await expect(step(page, k)).toContainText('播放中')
      await expect(step(page, k + 1)).not.toContainText('播放中')
      await expect(playingSteps(page)).toHaveCount(1)
      await expect(progress(page)).toContainText(`第 ${k} 步`)
    })
  })
}

test.describe('舊的 /live/ 網址', () => {
  test('iframe 時代的播放器外殼、舞台與腳本網址都回 404', async ({ request }, info) => {
    test.skip(desktopOnly(info), '純 HTTP 檢查,不需要每個 viewport 重跑')
    const paths = [
      '/live/player/lesson.html',
      '/live/player/shell.js',
      '/live/player/shell.css',
      '/live/stage/stage.html',
      '/live/stage/stage.js',
      ...LESSONS.map((c) => `/live/scripts/${c.script}`),
    ]
    for (const path of paths) {
      const res = await request.get(path)
      expect(res.status(), path).toBe(404)
    }
  })
})

test.describe('腳本 lessonStep 與課程步驟一致', () => {
  for (const c of LESSONS) {
    test(`${c.script}:lessonStep 剛好是 1–${c.steps},與頁面步驟數相同`, async ({ page }, info) => {
      test.skip(desktopOnly(info), '比對資料,不需要每個 viewport 重跑')
      const fromScript = scriptLessonSteps(c.script)
      expect(fromScript).toEqual(Array.from({ length: c.steps }, (_, i) => i + 1))
      await page.goto(c.path)
      await expect(steps(page)).toHaveCount(fromScript.length)
      await expect(progress(page)).toContainText(`共 ${fromScript.length} 步`)
    })
  }
})
