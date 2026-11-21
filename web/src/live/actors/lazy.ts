// 演員都是用到時才下載:import.meta.glob 在建置時找出 actors/<名稱>/actor.ts,每個演員各自打包成一個小檔,
// 但不會預先下載。腳本載入後依 cast 用到的演員名稱呼叫 ensureActors,只下載那幾個並登記進 ACTORS。
// 新增演員只要建 actors/<名稱>/actor.ts(資料夾名稱 = 演員的 name),不用改任何清單。
// 舞台的 load 會先呼叫 ensureActors;不經舞台、直接用 ACTORS 的地方(演員展示、互動練習)要自己先呼叫。
import type { AnyActor } from '../types'
import { ACTORS } from './index'

const LOADERS = import.meta.glob<{ default: AnyActor }>('./*/actor.ts')
const nameOf = (key: string): string => key.slice(2, -'/actor.ts'.length)
const BY_NAME: Record<string, () => Promise<{ default: AnyActor }>> = Object.fromEntries(Object.entries(LOADERS).map(([k, load]) => [nameOf(k), load]))

/** 可以載入的演員名稱(演員展示頁要列出,即使還沒載入) */
export const LAZY_ACTOR_NAMES: string[] = Object.keys(BY_NAME)

const pending = new Map<string, Promise<void>>()

/** 把用到的演員載入並登記進 ACTORS;已登記的(含研發基地自己登記的)直接略過,同一個演員只載入一次 */
export async function ensureActors(names: Iterable<string>): Promise<void> {
  const jobs: Promise<void>[] = []
  for (const name of names) {
    const load = BY_NAME[name]
    if (!load || ACTORS[name]) continue
    let p = pending.get(name)
    if (!p) {
      p = load().then((m) => {
        if (m.default.name !== name) throw new Error(`演員資料夾「${name}」裡的演員名稱是「${m.default.name}」,兩者要一樣`)
        ACTORS[name] = m.default
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
