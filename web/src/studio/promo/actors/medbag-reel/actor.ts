// 演員 medbag-reel:「拍藥袋,問 AI 看懂它」教學短片(直式 1080×1920;研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 藥袋、藥名、回答全是虛構示意;影片只教「看懂藥袋上寫的字」,不給用藥建議。繪圖小工具沿用 ../voice-reel/actor.ts。
//
// props:無
// 動作:{ "scene": "problem" | "hide" | "ask" | "answer" | "check" | "outro" }(可寫 ms 指定長度)
// 目標:window
import { defineActor, type CommonStepFields } from '../../../../live/types'
import { H, W, box, out, rise, text } from '../voice-reel/actor'
import './actor.css'

const SCENES = ['problem', 'hide', 'ask', 'answer', 'check', 'outro'] as const
type Scene = (typeof SCENES)[number]
type Step = CommonStepFields & { scene?: Scene }

const bg = (c: string): string => `<rect width="${W}" height="${H}" fill="${c}"/>`
const tag = (): string => text(540, 150, '畫面與藥品皆為虛構示意', 36, '#8a8174', 600)
const left = (x: number, y: number, s: string, size: number, fill = '#222', weight = 700): string =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}">${s}</text>`

/** 虛構藥袋;cover 0–1:個資被貼紙蓋住的進度 */
function bag(cover: number): string {
  const sticker = (y: number): string => box(300, y, 470 * cover, 66, '#1f7a55', 12)
  return (
    box(180, 230, 720, 880, '#fff', 30) +
    box(180, 230, 720, 120, '#2f6fb0', 30) +
    text(540, 312, '範例藥局 藥袋', 54, '#fff') +
    left(230, 440, '姓名:王○○', 42) +
    left(230, 530, '病歷號:000000', 42) +
    sticker(392) +
    sticker(482) +
    `<path d="M220 590 H860" stroke="#ccc" stroke-width="4"/>` +
    left(230, 670, '藥名:範例錠 5 毫克', 42) +
    left(230, 750, '用法:一天 3 次 每次 1 顆 飯後', 30, '#444', 500) +
    left(230, 820, '天數:7 天 總量:21 顆', 30, '#444', 500) +
    left(230, 890, '注意事項:服藥後可能想睡,避免開車', 30, '#444', 500) +
    left(230, 960, '調劑藥師:○○○ 電話:00-0000-0000', 28, '#777', 500)
  )
}

function scene(name: Scene, l: number): string {
  if (name === 'problem') {
    return (
      bg('#fff6e8') + tag() + bag(0) +
      rise(l, 700, text(540, 1300, '藥袋的字好小,', 92, '#222')) +
      rise(l, 1500, text(540, 1440, '看不懂怎麼辦?', 100, '#b0452f'))
    )
  }
  if (name === 'hide') {
    return (
      bg('#fff6e8') + tag() + bag(out((l - 900) / 900)) +
      rise(l, 100, text(540, 1290, '第 1 步', 56, '#1f7a55')) +
      rise(l, 300, text(540, 1410, '先遮住個人資料', 90, '#222')) +
      rise(l, 1800, text(540, 1510, '姓名、病歷號貼起來再拍', 48, '#666', 600))
    )
  }
  if (name === 'ask') {
    return (
      bg('#eef1f4') +
      text(540, 300, '第 2 步', 56, '#1f7a55') +
      text(540, 420, '拍照,對 AI 說這句', 84, '#222') +
      rise(l, 500, box(240, 520, 600, 440, '#c9d6e3', 30) + text(540, 750, '藥袋照片', 60, '#48586a') + text(540, 840, '(個資已遮住)', 40, '#48586a', 500)) +
      rise(l, 1400, box(80, 1020, 920, 440, '#d7f0c9', 44) + text(540, 1130, '「用白話告訴我', 66, '#1c2b24') + text(540, 1235, '藥袋上寫了什麼。', 66, '#1c2b24') + text(540, 1340, '看不清楚的不要猜。」', 66, '#b0452f'))
    )
  }
  if (name === 'answer') {
    const line = (at: number, y: number, k: string, v: string): string => rise(l, at, left(130, y, k, 44, '#1f7a55', 800) + left(130, y + 74, v, 52), 20)
    return (
      bg('#eef1f4') + tag() +
      text(540, 300, 'AI 幫你整理', 84, '#222') +
      box(80, 390, 920, 1080, '#fff', 44) +
      line(300, 490, '這是什麼', '範例錠 5 毫克') +
      line(1100, 690, '藥袋寫的吃法', '一天 3 次、每次 1 顆、飯後') +
      line(1900, 890, '幾天', '7 天,共 21 顆') +
      line(2700, 1090, '要注意', '可能想睡,避免開車') +
      rise(l, 3600, box(120, 1260, 840, 160, '#fff1c9', 28) + text(540, 1358, '不確定的地方請問藥師', 50, '#7a5200'))
    )
  }
  if (name === 'check') {
    const tip = (at: number, y: number, num: string, a: string, b: string): string =>
      rise(l, at, box(80, y, 920, 300, '#fff') + `<circle cx="195" cy="${y + 150}" r="66" fill="#d6362b"/>` + text(195, y + 175, num, 70, '#fff') + left(300, y + 135, a, 62, '#222', 800) + left(300, y + 225, b, 44, '#666', 600))
    return (
      bg('#fdeceb') +
      text(540, 300, 'AI 也會看錯', 96, '#9b231a') +
      tip(300, 420, '1', '對照藥袋', '次數、顆數再看一次') +
      tip(1700, 760, '2', '不自己改藥', '不停藥、不加量') +
      tip(3100, 1100, '3', '有疑問問藥師', '打藥袋上的電話')
    )
  }
  return (
    bg('#10233a') +
    rise(l, 0, text(540, 480, 'AI 幫你「看懂」', 90, '#fff') + text(540, 630, '不幫你「決定」', 100, '#ffd24a')) +
    rise(l, 600, box(190, 730, 700, 140, '#1f7a55', 70) + text(540, 822, '用藥問醫師、藥師', 56, '#fff')) +
    // 片尾邀請:按讚、加入粉絲
    rise(l, 1800, box(90, 960, 900, 360, '#fff') + text(540, 1075, '覺得有幫助嗎?', 56, '#222') + box(140, 1130, 370, 140, '#1877f2', 70) + text(325, 1224, '👍 按讚', 62, '#fff') + box(570, 1130, 370, 140, '#e8453c', 70) + text(755, 1224, '+ 加粉絲', 62, '#fff')) +
    rise(l, 2600, text(540, 1450, 'evoleap', 84, '#fff') + text(540, 1540, '和你一起看懂 AI', 48, '#b9c6d8', 600))
  )
}

const actor = defineActor<'scene', Step, object, { scene: Scene | null }, 'window'>({
  name: 'medbag-reel',
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
    root.classList.add('A-medbag-reel')
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
