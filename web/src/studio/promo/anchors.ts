// 小管家宣傳片(promo/kid-life.json)的場景錨點:直式 1080×1920 的設計座標,kid-day-scene 擁有,kid-life、kid-hub 照名字取。
// 位置避開 Facebook Reels 會蓋住的區域:上方約 15%、下方約 20–35%、右側一排按讚/留言/分享按鈕(約 x 960 以右)。
// 只改這裡,兩位演員的三格就一起移動,鏡像回呼不會對不齊。

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** 設計畫布(直式);橫式時演員把整塊等比例縮小放在中央一欄 */
export const DESIGN = { w: 1080, h: 1920 } as const

/** 安全區:看得到的內容都放在這裡面 */
export const SAFE: Box = { x: 70, y: 260, w: 870, h: 1240 }

/** 中線(安全區的水平中心) */
export const MID_X = SAFE.x + SAFE.w / 2

/** 三格:strip:1 是存錢/撲滿、strip:2 是 3C/平板、strip:3 是行程/書包 */
export const STRIPS: readonly Box[] = [
  { x: 70, y: 260, w: 870, h: 400 },
  { x: 70, y: 680, w: 870, h: 400 },
  { x: 70, y: 1100, w: 870, h: 400 },
]

/** 三格的圓角 */
export const STRIP_RADIUS = 36

/** 收成一點、轉折句、「AI 正在動手做…」的中心 */
export const FOCUS = { x: MID_X, y: 880 } as const
