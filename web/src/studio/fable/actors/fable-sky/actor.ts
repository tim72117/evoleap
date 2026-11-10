// 演員 fable-sky:動態的夜景背景(研發基地試作,不進公開 bundle;登記在 ../../registerActors.ts)。
// 整個畫在 canvas 上,每一格都只用傳入的 ms 重算:星星閃爍、雲慢慢飄、城市的窗戶亮暗、地底下的光纖光點流動、天色轉亮,
// 所以拖曳到任何時間點都畫得出同一張圖(SPEC 第 1 節)。畫面上沒有文字(文字一律用真的 DOM,由前景的演員負責)。
// place 用 "full"、放在演員表最前面,其他演員疊在上面。
//
// props:無
//
// 動作(燈光提示,像舞台的燈光 cue;1.5 秒內從上一個氣氛漸變過去):
//   { "mood": "night" }     夜晚:星空、城市夜景(預設)
//   { "mood": "network" }   網路:城市底下亮起光纖,光點沿著線流向右邊(伺服器那一側)
//   { "mood": "dawn" }      天亮:天色由深藍轉成橘紅,星星退去(結尾用)
//
// 目標:window
import { kit } from '../../../../live/kit'
import { defineActor, type ActorEvent, type CommonStepFields } from '../../../../live/types'
import { createSkyPainter, W } from './paint'
import './actor.css'

type Mood = 'night' | 'network' | 'dawn'
type SkyStep = CommonStepFields & { mood?: Mood }
type Ev = ActorEvent<SkyStep, 'mood'>

const H = 1080
const MOOD_MS = 1500
const MOODS: readonly Mood[] = ['night', 'network', 'dawn']

/** 氣氛的數值:streams 光纖的亮度 0–1、dawn 天亮的程度 0–1 */
const moodValues = (m: Mood): { streams: number; dawn: number } => ({ streams: m === 'network' ? 1 : 0, dawn: m === 'dawn' ? 1 : 0 })

const actor = defineActor<'mood', SkyStep, object, undefined, 'window'>({
  name: 'fable-sky',
  kinds: ['mood'],

  duration() {
    return MOOD_MS
  },

  mount(root) {
    root.classList.add('A-fable-sky')
    root.innerHTML = `<canvas class="sky-canvas" width="${W}" height="${H}" aria-hidden="true"></canvas>`
    const paint = createSkyPainter(root.querySelector<HTMLCanvasElement>('canvas')!)

    return {
      render({ events }, ms) {
        const evs = (events as Ev[]).filter((e) => e.kind === 'mood')
        const last = evs[evs.length - 1] ?? null
        const before = evs.length > 1 ? evs[evs.length - 2].step.mood : undefined
        const to = moodValues(MOODS.includes(last?.step.mood as Mood) ? (last!.step.mood as Mood) : 'night')
        const from = moodValues(MOODS.includes(before as Mood) ? (before as Mood) : 'night')
        const p = last ? kit.ease.inOutCubic(last.p) : 1
        const streams = kit.lerp(from.streams, to.streams, p)
        const dawn = kit.lerp(from.dawn, to.dawn, p)
        paint(ms, { streams, dawn, city: 1 })
      },
      target() {
        return root
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
