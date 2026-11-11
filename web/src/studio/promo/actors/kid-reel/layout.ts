// 兒童課宣傳片(promo/kids-free-reel.json)的版面:直式 1080×1920 的設計座標。
// 避開 Facebook Reels 會蓋住的區域:上方約 13%、下方約 22%、右側一排按讚/留言/分享按鈕(約 x 960 以右)。
// 課程演員疊在平板螢幕上:腳本裡它們的 portrait place 就是 PLACE(改這裡要同步改腳本;layout.test.ts 會比對)。

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export const DESIGN = { w: 1080, h: 1920 } as const

/** 安全區:看得到的內容都放在這裡面 */
export const SAFE: Box = { x: 70, y: 250, w: 870, h: 1250 }

/** 平板機身(直放) */
export const TABLET: Box = { x: 80, y: 384, w: 860, h: 1116 }

/** 平板機身的邊框厚度(鋁框 + 黑色邊框) */
export const BEZEL = 24

/** 平板螢幕(機身內縮 BEZEL) */
export const SCREEN: Box = { x: TABLET.x + BEZEL, y: TABLET.y + BEZEL, w: TABLET.w - BEZEL * 2, h: TABLET.h - BEZEL * 2 }

/** 螢幕內的留白:課程演員不貼著螢幕的圓角 */
export const SCREEN_PAD = 14

/** 課程演員的 place(螢幕再內縮 SCREEN_PAD;腳本的 portrait place 要寫成這個) */
export const PLACE: Box = { x: SCREEN.x + SCREEN_PAD, y: SCREEN.y + SCREEN_PAD, w: SCREEN.w - SCREEN_PAD * 2, h: SCREEN.h - SCREEN_PAD * 2 }

/**
 * 螢幕下緣讓一點給浮空字卡的 place(learn.ts 的字卡壓在螢幕最下面):
 * 底部有東西要操作的演員用它,例如 lt10-magic 的積木盒在最下面,滿版時會被字卡蓋住(搭配字卡的 side: "right",主卡讓開左下角)。h 要大於 w × 1.1(lt10-magic 等演員才會排成直的,見 kit.tallWatch)
 */
export const PLACE_SHORT: Box = { ...PLACE, h: 960 }

/** 亮點標籤列(平板上方) */
export const CHIP: Box = { x: 70, y: 256, w: 870, h: 104 }
