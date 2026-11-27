// levels.mjs — 每段旁白的音量:每 50ms 一個 0..9 的字元(RMS,以這份腳本所有音檔的第 97 百分位為滿格,gamma 0.8),
// 給左下角語音動畫用(src/live/voiceOrb.ts)。解碼用 ffmpeg。

import { spawnSync } from 'node:child_process'

const RATE = 8000
const FRAME = RATE / 20 // 50ms

export const hasFfmpeg = () => spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0

/** 單聲道 8 kHz PCM → 每 50ms 的 RMS */
export function rmsFrames(pcm) {
  const out = []
  for (let i = 0; i < pcm.length; i += FRAME) {
    const end = Math.min(i + FRAME, pcm.length)
    let sum = 0
    for (let k = i; k < end; k++) sum += pcm[k] * pcm[k]
    out.push(Math.sqrt(sum / (end - i)))
  }
  return out
}

function decode(audio) {
  const res = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-f', 's16le', '-ac', '1', '-ar', String(RATE), 'pipe:1'], { input: audio, maxBuffer: 256 * 1024 * 1024 })
  if (res.status !== 0 || !res.stdout?.length) throw new Error(`ffmpeg 解碼失敗:${res.stderr?.toString().slice(0, 200) ?? res.error?.message}`)
  const b = res.stdout
  return new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + (b.length & ~1)))
}

/** { 鍵: RMS 陣列 } → { 鍵: levels 字串 };滿格是全部格子的第 97 百分位 */
export function levelsOf(rms) {
  const all = Object.values(rms).flat().sort((a, b) => a - b)
  const top = all[Math.floor(all.length * 0.97)] || all.at(-1) || 1
  return Object.fromEntries(Object.entries(rms).map(([k, frames]) => [k, frames.map((v) => Math.floor(9 * Math.min(1, v / top) ** 0.8 + 0.5)).join('')]))
}

/**
 * 補上清單裡缺的 levels(已經有的不動),回傳新的 clips。audioOf(clip) 回傳這個音檔的 Buffer。
 * 滿格要看整份腳本的音量,所以只要有一段缺,所有音檔都會取一次。沒有 ffmpeg 或取不到音檔時只警告、原樣回傳。
 */
export async function addLevels(clips, audioOf, { warn = console.warn, ffmpeg = hasFfmpeg, decodePcm = decode } = {}) {
  const missing = Object.keys(clips).filter((t) => !clips[t].levels)
  if (!missing.length) return clips
  if (!ffmpeg()) {
    warn(`  找不到 ffmpeg:${missing.length} 段沒有算音量(levels),裝好後重跑就會補上`)
    return clips
  }
  const rms = {}
  for (const [text, clip] of Object.entries(clips)) {
    try {
      // 手動改短過的(ms 比音檔短)只算播得到的部分
      rms[text] = rmsFrames(decodePcm(await audioOf(clip))).slice(0, Math.ceil(clip.ms / 50))
    } catch (e) {
      warn(`  ${clip.file}:算不出音量(${e.message})`)
    }
  }
  const levels = levelsOf(rms)
  const out = { ...clips }
  for (const text of missing) if (levels[text]) out[text] = { ...clips[text], levels: levels[text] }
  return out
}
