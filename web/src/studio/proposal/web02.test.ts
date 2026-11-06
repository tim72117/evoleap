import { describe, expect, it } from 'vitest'
import { ACTORS } from '../../live/actors'
import type { StageScript } from '../../live/types'
import { expandAnswers, momentsOf, type Answers } from '../interactive/scene'
import script from '../../content/live/web/0.2.json'

// 網頁運作知識 0.2 的試做腳本(content/live/web/0.2.json):
// 每一步交給會這個動作的演員,照順序用 init/apply 推算一遍;互動點的每個選項(與略過)組合都演一次,
// 確認瀏覽器用到的網頁版本都存在、編輯器打出來的檔案和網頁素材一字不差。

type Step = Record<string, unknown>
type Cast = Record<string, { actor: string; props?: object }>

// 網頁素材直接從磁碟讀:vitest 預設不處理 CSS,import 'x.css?raw' 會拿到空字串。
// 專案沒裝 @types/node,所以用 process.getBuiltinModule 取得 fs(Node 22.3 起)並自己標型別
type Fs = { existsSync(p: URL): boolean; readFileSync(p: URL, enc: 'utf8'): string }
const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): Fs } }).process.getBuiltinModule('node:fs')
const fileOf = (site: string, name: string): string | undefined => {
  const url = new URL(`../../content/live/l0/site/${site}/${name}`, import.meta.url)
  return fs.existsSync(url) ? fs.readFileSync(url, 'utf8') : undefined
}

const STAGE_KINDS = ['card', 'callout', 'show', 'hide', 'move', 'checkpoint', 'wait', 'parts']
const S = script as unknown as StageScript
const cast = S.cast as unknown as Cast

/** 這一步是哪個演員的哪個動作(舞台的動作回傳 null) */
function ownerOf(s: Step): { id: string; kind: string } | null {
  if (STAGE_KINDS.some((k) => k in s)) return null
  const able = Object.keys(cast).filter((id) => (!s.on || s.on === id) && ACTORS[cast[id].actor].kinds.some((k) => k in s))
  expect(able, `沒有演員或有多個演員會這一步:${JSON.stringify(s)}`).toHaveLength(1)
  const id = able[0]
  return { id, kind: ACTORS[cast[id].actor].kinds.find((k) => k in s)! }
}

/** 照順序推算每個演員的狀態,回傳最後的狀態 */
function replay(steps: Step[]): Record<string, unknown> {
  const st: Record<string, unknown> = {}
  for (const id of Object.keys(cast)) st[id] = ACTORS[cast[id].actor].init?.(cast[id].props ?? {})
  for (const s of steps) {
    const o = ownerOf(s)
    if (o) st[o.id] = ACTORS[cast[o.id].actor].apply!(st[o.id], o.kind, s)
  }
  return st
}

/** 互動點每個選項、略過與沒回答(沒回答和略過都演 skip 的示範)的所有組合 */
function allAnswers(): Answers[] {
  let out: Answers[] = [{}]
  for (const m of momentsOf(S)) {
    const picks = [...m.options.map((_, i) => ({ option: i })), { skipped: true as const }]
    out = out.flatMap((a) => [{ ...a }, ...picks.map((p) => ({ ...a, [m.id]: p }))])
  }
  return out
}
const expanded = (a: Answers): Step[] => expandAnswers(S, a).steps as unknown as Step[]

describe('網頁運作知識 0.2 腳本', () => {
  it('演員表只用登記過的演員', () => {
    for (const c of Object.values(cast)) expect(ACTORS[c.actor], c.actor).toBeTruthy()
  })

  it('瀏覽器用到的網頁版本都在 l0/site', () => {
    const sites = new Set<string>()
    for (const c of Object.values(cast)) if (c.actor === 'browser') sites.add((c.props as { site?: string }).site!)
    const walk = (steps: Step[]) => {
      for (const s of steps) {
        if (typeof s.site === 'string') sites.add(s.site)
        for (const o of (s.options as { steps: Step[] }[] | undefined) ?? []) walk(o.steps)
        if (s.skip) walk((s.skip as { steps: Step[] }).steps)
      }
    }
    walk(S.steps as unknown as Step[])
    expect([...sites].sort()).toEqual(['web-css', 'web-html', 'web-js'])
    for (const id of sites) expect(fileOf(id, 'index.html'), id).toBeTruthy()
  })

  it('三個版本:HTML 相同,CSS 從 web-css 開始,JavaScript 只有 web-js', () => {
    expect(fileOf('web-css', 'index.html')).toBe(fileOf('web-html', 'index.html'))
    expect(fileOf('web-js', 'index.html')).toBe(fileOf('web-html', 'index.html'))
    expect(fileOf('web-html', 'styles.css')).toBeUndefined()
    expect(fileOf('web-js', 'styles.css')).toBe(fileOf('web-css', 'styles.css'))
    expect(fileOf('web-css', 'script.js')).toBeUndefined()
    expect(fileOf('web-js', 'script.js')).toBeTruthy()
  })

  it('聚光燈的目標都指向演員表裡的演員', () => {
    for (const a of allAnswers()) for (const s of expanded(a)) if (typeof s.callout === 'string') expect(cast[s.callout.split(':')[0]], s.callout).toBeTruthy()
  })

  it('每一種回答組合都推算得過,結束時演員狀態一致', () => {
    // 不管怎麼回答:瀏覽器回到 web-js、按過一次按鈕,編輯器停在 script.js;第一題之後一律是 web-js、還沒按過、停在 styles.css
    for (const a of allAnswers()) {
      const steps = expanded(a)
      const second = steps.findIndex((s) => s.id === 'click')
      const mid = replay(steps.slice(0, second))
      expect({ site: (mid.web as { site: string }).site, clicks: (mid.web as { clicks: string[] }).clicks, active: (mid.editor as { active: string }).active }, JSON.stringify(a)).toEqual({ site: 'web-js', clicks: [], active: 'styles.css' })
      const end = replay(steps)
      expect({ site: (end.web as { site: string }).site, clicks: (end.web as { clicks: string[] }).clicks, active: (end.editor as { active: string }).active }, JSON.stringify(a)).toEqual({ site: 'web-js', clicks: ['#add'], active: 'script.js' })
    }
  })

  it('編輯器打出來的三個檔案和 web-js 的素材一字不差', () => {
    const st = replay(S.steps as unknown as Step[])
    const files = (st.editor as { files: Record<string, string> }).files
    expect(Object.keys(files).sort()).toEqual(['index.html', 'script.js', 'styles.css'])
    for (const [name, text] of Object.entries(files)) expect(text, name).toBe(fileOf('web-js', name))
  })
})
