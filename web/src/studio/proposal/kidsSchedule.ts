// 兒童課家長模式的排課規則(試作,只在研發基地,沒有寫進資料庫)。畫面在 KidsSchedulePlanner.tsx。
// 家長在一週裡選時段排入上課,每週最多 MAX_PER_WEEK 堂;排了幾個時段就是每週上幾堂,每堂上一課(依進度接著上)。

/** 每週最多幾堂 */
export const MAX_PER_WEEK = 3

export const DAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'] as const

/** 每天可以選的上課時段(開始時間) */
export const TIMES = ['09:00', '10:00', '14:00', '16:00', '17:00', '18:00', '19:00', '20:00'] as const

export type Slot = { day: number; time: (typeof TIMES)[number] }

export const slotKey = (s: Slot): string => `${s.day}-${s.time}`

export const slotLabel = (s: Slot): string => `${DAYS[s.day]} ${s.time}`

export const isPicked = (picked: readonly Slot[], s: Slot): boolean => picked.some((p) => slotKey(p) === slotKey(s))

export const isFull = (picked: readonly Slot[]): boolean => picked.length >= MAX_PER_WEEK

/** 依一週的順序排列(週一在前,同一天早的在前) */
export const sortSlots = (slots: readonly Slot[]): Slot[] =>
  [...slots].sort((a, b) => a.day - b.day || TIMES.indexOf(a.time) - TIMES.indexOf(b.time))

/** 點一個時段:已排就取消;沒排就排入,已經排滿時不變 */
export function toggleSlot(picked: readonly Slot[], s: Slot): Slot[] {
  if (isPicked(picked, s)) return picked.filter((p) => slotKey(p) !== slotKey(s))
  if (isFull(picked)) return [...picked]
  return sortSlots([...picked, s])
}
