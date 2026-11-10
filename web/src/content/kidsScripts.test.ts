import { describe, expect, it } from 'vitest'
import kidMail from '../live/actors/kid-mail/actor'
import kidTree from '../live/actors/kid-tree/actor'
import kidWeb from '../live/actors/kid-web/actor'
import lt10Magic from '../live/actors/lt10-magic/actor'
import lt11Helper from '../live/actors/lt11-helper/actor'
import lt8KidPage from '../live/actors/lt8-kid-page/actor'
import lt9Wear from '../live/actors/lt9-wear/actor'
import type { AnyActor } from '../live/types'

// 兒童課的腳本(content/live/kids/,不含 .voice.json):照順序把每一步交給演員(kid-web 或 kid-tree)的 init/apply 推算一遍,
// 寫錯的操作(改圖片的字、標籤打錯、背面改字)在這裡就會丟錯,不用等到畫面播到才發現。
// 互動點每個選項、子腳本每個可點區(含 again)與結尾,都從孩子能點的那時的狀態各推算一次。

type Step = Record<string, unknown>
type Script = { cast: Record<string, { actor: string; props?: object }>; steps: Step[]; interact?: { on: string; spots?: { target: string; steps: Step[]; again?: Step[] }[]; done?: { steps: Step[] } } }

const SCRIPTS = import.meta.glob(['./live/kids/*.json', '!./live/kids/*.voice.json'], { eager: true, import: 'default' }) as Record<string, Script>

const ACTORS: Record<string, AnyActor> = {
  [kidWeb.name]: kidWeb as unknown as AnyActor, [kidTree.name]: kidTree as unknown as AnyActor, [kidMail.name]: kidMail as unknown as AnyActor,
  ...Object.fromEntries([lt8KidPage, lt9Wear, lt10Magic, lt11Helper].map((a) => [a.name, a as unknown as AnyActor])),
}
function run(actor: AnyActor, state: unknown, steps: Step[]): unknown {
  let st = state
  for (const s of steps) {
    const kind = actor.kinds.find((k) => k in s)
    if (kind) st = actor.apply!(st, kind, s)
  }
  return st
}

// 要先做別的事才點得到的可點區:子腳本檔名 → target → 為什麼(播放器在畫面上找不到 target 時不顯示,所以孩子點不到)
const NEEDS_FIRST: Record<string, Record<string, string>> = {
  '1.4-trip.json': { 'kid:part:back': '「回首頁」只在相簿頁上,要先點連結過去', 'kid:part:back2': '同上,在另一頁上' },
}

// 舞台自己的動作名稱(live/stage.ts):演員的動作不能和它們同名,不然舞台會把那一步當成自己的(例如 move 是移動演員的位置)
const STAGE_KINDS = ['card', 'callout', 'show', 'hide', 'move', 'checkpoint', 'wait', 'parts']

describe('兒童課腳本的演員操作', () => {
  it('演員的動作沒有和舞台的動作同名', () => {
    for (const a of Object.values(ACTORS)) expect(a.kinds.filter((k) => STAGE_KINDS.includes(k))).toEqual([])
  })

  it.each(Object.keys(SCRIPTS))('%s', (file) => {
    const script = SCRIPTS[file]
    const cast = Object.values(script.cast).find((c) => ACTORS[c.actor])!
    expect(cast).toBeTruthy()
    const actor = ACTORS[cast.actor]
    const run1 = (st: unknown, steps: Step[]) => run(actor, st, steps)
    let st = actor.init!(cast.props ?? {}) as unknown
    for (const s of script.steps) {
      const options = s.options as { steps: Step[] }[] | undefined
      // 互動點:每個選項都從這裡的狀態演一次,接著用第一個選項的結果往下(和孩子答對時一樣)
      if (options) {
        const results = options.map((o) => run1(st, o.steps))
        st = results[0]
        continue
      }
      st = run1(st, [s])
    }
    // 可點區:孩子停下來可以點的時候,每一個都要能從這時的狀態點(播放器把它們全部列出來,先點哪個都行);
    // 只有 NEEDS_FIRST 列的(畫面上要先做別的事才會出現,播放器在那之前找不到它就不會顯示)改從點過其他可點區之後的狀態推算。
    // 結尾(done)是過關後才演,從點過全部可點區之後的狀態推算
    const name = file.split('/').pop()!
    const reached: unknown[] = [st]
    const fromReached = (steps: Step[]): unknown => {
      let first: unknown
      for (const from of reached) {
        try {
          return run1(from, steps)
        } catch (e) {
          first ??= e
        }
      }
      throw first
    }
    for (const spot of script.interact?.spots ?? []) {
      const needsFirst = NEEDS_FIRST[name]?.[spot.target]
      const after = needsFirst ? fromReached(spot.steps) : run1(st, spot.steps)
      reached.push(after)
      if (spot.again) run1(after, spot.again)
    }
    if (script.interact?.done) {
      const all = (script.interact.spots ?? []).reduce((acc, spot) => {
        try {
          return run1(acc, spot.steps)
        } catch {
          return acc
        }
      }, st)
      run1(all, script.interact.done.steps)
    }
  })
})
