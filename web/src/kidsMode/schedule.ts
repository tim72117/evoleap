// 兒童模式的排課規則:家長在會員空間(member/KidsSection.tsx)替孩子在一週裡選時段排入上課,每週最多 MAX_PER_WEEK 堂;
// 排了幾個時段就是每週上幾堂,每堂上一課(依進度接著上)。伺服器另外檢查同樣的規則(server/internal/store/kids.go)。
// 研發基地的排課試作(studio/proposal/KidsSchedulePlanner.tsx)也用這一份。
import { messages } from '../i18n/current'

/** 每次上課可以選幾分鐘(最長 60;伺服器接受 5–60 分鐘、以 5 分鐘為單位) */
export const MINUTES_OPTIONS = [15, 20, 30, 45, 60] as const

/** 每週最多幾堂 */
export const MAX_PER_WEEK = 3

/** 星期的中文名稱(0 是週一)。畫面上依語言顯示用字典的 kidsMode.days(slotLabel 已經照目前語言) */
export const DAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'] as const

/** 每天可以選的上課時段(開始時間);最晚 23:00 開始,上到午夜為止 */
export const TIMES = ['09:00', '10:00', '14:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'] as const

export type Slot = { day: number; time: (typeof TIMES)[number] }

export const slotKey = (s: Slot): string => `${s.day}-${s.time}`

/** 時段的寫法,依目前語言:「週一 19:00」/「Mon 19:00」 */
export const slotLabel = (s: Slot): string => `${messages().kidsMode.days[s.day]} ${s.time}`

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
