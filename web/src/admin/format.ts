// 管理後台的顯示格式。

/** 毫秒 → 「1 時 05 分」「5 分 03 秒」「42 秒」 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h} 時 ${String(m).padStart(2, '0')} 分`
  if (m > 0) return `${m} 分 ${String(s).padStart(2, '0')} 秒`
  return `${s} 秒`
}

/** ISO 時間 → 「2026-11-03 14:05」(本機時區);null 或無法解析回 「—」 */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 位置 / 總長 → 0–100 的整數百分比 */
export function percentOf(positionMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0
  return Math.min(100, Math.round((positionMs / durationMs) * 100))
}
