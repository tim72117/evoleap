#!/usr/bin/env node
// voice.mjs — 用 Gemini TTS 產生即時教學畫面的旁白語音。
//
//   npm run voice -- l0/0.0-tools.json          產生(或補齊)這份腳本的旁白
//   npm run voice -- --all                      所有腳本
//   npm run voice -- l0/0.0-tools.json --max-sec 20   只產生開頭約 20 秒的旁白(試做用,依字數估算)
//   npm run voice -- --sample "一句旁白" --voices Sulafat,Kore,Charon   試聽:各聲音念同一句,輸出到 recordings/voice-samples/
//
// 腳本在 src/content/live/,每個 steps[] 的 narration 是一段旁白。產生結果:
//   src/content/live/l0/0.0-tools.voice.json   旁白文字 → { file, ms }(進版控;舞台用 ms 排時間,課程頁播 file)
//   gs://shuttle-voice/l0/<hash>.mp3             每段一個音檔,公開讀取、永久快取;hash 由模型、聲音、語氣、文字決定,
//                                                沒改就不會重新產生(不重複計費)。GCS 上的舊檔不刪(正式站部署前仍可能用到)
// 金鑰:環境變數 GEMINI_API_KEY,或寫在 web/.env.local(不進版控)。上傳用本機 gcloud 的登入身分。只在本機產生,不會進到網站。

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Mp3Encoder } from '@breezystack/lamejs'

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIVE = path.join(WEB, 'src/content/live')

// 預設設定(之後要換聲音或語氣,改這裡再重跑;舊音檔會被清掉)
const DEFAULTS = {
  model: 'gemini-3.8-flash-tts',
  voice: 'Sulafat',
  style: '台灣華語，語氣溫暖親切、咬字清楚，像老師在旁邊帶著學員一步一步操作，語速適中',
}
const KBPS = 48
const BUCKET = 'shuttle-voice'

// ---------- 參數與金鑰 ----------
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i < 0 ? undefined : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true
}
const die = (msg) => {
  console.error(`錯誤:${msg}`)
  process.exit(1)
}

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  for (const f of ['.env.local', '.env']) {
    const p = path.join(WEB, f)
    if (!fs.existsSync(p)) continue
    const m = fs.readFileSync(p, 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)
    if (m) return m[1].trim()
  }
  die('找不到 GEMINI_API_KEY:請在 web/.env.local 加一行 GEMINI_API_KEY=你的金鑰(Google AI Studio 取得)')
}

// ---------- Gemini TTS ----------
async function synthesize(text, { model, voice, style }, key) {
  const body = {
    model,
    input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style }] }] }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice }] },
  }
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 5) die(`TTS 失敗(${res.status}):${await res.text()}`)
      const wait = 2000 * 2 ** (attempt - 1)
      console.warn(`  ${res.status},${wait / 1000} 秒後重試…`)
      await new Promise((r) => setTimeout(r, wait))
      continue
    }
    const raw = await res.text()
    let json
    try {
      json = JSON.parse(raw)
    } catch {
      die(`TTS 回應不是 JSON(${res.status}):${raw.slice(0, 300)}`)
    }
    if (!res.ok) die(`TTS 失敗(${res.status}):${JSON.stringify(json.error ?? json).slice(0, 500)}`)
    const data = json.output_audio?.data ?? findAudio(json)
    if (!data) die(`回應裡沒有音訊:${JSON.stringify(json).slice(0, 500)}`)
    return Buffer.from(data, 'base64')
  }
}
/** 從 Interactions API 的回應找最後一段音訊(steps[].content[] 裡 type 為 audio 的 data) */
function findAudio(json) {
  let found
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') {
      if (v.type === 'audio' && typeof v.data === 'string') found = v.data
      Object.values(v).forEach(walk)
    }
  }
  walk(json)
  return found
}

// ---------- 音訊:WAV(或無標頭 PCM)→ MP3 ----------
function decodePcm(buf) {
  // 複製成獨立的 ArrayBuffer:Node 的小 Buffer 可能共用記憶體池,起點不一定對齊 2 位元組
  const int16 = (b) => new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + (b.length & ~1)))
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return { rate: 24000, pcm: int16(buf) }
  let rate = 24000, off = 12
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'fmt ') rate = buf.readUInt32LE(off + 12)
    if (id === 'data') {
      const data = buf.subarray(off + 8, off + 8 + Math.min(size, buf.length - off - 8))
      return { rate, pcm: int16(data) }
    }
    off += 8 + size + (size & 1)
  }
  die('看不懂回傳的 WAV')
}
function toMp3({ rate, pcm }) {
  const enc = new Mp3Encoder(1, rate, KBPS)
  const out = []
  for (let i = 0; i < pcm.length; i += 1152) out.push(Buffer.from(enc.encodeBuffer(pcm.subarray(i, i + 1152))))
  out.push(Buffer.from(enc.flush()))
  return Buffer.concat(out)
}

/** 上傳到 GCS(檔名是內容雜湊,內容不會變,所以設成永久快取) */
function upload(buf, object) {
  const tmp = path.join(os.tmpdir(), `voice-${process.pid}-${path.basename(object)}`)
  fs.writeFileSync(tmp, buf)
  try {
    const args = ['storage', 'cp', tmp, `gs://${BUCKET}/${object}`, '--cache-control=public, max-age=31536000, immutable', '--content-type=audio/mpeg', '--quiet']
    // Windows 的 gcloud 是 .cmd,要經過 shell 執行;含空白的參數要自己加引號
    const win = process.platform === 'win32'
    execFileSync('gcloud', win ? args.map((x) => (/[\s,]/.test(x) ? `"${x}"` : x)) : args, { stdio: ['ignore', 'ignore', 'pipe'], shell: win })
  } catch (e) {
    die(`上傳 gs://${BUCKET}/${object} 失敗(要先 gcloud auth login):${e.stderr?.toString() || e.message}`)
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}

const hashOf = (text, cfg) => createHash('sha1').update([cfg.model, cfg.voice, cfg.style, text].join('\n')).digest('hex').slice(0, 12)

// ---------- 試聽 ----------
async function sample() {
  const text = flag('sample')
  if (typeof text !== 'string') die('用法:npm run voice -- --sample "一句旁白" --voices Sulafat,Kore')
  const voices = String(flag('voices') || DEFAULTS.voice).split(',').map((v) => v.trim()).filter(Boolean)
  const key = apiKey()
  const dir = path.join(WEB, 'recordings/voice-samples')
  fs.mkdirSync(dir, { recursive: true })
  for (const voice of voices) {
    const audio = decodePcm(await synthesize(text, { ...DEFAULTS, voice }, key))
    const file = path.join(dir, `${voice}.mp3`)
    fs.writeFileSync(file, toMp3(audio))
    console.log(`${voice}:${(audio.pcm.length / audio.rate).toFixed(1)} 秒 → ${path.relative(WEB, file)}`)
  }
}

// ---------- 產生一份腳本的旁白 ----------
async function build(rel, key) {
  const scriptPath = path.join(LIVE, rel)
  if (!fs.existsSync(scriptPath)) die(`找不到腳本:src/content/live/${rel}`)
  const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'))
  let texts = [...new Set((script.steps || []).map((s) => s.narration).filter(Boolean))]
  // --max-sec:只取開頭幾段,累計估算長度(每秒約 4.2 字)到達上限為止;其他段落沿用舊音檔或維持只有字幕
  const maxSec = Number(flag('max-sec'))
  if (maxSec > 0) {
    let sec = 0
    texts = texts.filter((t) => (sec += [...t].length / 4.2) - [...t].length / 4.2 < maxSec)
  }
  const cfg = { ...DEFAULTS, ...(script.voice || {}) }
  const manifestPath = scriptPath.replace(/\.json$/, '.voice.json')
  const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { clips: {} }
  // GCS 上的路徑照腳本的資料夾(例如 l0/0.0-tools.json → l0/<hash>.mp3)
  const prefix = path.posix.dirname(rel.split(path.sep).join('/'))

  // 這次沒處理到的段落(--max-sec)保留原本的音檔
  const clips = maxSec > 0 ? { ...(old.clips || {}) } : {}
  let made = 0
  for (const [i, text] of texts.entries()) {
    const file = `${prefix}/${hashOf(text, cfg)}.mp3`
    const prev = old.clips?.[text]
    if (prev && prev.file === file) {
      clips[text] = prev
      continue
    }
    process.stdout.write(`  ${rel} 旁白 ${i + 1}/${texts.length}…
`)
    const audio = decodePcm(await synthesize(text, cfg, key))
    upload(toMp3(audio), file)
    clips[text] = { file, ms: Math.round((audio.pcm.length / audio.rate) * 1000) }
    made++
  }
  const manifest = { model: cfg.model, voice: cfg.voice, style: cfg.style, clips }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  const total = Object.values(clips).reduce((n, c) => n + c.ms, 0)
  console.log(`${rel}:${texts.length} 段旁白(新產生 ${made}),共 ${(total / 1000).toFixed(0)} 秒`)
}

async function main() {
  if (flag('sample')) return sample()
  const all = flag('all')
  const targets = all
    ? fs.readdirSync(LIVE, { recursive: true }).map(String).filter((f) => f.endsWith('.json') && !f.endsWith('.voice.json')).map((f) => f.split(path.sep).join('/'))
    : args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && ['max-sec', 'voices', 'sample'].includes(args[i - 1].slice(2))))
  if (!targets.length) die('用法:npm run voice -- l0/0.0-tools.json(或 --all、--sample)')
  const key = apiKey()
  for (const t of targets) await build(t, key)
}

await main()
