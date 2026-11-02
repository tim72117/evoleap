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
