// 演員 doctor-reel:「AI 假醫師賣產品」防詐宣傳短片(直式 1080×1920;研發基地專用,不進公開 bundle;登記在 ../../registerActors.ts)。
// 醫師是插畫示意,不放真人臉、不寫姓名與產品品牌。繪圖小工具沿用 ../voice-reel/actor.ts。
// 案例出自 ETtoday 2026-05-12(彰化基督教醫院聲明):https://www.ettoday.net/news/20260512/3164493.htm
//
// props:無
// 動作:{ "scene": "ad" | "fake" | "case" | "flags" | "tips" | "outro" }(可寫 ms 指定長度)
// 目標:window
import { defineActor, type CommonStepFields } from '../../../../live/types'
import { H, W, box, out, rise, text } from '../voice-reel/actor'
import './actor.css'

const SCENES = ['ad', 'fake', 'case', 'flags', 'tips', 'outro'] as const
type Scene = (typeof SCENES)[number]
type Step = CommonStepFields & { scene?: Scene }

const bg = (c: string): string => `<rect width="${W}" height="${H}" fill="${c}"/>`
const tag = (fill = '#7d8794'): string => text(540, 150, '防詐提醒 · 畫面為情境示意', 36, fill, 600)

/** 插畫醫師(虛構):白袍、聽診器;mouth 0–1 控制嘴巴開合 */
function doctor(mouth: number): string {
  return (
    `<path d="M300 960 C310 760 430 720 540 720 C650 720 770 760 780 960Z" fill="#fff"/>` +
    `<path d="M495 722 L540 840 L585 722Z" fill="#8fb8d8"/>` +
    `<path d="M460 750 C440 870 520 900 530 850 M620 750 C640 830 610 860 610 860" stroke="#3b4756" stroke-width="12" fill="none" stroke-linecap="round"/>` +
    `<circle cx="610" cy="876" r="22" fill="#3b4756"/>` +
    `<ellipse cx="540" cy="580" rx="125" ry="145" fill="#f4cda9"/>` +
    `<path d="M415 560 C400 400 680 400 665 560 C640 490 600 475 540 478 C480 475 440 490 415 560Z" fill="#6d6f76"/>` +
    `<g fill="none" stroke="#2b2b33" stroke-width="9"><rect x="455" y="555" width="70" height="52" rx="18"/><rect x="555" y="555" width="70" height="52" rx="18"/><path d="M525 575 H555"/></g>` +
    `<circle cx="490" cy="580" r="9" fill="#2b2b33"/><circle cx="590" cy="580" r="9" fill="#2b2b33"/>` +
    `<ellipse cx="540" cy="662" rx="34" ry="${(5 + mouth * 15).toFixed(1)}" fill="#8c3f38"/>`
  )
}
const talking = (l: number): number => Math.abs(Math.sin(l / 120) * Math.cos(l / 270))

function scene(name: Scene, l: number): string {
  if (name === 'ad') {
    return (
      bg('#10233a') + tag('#9fb0c6') +
      box(110, 230, 860, 1000, '#cfe3f2') + doctor(talking(l)) +
      box(110, 960, 860, 270, '#10233a', 0) +
      text(540, 1060, '「院長親自推薦！」', 70, '#ffd24a') +
      text(540, 1160, '膝蓋痠痛，戴這個就好', 54, '#fff', 700) +
      rise(l, 600, box(290, 1270, 500, 110, '#e8453c', 55) + text(540, 1343, '立即下單', 56, '#fff')) +
      rise(l, 2200, text(540, 1510, '醫師都說了，', 84, '#fff') + text(540, 1620, '能信嗎？', 100, '#ffd24a'))
    )
  }
  if (name === 'fake') {
    const p = out((l - 700) / 500)
    // 掃描線與錯位色塊:示意畫面是合成的
    const y = 300 + ((l / 3) % 760)
    return (
      bg('#10233a') + tag('#9fb0c6') +
      box(110, 230, 860, 780, '#cfe3f2') + doctor(talking(l)) +
      `<rect x="110" y="${y.toFixed(0)}" width="860" height="14" fill="#2ee6c5" opacity="0.8"/>` +
      `<g opacity="${p.toFixed(2)}" transform="rotate(-12 540 560) translate(540 560) scale(${(1.6 - 0.6 * p).toFixed(3)}) translate(-540 -560)">` +
      box(250, 470, 580, 190, '#e8453c', 24) + text(540, 598, 'AI 合成', 108, '#fff') + `</g>` +
      rise(l, 1500, text(540, 1180, '臉可以假', 110, '#fff')) +
      rise(l, 2300, text(540, 1320, '聲音也可以假', 110, '#ffd24a'))
    )
  }
  if (name === 'case') {
    return (
      bg('#fff6e8') +
      rise(l, 0, text(540, 360, '真實發生過', 100, '#222')) +
      rise(l, 500, box(90, 470, 900, 420, '#fff') + text(540, 590, '彰化一家大醫院的總院長', 54, '#222', 700) + text(540, 710, '被 AI 深偽冒名', 90, '#d6362b') + text(540, 820, '拿去推銷護膝等產品', 54, '#222', 700)) +
      rise(l, 2300, box(90, 950, 900, 380, '#d6362b') + text(540, 1100, '連醫院員工', 90, '#fff') + text(540, 1230, '都有人上當購買', 78, '#ffe27a')) +
      text(540, 1500, '資料來源：ETtoday 2026/5/12 報導（院方聲明）', 34, '#8a8174', 500)
    )
  }
  if (name === 'flags') {
    const flag = (at: number, y: number, s: string): string => rise(l, at, box(80, y, 920, 220, '#fff') + text(190, y + 148, '!', 120, '#e8453c') + `<text x="290" y="${y + 135}" font-size="62" font-weight="800" fill="#222">${s}</text>`)
    return (
      bg('#3a2326') + tag('#c9aeb1') +
      text(540, 320, '看到這些，先停手', 82, '#fff') +
      flag(300, 460, '叫你停藥') +
      flag(1500, 720, '保證有效、限時特價') +
      flag(2700, 980, '要你加 LINE 才能買') +
      rise(l, 3900, text(540, 1400, '像本人，也不一定是本人', 62, '#ffd24a'))
    )
  }
  if (name === 'tips') {
    const tip = (at: number, y: number, num: string, a: string, b: string): string =>
      rise(l, at, box(80, y, 920, 300, '#fff') + `<circle cx="195" cy="${y + 150}" r="66" fill="#1f7a55"/>` + text(195, y + 175, num, 70, '#fff') + `<text x="300" y="${y + 135}" font-size="68" font-weight="800" fill="#1c2b24">${a}</text><text x="300" y="${y + 225}" font-size="46" font-weight="600" fill="#52625a">${b}</text>`)
    return (
      bg('#e5f4ea') +
      text(540, 300, '記住 3 件事', 92, '#14503a') +
      tip(300, 420, '1', '先別買', '不點廣告連結、不匯款') +
      tip(1700, 760, '2', '查官網', '到醫院官方網站查證') +
      tip(3100, 1100, '3', '問醫師', '用藥問自己的醫師、藥師') +
      rise(l, 4500, text(540, 1540, '可疑廣告，撥打 165', 62, '#b0452f'))
    )
  }
  return (
    bg('#10233a') +
    rise(l, 0, text(540, 650, '爸媽常看健康影片？', 76, '#fff') + text(540, 810, '傳給他們看', 124, '#ffd24a')) +
    rise(l, 700, box(190, 950, 700, 150, '#1f7a55', 75) + text(540, 1048, '身體問題，問真醫師', 56, '#fff')) +
    rise(l, 1300, text(540, 1330, 'evoleap', 84, '#fff') + text(540, 1420, '和你一起看懂 AI', 48, '#b9c6d8', 600))
  )
}

const actor = defineActor<'scene', Step, object, { scene: Scene | null }, 'window'>({
  name: 'doctor-reel',
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
    root.classList.add('A-doctor-reel')
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
