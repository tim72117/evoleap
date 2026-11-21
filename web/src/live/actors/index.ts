// 舞台可用的演員(腳本 cast 裡的 "actor" 名稱 → 演員定義)。一開始是空的:演員都在用到時才下載,
// 由 lazy.ts 的 ensureActors 依腳本的 cast 載入並登記進來(舞台的 load 會先呼叫)。
// 新增演員:建 actors/<名稱>/actor.ts、actor.css(用 defineActor 宣告,資料夾名稱 = 演員的 name),不用在這裡登記。
// 研發基地的試作演員(studio/*/registerActors.ts)直接寫進這個物件。
import type { AnyActor } from '../types'

export const ACTORS: Record<string, AnyActor> = {}

// 開發時引擎的程式一改就整頁重新載入:舞台、外殼、演員是掛上去就一直在跑的物件,不是 React 元件,
// 交給 LivePlayer 熱更新的話它的 effect 不會重跑,畫面仍是舊程式建出來的舊物件,看起來像沒有熱重載。
// 必須直接寫 import.meta.hot.accept(Vite 靠這段文字判斷模組會自己處理更新,包成函式它就認不得)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
