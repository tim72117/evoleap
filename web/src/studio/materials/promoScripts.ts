// 宣傳影片的腳本清單:src/content/live/promo/ 底下的即時教學畫面腳本(寫法同 live/scripts.ts,但只收宣傳影片)。
// 路徑相對於 content/live/(例如 promo/0.promo-intro.json),可直接交給 loadScript / loadVoice / loadMix。

const SCRIPTS = import.meta.glob('../../content/live/promo/*.json')

const isScript = (p: string): boolean => !/\.(voice|mix)\.json$/.test(p)
const rel = (p: string): string => p.replace('../../content/live/', '')

/** 宣傳影片腳本的路徑,依名稱排序 */
export const promoScriptPaths: string[] = Object.keys(SCRIPTS).filter(isScript).map(rel).sort()

/** 這支腳本有沒有旁白語音(*.voice.json) */
export function hasPromoVoice(path: string): boolean {
  return `../../content/live/${path.replace(/\.json$/, '.voice.json')}` in SCRIPTS
}
