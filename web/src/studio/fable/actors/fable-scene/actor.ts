// 演員 fable-scene:「場景」的試作(研發基地,不進公開 bundle;登記在 ../../registerActors.ts)。
// 場景＝同一個世界的背景與前景兩層:前景是 fable-world 的城市與角色(動作照舊),背景是 fable-sky 的夜景畫法。
// 背景不跟腳本逐步同步,而是依「場景狀態」自動變化:規則表 RULES 把狀態對到背景的樣子(光纖、城市燈光),
// 狀態一改變就從那一步開始的時間過場過去;只有「天亮」這種敘事上的變化才由導演指令 sky 下。
// 場景沒有自己的狀態,只從演員的狀態推算,所以拖曳、倒轉到任何時間點畫面都一樣(SPEC 第 1 節)。
// 背景也跟著前景的推軌做視差(推近時背景只推近三成),做出景深。
//
// props:同 fable-world(friend、port、domain、site)
//
// 動作:fable-world 的十一個動作(boot、open、send、visit、reveal、peek、doors、stop、deploy、power、crowd),
//   另外加導演指令:
//   { "sky": "night" | "dawn" }   天色(敘事上的變化,不是任何演員的狀態)
//
// 目標:同 fable-world,另外有 sky(背景)
import { kit } from '../../../../live/kit'
import { defineActor, type ActorEvent, type CommonStepFields } from '../../../../live/types'
import world, { apply as worldApply, dollyMs, dollyOf, durationOf, kindIn, KINDS as WORLD_KINDS, type Kind as WorldKind, type Target as WorldTarget, type WorldProps, type WorldState, type WorldStep } from '../fable-world/actor'
import { createSkyPainter, W, type SkyLook } from '../fable-sky/paint'
import './actor.css'

type Sky = 'night' | 'dawn'
const KINDS = [...WORLD_KINDS, 'sky'] as const
type Kind = (typeof KINDS)[number]
export type SceneStep = WorldStep & CommonStepFields & { sky?: Sky }
export interface SceneState {
  world: WorldState
  sky: Sky
}
type Target = WorldTarget | 'sky'

const SKY_MS = 1500

/**
 * 場景規則:狀態 → 背景的樣子。寫腳本的人看這張表就知道哪些事不用自己同步。
 * ms 是過場長度:狀態在某一步改變時,從那一步開始的時間起,用這麼久過場過去。
 */
export const RULES: { look: keyof SkyLook; ms: number; when: string; of: (st: SceneState) => number }[] = [
  {
    look: 'streams',
    ms: 1600,
    when: '網站上線且伺服器開著 → 地底的光纖亮起、光點往伺服器流;伺服器關機 → 只剩微光;還沒上線 → 不亮',
    of: (st) => (st.world.deployed ? (st.world.server ? 1 : 0.12) : 0),
  },
  {
    look: 'city',
    ms: 1200,
    when: '城裡大家都打開了網站(crowd)→ 城市的窗戶更亮;伺服器關機 → 窗戶暗一些',
    of: (st) => (st.world.deployed && !st.world.server ? 0.7 : st.world.crowd ? 1.4 : 1),
  },
  {
    look: 'dawn',
    ms: 2600,
    when: '導演指令 sky: dawn → 天色轉亮、星星退去(敘事上的變化,不是演員的狀態)',
    of: (st) => (st.sky === 'dawn' ? 1 : 0),
  },
]

const isWorld = (k: string): k is WorldKind => (WORLD_KINDS as readonly string[]).includes(k)

function apply(st: SceneState, kind: Kind, s: SceneStep): SceneState {
  if (kind === 'sky') {
    if (s.sky !== 'night' && s.sky !== 'dawn') throw new Error('sky 要寫 "night" 或 "dawn"')
    if (s.sky === st.sky) throw new Error(`sky:已經是 ${s.sky} 了`)
    return { ...st, sky: s.sky }
  }
  return { ...st, world: worldApply(st.world, kind, s) }
}

/**
 * 這一格的動作種類。show/hide 帶著動作時也算:舞台算狀態時會套用,但交給演員的事件清單裡這種格子的 kind 是 'props'
 * (frame.view.ev 則還是 'show'/'hide'),兩種都要認得,背景才會和舞台算的狀態一致。
 */
const kindOf = (e: ActorEvent): Kind | null =>
  e.kind === 'sky' || ((e.kind === 'show' || e.kind === 'hide' || e.kind === 'props') && 'sky' in e.step) ? 'sky' : kindIn(e.kind, e.step)

/**
 * 依規則算出 ms 時背景的樣子:從起始狀態依序套用已經開始的動作,每個規則的值一改變,就從那個動作開始的時間過場過去。
 * 上一段過場還沒走完又改變時,從當時的值接著過場,不會跳。
 */
export function lookAt(init: SceneState, events: readonly ActorEvent[], ms: number): SkyLook {
  const look: SkyLook = { streams: 0, dawn: 0, city: 1 }
  let st = init
  const track = RULES.map((r) => ({ from: r.of(st), to: r.of(st), at: 0, ms: r.ms }))
  const valueAt = (t: (typeof track)[number], time: number): number => kit.lerp(t.from, t.to, kit.ease.inOutCubic(kit.progress(time - t.at, 0, t.ms)))
  for (const e of events) {
    const k = kindOf(e)
    if (!k) continue
    st = apply(st, k, e.step as SceneStep)
    RULES.forEach((r, i) => {
      const v = r.of(st)
      if (v === track[i].to) return
      track[i] = { from: valueAt(track[i], e.start), to: v, at: e.start, ms: r.ms }
    })
  }
  RULES.forEach((r, i) => (look[r.look] = valueAt(track[i], ms)))
  return look
}

const actor = defineActor<Kind, SceneStep, WorldProps, SceneState, Target>({
  name: 'fable-scene',
  kinds: KINDS,

  init(props) {
    return { world: world.init!(props), sky: 'night' }
  },
  apply,
  duration(kind, step, props, prev) {
    return kind === 'sky' ? SKY_MS : world.duration(kind, step, props, prev?.world)
  },
  autoFocus() {
    return undefined
  },

  mount(root, props) {
    root.classList.add('A-fable-scene')
    root.innerHTML = `<div class="fs-bg"><canvas class="sky-canvas" width="${W}" height="1080" aria-hidden="true"></canvas></div><div class="fs-fg"></div>`
    const bg = root.querySelector<HTMLElement>('.fs-bg')!
    const paint = createSkyPainter(bg.querySelector('canvas')!)
    const fg = world.mount(root.querySelector<HTMLElement>('.fs-fg')!, props)
    const init = actor.init!(props)

    return {
      render(frame, ms) {
        const view = frame.view
        if (!view) return
        const ev = view.ev
        const k = ev ? kindOf(ev) : null
        const worldEv = ev && k && isWorld(k) ? ev : null

        // 前景:照舊交給 fable-world(導演指令 sky 那一步,前景看到的是「沒有進行中的動作」)
        fg.render({ events: frame.events.filter((e) => e.kind !== 'sky'), view: { state: view.state.world, prev: view.prev.world, ev: worldEv } }, ms)

        // 背景:依場景規則算出樣子,不看腳本寫了什麼
        paint(ms, lookAt(init, frame.events, ms))

        // 視差:前景推近多少,背景只推近三成,而且以同一個焦點縮放、不置中(邊緣不會露出來)
        let z = 1
        let cx = 960
        let cy = 540
        const st = ev?.kind === 'hide' ? view.prev.world : view.state.world
        const dB = dollyOf(st)
        if (worldEv && k && isWorld(k)) {
          const natural = durationOf(k, worldEv.step as WorldStep, view.prev.world)
          const l = natural > 0 && worldEv.dur > 0 ? (worldEv.local * natural) / worldEv.dur : worldEv.local
          const dA = dollyOf(view.prev.world)
          const dp = kit.ease.inOutCubic(kit.progress(l, 0, dollyMs(natural || worldEv.dur)))
          z = kit.lerp(dA.z, dB.z, dp)
          cx = kit.lerp(dA.x, dB.x, dp)
          cy = kit.lerp(dA.y, dB.y, dp)
        } else {
          ;({ z, x: cx, y: cy } = dB)
        }
        const zb = 1 + (z - 1) * 0.3
        kit.css(bg, { transform: `translate(${(cx * (1 - zb)).toFixed(1)}px, ${(cy * (1 - zb)).toFixed(1)}px) scale(${zb.toFixed(4)})` })
      },

      target(name, view) {
        if (name === 'sky') return bg
        return fg.target(name, view ? { state: view.state.world, prev: view.prev.world, ev: null } : null)
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
