#!/usr/bin/env node
// voice.mjs — 用 Gemini TTS 產生即時教學畫面的旁白語音。
//
//   npm run voice -- l0/0.0-tools.json          產生(或補齊)這份腳本的旁白
//   npm run voice -- --all                      所有腳本
//   npm run voice -- l0/0.0-tools.json --max-sec 20   只產生開頭約 20 秒的旁白(試做用,依字數估算)
//   npm run voice -- l0/0.0-tools.json --limit 10     只產生前 10 段旁白(試做用)
//   npm run voice -- --sample "一句旁白" --voices Sulafat,Kore,Charon   試聽:各聲音念同一句,輸出到 recordings/voice-samples/
//   npm run voice -- --sample "一句旁白" --profile kids   用兒童版的語氣試聽(kids/ 底下的腳本自動用兒童版)
//   npm run voice -- --sample "一句旁白" --profile showcase   用展示版試聽(行銷展示影片;腳本寫 "voice": { "profile": "showcase" } 套用)
//   npm run voice -- --batch web/1.1.json web/1.2.json   批次模式:缺的旁白整包送出(Gemini Batch API,約一半價格,24 小時內完成,通常快很多),
//                                                不用等;送出的批次記在 recordings/voice-batch.json(不進版控)。也可以 --all --batch
//   npm run voice -- --batch web/1.1.json --dry-run   只列出要送哪些段落與第一筆請求,不呼叫 API、不花錢
//   npm run voice -- --collect                   查批次跑完沒;跑完就下載音訊、轉 mp3、上傳,寫進各腳本的 .voice.json(之後和一般模式一樣)
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
// 影片開頭的老師介紹(共用的招呼語),和網頁端 src/live/teacher.ts 讀同一份
const TEACHER = JSON.parse(fs.readFileSync(path.join(WEB, 'src/live/teacher.json'), 'utf8'))
const LIVE = path.join(WEB, 'src/content/live')

// 預設設定(之後要換聲音或語氣,改這裡再重跑;舊音檔會被清掉)
const DEFAULTS = {
  model: 'gemini-3.8-flash-tts',
  voice: 'Sulafat',
  style: '台灣華語，語氣溫暖親切、咬字清楚，像老師在旁邊帶著學員一步一步操作，語速適中',
}
// 兒童版(src/content/live/kids/ 底下的腳本)的語音設定:對 9 歲孩子說話,活潑一點。試聽用 --profile kids
const KIDS = {
  ...DEFAULTS,
  style: '台灣華語，對 9 歲的小朋友說話：活潑、有精神，帶著好奇和驚喜，像親切的大哥哥大姊姊陪著一起玩；句子短、咬字清楚，語速比平常稍快但不趕，說到「哇」「看看」這種驚喜的地方語氣上揚',
}
// 展示版(行銷展示影片、/showcase、宣傳片):明亮有活力、節奏俐落,像在介紹讓人期待的新東西。
// 腳本頂層寫 "voice": { "profile": "showcase" } 套用;試聽用 --profile showcase
const SHOWCASE = {
  ...DEFAULTS,
  voice: 'Zephyr',
  style: '台灣華語，行銷展示影片的旁白：明亮、有自信、有活力，像在介紹一個讓人期待的新東西；咬字清楚、節奏明快緊湊，語速比一般說話快、句子之間停頓短，但不急促，重點詞稍微加重，句尾帶著笑意、讓人想試試看',
}
const PROFILES = { default: DEFAULTS, kids: KIDS, showcase: SHOWCASE }
const isKidsPath = (rel) => rel.split(path.sep).join('/').startsWith('kids/')
/**
 * 腳本用哪一組設定:腳本的 voice.profile(default、kids、showcase)優先,沒寫時 kids/ 底下用兒童版、其他用預設;
 * 腳本 voice 欄位的其他鍵(voice、style、model)再覆寫
 */
function configOf(rel, script) {
  const { profile, ...over } = script.voice || {}
  if (profile !== undefined && !PROFILES[profile]) die(`${rel}:voice.profile 只能是 ${Object.keys(PROFILES).join('、')}`)
  return { ...(PROFILES[profile] ?? (isKidsPath(rel) ? KIDS : DEFAULTS)), ...over }
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
      // generateContent(批次模式)的回應:candidates[].content.parts[].inlineData.data
      const inline = v.inlineData ?? v.inline_data
      if (inline && typeof inline.data === 'string') found = inline.data
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
  const name = flag('profile')
  if (name !== undefined && !PROFILES[name]) die(`--profile 只能是 ${Object.keys(PROFILES).join('、')}`)
  const base = PROFILES[name] ?? DEFAULTS
  const voices = String(flag('voices') || base.voice).split(',').map((v) => v.trim()).filter(Boolean)
  const key = apiKey()
  const dir = path.join(WEB, 'recordings/voice-samples')
  fs.mkdirSync(dir, { recursive: true })
  for (const voice of voices) {
    const audio = decodePcm(await synthesize(text, { ...base, voice }, key))
    const file = path.join(dir, `${voice}.mp3`)
    fs.writeFileSync(file, toMp3(audio))
    console.log(`${voice}:${(audio.pcm.length / audio.rate).toFixed(1)} 秒 → ${path.relative(WEB, file)}`)
  }
}

// ---------- 產生一份腳本的旁白 ----------
/**
 * 產生一份腳本的旁白。audio(text, cfg, file) 回傳這段的音訊(WAV 或 PCM 的 Buffer);回傳 null 表示這次沒有(略過,維持只有字幕)。
 * 一般模式即時呼叫 TTS;批次模式送出時只記下要產生哪些(plan),收結果時從批次的結果拿(collect)
 */
async function build(rel, audio) {
  const scriptPath = path.join(LIVE, rel)
  if (!fs.existsSync(scriptPath)) die(`找不到腳本:src/content/live/${rel}`)
  const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'))
  // 兒童版的互動寫在步驟裡面(互動點的 options[].steps、子腳本的 interact.spots / done),也要有語音:整份腳本往下找所有 narration;
  // 其他腳本取最外層的步驟,加上互動點的選項回應與示範
  // 兒童版播放器停下來等孩子點時也會念題目:有選項的互動點標題(checkpoint)與子腳本的 interact.prompt 也要有語音;
  // 拖曳完成任務時念的話(interact.drag 的 say、else)也是
  const deepNarrations = (v, out = []) => {
    if (Array.isArray(v)) v.forEach((x) => deepNarrations(x, out))
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (typeof x === 'string' && (k === 'narration' || k === 'prompt' || (k === 'checkpoint' && v.options))) out.push(x)
        // 子腳本拖曳(interact.drag)完成任務時念的話(say:任務 → 旁白)與沒完成新任務時念的話(else)
        else if (k === 'say' && x && typeof x === 'object' && !Array.isArray(x)) out.push(...Object.values(x).filter((s) => typeof s === 'string'))
        else if (k === 'else' && typeof x === 'string') out.push(x)
        else deepNarrations(x, out)
      }
    return out
  }
  // 腳本頂層的 teacher:開頭的老師介紹(src/live/teacher.ts 展開),共用的招呼語與這一課的一句也要有語音
  const intro = script.teacher ? [script.teacher.greeting ?? TEACHER.greeting, script.teacher.line] : []
  // 互動點(有 id 的 checkpoint)的選項回應與示範(skip,學員沒回答直接播放時也會演)也要有語音;自己打字的回應(free)內容不固定,不產生
  const topLevel = (steps) =>
    (steps || []).flatMap((s) => [s.narration, ...(s.id && s.checkpoint ? [...(s.options || []).flatMap((o) => (o.steps || []).map((x) => x.narration)), ...(s.skip?.steps || []).map((x) => x.narration)] : [])])
  const all = [...intro, ...(isKidsPath(rel) ? deepNarrations({ steps: script.steps, interact: script.interact }) : topLevel(script.steps))]
  let texts = [...new Set(all.filter(Boolean))]
  // --max-sec:只取開頭幾段,累計估算長度(每秒約 4.2 字)到達上限為止;其他段落沿用舊音檔或維持只有字幕
  const maxSec = Number(flag('max-sec'))
  if (maxSec > 0) {
    let sec = 0
    texts = texts.filter((t) => (sec += [...t].length / 4.2) - [...t].length / 4.2 < maxSec)
  }
  const limit = Number(flag('limit'))
  if (limit > 0) texts = texts.slice(0, limit)
  const cfg = configOf(rel, script)
  const manifestPath = scriptPath.replace(/\.json$/, '.voice.json')
  const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { clips: {} }
  // GCS 上的路徑照腳本的資料夾(例如 l0/0.0-tools.json → l0/<hash>.mp3)
  const prefix = path.posix.dirname(rel.split(path.sep).join('/'))

  // 這次沒處理到的段落(--max-sec、--limit)保留原本的音檔
  const clips = maxSec > 0 || limit > 0 ? { ...(old.clips || {}) } : {}
  // 每產生一段就寫一次清單:中途失敗(額度、網路)時已完成的段落不會遺失,重跑會從斷點接續、不重複計費
  // 同一個資料夾的其他腳本已經產生過的同一段(例如每支影片共用的老師招呼語):音檔名由文字與語音設定決定,
  // 直接沿用那份音檔與長度,不要重新合成(重新合成會用同一個檔名覆蓋雲端的音檔,其他腳本記錄的長度就對不上了)
  const shared = {}
  for (const name of fs.readdirSync(path.dirname(scriptPath))) {
    if (!name.endsWith('.voice.json') || path.join(path.dirname(scriptPath), name) === manifestPath) continue
    const other = JSON.parse(fs.readFileSync(path.join(path.dirname(scriptPath), name), 'utf8'))
    for (const c of Object.values(other.clips || {})) shared[c.file] = c
  }
  const cachedOf = (text) => {
    const file = `${prefix}/${hashOf(text, cfg)}.mp3`
    const prev = old.clips?.[text]
    return prev && prev.file === file ? prev : shared[file]
  }
  // 還沒輪到的段落先帶著原本的快取寫進去:中途失敗時清單不會缺段,已上傳的音檔重跑也不會重複合成
  const save = () => {
    const merged = { ...clips }
    for (const text of texts) if (!merged[text] && cachedOf(text)) merged[text] = cachedOf(text)
    fs.writeFileSync(manifestPath, JSON.stringify({ model: cfg.model, voice: cfg.voice, style: cfg.style, clips: merged }, null, 2) + '\n')
  }
  const todo = texts.filter((t) => !cachedOf(t)).length
  // 進度條:只算這次要新產生的段落(已有快取的略過);終端機上原地更新,非終端機(log)每段一行
  const started = Date.now()
  const progress = (done) => {
    const w = 24
    const filled = todo ? Math.round((done / todo) * w) : w
    const eta = done ? Math.round(((Date.now() - started) / done) * (todo - done) / 1000) : null
    const line = `  ${rel} [${'█'.repeat(filled)}${'░'.repeat(w - filled)}] ${done}/${todo}${eta == null ? '' : done < todo ? ` 預估剩 ${eta} 秒` : ''}`
    process.stdout.write(process.stdout.isTTY ? `\r${line}\x1b[K${done >= todo ? '\n' : ''}` : `${line}\n`)
  }
  let made = 0
  // 批次模式送出時(plan):只記下缺的段落,不畫進度、不寫清單
  const plan = !!audio.plan
  if (todo && !plan) progress(0)
  for (const text of texts) {
    const prev = cachedOf(text)
    if (prev) {
      clips[text] = prev
      continue
    }
    const file = `${prefix}/${hashOf(text, cfg)}.mp3`
    const raw = await audio(text, cfg, file)
    if (!raw) continue
    const pcm = decodePcm(raw)
    upload(toMp3(pcm), file)
    clips[text] = { file, ms: Math.round((pcm.pcm.length / pcm.rate) * 1000) }
    made++
    save()
    progress(made)
  }
  if (plan) return
  save()
  const total = Object.values(clips).reduce((n, c) => n + c.ms, 0)
  console.log(`${rel}:${texts.length} 段旁白(新產生 ${made}),共 ${(total / 1000).toFixed(0)} 秒`)
}

async function main() {
  if (flag('sample')) return sample()
  if (flag('collect')) return collectBatch(apiKey())
  const all = flag('all')
  const targets = all
    ? fs.readdirSync(LIVE, { recursive: true }).map(String).filter((f) => f.endsWith('.json') && !f.endsWith('.voice.json') && !f.endsWith('.mix.json')).map((f) => f.split(path.sep).join('/'))
    : args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && ['max-sec', 'limit', 'voices', 'sample'].includes(args[i - 1].slice(2))))
  if (!targets.length) die('用法:npm run voice -- l0/0.0-tools.json(或 --all、--sample)')
  if (flag('batch') && flag('dry-run')) return submitBatch(targets, null)
  const key = apiKey()
  if (flag('batch')) return submitBatch(targets, key)
  for (const t of targets) await build(t, (text, cfg) => synthesize(text, cfg, key))
}

// ---------- 批次模式(Gemini Batch API) ----------
const BATCH_FILE = path.join(WEB, 'recordings/voice-batch.json')
const API = 'https://generativelanguage.googleapis.com/v1beta'

async function api(method, url, key, body) {
  const res = await fetch(url, { method, headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
  const raw = await res.text()
  let json
  try {
    json = JSON.parse(raw)
  } catch {
    die(`批次 API 回應不是 JSON(${res.status}):${raw.slice(0, 300)}`)
  }
  if (!res.ok) die(`批次 API 失敗(${res.status}):${JSON.stringify(json.error ?? json).slice(0, 800)}`)
  return json
}

/** 一段旁白的 generateContent 請求(批次只支援 generateContent):語氣放在 part 的 speech_metadata,不放進要念的文字 */
const ttsRequest = (text, cfg) => ({
  contents: [{ role: 'user', parts: [{ text, speech_metadata: { style: cfg.style } }] }],
  generation_config: { response_modalities: ['AUDIO'], speech_config: { voice_config: { prebuilt_voice_config: { voice_name: cfg.voice } } } },
})

async function submitBatch(targets, key) {
  if (fs.existsSync(BATCH_FILE)) die(`已經有一批還沒收:${path.relative(WEB, BATCH_FILE)}。先 npm run voice -- --collect,收完再送新的`)
  // 照一般模式的流程走一遍,只記下缺的段落(同一個音檔只送一次,例如共用的老師招呼語)
  const items = new Map()
  for (const t of targets) {
    const note = (text, cfg, file) => {
      if (!items.has(file)) items.set(file, { key: file, text, cfg, targets: [] })
      if (!items.get(file).targets.includes(t)) items.get(file).targets.push(t)
      return null
    }
    note.plan = true
    await build(t, note)
  }
  if (!items.size) return console.log('沒有缺的旁白,不用送出')
  const models = new Set([...items.values()].map((x) => x.cfg.model))
  if (models.size > 1) die(`一批只能用同一個模型(這次有 ${[...models].join('、')}),請分開送`)
  const model = [...models][0]
  // --dry-run:只列出要送的段落與第一筆請求,不呼叫 API、不花錢
  if (flag('dry-run')) {
    for (const x of items.values()) console.log(`  ${x.key}  ${x.targets.join('、')}  ${x.text.slice(0, 30)}`)
    console.log(`共 ${items.size} 段、${[...items.values()].reduce((n, x) => n + [...x.text].length, 0)} 字,模型 ${model}。第一筆請求:`)
    return console.log(JSON.stringify({ request: ttsRequest(items.values().next().value.text, items.values().next().value.cfg), metadata: { key: items.values().next().value.key } }, null, 2))
  }
  const batch = await api('POST', `${API}/models/${model}:batchGenerateContent`, key, {
    batch: {
      display_name: `voice-${new Date().toISOString().slice(0, 16)}`,
      input_config: { requests: { requests: [...items.values()].map((x) => ({ request: ttsRequest(x.text, x.cfg), metadata: { key: x.key } })) } },
    },
  })
  const name = batch.name ?? batch.metadata?.name
  if (!name) die(`送出了,但回應裡找不到批次名稱:${JSON.stringify(batch).slice(0, 500)}`)
  fs.mkdirSync(path.dirname(BATCH_FILE), { recursive: true })
  fs.writeFileSync(BATCH_FILE, JSON.stringify({ name, model, created: new Date().toISOString(), targets, items: [...items.values()].map(({ key, text, targets: t }) => ({ key, text, targets: t })) }, null, 2) + '\n')
  console.log(`送出 ${items.size} 段旁白(${targets.length} 份腳本),批次 ${name}。之後跑 npm run voice -- --collect 收結果`)
}

async function collectBatch(key) {
  if (!fs.existsSync(BATCH_FILE)) die('沒有送出中的批次(recordings/voice-batch.json)')
  const saved = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf8'))
  const job = await api('GET', `${API}/${saved.name}`, key)
  const state = String(job.metadata?.state ?? job.state ?? '')
  if (!/SUCCEEDED/.test(state)) {
    if (/FAILED|CANCELLED|EXPIRED/.test(state)) {
      fs.rmSync(BATCH_FILE)
      die(`批次 ${saved.name} 沒有完成(${state}):${JSON.stringify(job.error ?? job.metadata?.error ?? '').slice(0, 500)}。紀錄已清掉,可以重新送出`)
    }
    return console.log(`批次 ${saved.name} 還在處理(${state || '狀態不明'}),送出於 ${saved.created}。晚點再跑一次 --collect`)
  }
  // 結果的位置在不同版本的回應裡不太一樣:response 或 dest 底下的 inlinedResponses(可能再包一層)
  const box = job.response ?? job.metadata?.output ?? job.dest ?? {}
  const list = box.inlinedResponses?.inlinedResponses ?? box.inlinedResponses ?? box.inlined_responses ?? []
  if (!Array.isArray(list) || !list.length) die(`批次完成了,但找不到結果:${JSON.stringify(job).slice(0, 800)}`)
  const audio = new Map()
  const failed = []
  list.forEach((x, i) => {
    // 每筆結果帶著送出時的 key;沒有的話照送出的順序對回去
    const k = x.metadata?.key ?? x.key ?? saved.items[i]?.key
    const data = x.response ? findAudio(x.response) : null
    if (data) audio.set(k, Buffer.from(data, 'base64'))
    else failed.push(`${k}:${JSON.stringify(x.error ?? x).slice(0, 200)}`)
  })
  for (const t of [...new Set(saved.items.flatMap((x) => x.targets))]) await build(t, (_text, _cfg, file) => audio.get(file) ?? null)
  fs.rmSync(BATCH_FILE)
  console.log(`收到 ${audio.size} 段${failed.length ? `,${failed.length} 段失敗(之後重送一次就會補上):\n  ${failed.join('\n  ')}` : ''}`)
}

await main()
