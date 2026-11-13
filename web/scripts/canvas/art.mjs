// art.mjs — 靜態圖(SVG,或 HTML + CSS + 內嵌 SVG)的渲染:常駐的無頭 Chromium(試過 resvg:比 Chrome 慢、可變字型的粗體畫成細字、不能疊加線與 crop,所以沒有保留)。
// 不經過 Vite、不需要 dev server。每次渲染都存一版到 history/,art_compare 預設和上一版比。
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { chromium } from '@playwright/test'
import { assertNotCancelled } from './queue.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const WEB = path.resolve(HERE, '../..')
export const REPO = path.resolve(WEB, '..')
export const OUT = path.resolve(process.env.CANVAS_OUT || path.join(WEB, 'node_modules/.cache/canvas'))
const PAGE_JS = fs.readFileSync(path.join(HERE, 'page.js'), 'utf8')
const HOST = path.join(OUT, 'host.html')
// 中文字型:Chromium 用系統字型(微軟正黑體 / Noto Sans TC)
const CJK_STACK = "'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', sans-serif"

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(
  HOST,
  `<!doctype html><html><head><meta charset="utf-8"><base id="b" href="${pathToFileURL(REPO).href}/">
<style>html,body{margin:0;padding:0}body{font-family:${CJK_STACK}}#root{position:relative;display:inline-block}#root>svg{font-family:${CJK_STACK}}</style>
</head><body><div id="root"></div><script>${PAGE_JS}</script></body></html>`,
)

// ---------- 輸入 ----------
/** 路徑:絕對路徑、相對於 repo 根目錄,或相對於 web/ */
export function resolveArt(p) {
  if (!p) throw new Error('要給 path 或 markup')
  const cands = path.isAbsolute(p) ? [p] : [path.resolve(REPO, p), path.resolve(WEB, p), path.resolve(WEB, 'art', p)]
  const f = cands.find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
  if (!f) throw new Error(`找不到檔案:${p}(找過 ${cands.join('、')})`)
  return f
}
const isHtml = (f) => /\.html?$/i.test(f)
export const slugOf = (f) => {
  if (!f) return 'markup'
  const r = path.relative(REPO, f)
  // repo 外的檔:用最後兩層目錄加檔名,另加完整路徑的雜湊避免撞名
  const name = r.startsWith('..') ? `ext__${f.split(/[\\/]/).slice(-3).join('__').replace(/\.[^.]+$/, '')}__${sha(f)}` : r.replace(/\.[^.]+$/, '')
  return name.replace(/[\\/:]+/g, '__')
}
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 8)

// ---------- 瀏覽器(常駐) ----------
let browserP = null
const pages = {}
async function browser() {
  assertNotCancelled() // 已逾時的呼叫不能再把瀏覽器開回來
  if (browserP) {
    const b = await browserP.catch(() => null)
    if (b?.isConnected()) return b
  }
  // timeout:啟動瀏覽器最多等 30 秒(不給時整個呼叫會一直等下去);整個呼叫另外有逾時(queue.mjs),逾時會 closeAll 重設
  browserP = chromium.launch({ timeout: 30_000, channel: process.env.CANVAS_CHANNEL ?? (process.env.CI ? undefined : 'chrome'), args: ['--hide-scrollbars', '--force-color-profile=srgb'] })
  for (const k in pages) delete pages[k]
  return browserP
}
/** 名稱 → { page, cdp, ctx };art(作品頁)、util(拼圖與差異)、stage(舞台,stage.mjs 用) */
export async function getPage(name, setup) {
  assertNotCancelled()
  const b = await browser()
  if (pages[name] && !pages[name].page.isClosed()) return pages[name]
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  const entry = { page, cdp, ctx, errors: [], viewport: { width: 1600, height: 1000 } }
  page.on('pageerror', (e) => entry.errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && entry.errors.push(m.text()))
  if (setup) {
    try {
      await setup(entry)
    } catch (err) {
      await ctx.close().catch(() => {})
      throw err
    }
  }
  pages[name] = entry
  return entry
}
/**
 * 關掉瀏覽器並清掉頁面,下一次呼叫會重新啟動。可以在瀏覽器卡住時呼叫:每一步都有時間上限,不會跟著卡住。
 * 順序:正常關閉(最多 5 秒)→ 還沒結束就對自己的子程序(就是這個瀏覽器)送終止訊號 → 3 秒後還在就強制結束。
 */
export async function closeAll() {
  const launching = browserP
  browserP = null
  for (const k in pages) delete pages[k]
  // 啟動還沒完成(或啟動卡住)時不能一直等它
  const b = launching && (await Promise.race([launching.catch(() => null), sleep(5000).then(() => null)]))
  if (b) {
    const closed = await Promise.race([b.close().then(() => true).catch(() => true), sleep(5000).then(() => false)])
    if (closed) return
  }
  killOwnChildren()
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** 這個行程自己啟動的瀏覽器子程序(只認瀏覽器,別的子程序不動):先 TERM,3 秒後還在就 KILL */
function killOwnChildren() {
  const browsers = () => {
    try {
      const kids = execFileSync('pgrep', ['-P', String(process.pid)], { encoding: 'utf8' }).split('\n').filter(Boolean)
      if (!kids.length) return []
      const rows = execFileSync('ps', ['-o', 'pid=,command=', '-p', kids.join(',')], { encoding: 'utf8' }).split('\n')
      return rows.filter((r) => /chrom|headless_shell/i.test(r)).map((r) => r.trim().split(/\s+/)[0])
    } catch {
      return [] // pgrep 找不到時結束碼是 1
    }
  }
  for (const pid of browsers()) process.kill(Number(pid), 'SIGTERM')
  setTimeout(() => {
    for (const pid of browsers()) {
      try {
        process.kill(Number(pid), 'SIGKILL')
      } catch {
        /* 已經結束 */
      }
    }
  }, 3000).unref()
}

/** 截圖:clip 是 CSS px,scale 是輸出倍率(向量內容放大也是清晰的) */
export async function capture(entry, clip, scale = 1) {
  const need = { width: Math.ceil(Math.min(clip.x + clip.w, 6000)), height: Math.ceil(Math.min(clip.y + clip.h, 6000)) }
  const big = need.width > entry.viewport.width || need.height > entry.viewport.height
  if (big) {
    entry.viewport = { width: Math.max(need.width, entry.viewport.width), height: Math.max(need.height, entry.viewport.height) }
    await entry.page.setViewportSize(entry.viewport)
  }
  const { data } = await entry.cdp.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h, scale },
    captureBeyondViewport: clip.x + clip.w > 6000 || clip.y + clip.h > 6000,
    fromSurface: true,
  })
  return Buffer.from(data, 'base64')
}

const artPage = () =>
  getPage('art', async (e) => {
    await e.page.goto(pathToFileURL(HOST).href)
  })
export const utilPage = () => getPage('util', async (e) => e.page.goto(pathToFileURL(HOST).href))

/** 掛上作品,回傳 { entry, size: { w, h, vb } } */
async function mount({ file, markup, baseOf, width, height, background }) {
  const entry = await artPage()
  entry.errors.length = 0
  const { page } = entry
  if (file && isHtml(file)) {
    const vw = width || 1600
    const vh = height || 1000
    if (entry.viewport.width !== vw || entry.viewport.height !== vh) {
      entry.viewport = { width: vw, height: vh }
      await page.setViewportSize(entry.viewport)
    }
    // 每次都重新載入(檔案可能改過);讀檔走 file://,相對路徑的圖片、字型照常
    await page.goto(pathToFileURL(file).href + `?t=${Date.now()}`)
    await page.addScriptTag({ content: PAGE_JS })
    entry.onHost = false
    const size = await page.evaluate(([w, h, bg]) => window.art.mountDoc(w, h, bg), [width, height, background])
    return { entry, size }
  }
  if (!entry.onHost && entry.onHost !== undefined) await page.goto(pathToFileURL(HOST).href)
  entry.onHost = true
  const text = markup ?? fs.readFileSync(file, 'utf8')
  const baseFile = file ?? baseOf
  const base = baseFile ? pathToFileURL(path.dirname(baseFile)).href + '/' : pathToFileURL(REPO).href + '/'
  const size = await page.evaluate(([m, b, bg]) => window.art.mountSvg(m, b, bg), [text, base, background])
  return { entry, size }
}

/** 決定輸出倍率:scale 優先;否則 width(輸出寬)換算;都沒有時最長邊不超過 maxSide */
function pickScale({ scale, outWidth, maxSide = 1600 }, clip) {
  if (scale) return Math.min(scale, 16)
  if (outWidth) return outWidth / clip.w
  return Math.min(2, maxSide / Math.max(clip.w, clip.h))
}

// ---------- 版本紀錄 ----------
function historyDir(slug) {
  const d = path.join(OUT, 'history', slug)
  fs.mkdirSync(d, { recursive: true })
  return d
}
export function listHistory(slug) {
  const d = path.join(OUT, 'history', slug)
  if (!fs.existsSync(d)) return []
  return fs
    .readdirSync(d)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')))
}
/** 原始檔內容和上一版不同才存新版本;回傳這一版的紀錄 */
function saveVersion(slug, file, srcText, png, meta) {
  const d = historyDir(slug)
  const hash = sha(srcText)
  const list = listHistory(slug)
  const last = list.at(-1)
  if (last && last.hash === hash) {
    // 同一份原始檔:只有乾淨的整張圖(chrome、沒有疊加線與 crop)才更新版本裡的圖
    if (meta.clean) fs.writeFileSync(last.png, png)
    return { ...last, reused: true, png: meta.clean ? last.png : writeOut(`render-${slug}.png`, png) }
  }
  const n = String((last?.n ?? 0) + 1).padStart(3, '0')
  const base = path.join(d, `${n}-${hash}`)
  const rec = { n: Number(n), hash, at: new Date().toISOString(), file, src: base + path.extname(file || '.svg'), png: base + '.png', ...meta }
  fs.writeFileSync(rec.src, srcText)
  fs.writeFileSync(rec.png, png)
  fs.writeFileSync(base + '.json', JSON.stringify(rec, null, 2))
  return rec
}

// ---------- 對外 ----------
/**
 * 渲染一次:{ path | markup, width?, height?, scale?, outWidth?, crop?, background?, overlays?, layers?, grid?, save? }
 * 回傳 { png, w, h, size, scale, engine, ms, errors, version? }
 */
export async function render(opts) {
  const t0 = performance.now()
  const file = opts.path ? resolveArt(opts.path) : null
  const markup = opts.markup ?? null
  if (!file && !markup) throw new Error('要給 path 或 markup')
  const overlays = opts.overlays ?? []
  const srcText = markup ?? fs.readFileSync(file, 'utf8')
  const engine = 'chrome'
  const { entry, size } = await mount({ file, markup, baseOf: opts.baseOf, width: opts.width, height: opts.height, background: opts.background })
  const k = size.w / size.vb.w // CSS px / 作品單位
  const c = opts.crop
  const clip = c ? { x: (c.x - size.vb.x) * k, y: (c.y - size.vb.y) * k, w: c.w * k, h: c.h * k } : { x: 0, y: 0, w: size.w, h: size.h }
  const scale = pickScale({ scale: opts.scale && opts.scale / k, outWidth: opts.outWidth, maxSide: opts.maxSide }, clip)
  if (overlays.length) await entry.page.evaluate(([l, s, o]) => window.art.overlays(l, s, o), [overlays, scale, { layers: opts.layers, grid: opts.grid }])
  else await entry.page.evaluate(() => window.art.overlays([], 1))
  const png = await capture(entry, clip, scale)
  const out = { png, w: Math.round(clip.w * scale), h: Math.round(clip.h * scale), size, scale: scale * k, errors: [...entry.errors] }
  out.engine = engine
  if (opts.save !== false) out.version = saveVersion(slugOf(file), file, srcText, out.png, { scale: out.scale, crop: opts.crop ?? null, overlays, clean: engine === 'chrome' && !overlays.length && !opts.crop })
  out.file = file
  out.ms = Math.round(performance.now() - t0)
  return out
}

/** 檢查:元素樹、bbox、顏色、路徑數、超出畫布、找不到的參照 */
export async function inspect(opts) {
  const file = opts.path ? resolveArt(opts.path) : null
  const { entry, size } = await mount({ file, markup: opts.markup, width: opts.width, height: opts.height })
  const info = await entry.page.evaluate((o) => window.art.inspect(o), { layers: opts.layers })
  return { ...info, size, errors: [...entry.errors] }
}

const dataUrl = (png) => 'data:image/png;base64,' + Buffer.from(png).toString('base64')

/** 拼圖:items [{ png, label }] → 一張 PNG */
export async function compose(items, { cols, cellW, cellH, title, outWidth } = {}) {
  const entry = await utilPage()
  if (entry.onHost === false) await entry.page.goto(pathToFileURL(HOST).href)
  const ar = items.reduce((m, i) => Math.max(m, i.h / i.w), 0)
  const cw = cellW || Math.min(800, Math.max(...items.map((i) => i.w)))
  const cell = { w: cw, h: cellH || Math.round(cw * ar) }
  const size = await entry.page.evaluate((a) => window.art.compose(a), { items: items.map((i) => ({ src: dataUrl(i.png), label: i.label })), cols, cell, title })
  entry.onHost = false // compose 改了 body
  const scale = outWidth ? outWidth / size.w : 1
  const png = await capture(entry, { x: 0, y: 0, w: size.w, h: size.h }, scale)
  await entry.page.goto(pathToFileURL(HOST).href)
  entry.onHost = true
  return { png, w: Math.round(size.w * scale), h: Math.round(size.h * scale) }
}

/** 差異熱圖:回傳 { png, changed, total, region } */
export async function diffPng(a, b) {
  const entry = await utilPage()
  const r = await entry.page.evaluate(([x, y]) => window.art.diff(x, y), [dataUrl(a), dataUrl(b)])
  return { png: Buffer.from(r.url.split(',')[1], 'base64'), changed: r.changed, total: r.total, region: r.region }
}

export function writeOut(name, png) {
  const d = path.join(OUT, 'out')
  fs.mkdirSync(d, { recursive: true })
  const f = path.join(d, name)
  fs.writeFileSync(f, png)
  return f
}
