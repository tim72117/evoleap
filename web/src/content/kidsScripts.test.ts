import { describe, expect, it } from 'vitest'
import kidWeb from '../live/actors/kid-web/actor'

// 兒童課的腳本(content/live/kids/,不含 .voice.json):照順序把每一步交給 kid-web 演員的 init/apply 推算一遍,
// 寫錯的操作(改圖片的字、標籤打錯、背面改字)在這裡就會丟錯,不用等到畫面播到才發現。
// 互動點每個選項、子腳本每個可點區(含 again)與結尾,都從當時的狀態各推算一次。

type Step = Record<string, unknown>
type Script = { cast: Record<string, { actor: string; props?: object }>; steps: Step[]; interact?: { on: string; spots?: { steps: Step[]; again?: Step[] }[]; done?: { steps: Step[] } } }

const SCRIPTS = import.meta.glob(['./live/kids/*.json', '!./live/kids/*.voice.json'], { eager: true, import: 'default' }) as Record<string, Script>

const kindOf = (s: Step) => kidWeb.kinds.find((k) => k in s)
function run(state: unknown, steps: Step[]): unknown {
  let st = state
  for (const s of steps) {
    const kind = kindOf(s)
    if (kind) st = kidWeb.apply!(st as never, kind, s as never)
  }
  return st
}

describe('兒童課腳本的演員操作', () => {
  it.each(Object.keys(SCRIPTS))('%s', (file) => {
    const script = SCRIPTS[file]
    const [id, cast] = Object.entries(script.cast).find(([, c]) => c.actor === 'kid-web')!
    expect(id).toBeTruthy()
    let st = kidWeb.init!(cast.props as never) as unknown
    for (const s of script.steps) {
      const options = s.options as { steps: Step[] }[] | undefined
      // 互動點:每個選項都從這裡的狀態演一次,接著用第一個選項的結果往下(和孩子答對時一樣)
      if (options) {
        const results = options.map((o) => run(st, o.steps))
        st = results[0]
        continue
      }
      st = run(st, [s])
    }
    for (const spot of script.interact?.spots ?? []) {
      const after = run(st, spot.steps)
      if (spot.again) run(after, spot.again)
    }
    if (script.interact?.done) run(st, script.interact.done.steps)
  })
})
