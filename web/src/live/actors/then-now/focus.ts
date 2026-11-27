// 直式(手機)版面:現在在看哪一區,那一區就放大,其他縮小讓位。全部是時間的純函式(拖曳、倒轉畫出來一樣)。
import type { ChatStage } from './chatEra'

/** work = 打程式、聊天、測試清單那一區;view = 網頁預覽 */
export type Area = 'work' | 'view'
/** 工作區裡面再分:聊天或編輯器(只有對話式 AI 用到) */
export type ChatPart = 'chat' | 'editor'

/** 對話式 AI 的示範在第 t 毫秒看哪一區 */
export function chatArea(stage: ChatStage, t: number): Area {
  if (stage === 1) return 'work'
  if (stage === 2) return t >= 4400 ? 'view' : 'work'
  return t < 2900 || t >= 9300 ? 'view' : 'work'
}
export function chatPart(stage: ChatStage, t: number): ChatPart {
  if (stage === 1) return 'chat'
  if (stage === 2) return t >= 1100 ? 'editor' : 'chat'
  return t >= 6900 ? 'editor' : 'chat'
}

/** 換區花多久(毫秒) */
const EASE = 500
/**
 * 某件事「正在發生」的比重(0..1):取過去 EASE 毫秒內成立的比例,所以切換是漸進的。
 * before 是這個動作開始之前的狀態(0 或 1)
 */
export function share(is: (t: number) => boolean, t: number, before: boolean): number {
  const n = 20
  let sum = 0
  for (let k = 0; k < n; k++) {
    const at = t - (k * EASE) / n
    if (at < 0 ? before : is(at)) sum++
  }
  const p = sum / n
  return p * p * (3 - 2 * p)
}
