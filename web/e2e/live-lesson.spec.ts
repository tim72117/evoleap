// 即時教學畫面(LivePlayer)的回歸測試:L0 第 3 課是互動版(/courses/software/3,第 1、2 課與序章同樣,互動點的測試在 navigation.spec.ts),
// 沒有影片檔,是直接掛在課程頁上的浮動播放器外殼(src/live/shell.ts,根元素 .vp)+ 舞台(src/live/stage.ts,根元素 .live-stage),
// 依資料庫裡的腳本即時畫出;時間軸上有章節刻度。沒有 iframe,也沒有 /live/ 路由。
// 這裡測:播放器載入後章節刻度遞增、點播放條跳轉、播放時時間往前走、舊的 /live/ 網址回 404、腳本 lessonStep 與課程步驟數一致。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { collectErrors, desktopOnly, landscape, loginAsNewStudent } from './support'

// 測試資料庫的範例腳本(server -seed 讀的同一份)
const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'server', 'internal', 'store', 'fixture', 'live')

type Case = { path: string; script: string; steps: number; chapters: string[] }

const LESSONS: Case[] = [
  {
    path: '/courses/software/3',
    script: 'l0/0.2-site.json',
    steps: 9,
    chapters: ['一次描述整頁，產生第一版', '在瀏覽器打開，對照需求檢查', '調整頁首與導覽', '商品卡片的排列', '統一標題字級', '營業時間表與常見問題', '小互動：手機版選單', '改太多時，比對並還原', '最後檢查：三種寬度'],
  },
]

/** 腳本(Node 端直接讀範例檔)裡出現過的 lessonStep(去重、排序) */
function scriptLessonSteps(script: string): number[] {
  const json = JSON.parse(readFileSync(join(SCRIPTS, script), 'utf8')) as { steps: { lessonStep?: number }[] }
  return [...new Set(json.steps.map((s) => s.lessonStep).filter((n): n is number => typeof n === 'number'))].sort((a, b) => a - b)
}

const player = (page: Page) => page.locator('.vp')
const stage = (page: Page) => page.locator('.live-stage')
const slider = (page: Page) => player(page).getByRole('slider', { name: '播放進度' })
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
      await loginAsNewStudent(page)
      await page.goto(landscape(c.path))
      await expect(player(page)).toBeVisible()
      await expect(player(page)).toHaveAttribute('role', 'region')
      await expect(player(page)).toHaveAttribute('aria-label', /^影片播放器:/)
      await expect(player(page).locator('.vp-ticks i').first()).toBeAttached({ timeout: 15_000 })
    })
    test.afterEach(() => {
      expect(errors).toEqual([])
    })

    test('播放器直接掛在頁面上:時間軸有章節刻度,點播放條跳到那裡,按播放後時間往前走', async ({ page }) => {
      await expect(stage(page)).toHaveCount(1)
      await expect(player(page).locator('.live-stage')).toHaveCount(1)
      await expect(page.locator('iframe')).toHaveCount(0)
      const durSec = Number(await slider(page).getAttribute('aria-valuemax'))
      const ticks = await player(page).locator('.vp-ticks i').evaluateAll((els) => els.map((el) => parseFloat((el as HTMLElement).style.left)))
      expect(ticks.length).toBeGreaterThanOrEqual(c.chapters.length - 1)
      expect([...ticks].sort((a, b) => a - b)).toEqual(ticks)
      // 還沒播放:停在開頭
      expect(await playerSec(page)).toBe(0)
      await expect(player(page)).toHaveClass(/paused/)
      const box = (await player(page).locator('.vp-track').boundingBox())!
      for (const type of ['pointerdown', 'pointerup']) await slider(page).dispatchEvent(type, { clientX: box.x + box.width * 0.5, clientY: box.y + box.height / 2, pointerId: 1, button: 0, isPrimary: true })
      await expect.poll(() => playerSec(page)).toBeGreaterThan(durSec * 0.4)
      if (await player(page).evaluate((el) => el.classList.contains('paused'))) await player(page).locator('.vp-play').dispatchEvent('click')
      const first = await playerSec(page)
      await expect.poll(() => playerSec(page), { timeout: 8_000 }).toBeGreaterThan(first)
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
    test(`${c.script}:lessonStep 剛好是 1–${c.steps},與頁面步驟數相同`, async ({}, info) => {
      test.skip(desktopOnly(info), '比對資料,不需要每個 viewport 重跑')
      const fromScript = scriptLessonSteps(c.script)
      expect(fromScript).toEqual(Array.from({ length: c.steps }, (_, i) => i + 1))
    })
  }
})
