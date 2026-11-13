// 試作用的演員登記:不進公開 bundle(src/studio/ 底下的內容由 vite.config.ts 的 internalBundleGuard 擋著),
// 由研發基地的試作頁 import 這個檔,把演員寫進舞台的登記表(ACTORS 是可改的物件,舞台載入腳本時查它)。
// 場景(把背景與前景包在一起、背景依狀態自動變化的演員)也登記在 ACTORS 讓舞台找得到,
// 但在研發基地另外放在「開發 › 場景」(/studio/scenes),演員展示不列出它們(SCENES)。
import { ACTORS } from '../../live/actors'
import fableSky from './actors/fable-sky/actor'
import fableScene from './actors/fable-scene/actor'
import fableWorld from './actors/fable-world/actor'
// 宣傳片的場景(kid-day-scene)登記在 promo/registerActors.ts,import 它就一起登記並併進 SCENES
import { PROMO_SCENES } from '../promo/registerActors'

for (const def of [fableSky, fableWorld, fableScene]) ACTORS[def.name] = def

/** 場景:名稱 → 展示腳本(src/content/live/ 底下)與說明 */
export const SCENES: { name: string; title: string; script: string; summary: string }[] = [
  {
    name: fableScene.name,
    title: '本機與網路上：夜晚的城市',
    script: 'lab/scenes/fable-scene.json',
    summary: '前景是書桌、筆電、朋友的手機與城裡的伺服器大樓（fable-world），背景是星空、城市與地底光纖（fable-sky 的畫法）。',
  },
  {
    name: 'intro-manual-to-agent',
    title: '手寫程式 → AI 代理人：同一間辦公室',
    script: 'lab/scenes/intro-manual-to-agent.json',
    summary: '手寫 HTML、打錯一個符號、找了三天（manual-office），最後舉手求助，機器人坐著辦公椅滑進來，接著演 agent-office 的完整流程。同一個房間無縫接。',
  },
  ...PROMO_SCENES,
]

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
