// 體積大、只有少數課用到的演員:不放進 actors/index.ts 的靜態 import(會被打進每一課都載入的播放器區塊),
// 改成用到時才動態 import 並登記進 ACTORS。腳本載入完、交給舞台之前要先 await ensureActors(腳本的 cast);
// scripts.ts 的 loadScript 已經做了,自己組腳本(不經 loadScript)的地方要自己呼叫。
// 演員的 CSS 隨演員模組一起動態載入;舞台要等這裡 resolve 才開始,所以不會有沒套樣式的畫面。
import type { AnyActor } from '../types'
import { ACTORS } from './index'

const LAZY: Record<string, () => Promise<{ default: AnyActor }>> = {
  'agent-office': () => import('./agent-office/actor'),
  'manual-office': () => import('./manual-office/actor'),
}

/** 延遲載入的演員名稱(演員展示頁要列出,即使還沒載入) */
export const LAZY_ACTOR_NAMES: string[] = Object.keys(LAZY)

const pending = new Map<string, Promise<void>>()

/** 把腳本 cast 用到的延遲演員載入並登記進 ACTORS;已登記的直接略過,同一個演員只載入一次 */
export async function ensureActors(names: Iterable<string>): Promise<void> {
  const jobs: Promise<void>[] = []
  for (const name of names) {
    const load = LAZY[name]
    if (!load || ACTORS[name]) continue
    let p = pending.get(name)
    if (!p) {
      p = load().then((m) => {
        ACTORS[m.default.name] = m.default
      })
      // 失敗不記住,下次還能重試
      p.catch(() => pending.delete(name))
      pending.set(name, p)
    }
    jobs.push(p)
  }
  await Promise.all(jobs)
}

/** 腳本 cast 裡的演員名稱 */
export const castActorNames = (script: { cast?: Record<string, { actor: string }> }): string[] => Object.values(script.cast ?? {}).map((c) => c.actor)

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
