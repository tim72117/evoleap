// manual-office 的版面:跟 agent-office 是同一間辦公室(同一個桌子、螢幕、鍵盤、機器人的位置、人站的位置),
// 才能在結尾無縫接到 agent-office 的第一格。所以這裡直接重新匯出 agent-office 的常數,只多了「人坐在桌前」的姿勢與時鐘的位置。
import type { ManPose } from '../../art/manRig'
import { ARM, BOT, DESK_Y, KB, MAN, MON, artFor, onKb } from '../agent-office/layout'

export { ARM, BOT, DESK_Y, KB, MAN, MON, onKb }

/** 傳給 art/ 繪圖函式的選項(id / class 前綴 "mo" 與 actor.css 對應);版面跟 agent-office 一樣 */
export const ART = artFor('mo')

/** 人坐在桌前打字的姿勢(站姿座標平移到機器人那張椅子的位置);往螢幕前傾 lean > 0、往後靠 lean < 0 */
export const SIT: ManPose = { tx: -402, ty: 122, rot: 0, k: 1 }
export const sitPose = (lean: number, sigh = 0): ManPose => ({
  tx: SIT.tx - 30 * lean,
  ty: SIT.ty + (lean > 0 ? 8 * lean : -10 * lean) - 10 * sigh,
  rot: -5 * lean,
  k: 1,
})

/** 人的手在站姿座標裡的目標:額頭(揉太陽穴)、舉手(揮手)、放在腿上 */
export const MAN_SPOT = {
  rub: { x: 1668, y: 262 },
  wave: { x: 1528, y: 236 },
  lapNear: { x: 1672, y: 842 },
  lapFar: { x: 1540, y: 862 },
}
/** 手臂長度(上臂、前臂)與半徑(肩、肘、腕) */
export const MAN_ARM = { len: [200, 198] as const, r: [44, 35, 26] as const }

/** 機器人從右邊滑進來的起點(往右平移的 px) */
export const BOT_START_DX = 1000
