#!/usr/bin/env node
// record-live.mjs — 把「即時教學畫面」的宣傳影片腳本逐格錄成 1080p mp4(橫式 1920×1080;--aspect portrait 是直式 1080×1920)。
//
//   npm run record:live -- promo/0.promo-intro.json
//   npm run record:live -- promo/0.promo-intro.json --from 0 --to 8000     只錄 0–8 秒(試做用,輸出檔名會加上範圍)
//   npm run record:live -- promo/portrait-demo.json --aspect portrait   直式 1080×1920(輸出檔名加 .portrait);預設 landscape 是 1920×1080
//   選項:--fps 30(預設 30)  --url http://localhost:5190(指定已經在跑的 dev server;沒指定時先找 5190,沒有就自己起一個)
//
// 做法:用 Playwright(本機用系統的 Chrome)開 /materials/promo?script=…&record=1。這個模式只顯示 1920×1080 的舞台,
// 畫面是時間的純函式,所以逐格呼叫 window.__promo.renderAt(ms) 再截圖,截圖用管線交給 ffmpeg 合成 mp4(H.264、yuv420p)。
//
// 旁白:腳本旁有 <名稱>.voice.json(npm run voice 產生)時,依各段旁白的開始時間(stage.narrations 的 at)
// 把音檔用 ffmpeg 混成一條音軌(adelay + amix),和畫面一起壓進 mp4。音檔先下載到 recordings/mix/.cache/(同 mix.mjs,沒有的才下載)。
// 沒有語音就只輸出無聲影片。兩種情況都另外輸出字幕檔 .srt(和 mp4 同名)。
//
// 輸出:web/recordings/promo/<腳本名>.mp4 與 .srt(recordings/ 已在 .gitignore)
// 需要 ffmpeg。

import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIVE = path.join(WEB, 'src/content/live')
const OUT = path.join(WEB, 'recordings/promo')
const CACHE = path.join(WEB, 'recordings/mix/.cache')
const VOICE_BASE = 'https://storage.googleapis.com/shuttle-voice/'
const VITE_PORT = 5292

const die = (msg) => {
  console.error(`錯誤:${msg}`)
  process.exit(1)
}

// ---------- 參數 ----------
const argv = process.argv.slice(2)
const opt = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const optNames = new Set(['from', 'to', 'fps', 'url', 'aspect'])
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && optNames.has(argv[i - 1].replace(/^--/, '')) && argv[i - 1].startsWith('--')))
const script = positional[0]
if (!script) die('請指定腳本,例如 npm run record:live -- promo/0.promo-intro.json [--from 毫秒] [--to 毫秒]')
if (!fs.existsSync(path.join(LIVE, script))) die(`找不到腳本:src/content/live/${script}`)
const num = (name, def) => {
  const v = opt(name)
  if (v === undefined) return def
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) die(`--${name} 要是非負的數字(毫秒)`)
  return n
}
const FPS = num('fps', 30) || 30
const ASPECT = opt('aspect') ?? 'landscape'
if (ASPECT !== 'landscape' && ASPECT !== 'portrait') die('--aspect 要是 landscape 或 portrait')
const [VW, VH] = ASPECT === 'portrait' ? [1080, 1920] : [1920, 1080]
try {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-version'], { stdio: 'pipe' })
} catch {
  die('找不到 ffmpeg')
}

// ---------- dev server ----------
async function alive(url) {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}
async function findServer() {
  const given = opt('url')
  if (given) {
    if (!(await alive(given))) die(`連不上 ${given}`)
    return { url: given, proc: null }
  }
  if (await alive('http://localhost:5190')) return { url: 'http://localhost:5190', proc: null }
  const proc = spawn('npx', ['vite', '--port', String(VITE_PORT), '--host', '127.0.0.1', '--strictPort'], { cwd: WEB, stdio: 'ignore', detached: true, env: { ...process.env, DEV_HOST: '' } })
  const url = `http://127.0.0.1:${VITE_PORT}`
  for (let i = 0; i < 100; i++) {
    if (await alive(url)) return { url, proc }
    await new Promise((r) => setTimeout(r, 300))
  }
  process.kill(-proc.pid)
  die(`vite dev server 沒有起來(${VITE_PORT} 被占用嗎?)`)
}

// ---------- 字幕與音訊 ----------
const pad = (n, w = 2) => String(n).padStart(w, '0')
function srtTime(ms) {
  const t = Math.max(0, Math.round(ms))
  return `${pad(Math.floor(t / 3600000))}:${pad(Math.floor(t / 60000) % 60)}:${pad(Math.floor(t / 1000) % 60)},${pad(t % 1000, 3)}`
}
/** 字幕轉 .srt;範圍外的丟掉,範圍內的時間減掉 from */
function toSrt(captions, from, to) {
  const lines = []
  let n = 0
  for (const c of captions) {
    const a = Math.max(c.from, from)
    const b = Math.min(c.to, to)
    if (b <= a) continue
    lines.push(`${++n}\n${srtTime(a - from)} --> ${srtTime(b - from)}\n${c.text}\n`)
  }
  return lines.join('\n')
}

async function clipFile(file) {
  const dest = path.join(CACHE, file.replace(/\//g, '_'))
  if (fs.existsSync(dest)) return dest
  const res = await fetch(VOICE_BASE + file)
  if (!res.ok) die(`下載旁白音檔 ${file} 失敗:${res.status}`)
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  return dest
}

/** 依旁白的開始時間排出音軌要用的片段(範圍內的),回傳 [{ file, delay(毫秒), skip(毫秒,範圍開頭已播過的部分) }] */
async function audioPlan(narrations, from, to) {
  const voicePath = path.join(LIVE, script.replace(/\.json$/, '.voice.json'))
  if (!fs.existsSync(voicePath)) return []
  const voice = JSON.parse(fs.readFileSync(voicePath, 'utf8'))
  const plan = []
  for (const n of narrations) {
    const clip = voice.clips?.[n.text]
    if (!clip) continue
    if (n.at + clip.ms <= from || n.at >= to) continue
    plan.push({ file: await clipFile(clip.file), delay: Math.max(0, n.at - from), skip: Math.max(0, from - n.at) })
  }
  return plan
}

function audioArgs(plan) {
  const inputs = []
  const filters = []
  plan.forEach((p, k) => {
    inputs.push('-i', p.file)
    const trim = p.skip > 0 ? `atrim=start=${(p.skip / 1000).toFixed(3)},asetpts=PTS-STARTPTS,` : ''
    filters.push(`[${k + 1}:a]${trim}aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(p.delay)}|${Math.round(p.delay)}[a${k}]`)
  })
  const labels = plan.map((_, k) => `[a${k}]`).join('')
  filters.push(`${labels}amix=inputs=${plan.length}:normalize=0:dropout_transition=0[aout]`)
  return { inputs, filter: filters.join(';') }
}

// ---------- 主流程 ----------
fs.mkdirSync(OUT, { recursive: true })
const { url, proc } = await findServer()
// 本機用系統的 Chrome(同 playwright.config.ts、mix.mjs),不必另外下載瀏覽器
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' })
let ffmpeg = null
try {
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 })
  const problems = []
  page.on('pageerror', (e) => problems.push(`頁面錯誤:${e.message}`))
  page.on('console', (m) => m.type() === 'error' && problems.push(`console:${m.text()}`))
  await page.goto(`${url}/materials/promo?script=${encodeURIComponent(script)}&record=1${ASPECT === 'portrait' ? '&aspect=portrait' : ''}`)
  await page.waitForFunction(() => window.__promoReady === true || document.querySelector('[role=alert]'), null, { timeout: 60000 })
  if (!(await page.evaluate(() => window.__promoReady === true))) die(`腳本載入失敗:${await page.locator('[role=alert]').innerText()}`)

  const info = await page.evaluate(() => ({
    duration: window.__promo.duration,
    narrations: window.__promo.narrations,
    captions: window.__promo.captions,
  }))
  const from = Math.min(num('from', 0), info.duration)
  const to = Math.min(num('to', info.duration), info.duration)
  if (to <= from) die(`範圍是空的:--from ${from} --to ${to}(腳本長度 ${info.duration} 毫秒)`)
  const frames = Math.ceil(((to - from) / 1000) * FPS)
  const partial = from > 0 || to < info.duration
  const base = path.basename(script).replace(/\.json$/, '') + (ASPECT === 'portrait' ? '.portrait' : '') + (partial ? `.${Math.round(from)}-${Math.round(to)}` : '')
  const mp4 = path.join(OUT, `${base}.mp4`)
  const srt = path.join(OUT, `${base}.srt`)

  const plan = await audioPlan(info.narrations, from, to)
  console.log(`${script}:總長 ${(info.duration / 1000).toFixed(1)} 秒,錄 ${(from / 1000).toFixed(1)}–${(to / 1000).toFixed(1)} 秒,${frames} 格(${FPS} fps),${plan.length ? `旁白 ${plan.length} 段` : '無旁白語音(只輸出無聲影片)'}`)

  fs.writeFileSync(srt, toSrt(info.captions, from, to))

  const a = plan.length ? audioArgs(plan) : null
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', ...(a ? a.inputs : [])]
  if (a) args.push('-filter_complex', a.filter, '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '160k', '-t', ((to - from) / 1000).toFixed(3))
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', mp4)
  ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((resolve) => ffmpeg.on('close', resolve))
  ffmpeg.stdin.on('error', () => {})

  const t0 = Date.now()
  for (let i = 0; i < frames; i++) {
    const ms = Math.min(from + (i * 1000) / FPS, info.duration)
    await page.evaluate((t) => window.__promo.renderAt(t), ms)
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: VW, height: VH } })
    if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r))
    if (i % FPS === 0 || i === frames - 1) {
      const elapsed = (Date.now() - t0) / 1000
      const eta = (elapsed / (i + 1)) * (frames - i - 1)
      process.stdout.write(`\r進度 ${i + 1}/${frames}(${Math.round(((i + 1) / frames) * 100)}%),已用 ${elapsed.toFixed(0)} 秒,約剩 ${eta.toFixed(0)} 秒   `)
    }
  }
  ffmpeg.stdin.end()
  const code = await done
  process.stdout.write('\n')
  if (code !== 0) die(`ffmpeg 失敗(結束碼 ${code})`)
  if (problems.length) console.warn(`頁面回報了問題:\n${[...new Set(problems)].join('\n')}`)
  console.log(`輸出:${path.relative(WEB, mp4)}\n字幕:${path.relative(WEB, srt)}`)
} finally {
  await browser.close()
  if (proc) process.kill(-proc.pid)
}
