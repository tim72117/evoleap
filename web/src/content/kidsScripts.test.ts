import { describe, expect, it } from 'vitest'
import kidMail from '../live/actors/kid-mail/actor'
import kidTree from '../live/actors/kid-tree/actor'
import kidWeb from '../live/actors/kid-web/actor'
import type { AnyActor } from '../live/types'

// 兒童課的腳本(content/live/kids/,不含 .voice.json):照順序把每一步交給演員(kid-web 或 kid-tree)的 init/apply 推算一遍,
// 寫錯的操作(改圖片的字、標籤打錯、背面改字)在這裡就會丟錯,不用等到畫面播到才發現。
// 互動點每個選項、子腳本每個可點區(含 again)與結尾,都從當時的狀態各推算一次。

type Step = Record<string, unknown>
type Script = { cast: Record<string, { actor: string; props?: object }>; steps: Step[]; interact?: { on: string; spots?: { steps: Step[]; again?: Step[] }[]; done?: { steps: Step[] } } }

const SCRIPTS = import.meta.glob(['./live/kids/*.json', '!./live/kids/*.voice.json'], { eager: true, import: 'default' }) as Record<string, Script>

const ACTORS: Record<string, AnyActor> = { [kidWeb.name]: kidWeb as unknown as AnyActor, [kidTree.name]: kidTree as unknown as AnyActor, [kidMail.name]: kidMail as unknown as AnyActor }
function run(actor: AnyActor, state: unknown, steps: Step[]): unknown {
  let st = state
  for (const s of steps) {
    const kind = actor.kinds.find((k) => k in s)
    if (kind) st = actor.apply!(st, kind, s)
  }
  return st
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
    for (const spot of script.interact?.spots ?? []) {
      const after = run1(st, spot.steps)
      if (spot.again) run1(after, spot.again)
    }
    if (script.interact?.done) run1(st, script.interact.done.steps)
  })
})
