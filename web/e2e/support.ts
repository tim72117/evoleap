// E2E 共用工具(不是測試檔;Playwright 只收 *.spec.ts)。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page, type TestInfo } from '@playwright/test'

export const ORIGIN = 'https://evoleap.io'
export const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

/** 內部頁(不收錄、不進 sitemap):網址開頭 */
export const INTERNAL_PREFIXES = ['/login', '/admin', '/docs', '/studio', '/materials', '/member', '/pricing']
export const isInternal = (path: string) =>
  INTERNAL_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))

/** 只在 desktop project 跑(純 HTTP 檢查,不需要每個 viewport 重跑) */
export function desktopOnly(testInfo: TestInfo) {
  return testInfo.project.name !== 'desktop'
}

function readDist(file: string): string {
  try {
    return readFileSync(join(DIST, file), 'utf8')
  } catch {
    throw new Error(`找不到 dist/${file}:E2E 測的是正式 build,請先在 web/ 執行 npm run build`)
  }
}

/** sitemap.xml 的 <loc> → 站內路徑 */
export function sitemapPaths(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    const url = m[1].replace(/&amp;/g, '&')
    return url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) || '/' : url
  })
}

/** 收集測試時(server 還沒啟動)從磁碟讀 build 產生的 sitemap */
export function distSitemapPaths(): string[] {
  return sitemapPaths(readDist('sitemap.xml'))
}

/** dist 內所有預先產生的頁面路徑(dist/<路由>/index.html) */
export function distPagePaths(): string[] {
  readDist('index.html')
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) {
        if (name !== 'assets') walk(full)
      } else if (name === 'index.html') {
        const rel = relative(DIST, dir).split(sep).join('/')
        out.push(rel ? `/${rel}` : '/')
      }
    }
  }
  walk(DIST)
  return out.sort()
}

// ---- 簡易 HTML <head> 解析(build 產物格式固定,不需要完整 parser) ----

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)(?:="([^"]*)")?/g)) {
    if (m[1] === 'meta' || m[1] === 'link') continue
    out[m[1].toLowerCase()] = (m[2] ?? '')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
  }
  return out
}

export interface Head {
  htmlLang: string | undefined
  titles: string[]
  metas: Record<string, string>[]
  links: Record<string, string>[]
  jsonLd: string[]
  /** name= 或 property= 為 key 的 meta 的所有 content */
  meta(key: string): string[]
  canonical: string[]
}

export function parseHead(html: string): Head {
  const head = html.split(/<\/head>/i)[0]
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]))
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]))
  return {
    htmlLang: html.match(/<html\b[^>]*\blang="([^"]*)"/i)?.[1],
    titles: [...head.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((m) =>
      m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
    ),
    metas,
    links,
    jsonLd: [...head.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]),
    meta: (key) => metas.filter((m) => m.name === key || m.property === key).map((m) => m.content ?? ''),
    canonical: links.filter((l) => l.rel === 'canonical').map((l) => l.href ?? ''),
  }
}

// ---- 瀏覽器錯誤收集 ----

/** 收集 console.error、未捕捉的例外與失敗的請求;回傳的陣列會持續累積 */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()} (${m.location().url})`)
  })
  page.on('requestfailed', (r) => {
    // 換頁時中斷的請求不算錯誤
    if (r.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 400 && new URL(r.url()).origin === new URL(page.url() || r.url()).origin) {
      errors.push(`HTTP ${r.status()}: ${r.url()}`)
    }
  })
  return errors
}

// ---- 登入 ----

/** 註冊一個新帳號(註冊後即登入,cookie 留在 page 的 context):序章以外的單課要登入才能看 */
export async function loginAsNewStudent(page: Page, tag = 'student'): Promise<void> {
  const email = `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  expect((await page.request.post('/api/auth/register', { data: { email, password: 'secret-pass-123', name: '' } })).status()).toBe(200)
}

/** 手機直拿時影片預設是直式舞台(課程進度在底部抽屜);要測橫式版面(右側側欄)時,網址加上 ?aspect=landscape */
export const landscape = (path: string): string => `${path}${path.includes('?') ? '&' : '?'}aspect=landscape`

/** 用點連結進到播放頁之後,手機上改成橫式(同一頁加 ?aspect=landscape 重新開) */
export async function ensureLandscape(page: Page): Promise<void> {
  await page.locator('.vp').first().waitFor()
  if (await page.locator('.vp-portrait').count()) await page.goto(landscape(new URL(page.url()).pathname))
}

/**
 * 互動課程頁的課程進度:側欄預設收合,點右上角的章節膠囊打開(已經打開就不動),回傳側欄。
 * 手機直拿時步驟、下一課直接列在播放窗下方的資訊區,回傳那一區。
 */
export async function openCoursePanel(page: Page) {
  const panel = page.getByRole('complementary', { name: '課程章節與步驟' })
  const pill = page.getByRole('button', { name: /^課程進度:/ })
  const info = page.getByRole('region', { name: '課程資訊' })
  await expect(pill.or(panel).or(info).first()).toBeVisible()
  if (await info.isVisible()) return info
  // 播放中控制面板(含膠囊)會淡出:先把滑鼠移到播放器上叫出來
  if (await pill.isVisible()) {
    await page.locator('.vp').first().hover()
    await pill.click()
  }
  await expect(panel).toBeVisible()
  return panel
}
