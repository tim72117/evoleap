// 演員 voice-reel:「AI 變聲假交友詐騙」防詐宣傳短片(直式 1080×1920;研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 全部用 SVG 畫示意畫面(不用真人照片),動畫由 render 依時間算出。
// 案情數字出自 ETtoday 2026-09-02 報導(警方統計):https://www.ettoday.net/news/20260902/3230115.htm
//
// props:無
// 動作:{ "scene": "call" | "reveal" | "case" | "money" | "tips" | "outro" }(可寫 ms 指定長度)
// 目標:window
import { defineActor, type CommonStepFields } from '../../../../live/types'
import './actor.css'

const SCENES = ['call', 'reveal', 'case', 'money', 'tips', 'outro'] as const
type Scene = (typeof SCENES)[number]
type Step = CommonStepFields & { scene?: Scene }

export const W = 1080
export const H = 1920
const clamp = (v: number): number => Math.max(0, Math.min(1, v))
export const out = (v: number): number => 1 - Math.pow(1 - clamp(v), 3)
const n = (v: number): string => v.toFixed(2)

/** 淡入加上移 */
export function rise(l: number, at: number, body: string, dist = 50): string {
  const p = out((l - at) / 420)
  return `<g opacity="${n(p)}" transform="translate(0 ${n((1 - p) * dist)})">${body}</g>`
}
export function text(x: number, y: number, s: string, size: number, fill: string, weight = 800): string {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle">${s}</text>`
}
export const box = (x: number, y: number, w: number, h: number, fill: string, r = 40): string => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`
const tag = (): string => text(540, 150, '防詐提醒 · 畫面為情境示意', 36, '#9aa0b4', 600)

/** 聲波:rough 越大,波形越尖(變聲前的聲音) */
function wave(l: number, y: number, color: string, rough: number): string {
  let s = ''
  for (let i = 0; i < 29; i++) {
    const a = Math.abs(Math.sin(l / 170 + i * 0.7) * Math.cos(l / 310 + i * (0.35 + rough)))
    const h = 24 + a * (130 + rough * 90) * (1 - Math.abs(i - 14) / 20)
    s += box(150 + i * 27.5, y - h / 2, 14, h, color, 7)
  }
  return s
}

/** 通話中的人像:mask 0 = 美女頭像,1 = 面具滑開後的未知人影 */
function caller(mask: number): string {
  const hidden = `<circle cx="540" cy="600" r="220" fill="#2b2f40"/><circle cx="540" cy="555" r="82" fill="#555b73"/><path d="M390 760 C400 640 680 640 690 760 C610 840 470 840 390 760Z" fill="#555b73"/>` + text(540, 590, '?', 110, '#ffd24a')
  const face =
    `<circle cx="540" cy="600" r="220" fill="#ffd9e2"/>` +
    `<path d="M410 700 C370 420 710 420 670 700 L620 720 L460 720Z" fill="#5a3730"/><ellipse cx="540" cy="590" rx="92" ry="108" fill="#f8d3b8"/>` +
    `<path d="M446 570 C470 480 610 470 634 570 C590 540 500 520 446 570Z" fill="#5a3730"/>` +
    `<path d="M494 586 q16 -14 32 0 M554 586 q16 -14 32 0 M505 640 q35 30 70 0" stroke="#5a3730" stroke-width="9" fill="none" stroke-linecap="round"/>` +
    `<path d="M420 770 C450 680 630 680 660 770 C590 835 490 835 420 770Z" fill="#e2708a"/>`
  return `${hidden}<g opacity="${n(1 - mask)}" transform="translate(${n(mask * 520)} 0) rotate(${n(mask * 25)} 540 600)">${face}</g>`
}

function scene(name: Scene, l: number): string {
  const bg = (c: string): string => `<rect width="${W}" height="${H}" fill="${c}"/>`
  if (name === 'call') {
    return (
      bg('#171a26') + tag() +
      text(540, 290, '通話中 00:36', 44, '#7fe0a3', 700) +
      caller(0) +
      text(540, 910, '「小雯」', 62, '#fff') +
      wave(l, 1040, '#ff8fab', 0) +
      rise(l, 600, box(90, 1140, 900, 120, '#fff', 36) + text(540, 1218, '「哥哥，今天有沒有想我？」', 50, '#222', 700)) +
      rise(l, 2300, text(540, 1400, '聲音很甜，', 90, '#fff') + text(540, 1520, '你確定是「她」？', 96, '#ffd24a'))
    )
  }
  if (name === 'reveal') {
    const m = out((l - 900) / 900)
    return (
      bg('#171a26') + tag() +
      caller(m) +
      wave(l, 960, m < 0.5 ? '#ff8fab' : '#8d93ad', m) +
      rise(l, 1700, box(290, 1070, 500, 110, '#ff5a4f', 55) + text(540, 1142, 'AI 變聲 開啟中', 50, '#fff')) +
      rise(l, 2300, text(540, 1330, '聲音可以換', 108, '#fff') + text(540, 1460, '照片也可以是假的', 82, '#ffd24a'))
    )
  }
  if (name === 'case') {
    const k = out((l - 800) / 1600)
    return (
      bg('#fff6e8') +
      rise(l, 0, text(540, 300, '這不是電影情節', 82, '#222') + text(540, 400, '警方破獲 AI 變聲假交友集團', 52, '#b0452f', 700)) +
      rise(l, 600, box(110, 500, 860, 330, '#fff') + text(540, 600, '被害人約', 50, '#666', 700) + text(540, 760, `${Math.round(25 * k)} 萬人`, 150, '#222')) +
      rise(l, 1100, box(110, 880, 860, 330, '#fff') + text(540, 980, '詐騙金額逾', 50, '#666', 700) + text(540, 1140, `${Math.round(9 * k)} 億元`, 150, '#d6362b')) +
      rise(l, 2200, text(540, 1340, '用美女照片建立假身分', 54, '#222', 700) + text(540, 1430, '再用變聲軟體跟你講電話', 54, '#222', 700)) +
      text(540, 1580, '資料來源：ETtoday 2026/9/2 報導（警方統計）', 34, '#8a8174', 500)
    )
  }
  if (name === 'money') {
    const msg = (at: number, y: number, s: string): string => rise(l, at, box(90, y, 800, 150, '#fff', 44) + text(490, y + 95, s, 52, '#222', 700))
    return (
      bg('#2a1f2b') + tag() +
      text(540, 310, '聊出感情以後……', 78, '#fff') +
      msg(300, 450, '「家裡出事了，好急」') +
      msg(1100, 640, '「可以先幫我一下嗎？」') +
      msg(1900, 830, '「匯到這個帳戶就好」') +
      rise(l, 2900, box(90, 1120, 900, 330, '#d6362b') + text(540, 1260, '沒見過面卻要錢', 84, '#fff') + text(540, 1385, '就是警訊！', 96, '#ffe27a'))
    )
  }
  if (name === 'tips') {
    const tip = (at: number, y: number, num: string, a: string, b: string): string =>
      rise(l, at, box(80, y, 920, 300, '#fff') + `<circle cx="195" cy="${y + 150}" r="66" fill="#1f7a55"/>` + text(195, y + 175, num, 70, '#fff') + `<text x="300" y="${y + 135}" font-size="68" font-weight="800" fill="#1c2b24">${a}</text><text x="300" y="${y + 225}" font-size="46" font-weight="600" fill="#52625a">${b}</text>`)
    return (
      bg('#e5f4ea') +
      text(540, 300, '記住 3 件事', 92, '#14503a') +
      tip(300, 420, '1', '不匯款', '金融卡、密碼也不給') +
      tip(1700, 760, '2', '先查證', '掛掉，跟家人商量') +
      tip(3100, 1100, '3', '打 165', '反詐騙專線，免費諮詢') +
      rise(l, 4500, text(540, 1540, '家人先約好一句「通關密語」', 52, '#b0452f'))
    )
  }
  return (
    bg('#171a26') +
    rise(l, 0, text(540, 650, '把這支影片', 92, '#fff') + text(540, 790, '傳給爸媽', 130, '#ffd24a')) +
    rise(l, 700, box(240, 950, 600, 150, '#d6362b', 75) + text(540, 1048, '可疑就打 165', 60, '#fff')) +
    rise(l, 1300, text(540, 1330, 'evoleap', 84, '#fff') + text(540, 1420, '和你一起看懂 AI', 48, '#b9bfd4', 600))
  )
}

const actor = defineActor<'scene', Step, object, { scene: Scene | null }, 'window'>({
  name: 'voice-reel',
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
    root.classList.add('A-voice-reel')
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
