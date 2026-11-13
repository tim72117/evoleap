// stage.mjs — canvas_* 工具:即時教學畫面的舞台腳本,畫在 Vite dev server 的 src/studio/canvas/host.html 上(腳本直接讀檔,不經過後端)。
import fs from 'node:fs'
import path from 'node:path'
import { capture, compose, getPage, WEB, writeOut } from './art.mjs'
import { png, text } from './rpc.mjs'
import { STUDIO_TOKEN_COOKIE, studioDevToken } from '../lib/studioToken.mjs'

const URL_ = (process.env.CANVAS_URL || 'http://localhost:5190').replace(/\/$/, '')
const LIVE = path.join(WEB, 'src/content/live')
const OVERLAYS = ['bounds', 'safe', 'grid', 'time', 'pivots']

// dev server 擋研發基地(vite.config.ts 的 devStudioGate):帶本機的 token(scripts/lib/studioToken.mjs,三處共用)

async function hostPage() {
  return getPage('stage', async (e) => {
    try {
      await fetch(URL_, { signal: AbortSignal.timeout(2000) })
    } catch {
      throw new Error(`連不上 Vite dev server(${URL_}):先在 web/ 執行 npm run dev,或用 CANVAS_URL 指定網址`)
    }
    await e.ctx.addCookies([{ name: STUDIO_TOKEN_COOKIE, value: studioDevToken(WEB), url: URL_ }])
    await e.page.setViewportSize({ width: 1920, height: 1920 })
    e.viewport = { width: 1920, height: 1920 }
    await e.page.goto(`${URL_}/src/studio/canvas/host.html`)
  })
}

/** 確保頁面已載入這支腳本(檔案改過、Vite 整頁重新載入過時重新載入);回傳載入資訊 */
async function ensure(script, aspect = 'landscape') {
  if (!script) throw new Error('要給 script(相對於 src/content/live/,例如 promo/kids-free-reel-short.json)')
  const e = await hostPage()
  const file = path.join(LIVE, script)
  if (!fs.existsSync(file)) throw new Error(`找不到腳本:src/content/live/${script}`)
  const voice = file.replace(/\.json$/, '.voice.json')
  const key = `${script}|${aspect}|${fs.statSync(file).mtimeMs}|${fs.existsSync(voice) ? fs.statSync(voice).mtimeMs : 0}`
  if (e.key && e.key !== key && e.key.split('|')[0] === script && e.key.split('|')[1] === aspect) {
    // 同一支腳本改過:重新載入頁面,拿到新的檔案內容
    await e.page.reload()
    e.info = null
  }
  await e.page.waitForFunction(() => window.__canvas?.ready === true, null, { timeout: 30000 }).catch(() => {
    throw new Error(`host 頁沒有準備好:${e.errors.slice(-3).join(' | ') || '逾時'}`)
  })
  const loaded = await e.page.evaluate(() => window.__cvKey ?? null)
  if (loaded !== key || !e.info) {
    e.errors.length = 0
    e.info = await e.page.evaluate(
      async ([s, a, k]) => {
        const info = await window.__canvas.load({ script: s, aspect: a })
        window.__cvKey = k
        return info
      },
      [script, aspect, key],
    )
    e.key = key
  }
  return e
}

const errMsg = (err) => String(err?.message ?? err).replace(/^page\.evaluate: (Error: )?/, '').split('\n    at ')[0]
async function call(fn) {
  try {
    return await fn()
  } catch (err) {
    throw new Error(errMsg(err))
  }
}

async function frame(e, at, overlays, scale, crop) {
  const size = await e.page.evaluate(([t, o, s]) => window.__canvas.renderAt(t, o, s), [at, overlays ?? [], scale])
  const clip = crop ?? { x: 0, y: 0, w: size.w, h: size.h }
  return { png: await capture(e, clip, scale), w: Math.round(clip.w * scale), h: Math.round(clip.h * scale), size }
}

const common = {
  script: { type: 'string', description: '腳本路徑,相對於 web/src/content/live/(例如 promo/kids-free-reel-short.json)' },
  aspect: { type: 'string', enum: ['landscape', 'portrait'], description: '預設 landscape(1920×1080);portrait 是 1080×1920' },
  overlays: { type: 'array', items: { type: 'string', enum: OVERLAYS }, description: 'bounds 演員外框與目標、safe 安全區(直式是 FB Reels)、grid 每 100px、time 時間、pivots data-pivot 元素' },
}

export const stageTools = [
  {
    name: 'canvas_sheet',
    description: '舞台腳本的多格縮圖(一張 PNG):at 預設 "steps"(每一步演完的那一格),也可 "chapters"、毫秒陣列、"0-8000/500"。需要 Vite dev server。',
    inputSchema: {
      type: 'object',
      properties: {
        ...common,
        at: { description: '"steps"(預設)| "chapters" | number[] | "from-to/step"(to 可寫 end)', anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'number' } }] },
        cols: { type: 'number', description: '每列幾格(預設直式 6、橫式 4)' },
        width: { type: 'number', description: '整張輸出寬(預設 1600)' },
        max: { type: 'number', description: '最多幾格(預設 36)' },
      },
      required: ['script'],
    },
    run: (a) =>
      call(async () => {
        const t0 = performance.now()
        const aspect = a.aspect ?? 'landscape'
        const e = await ensure(a.script, aspect)
        let marks = await e.page.evaluate((s) => window.__canvas.times(s), a.at ?? 'steps')
        const max = a.max ?? 36
        const dropped = marks.length > max ? marks.length - max : 0
        if (dropped) marks = marks.filter((_, i) => i % Math.ceil(marks.length / max) === 0).slice(0, max)
        const cols = Math.min(a.cols ?? (aspect === 'portrait' ? 6 : 4), marks.length)
        const width = a.width ?? 1600
        const cellW = Math.floor((width - (cols + 1) * 12) / cols)
        const scale = cellW / e.info.size.w
        const items = []
        for (const m of marks) {
          const f = await frame(e, m.at, a.overlays, scale)
          items.push({ png: f.png, w: f.w, h: f.h, label: `${(m.at / 1000).toFixed(2)}s ${m.label}` })
        }
        const c = await compose(items, { cols, cellW, title: `${a.script}(${aspect},${(e.info.duration / 1000).toFixed(1)} 秒,${marks.length} 格)` })
        const f = writeOut(`sheet-${a.script.replace(/[\\/]/g, '__')}.png`, c.png)
        const list = marks.map((m, i) => `${i + 1}. ${m.at}ms ${m.label}`).join('\n')
        const errs = e.errors.length ? `\n頁面錯誤:${[...new Set(e.errors)].join(' | ')}` : ''
        return [png(c.png), text(`${marks.length} 格${dropped ? `(超過 ${max} 格,平均略過 ${dropped} 格)` : ''},${Math.round(performance.now() - t0)} ms\n${list}\nPNG:${f}${errs}`)]
      }),
  },
  {
    name: 'canvas_frame',
    description: '舞台腳本某個時間點的畫面(一張 PNG),可放大一塊(crop,舞台 px)。需要 Vite dev server。',
    inputSchema: {
      type: 'object',
      properties: { ...common, at: { type: 'number', description: '毫秒' }, crop: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } } }, scale: { type: 'number', description: '輸出倍率,預設整張 1、crop 時讓長邊約 1000px' } },
      required: ['script', 'at'],
    },
    run: (a) =>
      call(async () => {
        const t0 = performance.now()
        const e = await ensure(a.script, a.aspect ?? 'landscape')
        const scale = a.scale ?? (a.crop ? Math.min(4, 1000 / Math.max(a.crop.w, a.crop.h)) : 1)
        const f = await frame(e, a.at, a.overlays, scale, a.crop)
        const out = writeOut(`frame-${a.script.replace(/[\\/]/g, '__')}.png`, f.png)
        return [png(f.png), text(`${a.script} @ ${a.at}ms(共 ${e.info.duration}ms),輸出 ${f.w}×${f.h},${Math.round(performance.now() - t0)} ms\nPNG:${out}`)]
      }),
  },
  {
    name: 'canvas_inspect',
    description: '舞台腳本某個(或多個)時間點的量測 JSON:演員外框、目標(演員檔「目標:」列出的名稱 + targets)位置、看得到的文字、文字重疊、超出安全區/畫面的警告、字幕與目前步驟。',
    inputSchema: {
      type: 'object',
      properties: { script: common.script, aspect: common.aspect, at: { anyOf: [{ type: 'number' }, { type: 'array', items: { type: 'number' } }] }, targets: { type: 'array', items: { type: 'string' }, description: '額外要量的目標(「名稱」套用到每位演員,或「代號:名稱」)' } },
      required: ['script', 'at'],
    },
    run: (a) =>
      call(async () => {
        const e = await ensure(a.script, a.aspect ?? 'landscape')
        const ats = Array.isArray(a.at) ? a.at : [a.at]
        const out = []
        for (const t of ats) out.push(await e.page.evaluate(([time, targets]) => window.__canvas.inspect({ time, targets }), [t, a.targets ?? []]))
        const body = { duration: e.info.duration, chapters: e.info.chapters, frames: out }
        return [text(JSON.stringify(body, null, 1))]
      }),
  },
  {
    name: 'canvas_scripts',
    description: '列出可用的舞台腳本(相對於 src/content/live/)與已登記的演員名稱。需要 Vite dev server。',
    inputSchema: { type: 'object', properties: { filter: { type: 'string', description: '只列包含這段文字的路徑' } } },
    run: (a) =>
      call(async () => {
        const e = await hostPage()
        await e.page.waitForFunction(() => window.__canvas?.ready === true, null, { timeout: 30000 })
        const r = await e.page.evaluate(() => window.__canvas.scripts())
        const list = r.scripts.filter((s) => !a.filter || s.includes(a.filter))
        return [text(`腳本(${list.length}):\n${list.join('\n')}\n\n演員(${r.actors.length}):${r.actors.join(', ')}`)]
      }),
  },
]
