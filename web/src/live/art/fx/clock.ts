// art/fx/clock:牆上時鐘 + 「第 N 天」日曆牌。時間流逝(經過了幾小時)用一個數字 hours 表示,畫面全由它決定。
// 一天從 START_HOUR 點開始;hours 一直往上加,分針與時針跟著轉、過了午夜日曆翻到下一天、夜裡 nightOf 給 0–1 的「天色多暗」。
// 用法:el.innerHTML = clockMarkup();mount 時 const c = mountClock(el);每格 renderClock(c, hours)。位置與大小由場景的 class 決定(元素 position:absolute)。
import { kit } from '../../kit'
import { attr, fx } from '../dom'
import './clock.css'

/** 第 1 天從幾點開始(hours = 0 的時候) */
export const START_HOUR = 9

/** 一天裡的幾點(0–24,含小數) */
export const todOf = (hours: number): number => (((START_HOUR + hours) % 24) + 24) % 24
/** 第幾天(從 1 開始) */
export const dayOf = (hours: number): number => Math.floor((START_HOUR + hours) / 24) + 1
/** 時針與分針的角度(度,12 點方向為 0、順時針) */
export const clockAngles = (hours: number): { hour: number; min: number } => {
  const t = todOf(hours)
  return { hour: ((t % 12) / 12) * 360, min: (t % 1) * 360 }
}
/** 天色多暗 0–1:白天 0,傍晚(17–21 點)漸暗,夜裡 1,清晨(5–8 點)漸亮 */
export const nightOf = (hours: number): number => {
  const t = todOf(hours)
  if (t >= 8 && t <= 17) return 0
  if (t > 17 && t < 21) return kit.ease.inOutQuad((t - 17) / 4)
  if (t >= 21 || t <= 5) return 1
  return 1 - kit.ease.inOutQuad((t - 5) / 3)
}
/** "HH:MM" */
export const clockText = (hours: number): string => {
  const t = todOf(hours)
  const h = Math.floor(t)
  const m = Math.floor((t - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const clockMarkup = (): string => {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    const r1 = i % 3 === 0 ? 50 : 55
    return `<line x1="${fx(70 + Math.sin(a) * r1, 1)}" y1="${fx(70 - Math.cos(a) * r1, 1)}" x2="${fx(70 + Math.sin(a) * 60, 1)}" y2="${fx(70 - Math.cos(a) * 60, 1)}" stroke="#3a4656" stroke-width="${i % 3 === 0 ? 4 : 2.4}" stroke-linecap="round"/>`
  }).join('')
  return (
    `<div class="art-clock">` +
    `<svg class="art-clock-face" viewBox="0 0 140 140" aria-hidden="true">` +
    `<circle cx="70" cy="70" r="68" fill="#2b3644"/><circle cx="70" cy="70" r="64" fill="#fbfcfe"/><circle cx="70" cy="70" r="64" fill="none" stroke="#c9d3de" stroke-width="2"/>` +
    ticks +
    `<line class="art-clock-h" x1="70" y1="78" x2="70" y2="36" stroke="#1f2833" stroke-width="6" stroke-linecap="round"/>` +
    `<line class="art-clock-m" x1="70" y1="82" x2="70" y2="20" stroke="#1f2833" stroke-width="3.6" stroke-linecap="round"/>` +
    `<circle cx="70" cy="70" r="5" fill="#d9482b"/>` +
    `</svg>` +
    `<div class="art-clock-cal"><b class="art-clock-day"></b><span class="art-clock-time"></span></div>` +
    `</div>`
  )
}

export interface ClockHandles {
  root: HTMLElement
  hour: SVGLineElement
  min: SVGLineElement
  day: HTMLElement
  time: HTMLElement
}
export function mountClock(root: HTMLElement): ClockHandles {
  const q = <E extends Element>(s: string): E => root.querySelector<E>(s)!
  return { root, hour: q('.art-clock-h'), min: q('.art-clock-m'), day: q('.art-clock-day'), time: q('.art-clock-time') }
}
export function renderClock(c: ClockHandles, hours: number): void {
  const a = clockAngles(hours)
  attr(c.hour, 'transform', `rotate(${fx(a.hour, 1)} 70 70)`)
  attr(c.min, 'transform', `rotate(${fx(a.min, 1)} 70 70)`)
  kit.setIf(c.day, 'text', `第 ${dayOf(hours)} 天`)
  kit.setIf(c.time, 'text', clockText(hours))
}
