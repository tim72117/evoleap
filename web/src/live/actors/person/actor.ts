// 演員 person:情境動畫裡的插畫人物(半身像 + 名字 + 對話泡泡),例如店員、老闆、客人。
// 規格見 ../../README.md「演員」(2A.1)。沒有狀態:畫面只看最後一句台詞。
// 人物是程式畫的 SVG(不用圖檔),表情、眨眼、說話嘴型都由時間決定。
//
// props(登場設定):
//   name    名字,例如「老闆」「店員B」
//   look    造型:boss(戴烘焙帽、留鬍子)、staff(包頭巾、綠圍裙)、customer(預設,衣服顏色依名字變)
//
// 動作:
//   { "say": "每一張都要再回問一次。", "mood": "tired" }   說一句話:泡泡冒出、逐字出現、嘴巴跟著動;mood 換表情
//     mood:calm(預設)、tired(嘆氣)、worried(困擾)、happy(開心)、busy(忙亂)
//   演員表裡有多個 person 時,每一步要加 "on": "代號"。
//
// 目標:window、face、bubble
import { kit } from '../../kit'
import { defineActor, type CommonStepFields } from '../../types'
import './actor.css'

type PersonKind = 'say'
type Mood = 'calm' | 'tired' | 'worried' | 'happy' | 'busy'
type Look = 'boss' | 'staff' | 'customer'
type PersonStep = CommonStepFields & { say?: string; mood?: Mood }
interface PersonProps {
  name?: string
  look?: Look
}
type PersonTarget = 'window' | 'face' | 'bubble'

const MOODS: readonly Mood[] = ['calm', 'tired', 'worried', 'happy', 'busy']
const LOOKS: readonly Look[] = ['boss', 'staff', 'customer']
const CPS = 9
const HOLD = 1100
const INK = '#3b2a20'
const SKIN = '#f6d2b5'

const hueOf = (name: string): number => [...name].reduce((h, c) => (h * 31 + c.codePointAt(0)!) % 360, 7)

/** 身體、頭、頭髮(不隨表情變) */
function figure(look: Look, name: string): { back: string; front: string } {
  const shirt = look === 'customer' ? `hsl(${hueOf(name)} 45% 62%)` : '#f4efe6'
  const body = `<path d="M18 230 C18 176 56 154 100 154 C144 154 182 176 182 230 Z" fill="${shirt}"/>`
  const apron =
    look === 'customer'
      ? ''
      : `<path d="M64 166 L136 166 L146 230 L54 230 Z" fill="${look === 'boss' ? '#8b5e3c' : '#5b8c6a'}"/>` +
        `<path d="M70 166 L80 150 M130 166 L120 150" stroke="${look === 'boss' ? '#6f4a2e' : '#467055'}" stroke-width="5" stroke-linecap="round"/>`
  const neck = `<rect x="88" y="128" width="24" height="32" rx="8" fill="#e9bd9c"/>`
  const head =
    `<circle cx="54" cy="98" r="10" fill="${SKIN}"/><circle cx="146" cy="98" r="10" fill="${SKIN}"/>` +
    `<ellipse cx="100" cy="94" rx="46" ry="50" fill="${SKIN}"/>`
  let hairBack = ''
  let hair = ''
  if (look === 'boss') {
    hair = `<path d="M55 92 C52 56 74 46 100 46 C126 46 148 56 145 92 C140 76 126 68 100 68 C76 68 60 76 55 92 Z" fill="#9a9a9a"/>`
    // 烘焙帽
    hair +=
      `<rect x="60" y="40" width="80" height="22" rx="5" fill="#ffffff" stroke="#e3d8c8" stroke-width="2"/>` +
      `<circle cx="74" cy="28" r="18" fill="#ffffff" stroke="#e3d8c8" stroke-width="2"/>` +
      `<circle cx="126" cy="28" r="18" fill="#ffffff" stroke="#e3d8c8" stroke-width="2"/>` +
      `<circle cx="100" cy="20" r="22" fill="#ffffff" stroke="#e3d8c8" stroke-width="2"/>` +
      `<rect x="62" y="34" width="76" height="14" fill="#ffffff"/>`
  } else if (look === 'staff') {
    hairBack = `<path d="M50 100 C46 52 74 36 100 36 C126 36 154 52 150 100 L152 138 C140 146 128 140 140 116 L60 116 C72 140 60 146 48 138 Z" fill="#3a2a22"/>`
    hair =
      `<path d="M56 96 C58 70 76 60 100 60 C124 60 142 70 144 96 C132 84 118 80 106 80 C96 88 76 92 56 96 Z" fill="#3a2a22"/>` +
      // 頭巾
      `<path d="M52 72 C60 40 140 40 148 72 C130 60 70 60 52 72 Z" fill="#e07a5f"/>` +
      `<path d="M146 64 L164 56 L160 74 Z" fill="#c9654b"/>`
  } else {
    hair = `<path d="M54 96 C48 54 74 38 100 38 C130 38 154 56 146 96 C142 76 126 64 108 66 C96 76 72 80 54 96 Z" fill="#4a3426"/>`
  }
  return { back: hairBack + body + apron + neck, front: head + hair }
}

/** 五官:依表情、眨眼、嘴巴開合 */
function features(mood: Mood, look: Look, blink: boolean, open: boolean): string {
  const s = `stroke="${INK}" stroke-width="4" stroke-linecap="round" fill="none"`
  const eye = (x: number) => (blink ? `<path d="M${x - 6} 98 L${x + 6} 98" ${s}/>` : `<ellipse cx="${x}" cy="97" rx="4.5" ry="6" fill="${INK}"/>`)
  let eyes = eye(82) + eye(118)
  let brows = `<path d="M74 82 Q82 78 90 82" ${s}/><path d="M110 82 Q118 78 126 82" ${s}/>`
  let mouth = open ? `<ellipse cx="100" cy="122" rx="7" ry="6" fill="#8c3b32"/>` : `<path d="M90 119 Q100 127 110 119" ${s}/>`
  let extra = ''
  let blush = `<ellipse cx="72" cy="112" rx="7" ry="4" fill="#f2a28e" opacity=".55"/><ellipse cx="128" cy="112" rx="7" ry="4" fill="#f2a28e" opacity=".55"/>`
  const sweat = (x: number, y: number) => `<path d="M${x} ${y} C${x - 6} ${y + 10} ${x - 5} ${y + 16} ${x} ${y + 16} C${x + 5} ${y + 16} ${x + 6} ${y + 10} ${x} ${y} Z" fill="#8cc7ef"/>`
  if (mood === 'happy') {
    eyes = `<path d="M76 99 Q82 90 88 99" ${s}/><path d="M112 99 Q118 90 124 99" ${s}/>`
    mouth = `<path d="M87 116 Q100 ${open ? 136 : 130} 113 116 Z" fill="#8c3b32"/>`
    blush = blush.replace(/opacity="\.55"/g, 'opacity=".9"')
  } else if (mood === 'tired') {
    // 眼皮垂下、嘆氣
    eyes = `<path d="M75 96 Q82 101 89 96" ${s}/><path d="M111 96 Q118 101 125 96" ${s}/><path d="M77 104 Q82 106 87 104" stroke="#c99a84" stroke-width="2.5" fill="none"/><path d="M113 104 Q118 106 123 104" stroke="#c99a84" stroke-width="2.5" fill="none"/>`
    brows = `<path d="M74 84 L90 88" ${s}/><path d="M110 88 L126 84" ${s}/>`
    mouth = `<ellipse cx="100" cy="123" rx="${open ? 6 : 4.5}" ry="${open ? 5 : 3.5}" fill="#8c3b32"/>`
    extra = `<g fill="#ffffff" stroke="#d9d2c6" stroke-width="2"><circle cx="128" cy="134" r="6"/><circle cx="140" cy="140" r="8"/><circle cx="156" cy="142" r="10"/></g>`
  } else if (mood === 'worried') {
    brows = `<path d="M74 86 L90 80" ${s}/><path d="M110 80 L126 86" ${s}/>`
    mouth = open ? mouth : `<path d="M89 122 Q94 117 100 122 Q106 127 111 122" ${s}/>`
    extra = sweat(148, 72)
  } else if (mood === 'busy') {
    const swirl = (x: number) => `<path d="M${x} 97 m-1 0 a2 2 0 1 1 3 1 a4 4 0 1 1 -6 -3 a6.5 6.5 0 1 1 10 5" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    eyes = swirl(82) + swirl(118)
    brows = `<path d="M74 84 L90 80" ${s}/><path d="M110 80 L126 84" ${s}/>`
    mouth = open ? mouth : `<path d="M88 122 L94 118 L100 123 L106 118 L112 122" ${s}/>`
    extra = sweat(150, 66) + sweat(44, 80)
  }
  const mustache = look === 'boss' ? `<path d="M84 114 Q92 108 100 113 Q108 108 116 114 Q108 118 100 115 Q92 118 84 114 Z" fill="#7d7d7d"/>` : ''
  return blush + brows + eyes + mouth + mustache + extra
}

const actor = defineActor<PersonKind, PersonStep, PersonProps, undefined, PersonTarget>({
  name: 'person',
  kinds: ['say'],
  parts: { name: '.ps-name', bubble: '.ps-bubble' },

  hotspots() {
    return [{ target: 'window', label: '讓人物說話', input: { placeholder: '說一句話', step: (text: string) => ({ say: text }) } }]
  },

  duration(_kind, step) {
    if (typeof step.say !== 'string' || !step.say) throw new Error('say 要寫台詞')
    if (step.mood && !MOODS.includes(step.mood)) throw new Error(`say 的 mood 只能是 ${MOODS.join('、')}`)
    return 300 + kit.typeDuration(step.say, CPS) + HOLD
  },

  mount(root, props) {
    if (props.look && !LOOKS.includes(props.look)) throw new Error(`person 的 look 只能是 ${LOOKS.join('、')}`)
    const look = props.look ?? 'customer'
    const fig = figure(look, props.name || '')
    root.classList.add('A-person')
    root.innerHTML =
      `<div class="ps-card"><svg class="ps-face" viewBox="0 0 200 230" aria-hidden="true">${fig.back}<g class="ps-head">${fig.front}<g class="ps-feat"></g></g></svg><div class="ps-name"></div></div>` +
      `<div class="ps-bubble" hidden><span class="ps-text"></span></div>`
    const face = root.querySelector<HTMLElement>('.ps-face')!
    const head = root.querySelector<SVGGElement>('.ps-head')!
    const feat = root.querySelector<SVGGElement>('.ps-feat')!
    const bubble = root.querySelector<HTMLElement>('.ps-bubble')!
    const text = root.querySelector<HTMLElement>('.ps-text')!
    kit.setIf(root.querySelector<HTMLElement>('.ps-name')!, 'text', props.name || '')
    // 每個人眨眼的時間錯開
    const seed = hueOf(props.name || '') * 37

    return {
      render(frame, ms) {
        const ev = [...frame.events].reverse().find((e) => e.kind === 'say')
        const step = ev?.step as PersonStep | undefined
        const mood: Mood = step?.mood ?? 'calm'
        const blink = mood !== 'happy' && mood !== 'busy' && mood !== 'tired' && (ms + seed) % 3400 < 140
        let open = false
        let dx = 0
        let dy = 0
        if (ev && step?.say) {
          const typing = kit.typewriter(step.say, ev.local, { start: 300, cps: CPS })
          const talkEnd = 300 + kit.typeDuration(step.say, CPS)
          // 說話時嘴巴一開一合、頭輕輕點
          if (ev.local >= 300 && ev.local < talkEnd) {
            open = Math.floor((ev.local - 300) / 130) % 2 === 0
            dy = Math.sin((ev.local - 300) / 160) * 1.5
          }
          // 嘆氣、忙亂時頭輕晃
          if (mood === 'tired' || mood === 'busy') dx = kit.shake(ev.local, 200, 600, 4)
          bubble.hidden = false
          kit.css(bubble, kit.enter(kit.progress(ev.local, 0, 300), { dist: '0.6em', scale: 0.9 }))
          kit.setIf(text, 'text', typing.text)
        } else {
          bubble.hidden = true
        }
        kit.setIf(feat, 'html', features(mood, look, blink, open))
        kit.css(head, { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` })
      },

      target(name) {
        if (name === 'window') return root.querySelector<HTMLElement>('.ps-card')
        if (name === 'face') return face
        if (name === 'bubble') return bubble.hidden ? null : bubble
        return null
      },
    }
  },
})

export default actor

// 開發時引擎的程式一改就整頁重新載入(見 ../index.ts 的說明)。
if (import.meta.hot) import.meta.hot.accept(() => location.reload())
