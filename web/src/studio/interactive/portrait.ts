// 直式展示的純函式(頁面在 InteractiveScenePage.tsx):方向參數,抽出來方便單元測試。
import type { Aspect } from '../../live/types'

/**
 * 網址參數 ?aspect= 的值 → 舞台方向。網址寫了 portrait 或 landscape 就照網址;
 * 沒寫(或亂寫)時用 auto:裝置自己的方向(手機直拿是直式,見 site/useAutoAspect.ts),預設橫式。
 */
export function parseAspect(value: string | null | undefined, auto: Aspect = 'landscape'): Aspect {
  return value === 'portrait' || value === 'landscape' ? value : auto
}
