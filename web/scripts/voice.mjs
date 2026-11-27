#!/usr/bin/env node
// voice.mjs — 用 Gemini TTS 產生即時教學畫面的旁白語音。
//
//   npm run voice -- l0/0.0-tools.json          產生(或補齊)這份腳本的旁白
//   npm run voice -- --all                      所有腳本
//   npm run voice -- l0/0.0-tools.json --max-sec 20   只產生開頭約 20 秒的旁白(試做用,依字數估算)
//   npm run voice -- l0/0.0-tools.json --limit 10     只產生前 10 段旁白(試做用)
//   npm run voice -- 腳本 --whole           整段一次錄再依停頓切句(連貫);腳本 voice.solo 列出的句子各自單獨錄(可跨影片復用)
//   npm run voice -- --sample "一句旁白" --voices Sulafat,Kore,Charon   試聽:各聲音念同一句,輸出到 recordings/voice-samples/
//   npm run voice -- --sample "一句旁白" --profile kids   用兒童版的語氣試聽(kids/ 底下的腳本自動用兒童版)
//   npm run voice -- --sample "一句旁白" --profile news   用科技新聞播報版試聽(科技新知、週報、快訊;腳本寫 "voice": { "profile": "news" } 套用)
//   npm run voice -- --sample "一句旁白" --profile showcase   用展示版試聽(行銷展示影片;腳本寫 "voice": { "profile": "showcase" } 套用)
//   npm run voice -- --batch web/1.1.json web/1.2.json   批次模式:缺的旁白整包送出(Gemini Batch API,約一半價格,24 小時內完成,通常快很多),
//                                                不用等;送出的批次記在 recordings/voice-batch.json(不進版控)。也可以 --all --batch
//   npm run voice -- --batch web/1.1.json --dry-run   只列出要送哪些段落與第一筆請求,不呼叫 API、不花錢
//   npm run voice -- --collect                   查批次跑完沒;跑完就下載音訊、轉 mp3、上傳,寫進各腳本的 .voice.json(之後和一般模式一樣)
//
// 腳本以線上資料庫為準(lib/liveScripts.mjs,透過 evoleap CLI 取得,先 evoleap login),每個 steps[] 的 narration 是一段旁白,
// 互動點的自動示範台詞(demoNarration)也是。
//   --api http://127.0.0.1:8190   改向別台伺服器取(預設 https://evoleap.io)
//   --dir 資料夾                   改讀本機資料夾(還沒上傳的草稿),清單寫在腳本旁邊
//   --push                         產生後把 .voice.json 上傳回伺服器(沿用腳本屬於哪一課);沒加只寫在本機並印出上傳指令
// 產生結果:
//   l0/0.0-tools.voice.json   旁白文字 → { file, ms, levels }(levels:每 50ms 音量 0..9,要 ffmpeg;沿用的音檔保留原值;舞台用 ms 排時間,課程頁播 file);暫存在 web/recordings/live/<主機>/
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
import { addLevels } from './lib/levels.mjs'
import { isManifest, normalizeRel, openSource, sourceArgs } from './lib/liveScripts.mjs'
import { isHandEdited, narrationLines, reusableClip } from './lib/narrationLines.mjs'

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 影片開頭的老師介紹(共用的招呼語),和網頁端 src/live/teacher.ts 讀同一份
const TEACHER = JSON.parse(fs.readFileSync(path.join(WEB, 'src/live/teacher.json'), 'utf8'))

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
// 科技新聞播報版(科技新知、週報、快訊):沉穩專業、清楚俐落,像科技頻道的主播;腳本頂層寫 "voice": { "profile": "news" } 套用,試聽用 --profile news
const NEWS = {
  ...DEFAULTS,
  style: '台灣華語，科技新聞播報：語氣沉穩專業、清楚俐落，像財經科技頻道的主播；節奏明快但不趕、句子之間停頓短，數字與專有名詞咬字特別清楚，重點詞稍微加重，句尾收得乾脆，不過度熱情也不拖長',
}
const PROFILES = { default: DEFAULTS, kids: KIDS, showcase: SHOWCASE, news: NEWS }
const isKidsPath = (rel) => rel.split(path.sep).join('/').startsWith('kids/')
/**
 * 腳本用哪一組設定:腳本的 voice.profile(default、kids、showcase、news)優先,沒寫時 kids/ 底下用兒童版、其他用預設;
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
// --api、--dir、--push 是腳本來源的共用旗標(lib/liveScripts.mjs),其餘是這支工具自己的
const common = sourceArgs(process.argv.slice(2))
const args = common.rest
let source = null
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

/** 已經產生過的音檔(算音量用):網站自己的檔、mix 的下載快取,都沒有才從公開網址下載 */
async function clipAudio(file) {
  if (file.startsWith('/')) return fs.readFileSync(path.join(WEB, 'public', file))
  const cached = path.join(WEB, 'recordings/mix/.cache', file.replace(/\//g, '_'))
  if (fs.existsSync(cached)) return fs.readFileSync(cached)
  const res = await fetch(`https://storage.googleapis.com/${BUCKET}/${file}`)
  if (!res.ok) throw new Error(`下載失敗 ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(path.dirname(cached), { recursive: true })
  fs.writeFileSync(cached, buf)
  return buf
}

// cfg.trim(腳本 voice 欄位寫 "trim": true):修掉每段語音頭尾的靜音,句和句之間不會有多餘的空檔。沒開的腳本雜湊不變(舊音檔照用)
const hashOf = (text, cfg) => createHash('sha1').update([cfg.model, cfg.voice, cfg.style, text, ...(cfg.trim ? ['trim'] : []), ...(cfg.take ? ['take'] : [])].join('\n')).digest('hex').slice(0, 12)

/** 去掉頭尾的靜音:每 20ms 一格,振幅低於門檻的視為靜音,頭尾各留 60ms 氣口 */
function trimSilence(pcm, rate) {
  const win = Math.round(rate * 0.02)
  const loud = (i) => {
    let m = 0
    for (let k = i; k < Math.min(i + win, pcm.length); k++) m = Math.max(m, Math.abs(pcm[k]))
    return m > 700
  }
  let a = 0
  while (a < pcm.length && !loud(a)) a += win
  let b = pcm.length
  while (b > a && !loud(b - win)) b -= win
  const keep = Math.round(rate * 0.06)
  return pcm.subarray(Math.max(0, a - keep), Math.min(pcm.length, b + keep))
}

/**
 * 整段一次錄(--whole):把所有旁白一次合成,語氣與節奏連貫,再依句間的靜音切回一句一個音檔(舞台仍用每句的長度排時間)。
 * 每個切點從「句間靜音」裡挑:依字數推算這個切點大約在整段的哪裡,取離它最近的靜音(≥ 120ms),並且要照順序。
 * 回傳每句的 pcm(已修掉頭尾靜音)。
 */
function splitTake(pcm, rate, texts, prior = []) {
  const win = Math.round(rate * 0.02)
  const frames = Math.floor(pcm.length / win)
  const quiet = new Array(frames).fill(false)
  for (let f = 0; f < frames; f++) {
    let m = 0
    for (let k = f * win; k < (f + 1) * win; k++) m = Math.max(m, Math.abs(pcm[k]))
    quiet[f] = m <= 700
  }
  // 找出首尾有聲音的範圍與中間的靜音區間
  let a = 0
  while (a < frames && quiet[a]) a++
  let b = frames
  while (b > a && quiet[b - 1]) b--
  const gaps = []
  for (let f = a; f < b; ) {
    if (!quiet[f]) { f++; continue }
    let g = f
    while (g < b && quiet[g]) g++
    if ((g - f) * 20 >= 120) gaps.push({ from: f, to: g, mid: (f + g) / 2, len: (g - f) * 20 })
    f = g
  }
  // 每句的預期長度:有逐句合成的舊長度就用它(最準),沒有就用字數
  const chars = texts.map((t, i) => prior[i] || [...t.replace(/[\s，。、：；？！,.?!:;「」]/g, '')].length)
  const total = chars.reduce((n, c) => n + c, 0)
  // 動態規劃:挑 n-1 個停頓當切點,讓每一句的長度盡量符合字數比例(每個字約佔 rate 毫秒),同時偏好較長的停頓(句號比逗號停得久)
  const n = texts.length
  const perChar = ((b - a) * 20) / total
  const G = gaps.length
  if (G < n - 1) die(`整段一次錄:只找到 ${G} 個停頓,不夠切成 ${n} 句,請改用逐句合成`)
  const segCost = (i, from, to) => (((to - from) * 20 - perChar * chars[i]) / (perChar * Math.max(chars[i], 1))) ** 2
  const INF = 1e18
  // best[i][g]:前 i+1 句,第 i 句結束在第 g 個停頓
  const best = Array.from({ length: n - 1 }, () => new Array(G).fill(INF))
  const prev = Array.from({ length: n - 1 }, () => new Array(G).fill(-1))
  const bonus = (g) => Math.min(gaps[g].len, 400) / 400
  for (let g = 0; g < G; g++) best[0][g] = segCost(0, a, gaps[g].from) - 0.6 * bonus(g)
  for (let i = 1; i < n - 1; i++)
    for (let g = i; g < G; g++)
      for (let h = i - 1; h < g; h++) {
        if (best[i - 1][h] >= INF) continue
        const c = best[i - 1][h] + segCost(i, gaps[h].to, gaps[g].from) - 0.6 * bonus(g)
        if (c < best[i][g]) { best[i][g] = c; prev[i][g] = h }
      }
  let end = -1
  let endCost = INF
  for (let g = n - 2; g < G; g++) {
    const c = best[n - 2][g] + segCost(n - 1, gaps[g].to, b)
    if (c < endCost) { endCost = c; end = g }
  }
  const cuts = []
  for (let i = n - 2, g = end; i >= 0; i--) { cuts.unshift(gaps[g]); g = prev[i][g] }
  const keep = Math.round(rate * 0.06)
  const out = []
  let from = a
  for (let i = 0; i < texts.length; i++) {
    const to = i < cuts.length ? cuts[i].from : b
    const next = i < cuts.length ? cuts[i].to : b
    out.push(pcm.subarray(Math.max(0, from * win - keep), Math.min(pcm.length, to * win + keep)))
    from = next
  }
  console.log('  切點(句間停頓毫秒):' + cuts.map((c) => c.len).join('、'))
  return out
}

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
  const script = await source.json(rel)
  // 要有語音的句子:老師開場、步驟旁白、互動點的回應與示範、示範台詞(規則在 lib/narrationLines.mjs)
  let texts = narrationLines(script, { kids: isKidsPath(rel), teacher: TEACHER })
  // --max-sec:只取開頭幾段,累計估算長度(每秒約 4.2 字)到達上限為止;其他段落沿用舊音檔或維持只有字幕
  const maxSec = Number(flag('max-sec'))
  if (maxSec > 0) {
    let sec = 0
    texts = texts.filter((t) => (sec += [...t].length / 4.2) - [...t].length / 4.2 < maxSec)
  }
  const limit = Number(flag('limit'))
  if (limit > 0) texts = texts.slice(0, limit)
  const cfg = configOf(rel, script)
  // 角色自己的聲音:腳本 voice.speakers 寫 { "<演員代號>": { "voice": "…", "style": "…" } },那位演員的 say 台詞用這組聲音另外錄
  // (舞台在台詞那一步播,見 live/stage.ts 的 lineOf);只有一位演員時 say 不用寫 on
  const lineCfg = new Map()
  const speakers = script.voice?.speakers || {}
  const castIds = Object.keys(script.cast || {})
  const narrationTexts = new Set(texts)
  for (const [i, s] of (script.steps || []).entries()) {
    if (typeof s.say !== 'string' || !Object.keys(speakers).length) continue
    // 沒寫 on 又有好幾位演員時猜不出是誰說的:要求寫 on,不默默略過
    if (!s.on && castIds.length > 1) die(`${rel} 第 ${i + 1} 步:有角色配音(voice.speakers)時,say 要寫 on 指定是誰說的`)
    const who = s.on ?? castIds[0]
    if (!speakers[who]) continue
    if (s.narration) die(`${rel} 第 ${i + 1} 步:角色台詞有配音時,同一步不能再寫 narration(兩段聲音會疊在一起),把旁白移到前後另一步`)
    // 音檔以文字對應,和旁白同一句話時分不出是誰念的
    if (narrationTexts.has(s.say)) die(`${rel} 第 ${i + 1} 步:台詞「${s.say}」和某段旁白的文字一樣,請改其中一句`)
    lineCfg.set(s.say, { ...cfg, ...speakers[who] })
  }
  if (!maxSec && !limit) for (const line of lineCfg.keys()) if (!texts.includes(line)) texts.push(line)
  const cfgFor = (text) => lineCfg.get(text) ?? cfg
  const manifestRel = rel.replace(/\.json$/, '.voice.json')
  // 上次產生了還沒上傳的清單(pending)也算快取,免得重跑時重新合成、重複計費
  const remote = await source.json(manifestRel)
  const pending = source.pending(manifestRel)
  const header = pending ?? remote
  const old = { clips: { ...remote?.clips, ...pending?.clips } }
  // GCS 上的路徑照腳本的資料夾(例如 l0/0.0-tools.json → l0/<hash>.mp3)
  const prefix = path.posix.dirname(rel.split(path.sep).join('/'))

  // 這次沒處理到的段落(--max-sec、--limit)保留原本的音檔
  const clips = maxSec > 0 || limit > 0 ? { ...(old.clips || {}) } : {}
  // 每產生一段就寫一次清單:中途失敗(額度、網路)時已完成的段落不會遺失,重跑會從斷點接續、不重複計費
  // 同一個資料夾的其他腳本已經產生過的同一段(例如每支影片共用的老師招呼語):音檔名由文字與語音設定決定,
  // 直接沿用那份音檔與長度,不要重新合成(重新合成會用同一個檔名覆蓋雲端的音檔,其他腳本記錄的長度就對不上了)
  const shared = {}
  for (const name of await source.paths()) {
    if (!name.endsWith('.voice.json') || path.posix.dirname(name) !== prefix || name === manifestRel) continue
    const clipsOf = { ...(await source.json(name))?.clips, ...source.pending(name)?.clips }
    for (const c of Object.values(clipsOf)) shared[c.file] = c
  }
  const cachedOf = (text) => {
    const file = `${prefix}/${hashOf(text, cfgFor(text))}.mp3`
    // 角色台詞的聲音另外設定,清單頂層看不出有沒有改過,不認手動項目
    const edited = (clip) => {
      const c = cfgFor(text)
      const ownFiles = [false, true].flatMap((trim) => [false, true].map((take) => `${prefix}/${hashOf(text, { ...c, trim, take })}.mp3`))
      return !lineCfg.has(text) && isHandEdited(clip, { manifest: header, cfg: c, prefix, ownFiles })
    }
    return reusableClip(text, file, old.clips, shared, edited)
  }
  // 還沒輪到的段落先帶著原本的快取寫進去:中途失敗時清單不會缺段,已上傳的音檔重跑也不會重複合成
  const save = () => {
    const merged = { ...clips }
    for (const text of texts) if (!merged[text] && cachedOf(text)) merged[text] = cachedOf(text)
    source.write(manifestRel, { model: cfg.model, voice: cfg.voice, style: cfg.style, clips: merged })
    return merged
  }
  // 這次新產生的音檔(算音量用,不必再下載)
  const fresh = new Map()
  const put = (mp3, file) => {
    upload(mp3, file)
    fresh.set(file, mp3)
  }
  const withLevels = (all) => addLevels(all, (clip) => fresh.get(clip.file) ?? clipAudio(clip.file))
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
  if (flag('whole')) {
    // voice.solo:這幾句不放進整段一次錄,各自單獨錄成一個音檔(例如每支宣傳片結尾的「追蹤粉絲團」,雜湊不含 take,別支影片念同一句可直接沿用)
    const solo = new Set(script.voice?.solo || [])
    const group = texts.filter((t) => !solo.has(t))
    const cfgT = { ...cfg, take: true }
    const raw = await audio(group.map((t) => t.replace(/[，,]$/, '。')).join('\n\n'), cfgT, `${prefix}/whole.mp3`)
    const pcm = decodePcm(raw)
    const parts = splitTake(pcm.pcm, pcm.rate, group, group.map((t) => (old.clips?.[t]?.ms ?? 0)))
    group.forEach((text, i) => {
      // 整段錄每次的切法與聲音都不同,但檔名只由文字與設定決定:同名覆蓋會被瀏覽器的長期快取(immutable)吃掉,聽到舊的(切到一半的)版本。
      // 檔名加上音檔內容的雜湊,每次產生的結果都是新網址
      const mp3 = toMp3({ pcm: parts[i], rate: pcm.rate })
      const file = `${prefix}/${hashOf(text, cfgT)}-${createHash('sha1').update(mp3).digest('hex').slice(0, 8)}.mp3`
      put(mp3, file)
      clips[text] = { file, ms: Math.round((parts[i].length / pcm.rate) * 1000) }
      console.log(`  ${(clips[text].ms / 1000).toFixed(2)} 秒  ${text.slice(0, 20)}`)
    })
    for (const text of texts.filter((t) => solo.has(t))) {
      const prev = cachedOf(text)
      if (prev) {
        clips[text] = prev
        console.log(`  ${(prev.ms / 1000).toFixed(2)} 秒  ${text.slice(0, 20)}(單獨錄,沿用)`)
        continue
      }
      const file = `${prefix}/${hashOf(text, cfg)}.mp3`
      const one = decodePcm(await audio(text, cfg, file))
      if (cfg.trim) one.pcm = trimSilence(one.pcm, one.rate)
      put(toMp3(one), file)
      clips[text] = { file, ms: Math.round((one.pcm.length / one.rate) * 1000) }
      console.log(`  ${(clips[text].ms / 1000).toFixed(2)} 秒  ${text.slice(0, 20)}(單獨錄)`)
    }
    source.write(manifestRel, { model: cfg.model, voice: cfg.voice, style: cfg.style, take: true, clips: await withLevels(clips) })
    console.log(`${rel}:整段一次錄 ${group.length} 句、單獨錄 ${texts.length - group.length} 句,共 ${(Object.values(clips).reduce((n, c) => n + c.ms, 0) / 1000).toFixed(0)} 秒`)
    await source.publish(manifestRel, common.push)
    return
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
    const c = cfgFor(text)
    const file = `${prefix}/${hashOf(text, c)}.mp3`
    const raw = await audio(text, c, file)
    if (!raw) continue
    const pcm = decodePcm(raw)
    if (c.trim) pcm.pcm = trimSilence(pcm.pcm, pcm.rate)
    put(toMp3(pcm), file)
    clips[text] = { file, ms: Math.round((pcm.pcm.length / pcm.rate) * 1000) }
    made++
    save()
    progress(made)
  }
  if (plan) {
    const dropped = Object.keys(old.clips).filter((t) => !texts.includes(t) && !maxSec && !limit)
    console.log(`${rel}:收集到 ${texts.length} 句、沿用 ${texts.length - todo}、缺 ${todo}、清單會移除 ${dropped.length}`)
    dropped.forEach((t) => console.log(`  移除:${t}`))
    for (const t of texts) {
      const clip = cachedOf(t)
      if (clip && clip.file !== `${prefix}/${hashOf(t, cfgFor(t))}.mp3`) console.log(`  沿用手動調整過的音檔(要重錄就從清單刪掉這一項):${clip.file} ${clip.ms}ms ${t}`)
    }
    return
  }
  source.write(manifestRel, { model: cfg.model, voice: cfg.voice, style: cfg.style, clips: await withLevels(save()) })
  const total = Object.values(clips).reduce((n, c) => n + c.ms, 0)
  console.log(`${rel}:${texts.length} 段旁白(新產生 ${made}),共 ${(total / 1000).toFixed(0)} 秒`)
  await source.publish(manifestRel, common.push)
}

async function main() {
  if (flag('sample')) return sample()
  if (flag('collect')) return collectBatch(apiKey())
  source = openSource(common)
  const named = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && ['max-sec', 'limit', 'voices', 'sample'].includes(args[i - 1].slice(2))))
  const targets = flag('all') ? (await source.paths()).filter((f) => !isManifest(f)) : named.map(normalizeRel)
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
  fs.writeFileSync(BATCH_FILE, JSON.stringify({ name, model, created: new Date().toISOString(), api: source.server, dir: source.root ?? undefined, targets, items: [...items.values()].map(({ key, text, targets: t }) => ({ key, text, targets: t })) }, null, 2) + '\n')
  console.log(`送出 ${items.size} 段旁白(${targets.length} 份腳本),批次 ${name}。之後跑 npm run voice -- --collect 收結果`)
}

async function collectBatch(key) {
  if (!fs.existsSync(BATCH_FILE)) die('沒有送出中的批次(recordings/voice-batch.json)')
  const saved = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf8'))
  // 結果寫回送出時的腳本來源;這次另外指定了不一樣的就停下來
  if (common.api && saved.api && common.api.replace(/\/+$/, '') !== saved.api) die(`這一批是從 ${saved.api} 送出的,和 --api 不同`)
  if (common.dir && path.resolve(common.dir) !== saved.dir) die(`這一批是從 ${saved.dir ?? saved.api} 送出的,和 --dir 不同`)
  source = openSource({ api: saved.api, dir: saved.dir })
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

await main().catch((e) => die(e.message))
