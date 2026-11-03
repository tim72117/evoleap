#!/usr/bin/env node
// mix.mjs — 把即時教學畫面的分段旁白,依時間軸合成「章節音軌」。
//
//   npm run mix -- l0/0.0-tools.json     合成這份腳本
//   npm run mix -- --all                 所有已經有旁白語音(*.voice.json)的腳本
//   npm run mix -- l0/0.0-tools.json --publish   合成之後把章節音檔上傳 GCS(gs://shuttle-voice/mix/…),並寫出 src/content/live/<名稱>.mix.json(進版控,播放器靠它啟用章節音軌)
//
// 為什麼要合成:手機上每一句旁白都是獨立的音檔,換句要重新連線、載入,容易斷續(見 CHANGELOG 0.6.1)。
// 合成之後,播放器對每一段只需要一個 <audio>,用它的 currentTime 當時鐘,緩衝、seek、倍速都由瀏覽器處理。
//
// 做法:
//   1. 起一個 vite dev server,用 Playwright 在真的瀏覽器裡跑舞台排時間(stage.load),取得每段旁白的開始時間 at 與練習點 stops。
//      排時間用到演員(要掛 DOM),不能在 Node 裡直接算,所以借用瀏覽器。
//   2. 以練習點為界切成「章節」:練習點是播放會停下來等學員的地方,換音軌就發生在那裡。
//   3. 每個章節把它的旁白依 at 排好、中間補靜音,接成一個 mp3(48 kbps、單聲道、固定位元率)。
//
// 產出(預設只在 web/recordings/mix/,不進版控,不上傳,播放器也還不會用到):
//   <腳本資料夾>/<腳本名>/<章節序號>-<雜湊>.mp3
//   <腳本資料夾>/<腳本名>.mix.json   章節清單:每章的開始時間、長度、檔名,以及每段旁白在章節檔裡的位置
// 加 --publish 才會上傳(用本機 gcloud 的登入身分,同 voice.mjs),並把清單寫到 src/content/live/ 讓播放器使用。
// 旁白或腳本改了(旁白文字、語音檔、間隔),要重新執行;沒重新執行時播放器發現對不上會自動退回逐句播放,不會錯位。
// 並印出檢查報告(章節長度與預期差多少、旁白有沒有重疊)。
// 需要 ffmpeg(含 libmp3lame)。旁白音檔從 GCS 下載到 recordings/mix/.cache/(沒有的才下載)。

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIVE = path.join(WEB, 'src/content/live')
const OUT = path.join(WEB, 'recordings/mix')
const CACHE = path.join(OUT, '.cache')
const VOICE_BASE = 'https://storage.googleapis.com/shuttle-voice/'
const BUCKET = 'shuttle-voice'
const PORT = 5291
const KBPS = 48

const args = process.argv.slice(2)
const die = (msg) => {
  console.error(`錯誤:${msg}`)
  process.exit(1)
}

// ---------- 找腳本 ----------
function listScripts() {
  const out = []
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name)
      if (f.isDirectory()) walk(p)
      else if (f.name.endsWith('.voice.json')) out.push(path.relative(LIVE, p).replace(/\.voice\.json$/, '.json'))
    }
  }
  walk(LIVE)
  return out.sort()
}
const publish = args.includes('--publish')
const scripts = args.includes('--all') ? listScripts() : args.filter((a) => !a.startsWith('--'))
if (!scripts.length) die('請指定腳本(例如 l0/0.0-tools.json)或 --all')
for (const s of scripts) {
  if (!fs.existsSync(path.join(LIVE, s))) die(`找不到腳本:${s}`)
  if (!fs.existsSync(path.join(LIVE, s.replace(/\.json$/, '.voice.json')))) die(`${s} 還沒有旁白語音,先執行 npm run voice -- ${s}`)
}
try {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-encoders'], { stdio: 'pipe' })
} catch {
  die('找不到 ffmpeg')
}

// ---------- 在瀏覽器裡排時間 ----------
async function startVite() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { cwd: WEB, stdio: 'ignore', detached: true, env: { ...process.env, DEV_HOST: '' } })
  const url = `http://127.0.0.1:${PORT}`
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return { proc, url }
    } catch {
      /* 還沒起來 */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  process.kill(-proc.pid)
  die('vite dev server 沒有起來(5291 被占用嗎?)')
}

async function layoutOf(page, script) {
  const voicePath = script.replace(/\.json$/, '.voice.json')
  return page.evaluate(
    async ({ script, voicePath }) => {
      const [{ createStage }, scriptMod, voiceMod] = await Promise.all([
        import('/src/live/stage.ts'),
        import(/* @vite-ignore */ `/src/content/live/${script}`),
        import(/* @vite-ignore */ `/src/content/live/${voicePath}`),
      ])
      await document.fonts.ready
      const root = document.createElement('div')
      root.style.cssText = 'position:fixed;left:0;top:0;width:1920px;height:1080px'
      document.body.appendChild(root)
      const stage = createStage(root)
      const durations = {}
      for (const [text, clip] of Object.entries(voiceMod.default.clips)) durations[text] = clip.ms
      await stage.load(scriptMod.default, { voice: durations })
      const out = {
        duration: stage.duration,
        narrations: stage.narrations.map((n) => ({ at: n.at, text: n.text })),
        stops: stage.stops.map((s) => ({ at: s.at, title: s.title })),
      }
      root.remove()
      return out
    },
    { script, voicePath },
  )
}

// ---------- 音檔 ----------
async function clipFile(file) {
  const dest = path.join(CACHE, file.replace(/\//g, '_'))
  if (fs.existsSync(dest)) return dest
  const res = await fetch(VOICE_BASE + file)
  if (!res.ok) die(`下載 ${file} 失敗:${res.status}`)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  return dest
}

/** 解碼後的實際長度(毫秒):讀 ffmpeg 解碼到結尾的時間,不靠檔頭的估算 */
function probeMs(file) {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' })
  const m = [...String(res.stderr).matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)].at(-1)
  if (!m) die(`讀不到 ${file} 的長度`)
  return Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000)
}

/** 上傳到 GCS(檔名含內容雜湊,內容不會變,所以設成永久快取) */
function upload(file, object) {
  const args = ['storage', 'cp', file, `gs://${BUCKET}/${object}`, '--cache-control=public, max-age=31536000, immutable', '--content-type=audio/mpeg', '--quiet']
  const win = process.platform === 'win32'
  try {
    execFileSync('gcloud', win ? args.map((x) => (/[\s,]/.test(x) ? `"${x}"` : x)) : args, { stdio: ['ignore', 'ignore', 'pipe'], shell: win })
  } catch (e) {
    die(`上傳 gs://${BUCKET}/${object} 失敗(要先 gcloud auth login):${e.stderr?.toString() || e.message}`)
  }
}

// ---------- 合成一個章節 ----------
function mixChapter(items, outFile) {
  // items: [{ file, startMs(在章節裡的位置), ms(實際長度) }],依 startMs 排好
  const inputs = []
  const filters = []
  const labels = []
  let cursor = 0
  items.forEach((it, k) => {
    inputs.push('-i', it.file)
    const gap = it.startMs - cursor
    if (gap > 1) {
      filters.push(`anullsrc=r=24000:cl=mono,atrim=0:${(gap / 1000).toFixed(3)},asetpts=N/SR/TB[g${k}]`)
      labels.push(`[g${k}]`)
    }
    filters.push(`[${k}:a]aresample=24000,aformat=channel_layouts=mono[a${k}]`)
    labels.push(`[a${k}]`)
    cursor = Math.max(cursor, it.startMs) + it.ms
  })
  filters.push(`${labels.join('')}concat=n=${labels.length}:v=0:a=1[out]`)
  execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', `${KBPS}k`, '-ar', '24000', '-ac', '1', outFile],
    { stdio: 'inherit' },
  )
}

// ---------- 主流程 ----------
fs.mkdirSync(CACHE, { recursive: true })
const { proc, url } = await startVite()
// 本機用系統的 Chrome(同 playwright.config.ts),不必另外下載瀏覽器
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' })
let failed = false
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.on('pageerror', (e) => console.error('頁面錯誤:', e.message))
  await page.goto(url)
  for (const script of scripts) {
    const voice = JSON.parse(fs.readFileSync(path.join(LIVE, script.replace(/\.json$/, '.voice.json')), 'utf8'))
    const layout = await layoutOf(page, script)
    const narr = layout.narrations.filter((n) => voice.clips[n.text]).sort((a, b) => a.at - b.at)
    const stops = [...layout.stops].sort((a, b) => a.at - b.at)
    const skipped = layout.narrations.length - narr.length
    console.log(`\n== ${script}:旁白 ${layout.narrations.length} 段(有語音 ${narr.length}),練習點 ${stops.length} 個,總長 ${(layout.duration / 1000).toFixed(1)} 秒`)
    if (skipped) console.log(`   ${skipped} 段旁白還沒有語音,不會進章節音軌`)

    // 以練習點切章節:練習點之前的旁白屬於前一章
    const chapters = []
    for (const n of narr) {
      const idx = stops.filter((s) => s.at <= n.at).length
      ;(chapters[idx] ??= []).push(n)
    }

    const dir = path.join(OUT, script.replace(/\.json$/, ''))
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const manifest = { script, chapters: [] }

    for (const [idx, list] of chapters.entries()) {
      if (!list?.length) continue
      const first = list[0].at
      const items = []
      let overlap = 0
      let cursor = 0
      for (const n of list) {
        const clip = voice.clips[n.text]
        const file = await clipFile(clip.file)
        const ms = probeMs(file)
        const startMs = n.at - first
        if (startMs < cursor - 1) overlap = Math.max(overlap, Math.round(cursor - startMs))
        items.push({ file, startMs: Math.max(startMs, cursor), ms, at: n.at, text: n.text, voice: clip.file })
        cursor = Math.max(startMs, cursor) + ms
      }
      // 雜湊含旁白的語音檔:旁白重新產生之後內容不同,檔名也要不同(上傳的檔案是永久快取)
      const key = createHash('sha1')
        .update(JSON.stringify(items.map((i) => [i.text, i.voice, i.startMs, i.ms])))
        .digest('hex')
        .slice(0, 12)
      const outName = `${String(idx).padStart(2, '0')}-${key}.mp3`
      const outFile = path.join(dir, outName)
      mixChapter(items, outFile)
      const actual = probeMs(outFile)
      const expected = cursor
      const drift = actual - expected
      const bytes = fs.statSync(outFile).size
      console.log(
        `   章節 ${idx}:${items.length} 段,從 ${(first / 1000).toFixed(1)}s 開始,預期 ${(expected / 1000).toFixed(2)}s、實際 ${(actual / 1000).toFixed(2)}s(差 ${drift}ms),${(bytes / 1024).toFixed(0)} KB` +
          (overlap ? `,重疊 ${overlap}ms!` : ''),
      )
      if (overlap) failed = true
      if (Math.abs(drift) > 80) {
        console.log('   ↑ 長度差距超過 80ms,請檢查')
        failed = true
      }
      const object = `mix/${script.replace(/\.json$/, '')}/${outName}`
      if (publish) upload(outFile, object)
      manifest.chapters.push({
        index: idx,
        file: publish ? object : outName,
        startMs: first,
        ms: actual,
        clips: items.map((i) => ({ at: i.at, offsetMs: i.startMs, ms: i.ms, text: i.text, voice: i.voice })),
      })
    }
    const manifestFile = path.join(publish ? LIVE : OUT, script.replace(/\.json$/, '.mix.json'))
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n')
    console.log(`   清單:${path.relative(WEB, manifestFile)}${publish ? '(已上傳,記得一起 commit)' : '(只在本機,沒有上傳)'}`)
  }
} finally {
  await browser.close()
  process.kill(-proc.pid) // npx 底下還有 vite 的子程序,整組一起結束
}
if (failed) process.exitCode = 1
