// 即時教學畫面(LivePlayer)的回歸測試:L0 第 2 課是互動版(/courses/tools/2,第 0、1 課與序章同樣,互動點的測試在 navigation.spec.ts),
// 沒有影片檔,是直接掛在課程頁上的浮動播放器外殼(src/live/shell.ts,根元素 .vp)+ 舞台(src/live/stage.ts,根元素 .live-stage),
// 依 src/content/live/ 的腳本即時畫出;右側「課程章節與步驟」列出章節,點章節跳到該時間點。沒有 iframe,也沒有 /live/ 路由。
// 這裡測:播放器載入後章節都有時間(遞增)、點章節跳轉、播放時時間往前走、舊的 /live/ 網址回 404、腳本 lessonStep 與課程步驟數一致。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { collectErrors, desktopOnly } from './support'

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'live')

type Case = { path: string; script: string; steps: number; chapters: string[] }

const LESSONS: Case[] = [
  {
    path: '/courses/tools/2',
    script: 'l0/0.2-site.json',
    steps: 9,
    chapters: ['一次描述整頁，產生第一版', '在瀏覽器打開，對照需求檢查', '調整頁首與導覽', '商品卡片的排列', '統一標題字級', '營業時間表與常見問題', '小互動：手機版選單', '改太多時，比對並還原', '最後檢查：三種寬度'],
  },
]

/** 腳本(Node 端直接讀原始檔)裡出現過的 lessonStep(去重、排序) */
function scriptLessonSteps(script: string): number[] {
  const json = JSON.parse(readFileSync(join(SCRIPTS, script), 'utf8')) as { steps: { lessonStep?: number }[] }
  return [...new Set(json.steps.map((s) => s.lessonStep).filter((n): n is number => typeof n === 'number'))].sort((a, b) => a - b)
}

const player = (page: Page) => page.locator('.vp')
const stage = (page: Page) => page.locator('.live-stage')
const slider = (page: Page) => player(page).getByRole('slider', { name: '播放進度' })
const panel = (page: Page) => page.getByRole('complementary', { name: '課程章節與步驟' })
const chapter = (page: Page, name: string) => panel(page).getByRole('button', { name: new RegExp(`^\\d+:\\d\\d\\s*${name}`) })

/** 章節按鈕上的秒數(mm:ss 在按鈕文字開頭) */
async function cueSec(page: Page, name: string): Promise<number> {
  const text = (await chapter(page, name).textContent()) ?? ''
  const m = text.match(/^(\d+):(\d\d)/)
  expect(m, `章節時間:${text}`).toBeTruthy()
  return Number(m![1]) * 60 + Number(m![2])
}

/** 播放器的時間文字「m:ss / m:ss」 → 目前秒數 */
async function playerSec(page: Page): Promise<number> {
  const text = (await player(page).locator('.vp-time').textContent()) ?? ''
  const m = text.match(/^\s*(\d+):(\d\d)\s*\/\s*\d+:\d\d\s*$/)
  expect(m, `播放器時間文字:${text}`).toBeTruthy()
  return Number(m![1]) * 60 + Number(m![2])
}

for (const c of LESSONS) {
  test.describe(`${c.path}(${c.script})`, () => {
    let errors: string[]
    test.beforeEach(async ({ page }) => {
      errors = collectErrors(page)
      await page.goto(c.path)
      await expect(player(page)).toBeVisible()
      await expect(player(page)).toHaveAttribute('role', 'region')
      await expect(player(page)).toHaveAttribute('aria-label', /^影片播放器:/)
      // 播放器載入腳本後,右側才有章節的時間
      await expect(chapter(page, c.chapters[0])).toBeVisible({ timeout: 15_000 })
    })
    test.afterEach(() => {
      expect(errors).toEqual([])
    })

    test('播放器直接掛在頁面上:每個章節都有時間,時間遞增並對得到時間軸的章節刻度', async ({ page }) => {
      await expect(stage(page)).toHaveCount(1)
      await expect(player(page).locator('.live-stage')).toHaveCount(1)
      await expect(page.locator('iframe')).toHaveCount(0)

      const cues: number[] = []
      for (const name of c.chapters) cues.push(await cueSec(page, name))
      expect(cues[0], '第 1 個步驟不會在 0 秒(開場有兩張章節卡)').toBeGreaterThan(0)
      for (let i = 1; i < cues.length; i++) expect(cues[i], `第 ${i + 1} 步晚於第 ${i} 步`).toBeGreaterThan(cues[i - 1])

      const durSec = Number(await slider(page).getAttribute('aria-valuemax'))
      expect(durSec).toBeGreaterThan(cues.at(-1)!)
      const ticks = await player(page)
        .locator('.vp-ticks i')
        .evaluateAll((els) => els.map((el) => parseFloat((el as HTMLElement).style.left)))
      const tickSecs = ticks.map((pct) => (pct / 100) * durSec)
      for (const [i, cue] of cues.entries()) {
        expect(
          tickSecs.some((t) => Math.abs(t - (cue + 0.5)) < 1.5),
          `第 ${i + 1} 步 ${cue}s 對得到章節刻度 ${tickSecs.map((t) => t.toFixed(1)).join(', ')}`,
        ).toBe(true)
      }
      // 還沒播放:停在開頭
      expect(await playerSec(page)).toBe(0)
      await expect(player(page)).toHaveClass(/paused/)
    })

    test('點章節跳到那個時間點,按播放後時間往前走', async ({ page }) => {
      const name = c.chapters[2]
      const cue = await cueSec(page, name)
      await chapter(page, name).click()
      await expect.poll(() => playerSec(page)).toBeGreaterThanOrEqual(cue)
      expect(await playerSec(page) - cue).toBeLessThan(3)

      await player(page).getByRole('button', { name: /播放/ }).first().click()
      await expect(player(page)).not.toHaveClass(/paused/)
      const first = await playerSec(page)
      await expect.poll(() => playerSec(page), { timeout: 6_000 }).toBeGreaterThan(first)
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
      await expect(chapter(page, c.chapters[0])).toBeVisible({ timeout: 15_000 })
      for (const name of c.chapters) await expect(chapter(page, name)).toHaveCount(1)
    })
  }
})
