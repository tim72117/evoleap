// 舞台可用的演員(腳本 cast 裡的 "actor" 名稱 → 演員定義)。新增演員:在 actors/<名稱>/ 寫好 actor.ts、actor.css(用 defineActor 宣告),再在這裡登記。
import type { AnyActor } from '../types'
import browser from './browser/actor'
import claudeDesktop from './claude-desktop/actor'
import finder from './finder/actor'

export const ACTORS: Record<string, AnyActor> = Object.fromEntries([claudeDesktop, finder, browser].map((def) => [def.name, def]))

// 開發時引擎的程式一改就整頁重新載入:舞台、外殼、演員是掛上去就一直在跑的物件,不是 React 元件,
// 交給 LivePlayer 熱更新的話它的 effect 不會重跑,畫面仍是舊程式建出來的舊物件,看起來像沒有熱重載。
// 必須直接寫 import.meta.hot.accept(Vite 靠這段文字判斷模組會自己處理更新,包成函式它就認不得)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
