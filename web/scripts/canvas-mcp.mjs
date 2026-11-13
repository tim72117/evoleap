#!/usr/bin/env node
// canvas-mcp.mjs — 給 Claude 用的「畫圖 → 看圖」快速迴圈:MCP 伺服器(stdio),常駐一個無頭 Chromium,回傳 PNG 與量測數字。
//
//   npm run canvas:mcp          (通常不用手動跑:repo 根目錄的 .mcp.json 讓 Claude Code 自動啟動)
//
// 第一組 art_*:靜態圖(web/art/<名稱>/*.svg | *.html,或 repo 裡任何 SVG/HTML),不需要 dev server。
// 第二組 canvas_*:即時教學畫面的舞台腳本(src/content/live/**),需要 Vite dev server(預設 http://localhost:5190)。
// 輸出(每次渲染的版本紀錄、拼圖)放在 CANVAS_OUT(預設 web/node_modules/.cache/canvas)。
// 說明見 web/src/live/README.md「畫面快速檢查(canvas MCP)」。
import fs from 'node:fs'
import path from 'node:path'
import { compose, diffPng, inspect, listHistory, OUT, render, resolveArt, slugOf, writeOut, closeAll, REPO } from './canvas/art.mjs'
import { createSerial, DEFAULT_TIMEOUT_MS } from './canvas/queue.mjs'
import { createMcpServer, png, text } from './canvas/rpc.mjs'
import { stageTools } from './canvas/stage.mjs'

const OVERLAYS = ['grid', 'rulers', 'layers', 'bbox', 'pivots', 'canvas']
const box = { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } }, required: ['x', 'y', 'w', 'h'] }
const src = {
  path: { type: 'string', description: 'SVG 或 HTML 檔(絕對路徑、相對 repo 根目錄、相對 web/ 或 web/art/)' },
  markup: { type: 'string', description: '直接給 SVG 原始碼(不用存檔時)' },
}
const ovl = { type: 'array', items: { type: 'string', enum: OVERLAYS }, description: 'grid 每 100 單位格線、rulers 尺規、layers 每個有 id 的元素外框與名稱、bbox 最上層元素外框與大小、pivots data-pivot 支點、canvas 畫布邊界' }
const rel = (f) => (!f ? '(markup)' : path.relative(REPO, f).startsWith('..') ? f.replace(/\\/g, '/') : path.relative(REPO, f).replace(/\\/g, '/'))
const fmt = (n) => (Math.round(n * 100) / 100).toString()

function renderLine(r, extra = '') {
  const v = r.version ? ` v${r.version.n}${r.version.reused ? '(原始檔沒變)' : ''}` : ''
  const err = r.errors?.length ? `\n頁面錯誤:${[...new Set(r.errors)].join(' | ')}` : ''
  return `${rel(r.file)}${v}:畫布 ${fmt(r.size.w)}×${fmt(r.size.h)},輸出 ${r.w}×${r.h}(${fmt(r.scale)}x,${r.engine}),${r.ms} ms${extra}\nPNG:${r.version?.png ?? ''}${err}`
}

const artTools = [
  {
    name: 'art_render',
    description: '渲染 SVG / HTML 靜態圖成 PNG(常駐 Chromium,中文字型可用)。每次自動存一版,art_compare 可與上一版比較。',
    inputSchema: {
      type: 'object',
      properties: {
        ...src,
        width: { type: 'number', description: 'HTML 的版面寬(CSS px);SVG 用自己的大小' },
        height: { type: 'number', description: 'HTML 的版面高;沒給時量內容高' },
        scale: { type: 'number', description: '輸出倍率(輸出 px / 作品單位);沒給時最長邊縮到 maxSide' },
        maxSide: { type: 'number', description: '沒給 scale 時輸出最長邊(預設 1600)' },
        crop: { ...box, description: '只畫這一塊(作品座標)' },
        background: { type: 'string', description: '背景色,預設透明' },
        overlays: ovl,
        layers: { type: 'string', description: 'layers 疊加只標 id 符合這個正規表示式的元素' },
      },
    },
    async run(a) {
      const r = await render(a)
      return [png(r.png), text(renderLine(r))]
    },
  },
  {
    name: 'art_zoom',
    description: '放大檢查細節(例如髮絲、反光、邊緣):只畫 {x,y,w,h} 這塊(作品座標),或給 id 直接放大那個元素(四周留 pad);向量放大,預設輸出長邊約 1000px。',
    inputSchema: {
      type: 'object',
      properties: {
        ...src,
        id: { type: 'string', description: '元素 id(不用給 x,y,w,h)' },
        pad: { type: 'number', description: '用 id 時四周多留幾個單位(預設 24)' },
        x: { type: 'number' },
        y: { type: 'number' },
        w: { type: 'number' },
        h: { type: 'number' },
        scale: { type: 'number', description: '倍率,預設讓長邊約 1000px' },
        overlays: ovl,
        background: { type: 'string' },
      },
    },
    async run(a) {
      let crop = { x: a.x, y: a.y, w: a.w, h: a.h }
      if (a.id) {
        const id = a.id.replace(/^#/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const info = await inspect({ path: a.path, markup: a.markup, layers: `^${id}$` })
        const t = info.tree[0]
        if (!t) throw new Error(`找不到 id「${a.id}」(art_inspect 可列出所有 id)`)
        const p = a.pad ?? 24
        crop = { x: t.box.x - p, y: t.box.y - p, w: t.box.w + p * 2, h: t.box.h + p * 2 }
      } else if ([crop.x, crop.y, crop.w, crop.h].some((v) => typeof v !== 'number')) throw new Error('要給 id,或 x、y、w、h')
      const r = await render({ ...a, crop, scale: a.scale ?? Math.min(16, 1000 / Math.max(crop.w, crop.h)), save: false })
      const f = writeOut(`zoom-${slugOf(r.file)}.png`, r.png)
      return [png(r.png), text(renderLine(r, `,範圍 ${Math.round(crop.x)},${Math.round(crop.y)} ${Math.round(crop.w)}×${Math.round(crop.h)}`).replace(/PNG:.*/, `PNG:${f}`))]
    },
  },
  {
    name: 'art_compare',
    description: '並排比較(左舊右新)+ 差異熱圖(紅色是變動處)。against 預設 "previous"(版本紀錄裡原始檔不同的上一版),也可給另一個檔案路徑或版本號(數字)。',
    inputSchema: {
      type: 'object',
      properties: {
        path: src.path,
        against: { type: ['string', 'number'], description: '"previous"(預設)、版本號,或另一個檔案' },
        diff: { type: 'boolean', description: '加上差異熱圖(預設 true)' },
        crop: { ...box, description: '只比這一塊' },
        scale: { type: 'number' },
        width: { type: 'number', description: '整張輸出寬(預設 1800)' },
      },
      required: ['path'],
    },
    async run(a) {
      const file = resolveArt(a.path)
      const before = listHistory(slugOf(file))
      let now = await render({ path: a.path, crop: a.crop, scale: a.scale, maxSide: 1000 })
      let old
      let oldLabel
      const against = a.against ?? 'previous'
      if (typeof against === 'number' || /^\d+$/.test(String(against))) {
        const v = before.find((x) => x.n === Number(against))
        if (!v) throw new Error(`沒有版本 ${against}(有:${before.map((x) => x.n).join(', ') || '無'})`)
        old = v
      } else if (against === 'previous') {
        old = [...before].reverse().find((x) => x.hash !== now.version.hash)
        if (!old) throw new Error('沒有更早的版本可以比較(原始檔改過再 render 一次就有)')
      }
      let oldR
      if (old) {
        oldLabel = `v${old.n} ${old.at.slice(11, 19)}`
        const markup = /\.svg$/i.test(old.src) ? fs.readFileSync(old.src, 'utf8') : null
        if (markup) oldR = await render({ markup, baseOf: file, crop: a.crop, scale: now.scale, save: false })
        else {
          // HTML 的舊版只有存下來的 PNG(重畫舊版 HTML 會找不到它相對路徑的圖片、字型):
          // 只有「整張、沒疊加線」的版本能比,而且要用同一個倍率重畫新版,兩張大小才會一樣
          if (a.crop) throw new Error('HTML 的舊版只存了整張圖,不能只比一塊(crop);不給 crop 比整張,或改比 SVG')
          if (old.crop || old.clean === false) throw new Error(`v${old.n} 是 crop 或帶疊加線的渲染,HTML 沒辦法和它比較(重新 art_render 一次整張)`)
          if (Math.abs(old.scale - now.scale) > 1e-6) now = { ...(await render({ path: a.path, scale: old.scale, save: false })), version: now.version } // 版本紀錄(新版的編號與雜湊)還要用
          oldR = { png: fs.readFileSync(old.png), w: now.w, h: now.h }
        }
      } else {
        oldLabel = rel(resolveArt(String(against)))
        oldR = await render({ path: String(against), crop: a.crop, scale: now.scale, save: false })
      }
      const items = [
        { png: oldR.png, label: `舊 ${oldLabel}`, w: now.w, h: now.h },
        { png: now.png, label: `新 v${now.version.n}`, w: now.w, h: now.h },
      ]
      let note = ''
      if (a.diff !== false) {
        const d = await diffPng(oldR.png, now.png)
        items.push({ png: d.png, label: `差異 ${((d.changed / d.total) * 100).toFixed(2)}%`, w: now.w, h: now.h })
        const k = now.scale
        const off = a.crop ?? { x: now.size.vb?.x ?? 0, y: now.size.vb?.y ?? 0 }
        note = d.region
          ? `,變動 ${((d.changed / d.total) * 100).toFixed(2)}% 的像素,範圍(作品座標)${Math.round(d.region.x / k + off.x)},${Math.round(d.region.y / k + off.y)} ${Math.round(d.region.w / k)}×${Math.round(d.region.h / k)}`
          : ',沒有差異'
      }
      const c = await compose(items, { cols: items.length, title: `${rel(file)}  ${oldLabel} → v${now.version.n}`, outWidth: a.width ?? 1800 })
      const f = writeOut(`compare-${slugOf(file)}.png`, c.png)
      return [png(c.png), text(`比較 ${oldLabel} → v${now.version.n}${note}\nPNG:${f}`)]
    },
  },
  {
    name: 'art_inspect',
    description: '文字資訊:畫布大小、有 id 的元素樹與 bbox(作品座標)、用到的顏色、路徑數與節點數、漸層/濾鏡、文字、超出畫布的元素、找不到的 url(#id) 參照、重複 id。',
    inputSchema: { type: 'object', properties: { ...src, layers: { type: 'string', description: '只列 id 符合這個正規表示式的元素' }, width: { type: 'number' } } },
    async run(a) {
      const r = await inspect(a)
      const lines = [
        `${a.path ? rel(resolveArt(a.path)) : '(markup)'}:${r.mode},畫布 ${fmt(r.size.w)}×${fmt(r.size.h)},viewBox ${r.viewBox.x} ${r.viewBox.y} ${r.viewBox.w} ${r.viewBox.h}`,
        `元素 ${r.elements}(${Object.entries(r.tags).sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t} ${n}`).join('、')})`,
        `路徑 ${r.paths} 條、節點(指令)${r.pathCommands};漸層 ${r.gradients};濾鏡 ${r.filters.map((f) => `#${f.id}[${f.prims}]`).join(' ') || '無'}`,
        `顏色 ${r.colors.length}:${r.colors.slice(0, 40).join(' ')}`,
      ]
      if (r.missingRefs.length) lines.push(`⚠ 找不到的參照:${r.missingRefs.map((x) => '#' + x).join(' ')}`)
      if (r.duplicateIds.length) lines.push(`⚠ 重複 id:${r.duplicateIds.join(' ')}`)
      if (r.outside.length) lines.push(`⚠ 超出畫布:${r.outside.map((o) => `${o.el} [${o.box.x},${o.box.y} ${o.box.w}×${o.box.h}]`).join('、')}`)
      if (r.errors.length) lines.push(`⚠ 頁面錯誤:${r.errors.join(' | ')}`)
      if (r.texts.length) lines.push('文字:', ...r.texts.map((t) => `  "${t.text}" [${t.box.x},${t.box.y} ${t.box.w}×${t.box.h}] ${t.font}`))
      lines.push(`有 id 的元素(${r.tree.length}):`, ...r.tree.map((t) => `${'  '.repeat(t.depth + 1)}#${t.id} <${t.tag}> [${t.box.x},${t.box.y} ${t.box.w}×${t.box.h}]${t.children ? ` ${t.children} 子元素` : ''}${t.pivot ? ` pivot ${t.pivot}` : ''}${t.outside ? ' ⚠超出' : ''}`))
      return [text(lines.join('\n'))]
    },
  },
  {
    name: 'art_history',
    description: '列出一個檔案的渲染版本紀錄(版本號、時間、PNG 路徑),給 art_compare 的 against 用。',
    inputSchema: { type: 'object', properties: { path: src.path }, required: ['path'] },
    async run(a) {
      const list = listHistory(slugOf(resolveArt(a.path)))
      return [text(list.length ? list.map((v) => `v${v.n} ${v.at} ${v.hash} ${v.png}`).join('\n') : '還沒有版本')]
    },
  },
  {
    name: 'canvas_reload',
    description: '關掉並重開常駐的 Chromium(頁面卡住、或舞台程式改了 Vite 沒重新載入時用)。',
    inputSchema: { type: 'object', properties: {} },
    async run() {
      await closeAll()
      return [text('已重開(下一次呼叫會重新啟動瀏覽器)')]
    },
  },
]

// 所有工具共用同一個瀏覽器頁面:一次只跑一個,而且每個呼叫都有逾時(見 canvas/queue.mjs):逾時就中止並重設瀏覽器,不會讓後面的呼叫永遠排隊
const serial = createSerial({ timeoutMs: Number(process.env.CANVAS_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS, onTimeout: () => closeAll() })
const tools = [...artTools, ...stageTools].map((t) => ({ ...t, run: serial(t.run) }))

const server = createMcpServer({
  name: 'evoleap-canvas',
  version: '0.1.0',
  instructions: `畫圖時的快速迴圈:art_render 看全圖(overlays 加格線/圖層外框)、art_zoom 放大細節、art_compare 和上一版比、art_inspect 量 bbox 與檢查。舞台腳本用 canvas_*(需要 Vite dev server)。輸出存在 ${OUT}。`,
  tools,
})
server.listen(process.stdin, process.stdout)
process.stdin.on('end', async () => {
  await closeAll().catch(() => {})
  process.exit(0)
})
