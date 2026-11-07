// 直式展示與課程進度抽屜的純函式(頁面在 InteractiveScenePage.tsx)。
// 方向參數、抽屜該不該展開、把手上顯示的章節與進度,都抽出來方便單元測試。
import type { Aspect } from '../../live/types'

/**
 * 網址參數 ?aspect= 的值 → 舞台方向。網址寫了 portrait 或 landscape 就照網址;
 * 沒寫(或亂寫)時用 auto:裝置自己的方向(手機直拿是直式,見 site/useAutoAspect.ts),預設橫式。
 */
export function parseAspect(value: string | null | undefined, auto: Aspect = 'landscape'): Aspect {
  return value === 'portrait' || value === 'landscape' ? value : auto
}

/** 窄視窗的直式用底部抽屜,其餘(橫式、寬視窗)用右側(或下方)的浮動側欄 */
export const usesDrawer = (aspect: Aspect, narrow: boolean): boolean => aspect === 'portrait' && narrow

/**
 * 抽屜是否展開:停在新的互動點時自動展開(讓學員看到題目與選項);
 * 其他時候維持原狀,所以學員自己收合後不會被硬打開。不是抽屜(側欄)時完全不動它。
 */
export function nextDrawerOpen(open: boolean, drawer: boolean, prevMomentId: string | undefined, momentId: string | undefined): boolean {
  if (!drawer) return open
  return momentId != null && momentId !== prevMomentId ? true : open
}

/** 抽屜把手要顯示的章節名稱與第幾個/共幾個章節(時間在第一個章節之前也算第 1 個);沒有章節回 null */
export function drawerSummary(chapters: { at: number; label: string }[], t: number): { label: string; index: number; total: number } | null {
  if (!chapters.length) return null
  const sorted = [...chapters].sort((a, b) => a.at - b.at)
  const index = Math.max(1, sorted.filter((c) => c.at <= t).length)
  return { label: sorted[index - 1].label, index, total: sorted.length }
}
