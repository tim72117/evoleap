// 演員 pickai-reel:「長輩怎麼選 AI App、怎麼開始用」教學短片(直式 1080×1920;研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 手機畫面是示意,不仿任何 App 的介面;列出的三個 App 不是排名。繪圖小工具沿用 ../voice-reel/actor.ts。
//
// props:無
// 動作:{ "scene": "intro" | "pick" | "install" | "talk" | "safe" | "outro" }(可寫 ms 指定長度)
// 目標:window
import { defineActor, type CommonStepFields } from '../../../../live/types'
import { H, W, box, rise, text } from '../voice-reel/actor'
import './actor.css'

const SCENES = ['intro', 'pick', 'install', 'talk', 'safe', 'outro'] as const
type Scene = (typeof SCENES)[number]
type Step = CommonStepFields & { scene?: Scene }

const bg = (c: string): string => `<rect width="${W}" height="${H}" fill="${c}"/>`
const left = (x: number, y: number, s: string, size: number, fill = '#222', weight = 800): string =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}">${s}</text>`
const row = (l: number, at: number, y: number, mark: string, color: string, a: string, b: string): string =>
  rise(l, at, box(80, y, 920, 260, '#fff') + `<circle cx="195" cy="${y + 130}" r="66" fill="${color}"/>` + text(195, y + 155, mark, 70, '#fff') + left(300, y + 115, a, 62) + left(300, y + 200, b, 42, '#666', 600))

function scene(name: Scene, l: number): string {
  if (name === 'intro') {
    return (
      bg('#fff6e8') +
      rise(l, 0, text(540, 640, 'AI 軟體好多', 110, '#222')) +
      rise(l, 500, text(540, 810, '長輩該裝哪一個?', 96, '#b0452f')) +
      rise(l, 1200, box(190, 980, 700, 150, '#1f7a55', 75) + text(540, 1078, '一次教你選、教你用', 56, '#fff'))
    )
  }
  if (name === 'pick') {
    return (
      bg('#e5f4ea') +
      text(540, 300, '常見的三個', 92, '#14503a') +
      row(l, 100, 420, 'C', '#1f7a55', 'ChatGPT', '開發公司:OpenAI') +
      row(l, 450, 710, 'G', '#2f6fb0', 'Gemini', '開發公司:Google') +
      row(l, 800, 1000, 'C', '#b5653b', 'Claude', '開發公司:Anthropic') +
      rise(l, 1200, text(540, 1390, '先裝一個就好,不用全裝', 58, '#222') + text(540, 1480, '以上不是排名', 40, '#666', 500))
    )
  }
  if (name === 'install') {
    return (
      bg('#eef1f4') +
      text(540, 300, '下載前看 3 件事', 88, '#222') +
      row(l, 100, 420, '1', '#2f6fb0', '官方商店下載', 'App Store 或 Google Play') +
      row(l, 900, 710, '2', '#2f6fb0', '看開發公司名稱', '名字很像的可能是仿冒') +
      row(l, 1700, 1000, '3', '#2f6fb0', '先用免費版', '跳出付費畫面先不要按') +
      rise(l, 2500, text(540, 1400, '不會裝,請家人幫忙', 56, '#b0452f'))
    )
  }
  if (name === 'talk') {
    return (
      bg('#10233a') +
      text(540, 300, '開始用:用講的就好', 78, '#fff') +
      rise(l, 100, `<circle cx="540" cy="560" r="150" fill="#e8453c"/>` + box(505, 480, 70, 120, '#fff', 35) + `<path d="M475 560 C475 660 605 660 605 560 M540 635 V680" stroke="#fff" stroke-width="16" fill="none" stroke-linecap="round"/>` + text(540, 800, '按麥克風,直接說', 56, '#ffd24a')) +
      rise(l, 700, box(80, 880, 920, 230, '#d7f0c9', 44) + text(540, 975, '「明天要去看孫子,', 52, '#1c2b24') + text(540, 1055, '幫我寫一句問候」', 52, '#1c2b24')) +
      rise(l, 1600, box(80, 1160, 920, 170, '#fff', 44) + text(540, 1265, 'AI:好的,這樣寫如何……', 50, '#222', 600)) +
      rise(l, 2300, text(540, 1450, '聽不懂就說:「講簡單一點」', 58, '#fff'))
    )
  }
  if (name === 'safe') {
    return (
      bg('#fdeceb') +
      text(540, 300, '這些不要告訴 AI', 88, '#9b231a') +
      row(l, 100, 420, '✕', '#d6362b', '身分證、健保卡', '號碼和照片都不要') +
      row(l, 500, 710, '✕', '#d6362b', '銀行帳號、信用卡', '存摺也不要拍') +
      row(l, 900, 1000, '✕', '#d6362b', '密碼、驗證碼', '誰來要都不給') +
      rise(l, 1500, text(540, 1400, 'AI 會講錯,重要的事要查證', 54, '#222'))
    )
  }
  return (
    bg('#10233a') +
    rise(l, 0, text(540, 520, '今天就試一句', 110, '#fff') + text(540, 670, '慢慢來,不用怕', 80, '#ffd24a')) +
    rise(l, 400, box(90, 860, 900, 360, '#fff') + text(540, 975, '覺得有幫助嗎?', 56, '#222') + box(140, 1030, 370, 140, '#1877f2', 70) + text(325, 1124, '👍 按讚', 62, '#fff') + box(570, 1030, 370, 140, '#e8453c', 70) + text(755, 1124, '+ 加粉絲', 62, '#fff')) +
    rise(l, 900, text(540, 1390, 'evoleap', 84, '#fff') + text(540, 1480, '和你一起看懂 AI', 48, '#b9c6d8', 600))
  )
}

const actor = defineActor<'scene', Step, object, { scene: Scene | null }, 'window'>({
  name: 'pickai-reel',
  kinds: ['scene'],
  init() {
    return { scene: null }
  },
  apply(_st, _kind, s) {
    if (!s.scene || !SCENES.includes(s.scene)) throw new Error(`scene 要寫 ${SCENES.join('、')} 其中之一`)
    return { scene: s.scene }
  },
  duration() {
    return 5000
  },
  autoFocus() {
    return undefined
  },
  mount(root) {
    root.classList.add('A-pickai-reel')
    root.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"></svg>`
    const svg = root.querySelector('svg')!
    return {
      render(frame, ms) {
        const view = frame.view
        if (!view?.state.scene) return
        const ev = view.ev && view.ev.kind !== 'hide' ? view.ev : null
        svg.innerHTML = scene(view.state.scene, ev ? ev.local : 100000 + ms)
      },
      target() {
        return root
      },
    }
  },
})

export default actor

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
