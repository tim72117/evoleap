// 即時教學畫面的腳本:放在 src/content/live/,單課資料以 live: 'l0/0.0-tools.json' 指定(相對於 content/live/)。
// 各腳本分開打包,播到那一課才載入。
import type { StageScript } from './stage.js'

const SCRIPTS = import.meta.glob<StageScript>('../content/live/**/*.json', { import: 'default' })

/** 所有腳本的路徑(例如 l0/0.0-tools.json),給測試與預覽頁用 */
export const scriptPaths = Object.keys(SCRIPTS).map((k) => k.replace('../content/live/', ''))

export function loadScript(path: string): Promise<StageScript> {
  const load = SCRIPTS[`../content/live/${path}`]
  if (!load) return Promise.reject(new Error(`找不到即時教學畫面的腳本:${path}`))
  return load()
}

// 旁白語音(scripts/voice.mjs 產生):腳本旁的 <名稱>.voice.json 記錄每段旁白的音檔與長度,
// 音檔放在 GCS 的 shuttle-voice bucket(公開讀取、永久快取)。日後換成自己的網域時只改 VOICE_BASE。
const VOICE_BASE = 'https://storage.googleapis.com/shuttle-voice/'
type VoiceManifest = { model: string; voice: string; clips: Record<string, { file: string; ms: number }> }
const VOICES = import.meta.glob<VoiceManifest>('../content/live/**/*.voice.json', { import: 'default' })

export type ScriptVoice = {
  /** 旁白文字 → 語音長度(毫秒),給舞台排時間 */
  durations: Record<string, number>
  /** 旁白文字 → 音檔網址 */
  urls: Record<string, string>
}

/** 腳本的旁白語音;還沒產生時回傳 null(畫面照常播放,只有字幕) */
export async function loadVoice(path: string): Promise<ScriptVoice | null> {
  const key = `../content/live/${path.replace(/\.json$/, '.voice.json')}`
  const load = VOICES[key]
  if (!load) return null
  const manifest = await load()
  if (!manifest?.clips) return null
  const durations: Record<string, number> = {}
  const urls: Record<string, string> = {}
  for (const [text, clip] of Object.entries(manifest.clips)) {
    durations[text] = clip.ms
    urls[text] = VOICE_BASE + clip.file
  }
  return { durations, urls }
}
