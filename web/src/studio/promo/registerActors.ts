// 宣傳片專用的演員登記:不進公開 bundle(src/studio/ 底下的內容由 vite.config.ts 的 internalBundleGuard 擋著),
// 由研發基地的宣傳影片頁(studio/materials/PromoPage.tsx)import,把演員寫進舞台的登記表(ACTORS 是可改的物件,舞台載入腳本時查它)。
//   kid-life     :孩子生活的三格痛點場景(撲滿、平板、書包)、爸媽嘆氣、收成一點帶出轉折句
//   kid-hub      :小管家 App(存錢、3C 時間、今日行程、習慣打卡),三格與 kid-life 同一組位置(../anchors.ts),做鏡像回呼
//   kid-day-scene:場景,把 kid-life 與 kid-hub 包在同一個世界裡,背景依狀態連續變化(規則表在 actor.ts 的 RULES)
//   kid-reel     :兒童課宣傳片的場景(開場、平板外框與亮點、側後方的書桌鏡頭),真正的兒童課演員疊在平板螢幕上
//   kid-reel-cards:兒童課宣傳片的浮空字卡(這一課學會什麼),排在演員表最後,壓在課程演員上面
// 腳本:content/live/promo/kid-life.json、kids-free-reel.json(直式為主)
import { ACTORS } from '../../live/actors'
import kidDayScene from './actors/kid-day-scene/actor'
import kidHub from './actors/kid-hub/actor'
import kidLife from './actors/kid-life/actor'
import kidReel from './actors/kid-reel/actor'
import kidReelCards from './actors/kid-reel/learn'

for (const def of [kidLife, kidHub, kidDayScene, kidReel, kidReelCards]) ACTORS[def.name] = def

/** 宣傳片的場景(格式同 fable/registerActors.ts 的 SCENES,由那裡併進「開發 › 場景」的清單) */
export const PROMO_SCENES: { name: string; title: string; script: string; summary: string }[] = [
  {
    name: kidDayScene.name,
    title: '孩子的一天：從痛點到小管家',
    script: 'lab/scenes/kid-day-scene.json',
    summary: '前景是痛點三格（kid-life）與小管家 App（kid-hub），背景是同一組光斑，依狀態從深藍帶紅光轉成暖米色，交接時不硬切。',
  },
]

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
