// 排課規則搬到公開的 kidsMode/schedule.ts(會員空間的兒童分頁也用),研發基地的排課試作照舊從這裡 import
import { DAYS, type Slot } from '../../kidsMode/schedule'

export * from '../../kidsMode/schedule'

/** 研發基地一律是中文(不跟著網站語言):「週一 19:00」 */
export const slotLabel = (s: Slot): string => `${DAYS[s.day]} ${s.time}`
