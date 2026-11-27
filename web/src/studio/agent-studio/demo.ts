// 虛擬 Agent 開發介面(演員 agent-studio)的示範腳本。試作用,所以直接寫在這裡讓試看頁不必先上傳資料庫;
// 決定放進課程時,用 evoleap script push 上傳到資料庫(線上資料庫是唯一來源),再把這份刪掉。還沒產生語音,只顯示字幕。
import type { ScriptStep, StageScript } from '../../live/types'
import type { Card } from '../../live/actors/agent-studio/model'

export const KIDS_CARDS: Card[] = [
  {
    id: 'make',
    emoji: '🦕',
    text: '幫我做一個恐龍網頁',
    ops: [
      { add: { id: 'h1', kind: 'title', text: '恐龍小站' } },
      { add: { id: 'pic', kind: 'image', emoji: '🦕' } },
      { add: { id: 'intro', kind: 'text', text: '這裡有我最喜歡的恐龍！', align: 'center' } },
      { add: { id: 'list', kind: 'list', items: ['腕龍：脖子很長很長，吃得到最高的樹葉', '三角龍：頭上有三支角，脖子還有大盾牌', '暴龍：牙齒又大又尖，是很厲害的獵人'], wide: true } },
      { add: { id: 'btn', kind: 'button', text: '抽一隻恐龍' } },
    ],
    reply: '做好了！你按按看，再用手機看一看。',
  },
  { id: 'button', needs: 'btn', emoji: '🎲', text: '按鈕按下去，要跳出一隻恐龍', ops: [{ set: 'btn', does: '跳出來一隻三角龍！🦖' }], reply: '好！按鈕會跳出恐龍了。' },
  { id: 'name', needs: 'pic', emoji: '🏷️', text: '在圖片下面寫上牠的名字', ops: [{ set: 'pic', alt: '腕龍' }], reply: '寫上「腕龍」了。' },
  { id: 'phone', needs: 'list', emoji: '📱', text: '手機上也要看得完整', ops: [{ set: 'list', wide: false }], reply: '清單會自己換行了。' },
  { id: 'sky', needs: 'h1', emoji: '🎨', text: '背景換成天空藍', ops: [{ set: 'page', bg: '#dff1ff' }], reply: '換好了。' },
  { id: 'big', needs: 'h1', emoji: '🔠', text: '標題變大，改成綠色', ops: [{ set: 'h1', size: 'xl', color: '#1b8a5a' }], reply: '標題變大變綠了。' },
]

const KIDS_PROPS = { look: 'kids', project: '我的恐龍網頁', url: 'dino.example.app', cards: KIDS_CARDS }

/** 自己玩:只有起始畫面,步驟由孩子點出來 */
export const KIDS_PLAY: StageScript = {
  title: '自己做一個恐龍網頁',
  cast: { studio: { actor: 'agent-studio', props: KIDS_PROPS, place: { x: 40, y: 30, w: 1840, h: 1020 } } },
  steps: [],
}

// 下緣停在 800,免得字幕蓋住測試結果面板
const PLACE = { x: 80, y: 20, w: 1760, h: 780 }
const steps = (list: object[]) => list as ScriptStep[]

export const KIDS_DEMO: StageScript = {
  title: '請小幫手做網頁（兒童版示範）',
  cast: { studio: { actor: 'agent-studio', props: KIDS_PROPS, place: PLACE } },
  steps: steps([
    { card: '請小幫手做網頁', eyebrow: '示範', sub: '說想法、試一試、修一修、分享', narration: '今天請小幫手做一個網頁。你負責說想要什麼，再檢查做得對不對。' },
    { ask: 'make', chapter: '說想法', narration: '先點一張卡片，告訴小幫手想做什麼。' },
    { press: 'btn', chapter: '試一試', narration: '做好了先別急，按按看。咦，按了沒有反應。' },
    { device: 'phone', narration: '再切到手機看看，清單跑到畫面外面了。' },
    { check: true, narration: '按檢查，哪裡要修一次看清楚。' },
    { callout: 'studio:results', text: '打叉的地方就是要修的', narration: '打叉的就是要修的地方。' },
    { ask: 'button', chapter: '修一修', narration: '一次說一件事。先請小幫手讓按鈕有反應。' },
    { ask: 'name', narration: '再幫圖片寫上名字。' },
    { ask: 'phone', narration: '最後讓手機也看得完整。' },
    { check: true, narration: '再檢查一次，全部沒問題了。' },
    { device: 'desktop' },
    { press: 'btn', narration: '按鈕也會跳出恐龍了。' },
    { save: '會跳恐龍', chapter: '存起來和分享', narration: '滿意了就先存起來。' },
    { publish: true, narration: '按分享，朋友就看得到了。這是模擬的網址，不會真的傳出去。' },
    { close: true },
    { ask: 'sky', chapter: '改壞了也不怕', narration: '之後想再改也可以，例如換背景。' },
    { versions: true, narration: '不喜歡的話，打開我的存檔。' },
    { restore: 1, narration: '回到剛剛存好的樣子。' },
    { checkpoint: '換你試試', body: '切到「自己玩」，做一次你的恐龍網頁。' },
  ]),
}

export const ADULT_DEMO: StageScript = {
  title: '用 AI Agent 做一個小網站（成人版示範）',
  cast: { studio: { actor: 'agent-studio', props: { look: 'dev', project: '小森烘焙 — 網站', url: 'mori-bakery.example.app' }, place: PLACE } },
  steps: steps([
    { card: '用 AI Agent 做軟體', eyebrow: '示範', sub: '說需求 → 預覽 → 測試 → 存版本 → 上線', narration: '這是一個模擬的開發介面。你說需求，Agent 動手，你負責確認結果。' },
    { need: '幫小森烘焙做一頁：店名、麵包照片、本週麵包清單、預約按鈕', chapter: '說需求' },
    {
      build: [
        { add: { id: 'h1', kind: 'title', text: '小森烘焙' } },
        { add: { id: 'pic', kind: 'image', emoji: '🍞' } },
        { add: { id: 'list', kind: 'list', items: ['鄉村酸種麵包　每週三、六早上十點出爐', '肉桂捲　每天限量二十個，賣完為止', '迷迭香佛卡夏　平日午餐時段供應'], wide: true } },
        { add: { id: 'book', kind: 'button', text: '預約取貨' } },
      ],
      reply: '第一版做好了，請在右邊預覽確認。',
    },
    { press: 'book', chapter: '預覽', narration: '做好不代表做對。先按按看：預約按鈕沒有反應。' },
    { device: 'phone', narration: '切到手機寬度，清單超出畫面了。' },
    { check: true, chapter: '測試', narration: '跑一次測試，把問題一次列出來。' },
    { need: '修好測試沒過的三項：按鈕要能預約、圖片加說明、手機版不要超出畫面', chapter: '修改' },
    { build: [{ set: 'book', does: '已收到預約，取貨前一天會通知你' }, { set: 'pic', alt: '剛出爐的鄉村麵包' }, { set: 'list', wide: false }], reply: '三項都改好了，請再測一次。' },
    { check: true, narration: '修完一定要再測一次。' },
    { device: 'desktop' },
    { save: '第一版：可以預約', chapter: '版本與上線', narration: '測試通過，先存一個版本。' },
    { publish: true, narration: '按上線。這是模擬的網址，不會真的發布。' },
    { close: true },
    { pick: 'h1', chapter: '指著改', narration: '想改某一塊，直接點它，再說要怎麼改。' },
    { need: '改成「小森烘焙｜週末限定」，大一點' },
    { build: [{ set: 'h1', text: '小森烘焙｜週末限定', size: 'xl' }], reply: '標題改好了。' },
    { save: '週末版標題' },
    { versions: true, chapter: '還原', narration: '每個版本都留著，可以回到任何一版。' },
    { restore: 1, narration: '還原只改手上的草稿，線上的網站不變。' },
    { checkpoint: '換你想想', body: '你的作品上線前，會檢查哪三件事？' },
  ]),
}
