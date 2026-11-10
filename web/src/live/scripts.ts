// 即時教學畫面的腳本:檔案放在 src/content/live/,單課資料以 live: 'l0/0.0-tools.json' 指定(相對於 content/live/)。
// 腳本(與旁白清單、章節音軌清單)不打包進前端:寫入課程資料時讀進資料庫(正式環境是部署時,本機是後端啟動時;課程的依 courses_seed.json 掛在各課底下,其餘是研發基地的),
// 這裡向 GET /api/scripts/{path} 取得。伺服器依那一課的狀態與存取方式把關(草稿只給管理員、登入後免費的要登入),研發基地的只給管理員。
import { useEffect, useState } from 'react'
import type { MixChapter } from './mixPlan'
import type { StageScript } from './stage'
import { withTeacher } from './teacher'

/** 腳本要登入才拿得到(登入過期,或課程頁的判斷和伺服器不一致)時的錯誤訊息;播放器看到它會加上登入連結(ScriptError) */
export const LOGIN_REQUIRED = '這一課要登入才能觀看，請登入後再試一次。'

/** 向伺服器取一個腳本檔;沒有(或看不到,404)時回傳 null */
async function loadJson(path: string): Promise<unknown> {
  const res = await fetch(`/api/scripts/${path}`)
  if (res.status === 404) return null
  if (res.status === 401) throw new Error(LOGIN_REQUIRED)
  if (res.status === 403) {
    // 兒童模式時段外(kids_closed,訊息附下一堂時間)、兒童模式看其他課(kids_only)、要訂閱:照伺服器的訊息顯示
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message ? `${body.message}。` : '這一課要訂閱才能觀看。')
  }
  if (!res.ok) throw new Error(`讀不到即時教學畫面的腳本 ${path}(${res.status})`)
  return res.json()
}

/** 旁白清單、章節音軌清單:讀不到(沒有、登入過期、伺服器錯誤)都當作沒有,畫面照常播放,只有字幕 */
const loadOptional = (path: string): Promise<unknown> => loadJson(path).catch(() => null)

let pathsRequest: Promise<string[]> | null = null

/** 所有腳本檔的路徑(例如 l0/0.0-tools.json、promo/0.promo-intro.json;只有管理員拿得到,研發基地用);讀到之前是 null */
export function useScriptPaths(): string[] | null {
  const [paths, setPaths] = useState<string[] | null>(null)
  useEffect(() => {
    // 讀失敗不記住,下次打開頁面再試(例如管理員登入狀態還沒確定)
    pathsRequest ??= fetch('/api/scripts')
      .then((r) => (r.ok ? (r.json() as Promise<{ paths: string[] }>) : Promise.reject(new Error(String(r.status)))))
      .then((b) => b.paths)
      .catch(() => {
        pathsRequest = null
        return []
      })
    let cancelled = false
    void pathsRequest.then((p) => !cancelled && setPaths(p))
    return () => {
      cancelled = true
    }
  }, [])
  return paths
}

export async function loadScript(path: string): Promise<StageScript> {
  const script = (await loadJson(path)) as StageScript | null
  if (!script) throw new Error(`找不到即時教學畫面的腳本:${path}`)
  // 腳本有 teacher 時在這裡展開成開頭的老師介紹,之後的程式(互動點、舞台、章節音軌)看到的都是展開後的腳本
  return withTeacher(script)
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
  const manifest = (await loadOptional(path.replace(/\.json$/, '.voice.json'))) as VoiceManifest | null
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
  const manifest = (await loadOptional(path.replace(/\.json$/, '.mix.json'))) as MixManifest | null
  if (!manifest?.chapters?.length) return null
  return { chapters: manifest.chapters.map((c) => ({ file: VOICE_BASE + c.file, clips: c.clips })) }
}
