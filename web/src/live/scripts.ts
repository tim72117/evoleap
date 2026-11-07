// 即時教學畫面的腳本:放在 src/content/live/,單課資料以 live: 'l0/0.0-tools.json' 指定(相對於 content/live/)。
// 各腳本分開打包,播到那一課才載入。
import type { MixChapter } from './mixPlan'
import type { StageScript } from './stage'
import { withTeacher } from './teacher'

// lab/ 與 promo/ 只有研發基地用,由 studio/StudioApp 註冊,不打包進公開的 JS。
type Loaders = Record<string, () => Promise<unknown>>
const SCRIPTS = import.meta.glob(
  ['../content/live/**/*.json', '!../content/live/lab/**', '!../content/live/promo/**'],
  { import: 'default' },
) as Loaders

/** 加入內部的腳本;key 的寫法與這裡相同(../content/live/…) */
export function registerScripts(loaders: Loaders) {
  Object.assign(SCRIPTS, loaders)
}

/** 目前可用的腳本路徑(例如 l0/0.0-tools.json) */
export const scriptPaths = () => Object.keys(SCRIPTS).map((k) => k.replace('../content/live/', ''))

export function loadScript(path: string): Promise<StageScript> {
  const load = SCRIPTS[`../content/live/${path}`]
  if (!load) return Promise.reject(new Error(`找不到即時教學畫面的腳本:${path}`))
  // 腳本有 teacher 時在這裡展開成開頭的老師介紹,之後的程式(互動點、舞台、章節音軌)看到的都是展開後的腳本
  return (load() as Promise<StageScript>).then(withTeacher)
}

// 旁白語音(scripts/voice.mjs 產生):腳本旁的 <名稱>.voice.json 記錄每段旁白的音檔與長度,
// 音檔放在 GCS 的 shuttle-voice bucket(公開讀取、永久快取)。日後換成自己的網域時只改 VOICE_BASE。
const VOICE_BASE = 'https://storage.googleapis.com/shuttle-voice/'
type VoiceManifest = { model: string; voice: string; clips: Record<string, { file: string; ms: number }> }

export type ScriptVoice = {
  /** 旁白文字 → 語音長度(毫秒),給舞台排時間 */
  durations: Record<string, number>
  /** 旁白文字 → 音檔網址 */
  urls: Record<string, string>
  /** 旁白文字 → 音檔名(GCS 上的路徑),章節音軌用它確認合成之後旁白有沒有重新產生過 */
  files: Record<string, string>
}

/** 腳本的旁白語音;還沒產生時回傳 null(畫面照常播放,只有字幕) */
export async function loadVoice(path: string): Promise<ScriptVoice | null> {
  const key = `../content/live/${path.replace(/\.json$/, '.voice.json')}`
  const load = SCRIPTS[key]
  if (!load) return null
  const manifest = (await load()) as VoiceManifest
  if (!manifest?.clips) return null
  const durations: Record<string, number> = {}
  const urls: Record<string, string> = {}
  const files: Record<string, string> = {}
  for (const [text, clip] of Object.entries(manifest.clips)) {
    durations[text] = clip.ms
    urls[text] = VOICE_BASE + clip.file
    files[text] = clip.file
  }
  return { durations, urls, files }
}

// 章節音軌(scripts/mix.mjs --publish 產生):把一個章節的旁白依時間軸合成一個音檔,
// 手機上整章只用一個 <audio>,不必每句換一次(見 mixPlan.ts)。清單放在腳本旁的 <名稱>.mix.json,音檔在同一個 bucket 的 mix/ 底下。
// 還沒合成(沒有清單)就是原本逐句播放。
type MixManifest = { chapters: { file: string; clips: { text: string; offsetMs: number; ms: number; voice?: string }[] }[] }

export type ScriptMix = { chapters: MixChapter[] }

/** 腳本的章節音軌;沒有合成時回傳 null */
export async function loadMix(path: string): Promise<ScriptMix | null> {
  const load = SCRIPTS[`../content/live/${path.replace(/\.json$/, '.mix.json')}`]
  if (!load) return null
  const manifest = (await load()) as MixManifest
  if (!manifest?.chapters?.length) return null
  return { chapters: manifest.chapters.map((c) => ({ file: VOICE_BASE + c.file, clips: c.clips })) }
}
