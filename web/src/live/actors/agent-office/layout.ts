// agent-office 的版面(寬鏡頭):這個場景專屬的座標,傳給 art/ 的共用繪圖函式。1920×1080 舞台的 px。
import type { Quad } from '../../art/geometry'
import type { BotLayout } from '../../art/characters'
import { onKeyboard } from '../../art/office'

/** 桌面的上緣 */
export const DESK_Y = 772
/** 螢幕(DOM,CSS 3D 斜放;畫面朝向右前方的機器人) */
export const MON = { x: 372, y: 246, w: 668, h: 414, rotY: 24 }
/** 鍵盤四個角(桌上,透視) */
export const KB: Quad = { tl: { x: 690, y: 800 }, tr: { x: 1036, y: 790 }, br: { x: 1068, y: 860 }, bl: { x: 700, y: 874 } }
/** 機器人:頭的中心、半徑,脖子的轉軸,兩邊肩膀 */
export const BOT: BotLayout = { head: { x: 1236, y: 438 }, rx: 108, ry: 118, neck: { x: 1244, y: 548 }, nearShoulder: { x: 1352, y: 652 }, farShoulder: { x: 1178, y: 628 } }
/** 機器人手臂長度(上臂、前臂) */
export const ARM = { near: [204, 218] as const, far: [214, 226] as const }
/** 人:頭的中心與脖子(點頭的轉軸) */
export const MAN = { head: { x: 1664, y: 302 }, neck: { x: 1684, y: 404 } }

/** 鍵盤平面上 (u, v) 的位置(用這個場景的鍵盤) */
export const onKb = (u: number, v: number) => onKeyboard(u, v, KB)

/** 傳給 art/ 繪圖函式的選項(id / class 前綴與 actor.css 對應);同一間辦公室的場景只差前綴(manual-office 用 'mo') */
export const artFor = <P extends string>(prefix: P) => ({ prefix, deskY: DESK_Y, kb: KB, bot: BOT }) as const
export const ART = artFor('ao')
