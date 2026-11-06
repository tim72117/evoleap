// 兒童網頁課的積木:每個 HTML 標籤是一塊印著名字的大積木,孩子點、拖積木,不打 < > / 這些符號。
// 0.1 試做頁(KidsLesson01Page.tsx)先用這四塊;之後單元 1 的拖拉積木沿用同一份定義。
// 顏色取自 src/kids/tags.ts(和兒童版播放器字幕裡的小積木同一份)。

import { TAG_COLORS } from '../../kids/tags'

export type BlockId = 'h1' | 'img' | 'p' | 'button'

export type KidsBlockDef = {
  id: BlockId
  /** 積木上印的標籤 */
  tag: string
  /** 標籤底下的中文小字 */
  name: string
  /** 英文標籤怎麼念 */
  say: string
  /** 積木裡裝的內容(和網頁正面顯示的一樣) */
  content: string
  /** 這塊積木會做什麼,接在「它會……」後面 */
  does: string
  /** 積木本體的顏色 */
  color: string
  /** 印標籤那一塊的深色,白字要夠清楚 */
  shade: string
}

export const PET_BLOCKS: KidsBlockDef[] = [
  { id: 'h1', tag: '<h1>', name: '大標題', say: '念作「H 一」', content: '小花的家', does: '畫出最大的標題', ...TAG_COLORS.h1 },
  { id: 'img', tag: '<img>', name: '圖片', say: '念作「image」', content: '🐱 小花的照片', does: '放上一張圖片', ...TAG_COLORS.img },
  { id: 'p', tag: '<p>', name: '一段文字', say: '念作「P」', content: '小花是一隻愛睡午覺的橘貓。', does: '寫出一段文字', ...TAG_COLORS.p },
  { id: 'button', tag: '<button>', name: '按鈕', say: '念作「button」', content: '摸摸小花', does: '變成一個可以按的按鈕', ...TAG_COLORS.button },
]

export const blockOf = (id: BlockId): KidsBlockDef => PET_BLOCKS.find((b) => b.id === id) ?? PET_BLOCKS[0]
